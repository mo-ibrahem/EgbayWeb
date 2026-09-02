import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://fpqbocohjzwlfcmfropr.supabase.co';

/**
 * Verifies the request's bearer token belongs to an authenticated user
 * with is_admin = true on their profile. Returns the admin's user id on
 * success, or null if unauthenticated/not an admin. Every /api/admin/*
 * route must call this before doing anything else -- is_admin is only
 * ever settable server-side (service_role), so this check is the entire
 * access boundary for the admin surface.
 */
export async function requireAdmin(
  req: Request,
  supabaseAdmin: SupabaseClient
): Promise<{ adminId: string } | { error: string; status: number }> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing token', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: jwtError } = await supabaseAdmin.auth.getUser(token);
  if (jwtError || !user) {
    return { error: 'Unauthorized: Invalid token', status: 401 };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.is_admin) {
    return { error: 'Forbidden: Admin access required', status: 403 };
  }

  return { adminId: user.id };
}

export function createSupabaseAdmin() {
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  return createClient(supabaseUrl, supabaseKey);
}
