import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type RouteContext = {
  params: {
    path: string[];
  };
};

async function proxy(request: NextRequest, context: RouteContext) {
  const path = context.params.path.join("/");
  const targetUrl = `${BACKEND_BASE_URL.replace(/\/$/, "")}/${path}${request.nextUrl.search}`;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        "Content-Type": "application/json"
      },
      body
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "backend unavailable",
        detail: error instanceof Error ? error.message : "unknown error"
      },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
