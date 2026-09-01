import { NextResponse } from 'next/server';
import { encryptPin } from '@/lib/encryption';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    // 1. Strict Environment Guard
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'This utility is exclusively for development environments.' }, 
        { status: 404 }
      );
    }

    const { id: orderId } = params;

    // 2. Authentication Guard
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Generate New PIN and Hashes
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    const pinHash = await bcrypt.hash(randomPin, 10);
    const encryptedPin = encryptPin(randomPin);

    // 4. Update the Database
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        handover_pin_hash: pinHash,
        handover_pin_encrypted: encryptedPin
      })
      .eq('id', orderId);

    if (updateError) {
      throw updateError;
    }

    // 5. Return Plaintext PIN strictly once to the UI
    return NextResponse.json({
      success: true,
      message: 'PIN successfully reset for testing.',
      newPin: randomPin
    });

  } catch (err: any) {
    console.error('[API /api/orders/[id]/reset-pin] error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
