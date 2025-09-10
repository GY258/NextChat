import { NextRequest, NextResponse } from "next/server";

// Internal server-side base URL to reach the BMF service.
// Use host.docker.internal (with host-gateway) to cross compose stacks on Linux.
const INTERNAL_BMF_BASE = (process.env.BMF_SERVER_BASE_URL || "http://localhost:5003").replace(/\/$/, "");

async function proxy(req: NextRequest, ctx: { params: { bmf?: string[] } }) {
  const segs = ctx.params?.bmf || [];
  const path = segs.join("/");
  const targetUrl = `${INTERNAL_BMF_BASE}/${path}${req.nextUrl.search}`;

  // Clone headers and remove host to avoid mismatches
  const headers = new Headers(req.headers);
  headers.delete("host");

  const method = req.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body,
    redirect: "manual",
    // Avoid Next.js caching here; we proxy dynamic content
    cache: "no-store",
  });

  // Pass through response
  const respHeaders = new Headers(upstream.headers);
  const data = await upstream.arrayBuffer();
  return new NextResponse(data, {
    status: upstream.status,
    headers: respHeaders,
  });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as HEAD, proxy as OPTIONS };

