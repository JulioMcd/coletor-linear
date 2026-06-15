const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT) || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/health', (req, res) => res.json({ status: 'ok', port: PORT }));

// ── BANCO ────────────────────────────────────────────────────
let pool;
let memStore = {};
let memColetas = {};   // { codigo: { usuario: qtd } }
let memUsuarios = {};  // { device_id: { nome, ts } }

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  pool.on('error', (err) => { console.error('Pool error:', err.message); pool = null; });

  pool.query(`
    CREATE TABLE IF NOT EXISTS inventario (
      codigo TEXT PRIMARY KEY,
      qtd NUMERIC DEFAULT 0,
      usuario TEXT,
      atualizado TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS coletas (
      codigo TEXT,
      usuario TEXT,
      qtd NUMERIC DEFAULT 0,
      atualizado TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (codigo, usuario)
    );
    CREATE TABLE IF NOT EXISTS presenca (
      device_id TEXT PRIMARY KEY,
      nome TEXT,
      ultimo_ping TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS produtos_custom (
      codigo TEXT PRIMARY KEY,
      ean TEXT DEFAULT '',
      nome TEXT NOT NULL,
      un TEXT DEFAULT 'PC',
      criado_por TEXT,
      criado_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS estado (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );
    INSERT INTO estado (chave, valor) VALUES ('zeroed_at', '1970-01-01T00:00:00.000Z')
      ON CONFLICT (chave) DO NOTHING;
  `).then(() => console.log('Tabelas OK')).catch(e => { console.error('DB init:', e.message); pool = null; });
  console.log('Usando PostgreSQL');
} else {
  console.log('Usando memoria');
}

// ── USUÁRIOS (identidade por dispositivo) ────────────────────

