const { getPool } = require('./_db');

module.exports = async function handler(req, res) {
  const pool = getPool();
  try {
    if (req.method === 'GET') {
      const { empresa_id } = req.query;
      const { rows } = empresa_id
        ? await pool.query(
            `SELECT i.*, u.login AS gerador_login,
               (SELECT COUNT(*) FROM produtos p WHERE p.inventario_id = i.id) AS total_produtos,
               (SELECT COUNT(*) FROM produtos p WHERE p.inventario_id = i.id AND p.quantidade_coletada > 0) AS total_coletados
             FROM inventarios i LEFT JOIN usuarios u ON i.gerador_id = u.id
             WHERE i.empresa_id=$1 ORDER BY i.data_importacao DESC`, [empresa_id])
        : await pool.query(
            `SELECT i.*, u.login AS gerador_login,
               (SELECT COUNT(*) FROM produtos p WHERE p.inventario_id = i.id) AS total_produtos,
               (SELECT COUNT(*) FROM produtos p WHERE p.inventario_id = i.id AND p.quantidade_coletada > 0) AS total_coletados
             FROM inventarios i LEFT JOIN usuarios u ON i.gerador_id = u.id
             ORDER BY i.data_importacao DESC`);
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { empresa_id, gerador_id } = req.body || {};
      if (!empresa_id || !gerador_id) return res.status(400).json({ error: 'empresa_id e gerador_id obrigatórios.' });
      const { rows } = await pool.query(
        `INSERT INTO inventarios (empresa_id, gerador_id, status) VALUES ($1,$2,'PENDENTE') RETURNING id`,
        [empresa_id, gerador_id]
      );
      return res.status(201).json({ ok: true, id: rows[0].id });
    }
    if (req.method === 'PUT') {
      const { id, status, inicio_contagem, fim_contagem } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id obrigatório.' });
      await pool.query(
        `UPDATE inventarios SET
           status = COALESCE($1, status),
           inicio_contagem = COALESCE($2::timestamp, inicio_contagem),
           fim_contagem = COALESCE($3::timestamp, fim_contagem)
         WHERE id=$4`,
        [status || null, inicio_contagem || null, fim_contagem || null, id]
      );
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('inventarios:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
