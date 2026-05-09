"use client";

import { localhostAnvil } from "./chains";

// Window.ethereum is declared globally in lib/walletAuth.ts.
type EthereumProvider = NonNullable<Window["ethereum"]>;

// keccak256("JobCreated(uint256,address,address,bytes32,uint256)")
const JOB_CREATED_TOPIC0 = "0x08e6e98d4b4e6cb7a4c98fc40a1dfde1d3a6661db3ad3e5d23b43219896489ec";

// First 4 bytes of keccak256("createJob(address,bytes32)")
const CREATE_JOB_SELECTOR = "0x4eec0a16";
// First 4 bytes of keccak256("releasePayment(uint256)")
const RELEASE_PAYMENT_SELECTOR = "0x88685cd9";

const RECEIPT_POLL_INTERVAL_MS = 750;
const RECEIPT_POLL_TIMEOUT_MS = 60_000;

function ethereum(): EthereumProvider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No browser wallet found. Install or unlock a wallet that supports window.ethereum.");
  }
  return window.ethereum;
}

function strip0x(value: string): string {
  return value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
}

function padHex(value: string, bytes: number): string {
  const hex = strip0x(value).toLowerCase();
  if (hex.length > bytes * 2) {
    throw new Error(`hex value ${value} exceeds ${bytes} bytes`);
  }
  return hex.padStart(bytes * 2, "0");
}

function encodeAddress(address: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`invalid address: ${address}`);
  }
  return padHex(address, 32);
}

function encodeBytes32(value: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`invalid bytes32 value: ${value}`);
  }
  return strip0x(value).toLowerCase();
}

const BIGINT_ZERO = BigInt(0);

function encodeUint256(value: bigint): string {
  if (value < BIGINT_ZERO) {
    throw new Error(`uint256 value must be non-negative: ${value}`);
  }
  return padHex(value.toString(16), 32);
}

export function encodeCreateJobCalldata(workerAddress: string, inputHashHex: string): string {
  return CREATE_JOB_SELECTOR + encodeAddress(workerAddress) + encodeBytes32(inputHashHex);
}

export function encodeReleasePaymentCalldata(onchainJobId: string | bigint): string {
  const jobId = typeof onchainJobId === "bigint" ? onchainJobId : BigInt(onchainJobId);
  return RELEASE_PAYMENT_SELECTOR + encodeUint256(jobId);
}

export function bigintToHex(value: bigint): string {
  return "0x" + value.toString(16);
}

const DEFAULT_ESCROW_WEI = BigInt("1000000000000000");
const WEI_PER_ETH = BigInt("1000000000000000000");

/**
 * Parse a price string from the worker offer (e.g. "0.001 local ETH") into wei.
 * Falls back to 1e15 wei (0.001 ETH) when parsing fails so the demo escrow always has a value.
 */
export function parseInferenceFeeToWei(fee: string | undefined): bigint {
  if (!fee) {
    return DEFAULT_ESCROW_WEI;
  }
  const numeric = fee.match(/[\d.]+/);
  if (!numeric) {
    return DEFAULT_ESCROW_WEI;
  }
  const [whole, fraction = ""] = numeric[0].split(".");
  const fractionPadded = (fraction + "0".repeat(18)).slice(0, 18);
  try {
    return BigInt(whole || "0") * WEI_PER_ETH + BigInt(fractionPadded || "0");
  } catch {
    return DEFAULT_ESCROW_WEI;
  }
}

export type TransactionReceipt = {
  status: string;
  transactionHash: string;
  blockNumber: string;
  logs: Array<{ address: string; topics: string[]; data: string }>;
};

async function waitForReceipt(provider: EthereumProvider, txHash: string): Promise<TransactionReceipt> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < RECEIPT_POLL_TIMEOUT_MS) {
    const receipt = await provider.request<TransactionReceipt | null>({
      method: "eth_getTransactionReceipt",
      params: [txHash]
    });
    if (receipt) {
      if (receipt.status !== "0x1") {
        throw new Error(`transaction reverted: ${txHash}`);
      }
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, RECEIPT_POLL_INTERVAL_MS));
  }
  throw new Error(`timed out waiting for tx receipt: ${txHash}`);
}

export function parseJobCreatedLog(receipt: TransactionReceipt, contractAddress: string): { onchainJobId: string; buyer: string; worker: string } {
  const target = contractAddress.toLowerCase();
  for (const log of receipt.logs ?? []) {
    if (log.address.toLowerCase() !== target) {
      continue;
    }
    if (!log.topics?.length) {
      continue;
    }
    if (log.topics[0].toLowerCase() !== JOB_CREATED_TOPIC0) {
      continue;
    }
    if (log.topics.length < 4) {
      continue;
    }
    return {
      onchainJobId: BigInt(log.topics[1]).toString(),
      buyer: "0x" + log.topics[2].slice(-40),
      worker: "0x" + log.topics[3].slice(-40)
    };
  }
  throw new Error("JobCreated event not found in tx receipt logs");
}

export type CreateEscrowJobResult = {
  txHash: string;
  onchainJobId: string;
  buyer: string;
  worker: string;
  blockNumber: string;
};

export async function ensureLocalAnvilNetwork(): Promise<void> {
  const provider = ethereum();
  const expectedChainIdHex = "0x" + localhostAnvil.id.toString(16);
  const currentChainId = await provider.request<string>({ method: "eth_chainId" });
  if (currentChainId.toLowerCase() === expectedChainIdHex.toLowerCase()) {
    return;
  }
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: expectedChainIdHex }]
    });
  } catch (switchError) {
    const code = (switchError as { code?: number })?.code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: expectedChainIdHex,
            chainName: localhostAnvil.name,
            nativeCurrency: localhostAnvil.nativeCurrency,
            rpcUrls: [...localhostAnvil.rpcUrls.default.http]
          }
        ]
      });
    } else {
      throw switchError;
    }
  }
}

export async function createEscrowJob(params: {
  contractAddress: string;
  workerAddress: string;
  inputHashHex: string;
  valueWei: bigint;
  fromAddress: string;
}): Promise<CreateEscrowJobResult> {
  const provider = ethereum();
  await ensureLocalAnvilNetwork();
  const data = encodeCreateJobCalldata(params.workerAddress, params.inputHashHex);
  const txHash = await provider.request<string>({
    method: "eth_sendTransaction",
    params: [
      {
        from: params.fromAddress,
        to: params.contractAddress,
        value: bigintToHex(params.valueWei),
        data
      }
    ]
  });
  const receipt = await waitForReceipt(provider, txHash);
  const event = parseJobCreatedLog(receipt, params.contractAddress);
  return {
    txHash,
    onchainJobId: event.onchainJobId,
    buyer: event.buyer,
    worker: event.worker,
    blockNumber: receipt.blockNumber
  };
}

export async function releaseEscrowPayment(params: {
  contractAddress: string;
  onchainJobId: string;
  fromAddress: string;
}): Promise<{ txHash: string; blockNumber: string }> {
  const provider = ethereum();
  await ensureLocalAnvilNetwork();
  const data = encodeReleasePaymentCalldata(params.onchainJobId);
  const txHash = await provider.request<string>({
    method: "eth_sendTransaction",
    params: [
      {
        from: params.fromAddress,
        to: params.contractAddress,
        data
      }
    ]
  });
  const receipt = await waitForReceipt(provider, txHash);
  return { txHash, blockNumber: receipt.blockNumber };
}
