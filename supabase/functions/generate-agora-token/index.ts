// Supabase Edge Function: generate-agora-token
// Deploy with: supabase functions deploy generate-agora-token
//
// Required environment variables in Supabase Dashboard → Settings → Edge Functions:
//   AGORA_APP_ID     → Your Agora App ID (from console.agora.io)
//   AGORA_APP_CERT   → Your Agora App Certificate (keep this SECRET, never in client code)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Agora RtcTokenBuilder (inline — no external dep needed) ───────────────
// Reference: https://github.com/AgoraIO/Tools/tree/master/DynamicKey/AgoraDynamicKey

function intToLittleEndianBytes(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = value & 0xff;
  buf[1] = (value >> 8) & 0xff;
  buf[2] = (value >> 16) & 0xff;
  buf[3] = (value >> 24) & 0xff;
  return buf;
}

function packContent(items: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const item of items) total += 2 + item.length;
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const item of items) {
    buf[offset++] = item.length & 0xff;
    buf[offset++] = (item.length >> 8) & 0xff;
    buf.set(item, offset);
    offset += item.length;
  }
  return buf;
}

async function buildRtcToken(
  appId: string,
  appCert: string,
  channelName: string,
  uid: number,
  role: number, // 1 = Publisher (host), 2 = Subscriber (audience)
  expireTs: number
): Promise<string> {
  const encoder = new TextEncoder();

  const version = '006';
  const msgTs = Math.floor(Date.now() / 1000);
  const salt = Math.floor(Math.random() * 0xffffffff);

  // Privileges
  const privileges: Record<number, number> = {};
  if (role === 1) {
    privileges[1] = expireTs; // kJoinChannel
    privileges[2] = expireTs; // kPublishAudioStream
    privileges[3] = expireTs; // kPublishVideoStream
    privileges[5] = expireTs; // kPublishDataStream
  } else {
    privileges[1] = expireTs; // kJoinChannel only
    privileges[7] = expireTs; // kSubscribeVideoStream
    privileges[8] = expireTs; // kSubscribeAudioStream
  }

  // Build message
  const msgParts: Uint8Array[] = [
    intToLittleEndianBytes(salt),
    intToLittleEndianBytes(msgTs),
    intToLittleEndianBytes(expireTs),
  ];

  // Privileges map
  const privEntries = Object.entries(privileges);
  const privBuf = new Uint8Array(2 + privEntries.length * 6);
  let o = 0;
  privBuf[o++] = privEntries.length & 0xff;
  privBuf[o++] = (privEntries.length >> 8) & 0xff;
  for (const [k, v] of privEntries) {
    const key = parseInt(k);
    privBuf[o++] = key & 0xff;
    privBuf[o++] = (key >> 8) & 0xff;
    privBuf[o++] = v & 0xff;
    privBuf[o++] = (v >> 8) & 0xff;
    privBuf[o++] = (v >> 16) & 0xff;
    privBuf[o++] = (v >> 24) & 0xff;
  }
  msgParts.push(privBuf);

  const msgContent = packContent(msgParts);

  // Signing string
  const uidStr = uid === 0 ? '' : String(uid);
  const sigStr = encoder.encode(appId + channelName + uidStr);
  const sigBuf = new Uint8Array([...sigStr, ...intToLittleEndianBytes(msgTs), ...intToLittleEndianBytes(salt), ...msgContent]);

  // HMAC-SHA256 signature
  const key = await crypto.subtle.importKey('raw', encoder.encode(appCert), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, sigBuf));

  // Build token
  const tokenParts = [
    encoder.encode(appId),
    encoder.encode(uidStr),
    encoder.encode(channelName),
    sigBytes,
    msgContent,
  ];
  const tokenContent = packContent(tokenParts);

  const base64 = btoa(String.fromCharCode(...tokenContent));
  return version + base64;
}

// ── Handler ───────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { channelName, uid, role } = await req.json();

    if (!channelName || uid === undefined || !role) {
      return new Response(JSON.stringify({ error: 'Missing channelName, uid, or role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appId = Deno.env.get('AGORA_APP_ID');
    const appCert = Deno.env.get('AGORA_APP_CERT');

    if (!appId || !appCert) {
      throw new Error('AGORA_APP_ID and AGORA_APP_CERT must be set in Edge Function environment');
    }

    // Token expires in 3 hours for hosts, 2 hours for viewers
    const expirySeconds = role === 'host' ? 10800 : 7200;
    const expireTs = Math.floor(Date.now() / 1000) + expirySeconds;
    const agoraRole = role === 'host' ? 1 : 2;

    const token = await buildRtcToken(appId, appCert, channelName, uid, agoraRole, expireTs);

    return new Response(JSON.stringify({ token, channel: channelName, expireTs }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
