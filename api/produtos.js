const { getClient } = require('./_db');

module.exports = async function handler(req, res) {
  const sb = getClient();
  try {
    if (req.method === 'GET') {
      const { inventario_id } = req.query;
      if (!inventario_id) return res.status(400).json({ error: 'inventario_id obrigatorio.' });
      const { data, error } = await sb.from('produtos').select('*, usuarios(login)').eq('inventario_id', inventario_id).order('descricao');
      if (error) throw error;
      return res.status(200).json(data.map(p => ({ ...p, conferente_login: p.usuarios?.login || null, usuarios: undefined })));
    }
    if (req.method === 'POST') {
      const { inventario_id, produtos } = req.body || {};
      if (!inventario_id || !Array.isArray(produtos)) return res.status(400).json({ error: 'inventario_id e produtos[] obrigatorios.' });
      const rows = produtos.map(p => ({
        inventario_id,
        codigo: p.codigo || '',
        descricao: p.descricao || p.nome || '',
        unidade: p.unidade || p.un || 'PC',
        ean: p.ean || '',
        quantidade_esperada: p.quantidade_esperada || 0
      }));
      const { error } = await sb.from('produtos').insert(rows);
      if (error) throw error;
      await sb.from('inventarios').update({ status: 'EM_ANDAMENTO', inicio_contagem: new Date().toISOString() }).eq('id', inventario_id).eq('status', 'PENDENTE');
      return res.status(201).json({ ok: true, inseridos: rows.length });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
