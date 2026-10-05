# Checks that need the live database.
#
# These are deliberately NOT in CI. They read Supabase with the publishable
# anon key, and a CI workflow that needs a database credential is a workflow
# that eventually leaks one. They stay local, run by whoever is fixing the
# finding, and the result is recorded in the shared findings register.
#
# Run from the repo root with .env.local present:
#   node scripts/test-provider-filter.mjs
#   node scripts/test-read-errors.mjs
#
# Everything else in scripts/ runs without credentials and IS in CI. If you add
# a test, put it in .github/workflows/ci.yml unless it touches the database.

# Deny policy (a test stays OUT of the CI loop only if all three hold):
# 1. It requires a capability CI lacks: a browser binary, a deployment plus
#    credentials, or a live database. Wanting a server is not enough - use
#    the test-sitemap-fresh shape instead: static assertions unconditional,
#    network half behind `if (!process.env.BASE)`.
# 2. It is recorded in the DENY map of scripts/test-ci-loop-complete.mjs
#    with the missing capability named. A deny entry without a reason fails
#    the guard the same way an unwired test does.
# 3. scripts/test-ci-loop-complete.mjs itself is wired: it runs offline and
#    static, so by its own rule it belongs in the loop, and the loop count
#    includes it.
#
# Current deny list and why: test-new-routes (playwright + localhost),
# test-prod-auth (deployed URL + ADMIN_PASSWORD), test-provider-filter
# (live database), test-read-errors (live database).
