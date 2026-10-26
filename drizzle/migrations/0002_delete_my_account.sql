-- Lets a signed-in user permanently delete their own account and all of their data (GDPR erasure).
-- Called from the client with supabase.rpc('delete_my_account'), so it also works in the Android app.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Never remove the last admin, or nobody could manage the app any more.
  IF public.has_role(uid, 'admin')
     AND (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'last_admin';
  END IF;

  DELETE FROM public.cards            WHERE owner_id = uid;
  DELETE FROM public.decks            WHERE owner_id = uid;
  DELETE FROM public.daily_logs       WHERE user_id  = uid;
  DELETE FROM public.user_settings    WHERE user_id  = uid;
  DELETE FROM public.deck_assignments WHERE user_id  = uid;
  UPDATE public.shared_decks SET created_by = NULL WHERE created_by = uid;
  DELETE FROM public.user_roles       WHERE user_id  = uid;
  DELETE FROM public.profiles         WHERE id       = uid;
  DELETE FROM auth.users              WHERE id       = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
