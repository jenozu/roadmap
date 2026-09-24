import { NextRequest, NextResponse } from "next/server";
import { fetchProject } from "@/lib/github";

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
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import this roadmap.";
    const invalid = message.startsWith("Enter a valid");
    return NextResponse.json({ error: message }, { status: invalid ? 400 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
