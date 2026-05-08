export const localhostAnvil = {
  id: 31337,
  name: "Local Anvil",
  network: "anvil",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"]
    },
    public: {
      http: ["http://127.0.0.1:8545"]
    }
  }
} as const;

