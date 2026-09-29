-- Removes change rows that are true duplicates.
--
-- Partitioning must include the subject of the change. An earlier version of
-- this file partitioned on (provider, type, field, old, new, source) only,
-- which treated every "new" change for a provider's offer list as a duplicate
-- of the first one and deleted around a hundred legitimate rows.
--
-- Two changes are the same row only when they describe the same thing happening
-- to the same subject: the same offer, or the same event.

delete from changes
 where id in (
   select id from (
     select c.id,
            row_number() over (
              partition by c.provider_id,
                           coalesce(c.offer_id, -1),
                           coalesce(c.event_id, -1),
                           c.change_type,
                           coalesce(c.field, ''),
                           coalesce(c.old_value, ''),
                           coalesce(c.new_value, ''),
                           coalesce(c.source_url, '')
              order by c.detected_at, c.id
            ) as rn
       from changes c
   ) dupes
    where dupes.rn > 1
 );
