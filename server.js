const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const FILE = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(FILE).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on port ${PORT}`);
});
