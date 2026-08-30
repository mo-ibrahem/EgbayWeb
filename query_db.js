const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fpqbocohjzwlfcmfropr.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'fake'
);
async function run() {
  const res = await fetch('https://fpqbocohjzwlfcmfropr.supabase.co/rest/v1/rpc/exec_sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY },
    body: JSON.stringify({ query: `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('orders', 'user_wallets', 'wallet_transactions', 'wallet_topups', 'payments', 'products') 
      ORDER BY table_name, ordinal_position;
    ` })
  });
  console.log(await res.text());
}
run();
