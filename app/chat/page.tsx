"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Title,
  Text,
  Button,
  Icon,
  Skeleton,
} from "@kognitos/lattice";
import { useChatContext } from "@/lib/chat/chat-context";

const SUGGESTIONS = [
  "How many batches were processed today?",
  "Which patients had the highest charges?",
  "Show me the most recent batch details",
  "What is the overall success rate?",
];

export default function ChatPage() {
  const {
    activeSessionId,
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
  } = useChatContext();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text);
  };

  const handleSuggestion = (text: string) => {
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-1px)]">
      {messages.length === 0 && !activeSessionId ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-lg text-center space-y-6">
            <div>
              <Icon type="MessageSquare" size="2xl" className="mx-auto mb-3 text-muted-foreground" />
              <Title level="h3">Ask about your claims</Title>
              <Text level="small" color="muted" className="mt-1">
                I can look up batch details, patient data, charges, and email delivery status.
              </Text>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="rounded-lg border bg-card p-3 text-left text-sm hover:bg-accent transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.role === "user" ? (
                  <Text level="small">{msg.content}</Text>
                ) : msg.content ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about claim batches, patients, charges..."
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {isStreaming ? (
            <Button variant="outline" size="sm" onClick={stopStreaming}>
              <Icon type="Square" size="sm" />
              Stop
            </Button>
          ) : (
            <Button type="submit" size="sm" disabled={!input.trim()}>
              <Icon type="SendHorizontal" size="sm" />
              Send
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
