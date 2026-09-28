-- Offer identity.
--
-- An offer is uniquely identified by its provider plus the model it grants
-- access to. Without this constraint nothing stops a re-run of the seed, or a
-- collector that changes a label, from silently creating a second copy of the
-- same route — which is exactly what happened: every researched offer was
-- duplicated and the live count was nearly double the truth.
--
-- The identity expression coalesces the two ways a route can be named. A route
-- with a model id is identified by that id; a pool or credit offer covering
-- many models has no single id, so it falls back to its label.
--
-- A violation is now an error rather than a silent duplicate, which is the
-- behaviour we want: a race or a label change should be visible, not absorbed.
create unique index if not exists uq_offers_identity
  on offers (provider_id, (coalesce(model_id_text, model_label)));

comment on index uq_offers_identity is
  'One offer per provider per model route. Prevents duplicate rows when a seed or sweep is re-run.';

-- One event per provider per start time.
--
-- The same failure mode as uq_offers_identity: two rows describing one pool
-- because the seed and the collector generated different slugs for it. A pool
-- that opens at a given moment is a single thing, so that pair is the identity.
-- This constraint makes a second such row impossible rather than merely
-- unlikely.
create unique index if not exists uq_events_identity
  on events (provider_id, start_at)
  where start_at is not null;

-- Open-ended events have no start time to key on, so a pool with no start
-- cannot be duplicated per provider. The slug remains its identity.
create unique index if not exists uq_events_open_ended
  on events (provider_id)
  where start_at is null;

comment on index uq_events_identity is
  'One event per provider per start time, so a pool cannot be stored twice under two slugs.';

-- The reconciliation key and the uniqueness constraint must agree, otherwise
-- the sweep could look for a row by one rule and be blocked by another.
comment on column offers.model_id_text is
  'The provider''s own model identifier. With model_label it forms the offer identity enforced by uq_offers_identity.';
