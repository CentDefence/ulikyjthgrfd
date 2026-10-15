import { Redis } from '@upstash/redis';
import { createHmac, timingSafeEqual } from 'crypto';
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});
export const discord = (p, m = 'GET', b) =>
  fetch('https://discord.com/api/v10' + p, {
    method: m, headers: { Authorization: 'Bot ' + process.env.DISCORD_TOKEN, 'Content-Type': 'application/json' },
    body: b && JSON.stringify(b),
  }).then((r) => r.json());
const mac = (s) => createHmac('sha256', process.env.SESSION_SECRET).update(s).digest('base64url');
export const sign = (o) => { const s = Buffer.from(JSON.stringify(o)).toString('base64url'); return s + '.' + mac(s); };
export const user = (req) => {
  const c = /(?:^|; )s=([^;]+)/.exec(req.headers.cookie || ''); if (!c) return null;
  const [s, m] = c[1].split('.'), a = Buffer.from(m || ''), b = Buffer.from(mac(s));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { const o = JSON.parse(Buffer.from(s, 'base64url')); return o.exp > Date.now() ? o : null; } catch { return null; }
};
