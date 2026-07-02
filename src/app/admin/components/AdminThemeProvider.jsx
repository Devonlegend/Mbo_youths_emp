"use client";
import { ThemeProvider } from "next-themes";

export default function AdminThemeProvider({ children }) {
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