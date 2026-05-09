"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AuthRole, AuthSession } from "../lib/api";
import {
  addressesEqual,
  connectWalletSession,
  disconnectWalletSession,
  isLocalAnvilChain,
  readCurrentWalletState,
  revalidateWalletSession,
  watchWalletState,
  type WalletState
} from "../lib/walletAuth";

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

function chainLabel(chainIdHex: string | undefined): string {
  if (!chainIdHex) {
    return "no chain";
  }
  if (isLocalAnvilChain(chainIdHex)) {
    return "Anvil 31337";
  }
  try {
    return `chain ${parseInt(chainIdHex, 16)}`;
  } catch {
    return chainIdHex;
  }
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
  const [walletState, setWalletState] = useState<WalletState>({});
  const sessionRef = useRef<AuthSession | undefined>(undefined);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const fresh = await revalidateWalletSession(role);
      if (!mounted) {
        return;
      }
      if (fresh) {
        setSession(fresh);
        setStatus("authenticated");
        onSessionChange?.(fresh);
      } else {
        setSession(undefined);
        setStatus("idle");
        onSessionChange?.(undefined);
      }

      const initialState = await readCurrentWalletState();
      if (mounted) {
        setWalletState(initialState);
      }
    }

    bootstrap();

    const unsubscribe = watchWalletState((next) => {
      setWalletState((current) => ({ ...current, ...next }));

      if (next.address !== undefined) {
        const current = sessionRef.current;
        if (current && !addressesEqual(current.address, next.address)) {
          // MetaMask switched accounts away from the signed-in address.
          // Drop the stale session so the user has to reconnect.
          disconnectWalletSession(role, current.session_token).finally(() => {
            if (!mounted) {
              return;
            }
            setSession(undefined);
            setStatus("idle");
            setError("Wallet account changed; reconnect to continue.");
            onSessionChange?.(undefined);
          });
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [role]);

  async function connect() {
    setStatus("connecting");
    setError("");
    try {
      const nextSession = await connectWalletSession(role, ensStyleName);
      setSession(nextSession);
      setStatus("authenticated");
      onSessionChange?.(nextSession);
      const refreshedState = await readCurrentWalletState();
      setWalletState(refreshedState);
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

  const accountMatches = !session || addressesEqual(session.address, walletState.address);
  const chainOk = isLocalAnvilChain(walletState.chainIdHex);

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
          {walletState.chainIdHex ? (
            <span className={chainOk ? "status-pill" : "status-pill warn"}>{chainLabel(walletState.chainIdHex)}</span>
          ) : null}
          {session && !accountMatches && walletState.address ? (
            <span className="status-pill warn" title={`MetaMask: ${walletState.address}`}>
              account mismatch
            </span>
          ) : null}
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
