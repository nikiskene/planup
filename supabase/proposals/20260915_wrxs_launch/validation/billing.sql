-- Local synthetic fixtures only. Never run this file in production.
set role authenticated;
do $$ begin
  begin
    perform public.wrxs_billing_lock('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
    raise exception 'Browser can acquire service billing lock';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare a jsonb; t uuid; rejected boolean; begin
  rejected:=false;
  begin
    perform public.wrxs_billing_lock('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
  exception when others then rejected:=true; end;
  if not rejected then raise exception 'Unrelated user acquired billing lock'; end if;
  a:=public.wrxs_billing_lock('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
  t:=(a->>'operation_token')::uuid;
  rejected:=false;
  begin perform public.wrxs_billing_lock('20000000-0000-0000-0000-000000000001',null); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Concurrent billing lock permitted'; end if;
  perform public.wrxs_billing_save('20000000-0000-0000-0000-000000000001',t,'{"stripe_customer_id":"cus_fixture"}');
  rejected:=false;
  begin perform public.wrxs_billing_save('20000000-0000-0000-0000-000000000001',t,'{"stripe_customer_id":"cus_other"}'); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Customer identity changed'; end if;
  perform public.wrxs_billing_unlock('20000000-0000-0000-0000-000000000001',t);
  rejected:=false;
  begin perform public.wrxs_billing_save('20000000-0000-0000-0000-000000000001',t,'{}'); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Expired billing lock accepted'; end if;
end $$;
