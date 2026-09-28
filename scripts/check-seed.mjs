/* Checks every `insert into T (cols) select ...` in a seed file: the target
   column list must match the value list. Postgres reports the line but not the
   off-by-one, and these rows are wide and mostly nullable.

   Handles the `insert into t (a,b) values (..),(..)` form and the
   `insert into t (a,b) select .., .. from ..` form. */
import { readFileSync } from "node:fs";

const file = process.argv[2];
const sql = readFileSync(file, "utf8");

/** Split on top-level commas, respecting quotes and parens. */
function splitTop(s) {
  const out = [];
  let cur = "";
  let d = 0;
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      cur += c;
      if (c === "'" && s[i + 1] === "'") cur += s[++i];
      else if (c === "'") inStr = false;
      continue;
    }
    if (c === "'") { inStr = true; cur += c; continue; }
    if (c === "(") d++;
    if (c === ")") d--;
    if (c === "," && d === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Index of the char that closes the paren opened at `start`. */
function matchParen(s, start) {
  let d = 0;
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "'" && s[i + 1] === "'") i++;
      else if (c === "'") inStr = false;
      continue;
    }
    if (c === "'") { inStr = true; continue; }
    if (c === "(") d++;
    else if (c === ")") { d--; if (d === 0) return i; }
  }
  return -1;
}

/** First index matching `re` that is not inside a string literal. */
function indexOutsideStrings(s, re) {
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "'" && s[i + 1] === "'") i++;
      else if (c === "'") inStr = false;
      continue;
    }
    if (c === "'") { inStr = true; continue; }
    const m = re.exec(s.slice(i));
    if (m && m.index === 0) return i;
  }
  return -1;
}

const re = /insert\s+into\s+(\w+)\s*\(/gi;
let m;
let checked = 0;
let bad = 0;

while ((m = re.exec(sql)) !== null) {
  const table = m[1];
  const open = m.index + m[0].length - 1;
  const close = matchParen(sql, open);
  if (close === -1) continue;

  const cols = splitTop(sql.slice(open + 1, close));
  const after = sql.slice(close + 1);

  // values (...) row list
  const vMatch = /^\s*values/i.exec(after);
  if (vMatch) {
    const vOpen = after.indexOf("(", close + 1 + vMatch[0].length - 1);
    const relOpen = sql.indexOf("(", close + 1);
    if (relOpen === -1) continue;
    const relClose = matchParen(sql, relOpen);
    if (relClose === -1) continue;
    const body = sql.slice(relOpen + 1, relClose);
    const rows = [];
    let d = 0, cur = "", inStr = false;
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (inStr) {
        cur += c;
        if (c === "'" && body[i + 1] === "'") cur += body[++i];
        else if (c === "'") inStr = false;
        continue;
      }
      if (c === "'") { inStr = true; cur += c; continue; }
      if (c === "(") { d++; if (d === 1) { cur = ""; continue; } }
      if (c === ")") { d--; if (d === 0) { rows.push(cur); continue; } }
      if (c === "," && d === 1) { rows.push(cur); cur = ""; continue; }
      cur += c;
    }
    checked++;
    rows.forEach((r, i) => {
      const n = splitTop(r).length;
      if (n !== cols.length) {
        bad++;
        console.log(
          `✗ ${table} values row ${i + 1}: ${n} values vs ${cols.length} columns`,
        );
        console.log(`   ${r.trim().replace(/\s+/g, " ").slice(0, 70)}`);
      }
    });
    continue;
  }

  // select ... from
  const sMatch = /^\s*select/i.exec(after);
  if (sMatch) {
    // Find the FROM keyword outside string literals, otherwise a value like
    // 'Funds from sponsors' truncates the select list.
    const fromIdx = indexOutsideStrings(after, /\bfrom\b/i);
    if (fromIdx === -1) continue;
    const selectList = after.slice(after.search(/select/i) + 6, fromIdx);
    // A `case when` contains no top-level comma, so splitTop is safe here.
    const vals = splitTop(selectList);
    checked++;
    if (vals.length !== cols.length) {
      bad++;
      console.log(
        `✗ ${table} select: ${vals.length} expressions vs ${cols.length} columns`,
      );
      const first = selectList.trim().replace(/\s+/g, " ").slice(0, 70);
      console.log(`   ${first}`);
      // Point at the first divergence to make the fix mechanical.
      const n = Math.min(vals.length, cols.length);
      for (let i = 0; i < Math.max(vals.length, cols.length); i++) {
        if ((vals[i] ?? "—") === undefined) break;
      }
      console.log(`   first divergence near index ${n}`);
    }
  }
}

console.log(
  bad === 0
    ? `OK: ${checked} insert(s) checked, all column counts match`
    : `\n${bad} mismatch(es) across ${checked} insert(s)`,
);
