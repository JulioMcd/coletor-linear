const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// ── Estado em memória (barras escaneados) ────────────────────
let barrasDB = {};

// ── Clientes SSE conectados ──────────────────────────────────
let sseClients = [];

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter(res => {
    try { res.write(msg); return true; }
    catch(e) { return false; }
  });
}

// ── MIME types ───────────────────────────────────────────────
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
};

// ── Helpers ──────────────────────────────────────────────────
function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });
}

function jsonRes(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

// ── Servidor ─────────────────────────────────────────────────
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // ── SSE: stream de atualizações em tempo real ──────────────
  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`event: init\ndata: ${JSON.stringify(barrasDB)}\n\n`);
    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }

  // ── GET /api/barras — retorna todos os escaneados ──────────
  if (url.pathname === '/api/barras' && req.method === 'GET') {
    return jsonRes(res, 200, barrasDB);
  }

  // ── POST /api/barras — salva um código de barras ───────────
  if (url.pathname === '/api/barras' && req.method === 'POST') {
    try {
      const { id, barras, user } = JSON.parse(await readBody(req));
      if (!id) return jsonRes(res, 400, { error: 'id obrigatório' });
      if (barras) {
        barrasDB[id] = { barras, user: user || 'Anônimo' };
      } else {
        delete barrasDB[id];
      }
      broadcast('update', { id, barras: barras || '', user: user || 'Anônimo' });
      return jsonRes(res, 200, { ok: true });
    } catch(e) {
      return jsonRes(res, 400, { error: 'JSON inválido' });
    }
  }

  // ── DELETE /api/barras — zera tudo ─────────────────────────
  if (url.pathname === '/api/barras' && req.method === 'DELETE') {
    barrasDB = {};
    broadcast('reset', {});
    return jsonRes(res, 200, { ok: true });
  }

  // ── Arquivos estáticos ─────────────────────────────────────
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });

}).listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
