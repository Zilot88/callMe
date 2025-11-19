import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.METERED_API_KEY;

    if (!apiKey) {
      console.error('METERED_API_KEY not found in environment variables');
      // Return fallback STUN servers if no API key
      return NextResponse.json({
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      });
    }

    // Fetch TURN credentials from Metered.ca
    const response = await fetch(
      `https://callme.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Metered API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching TURN credentials:', error);

    // Return fallback STUN servers on error
    return NextResponse.json({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });
  }
}
