-- Forces PostgREST to pick up the current definitions of the sweep functions.
--
-- PostgREST resolves RPCs from an in-memory schema cache. When DDL is applied
-- through the Management API's SQL endpoint, the cache is not always reloaded,
-- so a function that exists and works when called directly returns
--
--   PGRST202: Searched for the function public.rpc_reconcile_sweep ... but no
--   matches were found in the schema cache
--
-- or silently keeps executing a superseded definition. Both happened here, and
-- the second was the more misleading: a sweep that failed inside a function
-- whose fix was already in the database.
--
-- Applying DDL through a migration is the supported path, so this migration's
-- purpose is to be a real schema change the platform will notice.

-- A comment is DDL that changes the stored definition without changing
-- behaviour, which is exactly what is wanted: reload the cache, alter nothing.
comment on function public.rpc_reconcile_sweep(jsonb) is
  'Reconciles one provider''s collected result in a single call: models, offers, observations, events and changes. Returns per-provider counts. PostgREST resolves this by name from its schema cache, so a comment bump is used to force a reload after a definition change.';

comment on function public.rpc_offer_changes(jsonb, jsonb) is
  'Diffs a stored offer against a collected one, one typed row per field that moved. Returns no rows when nothing changed, which is what makes a repeated sweep a complete no-op.';
