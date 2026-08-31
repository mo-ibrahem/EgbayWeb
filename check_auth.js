const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://fpqbocohjzwlfcmfropr.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcWJvY29oanp3bGZjbWZyb3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NTkzNDMsImV4cCI6MjA2NDUzNTM0M30.P6atGZ_u0rkbr76qoIBJN5bRGhe2nESQctXoc25d3xU';

async function run() {
  const client1 = createClient(supabaseUrl, anonKey);
  const { data: { session }, error: loginErr } = await client1.auth.signInWithPassword({
    email: 'buyer@test.com',
    password: 'dummy'
  });
  if (loginErr || !session) {
    console.error('Login failed:', loginErr);
    return;
  }
  console.log('Got token:', session.access_token.substring(0, 10) + '...');
  
  const client2 = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: jwtError } = await client2.auth.getUser(session.access_token);
  console.log('getUser result:', user ? 'success' : 'failed', jwtError);
}
run();
