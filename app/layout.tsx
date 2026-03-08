"use client";

import "./globals.css";
import { ThemeProvider, SidebarProvider, SidebarInset } from "@kognitos/lattice";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatProvider } from "@/lib/chat/chat-context";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Provider Claims Processor</title>
        <meta name="description" content="Monitor claim processing batches and billing activity" />
      </head>
      <body>
        <ThemeProvider defaultTheme="light">
          <ChatProvider>
            <SidebarProvider open={true}>
              <AppSidebar />
              <SidebarInset>
                <div className="flex-1 overflow-auto">{children}</div>
              </SidebarInset>
            </SidebarProvider>
          </ChatProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
