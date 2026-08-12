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
