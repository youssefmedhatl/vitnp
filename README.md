# Vitality — customer storefront

The public-facing shop: browse, cart, checkout, order tracking, and customer
account pages. This is one half of a two-app split — the other half,
`vitality-admin`, is the staff dashboard. They are **fully independent apps**
that both talk to the **same Supabase project**, so anything a customer buys
here shows up in the admin panel's Orders page.

Cash only by design — there is no card processor. Money moves two ways:
`cash` (paid at the counter or on pickup) and `cash_on_delivery` (collected
by the courier).

---

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:5173

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (port 5173) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript check, no emit — run this before trusting anything "looks fine" |

If `npm install` complains about peer dependencies, use:
```bash
npm install --legacy-peer-deps
```

---

## The database is already connected

`.env` already points at the live Supabase project. Nothing else to
configure:

```
VITE_SUPABASE_URL=https://xsfpfukhuvsurtfqbhup.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

The anon/publishable key is **meant** to be visible in the browser. Every
table is protected by Row Level Security, so the key alone grants nothing
beyond the public catalogue. **Never put a `service_role` key in `.env`.**

This app and `vitality-admin` share the exact same database — run both at
once (they use different ports) to see products added or restocked in the
admin panel appear here immediately.

---

## What's in here

- `src/storefront/` — every page a customer sees: home, catalog, product
  detail, cart, checkout, order confirmation, order tracking, and the
  account area (orders, profile, addresses, loyalty, wishlist)
- `src/lib/` — Supabase client, auth, i18n (EN/AR with RTL), money
  formatting, shared query setup
- `src/components/` — shared UI primitives (buttons, inputs, etc.)

There is no admin code in this project at all — it was intentionally
removed. If you need the staff dashboard, that's the separate
`vitality-admin` app.
