process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    const connStr = (process.env.DATABASE_URL || '').replace('?sslmode=require', '');
    pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    pool.on('error', (err) => { console.error('Pool error:', err.message); pool = null; });
  }
  return pool;
}

module.exports = { getPool };
