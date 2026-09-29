-- Exercises every branch of rpc_resolve_candidate.
--
-- The point is the refusals: a verified candidate with no reason, and a merge
-- with no destination, must both be rejected by the database. If either is
-- accepted, the review queue can record a decision nobody can audit.

do $$
declare
  v_id  bigint;
  v_res discovery_candidates;
  v_n   integer;
begin
  -- Work on a throwaway candidate so the real queue is untouched.
  insert into discovery_candidates (url, kind, provider_guess, discovered_from, evidence)
  values ('https://example.invalid/probe', 'new_provider', 'Probe', 'acceptance test', 'probe')
  returning id into v_id;

  -- 1. verify with no note must be refused
  begin
    perform rpc_resolve_candidate(v_id, 'verified', null);
    raise exception 'FAIL: verify without a note was accepted';
  exception when sqlstate '22004' then
    raise notice 'ok: verify without a note refused';
  end;

  -- 2. reject with no note must be refused
  begin
    perform rpc_resolve_candidate(v_id, 'rejected', '   ');
    raise exception 'FAIL: reject with a blank note was accepted';
  exception when sqlstate '22004' then
    raise notice 'ok: reject with a blank note refused';
  end;

  -- 3. merge with no destination must be refused
  begin
    perform rpc_resolve_candidate(v_id, 'merged', 'merged into an existing provider', null, null);
    raise exception 'FAIL: merge with no destination was accepted';
  exception when sqlstate '22004' then
    raise notice 'ok: merge with no destination refused';
  end;

  -- 4. investigate is allowed without a note, and stays unresolved
  perform rpc_resolve_candidate(v_id, 'investigating', 'checking the docs');
  select * into v_res from discovery_candidates where id = v_id;
  if v_res.reviewed_at is not null then
    raise exception 'FAIL: investigating was marked reviewed';
  end if;
  raise notice 'ok: investigate accepted and left unresolved';

  -- 5. verify with a note must succeed and stamp the review
  select * into v_res
    from rpc_resolve_candidate(v_id, 'verified', 'documentation confirms a free quota');
  if v_res.status <> 'verified' then
    raise exception 'FAIL: verify did not apply (% )', v_res.status;
  end if;
  if v_res.reviewed_at is null then
    raise exception 'FAIL: verify did not stamp reviewed_at';
  end if;
  raise notice 'ok: verify applied with note and timestamp';

  -- 6. a decision must survive a later transition, in the log
  perform rpc_resolve_candidate(v_id, 'investigating', 'reopening');
  select * into v_res from discovery_candidates where id = v_id;
  if v_res.resolution_note is distinct from 'reopening' then
    raise exception 'FAIL: the current note does not reflect the current status (%)',
      v_res.resolution_note;
  end if;

  select count(*) into v_n from discovery_candidate_decisions
   where candidate_id = v_id
     and to_status = 'verified'
     and note = 'documentation confirms a free quota';
  if coalesce(v_n, 0) <> 1 then
    raise exception 'FAIL: the original verification reason is not in the log';
  end if;
  raise notice 'ok: the earlier decision survives in the log after a reopen';

  -- 6b. re-verifying without a note must be refused
  begin
    perform rpc_resolve_candidate(v_id, 'verified', null);
    raise exception 'FAIL: re-verify without a note was accepted';
  exception when sqlstate '22004' then
    raise notice 'ok: re-verify without a note refused';
  end;

  -- 6c. a repeated identical transition is refused rather than duplicated.
  -- These are two separate blocks on purpose: a raise inside a block rolls the
  -- whole block back, so a first call and its repeat must not share one, or the
  -- first one's log entry is silently undone and the count below lies.
  begin
    perform rpc_resolve_candidate(v_id, 'investigating', 'still investigating');
  exception when sqlstate '22004' then
    raise exception 'FAIL: a new note on an open candidate was refused';
  end;

  select count(*) into v_n from discovery_candidate_decisions where candidate_id = v_id;
  if coalesce(v_n, 0) <> 4 then
    raise exception 'FAIL: expected 4 committed decisions, found %', v_n;
  end if;

  begin
    perform rpc_resolve_candidate(v_id, 'investigating', 'still investigating');
    raise exception 'FAIL: an identical repeat transition was accepted';
  exception when sqlstate '22004' then
    raise notice 'ok: a repeated identical transition refused';
  end;

  -- 6d. a refused transition must not have been logged
  select count(*) into v_n from discovery_candidate_decisions where candidate_id = v_id;
  if coalesce(v_n, 0) <> 4 then
    raise exception 'FAIL: a refused transition was logged anyway (now %)', v_n;
  end if;
  raise notice 'ok: % decisions logged, refusals logged nothing', v_n;

  -- 7. a missing candidate must be reported, not silently a no-op
  begin
    perform rpc_resolve_candidate(-999, 'rejected', 'nope');
    raise exception 'FAIL: resolving a missing candidate silently succeeded';
  exception when sqlstate 'P0002' then
    raise notice 'ok: missing candidate reported';
  end;

  delete from discovery_candidates where id = v_id;
  raise notice 'probe candidate removed; real queue untouched';
end $$;

-- The queue itself, and whether the new columns are present.
select
  (select count(*) from discovery_candidates)                             as total_candidates,
  (select count(*) from discovery_candidates where status = 'pending')    as pending,
  (select count(*) from discovery_candidates where kind is not null)      as classified,
  (select count(*) from information_schema.columns
     where table_name = 'discovery_candidates'
       and column_name in ('kind','ai_summary','ai_confidence','ai_rationale',
                           'resolution_note','into_provider_id','into_offer_id',
                           'reviewed_at'))                               as new_columns_present;
