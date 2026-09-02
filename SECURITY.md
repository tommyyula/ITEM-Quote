# Security Notes

## Implemented safeguards

- Administrative quote list/create/update/clone/delete operations require `X-Admin-Key`.
- The administrator key is stored in browser `sessionStorage`, not in the quote URL or repository.
- Public customer links use a 192-bit random share token and are read-only.
- PostgreSQL credentials and administrator secrets are environment variables and are excluded from Git.
- Quote Number is generated server-side and protected by both a database sequence and a unique constraint.
- Updates require the current record version; stale writes return HTTP 409 rather than overwriting newer work.
- Request and quote-content size limits reduce accidental or abusive payloads.
- Dynamic content rendered by the quote manager is HTML-escaped.
- The application uses no third-party browser scripts.

## Production responsibilities

Before production use:

1. Set a long random `ADMIN_KEY`; never use `local-dev-key` outside local development.
2. Use Neon/Vercel TLS connections and restrict database access to the application credentials.
3. Rotate the administrator key when staff access changes.
4. Treat read-only share URLs as confidential and send them only to intended recipients.
5. Configure Vercel access logs, alerts, backups, and database retention.
6. Review privacy and contractual obligations for any personal or customer data entered into quotes.

## Recommended phase 2

- SSO and named user accounts
- Role-based access (admin, sales, approver, read-only)
- Immutable audit/event table
- Quote approval workflow and status history
- Share-link expiration and revocation
- Rate limiting and anomaly detection
- Per-tenant isolation if offered to external organizations
- Automated backup/restore drills
