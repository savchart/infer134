import { localhostAnvil } from "./chains";

export const wagmiPlaceholder = {
  enabled: false,
  chain: localhostAnvil,
  reason: "Wallet wiring is intentionally deferred; local Anvil config is exposed for the demo.",
  future: "Replace this placeholder with wagmi/viem client config when the UI starts sending local Anvil transactions."
};
