# Privacy Policy

**Last updated:** 2026-07-22

**This is not legal advice.** Describes data practices for the SOFIAORE / Tarot entertainment demo as implemented in this codebase.

## 1. Who we are

The Service is operated by the deployer of this application (e.g. the Railway / domain operator). The public source repository is a **demo codebase**; production data stays on the operator’s servers/volume, not in Git.

## 2. Data we process

| Category | Examples | Purpose |
|----------|----------|---------|
| Account | Username, password hash, optional nickname/avatar, role | Auth, profile, gameplay |
| Session | Auth tokens, device/session ids | Login, anti-abuse |
| Gameplay | Bets/spins history, balances (xu), chat messages | Game operation, moderation |
| Network / abuse | IP address, coarse geo/ISP lookups (staff tools), guest–IP binding | Rate limits, multi-account / guest abuse control |
| Ops logs | Admin audit actions, reports | Security and support |

We do **not** intentionally collect government ID, payment card numbers, or crypto wallet keys in this demo.

## 3. Cookies / local storage

The browser may store tokens, UI prefs, guest codes, and age/terms acknowledgements in **localStorage** / similar. Clearing site data logs you out of guest/session state.

## 4. Children (COPPA-oriented)

The Service is for users **18+** and is **not directed to children under 13**. We do not knowingly collect personal information from children under 13. If you believe a child registered, contact the operator to delete the account.

## 5. Sharing

We do not sell personal information. Data may be processed by hosting providers (e.g. cloud VPS / Railway) under their terms, solely to run the Service. Staff roles (admin / audit tools) can see IP and account metadata for moderation.

## 6. Retention

Account and game data persist on the operator’s data volume until deleted or the service is decommissioned. Tokens expire per server config. Backups may exist for disaster recovery.

## 7. Security

Passwords are stored hashed (scrypt). Use HTTPS in production. No security measure is perfect—report abuse to the operator.

## 8. Your choices

- Update nickname/avatar in-app where available.  
- Request account closure via the operator’s support channel.  
- California residents may have additional rights under CCPA/CPRA regarding access/deletion; contact the operator. This demo does not sell personal information.

## 9. International users

Servers may be located outside your country. By using the Service you understand data may be processed where the host operates.

## 10. Changes

We may update this Policy by posting a new version (`PRIVACY.md` / `/privacy`).

## 11. Contact

Contact the live site operator. Do not paste passwords, recovery codes, or full IP logs into public GitHub issues.
