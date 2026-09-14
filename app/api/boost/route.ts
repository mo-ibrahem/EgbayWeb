import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/adminAuth';

// The admin client is constructed lazily, inside the handler below --
// never at module scope. Next.js's build-time "collect page data" step
// imports every route module (running top-level code) even though it
// never invokes the exported handler, so a throwing module-scope call
// here (createSupabaseAdmin() has no anon-key fallback, by design)
// breaks the production build if the service-role key isn't present in
// the build environment.
export async function POST(req: Request) {
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }

    const authToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: jwtError } = await supabaseAdmin.auth.getUser(authToken);

    if (jwtError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const userId = user.id;
    const body = await req.json();
    const { productId, packageId } = body;

    const durationDaysMap: Record<string, number> = { urgent: 3, featured: 7, turbo: 14 };
    const durationDays = durationDaysMap[packageId];
    if (!durationDays) {
      return NextResponse.json({ success: false, error: 'Invalid boost package' }, { status: 400 });
    }

    const { data: product } = await supabaseAdmin.from('products').select('seller_id').eq('id', productId).maybeSingle();
    if (!product) return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    if (product.seller_id !== userId) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    // Delegate financial deduction and promotion to the secure RPC
    const { data, error } = await supabaseAdmin.rpc('purchase_boost', {
      p_user_id: userId,
      p_product_id: productId,
      p_package_id: packageId
    });

    if (error) {
       console.error('[API boost] RPC Error:', error);
       return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Boost applied successfully' });
  } catch (err: any) {
    console.error('[API boost] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
