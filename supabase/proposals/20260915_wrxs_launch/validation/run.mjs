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
} catch(e){ console.error(e.message); if(e.query)console.error(e.query.slice(-1800));process.exitCode=1;}finally{await db.close();}
