export type ConnectionState = "checking" | "connected" | "unavailable";

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
