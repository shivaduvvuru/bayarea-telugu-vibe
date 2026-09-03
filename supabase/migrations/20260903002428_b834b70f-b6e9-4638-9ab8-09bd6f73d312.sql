-- The API layer resolves the embedding column type as public.vector; with the
-- extension parked in "extensions" every mirror write failed. Put it back in
-- public so publishing keeps the digest table up to date.
ALTER EXTENSION vector SET SCHEMA public;