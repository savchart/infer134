from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class ChainSettings:
    rpc_url: str | None
    chain_id: int | None
    contract_address: str | None
    buyer_private_key: str | None
    worker_private_key: str | None
    worker_address: str | None
    escrow_value: str
    requested_payment_wei: str

    @property
    def chain_enabled(self) -> bool:
        return bool(self.rpc_url and self.chain_id and self.contract_address)

    @property
    def chain_buyer_write_enabled(self) -> bool:
        return bool(self.chain_enabled and self.buyer_private_key)

    @property
    def chain_worker_write_enabled(self) -> bool:
        return bool(self.chain_enabled and self.worker_private_key)

    @property
    def chain_write_enabled(self) -> bool:
        # Retained for chain_status; reflects "fully wired" mode (agent + worker).
        return self.chain_buyer_write_enabled and self.chain_worker_write_enabled


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
        buyer_private_key=os.getenv("BUYER_PRIVATE_KEY"),
        worker_private_key=os.getenv("WORKER_PRIVATE_KEY"),
        worker_address=os.getenv("WORKER_ADDRESS"),
        escrow_value=os.getenv("ESCROW_VALUE", "1000000000000000"),
        requested_payment_wei=os.getenv("REQUESTED_PAYMENT_WEI", "1000000000000000"),
    )
