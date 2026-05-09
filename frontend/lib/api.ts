const API_PROXY_BASE_URL = "/api/infer134";

export type RunPaidJobRequest = {
  onchain_job_id: string;
  tx_hash: string;
  prompt: string;
  offer_id: string;
  model_id?: string;
  buyer_address?: string;
  buyer_name?: string;
  auth_token?: string;
};

export type RunPaidJobResponse = {
  job: BackendJob;
  receipt: ReceiptPayload;
  receipt_verified: boolean;
  verification: unknown;
  settlement_metadata: Record<string, unknown>;
  escrow_amount_wei: string;
  demo_modes?: Record<string, boolean>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_PROXY_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.clone().json();
      if (body && typeof body === "object") {
        const raw = (body as { detail?: unknown }).detail;
        if (typeof raw === "string") {
          detail = raw;
        } else if (raw !== undefined) {
          detail = JSON.stringify(raw);
        }
      }
    } catch {
      try {
        detail = (await response.text()).trim();
      } catch {
        detail = "";
      }
    }
    throw new Error(detail ? `${response.status}: ${detail}` : `Infer134 API error ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export type BackendHealth = {
  status: string;
  service: string;
  mode?: string;
};

export type AuthRole = "client" | "provider";

export type AuthChallenge = {
  challenge_id: string;
  address: string;
  role: AuthRole;
  ens_style_name?: string | null;
  message: string;
  nonce: string;
  issued_at: string;
  expires_at: string;
};

export type AuthSession = {
  session_token: string;
  address: string;
  role: AuthRole;
  ens_style_name?: string | null;
  signature: string;
  challenge_id: string;
  created_at: string;
  verification_status: string;
  trust_note: string;
};

export type ChainStatus = {
  chain_enabled: boolean;
  rpc_url?: string | null;
  chain_id?: number | string | null;
  contract_address?: string | null;
  latest_block?: string | number | null;
  error?: string | null;
};

export type BackendWorker = {
  worker_id: string;
  name: string;
  address: string;
  model: string;
  runtime?: string;
  price: string;
  status: string;
  endpoint?: string;
  gpu_capabilities?: GpuCapability[];
  model_capabilities?: WorkerModelCapability[];
};

export type GpuCapability = {
  gpu_id: string;
  display_name: string;
  memory_gb: number;
  runtime: string;
  status: string;
  notes?: string;
};

export type WorkerModelCapability = {
  model_id: string;
  model_source: "worker_catalog" | "public_registry" | "custom_reference" | "adapter";
  model_revision: string;
  model_hash: string;
  adapter_hash?: string | null;
  runtime: string;
  readiness_state: "requested" | "accepted" | "preparing" | "ready" | "failed";
  cold_start_fee: string;
  inference_fee: string;
  price_per_1m_input_tokens: string;
  price_per_1m_output_tokens: string;
  currency: string;
};

export type WorkerOffer = {
  offer_id: string;
  worker_id: string;
  worker_name: string;
  worker_address: string;
  worker_status: string;
  gpu_id: string;
  gpu_name: string;
  gpu_memory_gb: number;
  gpu_status: string;
  model_id: string;
  model_source: WorkerModelCapability["model_source"];
  model_revision: string;
  model_hash: string;
  runtime: string;
  readiness_state: WorkerModelCapability["readiness_state"];
  cold_start_fee: string;
  inference_fee: string;
  price_per_1m_input_tokens: string;
  price_per_1m_output_tokens: string;
  currency: string;
  endpoint: string;
};

export type ProviderHealth = {
  status: string;
  service: string;
  worker_name?: string;
  runtime?: string;
  model?: string;
  hardware?: string;
  future_backends?: string[];
};

export type ProviderModel = {
  model_id: string;
  source: string;
  status: string;
  runtime_ready: boolean;
  runtime: string;
  notes: string;
};

export type RegisterWorkerPayload = {
  name: string;
  address?: string;
  model?: string;
  hardware: string;
  price: string;
  status: string;
  endpoint: string;
  gpu_capabilities?: GpuCapability[];
  model_capabilities?: WorkerModelCapability[];
  auth_token?: string;
};

export type BackendJob = {
  job_id: string;
  buyer: string;
  buyer_name: string;
  worker_id?: string | null;
  worker?: string | null;
  worker_name?: string | null;
  prompt: string;
  input_hash: string;
  result?: string | null;
  output_hash?: string | null;
  receipt_hash?: string | null;
  payment_state: string;
  model_id: string;
  runtime: string;
  price: string;
  onchain_tx_hash_create?: string | null;
  onchain_tx_hash_submit?: string | null;
  onchain_tx_hash_release?: string | null;
  chain_payment_state?: string | null;
  auth_verification_status?: string | null;
};

export type ReceiptPayload = {
  job_id: string;
  buyer: string;
  buyer_name: string;
  worker: string;
  worker_name: string;
  model_id: string;
  runtime: string;
  input_hash: string;
  output_hash: string;
  receipt_hash: string;
  price: string;
  payment_state: string;
  timestamp: string;
  signature: string;
};

export function getHealth() {
  return request<BackendHealth>("/health");
}

export function getChainStatus() {
  return request<ChainStatus>("/chain/status");
}

export function getProviderHealth() {
  return fetch("/api/provider-health").then((response) => {
    if (!response.ok) {
      throw new Error(`Provider health error ${response.status}`);
    }
    return response.json() as Promise<ProviderHealth>;
  });
}

export function getProviderModels() {
  return fetch("/api/provider-models").then((response) => {
    if (!response.ok) {
      throw new Error(`Provider models error ${response.status}`);
    }
    return response.json() as Promise<ProviderModel[]>;
  });
}

export function createAuthChallenge(address: string, role: AuthRole, ensStyleName?: string) {
  return request<AuthChallenge>("/auth/challenge", {
    method: "POST",
    body: JSON.stringify({
      address,
      role,
      ens_style_name: ensStyleName
    })
  });
}

export function verifyAuthChallenge(challenge: AuthChallenge, signature: string) {
  return request<{
    session: AuthSession;
    verification_status: string;
    trusted: string[];
    not_verified: string[];
  }>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({
      challenge_id: challenge.challenge_id,
      address: challenge.address,
      role: challenge.role,
      signature
    })
  });
}

export function fetchAuthSession(sessionToken: string) {
  return request<AuthSession>(`/auth/session/${sessionToken}`);
}

export function logoutAuthSession(sessionToken: string) {
  return request<{ logged_out: boolean }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ session_token: sessionToken })
  });
}

export function registerWorkerProfile(payload: RegisterWorkerPayload) {
  return request<BackendWorker>("/workers/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getOffers() {
  return request<WorkerOffer[]>("/offers");
}

export function getWorkerOffers(workerId: string) {
  return request<WorkerOffer[]>(`/workers/${workerId}/offers`);
}

export function runPaidJob(payload: RunPaidJobRequest) {
  return request<RunPaidJobResponse>("/jobs/run-paid", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
