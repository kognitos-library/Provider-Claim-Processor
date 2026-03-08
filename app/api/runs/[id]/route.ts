import { NextResponse } from "next/server";
import { req, ORG_ID, WORKSPACE_ID, AUTOMATION_ID } from "@/lib/kognitos";
import { toRunDetail } from "@/lib/transforms";
import type { RawRun } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const path = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTOMATION_ID}/runs/${id}`;
  const res = await req(path);

  if (!res.ok) {
    return NextResponse.json(
      { error: `Kognitos API error: ${res.status}` },
      { status: res.status }
    );
  }

  const run: RawRun = await res.json();
  const detail = toRunDetail(run);

  return NextResponse.json(detail);
}
