# QA Report

Validated on 2026-09-01 with Node.js 22 and headless Chromium.

## Automated service tests

- Unique server-generated Quote Numbers: pass
- Update preserves Quote Number and increments version: pass
- Stale update conflict handling (HTTP 409 behavior): pass
- Clone creates a new ID, number, token, and clone reference: pass
- Search and read-only share retrieval: pass

Result: 5 tests passed, 0 failed.

## API integration checks

- Health endpoint: pass
- Create: pass
- Update: pass
- Clone: pass
- List/search: pass
- Public read-only retrieval: pass
- Public response omits share token: pass

## Browser integration checks

- Cloud toolbar renders: pass
- Quote Number is read-only before and after save: pass
- First save assigns a unique server number: pass
- Editing marks the quote dirty: pass
- Subsequent save updates the same quote: pass
- Clone opens a new quote with a different number: pass
- Saved Quotes manager lists records: pass
- Public share opens in read-only mode: pass
- English/Chinese cloud UI localization: pass
- Day/night switch remains functional: pass

## Production item not executable in the isolated QA runtime

A live Neon connection and Vercel production deployment require account-level write authorization and production environment variables. The PostgreSQL adapter, automatic schema initialization, and deployment configuration are included but were not exercised against the user's live Neon/Vercel account in this runtime.
