-- Removes event rows that duplicate an existing pool.
--
-- The seed and the collector derived event slugs differently, so the apmix
-- pool existed once as `apmix-community-event` and again as
-- `apmix-community-event-shared-token-pool`. The site rendered both. This keeps
-- the canonical row (the one the seed's researched description belongs to) and
-- deletes the derived-name duplicate.
--
-- Must run before uq_events_identity can be created, since the duplicates
-- violate it.

delete from events
 where slug in (
   select slug from (
     select e.slug,
            row_number() over (
              partition by e.provider_id, e.start_at
              order by (e.description is not null) desc, e.id
            ) as rn
       from events e
      -- Open-ended events are partitioned by provider alone, so they cannot
      -- take the place of a dated one.
      where e.start_at is null
   ) open_ended where open_ended.rn > 1
 )
 or slug in (
   select slug from (
     select e.slug,
            row_number() over (
              partition by e.provider_id, e.start_at
              order by (e.description is not null) desc, e.id
            ) as rn
       from events e
      where e.start_at is not null
   ) dated where dated.rn > 1
 );
