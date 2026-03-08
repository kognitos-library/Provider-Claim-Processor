export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_call?: ToolCallData;
  created_at: string;
}

export interface ToolCallData {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
}

export type ChatStreamEvent =
  | { type: "text"; content: string }
  | { type: "tool_use"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: string }
  | { type: "done" }
  | { type: "error"; message: string };
