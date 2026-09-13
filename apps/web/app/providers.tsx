"use client";
import { MantineProvider } from "@mantine/core";
import { useEffect } from "react";
import { cssVariablesResolver, theme } from "./theme";

// One shared theme for the admin workspace, chat and public agent pages.
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () =>
      document.documentElement.style.setProperty(
        "--app-viewport-height",
        `${viewport?.height || window.innerHeight}px`,
      );
    resize();
    viewport?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <MantineProvider
      forceColorScheme="light"
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
    >
      {children}
    </MantineProvider>
  );
}
