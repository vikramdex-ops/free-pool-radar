-- ==================================================================
-- 0009_discovery_queue.sql
-- ------------------------------------------------------------------
-- §52. The discovery queue and the actions available on a candidate.
--
-- The table already existed from 0001 with the four statuses §52 calls for
-- (verify, reject, investigate, merge) as an enum, which is why no status
-- migration is needed. What is missing is everything else the section asks
-- each candidate to show: what kind of thing it is, why it was flagged, and
-- what the reviewer decided.
--
-- Two rules govern this design.
--
-- First, a candidate is never deleted. "Reject" is a recorded decision with a
-- reason and a timestamp, not a removal — the same reason history is never
-- pruned (§16). A reviewer who rejects a bad lead is doing the work that stops
-- the next reviewer re-reading it.
--
-- Second, the transition is done in SQL rather than by three separate writes
-- from the browser. A candidate that ends up verified without reviewed_at set,
-- or merged with no destination recorded, is worse than no decision at all,
-- and the database is the only place that can make that impossible.
-- ==================================================================

begin;

-- ------------------------------------------------------------------
-- Candidate kind
-- ------------------------------------------------------------------

do $$ begin
  create type candidate_kind as enum (
    'new_provider',    -- a provider we do not track yet
    'free_model',      -- a model that may be free at a tracked provider
    'shared_pool',     -- a pooled or sponsored allocation
    'ended_offer'      -- something that may have been withdrawn
  );
exception when duplicate_object then null; end $$;

alter table discovery_candidates
  add column if not exists kind           candidate_kind,
  add column if not exists ai_summary      text,
  add column if not exists ai_confidence   numeric(4,3),
  add column if not exists ai_rationale    text,
  add column if not exists resolution_note text,
  add column if not exists into_provider_id bigint references providers (id) on delete set null,
  add column if not exists into_offer_id    bigint references offers    (id) on delete set null,
  add column if not exists reviewed_at      timestamptz;

-- `reviewed_at` may already exist from 0001 in a different position; adding the
-- column above is a no-op when it does, and this statement normalises the type.
alter table discovery_candidates
  alter column reviewed_at type timestamptz;

comment on column discovery_candidates.kind is
  'What sort of thing this candidate is (A52). Null means not yet classified.';

comment on column discovery_candidates.resolution_note is
  'Why the reviewer decided as they did. Kept permanently, including on rejection.';

-- ------------------------------------------------------------------
-- Indexes
--
-- The queue is read as "what is still pending, oldest first", which is an
-- index on (status, discovered_at) rather than the status-only index from 0001.
-- ------------------------------------------------------------------

create index if not exists idx_candidates_queue
  on discovery_candidates (status, discovered_at desc);

create index if not exists idx_candidates_kind
  on discovery_candidates (kind)
  where kind is not null;

-- ------------------------------------------------------------------
-- Resolving a candidate
--
-- §52 offers exactly four actions. Each maps to a status, and each is recorded
-- with when and why. The function refuses a resolution that contradicts itself
-- rather than storing it and letting the page explain it later.
-- ------------------------------------------------------------------

create or replace function rpc_resolve_candidate(
  p_candidate_id  bigint,
  p_status        candidate_status,
  p_note          text   default null,
  p_into_provider bigint  default null,
  p_into_offer    bigint  default null
) returns discovery_candidates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate discovery_candidates;
begin
  -- Guard the enum before comparing it. Comparing against a bare literal would
  -- raise a cast error from deep inside the block, which is a worse diagnostic
  -- than saying which argument was wrong.
  if p_status is null then
    raise exception 'rpc_resolve_candidate: status is required'
      using errcode = '22004';
  end if;

  select * into v_candidate from discovery_candidates where id = p_candidate_id for update;
  if not found then
    raise exception 'rpc_resolve_candidate: candidate % does not exist', p_candidate_id
      using errcode = 'P0002';
  end if;

  -- A merge that names no destination records a decision we cannot act on or
  -- audit later, so it is refused here.
  if p_status = 'merged' and p_into_provider is null and p_into_offer is null then
    raise exception 'rpc_resolve_candidate: a merge must name the provider or offer it merged into'
      using errcode = '22004';
  end if;

  -- Verified and rejected are terminal judgements, so both require a reason.
  -- "Verified" with no note is how unverifiable claims enter a database whose
  -- whole premise is that its numbers were read rather than asserted.
  if p_status in ('verified', 'rejected') and coalesce(trim(p_note), '') = '' then
    raise exception 'rpc_resolve_candidate: % requires a note explaining the decision',
      p_status
      using errcode = '22004';
  end if;

  update discovery_candidates
     set status           = p_status,
         resolution_note  = coalesce(p_note, resolution_note),
         into_provider_id = case when p_status = 'merged' then p_into_provider else into_provider_id end,
         into_offer_id    = case when p_status = 'merged' then p_into_offer    else into_offer_id    end,
         reviewed_at      = case when p_status = 'investigating' then null else now() end
   where id = p_candidate_id
  returning * into v_candidate;

  return v_candidate;
end;
$$;

comment on function rpc_resolve_candidate is
  'Records a review decision on a discovery candidate (A52). Never deletes.';

-- ------------------------------------------------------------------
-- Grants
--
-- The public role keeps no access to this table or function. Candidates are
-- reviewed by the secret-key path in the internal routes, which bypasses RLS
-- because the middleware has already established who is asking.
-- ------------------------------------------------------------------

revoke all on discovery_candidates from anon, authenticated;
revoke all on function rpc_resolve_candidate(bigint, candidate_status, text, bigint, bigint)
  from anon, authenticated;

grant select on discovery_candidates to service_role;
grant execute on function rpc_resolve_candidate(bigint, candidate_status, text, bigint, bigint)
  to service_role;

commit;

-- PostgREST caches the schema; without this a new function can return PGRST202
-- or silently run a superseded definition. See migration 0008.
select pg_notify('pgrst', 'reload schema');
