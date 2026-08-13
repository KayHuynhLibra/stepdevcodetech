# Privacy Policy

**Last updated:** 2026-08-12  
**Primary notice jurisdiction:** United States of America  
**Shield:** Overlaps with Terms layers L2/L5/L7 — see [`docs/LEGAL_SHIELD.md`](./docs/LEGAL_SHIELD.md)

> **Canonical English source (GitHub / repository root).**  
> This Markdown file is the **authoritative English Privacy Policy**. The in-app route `/privacy` is a **separate bilingual convenience summary** — not a copy of this document. If conflict: **this file controls**, except where mandatory law requires otherwise.

**This is not legal advice.** Describes data practices for the SOFIA / Tarot-style entertainment Service as offered by the Operator. Production player data stays on the Operator’s systems—**never** in public source control or public issue trackers.

This Policy is incorporated into the [Terms of Service](./TERMS.md). Capitalized terms have the meanings in the Terms unless defined here.

**Language:** Vietnamese in-app text is a convenience translation. If conflict, this English Privacy Policy controls except where mandatory law requires otherwise.

## Table of contents

| # | Section |
|---|---------|
| 1 | [Who we are / controller](#1-who-we-are--controller) |
| 2 | [Scope](#2-scope) |
| 3 | [Categories of personal information we process](#3-categories-of-personal-information-we-process) |
| 4 | [How we use information](#4-how-we-use-information) |
| 5 | [Cookies / local storage / similar technologies](#5-cookies--local-storage--similar-technologies) |
| 6 | [Children (COPPA)](#6-children-coppa) |
| 7 | [Sharing / disclosure](#7-sharing--disclosure) |
| 8 | [Retention](#8-retention) |
| 9 | [Security](#9-security) |
| 10 | [Your choices & U.S. privacy rights](#10-your-choices--us-privacy-rights) |
| 11 | [International users](#11-international-users) |
| 12 | [No real-money payment data · feature-creep lock](#12-no-real-money-payment-data--feature-creep-lock) |
| 13 | [Changes](#13-changes) |
| 14 | [Contact](#14-contact) |

**Related:** [`TERMS.md`](./TERMS.md) · [`RESPONSIBLE.md`](./RESPONSIBLE.md)

---

## 1. Who we are / controller

The Service is operated by the deployer of the live application (the “**Operator**,” “**we**,” “**us**”).  

**U.S. privacy contact:** Use the live site’s published support / Feedback channel for privacy requests (access, deletion, correction, and other rights described below). We may need to verify your identity before fulfilling a request.

---

## 2. Scope

This Policy covers personal information processed when you visit, register for, play (including as a guest), or otherwise use the Service. It does **not** cover third-party websites or services we do not control.

---

## 3. Categories of personal information we process

| Category | Examples | Purpose | Typical legal-style basis (U.S. ops) |
|----------|----------|---------|--------------------------------------|
| Account identifiers | Username, password hash, optional nickname/avatar, role | Auth, profile, gameplay | Provide the Service; security |
| Session / device | Auth tokens, device/session ids | Login, anti-abuse | Security; fraud prevention |
| Gameplay & social | Round/spin/oracle history, balances (xu), chat, gifts metadata | Operation, moderation | Provide the Service |
| Network / abuse | IP address, coarse geo/ISP lookups (staff tools), guest–IP binding | Rate limits, multi-account control | Security; legitimate ops interest |
| Support / ops | Feedback tickets, reports, admin audit actions | Security and support | Security; compliance |
| Compliance acknowledgements | Age / Terms acceptance flags (localStorage and/or server `termsAcceptedAt`) | Legal compliance · evidence of Agreement | Legal obligation / contract |
| Safety / voice (if enabled) | Voice-room metadata, moderation flags, limited session logs | Abuse prevention · Terms enforcement | Security; provide the Service |
| Live video (if you opt in) | Webcam/mic streams in a voice room; device labels in the browser | Real-time P2P to other seated users only | Provide Live; you must opt in per session |

We do **not** intentionally collect government ID, Social Security numbers, payment card numbers, or crypto wallet keys in this product as offered.

**Live video / voice (WebRTC):** If you enable camera or microphone in a Live/voice room, audio/video is sent **peer-to-peer** to other users currently seated in that room. The Operator’s servers perform **signaling and room state only** and do **not** record, store, or transcribe those media streams in the base product. Other users can see/hear you while your cam/mic is on. Do not record, screenshot, or redistribute others’ Live without their consent and applicable law. Turning cam off, leaving the seat, or the host switching the room to Voice stops your outbound video. Metadata (who sat where, Live vs Voice mode, moderation actions) may be logged as described above.

**Sensitive data:** Do not submit health information, precise geolocation beyond IP coarse lookup, biometric identifiers, or contents of private communications unrelated to gameplay support. The Service is not designed for those categories.

**No sale / no targeted ads (base product):** We do not sell personal information and do not operate third-party cross-context behavioral advertising in the base product.

---

## 4. How we use information

We use personal information to:

- Provide, operate, secure, and improve the Service;  
- Authenticate users, prevent fraud, multi-accounting, and abuse;  
- Moderate chat, enforce Terms, and respond to Feedback;  
- Comply with law, respond to lawful requests, and protect rights and safety;  
- Maintain backups and continuity of operations.

We do **not** use gameplay xu outcomes as a real-money payment history because xu have no cash value.

**Automated processing:** We may use automated rules/scoring for rate limits, multi-account detection, spam filters, and fraud signals. These are security/operations controls—not consumer credit, employment, housing, or insurance decisions. Where required by applicable state law, you may request human review of a significant automated decision about your account access via Feedback.


---

## 5. Cookies / local storage / similar technologies

The browser may store tokens, UI preferences, guest codes, and age/Terms acknowledgements in **localStorage** or similar storage. Clearing site data logs you out of guest/session state. These are primarily **strictly necessary** or functional technologies—not third-party advertising pixels in the base product.

**Do Not Track:** There is no uniform industry standard for DNT browser signals. The Service does not currently respond to DNT signals in a differentiated way beyond the practices described here.

---

## 6. Children (COPPA)

The Service is for users **18+** and is **not directed to children under 13**. We do not knowingly collect personal information from children under 13 (Children’s Online Privacy Protection Act, 15 U.S.C. §§ 6501–6506). If you believe a child registered, contact the Operator to delete the account promptly. Users aged 13–17 are not permitted under the Terms even if COPPA would allow certain parental-consent models.

---

## 7. Sharing / disclosure

We do not **sell** personal information (as “sale” is commonly understood under CCPA/CPRA). We may disclose information to:

- **Service providers / processors** (hosting, infrastructure, security) under contractual restrictions, solely to run the Service;  
- **Staff / moderators** with need-to-know access for admin, audit, and safety tools;  
- **Legal / safety recipients** when required by law, court order, legal process, or to protect rights, safety, security, or integrity of the Service and users;  
- **Successors** in a merger, acquisition, financing, or asset transfer, subject to this Policy or equivalent protections.

We do not authorize service providers to use personal information for their own unrelated marketing.

---

## 8. Retention

Account and game data persist on the Operator’s systems until deleted, anonymized, or the Service is decommissioned. Tokens expire per server configuration. Backups may exist for disaster recovery for a limited period. We retain information as reasonably necessary for the purposes above, legal obligations, dispute resolution, and security.

**Live media streams** are ephemeral (in transit / in the browser). They are not retained as server recordings in the base product. Room metadata and audit logs follow the same retention as other ops data.

**De-identified / aggregated data:** The Operator may retain and use de-identified or aggregated statistics that cannot reasonably identify you, for analytics, capacity planning, and product improvement.


---

## 9. Security

Passwords are stored hashed. Production deployments should use HTTPS/TLS. We apply administrative and technical safeguards appropriate to the nature of the Service, but **no method of transmission or storage is 100% secure**. Report suspected incidents via Feedback. Use unique passwords and protect recovery codes.

In the event of a security incident affecting personal information, we will take reasonable steps consistent with applicable U.S. law, which may include notification where required.

---

## 10. Your choices & U.S. privacy rights

### 10.1 General

- Update nickname/avatar in-app where available.  
- Request account closure or deletion via Feedback / support.  
- Opt out of marketing emails if the Operator later sends any (this product may not send marketing).

### 10.2 California (CCPA/CPRA)

California residents may have rights to know/access, delete, and correct certain personal information; to opt out of “sale” / “sharing” for cross-context behavioral advertising; and to limit use of certain sensitive personal information. **This product does not sell personal information** and does not run third-party ad sharing in the base code. We will not discriminate against you for exercising CCPA/CPRA rights.

**California “Shine the Light”:** We do not disclose personal information to third parties for their own direct marketing in the manner typically addressed by Cal. Civ. Code § 1798.83 in the base product.

### 10.3 Other U.S. state privacy laws

Residents of states with comprehensive privacy laws (examples may include Virginia, Colorado, Connecticut, Utah, Texas, Oregon, Montana, Delaware, Iowa, Tennessee, Indiana, and others as enacted) may have rights to confirm processing, access, correct, delete, obtain a portable copy where technically feasible, and opt out of targeted advertising, sale, or certain profiling—**to the extent those laws apply** to the Operator’s processing.

**How to submit:** Contact the Operator via Feedback with “U.S. privacy request” (and your state of residence) in the message, plus information sufficient to verify your account. We will respond within the timelines required by applicable law (commonly up to 45 days, with possible extension as allowed). If we deny a request, you may appeal by replying to our decision through the same channel where an appeal right applies.

### 10.4 Authorized agents

Where state law permits authorized agents, we may require proof of authorization and direct verification of the consumer’s identity.

---

## 11. International users

Servers may be located in the United States or other countries where infrastructure providers operate. By using the Service you understand personal information may be processed in those locations. If you are in the EEA/UK/Switzerland, additional GDPR/UK GDPR terms may be required—operators intentionally serving those regions should add a dedicated addendum (lawful basis, SCCs/transfer tools, DPO contact) before targeting those markets.

---

## 12. No real-money payment data · feature-creep lock

Because xu are virtual-only, we do **not** process bank account or card data for gameplay. If the Operator later adds payments, this Policy **and** the Terms must be updated **before** collection, and additional PCI / financial privacy obligations may apply. Until then, any UI or fork that collects payment data is **out of scope** of this Policy and must not ship.


---

## 13. Changes

We may update this Policy by posting a new version (`PRIVACY.md` / `/privacy`) with a new “Last updated” date. Material changes may also be highlighted in-app where practical. Continued use after the effective date constitutes acceptance where permitted by law.

---

## 14. Contact

Contact the live Operator via the published Feedback / support channel. Do not paste passwords, recovery codes, or full IP logs into public channels.
