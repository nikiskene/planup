import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const db=new PGlite();
try {
 await db.exec(fs.readFileSync(path.join(here,'baseline.sql'),'utf8'));
 let views=JSON.parse(fs.readFileSync(path.join(here,'views.json'),'utf8'));
 for(let round=0;views.length && round<10;round++){
  const pending=[];
  for(const v of views){try{await db.exec(`create view public.${v.relname} with(security_invoker=true) as ${v.definition}`);await db.exec(`grant select on public.${v.relname} to authenticated`);}catch(e){console.log(v.relname,e.message);pending.push(v)}}
  if(pending.length===views.length)throw new Error('View dependencies unresolved: '+pending.map(v=>v.relname));views=pending;
 }
 console.log('Live-schema reconstruction loaded');
 const dir=path.resolve(here,'..')+path.sep;
 for(const file of ['01_account_security.sql','02_workspace_links.sql','03_subscription_email_foundation.sql']){await db.exec(fs.readFileSync(dir+file,'utf8'));console.log(file,'PASS');}
 await db.exec(fs.readFileSync(path.join(here,'tests.sql'),'utf8'));
 console.log('Behavioral checks PASS');
 for(const file of ['01_account_security.sql','02_workspace_links.sql']){await db.exec(fs.readFileSync(dir+file,'utf8'));console.log(file,'rerun PASS');}
 await db.exec(fs.readFileSync(dir+'04_verify.sql','utf8'));console.log('04_verify.sql PASS');
 for (let run=0;run<2;run++) await db.exec(fs.readFileSync(dir+'05_stripe_products.sql','utf8'));
 const products=await db.query('select billing_interval, stripe_product_id, stripe_price_id, checkout_enabled from public.wrxs_price_catalog order by amount_cents');
 if(products.rows.length!==2 || products.rows[0].stripe_product_id!=='prod_VGUQxjX7HY1nZM' || products.rows[1].stripe_product_id!=='prod_VGURINssZA7e4K' || products.rows.some(row=>row.checkout_enabled || row.stripe_price_id)) throw new Error('Product registration or inactive billing check failed');
 console.log('05_stripe_products.sql and rerun PASS; billing remains inactive');
 const priceSql=fs.readFileSync(dir+'06_stripe_prices.sql','utf8');
 for(let run=0;run<2;run++) await db.exec(priceSql);
 const prices=await db.query('select stripe_price_id, checkout_enabled from public.wrxs_price_catalog order by amount_cents');
 if(prices.rows.length!==2 || prices.rows[0].stripe_price_id!=='price_1UFxRwEQ9WPDgXa98gQsm56L' || prices.rows[1].stripe_price_id!=='price_1UFxSXEQ9WPDgXa964oecX66' || prices.rows.some(row=>row.checkout_enabled)) throw new Error('Price mapping or inactive checkout check failed');
 await db.exec("update public.wrxs_price_catalog set stripe_price_id='price_existing_other' where billing_interval='month'");
 let rejected=false;
 try { await db.exec(priceSql); } catch { rejected=true; await db.exec('rollback'); }
 if(!rejected) throw new Error('Conflicting price was not rejected');
 const preserved=await db.query("select stripe_price_id from public.wrxs_price_catalog where billing_interval='month'");
 if(preserved.rows[0].stripe_price_id!=='price_existing_other') throw new Error('Conflicting price was overwritten');
 await db.exec("update public.wrxs_price_catalog set stripe_price_id='price_1UFxRwEQ9WPDgXa98gQsm56L' where billing_interval='month'");
 console.log('06_stripe_prices.sql, rerun, and conflicting-price protection PASS');
 for(let run=0;run<2;run++) await db.exec(fs.readFileSync(dir+'07_billing_runtime.sql','utf8'));
 await db.exec(fs.readFileSync(path.join(here,'billing.sql'),'utf8'));
 console.log('07_billing_runtime.sql, rerun, and billing authorization/lease checks PASS');
 await db.exec("insert into auth.users(id,email,email_confirmed_at) values('f631a75e-e681-4188-ae63-756449d0dceb','niki@example.test',now()); insert into public.profiles(id,email) values('f631a75e-e681-4188-ae63-756449d0dceb','niki@example.test'); insert into public.workspaces(id,name,created_by) values('ed0d87eb-2ec0-4ca8-8e2d-92d65b305c4f','Niki Skene','f631a75e-e681-4188-ae63-756449d0dceb'); insert into public.workspace_members(workspace_id,user_id,role,only_shopping,shopping_only) values('ed0d87eb-2ec0-4ca8-8e2d-92d65b305c4f','f631a75e-e681-4188-ae63-756449d0dceb','admin',false,false);");
 for(let run=0;run<2;run++) await db.exec(fs.readFileSync(dir+'08_niki_founder_access.sql','utf8'));
 await db.exec("set role authenticated; select set_config('request.jwt.claim.sub','f631a75e-e681-4188-ae63-756449d0dceb',false); do $$ begin if not public.wrxs_has_active_access('ed0d87eb-2ec0-4ca8-8e2d-92d65b305c4f') then raise exception 'Founder did not have permanent access'; end if; end $$; reset role;");
 const founder=await db.query("select count(*)::int as count, bool_and(expires_at is null) as permanent from public.wrxs_access_grants where workspace_id='ed0d87eb-2ec0-4ca8-8e2d-92d65b305c4f' and reason='founder'");
 if(founder.rows[0].count!==1 || !founder.rows[0].permanent) throw new Error('Founder grant was not permanent or rerunnable');
 console.log('08_niki_founder_access.sql and rerun PASS');
 await db.exec(fs.readFileSync(dir+'09_enable_checkout.sql','utf8'));
 const enabled=await db.query('select count(*)::int as count from public.wrxs_price_catalog where plan_key=\'standard\' and checkout_enabled');
 if(enabled.rows[0].count!==2) throw new Error('Checkout activation did not enable both approved plans');
 console.log('09_enable_checkout.sql PASS');
 await db.exec(fs.readFileSync(dir+'10_workspace_email_capture.sql','utf8'));
 const routes=await db.query("select domain, enabled, column_default from public.wrxs_email_routes join information_schema.columns on table_schema='public' and table_name='wrxs_email_routes' and column_name='local_part' limit 1");
 if(routes.rows[0].domain!=='wrxs.cc' || routes.rows[0].enabled || routes.rows[0].column_default!==null) throw new Error('Email capture route migration did not preserve its inactive, explicit-alias boundary');
 await db.exec(fs.readFileSync(dir+'10_workspace_email_capture_verify.sql','utf8'));
 console.log('10_workspace_email_capture.sql and verification PASS');

} catch(e){ console.error(e.message); if(e.query)console.error(e.query.slice(-1800));process.exitCode=1;}finally{await db.close();}
