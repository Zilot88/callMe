// DataChannel-based heartbeat for detecting zombie WebRTC connections
// Uses unreliable/unordered DataChannel for minimal overhead (~16 bytes/sec)

export interface HeartbeatConfig {
  pingIntervalMs: number;
  pongTimeoutMs: number;
  missedPongsThreshold: number;
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  pingIntervalMs: 2000,
  pongTimeoutMs: 3000,
  missedPongsThreshold: 3,
};

export class PeerHeartbeat {
  private channel: RTCDataChannel | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private missedPongs = 0;
  private lastRtt = 0;
  private config: HeartbeatConfig;
  private onFailure: (() => void) | null;
  private onRtt: ((rttMs: number) => void) | null;
  private destroyed = false;
  private lastPingSent = 0;

  constructor(
    pc: RTCPeerConnection,
    isInitiator: boolean,
    config?: Partial<HeartbeatConfig>,
    onFailure?: () => void,
    onRtt?: (rttMs: number) => void,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onFailure = onFailure ?? null;
    this.onRtt = onRtt ?? null;

    if (isInitiator) {
      this.channel = pc.createDataChannel('heartbeat', {
        ordered: false,
        maxRetransmits: 0,
      });
      this.setupChannel(this.channel);
    } else {
      // Accept heartbeat channel from remote peer
      const existingHandler = pc.ondatachannel;
      pc.ondatachannel = (event) => {
        if (event.channel.label === 'heartbeat') {
          this.channel = event.channel;
          this.setupChannel(this.channel);
        } else if (existingHandler) {
          // Dispatch non-heartbeat channels to any existing handler
          (existingHandler as (ev: RTCDataChannelEvent) => void)(event);
        }
      };
    }
  }

  private setupChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      if (this.destroyed) return;
      this.startPinging();
    };

    channel.onmessage = (event) => {
      if (this.destroyed) return;
      const data = event.data as string;

      if (data.startsWith('p:')) {
        // Received ping — reply with pong containing original timestamp
        try {
          channel.send('q:' + data.substring(2));
        } catch {
          // Channel may have closed
        }
      } else if (data.startsWith('q:')) {
        // Received pong — calculate RTT
        const sentTime = parseInt(data.substring(2), 10);
        if (!isNaN(sentTime)) {
          this.lastRtt = Date.now() - sentTime;
          this.onRtt?.(this.lastRtt);
        }
        this.missedPongs = 0;
      }
    };

    channel.onclose = () => this.stopPinging();
    channel.onerror = () => this.stopPinging();
  }

  private startPinging() {
    this.stopPinging();
    this.pingTimer = setInterval(() => {
      if (this.destroyed || !this.channel || this.channel.readyState !== 'open') return;

      // Check if previous ping was answered
      if (this.lastPingSent > 0) {
        this.missedPongs++;
        if (this.missedPongs >= this.config.missedPongsThreshold) {
          this.onFailure?.();
          this.missedPongs = 0; // reset after firing, let caller decide next action
          return;
        }
      }

      try {
        this.lastPingSent = Date.now();
        this.channel.send('p:' + this.lastPingSent);
      } catch {
        // Channel may have closed
      }
    }, this.config.pingIntervalMs);
  }

  private stopPinging() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  getLastRtt(): number {
    return this.lastRtt;
  }

  destroy() {
    this.destroyed = true;
    this.stopPinging();
    if (this.channel) {
      try { this.channel.close(); } catch { /* ignore */ }
      this.channel = null;
    }
    this.onFailure = null;
    this.onRtt = null;
  }
}
