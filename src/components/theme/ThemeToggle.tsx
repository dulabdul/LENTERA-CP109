"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { normalizePublicTheme, PUBLIC_THEME_EVENT, PUBLIC_THEME_KEY } from "./public-theme";

function getSnapshot() {
  return normalizePublicTheme(document.documentElement.dataset.publicTheme);
}
const getServerSnapshot = () => "dark" as const;

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PUBLIC_THEME_KEY && event.key !== null) return;
    document.documentElement.dataset.publicTheme = normalizePublicTheme(event.newValue);
    onChange();
  };
  window.addEventListener(PUBLIC_THEME_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PUBLIC_THEME_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function ThemeToggle() {
  const path = usePathname();
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!["/", "/sumber-data", "/privasi"].includes(path)) return null;

  const isDark = theme === "dark";
  function toggleTheme() {
    const next = getSnapshot() === "dark" ? "light" : "dark";
    document.documentElement.dataset.publicTheme = next;
    try { localStorage.setItem(PUBLIC_THEME_KEY, next); } catch { /* Session still works without storage. */ }
    window.dispatchEvent(new Event(PUBLIC_THEME_EVENT));
  }

  return (
    <button type="button" className="theme-toggle" aria-label="Mode gelap" aria-pressed={isDark}
      title={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"} onClick={toggleTheme}>
      <svg className="theme-icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg className="theme-icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.5 14.2A8.7 8.7 0 0 1 9.8 3.5a8.7 8.7 0 1 0 10.7 10.7Z" />
      </svg>
    </button>
  );
}
