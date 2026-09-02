import { promises as fs } from 'node:fs';
import path from 'node:path';

let singleton;

function normalizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    quoteNumber: row.quote_number ?? row.quoteNumber,
    shareToken: row.share_token ?? row.shareToken,
    status: row.status ?? 'draft',
    clientCompany: row.client_company ?? row.clientCompany ?? '',
    content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
    version: Number(row.version ?? 1),
    clonedFrom: row.cloned_from ?? row.clonedFrom ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at ?? row.createdAt,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at ?? row.updatedAt,
  };
}

class NeonStore {
  constructor(databaseUrl) {
    this.databaseUrl = databaseUrl;
    this.sql = null;
    this.ready = null;
  }

  async init() {
    if (!this.ready) {
      this.ready = (async () => {
        const { neon } = await import('@neondatabase/serverless');
        this.sql = neon(this.databaseUrl);
        await this.sql`CREATE SEQUENCE IF NOT EXISTS item_quote_number_seq START 1`;
        await this.sql`
          CREATE TABLE IF NOT EXISTS item_quotes (
            id UUID PRIMARY KEY,
            quote_number TEXT NOT NULL UNIQUE,
            share_token TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'draft',
            client_company TEXT NOT NULL DEFAULT '',
            content JSONB NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            cloned_from UUID NULL REFERENCES item_quotes(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await this.sql`CREATE INDEX IF NOT EXISTS item_quotes_updated_at_idx ON item_quotes(updated_at DESC)`;
        await this.sql`CREATE INDEX IF NOT EXISTS item_quotes_client_company_idx ON item_quotes(client_company)`;
      })();
    }
    await this.ready;
  }

  async ping() {
    await this.init();
    const rows = await this.sql`SELECT NOW() AS now`;
    return { backend: 'postgres', now: rows[0]?.now };
  }

  async nextSequence() {
    await this.init();
    const rows = await this.sql`SELECT nextval('item_quote_number_seq')::text AS seq`;
    return Number(rows[0].seq);
  }

  async insert(record) {
    await this.init();
    const rows = await this.sql`
      INSERT INTO item_quotes (
        id, quote_number, share_token, status, client_company, content, version, cloned_from
      ) VALUES (
        ${record.id}, ${record.quoteNumber}, ${record.shareToken}, ${record.status},
        ${record.clientCompany}, ${JSON.stringify(record.content)}::jsonb, 1, ${record.clonedFrom}
      )
      RETURNING *
    `;
    return normalizeRow(rows[0]);
  }

  async getById(id) {
    await this.init();
    const rows = await this.sql`SELECT * FROM item_quotes WHERE id = ${id} LIMIT 1`;
    return normalizeRow(rows[0]);
  }

  async getByShareToken(token) {
    await this.init();
    const rows = await this.sql`SELECT * FROM item_quotes WHERE share_token = ${token} LIMIT 1`;
    return normalizeRow(rows[0]);
  }

  async update({ id, version, content, clientCompany, status }) {
    await this.init();
    const rows = await this.sql`
      UPDATE item_quotes
      SET content = ${JSON.stringify(content)}::jsonb,
          client_company = ${clientCompany},
          status = ${status},
          version = version + 1,
          updated_at = NOW()
      WHERE id = ${id} AND version = ${version}
      RETURNING *
    `;
    if (rows[0]) return normalizeRow(rows[0]);
    const existing = await this.getById(id);
    if (!existing) return { error: 'not_found' };
    return { error: 'version_conflict', current: existing };
  }

  async list({ search = '', limit = 100 }) {
    await this.init();
    const pattern = `%${search.trim()}%`;
    const rows = await this.sql`
      SELECT id, quote_number, share_token, status, client_company, version,
             cloned_from, created_at, updated_at
      FROM item_quotes
      WHERE ${search.trim()} = ''
         OR quote_number ILIKE ${pattern}
         OR client_company ILIKE ${pattern}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
    return rows.map(normalizeRow);
  }

  async remove(id) {
    await this.init();
    const rows = await this.sql`DELETE FROM item_quotes WHERE id = ${id} RETURNING id`;
    return Boolean(rows[0]);
  }
}

class LocalFileStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.lock = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await this.#write({ sequence: 0, quotes: [] });
    }
  }

  async #read() {
    await this.init();
    const raw = await fs.readFile(this.filePath, 'utf8');
    return JSON.parse(raw || '{"sequence":0,"quotes":[]}');
  }

  async #write(data) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(data, null, 2));
    await fs.rename(temp, this.filePath);
  }

  async #withLock(work) {
    const previous = this.lock;
    let release;
    this.lock = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  async ping() {
    const data = await this.#read();
    return { backend: 'local-file', records: data.quotes.length, now: new Date().toISOString() };
  }

  async nextSequence() {
    return this.#withLock(async () => {
      const data = await this.#read();
      data.sequence = Number(data.sequence || 0) + 1;
      await this.#write(data);
      return data.sequence;
    });
  }

  async insert(record) {
    return this.#withLock(async () => {
      const data = await this.#read();
      if (data.quotes.some((q) => q.quoteNumber === record.quoteNumber)) {
        throw new Error('Duplicate quote number');
      }
      if (data.quotes.some((q) => q.shareToken === record.shareToken)) {
        throw new Error('Duplicate share token');
      }
      const now = new Date().toISOString();
      const saved = {
        ...record,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      data.quotes.push(saved);
      await this.#write(data);
      return normalizeRow(saved);
    });
  }

  async getById(id) {
    const data = await this.#read();
    return normalizeRow(data.quotes.find((q) => q.id === id));
  }

  async getByShareToken(token) {
    const data = await this.#read();
    return normalizeRow(data.quotes.find((q) => q.shareToken === token));
  }

  async update({ id, version, content, clientCompany, status }) {
    return this.#withLock(async () => {
      const data = await this.#read();
      const index = data.quotes.findIndex((q) => q.id === id);
      if (index < 0) return { error: 'not_found' };
      const current = data.quotes[index];
      if (Number(current.version) !== Number(version)) {
        return { error: 'version_conflict', current: normalizeRow(current) };
      }
      const updated = {
        ...current,
        content,
        clientCompany,
        status,
        version: Number(current.version) + 1,
        updatedAt: new Date().toISOString(),
      };
      data.quotes[index] = updated;
      await this.#write(data);
      return normalizeRow(updated);
    });
  }

  async list({ search = '', limit = 100 }) {
    const data = await this.#read();
    const query = search.trim().toLowerCase();
    return data.quotes
      .filter((q) => !query
        || String(q.quoteNumber).toLowerCase().includes(query)
        || String(q.clientCompany || '').toLowerCase().includes(query))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, limit)
      .map((q) => {
        const copy = normalizeRow(q);
        delete copy.content;
        return copy;
      });
  }

  async remove(id) {
    return this.#withLock(async () => {
      const data = await this.#read();
      const before = data.quotes.length;
      data.quotes = data.quotes.filter((q) => q.id !== id);
      if (data.quotes.length === before) return false;
      await this.#write(data);
      return true;
    });
  }
}

export function resetStoreForTests() {
  singleton = undefined;
}

export function getStore() {
  if (singleton) return singleton;
  if (process.env.DATABASE_URL) {
    singleton = new NeonStore(process.env.DATABASE_URL);
    return singleton;
  }

  const production = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  if (production && process.env.ALLOW_LOCAL_FILE_STORE !== 'true') {
    throw new Error('DATABASE_URL is required in production. Attach Neon Postgres and redeploy.');
  }

  singleton = new LocalFileStore(process.env.LOCAL_DB_FILE || '.data/quotes.json');
  return singleton;
}
