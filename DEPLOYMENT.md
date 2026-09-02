# Production Deployment Checklist

- [ ] Repository files are present on `tommyyula/ITEM-Quote` main branch.
- [ ] Vercel project is linked to that GitHub repository.
- [ ] Neon Postgres is attached to Production and Preview environments.
- [ ] `DATABASE_URL` is populated in Vercel.
- [ ] A strong `ADMIN_KEY` is populated in Vercel.
- [ ] `QUOTE_PREFIX=ITEM` is populated.
- [ ] `QUOTE_TIME_ZONE=America/Los_Angeles` is populated.
- [ ] Production deployment completes successfully.
- [ ] `/api/health` reports `ok: true` and `backend: postgres`.
- [ ] Create and save a test quote.
- [ ] Reopen and update the test quote.
- [ ] Clone the test quote and verify a different Quote Number.
- [ ] Open the read-only share URL in a private browser window.
- [ ] Export the test quote to PDF.
- [ ] Remove the test quote if it is no longer needed.
