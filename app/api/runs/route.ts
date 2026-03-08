import { NextResponse } from "next/server";
import { req, ORG_ID, WORKSPACE_ID, AUTOMATION_ID } from "@/lib/kognitos";
import { toRunSummary } from "@/lib/transforms";
import type { RawRun } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageSize = searchParams.get("pageSize") ?? "20";

  const path = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTOMATION_ID}/runs?pageSize=${pageSize}`;
  const res = await req(path);

  if (!res.ok) {
    return NextResponse.json(
      { error: `Kognitos API error: ${res.status}` },
      { status: res.status }
    );
  }

  const data = await res.json();
  const runs: RawRun[] = data.runs ?? [];
  const summaries = runs.map(toRunSummary);

  return NextResponse.json({ runs: summaries });
}
