# Trueman Logistics — Phase 3 implementation

## Scope delivered in this code package

- Customer registration with Argon2id password hashing and email verification.
- Email verification challenges: six-digit CSPRNG codes, five-minute expiry, five attempts, one-time use, resend invalidation, HMAC-SHA256 digest storage.
- Optional phone verification using a Twilio SMS adapter (requires real provider credentials).
- Login, logout, password reset, opaque server-side sessions, session listing and revocation.
- HttpOnly, SameSite=Lax session cookie; Secure is enabled in production.
- Redis-backed endpoint/account/IP throttles.
- TOTP MFA enrollment, encrypted TOTP secret storage, single-use recovery codes, and MFA login challenge.
- Privileged roles are forced through MFA enrollment before protected session routes can be used.
- RBAC role/permission seed data and a one-time environment-driven super-administrator bootstrap script. No default admin credentials are created.
- Hash-chained audit events for key identity and session events. This is tamper-evident, not independently immutable until external hash anchoring/retention-locked storage is added.
- Customer service inquiry endpoint persisted in PostgreSQL, rate limited by source IP.
- Customer service phone and WhatsApp links configurable through Vite environment values; service cards open a structured inquiry form rather than forcing email.
- Mailpit is included for local verification email testing.

## Required environment configuration

Merge the new keys from `.env.example` into the existing root `.env`. Do not overwrite your existing database credentials or other working values.

Generate secrets in PowerShell:

```powershell
$pepper = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$mfaKey = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
Write-Output "AUTH_PEPPER=$pepper"
Write-Output "MFA_ENCRYPTION_KEY=$mfaKey"
```

Set these values in `.env`. Keep them stable and back them up securely. Changing `AUTH_PEPPER` invalidates outstanding OTP challenges; changing `MFA_ENCRYPTION_KEY` makes existing TOTP secrets undecryptable unless they are re-encrypted first.

For phone calling and WhatsApp, set:

```dotenv
VITE_SUPPORT_PHONE=+86YOURREALNUMBER
VITE_SUPPORT_WHATSAPP=86YOURWHATSAPPNUMBERWITHOUTPLUS
```

`tel:` opens the device's dialer/calling application. WhatsApp opens the WhatsApp conversation. A real number must be supplied; no placeholder number is wired into the UI.

For phone OTP, configure Twilio:

```dotenv
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```

Phone verification remains unavailable until these credentials and a sender number with appropriate destination coverage are configured.

## Local Docker setup (Windows / PowerShell)

1. Keep the existing `.env`; merge the required values above.
2. Rebuild containers:

   ```powershell
   docker compose down
   docker compose up --build -d
   docker compose ps
   ```

3. Create the database migration (the existing schema already includes shipment-domain entities; this is the first migration for the full schema if the database is empty):

   ```powershell
   docker compose exec api npx prisma migrate dev --name phase3_identity
   ```

   Do not run `migrate reset` against a database containing data. If the database already has tables created with `db push`, take a backup and inspect migration drift before proceeding.

4. Seed roles and permissions:

   ```powershell
   docker compose exec api npm run db:seed
   ```

5. Create the first privileged account. Temporarily add the following values to `.env`:

   ```dotenv
   BOOTSTRAP_ADMIN_EMAIL=your-real-admin-email
   BOOTSTRAP_ADMIN_PASSWORD=a-unique-password-at-least-14-chars
   BOOTSTRAP_ADMIN_NAME=Your Full Name
   BOOTSTRAP_ADMIN_EMPLOYEE_CODE=TRU-0001
   ```

   Then run:

   ```powershell
   docker compose exec api npm run db:admin
   ```

   Remove the four `BOOTSTRAP_ADMIN_*` values from `.env` immediately after the script succeeds. Do not create a public administrator registration route.

6. View local verification emails at `http://localhost:8025` (Mailpit). OTPs are delivered there; they are not printed in application logs.
7. Open `http://localhost:5173`, select Customer login, create a customer account, and verify the email using the code in Mailpit.
8. Sign in as the bootstrap administrator and complete authenticator MFA enrollment. Save the recovery codes offline.
9. If you changed Vite support contact variables, restart the web service so Vite reloads them:

   ```powershell
   docker compose restart web
   ```

## API endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/mfa/login`
- `POST /api/v1/auth/password/forgot`
- `POST /api/v1/auth/password/reset`
- `GET /api/v1/auth/me` (session required)
- `PATCH /api/v1/auth/profile` (session required; own customer profile only)
- `POST /api/v1/auth/logout` (session required)
- `GET /api/v1/auth/sessions` (session required)
- `DELETE /api/v1/auth/sessions/:id` (session required; ownership enforced)
- `POST /api/v1/auth/phone/request-verification` (session required; Twilio configured)
- `POST /api/v1/auth/phone/verify` (session required)
- `POST /api/v1/auth/mfa/setup` (session required)
- `POST /api/v1/auth/mfa/enable` (session required)
- `POST /api/v1/auth/mfa/disable` (session required)
- `POST /api/v1/support/inquiries` (public, Redis throttled, stored in PostgreSQL)

## Customer service / logo assets

- Add the real China phone number and WhatsApp number to `.env` as shown above. Never publish an example number.
- Put the approved logo files at `apps/web/public/images/trueman-logo.svg` and `apps/web/public/images/trueman-logo-white.svg`. `Brand.tsx` automatically uses them when present and falls back to the current text/icon mark if they are absent.
- Service cards now open the structured inquiry form and submit to `/api/v1/support/inquiries`; inquiries are stored for the future operations/support dashboard. The dashboard for staff to triage these inquiries is not part of Phase 3.

## Important production hardening still required

- Configure production SMTP and SMS providers, secrets manager, TLS, private Redis/PostgreSQL networking, WAF and deployment ingress.
- Add external anchoring of audit-chain hashes to independently controlled immutable storage.
- Add dedicated e2e/security tests and execute ASVS/API Top 10 verification before production.
- Add verified support inbox notifications and a staff support-inbox workflow before relying on inquiry records operationally.
- Confirm privacy notice, consent, retention and cross-border data handling requirements for the countries served.
