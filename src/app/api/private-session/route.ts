import { NextRequest, NextResponse } from "next/server";
import {
  PRIVATE_SESSION_COOKIE,
  createPrivateSessionValue,
  privateSessionConfigured,
  privateSessionMaxAge,
  requestHasPrivateSession,
  verifyPrivateAccessSecret
} from "@/lib/private-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { configured: privateSessionConfigured(), unlocked: requestHasPrivateSession(request) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  if (!privateSessionConfigured()) {
    return NextResponse.json(
      { error: "Private Voyages access is not configured.", code: "PRIVATE_ACCESS_NOT_CONFIGURED" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  let candidate = "";
  try {
    const body = await request.json() as { secret?: unknown };
    if (typeof body.secret === "string" && body.secret.length <= 512) candidate = body.secret;
  } catch {
    // Keep response generic.
  }

  if (!verifyPrivateAccessSecret(candidate)) {
    return NextResponse.json(
      { error: "Private Voyages access was not unlocked.", code: "PRIVATE_ACCESS_DENIED" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const value = createPrivateSessionValue();
  if (!value) {
    return NextResponse.json(
      { error: "Private Voyages access is not configured.", code: "PRIVATE_ACCESS_NOT_CONFIGURED" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const response = NextResponse.json({ unlocked: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(PRIVATE_SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: privateSessionMaxAge()
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ unlocked: false }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(PRIVATE_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
  return response;
}
