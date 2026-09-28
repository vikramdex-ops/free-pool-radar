-- Puts the project's secret key into Supabase Vault so pg_net can authenticate
-- the sweep without the key ever appearing in a query or a log.
--
-- Run once by an operator. The value below is a placeholder: replace it with
-- your own project's secret key (sb_secret_...) from the dashboard, or set it
-- with:  supabase secrets set  (which writes the same Vault entry).
--
-- Idempotent: if the entry already exists the secret is left alone, so
-- re-running cannot silently swap the credential on a live project.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'supabase_secret_key') then
    perform vault.create_secret(
      'REPLACE_WITH_YOUR_SECRET_KEY',
      'supabase_secret_key',
      'Project secret key used by pg_net to call the radar-sweep function.'
    );
    raise notice 'created vault secret supabase_secret_key';
  else
    raise notice 'vault secret supabase_secret_key already exists, leaving it unchanged';
  end if;
end $$;
