const { getPool } = require('./_db');

module.exports = async function handler(req, res) {
  const pool = getPool();
  try {
    if (req.method === 'GET') {
      const { rows } = await pool.query('SELECT * FROM empresas ORDER BY nome');
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { nome, logo_url } = req.body || {};
      if (!nome) return res.status(400).json({ error: 'nome é obrigatório.' });
      const { rows } = await pool.query(
        `INSERT INTO empresas (nome, logo_url) VALUES ($1,$2) RETURNING id`,
        [nome, logo_url || '']
      );
      return res.status(201).json({ ok: true, id: rows[0].id });
    }
    if (req.method === 'PUT') {
      const { id, nome, logo_url } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id obrigatório.' });
      await pool.query(
        `UPDATE empresas SET nome=COALESCE($1,nome), logo_url=COALESCE($2,logo_url) WHERE id=$3`,
        [nome, logo_url, id]
      );
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id obrigatório.' });
      await pool.query('DELETE FROM empresas WHERE id=$1', [id]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('empresas:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
