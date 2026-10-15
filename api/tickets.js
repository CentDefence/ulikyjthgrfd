import { randomBytes } from 'crypto';
import { redis, discord, user } from '../lib/util.js';
const NAMES = { appeal: 'Appeal a moderation', report: 'Report someone', question: 'General question', other: 'Other' };
const clip = (s, n) => String(s || '').trim().slice(0, n);
const view = (t, u) => ({ ...t, url: u.staff && t.ch ? `https://discord.com/channels/${process.env.GUILD_ID}/${t.ch}` : undefined });
const say = (t, text) => t.ch && discord(`/channels/${t.ch}/messages`, 'POST', { content: text.slice(0, 1900), allowed_mentions: { parse: [] } });
export default async function handler(req, res) {
  const u = user(req); if (!u) return res.status(401).json({ error: 'Please sign in' });
  if (req.method === 'GET') {
    if (req.query.id) {
      const t = await redis.get('t:' + req.query.id);
      if (!t || (t.uid !== u.id && !u.staff)) return res.status(404).json({ error: 'not found' });
      return res.json(view(t, u));
    }
    const ids = await redis.lrange(u.staff ? 'all' : 'u:' + u.id, 0, 99);
    const l = ids.length ? await redis.mget(...ids.map((i) => 't:' + i)) : [];
    return res.json(l.filter(Boolean).map(({ msgs, ...t }) => t));
  }
  const b = req.body || {}, g = process.env.GUILD_ID;
  if (b.action === 'create') {
    const cat = NAMES[b.cat] ? b.cat : 'other', subject = clip(b.subject, 100), text = clip(b.text, 2000);
    if (!subject || !text) return res.status(400).json({ error: 'Fill in the subject and details' });
    const t = { id: 'T' + randomBytes(4).toString('hex'), uid: u.id, uname: u.name, avatar: u.avatar, cat, subject, status: 'open', created: Date.now(), msgs: [{ from: 'user', name: u.name, text, at: Date.now() }] };
    const ch = await discord(`/guilds/${g}/channels`, 'POST', {
      name: `${cat}-${t.id.slice(1)}`, type: 0, parent_id: process.env.CATEGORY_ID || undefined,
      permission_overwrites: [
        { id: g, type: 0, deny: '1024' }, // @everyone не видит
        { id: process.env.STAFF_ROLE_ID, type: 0, allow: '68608' }, // стафф
        { id: process.env.DISCORD_CLIENT_ID, type: 1, allow: '68608' }, // бот
      ],
    });
    if (ch.id) {
      t.ch = ch.id; await redis.set('c:' + ch.id, t.id);
      await discord(`/channels/${ch.id}/messages`, 'POST', {
        embeds: [{ title: `${NAMES[cat]} — ${subject}`, description: text, color: 0x7c3aed, fields: [{ name: 'Author', value: `${u.name} (<@${u.id}>)` }], footer: { text: 'TRS CIS Sports Administration' } }],
        components: [{ type: 1, components: [{ type: 2, style: 4, label: 'Close ticket', custom_id: 'close:' + t.id }] }],
        allowed_mentions: { parse: [] },
      });
    }
    await redis.set('t:' + t.id, t); await redis.lpush('u:' + u.id, t.id); await redis.lpush('all', t.id);
    return res.json({ id: t.id });
  }
  const t = await redis.get('t:' + b.id);
  if (!t || (t.uid !== u.id && !u.staff)) return res.status(404).json({ error: 'not found' });
  if (b.action === 'reply') {
    const text = clip(b.text, 2000), from = u.staff && t.uid !== u.id ? 'staff' : 'user';
    if (!text || t.status === 'closed') return res.status(400).json({ error: 'Cannot reply' });
    t.msgs.push({ from, name: u.name, text, at: Date.now() });
    await say(t, `${from === 'staff' ? '🛡️' : '👤'} **${u.name}:** ${text}`);
  } else if (b.action === 'close') {
    t.status = 'closed'; await say(t, `🔒 Ticket closed by ${u.name}`);
  }
  await redis.set('t:' + t.id, t);
  res.json(view(t, u));
}
