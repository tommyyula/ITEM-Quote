import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  QuoteError,
  cloneQuote,
  createQuote,
  getQuote,
  getSharedQuote,
  listQuotes,
  updateQuote,
} from '../lib/quote-service.js';
import { resetStoreForTests } from '../lib/store.js';

function sampleContent(client = 'Acme Logistics') {
  return {
    lang: 'en',
    theme: 'day',
    selected: [1, 2, 5, 6, 9, 20],
    overrides: { userRate: false, ediRate: false },
    fields: {
      quoteNumber: '',
      quoteDate: '',
      validUntil: '',
      clientCompany: client,
      contactName: 'Buyer',
      userQty: 10,
      userUnit: 150,
    },
  };
}

async function withStore(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'item-quote-test-'));
  process.env.NODE_ENV = 'test';
  delete process.env.VERCEL;
  delete process.env.DATABASE_URL;
  process.env.LOCAL_DB_FILE = path.join(dir, 'quotes.json');
  resetStoreForTests();
  t.after(async () => {
    resetStoreForTests();
    await rm(dir, { recursive: true, force: true });
  });
}

test('create generates unique server-owned quote numbers', async (t) => {
  await withStore(t);
  const first = await createQuote(sampleContent('Alpha'));
  const second = await createQuote(sampleContent('Beta'));
  assert.match(first.quoteNumber, /^ITEM-\d{8}-\d{6}$/);
  assert.match(second.quoteNumber, /^ITEM-\d{8}-\d{6}$/);
  assert.notEqual(first.quoteNumber, second.quoteNumber);
  assert.equal(first.content.fields.quoteNumber, first.quoteNumber);
  assert.ok(first.content.fields.quoteDate);
  assert.ok(first.content.fields.validUntil);
});

test('update preserves quote number and increments version', async (t) => {
  await withStore(t);
  const created = await createQuote(sampleContent());
  const changed = sampleContent('Updated Customer');
  changed.fields.quoteNumber = 'CLIENT-CANNOT-OVERRIDE';
  const updated = await updateQuote({
    id: created.id,
    version: created.version,
    content: changed,
    status: 'sent',
  });
  assert.equal(updated.quoteNumber, created.quoteNumber);
  assert.equal(updated.content.fields.quoteNumber, created.quoteNumber);
  assert.equal(updated.clientCompany, 'Updated Customer');
  assert.equal(updated.status, 'sent');
  assert.equal(updated.version, 2);
});

test('stale updates are rejected with a version conflict', async (t) => {
  await withStore(t);
  const created = await createQuote(sampleContent());
  await updateQuote({ id: created.id, version: 1, content: sampleContent('First Writer') });
  await assert.rejects(
    () => updateQuote({ id: created.id, version: 1, content: sampleContent('Stale Writer') }),
    (error) => error instanceof QuoteError && error.code === 'version_conflict' && error.status === 409,
  );
});

test('clone copies content but receives a new identity, token, number and date', async (t) => {
  await withStore(t);
  const created = await createQuote(sampleContent('Clone Me'));
  const cloned = await cloneQuote(created.id);
  assert.notEqual(cloned.id, created.id);
  assert.notEqual(cloned.quoteNumber, created.quoteNumber);
  assert.notEqual(cloned.shareToken, created.shareToken);
  assert.equal(cloned.clonedFrom, created.id);
  assert.equal(cloned.clientCompany, created.clientCompany);
  assert.equal(cloned.content.fields.quoteNumber, cloned.quoteNumber);
});

test('read-only share lookup and searchable list work', async (t) => {
  await withStore(t);
  const created = await createQuote(sampleContent('Searchable Logistics'));
  const shared = await getSharedQuote(created.shareToken);
  assert.equal(shared.id, created.id);
  assert.equal('shareToken' in shared, false);
  const list = await listQuotes({ search: 'Searchable' });
  assert.equal(list.length, 1);
  assert.equal(list[0].quoteNumber, created.quoteNumber);
  const loaded = await getQuote(created.id);
  assert.equal(loaded.shareToken, created.shareToken);
});
