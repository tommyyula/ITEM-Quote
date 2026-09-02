import crypto from 'node:crypto';
import { getStore } from './store.js';

export class QuoteError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.name = 'QuoteError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function localDate(timeZone = process.env.QUOTE_TIME_ZONE || 'America/Los_Angeles') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function plusDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function validateContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    throw new QuoteError('invalid_content', 'Quote content must be a JSON object.');
  }
  const encoded = JSON.stringify(content);
  if (Buffer.byteLength(encoded, 'utf8') > 1_500_000) {
    throw new QuoteError('content_too_large', 'Quote content exceeds the 1.5 MB limit.', 413);
  }
  return deepClone(content);
}

function normalizeSelected(selected) {
  if (!Array.isArray(selected)) return [];
  return [...new Set(selected.map(Number).filter((id) => Number.isInteger(id) && id >= 1 && id <= 23))];
}

function normalizeContent(content, quoteNumber, { clone = false } = {}) {
  const normalized = validateContent(content);
  normalized.fields = normalized.fields && typeof normalized.fields === 'object' ? normalized.fields : {};
  normalized.selected = normalizeSelected(normalized.selected);
  normalized.lang = ['en', 'zh', 'ja', 'es'].includes(normalized.lang) ? normalized.lang : 'en';
  normalized.theme = ['day', 'night'].includes(normalized.theme) ? normalized.theme : 'day';
  normalized.overrides = normalized.overrides && typeof normalized.overrides === 'object' ? normalized.overrides : {};

  const today = localDate();
  normalized.fields.quoteNumber = quoteNumber;
  if (clone || !normalized.fields.quoteDate) normalized.fields.quoteDate = today;
  if (clone || !normalized.fields.validUntil) normalized.fields.validUntil = plusDays(normalized.fields.quoteDate, 30);
  return normalized;
}

function publicQuote(record) {
  if (!record) return null;
  return {
    id: record.id,
    quoteNumber: record.quoteNumber,
    status: record.status,
    clientCompany: record.clientCompany,
    content: record.content,
    version: record.version,
    clonedFrom: record.clonedFrom,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function adminQuote(record) {
  return { ...publicQuote(record), shareToken: record.shareToken };
}

async function newQuoteNumber(store) {
  const sequence = await store.nextSequence();
  const prefix = (process.env.QUOTE_PREFIX || 'ITEM').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20) || 'ITEM';
  const date = localDate().replaceAll('-', '');
  return `${prefix}-${date}-${String(sequence).padStart(6, '0')}`;
}

export async function createQuote(content, { clonedFrom = null } = {}) {
  const store = getStore();
  const quoteNumber = await newQuoteNumber(store);
  const normalized = normalizeContent(content, quoteNumber, { clone: Boolean(clonedFrom) });
  const record = await store.insert({
    id: crypto.randomUUID(),
    quoteNumber,
    shareToken: crypto.randomBytes(24).toString('base64url'),
    status: 'draft',
    clientCompany: String(normalized.fields.clientCompany || '').slice(0, 300),
    content: normalized,
    clonedFrom,
  });
  return adminQuote(record);
}

export async function getQuote(id) {
  const record = await getStore().getById(String(id));
  if (!record) throw new QuoteError('not_found', 'Quote not found.', 404);
  return adminQuote(record);
}

export async function getSharedQuote(token) {
  const record = await getStore().getByShareToken(String(token));
  if (!record) throw new QuoteError('not_found', 'Shared quote not found.', 404);
  return publicQuote(record);
}

export async function listQuotes({ search = '', limit = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(250, Number(limit) || 100));
  const records = await getStore().list({ search: String(search || '').slice(0, 200), limit: safeLimit });
  return records.map((record) => ({
    id: record.id,
    quoteNumber: record.quoteNumber,
    shareToken: record.shareToken,
    status: record.status,
    clientCompany: record.clientCompany,
    version: record.version,
    clonedFrom: record.clonedFrom,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
}

export async function updateQuote({ id, version, content, status = 'draft' }) {
  if (!Number.isInteger(Number(version)) || Number(version) < 1) {
    throw new QuoteError('invalid_version', 'A valid quote version is required.');
  }
  const store = getStore();
  const current = await store.getById(String(id));
  if (!current) throw new QuoteError('not_found', 'Quote not found.', 404);
  const normalized = normalizeContent(content, current.quoteNumber);
  const allowedStatus = ['draft', 'sent', 'accepted', 'expired'];
  const saved = await store.update({
    id: current.id,
    version: Number(version),
    content: normalized,
    clientCompany: String(normalized.fields.clientCompany || '').slice(0, 300),
    status: allowedStatus.includes(status) ? status : current.status,
  });
  if (saved?.error === 'not_found') throw new QuoteError('not_found', 'Quote not found.', 404);
  if (saved?.error === 'version_conflict') {
    throw new QuoteError(
      'version_conflict',
      'This quote was updated elsewhere. Reload before saving again.',
      409,
      { current: adminQuote(saved.current) },
    );
  }
  return adminQuote(saved);
}

export async function cloneQuote(id) {
  const source = await getStore().getById(String(id));
  if (!source) throw new QuoteError('not_found', 'Quote not found.', 404);
  return createQuote(source.content, { clonedFrom: source.id });
}

export async function deleteQuote(id) {
  const removed = await getStore().remove(String(id));
  if (!removed) throw new QuoteError('not_found', 'Quote not found.', 404);
  return { deleted: true, id: String(id) };
}

export async function healthCheck() {
  return getStore().ping();
}
