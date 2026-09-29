-- Backfills dedupe_key on change rows written before the seed supplied one.
--
-- These are historical rows that predate the key, so a re-run of the seed or a
-- retried sweep could not recognise them and would insert a second copy. The
-- key is derived from the same fields the sweep hashes, so once set, a repeat
-- write conflicts on the unique index and is dropped.
--
-- The offer key is reconstructed the way the sweep builds it:
--   provider slug || '::' || coalesce(model_id_text, model_label)
--
-- The key is computed in a CTE because UPDATE ... FROM cannot reference the
-- table being updated from a later join.

with computed as (
  select c.id,
         encode(
           digest(
             c.change_type::text || '|' || coalesce(c.field, '')
             || '|' || coalesce(c.old_value, '')
             || '|' || coalesce(c.new_value, '')
             || '|' || p.slug || '::' || coalesce(o.model_id_text, o.model_label),
             'sha256'),
           'hex') as key
    from changes c
    join providers p on p.id = c.provider_id
    left join offers o on o.id = c.offer_id
   where c.dedupe_key is null
)
update changes c
   set dedupe_key = computed.key
  from computed
 where c.id = computed.id;

-- A row that still has no key could not be hashed, so drop it rather than leave
-- a permanently unrecognised duplicate waiting to be written again.
delete from changes where dedupe_key is null;
