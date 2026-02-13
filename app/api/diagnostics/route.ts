import { NextRequest, NextResponse } from 'next/server';

interface StoredEvent {
  sessionId: string;
  timestamp: string;
  serverTimestamp: string;
  clientIp: string;
  userAgent: string;
  url: string;
  eventType: string;
  details: string;
  error?: string;
  iceConfig?: string;
}

const events: StoredEvent[] = [];
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

function pruneOld() {
  const cutoff = Date.now() - MAX_AGE_MS;
  while (events.length > 0 && new Date(events[0].serverTimestamp).getTime() < cutoff) {
    events.shift();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const stored: StoredEvent = {
      sessionId: body.sessionId || 'unknown',
      timestamp: body.timestamp || new Date().toISOString(),
      serverTimestamp: new Date().toISOString(),
      clientIp,
      userAgent: body.userAgent || 'unknown',
      url: body.url || '',
      eventType: body.eventType || 'unknown',
      details: body.details || '',
      error: body.error,
      iceConfig: body.iceConfig,
    };

    events.push(stored);
    pruneOld();

    console.log(`[DIAG] ${stored.eventType} | ${stored.sessionId.substring(0, 8)} | ${stored.clientIp} | ${stored.details}${stored.error ? ' | ERR: ' + stored.error : ''}`);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  pruneOld();

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  let filtered = type ? events.filter(e => e.eventType === type) : [...events];
  filtered = filtered.slice(-limit);

  return NextResponse.json({
    count: filtered.length,
    totalStored: events.length,
    events: filtered,
  });
}
