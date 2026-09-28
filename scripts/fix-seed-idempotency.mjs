/* Normalises the seed's ON CONFLICT clauses.
   The clause belongs only on inserts into `offers`, where the unique index
   uq_offers_identity lives. A previous pass annotated `changes` and
   `source_conflicts` too, which fails because those tables have no
   model_id_text column.

   This removes the clause everywhere and re-adds it only inside an
   `insert into offers` block. */
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
const CLAUSE = "on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing";

const lines = readFileSync(file, "utf8").split("\n");

let table = null;
let removed = 0;
let added = 0;

const out = lines.map((line) => {
  const m = /^\s*insert into (\w+)/i.exec(line);
  if (m) table = m[1].toLowerCase();

  // Strip the clause wherever it was wrongly added.
  let l = line;
  if (l.includes("coalesce(model_id_text, model_label)")) {
    l = l.replace(/\s*on conflict \(provider_id, \(coalesce\(model_id_text, model_label\)\)\) do nothing;?/, "");
    if (!l.trimEnd().endsWith(";")) l = `${l.trimEnd()};`;
    removed++;
  }

  // Re-add it for offers only, at the end of the statement.
  if (table === "offers" && /from providers where slug=\S+\s*;/.test(l)) {
    l = l.replace(/\s*;\s*$/, ` ${CLAUSE};`);
    added++;
  }
  return l;
});

writeFileSync(file, out.join("\n"));
console.log(`removed ${removed}, re-added ${added}`);
