# Everkeep Stripe webhook compatibility proxy

Purchases now belong to a verified email account. New deployments should send Stripe events directly to the Supabase function documented in [Supabase setup](../../supabase/README.md#email-based-lifetime-purchases).

This worker keeps an existing `/webhooks/stripe` URL usable while migrating. Set `BILLING_SERVICE_URL` to `https://PROJECT_REF.supabase.co/functions/v1/sharing/api/billing/webhook`. It forwards the unchanged body and signature. The Supabase `STRIPE_WEBHOOK_SECRET` must match the **original Stripe endpoint's** signing secret when using this proxy. Do not configure two differently signed endpoints against the same secret.

`GET /license` now returns 410 with email sign-in instructions. The worker no longer mints or emails keys. Do not delete historical KV data until historical purchases have been reconciled with Stripe and imported/replayed into account billing. Existing signed license files remain recognized by the app for the matching verified email.

For migration, apply the billing SQL migration, configure Stripe credentials, deploy the sharing function, verify a test purchase and restore, then update Stripe's webhook destination or deploy this compatibility proxy. Only then publish the website and app changes. No production deployment is performed by these files.
