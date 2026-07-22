# Legal & compliance notes (maintainers)

**Not legal advice.** This file helps operators align the open-source demo with GitHub Acceptable Use and common US policy themes. Consult counsel for your jurisdiction and go-to-market.

## What this product is

- A **realtime web entertainment demo** (tarot-style / wheel UI).
- In-app balance uses **virtual points (“xu”)** with **no cash value**.
- There is **no** Stripe/PayPal/crypto deposit, **no** real-money withdrawal, **no** fiat cashout.

## GitHub Acceptable Use (checklist)

| Topic | Status in this repo |
|-------|---------------------|
| Malware / exploit kits | Not present — game + staff tools only |
| Stolen IP / cracks / keygens | Not present |
| Leaked PII dumps | Not present — do **not** commit `server/data/*.json` or `.env` |
| Real-money gambling service | **Not designed as such** — see TERMS / README |

Keep the repository **free of production secrets** and player data dumps.

## US-oriented themes (operator responsibility)

### A. Gambling / betting

UIGEA/PASPA and state gambling laws focus on **real-money** wagering and unlicensed offerings. Positioning this app as **virtual-currency entertainment** reduces that surface, but:

- Do **not** market cash prizes, fiat deposits, or “win real money”.
- Do **not** offer the service as licensed US gambling unless you actually are licensed.
- Operators targeting specific countries must follow **local** law (VN, etc.) separately.

### B. Export / OFAC

Standard web TLS and Node `crypto` for passwords/RNG are ordinary. Do not knowingly serve sanctioned parties if that applies to your deployment. Geo-blocking is an **operator** policy choice, not shipped by default.

### C. Privacy (CCPA-style / COPPA)

- We may process **IP**, device/session ids, usernames, and gameplay logs for anti-abuse and ops.
- Publish **Privacy Policy** (`/privacy`, `PRIVACY.md`) and **Terms** (`/terms`, `TERMS.md`).
- **18+** gate on register / guest — not a substitute for parental consent systems under COPPA; do not target children.

### D. Fintech / crypto

No securities offering, money transmitter flow, or crypto token sale in this codebase.

## Naming note (source code)

Internal identifiers may still use `bet` / `stake` (e.g. `betStore`, socket events). In this product those mean **virtual xu stakes for entertainment**, not real-money wagers. User-facing copy prefers “đặt xu / ván / kết toán”. Do not rename storage keys casually — it breaks persisted JSON.

## Operator must-dos before public launch

1. Keep README / TERMS / PRIVACY accurate if you change monetization.
2. Never commit `server/data/*.json`, tokens, or seed passwords.
3. If you add **real money**, stop and get legal + licensing review first.
4. Prefer a **private** GitHub repo if the live product holds personal data at scale.

## Related paths

- [`TERMS.md`](./TERMS.md) · [`PRIVACY.md`](./PRIVACY.md) · [`README.md`](./README.md)
- In-app: `/terms`, `/privacy`
- Security ops notes (local): `cybersecurity/`
