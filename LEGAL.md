# Legal & compliance notes (maintainers)

**Not legal advice.** This file helps align the open-source **learning / research demo** with GitHub Acceptable Use and **U.S. / Iowa-oriented** policy themes. Consult Iowa-licensed counsel before any commercial go-to-market.

## Project purpose (học tập & nghiên cứu)

- Built and published primarily for **education and research**: studying realtime web stacks, game-loop design, staff/admin tooling, and how ToS/Privacy copy is structured.
- The public GitHub repo is a **fictional demo codebase**—for classroom review, self-study, and portfolio—**not** a turnkey gambling business.
- Intended repo uses: read code, run locally, open issues about engineering, suggest docs fixes.
- **Not** intended: stealing the codebase for illicit services, operating unlicensed real-money gambling, harvesting player PII into Git, or marketing “win real cash.”
- Abuse of GitHub copies (strip notices, impersonate authors, deploy for crime) may be reported under copyright / DMCA / GitHub AUP — see TERMS §§5–7.

## What this product is

- A **realtime web entertainment / study demo** (tarot-style / wheel / oracle UI).
- In-app balance uses **virtual points (“xu”)** with **no cash value** and **no cash-out**.
- There is **no** Stripe/PayPal/crypto deposit, **no** real-money withdrawal, **no** fiat cashout.

## GitHub Acceptable Use (checklist)

| Topic | Status in this repo |
|-------|---------------------|
| Malware / exploit kits | Not present — game + staff tools only |
| Stolen IP / cracks / keygens | Not present |
| Leaked PII dumps | Not present — do **not** commit `server/data/*.json` or `.env` |
| Real-money entertainment service | **Not designed as such** — educational demo; see TERMS / README |

Keep the repository **free of production secrets** and player data dumps.

## US-oriented themes (operator / student responsibility)

### A. Gambling / UIGEA / Iowa

UIGEA (31 U.S.C. §§ 5361–5367) and Iowa gambling statutes focus on **real-money** (or value) wagering and unlicensed offerings. Positioning this app as a **virtual-currency learning demo without cash-in/out** reduces that surface, but:

- Do **not** market cash prizes, fiat deposits, or “win real money”.
- Do **not** offer the service as licensed US / Iowa gambling unless you actually are licensed.
- **Iowa residents:** keep product copy consistent with non-gambling entertainment / study demo.
- Operators targeting other countries must follow **local** law separately.

### B. Export / OFAC

Standard web TLS and Node `crypto` for passwords/RNG are ordinary. Do not knowingly serve sanctioned parties if that applies to your deployment.

### C. Privacy (COPPA / CCPA / Iowa ICDPA)

- Publish **Privacy Policy** (`/privacy`, `PRIVACY.md`) and **Terms** (`/terms`, `TERMS.md`) — include educational purpose (§0), Iowa governing law, and consumer rights notices.
- **18+** gate on register / guest; do not target children.

### D. Consumer protection (Iowa)

Avoid deceptive claims about converting xu to money. Keep ComplianceGate + TERMS aligned with “xu = virtual only” and “học tập / nghiên cứu.”

### E. Fintech / crypto

No securities offering, money transmitter flow, or crypto token sale in this codebase.

### F. DMCA

Publish an operator contact for copyright notices (see TERMS).

## Naming note (source code)

**User-facing copy** uses entertainment / study language: đặt xu / ván / kết toán — not “casino / nhà cái.”

**Internal identifiers** may use stake vocabulary (`stakeStore`, `placeStake`, etc.) for engineering clarity only.

## Must-dos before any public / class demo

1. Keep README / TERMS / PRIVACY clear that this is **learning & research**.
2. Never commit `server/data/*.json`, tokens, or seed passwords.
3. If you add **real money**, stop and get legal + licensing review first (Iowa + federal).
4. Prefer a **private** repo if a live instance holds personal data at scale.

## Related paths

- [`TERMS.md`](./TERMS.md) · [`PRIVACY.md`](./PRIVACY.md) · [`README.md`](./README.md)
- In-app: `/terms`, `/privacy`