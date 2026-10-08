"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_THEME, THEME_KEY, type Theme } from "@/lib/theme";

/**
 * Theme switch (§43). Dark is the product default; light is the override.
 *
 * The control renders in a neutral state until it has mounted, so the server
 * markup and the first client render agree. Reading the resolved attribute
 * rather than assuming the default is what keeps the icon honest when someone
 * has a stored preference.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    setTheme(attr === "light" ? "light" : "dark");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      document.documentElement.style.colorScheme = next;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // Private mode: the choice simply does not persist. Not worth
        // interrupting the reader over.
      }
      return next;
    });
  }, []);

  const isDark = theme !== "light";
  const label =
    theme === null
      ? "Switch colour theme"
      : isDark
        ? "Switch to light theme"
        : "Switch to dark theme";
  // The button shows a word as well as a glyph, so the accessible name has to
  // contain that word. An aria-label describing the action alone leaves the
  // visible "DARK"/"LIGHT" outside the name (axe: label-content-name-mismatch).
  // The visible word must stand on its own: axe splits the name on
  // whitespace, so "…(DARK)" would not count as the word DARK. A dash keeps
  // it a separate token while reading naturally.
  const visible = isDark ? "DARK" : "LIGHT";
  const accessibleLabel = `${label} — ${visible}`;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      aria-pressed={theme === null ? undefined : isDark}
      className={`theme-toggle ${className}`}
    >
      <span className="theme-glyph" aria-hidden="true">
        {/* Both glyphs stay mounted; only opacity changes, so the icon does not
            swap nodes under the pointer mid-click. */}
        <svg viewBox="0 0 16 16" className={`theme-sun ${isDark ? "off" : "on"}`}>
          <circle cx="8" cy="8" r="3.2" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M8 1v1.8M8 13.2V15M15 8h-1.8M2.8 8H1M12.9 3.1l-1.3 1.3M4.4 11.6l-1.3 1.3M12.9 12.9l-1.3-1.3M4.4 4.4L3.1 3.1" />
          </g>
        </svg>
        <svg viewBox="0 0 16 16" className={`theme-moon ${isDark ? "on" : "off"}`}>
          <path
            d="M13.5 9.6A5.9 5.9 0 0 1 6.4 2.5 5.9 5.9 0 1 0 13.5 9.6Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="theme-text">{isDark ? "DARK" : "LIGHT"}</span>
    </button>
  );
}
