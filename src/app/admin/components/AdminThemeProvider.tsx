"use client";
import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

export default function AdminThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="light"
      storageKey="admin-theme"
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}