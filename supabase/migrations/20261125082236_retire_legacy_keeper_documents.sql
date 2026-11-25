-- The normalized tables are now the active data model. The old row is retained
-- in keeper_private.keeper_documents_legacy for rollback and historical recovery.
drop table public.keeper_documents;
