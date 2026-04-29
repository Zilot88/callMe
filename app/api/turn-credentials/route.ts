import { NextResponse } from 'next/server';

// Fallback TURN servers used when METERED_API_KEY is missing or the
// Metered.ca API call fails. STUN-only fallback was the root cause of
// black-screen calls behind NAT — without any relay candidates, peers
// across different networks cannot establish a media path.
const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  // Public Open Relay Project TURN — no auth required, free, community-run
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  // Static Metered free-tier credentials — second layer of fallback
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: 'cbf0ad6518714f46c139ebe6',
    credential: 'nkmonuq3beg/U+ws',
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: 'cbf0ad6518714f46c139ebe6',
    credential: 'nkmonuq3beg/U+ws',
  },
  {
    urls: 'turns:global.relay.metered.ca:443?transport=tcp',
    username: 'cbf0ad6518714f46c139ebe6',
    credential: 'nkmonuq3beg/U+ws',
  },
];

function hasTurn(iceServers: unknown): boolean {
  if (!Array.isArray(iceServers)) return false;
  return iceServers.some((s) => {
    const urls = (s as { urls?: string | string[] }).urls;
    if (typeof urls === 'string') return urls.startsWith('turn:') || urls.startsWith('turns:');
    if (Array.isArray(urls)) return urls.some((u) => u.startsWith('turn:') || u.startsWith('turns:'));
    return false;
  });
}

export async function GET() {
  const apiKey = process.env.METERED_API_KEY;

  if (!apiKey) {
    console.warn('[turn-credentials] METERED_API_KEY not set — returning fallback TURN servers');
    return NextResponse.json({ iceServers: FALLBACK_ICE_SERVERS });
  }

  try {
    const response = await fetch(
      `https://callme.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
      { cache: 'no-store' },
    );

    if (!response.ok) {
      throw new Error(`Metered API ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Defence-in-depth: if Metered returned a config without TURN
    // (quota exhausted, account misconfigured, etc.), append our fallback
    // TURN servers so the client never ends up with STUN-only.
    if (!hasTurn(data?.iceServers)) {
      console.warn('[turn-credentials] Metered API returned no TURN — appending fallback TURN servers');
      return NextResponse.json({
        iceServers: [...(data?.iceServers ?? []), ...FALLBACK_ICE_SERVERS.filter((s) => {
          const urls = s.urls;
          return urls.startsWith('turn:') || urls.startsWith('turns:');
        })],
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[turn-credentials] Error fetching from Metered, using fallback:', error);
    return NextResponse.json({ iceServers: FALLBACK_ICE_SERVERS });
  }
}
