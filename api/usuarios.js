const { getPool } = require('./_db');

module.exports = async function handler(req, res) {
  const pool = getPool();
  try {
    if (req.method === 'GET') {
      const { rows } = await pool.query(
        `SELECT u.id, u.login, u.perfil, u.empresa_id, e.nome AS empresa_nome, u.created_at
         FROM usuarios u LEFT JOIN empresas e ON u.empresa_id = e.id ORDER BY u.login`
      );
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { login, senha, perfil, empresa_id } = req.body || {};
      if (!login || !senha || !perfil) return res.status(400).json({ error: 'login, senha e perfil são obrigatórios.' });
      await pool.query(
        `INSERT INTO usuarios (login, senha, perfil, empresa_id) VALUES ($1,$2,$3,$4)`,
        [login, senha, perfil, empresa_id || null]
      );
      return res.status(201).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório.' });
      await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('usuarios:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
