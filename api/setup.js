import { discord } from '../lib/util.js';
// Один раз откройте: /api/setup?key=ВАШ_SESSION_SECRET — регистрирует команды /reply и /close
export default async function handler(req, res) {
  if (req.query.key !== process.env.SESSION_SECRET) return res.status(401).end();
  res.json(await discord(`/applications/${process.env.DISCORD_CLIENT_ID}/guilds/${process.env.GUILD_ID}/commands`, 'PUT', [
    { name: 'reply', description: 'Reply to the ticket author', options: [{ type: 3, name: 'text', description: 'Your message', required: true }] },
    { name: 'close', description: 'Close this ticket' },
  ]));
}
