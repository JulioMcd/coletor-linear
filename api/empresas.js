const { getClient } = require('./_db');

module.exports = async function handler(req, res) {
  const sb = getClient();
  try {
    if (req.method === 'GET') {
      const { data, error } = await sb.from('empresas').select('*').order('nome');
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { nome, logo_url } = req.body || {};
      if (!nome) return res.status(400).json({ error: 'nome obrigatorio.' });
      const { error } = await sb.from('empresas').insert({ nome, logo_url: logo_url || '' });
      if (error) throw error;
      return res.status(201).json({ ok: true });
    }
    if (req.method === 'PUT') {
      const { id, nome, logo_url } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id obrigatorio.' });
      const { error } = await sb.from('empresas').update({ nome, logo_url }).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id obrigatorio.' });
      const { error } = await sb.from('empresas').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
