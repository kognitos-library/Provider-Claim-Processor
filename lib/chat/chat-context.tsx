"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useChat } from "./use-chat";

type ChatContextValue = ReturnType<typeof useChat>;

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = useChat();

  useEffect(() => {
    chat.loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}
