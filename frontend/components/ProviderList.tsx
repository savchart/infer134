"use client";

import { useEffect, useState } from "react";

import { getOffers, getProviderHealth, type WorkerOffer } from "../lib/api";

type ProviderListProps = {
  compact?: boolean;
  showMode?: boolean;
  title?: string;
  description?: string;
};

export function ProviderList({
  compact = false,
  showMode = true,
  title = "Worker Offers",
  description = "Buyers choose a GPU + model + price bundle."
}: ProviderListProps) {
  const [offers, setOffers] = useState<WorkerOffer[]>([]);
  const [mode, setMode] = useState("checking provider-node");
  const [providerNodeOnline, setProviderNodeOnline] = useState<boolean | undefined>();

  useEffect(() => {
    let mounted = true;

    async function loadOffers() {
      setMode("checking provider-node");
      try {
        await getProviderHealth();
      } catch {
        if (mounted) {
          setProviderNodeOnline(false);
          setOffers([]);
          setMode("provider-node offline");
        }
        return;
      }

      if (!mounted) {
        return;
      }

      setProviderNodeOnline(true);
      setMode("provider-node online");

      try {
        const backendOffers = await getOffers();
        if (mounted) {
          setOffers(backendOffers);
          setMode(backendOffers.length ? "provider-node online + backend catalog" : "provider-node online, no offers published");
        }
      } catch {
        if (mounted) {
          setOffers([]);
          setMode("provider-node online, backend catalog unavailable");
        }
      }
    }

    loadOffers();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className={compact ? "offer-catalog compact" : "panel"}>
      <div className="kicker">{title}</div>
      <p className="muted">
        {showMode ? `Mode: ${mode}. ` : ""}
        {description}
      </p>
      {providerNodeOnline === false ? (
        <div className="empty-offers">
          <strong>No provider-node detected</strong>
          <p>
            Start the local provider-node before GPU capacity is shown. No node means no available GPU offers.
          </p>
        </div>
      ) : offers.length ? null : (
        <div className="empty-offers">
          <strong>No GPU offers published</strong>
          <p>
            Provider-node is {providerNodeOnline ? "online" : "being checked"}, but no worker has published a
            GPU + model bundle yet.
          </p>
        </div>
      )}
      <div className={compact ? "offer-list compact" : "offer-list"}>
        {offers.map((offer) => (
          <div className="offer-row" key={offer.offer_id}>
            <strong>{offer.worker_name}</strong>
            <p className="muted">
              {offer.gpu_name} · {offer.gpu_memory_gb} GB · {offer.model_id}
            </p>
            <p className="muted">
              Input {offer.price_per_1m_input_tokens} / 1M · Output {offer.price_per_1m_output_tokens} / 1M
            </p>
            <span className="badge">{offer.worker_status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
