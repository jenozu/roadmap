import { NextRequest, NextResponse } from "next/server";
import { fetchProject, safeProjectError } from "@/lib/github-server";
import { requestHasPrivateSession } from "@/lib/private-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  try {
    const result = await fetchProject({
      repo: query.get("repo") || "",
      branch: query.get("branch") || "main",
      path: query.get("path") || "master_list.md",
      name: query.get("name") || undefined
    }, {
      includeActivity: query.get("activity") !== "0",
      privateAccessAuthorized: requestHasPrivateSession(request),
      preferPrivate: query.get("private") === "1"
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = safeProjectError(error);
    return NextResponse.json(
      safe.body,
      { status: safe.status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
