import { healthCheck } from '../lib/quote-service.js';

function setCors(req, res) {
  const origin = req.headers?.origin;
  res.setHeader('Access-Control-Allow-Origin', origin && /^https?:\/\/\S+/.test(origin) ? origin : '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  res.setHeader('Vary', 'Origin');
}

export default async function handler(_req, res) {
  setCors(_req, res);
  if (_req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const database = await healthCheck();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({
      ok: true,
      service: 'ITEM-Quote',
      database,
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({
      ok: false,
      service: 'ITEM-Quote',
      error: String(error?.message || error),
      timestamp: new Date().toISOString(),
    }));
  }
}
