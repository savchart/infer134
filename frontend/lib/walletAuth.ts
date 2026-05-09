import {
  createAuthChallenge,
  logoutAuthSession,
  verifyAuthChallenge,
  type AuthRole,
  type AuthSession
} from "./api";

export type WalletAuthState = {
  status: "idle" | "connecting" | "authenticated" | "unavailable" | "error";
  address?: string;
  session?: AuthSession;
  error?: string;
};

type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function walletStorageKey(role: AuthRole) {
  return `infer134.wallet.${role}`;
}

export function loadWalletSession(role: AuthRole): AuthSession | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const raw = window.localStorage.getItem(walletStorageKey(role));
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(walletStorageKey(role));
    return undefined;
  }
}

export function saveWalletSession(session: AuthSession) {
  window.localStorage.setItem(walletStorageKey(session.role), JSON.stringify(session));
}

export function clearWalletSession(role: AuthRole) {
  window.localStorage.removeItem(walletStorageKey(role));
}

export async function requestWalletAddress(): Promise<string> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No browser wallet found. Install or unlock a wallet that supports window.ethereum.");
  }
  const accounts = await window.ethereum.request<string[]>({ method: "eth_requestAccounts" });
  const address = accounts[0];
  if (!address) {
    throw new Error("Wallet returned no accounts.");
  }
  return address;
}

export async function connectWalletSessionForAddress(
  address: string,
  role: AuthRole,
  ensStyleName: string
): Promise<AuthSession> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No browser wallet found. Install or unlock a wallet that supports window.ethereum.");
  }
  const challenge = await createAuthChallenge(address, role, ensStyleName);
  const signature = await window.ethereum.request<string>({
    method: "personal_sign",
    params: [challenge.message, address]
  });
  const verified = await verifyAuthChallenge(challenge, signature);
  saveWalletSession(verified.session);
  return verified.session;
}

export async function connectWalletSession(role: AuthRole, ensStyleName: string): Promise<AuthSession> {
  const address = await requestWalletAddress();
  return connectWalletSessionForAddress(address, role, ensStyleName);
}

export async function disconnectWalletSession(role: AuthRole, sessionToken?: string) {
  if (sessionToken) {
    try {
      await logoutAuthSession(sessionToken);
    } catch {
      // Local demo logout should clear UI state even when backend is offline.
    }
  }
  clearWalletSession(role);
}
