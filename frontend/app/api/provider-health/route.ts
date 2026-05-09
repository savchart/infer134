import { NextResponse } from "next/server";

const PROVIDER_BASE_URL = process.env.NEXT_PUBLIC_PROVIDER_NODE_URL ?? "http://127.0.0.1:8010";

export async function GET() {
  try {
    const response = await fetch(`${PROVIDER_BASE_URL.replace(/\/$/, "")}/health`, {
      cache: "no-store"
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "provider-node unavailable",
        detail: error instanceof Error ? error.message : "unknown error"
      },
      { status: 502 }
    );
  }
}
