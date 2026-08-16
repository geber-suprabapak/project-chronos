"use client";

import { useTheme } from "next-themes";
import type { ToasterProps } from "sonner";
import { Toaster as SonnerComponent } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <SonnerComponent
      // SAFETY: next-themes string maps to sonner theme type
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // SAFETY: Custom CSS properties object contains CSS variables for toast styling
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
