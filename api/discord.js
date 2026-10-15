import { createPublicKey, verify } from 'crypto';
import { redis } from '../lib/util.js';
export const config = { api: { bodyParser: false } };
const raw = (r) => new Promise((ok) => { const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => ok(Buffer.concat(c))); });
export default async function handler(req, res) {
  const body = await raw(req);
  let ok = false;
  try {
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(process.env.DISCORD_PUBLIC_KEY, 'hex')]), format: 'der', type: 'spki' });
    ok = verify(null, Buffer.concat([Buffer.from(req.headers['x-signature-timestamp']), body]), key, Buffer.from(req.headers['x-signature-ed25519'], 'hex'));
  } catch {}
  if (!ok) return res.status(401).end('bad signature');
  const i = JSON.parse(body);
  if (i.type === 1) return res.json({ type: 1 });
  const msg = (content, hidden) => res.json({ type: 4, data: { content, flags: hidden ? 64 : 0, allowed_mentions: { parse: [] } } });
  if (!(i.member && i.member.roles.includes(process.env.STAFF_ROLE_ID))) return msg('Staff only.', true);
  const name = i.member.user.global_name || i.member.user.username, btn = i.type === 3;
  const tid = btn ? i.data.custom_id.split(':')[1] : await redis.get('c:' + i.channel_id);
  const t = tid && (await redis.get('t:' + tid));
  if (!t) return msg('This is not a ticket channel.', true);
  if (btn || i.data.name === 'close') { t.status = 'closed'; await redis.set('t:' + t.id, t); return msg(`🔒 Ticket closed by ${name}`); }
  if (t.status === 'closed') return msg('This ticket is closed.', true);
  const text = String(i.data.options[0].value).slice(0, 2000);
  t.msgs.push({ from: 'staff', name, text, at: Date.now() }); await redis.set('t:' + t.id, t);
  msg(`🛡️ **${name}:** ${text}`);
}
