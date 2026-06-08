import { NextResponse } from 'next/server';

// Single TURN provider: Metered.ca (olikirolli account, Free 20GB plan).
//
// We serve the active static credential directly — NO API call. The Metered
// REST API on this account returns an older, suspended credential, so calling
// it would hand clients a dead relay. TURN credentials are not secret (they go
// to every browser anyway), so hardcoding the known-good one is the reliable
// choice. STUN is included so most calls go direct P2P and conserve quota.
//
// To rotate: create a new credential in the Metered dashboard, click
// "Show ICE Servers Array", and replace username/credential below.

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const TURN_USERNAME = 'd09bbd26fe05452c4e9a7b35';
const TURN_CREDENTIAL = 'uEdD0mA1psVL8S2v';

const ICE_SERVERS: IceServer[] = [
  // Metered STUN + TURN over UDP/TCP/TLS on 80/443 (443/TLS punches through
  // strict mobile/corporate firewalls and CGNAT).
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:standard.relay.metered.ca:80', username: TURN_USERNAME, credential: TURN_CREDENTIAL },
  { urls: 'turn:standard.relay.metered.ca:80?transport=tcp', username: TURN_USERNAME, credential: TURN_CREDENTIAL },
  { urls: 'turn:standard.relay.metered.ca:443', username: TURN_USERNAME, credential: TURN_CREDENTIAL },
  { urls: 'turns:standard.relay.metered.ca:443?transport=tcp', username: TURN_USERNAME, credential: TURN_CREDENTIAL },
  // Public STUN for redundancy (free, no relay traffic).
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export async function GET() {
  return NextResponse.json({ iceServers: ICE_SERVERS });
}
