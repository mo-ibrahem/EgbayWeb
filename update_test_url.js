const fs = require('fs');
let code = fs.readFileSync('test_phase4.js', 'utf8');

// Replace the Next.js API URL with the Supabase Edge Function URL
code = code.replace(
  'http://localhost:3000/api/wallet/credit?hmac=${hmac}',
  'https://fpqbocohjzwlfcmfropr.supabase.co/functions/v1/paymob-webhook?hmac=${hmac}'
);

fs.writeFileSync('test_phase4.js', code);
