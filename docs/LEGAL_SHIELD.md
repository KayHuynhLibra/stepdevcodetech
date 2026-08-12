# Legal Shield — overlapping controls (operators / AI-assisted foundation)

**Not legal advice. Not a law firm opinion.**  
This is an **engineering + policy scaffold** (2026-style defense-in-depth): many thin layers that reduce the chance a single mis-copy, fork, or feature creep creates future exposure. Use it to brief counsel; do **not** treat it as a substitute for a U.S.-licensed attorney when you incorporate, take payments, or expand markets.

---

## Design goal

| Goal | How this repo approaches it |
|------|------------------------------|
| Avoid “real-money gambling” characterization | Virtual xu only · no cash-in/out · UIGEA-aware copy |
| Avoid deceptive-consumer claims | Ban “win cash / redeem xu” marketing · FTC-style themes in TERMS |
| Avoid under-13 / teen product risk | 18+ gate · COPPA language · no directed-to-children design |
| Avoid privacy blow-ups | No card data · no sale · CCPA + multi-state rights · Feedback workflow |
| Avoid IP / clone abuse | NOTICE · TERMS IP/DMCA · no public staff/GitHub identity on legal pages |
| Avoid dispute chaos | Informal 30d → FAA arbitration → class waiver → U.S. venue |
| Survive feature creep | Kill-switch / regulatory-change clause · no vested rights in xu |
| Survive partial invalidation | Severability · mandatory rights carve-outs · layered disclaimers |

---

## Layer map (read top → bottom)

```
L1  Product characterization     TERMS §1 · UI complianceCopy · /responsible
L2  Capacity & acceptance        TERMS §0 · ComplianceGate · termsAcceptedAt
L3  Virtual goods license        TERMS §1, §4 · non-refundable · revocable
L4  Consumer / advertising       TERMS §5, §13 · marketing bans
L5  Privacy & kids               PRIVACY · COPPA · CCPA · no payment PII
L6  IP & anti-theft              TERMS §5, §8 · NOTICE · DMCA
L7  UGC / platform tools         TERMS §5–6 · CDA §230-style positioning · mod tools
L8  Unauthorized access          TERMS §5 · CFAA-aware acceptable use
L9  Risk allocation              TERMS §10–12 · assumption of risk · indemnity
L10 Disputes                     TERMS §14 · arbitration · class waiver
L11 Sanctions / export           TERMS §15
L12 Ops continuity               force majeure · assignment · kill-switch §17+
L13 Evidence trail               E-SIGN · localStorage ack · server termsAcceptedAt
```

If **any one layer fails** (e.g. a marketing line says “rút tiền”), other layers still document intent—but **fix the failing layer immediately**. Overlap is not a license to break L1.

---

## Hard red lines (do not cross without counsel)

1. Selling xu for USD/crypto, or redeeming xu for cash/gift cards/goods of value.  
2. Advertising real-money prizes, “investment,” or guaranteed income from play.  
3. Targeting or knowingly serving under-18 (or under-13) users.  
4. Collecting SSN / government ID / payment cards without a rewritten Privacy Policy + PCI program.  
5. Publishing player dumps, tokens, or `.env` publicly.  
6. Claiming this shield “makes gambling legal.”

---

## Document matrix

| Public / player | Maintainer / study |
|-----------------|--------------------|
| `/terms` ← `TERMS.md` | `LEGAL.md` |
| `/privacy` ← `PRIVACY.md` | `docs/study-us-compliance.md` |
| `/responsible` | **this file** `docs/LEGAL_SHIELD.md` |
| UI: `complianceCopy.ts`, footer, ComplianceGate | `NOTICE.md` |

Language note: Vietnamese UI pages are a **convenience translation**. If conflict, English `TERMS.md` / `PRIVACY.md` control unless mandatory local consumer law says otherwise (see TERMS language clause).

---

## Future-proofing checklist (re-run every release)

```
[ ] User-facing copy still says xu = virtual only (no cash redeem)
[ ] No new payment / gift-card / crypto cashout path without counsel
[ ] /terms /privacy /responsible reachable & dated
[ ] ComplianceGate + termsAcceptedAt still fire for register/guest
[ ] Footer / rules sheets still carry virtual-play one-liner
[ ] Privacy still lists actual data categories (update if new fields)
[ ] No personal GitHub / staff phone / home address on legal pages
[ ] If adding voice/video: disclosure + retention in Privacy + Terms UGC
[ ] If targeting EEA/UK: add GDPR addendum BEFORE ads/geo-target
[ ] Bump sofiaore_terms_ok_vN when Terms material change
```

---

## What AI (2026) can and cannot do here

**Can:** Draft overlapping contract/privacy patterns, keep product copy consistent, maintain checklists, flag drift (e.g. “casino” in UI).  
**Cannot:** Create attorney–client privilege, bind a court, guarantee enforceability of arbitration/class waivers in every U.S. state, or replace entity formation / gaming licenses.

When in doubt: **stop shipping the risky feature** and ask U.S. counsel.
