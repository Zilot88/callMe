import { NextResponse } from 'next/server';

// Reports Metered TURN usage for the current billing cycle so the owner can
// watch the 20 GB free quota and never get cut off (or charged).
//
// Auth: Metered's current_usage endpoint expects `secretKey` (the app-level
// secret in the Metered "Developers" section), which may differ from the
// `apiKey` used to generate credentials. Set METERED_SECRET_KEY if so;
// otherwise we fall back to METERED_API_KEY.

const METERED_APP = 'callme'; // <appname>.metered.live — matches turn-credentials

export async function GET() {
  const key = process.env.METERED_SECRET_KEY || process.env.METERED_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'no_key', message: 'METERED_SECRET_KEY / METERED_API_KEY not set' },
      { status: 200 },
    );
  }

  try {
    const res = await fetch(
      `https://${METERED_APP}.metered.live/api/v1/turn/current_usage?secretKey=${key}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: 'metered_error', message: `Metered ${res.status}: ${res.statusText}` },
        { status: 200 },
      );
    }
    const data = await res.json();
    const quotaInGB = Number(data?.quotaInGB ?? 0);
    const usageInGB = Number(data?.usageInGB ?? 0);
    const overageInGB = Number(data?.overageInGB ?? 0);
    const percent = quotaInGB > 0 ? Math.min(100, (usageInGB / quotaInGB) * 100) : 0;
    const remainingGB = Math.max(0, quotaInGB - usageInGB);

    return NextResponse.json({
      quotaInGB,
      usageInGB,
      overageInGB,
      percent,
      remainingGB,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'fetch_failed', message: error instanceof Error ? error.message : String(error) },
      { status: 200 },
    );
  }
}
