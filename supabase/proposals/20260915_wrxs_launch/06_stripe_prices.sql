-- Run manually after 05_stripe_products.sql. This records IDs; it does not activate checkout.
-- Amounts and products are checked locally. Stripe-side configuration must still be verified.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.wrxs_price_catalog in share row exclusive mode;

do $$
begin
  if (select count(*) from public.wrxs_price_catalog
      where plan_key = 'standard' and currency = 'usd'
        and ((billing_interval = 'month' and amount_cents = 400
              and stripe_product_id = 'prod_VGUQxjX7HY1nZM')
          or (billing_interval = 'year' and amount_cents = 4000
              and stripe_product_id = 'prod_VGURINssZA7e4K'))) <> 2 then
    raise exception 'Expected USD 4 monthly and USD 40 annual products. Run and verify stage 05 first.';
  end if;
  if exists (select 1 from public.wrxs_price_catalog
      where plan_key = 'standard' and (checkout_enabled or
        (stripe_price_id is not null and stripe_price_id <> case billing_interval
          when 'month' then 'price_1UFxRwEQ9WPDgXa98gQsm56L'
          when 'year' then 'price_1UFxSXEQ9WPDgXa964oecX66' end))) then
    raise exception 'Checkout is enabled or a different price is assigned. Review before changing it.';
  end if;
end $$;

update public.wrxs_price_catalog
set stripe_price_id = case billing_interval
  when 'month' then 'price_1UFxRwEQ9WPDgXa98gQsm56L'
  when 'year' then 'price_1UFxSXEQ9WPDgXa964oecX66'
end
where plan_key = 'standard';

commit;

select billing_interval, currency, amount_cents,
       stripe_product_id, stripe_price_id, checkout_enabled
from public.wrxs_price_catalog
where plan_key = 'standard'
order by amount_cents;
