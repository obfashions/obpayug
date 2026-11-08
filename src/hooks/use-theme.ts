import { useCallback, useEffect, useState } from "react";

type Appearance = "light" | "dark";
const THEME_KEY = "obpay-theme";
const CHANGE_EVENT = "obpay-appearance-change";

function savedAppearance(): Appearance {
  try {
    const saved = localStorage.getItem(THEME_KEY) ?? localStorage.getItem("obpay_theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch { /* Use the device preference when storage is unavailable. */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Appearance>("light");
  useEffect(() => {
    const sync = () => {
      const next = savedAppearance();
      document.documentElement.classList.toggle("dark", next === "dark");
      setTheme(next);
    };
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
      media.removeEventListener("change", sync);
    };
  }, []);
  const toggleTheme = useCallback(() => {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
      localStorage.removeItem("obpay_theme");
    } catch { /* The current page still supports appearance changes. */ }
    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return { theme, toggleTheme };
}