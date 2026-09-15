import { createBilling } from '../_shared/billing.ts';
import { configuration } from '../_shared/config.ts';
Deno.serve(createBilling(configuration()).webhook);
