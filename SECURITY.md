# Security Policy

## Reporting a Vulnerability
Report privately via GitHub Security Advisories (Security tab → "Report a vulnerability").
Do not open a public issue for undisclosed vulnerabilities.

## Secret Rotation

The guidance below is manual and documentation-only — this repo does not enforce rotation
cadence, send reminders, or track secret age in code. Following it is the operator's
responsibility.

### GITHUB_TOKEN (fine-grained PAT)
Rotate every 90 days, or immediately on suspected compromise. Regenerate in GitHub
Settings → Developer settings → Fine-grained tokens, update the `GITHUB_TOKEN` value in
your deployment's env/secret store. No code change required — read only via
`loadPublishingConfig()` at the composition root.

### ADMIN_ACCESS_TOKEN
Rotate every 90 days, or immediately on suspected compromise. Regenerate via
`npm run setup`, or set a new value manually and update your deployment's env/secret store.

**Revocation vs. active sessions**: rotating `ADMIN_ACCESS_TOKEN` prevents new logins
immediately but does NOT invalidate session cookies already issued before rotation — those
remain valid until their own expiry (24 hours from issuance). If you suspect a session is
compromised, restarting the server process clears all in-memory sessions immediately
(deploy access is a higher trust boundary than the admin gate itself).
