-- Run manually in Supabase SQL Editor. Records products only; does not activate billing.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.wrxs_price_catalog
  add column if not exists stripe_product_id text;

do $$
begin
  if (select count(*) from public.wrxs_price_catalog
      where plan_key = 'standard' and currency = 'usd'
        and ((billing_interval = 'month' and amount_cents = 400)
          or (billing_interval = 'year' and amount_cents = 4000))) <> 2 then
    raise exception 'Expected USD 4 monthly and USD 40 annual price rows. No changes applied.';
  end if;
  if exists (select 1 from public.wrxs_price_catalog
      where plan_key = 'standard' and (checkout_enabled or
        (stripe_product_id is not null and stripe_product_id <> case billing_interval
          when 'month' then 'prod_VGUQxjX7HY1nZM'
          when 'year' then 'prod_VGURINssZA7e4K' end))) then
    raise exception 'Billing is enabled or a different product is already assigned. Review before changing it.';
  end if;
end $$;

update public.wrxs_price_catalog
set stripe_product_id = case billing_interval
  when 'month' then 'prod_VGUQxjX7HY1nZM'
  when 'year' then 'prod_VGURINssZA7e4K'
end
where plan_key = 'standard';

commit;

select billing_interval, currency, amount_cents,
       stripe_product_id, stripe_price_id, checkout_enabled
from public.wrxs_price_catalog
where plan_key = 'standard'
order by amount_cents;
