const fs = require('fs');
let code = fs.readFileSync('test_phase4.js', 'utf8');

// Replace the exec_sql call to create users
const newCode = `
  const { data: bUser, error: bErr } = await supabase.auth.admin.createUser({
    email: 'buyer@test.com',
    password: 'dummy',
    email_confirm: true
  });
  const { data: sUser, error: sErr } = await supabase.auth.admin.createUser({
    email: 'seller@test.com',
    password: 'dummy',
    email_confirm: true
  });
  // Ignore errors if they already exist
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const buyerId = usersData.users.find(u => u.email === 'buyer@test.com')?.id;
  const sellerId = usersData.users.find(u => u.email === 'seller@test.com')?.id;
`;

// Replace lines 49-72
code = code.replace(/const resUsers = await fetch\([\s\S]*?\n\s+const authRes = await fetch\([\s\S]*?body: JSON.stringify\({ query: \`SELECT id, email FROM auth\.users WHERE email IN \('buyer@test\.com', 'seller@test\.com'\);\` }\)\n\s+\}\);\n\s+const authData = await authRes\.json\(\);\n\s+const rows = authData\.rows \|\| \[\];\n\s+const buyerId = rows\.find\(r => r\.email === 'buyer@test\.com'\)\?\.id;\n\s+const sellerId = rows\.find\(r => r\.email === 'seller@test\.com'\)\?\.id;/m, newCode);

fs.writeFileSync('test_phase4.js', code);
