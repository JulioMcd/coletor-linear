const { getPool } = require('./_db');

module.exports = async function handler(req, res) {
  const pool = getPool();
  try {
    if (req.method === 'POST') {
      const { user_id } = req.body || {};
      if (!user_id) return res.status(400).json({ error: 'user_id obrigatorio.' });
      await pool.query('UPDATE usuarios SET last_seen = NOW() WHERE id = $1', [user_id]);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'GET') {
      const { rows } = await pool.query(
        `SELECT login FROM usuarios WHERE last_seen > NOW() - INTERVAL '30 minutes' ORDER BY login`
      );
      return res.status(200).json({ usuarios: rows.map(function(r) { return r.login; }) });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('online:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
