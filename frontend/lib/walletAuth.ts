import {
  createAuthChallenge,
  fetchAuthSession,
  logoutAuthSession,
  verifyAuthChallenge,
  type AuthRole,
  type AuthSession
} from "./api";

type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
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

/**
 * Re-check that a stored session still exists on the backend.
 * Returns the session if the backend confirms it, or undefined and clears
 * localStorage if the backend forgot it (e.g. after a restart).
 */
export async function revalidateWalletSession(role: AuthRole): Promise<AuthSession | undefined> {
  const stored = loadWalletSession(role);
  if (!stored) {
    return undefined;
  }
  try {
    const fresh = await fetchAuthSession(stored.session_token);
    saveWalletSession(fresh);
    return fresh;
  } catch {
    clearWalletSession(role);
    return undefined;
  }
}

export type WalletState = {
  address?: string;
  chainIdHex?: string;
};

export async function readCurrentWalletState(): Promise<WalletState> {
  if (typeof window === "undefined" || !window.ethereum) {
    return {};
  }
  const provider = window.ethereum;
  const [accounts, chainId] = await Promise.all([
    provider.request<string[]>({ method: "eth_accounts" }).catch(() => [] as string[]),
    provider.request<string>({ method: "eth_chainId" }).catch(() => undefined)
  ]);
  return {
    address: accounts[0]?.toLowerCase(),
    chainIdHex: typeof chainId === "string" ? chainId.toLowerCase() : undefined
  };
}

/**
 * Subscribe to MetaMask accountsChanged + chainChanged.
 * The handler is invoked with the next state shape; returns an unsubscribe fn.
 */
export function watchWalletState(handler: (next: WalletState) => void): () => void {
  if (typeof window === "undefined" || !window.ethereum?.on) {
    return () => {};
  }
  const provider = window.ethereum;
  const onAccounts = (...args: unknown[]) => {
    const accounts = args[0];
    const next = Array.isArray(accounts) ? (accounts[0] as string | undefined) : undefined;
    handler({ address: typeof next === "string" ? next.toLowerCase() : undefined });
  };
  const onChain = (...args: unknown[]) => {
    const chainId = args[0];
    handler({ chainIdHex: typeof chainId === "string" ? chainId.toLowerCase() : undefined });
  };
  provider.on?.("accountsChanged", onAccounts);
  provider.on?.("chainChanged", onChain);
  return () => {
    provider.removeListener?.("accountsChanged", onAccounts);
    provider.removeListener?.("chainChanged", onChain);
  };
}

export const LOCAL_ANVIL_CHAIN_ID_HEX = "0x7a69";

export function isLocalAnvilChain(chainIdHex: string | undefined): boolean {
  return typeof chainIdHex === "string" && chainIdHex.toLowerCase() === LOCAL_ANVIL_CHAIN_ID_HEX;
}

export function addressesEqual(a?: string, b?: string): boolean {
  if (!a || !b) {
    return false;
  }
  return a.toLowerCase() === b.toLowerCase();
}
