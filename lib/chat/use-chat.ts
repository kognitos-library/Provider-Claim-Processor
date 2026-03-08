"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatSession, ChatMessage, ChatStreamEvent } from "./types";

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/chat/sessions");
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions ?? []);
    }
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    const res = await fetch(`/api/chat/sessions/${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
    }
  }, []);

  const createSession = useCallback(async (title?: string): Promise<string> => {
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || "New conversation" }),
    });
    const session = await res.json();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setMessages([]);
    return session.id;
  }, []);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    },
    [activeSessionId]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = await createSession();
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          session_id: sessionId!,
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
        },
      ]);

      try {
        abortRef.current = new AbortController();
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: content }),
          signal: abortRef.current.signal,
        });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error("No response stream");

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event: ChatStreamEvent = JSON.parse(line.slice(6));
              if (event.type === "text") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.content }
                      : m
                  )
                );
              }
              if (event.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: `Error: ${event.message}` }
                      : m
                  )
                );
              }
            } catch {
              /* skip malformed events */
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Sorry, something went wrong. Please try again." }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        loadSessions();
      }
    },
    [activeSessionId, createSession, loadSessions]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    sessions,
    activeSessionId,
    messages,
    isLoading,
    isStreaming,
    loadSessions,
    loadSession,
    createSession,
    deleteSession,
    sendMessage,
    stopStreaming,
    setActiveSessionId,
  };
}
