const { getClient } = require('./_db');

module.exports = async function handler(req, res) {
  const sb = getClient();
  try {
    if (req.method === 'POST') {
      const { produto_id, quantidade, conferente_id } = req.body || {};
      if (produto_id === undefined || quantidade === undefined) return res.status(400).json({ error: 'produto_id e quantidade obrigatorios.' });
      const { error } = await sb.from('produtos').update({ quantidade_coletada: quantidade, conferente_id: conferente_id || null, data_coleta: new Date().toISOString() }).eq('id', produto_id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'GET') {
      const { inventario_id } = req.query;
      if (!inventario_id) return res.status(400).json({ error: 'inventario_id obrigatorio.' });
      const { data, error } = await sb.from('produtos').select('id, codigo, quantidade_coletada, conferente_id').eq('inventario_id', inventario_id).gt('quantidade_coletada', 0);
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { inventario_id } = req.query;
      if (!inventario_id) return res.status(400).json({ error: 'inventario_id obrigatorio.' });
      const { error } = await sb.from('produtos')
        .update({ quantidade_coletada: 0, conferente_id: null, data_coleta: null })
        .eq('inventario_id', inventario_id);
      if (error) throw error;
      return res.status(200).json({ ok: true, zeroed_at: new Date().toISOString() });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
