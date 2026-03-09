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
  ModeToggle,
  Icon,
  Text,
  Skeleton,
} from "@kognitos/lattice";
import { useChatContext } from "@/lib/chat/chat-context";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    isLoadingSessions,
    deleteSession,
  } = useChatContext();

  const handleChatNav = () => {
    setActiveSessionId(null);
    router.push("/chat");
  };

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Icon type="FileText" size="sm" className="text-primary-foreground" />
          </div>
          <div>
            <Text level="base" weight="semibold" className="text-sm leading-tight">
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

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Chat History</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoadingSessions ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <SidebarMenuItem key={i}>
                      <Skeleton className="h-8 w-full" />
                    </SidebarMenuItem>
                  ))}
                </>
              ) : sessions.length === 0 ? (
                <SidebarMenuItem>
                  <Text level="xSmall" color="muted" className="px-2 py-1">
                    No conversations yet
                  </Text>
                </SidebarMenuItem>
              ) : (
                sessions.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={session.id === activeSessionId}
                    >
                      <Link
                        href="/chat"
                        onClick={() => setActiveSessionId(session.id)}
                      >
                        <Icon type="MessageCircle" size="xs" />
                        <span className="truncate">
                          {session.title || "New Conversation"}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="opacity-0 group-hover/menu-item:opacity-100 transition-opacity"
                    >
                      <Icon type="Trash" size="xs" />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="flex items-center justify-between">
          <Text level="xSmall" color="muted">Powered by Kognitos</Text>
          <ModeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
