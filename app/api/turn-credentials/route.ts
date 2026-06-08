import { NextResponse } from 'next/server';

// Single TURN provider: Metered.ca (olikirolli account, Free 20GB plan).
//
// TURN credentials are NOT secret (they are sent to every browser in the ICE
// config), so we keep a known-good static credential hardcoded as the reliable
// base. If METERED_API_KEY is set we additionally try the REST API for fresh
// credentials, but the static set guarantees relay works without any env/API
// dependency. STUN is included so most calls go direct P2P and conserve quota.

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

// Your Metered app subdomain. Override via METERED_DOMAIN.
const METERED_APP = process.env.METERED_DOMAIN || 'olikirolli';

// Known-good static credential from the Metered dashboard (olikirolli account).
// Includes Metered's own STUN + TURN over UDP/TCP/TLS on 80/443.
const STATIC_METERED: IceServer[] = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:standard.relay.metered.ca:80', username: 'd09bbd26fe05452c4e9a7b35', credential: 'uEdD0mA1psVL8S2v' },
  { urls: 'turn:standard.relay.metered.ca:80?transport=tcp', username: 'd09bbd26fe05452c4e9a7b35', credential: 'uEdD0mA1psVL8S2v' },
  { urls: 'turn:standard.relay.metered.ca:443', username: 'd09bbd26fe05452c4e9a7b35', credential: 'uEdD0mA1psVL8S2v' },
  { urls: 'turns:standard.relay.metered.ca:443?transport=tcp', username: 'd09bbd26fe05452c4e9a7b35', credential: 'uEdD0mA1psVL8S2v' },
];

// Extra public STUN for redundancy (free, no relay traffic).
const EXTRA_STUN: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

// Try the Metered REST API for fresh credentials. The endpoint returns a BARE
// array of ice servers (NOT wrapped in { iceServers }). Returns [] on any error.
async function getMeteredFromApi(): Promise<IceServer[]> {
  const apiKey = process.env.METERED_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch(
      `https://${METERED_APP}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.iceServers)) return data.iceServers;
    return [];
  } catch {
    return [];
  }
}

export async function GET() {
  const apiServers = await getMeteredFromApi();
  // Prefer fresh API creds when available, else the known-good static set.
  const turn = apiServers.length > 0 ? apiServers : STATIC_METERED;
  const iceServers: IceServer[] = [...turn, ...EXTRA_STUN];
  return NextResponse.json({ iceServers });
}
