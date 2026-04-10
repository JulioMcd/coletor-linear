if (!global._barrasDB) global._barrasDB = {};

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET
  if (req.method === 'GET') {
    return res.status(200).json(global._barrasDB);
  }

  // POST — individual ou bulk
  if (req.method === 'POST') {
    const body = req.body || {};

    // Bulk: recebe vários de uma vez (quando client reconecta)
    if (body.bulk && body.data) {
      const user = body.user || 'Anônimo';
      Object.keys(body.data).forEach(id => {
        // Só adiciona se não existir no servidor (não sobrescreve dados mais recentes)
        if (!global._barrasDB[id]) {
          global._barrasDB[id] = { barras: body.data[id], user, ts: Date.now() };
        }
      });
      return res.status(200).json({ ok: true, total: Object.keys(global._barrasDB).length });
    }

    // Individual
    const { id, barras, user } = body;
    if (!id) return res.status(400).json({ error: 'id obrigatório' });

    if (barras) {
      global._barrasDB[id] = { barras, user: user || 'Anônimo', ts: Date.now() };
    } else {
      delete global._barrasDB[id];
    }
    return res.status(200).json({ ok: true, total: Object.keys(global._barrasDB).length });
  }

  // DELETE
  if (req.method === 'DELETE') {
    global._barrasDB = {};
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'Método não permitido' });
};
