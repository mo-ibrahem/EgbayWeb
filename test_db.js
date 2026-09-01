const { Client } = require('pg');

async function run() {
  const client = new Client('postgresql://postgres.fpqbocohjzwlfcmfropr:DummyPassword123!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres');
  await client.connect();
  const res = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'handover_pin_encrypted';
  `);
  console.log('1. handover_pin_encrypted exists:', res.rows.length > 0);

  const res2 = await client.query(`
    SELECT id, status, handover_method, handover_pin_hash, handover_pin_encrypted, created_at
    FROM orders
    ORDER BY created_at DESC
    LIMIT 3;
  `);
  console.log('Recent orders:', res2.rows);

  await client.end();
}
run();
