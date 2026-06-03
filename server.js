const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Banco de dados
let pool;
let memStore = {}; // fallback em memória

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  pool.query(`
    CREATE TABLE IF NOT EXISTS inventario (
      codigo TEXT PRIMARY KEY,
      qtd INTEGER DEFAULT 0,
      usuario TEXT,
      atualizado TIMESTAMP DEFAULT NOW()
    )
  `).catch(console.error);
  console.log('Usando PostgreSQL');
} else {
  console.log('Usando memória (sem DATABASE_URL)');
}

// GET - retorna inventário completo
app.get('/api/inventario', async (req, res) => {
  if (pool) {
    const { rows } = await pool.query('SELECT codigo, qtd FROM inventario WHERE qtd > 0');
    const data = {};
    rows.forEach(r => { data[r.codigo] = r.qtd; });
    res.json(data);
  } else {
    res.json(memStore);
  }
});

// POST - atualiza quantidade
app.post('/api/inventario', async (req, res) => {
  const { codigo, qtd, bulk, data, user } = req.body;

  if (bulk && data) {
    // Envio em lote
    if (pool) {
      for (const [cod, q] of Object.entries(data)) {
        await pool.query(
          `INSERT INTO inventario (codigo, qtd, usuario) VALUES ($1, $2, $3)
           ON CONFLICT (codigo) DO UPDATE SET qtd = $2, usuario = $3, atualizado = NOW()`,
          [cod, q, user || 'anon']
        );
      }
    } else {
      Object.assign(memStore, data);
    }
  } else if (codigo !== undefined) {
    if (pool) {
      if (qtd === 0) {
        await pool.query('DELETE FROM inventario WHERE codigo = $1', [codigo]);
      } else {
        await pool.query(
          `INSERT INTO inventario (codigo, qtd, usuario) VALUES ($1, $2, $3)
           ON CONFLICT (codigo) DO UPDATE SET qtd = $2, usuario = $3, atualizado = NOW()`,
          [codigo, qtd, user || 'anon']
        );
      }
    } else {
      if (qtd === 0) delete memStore[codigo];
      else memStore[codigo] = qtd;
    }
  }

  res.json({ ok: true });
});

// DELETE - zera tudo
app.delete('/api/inventario', async (req, res) => {
  if (pool) {
    await pool.query('DELETE FROM inventario');
  } else {
    memStore = {};
  }
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Casa 505 rodando na porta ${PORT}`);
});
