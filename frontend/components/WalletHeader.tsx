"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { AuthRole, AuthSession } from "../lib/api";
import { connectWalletSession, disconnectWalletSession, loadWalletSession } from "../lib/walletAuth";

type WalletHeaderProps = {
  role?: AuthRole;
  ensStyleName?: string;
  onSessionChange?: (session: AuthSession | undefined) => void;
  title?: string;
  subtitle?: string;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletHeader({
  role = "client",
  ensStyleName = role === "provider" ? "gpu-prague.eth" : "research-agent.eth",
  onSessionChange,
  title = "Infer134",
  subtitle = "GPU marketplace"
}: WalletHeaderProps) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | undefined>();
  const [status, setStatus] = useState<"idle" | "connecting" | "authenticated" | "unavailable" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = loadWalletSession(role);
    if (stored) {
      setSession(stored);
      setStatus("authenticated");
      onSessionChange?.(stored);
      return;
    }

    setSession(undefined);
    setStatus("idle");
    onSessionChange?.(undefined);
  }, [role]);

  async function connect() {
    setStatus("connecting");
    setError("");
    try {
      const nextSession = await connectWalletSession(role, ensStyleName);
      setSession(nextSession);
      setStatus("authenticated");
      onSessionChange?.(nextSession);
    } catch (connectError) {
      setSession(undefined);
      setStatus(connectError instanceof Error && connectError.message.includes("No browser wallet") ? "unavailable" : "error");
      setError(connectError instanceof Error ? connectError.message : "Wallet connection failed.");
      onSessionChange?.(undefined);
    }
  }

  async function disconnect() {
    await disconnectWalletSession(role, session?.session_token);
    setSession(undefined);
    setStatus("idle");
    setError("");
    onSessionChange?.(undefined);
    router.push("/");
  }

  return (
    <header className="app-topbar">
      <Link className="app-brand" href="/">
        <span className="eyebrow">{title}</span>
        <strong>{subtitle}</strong>
      </Link>

      <div className="wallet-header-control">
        <div className="wallet-header-main">
          <span className={session ? "status-pill good" : status === "unavailable" ? "status-pill warn" : "status-pill"}>
            {session ? "wallet signed" : status}
          </span>
          <span className="muted">{role === "provider" ? "provider" : "client"}</span>
          {session ? <code>{shortAddress(session.address)}</code> : <strong>{ensStyleName}</strong>}
        </div>

        <div className="wallet-header-actions">
          {session ? (
            <button className="secondary-link action-button" type="button" onClick={disconnect}>
              Disconnect
            </button>
          ) : (
            <button className="primary-link action-button" type="button" onClick={connect} disabled={status === "connecting"}>
              {status === "connecting" ? "Signing..." : "Connect wallet"}
            </button>
          )}
        </div>

        {error ? <p className="wallet-error">{error}</p> : null}
      </div>
    </header>
  );
}
