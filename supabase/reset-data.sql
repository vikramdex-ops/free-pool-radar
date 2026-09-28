-- Clears all collected data while leaving the schema, RLS policies, stored
-- procedures, cron job and Vault entries in place.
--
-- Only for development and for rebuilding a dataset polluted by a partial run.
-- It is destructive by design and is never called by the application.
--
-- Order matters: children first, since the foreign keys cascade anyway but an
-- explicit order keeps the intent obvious.

truncate table
  observations,
  changes,
  events,
  offers,
  models,
  sweep_runs,
  source_conflicts,
  discovery_candidates
restart identity;

-- sources and providers are the registry, not collected data, so they survive.
-- Reset their volatile monitoring state so health is not reported against a
-- previous run's timestamps.
update sources
   set last_fetched_at = null,
       last_ok_at = null,
       last_status_code = null,
       last_latency_ms = null,
       last_error = null,
       health = 'live';

update providers
   set free_model_count = 0,
       live_offer_count = 0,
       last_verified_at = null;

update schedule_config
   set last_run_at = null,
       next_run_at = null
 where id = true;
