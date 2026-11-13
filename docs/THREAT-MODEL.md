# Phase 1 — Initial threat model

## Assets
Customer identity and contact data; shipment addresses and contents; tracking references; staff sessions and MFA seeds; payment references; invoices; uploaded documents; rate configuration; shipment event history; audit integrity; cloud and database credentials.

## Trust boundaries
1. Public browser ↔ edge/WAF/reverse proxy.
2. Edge ↔ web/API containers.
3. API ↔ PostgreSQL and Redis.
4. API ↔ email/SMS/payment providers.
5. API ↔ private object storage.
6. Staff browser ↔ privileged operations endpoints.

## Principal threats and controls
| Threat | Required controls |
|---|---|
| BOLA/IDOR on shipments | Backend ownership and permission checks on every object access; negative authorization tests |
| OTP brute force/replay | Hash OTP; bind purpose/session; 5-minute expiry; max 5 attempts; one-time consume; Redis throttles |
| Tracking reference enumeration | High-entropy random reference; keyed digest lookup; layered throttling; minimal public response |
| Privilege escalation | Deny-by-default RBAC; MFA for staff; re-auth for sensitive operations; audit role grants |
| SQL injection/mass assignment | Prisma parameterization; strict DTO allowlists; reject unknown fields |
| XSS/CSRF | Output encoding; CSP; secure HttpOnly SameSite cookies; CSRF token/origin checks for mutations |
| SSRF | No arbitrary URL fetch in initial scope; egress allowlist and DNS/IP validation if later introduced |
| Malicious uploads | Extension + MIME + magic-byte checks; size limits; malware scanning; private bucket; quarantine |
| Payment spoof/replay | Verify provider signatures; idempotency keys; server-side status reconciliation |
| Audit tampering | Append-only DB role; hash chain; external signed checkpoints and retention-locked storage |
| Credential theft | Argon2id; MFA; session rotation/revocation; secret manager; no secrets in Git |
| Resource exhaustion | WAF/DDoS controls; Redis per-IP/account/endpoint limits; body limits; bounded concurrency |

## Security baseline
Target OWASP ASVS Level 2 as a minimum verification baseline, with risk-based stronger controls for staff administration, payment handling and identity verification. Map API tests to OWASP API Security Top 10. No implementation is considered secure until tested.

## Operational safeguards
Separate dev/staging/prod; private database networking; encrypted backups; tested restoration; least-privilege service identities; dependency/container scanning; centralized redacted logs; alerting; incident response and key rotation runbooks.

## Known phase limitations
The current frontend is a visual and interaction prototype. Tracking lookup, quote calculation, shipment creation, login, notifications and payments are not connected to live services yet. The API currently exposes health only. Do not use this build with real customer data or expose it publicly.
