export type ConnectionState = "checking" | "connected" | "unavailable";
export type PaymentState = "unpaid" | "escrowed" | "payable" | "paid";

export type DemoModel = {
  modelId: string;
  label: string;
  source: "Hugging Face allowlist" | "local mock";
  runtime: string;
  modelHash: string;
  notes: string;
};

export type DemoWorker = {
  workerId: string;
  workerName: string;
  address: string;
  runtime: string;
  supportedModels: string[];
  price: string;
  status: string;
};

export type ExecutionReceipt = {
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

export type DemoJobState = {
  buyerName: string;
  buyerAddress: string;
  modelId?: string;
  modelRuntime?: string;
  modelSource?: string;
  workerId?: string;
  workerName?: string;
  workerAddress?: string;
  prompt: string;
  inputHash?: string;
  output?: string;
  outputHash?: string;
  receiptHash?: string;
  txHash?: string;
  jobId?: string;
  escrowAmount: string;
  paymentState: PaymentState;
  signature?: string;
  timestamp?: string;
  receipt?: ExecutionReceipt;
  mode: "backend-connected" | "fixture";
  settlementMode: "local-anvil" | "mock-settlement";
  inferenceMode: "local-worker" | "mock-inference";
};

export const demoModels: DemoModel[] = [
  {
    modelId: "Qwen/Qwen2.5-0.5B-Instruct",
    label: "Qwen 2.5 0.5B Instruct",
    source: "Hugging Face allowlist",
    runtime: "vLLM local worker",
    modelHash: "0x5b60a68f5a1b8d0e556f33e9065c9a553a7d03f9040eb96b46e4512fbf8d80a9",
    notes: "Small public instruct model, suitable for a local GPU demo."
  },
  {
    modelId: "HuggingFaceTB/SmolLM2-360M-Instruct",
    label: "SmolLM2 360M Instruct",
    source: "Hugging Face allowlist",
    runtime: "vLLM local worker",
    modelHash: "0xf017c5d5f1a7890f45f6f0e2dc08d9190a760f48ac7514c059b78f962fef43aa",
    notes: "Compact public model for fast local inference demos."
  },
  {
    modelId: "mock-llama",
    label: "Mock model fallback",
    source: "local mock",
    runtime: "mock-runtime",
    modelHash: "0xb44d5a5277ad37918f87a44ed08e3a21592a33d31f9f828dfda649b466786390",
    notes: "Deterministic fallback when local worker or vLLM is unavailable."
  }
];

export const demoWorker: DemoWorker = {
  workerId: "worker-0001",
  workerName: "gpu-prague.eth",
  address: "0x2000000000000000000000000000000000000002",
  runtime: "vLLM local worker or mock fallback",
  supportedModels: demoModels.map((model) => model.modelId),
  price: "0.001 local ETH / request",
  status: "available"
};

export const initialJobState: DemoJobState = {
  buyerName: "research-agent.eth",
  buyerAddress: "0x1000000000000000000000000000000000000001",
  prompt: "Explain signed execution receipts in one sentence.",
  escrowAmount: "0.001 local ETH",
  paymentState: "unpaid",
  mode: "fixture",
  settlementMode: "mock-settlement",
  inferenceMode: "mock-inference"
};

export const fixtureTxHash =
  "0x9f2d62f0f7110b8530d8b3359b31c55af4f3b274dc1f4ef64bdab9ce11c9a134";

export const fixtureSignature =
  "0x7a5f8b91056c8347171f0a55e9b08d6e64e70ed5c9c9dcf4a7f19392c5e6d8b2a";

export function deterministicFixtureOutput(prompt: string, modelId: string) {
  return `Infer134 result: ${modelId} returned a private offchain answer for "${prompt.trim()}".`;
}

export async function sha256Hex(value: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return (
      "0x" +
      Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return "0x" + Math.abs(hash).toString(16).padStart(64, "0");
}

export function buildFixtureReceipt(job: DemoJobState): ExecutionReceipt {
  return {
    job_id: job.jobId ?? "job-fixture-0001",
    buyer: job.buyerAddress,
    buyer_name: job.buyerName,
    worker: job.workerAddress ?? demoWorker.address,
    worker_name: job.workerName ?? demoWorker.workerName,
    model_id: job.modelId ?? demoModels[0].modelId,
    runtime: job.modelRuntime ?? demoModels[0].runtime,
    input_hash: job.inputHash ?? "pending",
    output_hash: job.outputHash ?? "pending",
    receipt_hash: job.receiptHash ?? "pending",
    price: demoWorker.price,
    payment_state: job.paymentState,
    timestamp: job.timestamp ?? "2026-05-08T12:00:00Z",
    signature: job.signature ?? fixtureSignature
  };
}
