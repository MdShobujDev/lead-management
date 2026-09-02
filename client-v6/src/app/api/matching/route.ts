import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

const STAT_HEADERS = [
  "Content-Disposition",
  "Content-Type",
  "X-Total-Rows",
  "X-Matched-Rows",
  "X-Unmatched-Rows",
  "X-Filled-Cells",
] as const;

export async function POST(request: Request) {
  const upstreamResponse = await fetch(`${API_BASE}/matching`, {
    method: "POST",
    body: await request.formData(),
  });

  const responseHeaders = new Headers();
  for (const header of STAT_HEADERS) {
    const value = upstreamResponse.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
