const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
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

export function getHealth() {
  return request<{ status: string; service: string }>("/health");
}

export function registerWorker() {
  return request("/workers/register", {
    method: "POST",
    body: JSON.stringify({
      name: "gpu-prague.eth",
      model: "mock-llama",
      hardware: "simulated/local worker",
      price: "0.01 USDC"
    })
  });
}

export function createJob(prompt: string) {
  return request("/jobs", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      buyer_name: "research-agent.eth"
    })
  });
}

export function runAgentTask(taskPrompt: string) {
  return request("/agent/tasks", {
    method: "POST",
    body: JSON.stringify({ task_prompt: taskPrompt })
  });
}
