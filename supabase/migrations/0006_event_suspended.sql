-- A sponsor or operator can pause a pool without ending it. That is a
-- materially different fact from "this event is over", and collapsing the two
-- would tell a reader the pool is gone when it is merely switched off.
--
-- Adding a value cannot be rolled back inside a transaction, so the type is
-- altered in its own statement and the NOT IN USE guard makes a re-run a
-- no-op rather than an error.
do $$
begin
  if not exists (
    select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
     where t.typname = 'event_status'
       and e.enumlabel = 'suspended'
  ) then
    alter type event_status add value if not exists 'suspended';
  end if;
end $$;

comment on type event_status is
  'Lifecycle of a pool or event. suspended means switched off by its operator, not finished.';
