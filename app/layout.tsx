"use client";

import "./globals.css";
import { ThemeProvider, SidebarProvider, SidebarInset } from "@kognitos/lattice";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider defaultTheme="light">
          <SidebarProvider>
            {/* Add your <AppSidebar /> component here */}
            <SidebarInset>{children}</SidebarInset>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
