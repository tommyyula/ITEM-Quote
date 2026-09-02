import crypto from 'node:crypto';
import {
  QuoteError,
  cloneQuote,
  createQuote,
  deleteQuote,
  getQuote,
  getSharedQuote,
  listQuotes,
  updateQuote,
} from '../lib/quote-service.js';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function header(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function setCors(req, res) {
  const origin = header(req, 'origin');
  res.setHeader('Access-Control-Allow-Origin', origin && /^https?:\/\//.test(origin) ? origin : '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  res.setHeader('Vary', 'Origin');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireAdmin(req) {
  const configured = process.env.ADMIN_KEY
    || ((process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') ? 'local-dev-key' : '');
  if (!configured) {
    throw new QuoteError(
      'admin_key_not_configured',
      'ADMIN_KEY is not configured on the server.',
      503,
    );
  }
  const supplied = header(req, 'x-admin-key');
  if (!safeEqual(supplied, configured)) {
    throw new QuoteError('unauthorized', 'A valid administrator key is required.', 401);
  }
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) {
      throw new QuoteError('request_too_large', 'Request body exceeds 2 MB.', 413);
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new QuoteError('invalid_json', 'Request body must be valid JSON.');
  }
}

function getUrl(req) {
  const host = header(req, 'host') || 'localhost';
  const protocol = header(req, 'x-forwarded-proto') || 'http';
  return new URL(req.url || '/api/quotes', `${protocol}://${host}`);
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.end();
    return;
  }

  try {
    const url = getUrl(req);

    if (req.method === 'GET') {
      const share = url.searchParams.get('share');
      if (share) {
        const quote = await getSharedQuote(share);
        sendJson(res, 200, { quote, readOnly: true });
        return;
      }

      requireAdmin(req);
      const id = url.searchParams.get('id');
      if (id) {
        const quote = await getQuote(id);
        sendJson(res, 200, { quote });
        return;
      }

      const quotes = await listQuotes({
        search: url.searchParams.get('search') || '',
        limit: url.searchParams.get('limit') || 100,
      });
      sendJson(res, 200, { quotes });
      return;
    }

    if (req.method === 'POST') {
      requireAdmin(req);
      const body = await parseBody(req);
      if (body.action === 'clone') {
        const quote = await cloneQuote(body.id);
        sendJson(res, 201, { quote });
        return;
      }
      const quote = await createQuote(body.content || body.quote || body);
      sendJson(res, 201, { quote });
      return;
    }

    if (req.method === 'PATCH') {
      requireAdmin(req);
      const body = await parseBody(req);
      const quote = await updateQuote({
        id: body.id,
        version: body.version,
        content: body.content,
        status: body.status,
      });
      sendJson(res, 200, { quote });
      return;
    }

    if (req.method === 'DELETE') {
      requireAdmin(req);
      const body = await parseBody(req);
      const id = body.id || getUrl(req).searchParams.get('id');
      const result = await deleteQuote(id);
      sendJson(res, 200, result);
      return;
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE, OPTIONS');
    sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'Method not allowed.' } });
  } catch (error) {
    if (error instanceof QuoteError) {
      sendJson(res, error.status, {
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }
    console.error(error);
    const configurationError = /DATABASE_URL is required|Cannot find package '@neondatabase\/serverless'/.test(String(error?.message));
    sendJson(res, configurationError ? 503 : 500, {
      error: {
        code: configurationError ? 'database_not_configured' : 'internal_error',
        message: configurationError
          ? 'The server database is not configured. Attach Neon Postgres and set DATABASE_URL.'
          : 'Unexpected server error.',
      },
    });
  }
}
