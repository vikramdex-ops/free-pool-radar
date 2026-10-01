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
