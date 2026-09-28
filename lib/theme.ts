/**
 * Theme: dark is the product default (§43). The stored preference wins on
 * return visits, and the script below runs before first paint so the sheet
 * never flashes the wrong theme.
 */
export const THEME_KEY = "fpr-theme";
export const DEFAULT_THEME = "dark" as const;
export type Theme = "light" | "dark";

/** Runs in <head>, before paint. Never throws. */
export const themeInitScript = `
(function(){
  try {
    var k = ${JSON.stringify(THEME_KEY)};
    var saved = localStorage.getItem(k);
    var t = saved === "dark" || saved === "light" ? saved : ${JSON.stringify(DEFAULT_THEME)};
    var el = document.documentElement;
    el.setAttribute("data-theme", t);
    el.style.colorScheme = t;
  } catch (e) {
    document.documentElement.setAttribute("data-theme", ${JSON.stringify(DEFAULT_THEME)});
  }
})();
`;
