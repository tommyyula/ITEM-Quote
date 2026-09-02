import { healthCheck } from '../lib/quote-service.js';

export default async function handler(_req, res) {
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
