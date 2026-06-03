const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT) || 3000;

console.log(`PORT env: ${process.env.PORT}`);
console.log(`Iniciando na porta: ${PORT}`);

app.use(express.json());

// Log todas requisições
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use(express.static(path.join(__dirname)));

// Banco de dados
let pool;
let memStore = {};

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
  `).then(() => console.log('Tabela criada/verificada'))
    .catch(e => console.error('DB error:', e.message));
  console.log('Usando PostgreSQL');
} else {
  console.log('Usando memoria');
}

app.get('/api/inventario', async (req, res) => {
  try {
    if (pool) {
      const { rows } = await pool.query('SELECT codigo, qtd FROM inventario WHERE qtd > 0');
      const data = {};
      rows.forEach(r => { data[r.codigo] = r.qtd; });
      return res.json(data);
    }
    res.json(memStore);
  } catch (e) {
    console.error(e);
    res.json(memStore);
  }
});

app.post('/api/inventario', async (req, res) => {
  const { codigo, qtd, bulk, data, user } = req.body;
  try {
    if (bulk && data) {
      if (pool) {
        for (const [cod, q] of Object.entries(data)) {
          await pool.query(
            `INSERT INTO inventario (codigo, qtd, usuario) VALUES ($1,$2,$3)
             ON CONFLICT (codigo) DO UPDATE SET qtd=$2, usuario=$3, atualizado=NOW()`,
            [cod, q, user || 'anon']
          );
        }
      } else { Object.assign(memStore, data); }
    } else if (codigo !== undefined) {
      if (pool) {
        if (qtd === 0) {
          await pool.query('DELETE FROM inventario WHERE codigo=$1', [codigo]);
        } else {
          await pool.query(
            `INSERT INTO inventario (codigo, qtd, usuario) VALUES ($1,$2,$3)
             ON CONFLICT (codigo) DO UPDATE SET qtd=$2, usuario=$3, atualizado=NOW()`,
            [codigo, qtd, user || 'anon']
          );
        }
      } else {
        if (qtd === 0) delete memStore[codigo];
        else memStore[codigo] = qtd;
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, error: e.message });
  }
});

app.delete('/api/inventario', async (req, res) => {
  try {
    if (pool) await pool.query('DELETE FROM inventario');
    else memStore = {};
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Casa 505 ouvindo em 0.0.0.0:${PORT}`);
});
