export const PUBLIC_THEME_KEY = "lentera-public-theme";
export const PUBLIC_THEME_EVENT = "lentera:public-theme";
export type PublicTheme = "dark" | "light";

export function normalizePublicTheme(value: unknown): PublicTheme {
  return value === "light" ? "light" : "dark";
}

// Runs in the head before paint. Storage may be disabled; dark remains usable.
export const publicThemeBootstrap = `(()=>{let theme="dark";try{if(localStorage.getItem("${PUBLIC_THEME_KEY}")==="light")theme="light"}catch{}document.documentElement.dataset.publicTheme=theme})()`;
