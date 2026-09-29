-- ==================================================================
-- 0012_backfill_candidate_kind.sql
-- ------------------------------------------------------------------
-- §52 lists four kinds of candidate. The table existed with none of them set,
-- so the queue could not be worked: a reviewer saw a URL and a note and had
-- no way to tell a brand-new provider from a free model at one we already
-- track. Those are different jobs, and only one of them means adding a
-- provider row.
--
-- The classification is derived from the registry rather than hand-assigned,
-- because a hand-assigned list goes stale the moment a candidate's provider is
-- added. Every candidate naming a provider we do not track is a potential new
-- provider; one whose provider we do track is a different kind of lead and is
-- left unclassified for a human to read, because the rule can tell that the
-- provider is known but not what the candidate actually is.
-- ==================================================================

begin;

with classified as (
  select
    c.id,
    case
      when coalesce(trim(c.provider_guess), '') = '' then null
      when p.slug is null                          then 'new_provider'::candidate_kind
      else null   -- provider is already tracked: the kind needs reading, not guessing
    end as kind
  from discovery_candidates c
  left join providers p
    on lower(p.name) = lower(c.provider_guess)
    or lower(p.slug) = lower(c.provider_guess)
)
update discovery_candidates c
   set kind = k.kind
  from classified k
 where k.id = c.id
   -- Only fill a gap. A kind that has been set by a reviewer is not overwritten
   -- by a re-run of this rule.
   and c.kind is null
   and k.kind is not null;

commit;
