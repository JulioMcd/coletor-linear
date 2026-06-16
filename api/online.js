const { getClient } = require('./_db');

module.exports = async function handler(req, res) {
  const sb = getClient();
  try {
    if (req.method === 'POST') {
      const { user_id } = req.body || {};
      if (!user_id) return res.status(400).json({ error: 'user_id obrigatorio.' });
      const { error } = await sb.from('usuarios').update({ last_seen: new Date().toISOString() }).eq('id', user_id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'GET') {
      const limit = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data, error } = await sb.from('usuarios').select('login').gte('last_seen', limit).order('login');
      if (error) throw error;
      return res.status(200).json({ usuarios: data.map(u => u.login) });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
