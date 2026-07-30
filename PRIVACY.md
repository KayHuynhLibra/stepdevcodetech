# Privacy Policy

**Last updated:** 2026-07-28  
**Primary notice jurisdiction:** United States · State of Iowa (operator default)  
**Project purpose:** Learning, study, and research demo (see [TERMS.md](./TERMS.md) §0)

**This is not legal advice.** Describes data practices for the SOFIAORE / Tarot **educational / research** web demo as implemented in this codebase. The GitHub repository is published for study; production player data must stay on the operator’s servers—**never** in Git.

## 1. Who we are

The Service is operated by the deployer of this application (e.g. the Railway / domain operator). The public source repository is a **demo codebase**; production data stays on the operator’s servers/volume, not in Git.

**Iowa / U.S. contact:** Use the live site’s published support / Feedback channel for privacy requests (access, deletion, correction).

## 2. Data we process

| Category | Examples | Purpose | Legal-style basis (US ops) |
|----------|----------|---------|----------------------------|
| Account | Username, password hash, optional nickname/avatar, role | Auth, profile, gameplay | Provide the Service; security |
| Session | Auth tokens, device/session ids | Login, anti-abuse | Security; fraud prevention |
| Gameplay | Round/spin/oracle history, balances (xu), chat | Operation, moderation | Provide the Service |
| Network / abuse | IP address, coarse geo/ISP lookups (staff tools), guest–IP binding | Rate limits, multi-account control | Security; legitimate ops interest |
| Ops logs | Admin audit actions, reports, feedback tickets | Security and support | Security; compliance |

We do **not** intentionally collect government ID, Social Security numbers, payment card numbers, or crypto wallet keys in this demo.

**Sensitive data:** Do not submit health, precise geolocation beyond IP coarse lookup, or biometric data. The Service is not designed for those categories.

## 3. Cookies / local storage

The browser may store tokens, UI prefs, guest codes, and age/terms acknowledgements in **localStorage** / similar. Clearing site data logs you out of guest/session state. These are primarily **strictly necessary** or functional storage for the Service—not third-party advertising pixels in the base demo.

## 4. Children (COPPA)

The Service is for users **18+** and is **not directed to children under 13**. We do not knowingly collect personal information from children under 13 (Children’s Online Privacy Protection Act, 15 U.S.C. §§ 6501–6506). If you believe a child registered, contact the operator to delete the account promptly.

## 5. Sharing

We do not **sell** personal information (as “sale” is commonly understood under CCPA/CPRA). Data may be processed by hosting providers (e.g. cloud VPS / Railway) under their terms, solely to run the Service. Staff roles (admin / audit tools) can see IP and account metadata for moderation. We may disclose information if required by law, court order, or to protect rights, safety, and security.

## 6. Retention

Account and game data persist on the operator’s data volume until deleted or the service is decommissioned. Tokens expire per server config. Backups may exist for disaster recovery for a limited period.

## 7. Security

Passwords are stored hashed (scrypt). Use HTTPS in production. No security measure is perfect—report abuse to the operator. Iowa and U.S. users should use unique passwords and protect recovery codes.

## 8. Your choices & U.S. state privacy notices

### 8.1 General

- Update nickname/avatar in-app where available.  
- Request account closure or deletion via the operator’s support / Feedback channel.  
- Opt out of marketing emails if the operator later sends any (this demo may not send marketing).

### 8.2 California (CCPA/CPRA)

California residents may have rights to know, delete, and correct certain personal information, and to opt out of “sale” / “sharing” for cross-context behavioral advertising. **This demo does not sell personal information** and does not run third-party ad sharing in the base code. Contact the operator to exercise rights. We will not discriminate for exercising CCPA rights.

### 8.3 Iowa (ICDPA-oriented)

Iowa has enacted consumer data protection requirements (Iowa Consumer Data Protection Act framework). Where the Act applies to an operator’s processing, Iowa consumers may have rights to:

- Confirm whether we process their personal data;  
- Access / obtain a copy;  
- Correct inaccuracies;  
- Delete personal data;  
- Obtain a portable copy where technically feasible;  
- Opt out of targeted advertising, sale of personal data, or certain profiling (if the operator engages in those activities—**this demo does not sell data or run ad targeting**).

**How to submit:** Contact the live operator with “Iowa privacy request” in the subject, and sufficient information to verify your account. The operator will respond within the timelines required by applicable law (commonly up to 45 days, with possible extension as allowed).

### 8.4 Other U.S. states

Similar rights may exist under other state privacy laws (e.g. Virginia, Colorado, Connecticut, etc.). Contact the operator; we will honor applicable non-waivable rights.

## 9. International users

Servers may be located outside your country (including U.S. hosting). By using the Service you understand data may be processed where the host operates. If you are in the EEA/UK, additional GDPR terms may be required—operators serving those regions should add a GDPR addendum.

## 10. No real-money data

Because xu are virtual-only, we do **not** process bank account or card data for gameplay. If an operator later adds payments, this Policy must be updated **before** collection.

## 11. Changes

We may update this Policy by posting a new version (`PRIVACY.md` / `/privacy`) with a new “Last updated” date.

## 12. Contact

Contact the live site operator. Do not paste passwords, recovery codes, or full IP logs into public GitHub issues.
