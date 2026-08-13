# Legal & compliance notes (maintainers)

**Not legal advice.** Internal checklist for operators aligning product copy with **United States** federal themes and common state consumer/privacy patterns. Consult U.S.-licensed counsel before any commercial go-to-market. Keep this file **out of player-facing UI**; do not link personal accounts, private repos, or staff identities from `/terms` or `/privacy`.

## Product positioning

- User-facing copy: **virtual entertainment** with **xu = no cash value / no cash-out**.
- **Not** a turnkey gambling business; **not** licensed casino / sportsbook / money transmitter.
- **Not** intended: operating unlicensed real-money gambling, harvesting player PII into public repos, or marketing “win real cash.”
- Abuse of copies (strip notices, impersonate operator, deploy for crime) may be reported under copyright / DMCA — see TERMS.

## What this product is

- A **realtime web entertainment** app (tarot-style / wheel / oracle UI and related modules).
- In-app balance uses **virtual points (“xu”)** with **no cash value** and **no cash-out**.
- There is **no** Stripe/PayPal/crypto deposit, **no** real-money withdrawal, **no** fiat cashout.

## Public source / ops hygiene

| Topic | Guidance |
|-------|----------|
| Secrets / PII | Never commit `be/data/*.json`, `.env`, tokens, or player dumps |
| Player-facing legal | `/terms` · `/privacy` — no personal GitHub links, no staff names, no hosting vendor brand unless required |
| Contact | In-app Feedback / support only for end users |
| Infrastructure | Prefer generic “hosting provider” wording in Privacy |
| Jurisdiction | Default ToS: **United States** (federal) + arbitration / class waiver; do not hard-code a single state unless counsel chooses one |

Keep production systems **free of public secret leaks**.

## US-oriented themes (operator responsibility)

### A. Gambling / UIGEA / state law

UIGEA (31 U.S.C. §§ 5361–5367) and state gambling statutes focus on **real-money** (or value) wagering and unlicensed offerings. Positioning this app as **virtual-currency entertainment without cash-in/out** reduces that surface, but:

- Do **not** market cash prizes, fiat deposits, or “win real money”.
- Do **not** offer the service as licensed U.S. gambling unless you actually are licensed.
- Keep product copy consistent with non-gambling entertainment nationwide.
- Operators targeting other countries must follow **local** law separately.

### B. Export / OFAC

Standard web TLS and Node `crypto` for passwords/RNG are ordinary. Do not knowingly serve sanctioned parties if that applies to your deployment.

### C. Privacy (COPPA / CCPA / state privacy acts)

- Publish **Privacy Policy** (`/privacy`, `PRIVACY.md`) and **Terms** (`/terms`, `TERMS.md`) — U.S. governing law, CCPA notice, and multi-state rights language.
- **18+** gate on register / guest; do not target children.
- Minimize identifying operator details in public legal pages.

### D. Consumer protection (U.S.)

Avoid deceptive claims about converting xu to money (FTC Act themes + state UDAP/UDAAP analogs). Keep ComplianceGate + TERMS aligned with “xu = virtual only.”

### E. Contracts / disputes

TERMS include: E-SIGN acceptance, IP/DMCA, suspension, indemnity, liability cap, **FAA arbitration**, class waiver, force majeure, assignment, survival. Counsel should confirm arbitration provider rules and any state-specific consumer carve-outs before relying on them in a live commercial product.

### F. Fintech / crypto

No securities offering, money transmitter flow, or crypto token sale in this codebase.

### G. DMCA

Publish an operator contact for copyright notices via in-app Feedback (see TERMS).

## Naming note (source code)

**User-facing copy** uses entertainment language: đặt xu / ván / kết toán — not “casino / nhà cái.”

**Internal identifiers** may use stake vocabulary (`stakeStore`, `placeStake`, etc.) for engineering clarity only.

## Must-dos before any public launch

1. Keep TERMS / PRIVACY clear that xu are **virtual only**.
2. Never commit `be/data/*.json`, tokens, or seed passwords.
3. If you add **real money**, stop and get legal + licensing review first (U.S. federal + applicable states).
4. Prefer a **private** repo if a live instance holds personal data at scale.
5. Strip personal GitHub / domain / vendor identifiers from player-facing legal UI.
6. Confirm arbitration / class-waiver language with counsel for your entity.

## Related paths

- [`TERMS.md`](./TERMS.md) · [`PRIVACY.md`](./PRIVACY.md) · [`RESPONSIBLE.md`](./RESPONSIBLE.md)
- In-app: `/terms`, `/privacy`, `/responsible`
- **Overlapping shield map:** [`docs/LEGAL_SHIELD.md`](./docs/LEGAL_SHIELD.md)
- **GitHub up / không up:** [`docs/GITHUB_UPLOAD.md`](./docs/GITHUB_UPLOAD.md)
- **Transparency filter:** [`docs/TRANSPARENCY_FILTER.md`](./docs/TRANSPARENCY_FILTER.md)
- **Study guide:** [`docs/study-us-compliance.md`](./docs/study-us-compliance.md)
