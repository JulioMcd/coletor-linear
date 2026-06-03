const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT) || 3000;

app.use(express.json());

// Serve index.html na rota raiz diretamente (evita problema do static com arquivo grande)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

// Banco de dados
let pool;
let memStore = {};

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // CRITICAL: sem este handler o processo crasha quando o banco falha
  pool.on('error', (err) => {
    console.error('Pool error (ignorado):', err.message);
    pool = null; // cai para memória se banco falhar
  });

  pool.query(`
    CREATE TABLE IF NOT EXISTS inventario (
      codigo TEXT PRIMARY KEY,
      qtd INTEGER DEFAULT 0,
      usuario TEXT,
      atualizado TIMESTAMP DEFAULT NOW()
    )
  `).then(() => console.log('Tabela OK'))
    .catch(e => {
      console.error('DB init error:', e.message);
      pool = null; // usa memória como fallback
    });
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
            `INSERT INTO inventario (codigo,qtd,usuario) VALUES ($1,$2,$3)
             ON CONFLICT (codigo) DO UPDATE SET qtd=$2,usuario=$3,atualizado=NOW()`,
            [cod, q, user || 'anon']
          );
        }
      } else { Object.assign(memStore, data); }
    } else if (codigo !== undefined) {
      if (pool) {
        if (qtd === 0) await pool.query('DELETE FROM inventario WHERE codigo=$1', [codigo]);
        else await pool.query(
          `INSERT INTO inventario (codigo,qtd,usuario) VALUES ($1,$2,$3)
           ON CONFLICT (codigo) DO UPDATE SET qtd=$2,usuario=$3,atualizado=NOW()`,
          [codigo, qtd, user || 'anon']
        );
      } else {
        if (qtd === 0) delete memStore[codigo];
        else memStore[codigo] = qtd;
      }
    }
    res.json({ ok: true });
  } catch (e) {
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
  console.log(`Casa 505 na porta ${PORT}`);
});
