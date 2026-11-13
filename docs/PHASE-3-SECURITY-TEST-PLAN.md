# Phase 3 verification checklist

Run only against the local development stack and test accounts.

## Infrastructure and schema

```powershell
docker compose ps
docker compose exec api npx prisma validate
docker compose exec api npx prisma migrate status
docker compose exec api redis-cli -h redis ping
Invoke-RestMethod http://localhost:3000/api/v1/health
```

## Functional checks

1. Register a customer from the website using an email you control.
2. Open Mailpit at `http://localhost:8025` and retrieve the six-digit email verification code.
3. Verify the email; confirm the account can now sign in.
4. Sign out and sign back in; confirm the server sets the `trueman_session` cookie.
5. Request a password reset; use the new Mailpit message and confirm old sessions stop working.
6. In account session management, verify `GET /auth/sessions` returns only the current user's sessions; revoke a session and confirm it cannot be reused.
7. For the bootstrap administrator, sign in and enroll TOTP MFA. Save recovery codes offline. Sign out and confirm the next login requires an authenticator code or one-time recovery code.
8. Submit a service inquiry. Confirm a `SupportInquiry` record is created in PostgreSQL and a reference is returned.
9. If real customer service numbers are configured, confirm the phone action opens the device dialer and the WhatsApp action opens the intended company chat.
10. If Twilio is configured, request and verify a phone code.

## Negative/security checks

- Attempt login with an incorrect password repeatedly; the endpoint should eventually return HTTP 429.
- Attempt registration repeatedly from the same IP/email; confirm HTTP 429.
- Attempt email verification with an incorrect code; after five failures the challenge must no longer be usable.
- Attempt to reuse a consumed OTP; it must be rejected.
- Wait more than five minutes and attempt an OTP; it must be rejected.
- Try to access `/auth/me` without a session cookie; expect HTTP 401.
- Try to revoke another user's session; expect no update and a not-found response.
- Attempt a state-changing cookie-authenticated request from an unapproved Origin; expect HTTP 403.
- Attempt a privileged session route before enrolling MFA; it must be rejected.
- Confirm no passwords, raw OTPs, raw session tokens, or MFA secrets appear in application logs or database audit metadata.

Passing this checklist is not a penetration test or a production security certification. Perform automated unit/integration/E2E tests, dependency and container scanning, DAST, and an independent security review before production.
