const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    pool.on('error', (err) => { console.error('Pool error:', err.message); pool = null; });
  }
  return pool;
}

module.exports = { getPool };
