-- FINAL ACTIVATION: run manually only after Stripe secret, webhook and portal setup.
-- Enables the two exact wrxs plans. Existing workspace access is unchanged.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.wrxs_price_catalog in share row exclusive mode;

do $$
begin
  if (select count(*) from public.wrxs_price_catalog
      where plan_key = 'standard' and currency = 'usd'
        and ((billing_interval = 'month' and amount_cents = 400
              and stripe_product_id = 'prod_VGUQxjX7HY1nZM'
              and stripe_price_id = 'price_1UFxRwEQ9WPDgXa98gQsm56L')
          or (billing_interval = 'year' and amount_cents = 4000
              and stripe_product_id = 'prod_VGURINssZA7e4K'
              and stripe_price_id = 'price_1UFxSXEQ9WPDgXa964oecX66'))) <> 2 then
    raise exception 'The approved Stripe product/price catalog does not match. Checkout remains disabled.';
  end if;

  if exists(select 1 from public.wrxs_price_catalog
      where plan_key = 'standard' and checkout_enabled
        and billing_interval not in ('month','year')) then
    raise exception 'Unexpected enabled plan found. Review before activation.';
  end if;
end $$;

update public.wrxs_price_catalog
set checkout_enabled = true
where plan_key = 'standard'
  and billing_interval in ('month','year');

commit;

select billing_interval, currency, amount_cents, stripe_product_id,
       stripe_price_id, checkout_enabled
from public.wrxs_price_catalog
where plan_key = 'standard'
order by amount_cents;
