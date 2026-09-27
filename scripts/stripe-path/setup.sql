-- Le rôle du parcours Stripe : il amorce auth.users (GoTrue absent) et lit les
-- sept objets. Local seulement : mot de passe connu, base rejouée.
--   sudo -u postgres psql -f scripts/stripe-path/setup.sql
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'stripe_path') then
    create role stripe_path login superuser password 'eklio_local';
  end if;
end $$;
