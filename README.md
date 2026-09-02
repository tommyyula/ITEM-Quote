# ITEM Quote

Interactive quotation builder for ITEM software, AI platform/FDE services, usage fees, hardware, and implementation services.

The application preserves the original quotation experience—23 selectable products, dynamic calculations, English/Chinese/Japanese/Spanish, day/night view, summary, and PDF printing—and adds server-side quote lifecycle management.

## What is implemented

- Server-generated, database-enforced unique Quote Numbers (`ITEM-YYYYMMDD-000001`)
- Create, save, reopen, update, search, clone, and delete quotes
- Optimistic concurrency control to prevent silent overwrites
- Read-only customer sharing links with unguessable tokens
- Quote list with client and updated-time search
- PostgreSQL/Neon production storage
- Local persistent file storage for development and automated tests
- Shared administrator key for protected write/list operations
- Existing dynamic license tiers, calculations, summaries, multilingual UI, themes, and PDF export

## Architecture

```text
Browser quotation UI
        |
        | HTTPS + X-Admin-Key for administrative operations
        v
/api/quotes (Vercel Node Function)
        |
        v
Neon PostgreSQL
```

The public share route reads a quote by an unguessable share token and never returns the administrator-only token or editing credentials.

## Run locally

Requirements: Node.js 22 or newer.

```bash
cp .env.example .env.local
# For local development, DATABASE_URL may remain unset.
# ADMIN_KEY defaults to local-dev-key only outside production.
npm run dev
```

Open `http://127.0.0.1:3000`.

Local development writes data to `.data/quotes.json`. This fallback is intentionally disabled on Vercel and in production unless `ALLOW_LOCAL_FILE_STORE=true`; do not use the file store for production.

## Test

```bash
npm run check
npm test
```

The test suite verifies unique numbering, updates, version conflicts, cloning, search, and read-only sharing.

## Deploy to Vercel with Neon PostgreSQL

1. Push this project to `tommyyula/ITEM-Quote`.
2. In Vercel, import the GitHub repository as a new project.
3. Add a Neon Postgres database to the Vercel project, or provide an existing PostgreSQL connection string.
4. Add the following Production and Preview environment variables:

```text
DATABASE_URL=<Neon pooled PostgreSQL connection string>
ADMIN_KEY=<long random administrator secret>
QUOTE_PREFIX=ITEM
QUOTE_TIME_ZONE=America/Los_Angeles
```

Generate a strong administrator key locally:

```bash
npm run generate-key
```

5. Deploy. The API initializes the required sequence, table, and indexes automatically on its first database request.
6. Verify `https://<deployment>/api/health` returns `"ok": true` and `"backend": "postgres"`.

## Deploy frontend to GitHub Pages

1. Keep the existing `main` branch and push repository changes.
2. Enable GitHub Pages for this repository with **GitHub Actions** as the source (this repo includes `.github/workflows/pages.yml` and will publish the full repository content on every push to `main`).
3. After the first Pages publish, replace the empty frontend API origin in `index.html`:
   - edit `window.ITEM_QUOTE_API_URL` to your Vercel origin (for example `https://item-quote.vercel.app`).
4. (Optional) use a query param to preview/share per-link API endpoint without editing HTML:
   - append `?api=https://item-quote.vercel.app` to the URL when opening the app.
5. Confirm you can save and open quotes, and ensure `?share=` links work end-to-end with the same API origin.

### Important

- Never commit `.env`, `.env.local`, `DATABASE_URL`, or `ADMIN_KEY`.
- The GitHub repository can remain public because credentials are provided only through Vercel Environment Variables.
- Use the **Share** button for customers. The normal `?quote=<uuid>` edit URL still requires the administrator key.

## Quote lifecycle

- **New** creates a new unsaved draft in the browser.
- **Save** creates the server record on first use and updates it afterward.
- **Clone** copies the current quote, resets its quote date, and assigns a new server-generated Quote Number and share token.
- **Quotes** opens searchable saved history.
- **Share** copies a read-only customer URL.
- **Export / Print PDF** prints the current selected content and dynamic summary.

## API

All administrative requests require `X-Admin-Key: <ADMIN_KEY>`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/quotes?search=...` | List/search quotes |
| `GET` | `/api/quotes?id=<uuid>` | Load one editable quote |
| `GET` | `/api/quotes?share=<token>` | Load one public read-only quote |
| `POST` | `/api/quotes` | Create a quote from `{ "content": ... }` |
| `POST` | `/api/quotes` | Clone using `{ "action":"clone", "id":"..." }` |
| `PATCH` | `/api/quotes` | Update using `id`, `version`, and `content` |
| `DELETE` | `/api/quotes` | Delete using `{ "id":"..." }` |
| `GET` | `/api/health` | Database and service health |

## Data model

Each quote stores:

- Internal UUID
- Unique business Quote Number
- Unguessable public share token
- Full quotation state as PostgreSQL `JSONB`
- Client name and quote status for search
- Version number for concurrency control
- Clone source, creation time, and update time

See [`schema.sql`](schema.sql) for the PostgreSQL schema.

## Security model

This first production version uses one shared administrator secret rather than per-user accounts. It is appropriate for a controlled internal sales team, but larger deployments should add SSO, named users, roles, audit history, secret rotation, rate limiting, and customer-share expiration. See [`SECURITY.md`](SECURITY.md).
