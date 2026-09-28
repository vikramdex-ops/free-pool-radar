-- Acceptance test cleanup.
--
-- Removes the synthetic fixture and every row the test produced. This is not a
-- violation of the append-only rule: these rows described a provider that never
-- existed, so keeping them would insert a fiction into the public history.

delete from changes where provider_id in (select id from providers where slug = 'zz-acceptance-fixture');
delete from observations where provider_id in (select id from providers where slug = 'zz-acceptance-fixture');
delete from offers where provider_id in (select id from providers where slug = 'zz-acceptance-fixture');
delete from models where provider_id in (select id from providers where slug = 'zz-acceptance-fixture');
delete from sources where provider_slug = 'zz-acceptance-fixture';
delete from providers where slug = 'zz-acceptance-fixture';
