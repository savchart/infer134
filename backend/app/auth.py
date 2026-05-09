from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from app.identity import reverse_lookup
from app.models import AuthChallenge, AuthChallengeRequest, AuthLogoutRequest, AuthRole, AuthSession, AuthVerifyRequest
from app.store import InMemoryStore


def _utc_timestamp(value: datetime | None = None) -> str:
    return (value or datetime.now(UTC)).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _normalize_address(address: str) -> str:
    normalized = address.strip()
    if not normalized.startswith("0x") or len(normalized) != 42:
        raise ValueError("wallet address must be a 0x-prefixed 20-byte address")
    return "0x" + normalized[2:].lower()


def _hash_hex(value: str) -> str:
    return "0x" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def _session_token(challenge: AuthChallenge, signature: str) -> str:
    return _hash_hex("|".join(["session", challenge.challenge_id, challenge.address, challenge.role.value, signature]))


def _challenge_message(challenge_id: str, address: str, role: AuthRole, nonce: str) -> str:
    return "\n".join(
        [
            "Infer134 local wallet authentication",
            f"Role: {role.value}",
            f"Address: {address}",
            f"Challenge: {challenge_id}",
            f"Nonce: {nonce}",
            "This signature is for the local ETHPrague MVP only.",
            "It does not authorize public-network transactions or real funds.",
        ]
    )


def create_auth_challenge(store: InMemoryStore, request: AuthChallengeRequest) -> AuthChallenge:
    address = _normalize_address(request.address)
    challenge_id = store.next_auth_id()
    nonce = secrets.token_hex(16)
    issued_at = datetime.now(UTC)
    challenge = AuthChallenge(
        challenge_id=challenge_id,
        address=address,
        role=request.role,
        ens_style_name=request.ens_style_name or reverse_lookup(address),
        message=_challenge_message(challenge_id, address, request.role, nonce),
        nonce=nonce,
        issued_at=_utc_timestamp(issued_at),
        expires_at=_utc_timestamp(issued_at + timedelta(minutes=10)),
    )
    store.auth_challenges[challenge.challenge_id] = challenge
    return challenge


def verify_auth_challenge(store: InMemoryStore, request: AuthVerifyRequest) -> AuthSession:
    try:
        challenge = store.auth_challenges[request.challenge_id]
    except KeyError as exc:
        raise ValueError(f"auth challenge not found: {request.challenge_id}") from exc

    address = _normalize_address(request.address)
    if address != challenge.address:
        raise ValueError("auth challenge address mismatch")
    if request.role != challenge.role:
        raise ValueError("auth challenge role mismatch")
    if not request.signature.startswith("0x") or len(request.signature) < 10:
        raise ValueError("wallet signature must be a non-empty 0x-prefixed value")

    session = AuthSession(
        session_token=_session_token(challenge, request.signature),
        address=address,
        role=challenge.role,
        ens_style_name=challenge.ens_style_name,
        signature=request.signature,
        challenge_id=challenge.challenge_id,
        created_at=_utc_timestamp(),
    )
    store.auth_sessions[session.session_token] = session
    return session


def get_auth_session(store: InMemoryStore, session_token: str) -> AuthSession:
    try:
        return store.auth_sessions[session_token]
    except KeyError as exc:
        raise ValueError("auth session not found") from exc


def get_role_session(store: InMemoryStore, session_token: str | None, role: AuthRole) -> AuthSession | None:
    if not session_token:
        return None
    session = get_auth_session(store, session_token)
    if session.role != role:
        raise ValueError(f"auth session role must be {role.value}")
    return session


def logout_auth_session(store: InMemoryStore, request: AuthLogoutRequest) -> dict[str, bool]:
    store.auth_sessions.pop(request.session_token, None)
    return {"logged_out": True}
