export const inferenceEscrowContract = {
  localOnly: true,
  network: "anvil",
  address: "deploy locally with forge script",
  stores: ["inputHash", "outputHash", "receiptHash", "worker", "payment state"],
  doesNotStore: ["prompt", "output", "full receipt"]
};
