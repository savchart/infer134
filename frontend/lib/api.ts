import type { DemoModel } from "./demoData";

const API_PROXY_BASE_URL = "/api/infer134";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_PROXY_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Infer134 API error ${response.status}`);
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

export function registerWorker(model: DemoModel, authToken?: string) {
  return registerWorkerProfile({
      name: "gpu-prague.eth",
      address: "0x2000000000000000000000000000000000000002",
      model: model.modelId,
      hardware: "local GPU worker / mock fallback",
      price: "0.001 local ETH / request",
      status: "available",
      endpoint: "http://127.0.0.1:8010",
      gpu_capabilities: [
        {
          gpu_id: "local-rtx-2070",
          display_name: "NVIDIA RTX 2070",
          memory_gb: 8,
          runtime: model.runtime.includes("vLLM") ? "vllm" : "mock",
          status: "available",
          notes: "Demo GPU selected by the worker."
        }
      ],
      model_capabilities: [
        {
          model_id: model.modelId,
          model_source: model.source === "local mock" ? "worker_catalog" : "public_registry",
          model_revision: "main",
          model_hash: model.modelHash,
          runtime: model.runtime,
          readiness_state: "ready",
          cold_start_fee: "0 local ETH",
          inference_fee: "0.001 local ETH",
          price_per_1m_input_tokens: "0.25 local ETH",
          price_per_1m_output_tokens: "0.75 local ETH",
          currency: "local ETH"
        }
      ],
      auth_token: authToken
  });
}

export function createJob(prompt: string, modelId = "mock-llama", authToken?: string, price = "0.001 local ETH") {
  return request<{ job: BackendJob }>("/jobs", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      buyer_name: "research-agent.eth",
      model_id: modelId,
      price,
      auth_token: authToken
    })
  });
}

export function claimJob(jobId: string, workerId: string) {
  return request<BackendJob>(`/jobs/${jobId}/claim`, {
    method: "POST",
    body: JSON.stringify({ worker_id: workerId })
  });
}

export function runJob(jobId: string, workerId: string) {
  return request<{ job: BackendJob; inference: Record<string, unknown> }>(`/jobs/${jobId}/run`, {
    method: "POST",
    body: JSON.stringify({ worker_id: workerId })
  });
}

export function submitJob(jobId: string) {
  return request<{ job: BackendJob; receipt: ReceiptPayload; receipt_verified: boolean; verification: unknown }>(
    `/jobs/${jobId}/submit`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export function payJob(jobId: string) {
  return request<{ job: BackendJob; receipt?: ReceiptPayload | null; receipt_verified?: boolean }>(
    `/jobs/${jobId}/pay`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export function getReceipt(jobId: string) {
  return request<{ receipt: ReceiptPayload; receipt_verified: boolean; verification: unknown }>(
    `/jobs/${jobId}/receipt`
  );
}

export function runAgentTask(taskPrompt: string) {
  return request("/agent/tasks", {
    method: "POST",
    body: JSON.stringify({ task_prompt: taskPrompt })
  });
}
