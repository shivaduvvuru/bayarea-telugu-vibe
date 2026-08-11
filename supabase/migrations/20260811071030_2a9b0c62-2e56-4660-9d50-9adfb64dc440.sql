UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'shiva.duvvuru@gmail.com';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'shiva.duvvuru@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;