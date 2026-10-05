# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Email the maintainer directly, or use GitHub's private reporting:

- GitHub → this repository → **Security** → **Report a vulnerability**

Include what you found, which route or table is affected, and how to reproduce
it. You will get an acknowledgement.

## What this project holds

This repository contains **no secrets and no credentials**. `.env.local` is
gitignored and a filled-in copy is never committed. `.env.example` documents
the variable names only.

What the deployed system holds:

| Credential | Scope | Where it lives |
|---|---|---|
| Supabase **publishable** key | Browser-safe. Reads only what RLS exposes to `anon`. | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, in the client bundle by design |
| Supabase **secret** key | Bypasses RLS. Server-only. | Supabase Vault (`supabase_secret_key`), read by `pg_net`; and `SUPABASE_SECRET_KEY`, read only by `lib/admin-db.ts` behind `/admin` and `/discovery` |
| `ADMIN_PASSWORD` | The admin sign-in password. Compared in constant time. | Server env only |
| `ADMIN_SESSION_SECRET` | HMAC key signing the admin session cookie. | Server env only |

The `/admin` and `/discovery` routes require a signed session cookie. With
either admin variable unset, sign-in **refuses** and the routes stay closed —
they do not fall open.

## Security properties this project maintains

- **A failed source is never an ended offer.** When monitoring cannot reach a
  source, the failure is recorded and the offers are left exactly as they were.
  Nothing is withdrawn because a request timed out. This is invariant 3 and it
  is the reason an outage here can never be mistaken for a mass withdrawal.
- **Writes are revoked from `anon`.** All stored procedures that mutate data
  are inaccessible to the publishable key.
- **RLS is enabled on every table** the frontend reads.
- **Observations are append-only.** A verification record is never updated in
  place, so the audit trail cannot be quietly rewritten.
- **A number the provider does not publish is stored as `NULL`** and rendered as
  *not publicly stated* — never as zero and never as a guess.
- **Units are never silently converted.** A pool quoted in weighted tokens is
  labelled weighted tokens.
- **History is never deleted**, including for providers that have withdrawn
  their free tier.

## Scope

In scope: this repository, the deployed site, the public API, and the Supabase
project.

Out of scope: vulnerabilities in Supabase's own infrastructure, in Vercel's
platform, or in third-party providers listed on the site. Those should be
reported to those vendors.

## A note on dependency reports

Automated dependency scanners are welcome. Please do not file a report for a
theoretical issue with no working proof of concept — this repository treats a
finding as invalid unless it can be reproduced, and the same standard applies
to incoming reports.
