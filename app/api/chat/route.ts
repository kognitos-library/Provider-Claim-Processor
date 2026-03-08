import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { req, ORG_ID, WORKSPACE_ID, AUTOMATION_ID } from "@/lib/kognitos";
import { toRunSummary, toRunDetail } from "@/lib/transforms";
import { decodeArrowTable } from "@/lib/arrow";
import type { RawRun } from "@/lib/types";

const anthropic = new Anthropic();

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
          english_code: data.english_code,
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

export async function POST(request: Request) {
  const { sessionId, message } = await request.json();

  if (!sessionId || !message) {
    return NextResponse.json(
      { error: "sessionId and message are required" },
      { status: 400 }
    );
  }

  await supabaseAdmin.from("provider_claims_chat_messages").insert({
    session_id: sessionId,
    role: "user",
    content: message,
  });

  const { data: history } = await supabaseAdmin
    .from("provider_claims_chat_messages")
    .select("role, content, tool_call")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const messages: Anthropic.MessageParam[] = (history ?? []).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const systemPrompt = await buildSystemPrompt();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let currentMessages = messages;
        let fullResponse = "";

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: systemPrompt,
            tools: TOOLS,
            messages: currentMessages,
          });

          let hasToolUse = false;
          const toolResults: Anthropic.MessageParam[] = [];

          for (const block of response.content) {
            if (block.type === "text") {
              fullResponse += block.text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`
                )
              );
            } else if (block.type === "tool_use") {
              hasToolUse = true;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "tool_use", name: block.name, input: block.input })}\n\n`
                )
              );

              const result = await executeTool(
                block.name,
                block.input as Record<string, unknown>
              );

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "tool_result", name: block.name, result: result.slice(0, 200) })}\n\n`
                )
              );

              toolResults.push({
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: block.id,
                    content: result,
                  },
                ],
              });
            }
          }

          if (!hasToolUse) break;

          currentMessages = [
            ...currentMessages,
            { role: "assistant", content: response.content },
            ...toolResults,
          ];
        }

        await supabaseAdmin.from("provider_claims_chat_messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: fullResponse,
        });

        const { count } = await supabaseAdmin
          .from("provider_claims_chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId);

        const isFirstExchange = count !== null && count <= 2;

        const titlePromise = isFirstExchange
          ? anthropic.messages
              .create({
                model: "claude-sonnet-4-20250514",
                max_tokens: 30,
                messages: [
                  {
                    role: "user",
                    content: `Generate a short title (max 6 words) for a chat that starts with this message. Return ONLY the title, no quotes or punctuation.\n\nUser message: ${message}`,
                  },
                ],
              })
              .then((r) => {
                const block = r.content[0];
                return block.type === "text" ? block.text.trim() : message.slice(0, 60);
              })
              .catch(() => message.slice(0, 60))
          : null;

        const updateFields: Record<string, string> = {
          updated_at: new Date().toISOString(),
        };

        if (titlePromise) {
          updateFields.title = await titlePromise;
        }

        await supabaseAdmin
          .from("provider_claims_chat_sessions")
          .update(updateFields)
          .eq("id", sessionId);

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
        controller.close();
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: msg })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
