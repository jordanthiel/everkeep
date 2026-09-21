# Everkeep Stripe license worker

Mints an Ed25519 `license.ekey` after a successful Stripe Payment Link checkout.

## Setup

1. Create a **one-time $79** Stripe product and Payment Link.
2. Set the Payment Link success URL to:

   `https://YOUR_SITE/buy/success?session_id={CHECKOUT_SESSION_ID}`

3. Enable **Stripe Tax** on the Payment Link if you need automatic tax collection (you are seller of record).
4. Create a Cloudflare KV namespace and put its id in `wrangler.toml`.
5. Generate an Ed25519 keypair (32-byte seed + public key, base64url). Put the **private** key in worker secrets and the **public** key in the Electron app as `LICENSE_PUBLIC_KEY`.
6. Create a Stripe webhook endpoint pointing at `https://YOUR_WORKER/webhooks/stripe` for `checkout.session.completed`.
7. Set secrets:

```bash
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put LICENSE_PRIVATE_KEY
npx wrangler secret put RESEND_API_KEY   # optional but recommended
```

Optional vars in `wrangler.toml`:

- `FROM_EMAIL` — Resend from-address
- `ALLOWED_ORIGIN` — website origin for CORS on `GET /license`

## Endpoints

- `POST /webhooks/stripe` — Stripe webhook (signature required)
- `GET /license?session_id=cs_...` — returns minted key for the success page
- `GET /health` — liveness

## Local note

The committed Electron public key matches the development private key in `tests/fixtures/license-keys.ts`. Do **not** use that private key in production.
