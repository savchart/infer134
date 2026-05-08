from __future__ import annotations

from app.models import Job


def settlement_metadata(job: Job) -> dict[str, str | None]:
    return {
        "input_hash": job.input_hash,
        "output_hash": job.output_hash,
        "receipt_hash": job.receipt_hash,
        "worker": job.worker,
        "worker_name": job.worker_name,
        "price": job.price,
        "payment_state": job.payment_state.value,
        "prototype_note": "Backend state is mocked; contract support is local Anvil only.",
    }

