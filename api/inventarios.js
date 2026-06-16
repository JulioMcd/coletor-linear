const { getClient } = require('./_db');

module.exports = async function handler(req, res) {
  const sb = getClient();
  try {
    if (req.method === 'GET') {
      const { empresa_id } = req.query;
      let q = sb.from('inventarios')
        .select('*, nome, usuarios(login), empresas(nome), produtos(id, quantidade_coletada, data_coleta)')
        .order('data_importacao', { ascending: false });
      if (empresa_id) q = q.eq('empresa_id', empresa_id);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data.map(i => ({
        ...i,
        gerador_login: i.usuarios?.login || null,
        empresa_nome: i.empresas?.nome || null,
        total_produtos: i.produtos?.length || 0,
        total_coletados: i.produtos?.filter(p => p.quantidade_coletada > 0).length || 0,
        ultima_coleta: i.produtos
          ?.filter(p => p.data_coleta)
          .map(p => p.data_coleta)
          .sort()
          .pop() || null,
        usuarios: undefined,
        empresas: undefined,
        produtos: undefined
      }));
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { empresa_id, gerador_id, nome } = req.body || {};
      if (!empresa_id || !gerador_id) return res.status(400).json({ error: 'empresa_id e gerador_id obrigatorios.' });
      const { data, error } = await sb.from('inventarios')
        .insert({ empresa_id, gerador_id, status: 'PENDENTE', nome: nome || null })
        .select('id').single();
      if (error) throw error;
      return res.status(201).json({ ok: true, id: data.id });
    }
    if (req.method === 'PUT') {
      const { id, status, inicio_contagem, fim_contagem, nome } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id obrigatorio.' });
      const upd = {};
      if (status) upd.status = status;
      if (inicio_contagem) upd.inicio_contagem = inicio_contagem;
      if (fim_contagem) upd.fim_contagem = fim_contagem;
      if (nome !== undefined) upd.nome = nome;
      const { error } = await sb.from('inventarios').update(upd).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id obrigatorio.' });
      const { error } = await sb.from('inventarios').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
