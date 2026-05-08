import { localhostAnvil } from "./chains";

export const inferenceEscrowContract = {
  localOnly: true,
  chain: localhostAnvil,
  network: "Local Anvil",
  address: process.env.NEXT_PUBLIC_INFERENCE_ESCROW_ADDRESS ?? "copy from contracts/deployments/localhost.json",
  deploymentMetadata: "contracts/deployments/localhost.json",
  stores: [
    "inputHash",
    "outputHash",
    "receiptHash",
    "worker",
    "buyer",
    "native ETH escrow",
    "payment state"
  ],
  doesNotStore: ["prompt", "output", "full receipt", "model weights"],
  note: "After deployment, copy the address from contracts/deployments/localhost.json into NEXT_PUBLIC_INFERENCE_ESCROW_ADDRESS."
};
