export const mockIdentities = {
  "gpu-prague.eth": "0x2000000000000000000000000000000000000002",
  "research-agent.eth": "0x1000000000000000000000000000000000000001"
} as const;

export type MockIdentityName = keyof typeof mockIdentities;

export function resolveMockIdentity(name: MockIdentityName) {
  return mockIdentities[name];
}

