# Supplier Cert Alerts

Phase 1 wedge of a supplier-risk suite: **never miss a certificate expiry**.

## Quick start
```bash
npm install
cp .env.example .env.local
psql $DATABASE_URL -f db/migrations.sql
npm run dev
```

## Lemon Squeezy setup
1. Get API key + Store ID from https://app.lemonsqueezy.com/settings/api
2. Create products (Core, Full Suite) and copy variant IDs
3. Set webhook URL to `https://yourdomain.com/api/webhooks/lemonsqueezy` with secret
4. Fill in `.env.local`: `LEMON_SQUEEZY_API_KEY`, `LEMON_SQUEEZY_STORE_ID`, `LEMON_SQUEEZY_WEBHOOK_SECRET`, `LEMON_PRODUCT_CORE`, `LEMON_PRODUCT_FULL_SUITE`

## Deploy to Cloudflare Workers
```bash
npx wrangler r2 bucket create supplier-cert-uploads
npx wrangler hyperdrive create supplier-certs-db --connection-string="..."
npm run build:worker && npm run deploy
```
