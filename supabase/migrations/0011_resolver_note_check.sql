-- 0010 is already applied, so the corrected resolver is deployed as a new
-- migration rather than by editing history. Same function body, one fix: the
-- duplicate check now compares the note as well as the status.
begin;

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
  v_from      candidate_status;
begin
  if p_status is null then
    raise exception 'rpc_resolve_candidate: status is required'
      using errcode = '22004';
  end if;

  select * into v_candidate from discovery_candidates where id = p_candidate_id for update;
  if not found then
    raise exception 'rpc_resolve_candidate: candidate % does not exist', p_candidate_id
      using errcode = 'P0002';
  end if;

  v_from := v_candidate.status;

  if p_status = 'merged' and p_into_provider is null and p_into_offer is null then
    raise exception 'rpc_resolve_candidate: a merge must name the provider or offer it merged into'
      using errcode = '22004';
  end if;

  if p_status in ('verified', 'rejected') and coalesce(trim(p_note), '') = '' then
    raise exception 'rpc_resolve_candidate: % requires a note explaining the decision',
      p_status
      using errcode = '22004';
  end if;

  -- A transition that changes neither the status nor the note records nothing,
  -- and would make the log harder to read than the thing it records. Repeating
  -- the status with a *different* note is legitimate — that is a reviewer
  -- reporting what they found while the candidate stayed open — so the note is
  -- part of the comparison rather than an exemption from it.
  if v_from = p_status
     and coalesce(trim(p_note), '') = coalesce(trim(v_candidate.resolution_note), '') then
    raise exception 'rpc_resolve_candidate: candidate % is already % with that note',
      p_candidate_id, p_status
      using errcode = '22004';
  end if;

  -- The log entry is written first, so a failure in the update cannot leave a
  -- status changed with no recorded reason.
  insert into discovery_candidate_decisions (
    candidate_id, from_status, to_status, note,
    into_provider_id, into_offer_id
  ) values (
    p_candidate_id, v_from, p_status, p_note,
    case when p_status = 'merged' then p_into_provider else null end,
    case when p_status = 'merged' then p_into_offer    else null end
  );

  update discovery_candidates
     set status           = p_status,
         resolution_note  = p_note,
         into_provider_id = case when p_status = 'merged' then p_into_provider else null end,
         into_offer_id    = case when p_status = 'merged' then p_into_offer    else null end,
         reviewed_at      = case when p_status = 'investigating' then null else now() end
   where id = p_candidate_id
  returning * into v_candidate;

  return v_candidate;
end;
$$;

commit;

select pg_notify('pgrst', 'reload schema');
