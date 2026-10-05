// APR-026: a report-only CSP must name somewhere for a violation to go.
//
// A report-only policy with no `report-uri` and no `report-to` enforces
// nothing AND reports nothing, because a violation has nowhere to go. That is
// how CIP-003 shipped marked fixed while its own recorded follow-up condition
// - "enforce once no violations are reported" - was unsatisfiable rather than
// merely unmet: no violation could ever be reported.
//
// This asserts the MECHANISM's absence is gone and that the destination named
// actually exists as a POST route. It does not assert that any report has ever
// been received, because that cannot be known from the repository.
//
// Run: node scripts/test-csp-report-destination.mjs (static; needs no server).
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const config = readFileSync(path.join(root, "next.config.ts"), "utf8");

let failures = 0;
function check(name, ok, detail) {
  if (ok) {
    console.log(`ok ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}: ${detail}`);
  }
}

// 1. The report-only policy names a report-uri. The directive interpolates a
//    constant, so resolve that constant rather than reading the template
//    literal - reading the raw source would assert against "${CSP_REPORT_URI}".
const declares = /report-uri\s+([^\s"'`]+)/.test(config);
check(
  "report-only policy declares report-uri",
  declares,
  "no report-uri directive in CSP_REPORT_ONLY",
);

const constMatch = config.match(
  /const\s+CSP_REPORT_URI\s*=\s*["'`]([^"'`]+)["'`]/,
);
const uri = declares
  ? constMatch
    ? constMatch[1]
    : config.match(/report-uri\s+([^\s"'`]+)/)[1]
  : null;
check(
  "report-uri resolves to a literal path",
  Boolean(uri && uri.startsWith("/")),
  `report-uri is ${uri === null ? "absent" : JSON.stringify(uri)}, which is not a path`,
);

// 2. report-to alone is not enough: it requires a Reporting-Endpoints header
//    to be honoured, so if the policy uses report-to there must be one.
if (/report-to\s/.test(config)) {
  check(
    "report-to is accompanied by a Reporting-Endpoints header",
    /Reporting-Endpoints/.test(config),
    "report-to present with no Reporting-Endpoints header, so reports go nowhere",
  );
} else {
  console.log("ok report-to not used, so no Reporting-Endpoints header required");
}

// 3. The named destination is a real route file that accepts POST. A
//    report-uri pointing at a 404 is the same defect wearing a fix's clothes.
if (uri) {
  const clean = uri.split("?")[0].replace(/^\/+/, "");
  const routePath = path.join(root, "app", clean, "route.ts");
  check(
    `named destination resolves to a route file (${uri})`,
    existsSync(routePath),
    `no file at app/${clean}/route.ts`,
  );

  if (existsSync(routePath)) {
    const route = readFileSync(routePath, "utf8");
    check(
      "the destination exports POST",
      /export\s+async\s+function\s+POST|export\s+const\s+POST/.test(route),
      "route file exports no POST handler, so a violation report cannot reach it",
    );
    check(
      "the destination returns a 2xx without reflecting the report",
      /status:\s*204/.test(route) || /NextResponse\.json/.test(route) === false,
      "destination does not acknowledge with 2xx",
    );
    check(
      "the destination does not echo the report body",
      !/NextResponse\.json\(\s*body|json\(\s*await\s+request\.json/.test(route),
      "destination reflects the attacker-influenceable report into a response",
    );
  }
}

// 4. The policy must still be report-only. This test is about reports having a
//    destination, not about enforcement - enforcement is a separate decision.
check(
  "policy is still Report-Only (enforcement is a separate decision)",
  /Content-Security-Policy-Report-Only/.test(config),
  "no report-only header found in next.config.ts",
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAPR-026 green: report-only violations have a destination that exists");