import type { NextRequest } from "next/server";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

// `duplex` is required by Node's fetch when sending a body, but it is
// missing from the DOM RequestInit type, so it is added here.
type ForwardInit = RequestInit & { duplex?: "half" };

export async function GET(request: NextRequest, { params }: RouteContext) {
  return forward(request, params);
}
export async function POST(request: NextRequest, { params }: RouteContext) {
  return forward(request, params);
}
export async function PUT(request: NextRequest, { params }: RouteContext) {
  return forward(request, params);
}
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return forward(request, params);
}
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  return forward(request, params);
}

async function forward(
  request: NextRequest,
  params: RouteContext["params"]
): Promise<Response> {
  const { path: pathSegments } = await params;
  const path = pathSegments.join("/");
  const url = `${process.env.BACKEND_URL}/${path}/${request.nextUrl.search}`;

  const isBodyless = ["GET", "HEAD"].includes(request.method);

  const init: ForwardInit = {
    method: request.method,
    headers: {
      Cookie: request.headers.get("cookie") || "",
      "Content-Type": request.headers.get("content-type") || "application/json",
    },
    body: isBodyless ? undefined : await request.arrayBuffer(),
    duplex: "half",
  };

  const res = await fetch(url, init);

  const data = await res.arrayBuffer();

  const response = new Response(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
  });

  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    response.headers.set("set-cookie", setCookie);
  }

  return response;
}