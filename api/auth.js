import { sign, user, discord } from '../lib/util.js';
const E = process.env;
export default async function handler(req, res) {
  const a = req.query.a, ru = `https://${req.headers.host}/api/auth?a=callback`;
  if (a === 'login') return res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${E.DISCORD_CLIENT_ID}&response_type=code&scope=identify&redirect_uri=${encodeURIComponent(ru)}`);
  if (a === 'out') { res.setHeader('Set-Cookie', 's=; Path=/; Max-Age=0'); return res.redirect('/'); }
  if (a === 'me') { const u = user(req); return res.json({ user: u && { id: u.id, name: u.name, avatar: u.avatar, staff: u.staff } }); }
  if (a === 'callback') {
    const tk = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: E.DISCORD_CLIENT_ID, client_secret: E.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code: req.query.code || '', redirect_uri: ru }),
    }).then((r) => r.json());
    if (!tk.access_token) return res.redirect('/');
    const d = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: 'Bearer ' + tk.access_token } }).then((r) => r.json());
    const m = await discord(`/guilds/${E.GUILD_ID}/members/${d.id}`);
    const o = { id: d.id, name: d.global_name || d.username, staff: !!(m.roles && m.roles.includes(E.STAFF_ROLE_ID)), exp: Date.now() + 864e5,
      avatar: d.avatar ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png?size=64` : null };
    res.setHeader('Set-Cookie', `s=${sign(o)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);
    return res.redirect('/');
  }
  res.status(404).end();
}
