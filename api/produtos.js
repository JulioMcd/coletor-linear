const { getPool } = require('./_db');

module.exports = async function handler(req, res) {
  const pool = getPool();
  try {
    if (req.method === 'GET') {
      const { inventario_id } = req.query;
      if (!inventario_id) return res.status(400).json({ error: 'inventario_id obrigatório.' });
      const { rows } = await pool.query(
        `SELECT p.*, u.login AS conferente_login
         FROM produtos p LEFT JOIN usuarios u ON p.conferente_id = u.id
         WHERE p.inventario_id=$1 ORDER BY p.descricao`,
        [inventario_id]
      );
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { inventario_id, produtos } = req.body || {};
      if (!inventario_id || !Array.isArray(produtos)) return res.status(400).json({ error: 'inventario_id e produtos[] obrigatórios.' });
      // Insere em batch
      for (const p of produtos) {
        await pool.query(
          `INSERT INTO produtos (inventario_id, codigo, descricao, unidade, ean, quantidade_esperada)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [inventario_id, p.codigo || '', p.descricao || p.nome || '', p.unidade || p.un || 'PC', p.ean || '', p.quantidade_esperada || 0]
        );
      }
      // Atualiza status do inventário para EM_ANDAMENTO
      await pool.query(
        `UPDATE inventarios SET status='EM_ANDAMENTO', inicio_contagem=NOW() WHERE id=$1 AND status='PENDENTE'`,
        [inventario_id]
      );
      return res.status(201).json({ ok: true, inseridos: produtos.length });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('produtos:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
