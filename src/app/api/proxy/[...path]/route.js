export async function GET(request, { params }) {
  return forward(request, params);
}
export async function POST(request, { params }) {
  return forward(request, params);
}
export async function PUT(request, { params }) {
  return forward(request, params);
}
export async function PATCH(request, { params }) {
  return forward(request, params);
}
export async function DELETE(request, { params }) {
  return forward(request, params);
}

async function forward(request, params) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join("/");
  const url = `${process.env.BACKEND_URL}/${path}/${request.nextUrl.search}`;

  const isBodyless = ["GET", "HEAD"].includes(request.method);

  const res = await fetch(url, {
    method: request.method,
    headers: {
      Cookie: request.headers.get("cookie") || "",
      "Content-Type": request.headers.get("content-type") || "application/json",
    },
    body: isBodyless ? undefined : await request.text(),
  });

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