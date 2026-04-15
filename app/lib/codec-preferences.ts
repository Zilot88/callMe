// Codec preference selection for WebRTC peer connections
// iOS Safari can only encode H.264; Chrome/Firefox benefit from VP9's better compression

export type BrowserType = 'safari' | 'chrome' | 'firefox' | 'other';

export function detectBrowser(): BrowserType {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  // iOS: all browsers use WebKit, so treat them all as Safari
  if (/iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)) {
    return 'safari';
  }
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'safari';
  if (/Firefox/.test(ua)) return 'firefox';
  if (/Chrome|Chromium|CriOS/.test(ua)) return 'chrome';
  return 'other';
}

export function applyCodecPreferences(pc: RTCPeerConnection, browser?: BrowserType): void {
  const b = browser ?? detectBrowser();

  const transceivers = pc.getTransceivers();
  for (const transceiver of transceivers) {
    // Only set preferences for video transceivers
    const trackKind = transceiver.receiver?.track?.kind
      ?? transceiver.sender?.track?.kind;
    if (trackKind !== 'video') continue;

    if (typeof transceiver.setCodecPreferences !== 'function') continue;

    const caps = RTCRtpReceiver.getCapabilities?.('video');
    if (!caps) continue;

    const codecs = [...caps.codecs];

    // Sort: preferred codec first, keep retransmission codecs (RTX, RED, ULPFEC) after
    const preferred: RTCRtpCodecCapability[] = [];
    const rest: RTCRtpCodecCapability[] = [];
    const retransmission: RTCRtpCodecCapability[] = [];

    const preferredMime = (b === 'safari' || b === 'other') ? 'video/h264' : 'video/vp9';

    for (const codec of codecs) {
      const mime = codec.mimeType.toLowerCase();
      if (mime === 'video/rtx' || mime === 'video/red' || mime === 'video/ulpfec') {
        retransmission.push(codec);
      } else if (mime === preferredMime) {
        preferred.push(codec);
      } else {
        rest.push(codec);
      }
    }

    try {
      transceiver.setCodecPreferences([...preferred, ...rest, ...retransmission]);
    } catch {
      // Silently ignore — some browsers reject certain orderings
    }
  }
}
