const { getClient } = require('./_db');

module.exports = async function handler(req, res) {
  const sb = getClient();
  try {
    if (req.method === 'GET') {
      const { data, error } = await sb
        .from('usuarios')
        .select('id, login, perfil, empresa_id, created_at, empresas(nome)')
        .order('login');
      if (error) throw error;
      const rows = data.map(u => ({ ...u, empresa_nome: u.empresas?.nome || null }));
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { login, senha, perfil, empresa_id } = req.body || {};
      if (!login || !senha || !perfil) return res.status(400).json({ error: 'login, senha e perfil obrigatorios.' });
      const { error } = await sb.from('usuarios').insert({ login, senha, perfil, empresa_id: empresa_id || null });
      if (error) throw error;
      return res.status(201).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id obrigatorio.' });
      const { error } = await sb.from('usuarios').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
