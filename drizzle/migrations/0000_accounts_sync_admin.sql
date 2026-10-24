CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz
);
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
CREATE TABLE public.decks (
  id text NOT NULL,
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  shared_deck_id uuid,
  created_at bigint NOT NULL DEFAULT 0,
  updated_at bigint NOT NULL DEFAULT 0,
  deleted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (owner_id, id)
);
CREATE TABLE public.cards (
  id text NOT NULL,
  deck_id text NOT NULL,
  owner_id uuid NOT NULL,
  front text NOT NULL DEFAULT '',
  back text NOT NULL DEFAULT '',
  hint text,
  box integer NOT NULL DEFAULT 0,
  due bigint NOT NULL DEFAULT 0,
  lapses integer NOT NULL DEFAULT 0,
  reviews integer NOT NULL DEFAULT 0,
  updated_at bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, id)
);
CREATE INDEX cards_deck_idx ON public.cards (owner_id, deck_id);
CREATE TABLE public.daily_logs (
  user_id uuid NOT NULL,
  day text NOT NULL,
  learned integer NOT NULL DEFAULT 0,
  reviewed integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY,
  daily_goal integer NOT NULL DEFAULT 10,
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_time text NOT NULL DEFAULT '20:00',
  updated_at bigint NOT NULL DEFAULT 0
);
CREATE TABLE public.shared_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.shared_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_deck_id uuid NOT NULL REFERENCES public.shared_decks(id) ON DELETE CASCADE,
  front text NOT NULL DEFAULT '',
  back text NOT NULL DEFAULT '',
  hint text
);
CREATE TABLE public.deck_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_deck_id uuid NOT NULL REFERENCES public.shared_decks(id) ON DELETE CASCADE,
  user_id uuid
);
CREATE UNIQUE INDEX deck_assignments_uniq ON public.deck_assignments (shared_deck_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decks, public.cards, public.daily_logs, public.user_settings, public.shared_decks, public.shared_cards, public.deck_assignments TO authenticated;
GRANT ALL ON public.profiles, public.user_roles, public.decks, public.cards, public.daily_logs, public.user_settings, public.shared_decks, public.shared_cards, public.deck_assignments TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND disabled = false)
$$;
CREATE OR REPLACE FUNCTION public.can_read_shared_deck(_user_id uuid, _deck uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.deck_assignments WHERE shared_deck_id = _deck AND (user_id IS NULL OR user_id = _user_id))
$$;

-- profiles
CREATE POLICY "own or admin read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own or admin update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.disabled IS DISTINCT FROM OLD.disabled OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'not allowed';
    END IF;
    IF OLD.disabled THEN RAISE EXCEPTION 'account disabled'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- roles
CREATE POLICY "own or admin read roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- user-owned study tables
CREATE POLICY "read own decks" ON public.decks FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert own decks" ON public.decks FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_active_user(auth.uid()));
CREATE POLICY "update own decks" ON public.decks FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND public.is_active_user(auth.uid()));
CREATE POLICY "delete own decks" ON public.decks FOR DELETE TO authenticated USING (owner_id = auth.uid() AND public.is_active_user(auth.uid()));

CREATE POLICY "read own cards" ON public.cards FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert own cards" ON public.cards FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_active_user(auth.uid()));
CREATE POLICY "update own cards" ON public.cards FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND public.is_active_user(auth.uid()));
CREATE POLICY "delete own cards" ON public.cards FOR DELETE TO authenticated USING (owner_id = auth.uid() AND public.is_active_user(auth.uid()));

CREATE POLICY "read own logs" ON public.daily_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert own logs" ON public.daily_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user(auth.uid()));
CREATE POLICY "update own logs" ON public.daily_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_active_user(auth.uid()));

CREATE POLICY "read own settings" ON public.user_settings FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert own settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_user(auth.uid()));
CREATE POLICY "update own settings" ON public.user_settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.is_active_user(auth.uid()));

-- shared decks
CREATE POLICY "read assigned shared decks" ON public.shared_decks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.can_read_shared_deck(auth.uid(), id));
CREATE POLICY "admin manage shared decks" ON public.shared_decks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "read assigned shared cards" ON public.shared_cards FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.can_read_shared_deck(auth.uid(), shared_deck_id));
CREATE POLICY "admin manage shared cards" ON public.shared_cards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "read own assignments" ON public.deck_assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "admin manage assignments" ON public.deck_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- signup: profile + admin for verified owner email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = 'bessiecui0608@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = 'bessiecui0608@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER on_auth_user_confirmed_admin AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_user_confirmed();

-- backfill existing users
INSERT INTO public.profiles (id, email, display_name)
SELECT id, email, split_part(email, '@', 1) FROM auth.users ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'user' FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email_confirmed_at IS NOT NULL AND lower(email) = 'bessiecui0608@gmail.com' ON CONFLICT DO NOTHING;