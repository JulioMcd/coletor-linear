// Estado global — persiste enquanto a função estiver "quente" na Vercel
if (!global._barrasDB) global._barrasDB = {};

module.exports = (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET — retorna todos os escaneados
  if (req.method === 'GET') {
    return res.status(200).json(global._barrasDB);
  }

  // POST — salva um código de barras
  if (req.method === 'POST') {
    const { id, barras, user } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id obrigatório' });

    if (barras) {
      global._barrasDB[id] = { barras, user: user || 'Anônimo', ts: Date.now() };
    } else {
      delete global._barrasDB[id];
    }
    return res.status(200).json({ ok: true, total: Object.keys(global._barrasDB).length });
  }

  // DELETE — zera tudo
  if (req.method === 'DELETE') {
    global._barrasDB = {};
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'Método não permitido' });
};
