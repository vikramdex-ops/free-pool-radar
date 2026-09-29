-- PostgREST caches function definitions and does not always reload after DDL
-- applied through the Management API, so an RPC can keep executing a stale
-- version of a function that has already been replaced in the database.
--
-- The symptom is confusing: calling the function directly in SQL behaves
-- correctly while calling it over PostgREST fails inside the same statement.
-- This is that, and this fixes it.
notify pgrst, 'reload schema';
