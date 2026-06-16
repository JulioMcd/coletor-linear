const { getPool } = require('./_db');

module.exports = async function handler(req, res) {
  const pool = getPool();
  try {
    if (req.method === 'POST') {
      const { produto_id, quantidade, conferente_id } = req.body || {};
      if (produto_id === undefined || quantidade === undefined) return res.status(400).json({ error: 'produto_id e quantidade obrigatórios.' });
      await pool.query(
        `UPDATE produtos SET quantidade_coletada=$1, conferente_id=$2, data_coleta=NOW() WHERE id=$3`,
        [quantidade, conferente_id || null, produto_id]
      );
      return res.status(200).json({ ok: true });
    }
    // Busca coletas de um inventário (para sync em tempo real)
    if (req.method === 'GET') {
      const { inventario_id } = req.query;
      if (!inventario_id) return res.status(400).json({ error: 'inventario_id obrigatório.' });
      const { rows } = await pool.query(
        `SELECT id, codigo, quantidade_coletada, conferente_id FROM produtos
         WHERE inventario_id=$1 AND quantidade_coletada > 0`,
        [inventario_id]
      );
      return res.status(200).json(rows);
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('coleta:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
