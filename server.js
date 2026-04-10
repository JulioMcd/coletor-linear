const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// ── Estado em memória ────────────────────────────────────────
let barrasDB = {};

// ── Clientes SSE conectados ──────────────────────────────────
let sseClients = [];

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter(res => {
    try {
      res.write(msg);
      if (res.flush) res.flush(); // força envio imediato
      return true;
    } catch(e) { return false; }
  });
  console.log(`[SSE] broadcast ${event} para ${sseClients.length} clientes`);
}

// ── Keepalive: manda ping a cada 15s pra não cair ────────────
setInterval(() => {
  sseClients = sseClients.filter(res => {
    try { res.write(`:ping\n\n`); return true; }
    catch(e) { return false; }
  });
}, 15000);

// ── MIME types ───────────────────────────────────────────────
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
};

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

  // CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // ── SSE stream ─────────────────────────────────────────────
  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });

    // Desabilita buffering do Node
    res.socket.setNoDelay(true);
    res.socket.setKeepAlive(true);

    res.write(`event: init\ndata: ${JSON.stringify(barrasDB)}\n\n`);
    sseClients.push(res);
    console.log(`[SSE] +1 cliente (total: ${sseClients.length})`);

    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
      console.log(`[SSE] -1 cliente (total: ${sseClients.length})`);
    });
    return;
  }

  // ── GET /api/barras ────────────────────────────────────────
  if (url.pathname === '/api/barras' && req.method === 'GET') {
    return jsonRes(res, 200, barrasDB);
  }

  // ── POST /api/barras ───────────────────────────────────────
  if (url.pathname === '/api/barras' && req.method === 'POST') {
    try {
      const { id, barras, user } = JSON.parse(await readBody(req));
      if (!id) return jsonRes(res, 400, { error: 'id obrigatório' });

      const userName = user || 'Anônimo';
      if (barras) {
        barrasDB[id] = { barras, user: userName };
      } else {
        delete barrasDB[id];
      }

      console.log(`[API] ${userName} -> produto ${id} = "${barras || '(removido)'}"`);
      broadcast('update', { id, barras: barras || '', user: userName });
      return jsonRes(res, 200, { ok: true });
    } catch(e) {
      return jsonRes(res, 400, { error: 'JSON inválido' });
    }
  }

  // ── DELETE /api/barras ─────────────────────────────────────
  if (url.pathname === '/api/barras' && req.method === 'DELETE') {
    barrasDB = {};
    console.log('[API] RESET - tudo zerado');
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
