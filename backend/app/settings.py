from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class ChainSettings:
    rpc_url: str | None
    chain_id: int | None
    contract_address: str | None

    @property
    def chain_enabled(self) -> bool:
        return bool(self.rpc_url and self.chain_id and self.contract_address)


def get_chain_settings() -> ChainSettings:
    chain_id_raw = os.getenv("CHAIN_ID")
    try:
        chain_id = int(chain_id_raw) if chain_id_raw else None
    except ValueError:
        chain_id = None

    return ChainSettings(
        rpc_url=os.getenv("RPC_URL"),
        chain_id=chain_id,
        contract_address=os.getenv("INFERENCE_ESCROW_ADDRESS"),
    )
