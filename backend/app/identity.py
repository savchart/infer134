from __future__ import annotations

import hashlib


MOCK_IDENTITIES = {
    "gpu-prague.eth": "0x2000000000000000000000000000000000000002",
    "research-agent.eth": "0x1000000000000000000000000000000000000001",
}


def resolve_name(name: str) -> str:
    if name in MOCK_IDENTITIES:
        return MOCK_IDENTITIES[name]
    digest = hashlib.sha256(name.encode("utf-8")).hexdigest()
    return "0x" + digest[:40]


def reverse_lookup(address: str) -> str | None:
    normalized = address.lower()
    for name, known_address in MOCK_IDENTITIES.items():
        if known_address.lower() == normalized:
            return name
    return None


def identity_metadata() -> dict[str, str]:
    return dict(MOCK_IDENTITIES)

