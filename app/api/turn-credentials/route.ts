import { NextResponse } from 'next/server';

// Single TURN provider: Metered.ca (free 20 GB/mo plan). The client also needs
// STUN so most calls connect directly P2P and DON'T burn the relay quota —
// Metered already returns its own STUN, and we add a couple of public STUN
// servers as a safety net. If the Metered key is missing/unreachable we return
// STUN-only (calls work on simple NATs; symmetric NAT will need TURN restored).

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const STUN_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

// Your Metered app subdomain: <appname>.metered.live. MUST match the account
// the API key belongs to, or Metered returns 401. Override via METERED_DOMAIN.
const METERED_APP = process.env.METERED_DOMAIN || 'olikirolli';

async function getMeteredIceServers(): Promise<IceServer[]> {
  const apiKey = process.env.METERED_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://${METERED_APP}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      throw new Error(`Metered API ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    return Array.isArray(data?.iceServers) ? data.iceServers : [];
  } catch (error) {
    console.error('[turn-credentials] Metered TURN failed:', error);
    return [];
  }
}

export async function GET() {
  const metered = await getMeteredIceServers();
  const iceServers: IceServer[] = [...metered, ...STUN_SERVERS];

  if (metered.length === 0) {
    console.warn('[turn-credentials] No Metered TURN — serving STUN only (relay will fail on symmetric NAT)');
  }

  return NextResponse.json({ iceServers });
}
