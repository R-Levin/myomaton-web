"use client";

import {
  createContext,
  useContext,
  useEffect,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { siteThemeVariables } from "@/lib/site-theme";
import type { SiteTheme } from "@/types/site-theme";
import styles from "./blocks.module.css";

const SiteThemeContext = createContext<{
  theme: SiteTheme;
  setTheme: Dispatch<SetStateAction<SiteTheme>>;
} | null>(null);

const readOnlyTheme = () => {};

export function SiteThemeProvider({ children, theme, setTheme = readOnlyTheme }: {
  children: ReactNode;
  theme: SiteTheme;
  setTheme?: Dispatch<SetStateAction<SiteTheme>>;
}) {
  return (
    <SiteThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </SiteThemeContext.Provider>
  );
}

export function useSiteTheme() {
  const context = useContext(SiteThemeContext);
  if (!context) throw new Error("SiteThemeProvider is required.");
  return context;
}

export function ThemedPage({ children }: { children: ReactNode }) {
  const { theme } = useSiteTheme();
  return <main className={styles.page} style={siteThemeVariables(theme)}>{children}</main>;
}

export function PreviewFrame({ children, document: frameDocument }: {
  children: ReactNode;
  document?: Document;
}) {
  useEffect(() => {
    if (!frameDocument) return;
    // Puck copies stylesheets, but next/font variables live on the host html element.
    const hostStyles = getComputedStyle(document.documentElement);
    const root = frameDocument.documentElement;
    const variables = ["--font-geist-sans", "--font-geist-mono"];
    const previous = variables.map((name) => root.style.getPropertyValue(name));
    variables.forEach((name) => root.style.setProperty(name, hostStyles.getPropertyValue(name)));
    return () => {
      variables.forEach((name, index) => {
        if (previous[index]) root.style.setProperty(name, previous[index]);
        else root.style.removeProperty(name);
      });
    };
  }, [frameDocument]);

  return <>{children}</>;
}
