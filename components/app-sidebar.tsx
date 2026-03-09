"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarSeparator,
  Icon,
  Text,
} from "@kognitos/lattice";
import { useChatContext } from "@/lib/chat/chat-context";

const KOGNITOS_URL = process.env.NEXT_PUBLIC_KOGNITOS_URL || "#";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    loadSession,
    deleteSession,
  } = useChatContext();

  const handleSelectSession = (sessionId: string) => {
    loadSession(sessionId);
    if (!pathname.startsWith("/chat")) router.push("/chat");
  };

  const handleChatNav = () => {
    setActiveSessionId(null);
    router.push("/chat");
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <Icon type="FileText" size="md" />
          <div>
            <Text level="base" weight="semibold">
              Claims Processor
            </Text>
            <Text level="xSmall" color="muted">
              Provider Billing Dashboard
            </Text>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/"}>
                  <Link href="/">
                    <Icon type="Home" size="sm" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/chat") && !activeSessionId}
                  onClick={handleChatNav}
                >
                  <Icon type="MessageSquare" size="sm" />
                  <span>Chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {sessions.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {sessions.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton
                      isActive={session.id === activeSessionId}
                      onClick={() => handleSelectSession(session.id)}
                      className="truncate"
                    >
                      <Icon type="MessageSquare" size="sm" />
                      <span className="truncate">{session.title}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      showOnHover
                      onClick={() => deleteSession(session.id)}
                      title="Delete conversation"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Icon type="Trash" size="xs" />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarSeparator />
        <a
          href={KOGNITOS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon type="ExternalLink" size="sm" />
          <span>Open in Kognitos</span>
        </a>
      </SidebarFooter>
    </Sidebar>
  );
}
