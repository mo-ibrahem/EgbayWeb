-- 20260901205652_drop_ambiguous_legacy_request_wallet_payout.sql
--
-- APPLIED. The real fix for the PGRST203 overload ambiguity described in
-- the previous migration: the only way to resolve a same-name/same-
-- argcount PostgREST overload ambiguity is to remove one candidate from
-- the schema.
--
-- Dropping the text-arg overload specifically: it is also the wrong/
-- legacy one on its own merits -- it never writes to payout_requests at
-- all (that INSERT is missing entirely from its body, unlike the uuid
-- overload, which correctly populates payout_requests.user_id), so
-- keeping it would silently produce incomplete payout records even if
-- it could somehow be selected.
--
-- Verified after applying: the real REST API call that previously
-- returned PGRST203 now reaches the RPC's own validation logic (tested
-- with a deliberately invalid payout method id, which correctly returns
-- "Invalid payout method" instead of the ambiguity error).

DROP FUNCTION IF EXISTS public.request_wallet_payout(uuid, numeric, text);
