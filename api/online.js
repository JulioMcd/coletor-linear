const { getClient } = require('./_db');

module.exports = async function handler(req, res) {
  const sb = getClient();
  try {
    if (req.method === 'POST') {
      const { user_id } = req.body || {};
      if (!user_id) return res.status(400).json({ error: 'user_id obrigatorio.' });
      const { error } = await sb.from('usuarios').update({ last_seen: new Date().toISOString() }).eq('id', user_id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'GET') {
      const limit = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data, error } = await sb.from('usuarios')
        .select('login, perfil, last_seen, empresas(nome)')
        .gte('last_seen', limit)
        .order('last_seen', { ascending: false });
      if (error) throw error;
      const usuarios = data.map(u => ({
        login: u.login,
        perfil: u.perfil,
        last_seen: u.last_seen,
        empresa_nome: u.empresas?.nome || ''
      }));
      return res.status(200).json({ usuarios, total: usuarios.length });
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
