const { Client } = require('pg');

async function run() {
  const connectionString = 'postgresql://postgres.fpqbocohjzwlfcmfropr:DummyPassword123!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    const res = await client.query(`
      SELECT p.proname, pg_get_function_arguments(p.oid) as args, pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'release_escrow' AND n.nspname = 'public';
    `);
    
    console.log('COUNT:', res.rows.length);
    res.rows.forEach(r => {
      console.log('ARGS:', r.args);
      console.log('DEF:', r.def);
    });
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await client.end();
  }
}

run();
