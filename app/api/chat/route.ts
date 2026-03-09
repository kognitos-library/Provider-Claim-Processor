import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin, TABLES } from "@/lib/supabase";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { req, ORG_ID, WORKSPACE_ID, AUTOMATION_ID } from "@/lib/kognitos";
import { toRunSummary, toRunDetail } from "@/lib/transforms";
import type { RawRun } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_runs",
    description:
      "List recent claim processing batches with their status, patient count, and total charges. Returns the most recent 20 batches by default.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_size: {
          type: "number",
          description: "Number of batches to return (max 50)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_run",
    description:
      "Get full details for a specific claim processing batch, including patient information, email delivery status, CMS-1450 claim data, and PDF files.",
    input_schema: {
      type: "object" as const,
      properties: {
        run_id: {
          type: "string",
          description: "The batch/run ID to look up",
        },
      },
      required: ["run_id"],
    },
  },
  {
    name: "get_automation",
    description:
      "Get information about the Provider Claims Processor automation including its code, connections, and configuration.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "list_runs": {
      const pageSize = (input.page_size as number) || 20;
      const path = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTOMATION_ID}/runs?pageSize=${pageSize}`;
      const res = await req(path);
      if (!res.ok) return `API error: ${res.status}`;
      const data = await res.json();
      const runs: RawRun[] = data.runs ?? [];
      const summaries = runs.map(toRunSummary);
      return JSON.stringify(summaries, null, 2);
    }

    case "get_run": {
      const runId = input.run_id as string;
      const path = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTOMATION_ID}/runs/${runId}`;
      const res = await req(path);
      if (!res.ok) return `API error: ${res.status}`;
      const run: RawRun = await res.json();
      const detail = toRunDetail(run);
      return JSON.stringify(detail, null, 2);
    }

    case "get_automation": {
      const path = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTOMATION_ID}`;
      const res = await req(path);
      if (!res.ok) return `API error: ${res.status}`;
      const data = await res.json();
      return JSON.stringify(
        {
          display_name: data.display_name,
          english_code: data.english_code?.slice(0, 3000),
          connections: data.connections,
          input_specs: data.input_specs,
        },
        null,
        2
      );
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

async function generateTitle(userMessage: string, assistantMessage: string): Promise<string> {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 30,
    messages: [
      {
        role: "user",
        content: `Summarize this conversation in 4-6 words for a sidebar title. No quotes, no punctuation at the end.\n\nUser: ${userMessage}\nAssistant: ${assistantMessage.slice(0, 300)}`,
      },
    ],
  });
  const block = res.content[0];
  return block.type === "text" ? block.text.trim() : "New Conversation";
}

export async function POST(request: Request) {
  const body = await request.json();
  const { sessionId, message } = body as { sessionId: string; message: string };

  if (!message || !sessionId) {
    return NextResponse.json({ error: "Missing sessionId or message" }, { status: 400 });
  }

  if (supabaseAdmin) {
    await supabaseAdmin
      .from(TABLES.messages)
      .insert({ session_id: sessionId, role: "user", content: message });
  }

  const systemPrompt = await buildSystemPrompt();

  let existingMessages: Anthropic.MessageParam[] = [];
  if (supabaseAdmin) {
    const { data: dbMessages } = await supabaseAdmin
      .from(TABLES.messages)
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (dbMessages) {
      const filtered = dbMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const merged: Anthropic.MessageParam[] = [];
      for (const msg of filtered) {
        const last = merged[merged.length - 1];
        if (last && last.role === msg.role) {
          last.content = last.content + "\n\n" + msg.content;
        } else {
          merged.push(msg);
        }
      }
      existingMessages = merged;
    }
  } else {
    existingMessages = [{ role: "user", content: message }];
  }

  const encoder = new TextEncoder();
  const responseStream = new ReadableStream({
    async start(controller) {
      let streamClosed = false;
      const send = (data: Record<string, unknown>) => {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          streamClosed = true;
        }
      };

      try {
        let messages = [...existingMessages];
        let fullAssistantResponse = "";

        for (let iteration = 0; iteration < 5; iteration++) {
          if (iteration > 0 && fullAssistantResponse.length > 0) {
            fullAssistantResponse += "\n\n";
            send({ type: "text", content: "\n\n" });
          }

          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: systemPrompt,
            tools: TOOLS,
            messages,
          });

          stream.on("text", (text) => {
            fullAssistantResponse += text;
            send({ type: "text", content: text });
          });

          const finalMessage = await stream.finalMessage();

          const toolBlocks = finalMessage.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );

          if (toolBlocks.length === 0) break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of toolBlocks) {
            send({ type: "tool_use", tool_name: block.name, tool_input: block.input });
            let result: string;
            try {
              result = await executeTool(block.name, block.input as Record<string, unknown>);
            } catch (e) {
              result = `Tool error: ${e instanceof Error ? e.message : "Unknown error"}`;
            }
            send({ type: "tool_result", tool_name: block.name, content: result.slice(0, 200) + "..." });
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
          }

          messages = [
            ...messages,
            { role: "assistant", content: finalMessage.content },
            { role: "user", content: toolResults },
          ];
        }

        if (supabaseAdmin) {
          await supabaseAdmin
            .from(TABLES.messages)
            .insert({ session_id: sessionId, role: "assistant", content: fullAssistantResponse || "" });
        }

        if (supabaseAdmin) {
          const { count } = await supabaseAdmin
            .from(TABLES.messages)
            .select("*", { count: "exact", head: true })
            .eq("session_id", sessionId);

          if (count && count <= 3) {
            try {
              const title = await generateTitle(message, fullAssistantResponse);
              await supabaseAdmin
                .from(TABLES.sessions)
                .update({ title, updated_at: new Date().toISOString() })
                .eq("id", sessionId);
              send({ type: "title", content: title });
            } catch {
              /* title generation is best-effort */
            }
          }
        }

        send({ type: "done" });
      } catch (err) {
        console.error("[chat] Stream error:", err);
        try {
          send({ type: "error", content: err instanceof Error ? err.message : "Unknown error" });
        } catch { /* controller may be closed */ }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
