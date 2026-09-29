-- Duplicate audit.
--
-- Four different things can present as "the same entry" to a reader, and only
-- one of them is a data problem. This checks all four so a display fix is never
-- mistaken for a data fix, or the reverse.

select '1. same provider + model_id'   as check_name, count(*) as offending from (
  select provider_id, model_id_text
    from offers where model_id_text is not null
   group by 1, 2 having count(*) > 1
) x
union all
select '2. same provider + label', count(*) from (
  select provider_id, model_label
    from offers group by 1, 2 having count(*) > 1
) x
union all
select '3. same provider + label (one id null, one not)', count(*) from (
  select provider_id, lower(model_label) as l
    from offers
   group by 1, 2
  having count(*) > 1
     and count(*) filter (where model_id_text is null) > 0
     and count(*) filter (where model_id_text is not null) > 0
) x
union all
select '4. duplicate events', count(*) from (
  select provider_id, start_at from events
   where start_at is not null group by 1, 2 having count(*) > 1
) x
union all
select '5. duplicate models per provider', count(*) from (
  select provider_id, model_id from models group by 1, 2 having count(*) > 1
) x
union all
select '6. duplicate change rows', count(*) from (
  select provider_id, coalesce(offer_id,-1), coalesce(event_id,-1),
         change_type, coalesce(field,''), coalesce(old_value,''),
         coalesce(new_value,''), coalesce(source_url,'')
    from changes group by 1,2,3,4,5,6,7,8 having count(*) > 1
) x
union all
select '7. offers that look identical to a reader', count(*) from (
  select provider_id, model_label, offer_type, status,
         card_required, access_requires_subscription, api_key_required,
         rpm, rpd, pool_size, pool_remaining
    from offers
   group by 1,2,3,4,5,6,7,8,9,10,11
  having count(*) > 1
) x;
