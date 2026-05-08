from __future__ import annotations

import hashlib
from typing import Any


MOCK_IDENTITIES = {
    "gpu-prague.eth": "0x2000000000000000000000000000000000000002",
    "research-agent.eth": "0x1000000000000000000000000000000000000001",
}

MOCK_IDENTITY_METADATA: dict[str, dict[str, Any]] = {
    "gpu-prague.eth": {
        "kind": "worker",
        "display_name": "Prague GPU Worker",
        "address": MOCK_IDENTITIES["gpu-prague.eth"],
        "capabilities": ["mock-llama", "deterministic inference", "signed execution receipts"],
        "endpoint_hint": "http://127.0.0.1:8010",
        "privacy_note": "Do not store prompts, outputs, API keys, or secrets in public identity records.",
    },
    "research-agent.eth": {
        "kind": "agent",
        "display_name": "Research Agent",
        "address": MOCK_IDENTITIES["research-agent.eth"],
        "capabilities": ["worker discovery", "job creation", "payment-state review"],
        "privacy_note": "Agent identity can be public; private task content stays offchain.",
    },
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


def get_identity_metadata(name: str) -> dict[str, Any]:
    address = resolve_name(name)
    metadata = MOCK_IDENTITY_METADATA.get(
        name,
        {
            "kind": "unknown",
            "display_name": name,
            "address": address,
            "capabilities": [],
            "privacy_note": "This fallback identity is deterministic and mocked.",
        },
    )
    return {
        **metadata,
        "name": name,
        "address": address,
        "resolver": "mock-ens-style-resolver",
        "production_replacement": "ENS resolver plus text records or an offchain resolver.",
        "public_record_warning": "Public identity records must not contain secrets.",
    }
