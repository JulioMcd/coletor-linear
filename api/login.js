const { getClient } = require('./_db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { login, senha } = req.body || {};
  if (!login || !senha) return res.status(400).json({ error: 'Usuario e senha obrigatorios.' });
  try {
    const sb = getClient();
    const { data, error } = await sb
      .from('usuarios')
      .select('id, login, perfil, empresa_id, senha, empresas(nome, logo_url)')
      .eq('login', login)
      .eq('senha', senha)
      .single();
    if (error || !data) return res.status(401).json({ error: 'Usuario ou senha invalidos.' });
    await sb.from('usuarios').update({ last_seen: new Date().toISOString() }).eq('id', data.id);
    return res.status(200).json({
      ok: true,
      user: {
        id: data.id,
        login: data.login,
        perfil: data.perfil,
        empresa_id: data.empresa_id,
        empresa_nome: data.empresas?.nome || '',
        logo_url: data.empresas?.logo_url || ''
      }
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
