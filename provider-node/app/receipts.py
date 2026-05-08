from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any


def sha256_hex(value: str) -> str:
    return "0x" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def canonical_json(data: dict[str, Any]) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def deterministic_timestamp(seed: str) -> str:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    seconds = int(digest[:8], 16) % 86400
    base = datetime(2026, 5, 8, tzinfo=UTC)
    return (base + timedelta(seconds=seconds)).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def worker_payload_hash(data: dict[str, Any]) -> str:
    return sha256_hex(canonical_json(data))


def demo_worker_signature(worker_address: str, payload_hash: str) -> str:
    material = f"infer134-worker-demo-signature|{worker_address.lower()}|{payload_hash}"
    return sha256_hex(material)
