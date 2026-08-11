# OWASP Top 10 Mapping

Required when the project handles payments, health data, or PII.

| Code | Category | Review area |
|------|----------|-------------|
| A01 | Broken access control | authz gaps, IDOR, missing server-side checks |
| A02 | Cryptographic failures | PII in transit/at rest, weak crypto, exposed secrets |
| A03 | Injection | SQL/NoSQL/OS/template injection, unsanitized input to exec/render |
| A04 | Insecure design | missing threat model, trust-boundary failures |
| A05 | Misconfiguration | default creds, verbose errors, permissive headers, debug on |
| A06 | Vulnerable components | dependency audit, known-vuln check, outdated libs |
| A07 | Authn failures | broken sessions, brute-forceable login, credential reuse |
| A08 | Integrity | insecure deserialization, supply-chain tamper |
| A09 | Logging/monitoring | PII in logs, missing audit trail, silent failures |
| A10 | SSRF | server-side requests to attacker-controlled targets, URL validation |

## How to map

For each security check run, record which OWASP category it covers. A handled
category with no mapping row = documentation gap in the security report.

```
| OWASP | Check | Verdict |
|-------|-------|---------|
| A01   | Authz on /api/admin routes | PASS |
| A02   | TLS enforced, no hardcoded secrets | PASS |
| A03   | SQL params in user query handler | PASS |
| A06   | npm audit: 0 critical/high | PASS |
```