// Registrar/atualizar presença do dispositivo
app.post('/api/usuarios/registrar', async (req, res) => {
  const { deviceId, nome } = req.body;
  if (!deviceId) return res.json({ ok: false, error: 'deviceId obrigatório' });
  const n = (nome || '').trim() || ('Coletor-' + deviceId.slice(0, 4));
  try {
    if (pool) {
      await pool.query(
        `INSERT INTO presenca (device_id, nome) VALUES ($1, $2)
         ON CONFLICT (device_id) DO UPDATE SET nome = $2, ultimo_ping = NOW()`,
        [deviceId, n]
      );
      return res.json({ ok: true });
    }
    memUsuarios[deviceId] = { nome: n, ts: Date.now() };
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Ping de presença (mantém sessão ativa)
app.post('/api/usuarios/ping', async (req, res) => {
  const { deviceId, nome } = req.body;
  if (!deviceId) return res.json({ ok: false });
  const n = (nome || '').trim() || ('Coletor-' + deviceId.slice(0, 4));
  try {
    if (pool) {
      await pool.query(
        `INSERT INTO presenca (device_id, nome) VALUES ($1, $2)
         ON CONFLICT (device_id) DO UPDATE SET nome = $2, ultimo_ping = NOW()`,
        [deviceId, n]
      );
    } else {
      memUsuarios[deviceId] = { nome: n, ts: Date.now() };
    }
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

// Lista usuários online (ping nos últimos 2 minutos, sem duplicar dispositivo)
app.get('/api/usuarios/online', async (req, res) => {
  try {
    if (pool) {
      await pool.query(`DELETE FROM presenca WHERE ultimo_ping < NOW() - INTERVAL '5 minutes'`);
      const { rows } = await pool.query(
        `SELECT nome FROM presenca WHERE ultimo_ping > NOW() - INTERVAL '2 minutes' ORDER BY nome`
      );
      return res.json({ total: rows.length, usuarios: rows.map(r => r.nome) });
    }
    const now = Date.now();
    const ativos = Object.values(memUsuarios)
      .filter(u => now - u.ts < 120000)
      .map(u => u.nome).sort();
    res.json({ total: ativos.length, usuarios: ativos });
  } catch (e) {
    res.json({ total: 0, usuarios: [] });
  }
});

// Liberar dispositivo ao sair
app.delete('/api/usuarios/:deviceId', async (req, res) => {
  const d = req.params.deviceId;
  try {
    if (pool) await pool.query('DELETE FROM presenca WHERE device_id = $1', [d]);
    else delete memUsuarios[d];
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

// ── INVENTÁRIO ───────────────────────────────────────────────

app.get('/api/inventario', async (req, res) => {
  try {
    if (pool) {
      const [inv, col] = await Promise.all([
        pool.query('SELECT codigo, qtd, usuario, atualizado FROM inventario WHERE qtd > 0'),
        pool.query('SELECT codigo, usuario, qtd FROM coletas WHERE qtd > 0 ORDER BY codigo, usuario')
      ]);

      // monta mapa de coletas agrupadas por codigo
      const coletasPor = {};
      col.rows.forEach(r => {
        if (!coletasPor[r.codigo]) coletasPor[r.codigo] = [];
        coletasPor[r.codigo].push({ usuario: r.usuario, qtd: parseFloat(r.qtd) });
      });

      const data = {};
      inv.rows.forEach(r => {
        const coletas = coletasPor[r.codigo] || [{ usuario: r.usuario, qtd: parseFloat(r.qtd) }];
        data[r.codigo] = {
          qtd: parseFloat(r.qtd),
          usuario: r.usuario,
          atualizado: r.atualizado,
          conflito: coletas.length > 1,
          coletas
        };
      });
      const est = await pool.query(`SELECT valor FROM estado WHERE chave='zeroed_at'`);
      data._zeroed_at = est.rows[0]?.valor || null;
      return res.json(data);
    }
    res.json(memStore);
  } catch (e) {
    res.json(memStore);
  }
});

app.post('/api/inventario', async (req, res) => {
  const { codigo, qtd, bulk, data, user } = req.body;
  const usuario = (user || 'anon').trim();
  try {
    if (bulk && data) {
      if (pool) {
        for (const [cod, val] of Object.entries(data)) {
          const q = typeof val === 'object' ? (val.qtd || 0) : val;
          await pool.query(
            `INSERT INTO inventario (codigo,qtd,usuario) VALUES ($1,$2,$3)
             ON CONFLICT (codigo) DO UPDATE SET qtd=$2,usuario=$3,atualizado=NOW()`,
            [cod, q, usuario]
          );
          await pool.query(
            `INSERT INTO coletas (codigo,usuario,qtd) VALUES ($1,$2,$3)
             ON CONFLICT (codigo,usuario) DO UPDATE SET qtd=$3,atualizado=NOW()`,
            [cod, usuario, q]
          );
        }
      } else { Object.assign(memStore, data); }
    } else if (codigo !== undefined) {
      if (pool) {
        if (qtd === 0) {
          await pool.query('DELETE FROM inventario WHERE codigo=$1', [codigo]);
          await pool.query('DELETE FROM coletas WHERE codigo=$1 AND usuario=$2', [codigo, usuario]);
        } else {
          await pool.query(
            `INSERT INTO inventario (codigo,qtd,usuario) VALUES ($1,$2,$3)
             ON CONFLICT (codigo) DO UPDATE SET qtd=$2,usuario=$3,atualizado=NOW()`,
            [codigo, qtd, usuario]
          );
          await pool.query(
            `INSERT INTO coletas (codigo,usuario,qtd) VALUES ($1,$2,$3)
             ON CONFLICT (codigo,usuario) DO UPDATE SET qtd=$3,atualizado=NOW()`,
            [codigo, usuario, qtd]
          );
        }
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
    const zeroed_at = new Date().toISOString();
    if (pool) {
      await pool.query('DELETE FROM inventario');
      await pool.query('DELETE FROM coletas');
      await pool.query(`INSERT INTO estado (chave,valor) VALUES ('zeroed_at',$1)
        ON CONFLICT (chave) DO UPDATE SET valor=$1`, [zeroed_at]);
    } else { memStore = {}; }
    res.json({ ok: true, zeroed_at });
  } catch (e) {
    res.json({ ok: false });
  }
});

// ── CONFLITOS ────────────────────────────────────────────────

app.get('/api/conflitos', async (req, res) => {
  try {
    if (pool) {
      const { rows } = await pool.query(`
        SELECT c.codigo, c.usuario, c.qtd, c.atualizado
        FROM coletas c
        WHERE c.qtd > 0
          AND c.codigo IN (
            SELECT codigo FROM coletas WHERE qtd > 0
            GROUP BY codigo HAVING COUNT(DISTINCT usuario) > 1
          )
        ORDER BY c.codigo, c.usuario
      `);
      const conflitos = {};
      rows.forEach(r => {
        if (!conflitos[r.codigo]) conflitos[r.codigo] = [];
        conflitos[r.codigo].push({ usuario: r.usuario, qtd: parseFloat(r.qtd) });
      });
      return res.json(conflitos);
    }
    res.json({});
  } catch (e) {
    res.json({});
  }
});

// ── PRODUTOS CUSTOM ──────────────────────────────────────────

app.get('/api/produtos/custom', async (req, res) => {
  try {
    if (pool) {
      const { rows } = await pool.query('SELECT codigo, ean, nome, un FROM produtos_custom ORDER BY nome');
      return res.json(rows);
    }
    res.json([]);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/produtos', async (req, res) => {
  const { codigo, ean, nome, un, usuario } = req.body;
  if (!codigo || !nome) return res.status(400).json({ ok: false, error: 'Código e nome são obrigatórios' });
  try {
    if (pool) {
      await pool.query(
        `INSERT INTO produtos_custom (codigo, ean, nome, un, criado_por)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (codigo) DO UPDATE SET ean=$2, nome=$3, un=$4, criado_por=$5`,
        [codigo.trim(), (ean || '').trim(), nome.trim(), (un || 'PC').trim(), usuario || 'anon']
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.delete('/api/produtos/:codigo', async (req, res) => {
  try {
    if (pool) await pool.query('DELETE FROM produtos_custom WHERE codigo = $1', [req.params.codigo]);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Casa 505 na porta ${PORT}`));
