const { getPool } = require('./_db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { login, senha } = req.body || {};
  if (!login || !senha) return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT u.id, u.login, u.perfil, u.empresa_id, e.nome AS empresa_nome, e.logo_url
       FROM usuarios u LEFT JOIN empresas e ON u.empresa_id = e.id
       WHERE u.login = $1 AND u.senha = $2`,
      [login, senha]
    );
    if (!rows.length) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    const u = rows[0];
    await pool.query('UPDATE usuarios SET last_seen = NOW() WHERE id = $1', [u.id]);
    return res.status(200).json({
      ok: true,
      user: { id: u.id, login: u.login, perfil: u.perfil, empresa_id: u.empresa_id, empresa_nome: u.empresa_nome, logo_url: u.logo_url }
    });
  } catch (e) {
    console.error('login:', e.message);
    return res.status(500).json({ error: 'Erro interno.' });
  }
};
