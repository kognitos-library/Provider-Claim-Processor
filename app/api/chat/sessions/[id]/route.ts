import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [sessionRes, messagesRes] = await Promise.all([
    supabaseAdmin.from("provider_claims_chat_sessions").select("*").eq("id", id).single(),
    supabaseAdmin
      .from("provider_claims_chat_messages")
      .select("*")
      .eq("session_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (sessionRes.error) {
    return NextResponse.json(
      { error: sessionRes.error.message },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ...sessionRes.data,
    messages: messagesRes.data ?? [],
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const { error } = await supabaseAdmin
    .from("provider_claims_chat_sessions")
    .update({ title: body.title, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("provider_claims_chat_sessions")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
