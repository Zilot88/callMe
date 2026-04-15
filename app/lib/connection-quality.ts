// Network quality monitoring via RTCPeerConnection.getStats()
// Calculates MOS (Mean Opinion Score) per peer and detects zombie connections

import type { QualityLevel, PeerQualityMetrics, QualitySnapshot } from './webrtc-types';
import {
  QUALITY_THRESHOLDS,
  HYSTERESIS_OFFSET,
  STEP_DOWN_POLLS,
  STEP_UP_POLLS,
} from './webrtc-types';

// ── MOS calculation (simplified E-Model, ITU-T G.107) ──────────────

export function calculateMOS(rttMs: number, packetLossPercent: number, jitterMs: number): number {
  const effectiveLatency = rttMs + jitterMs * 2 + 10; // 10ms processing delay
  let R = 93.2;

  if (effectiveLatency < 160) {
    R -= effectiveLatency / 40;
  } else {
    R -= (effectiveLatency - 120) / 10;
  }

  R -= packetLossPercent * 2.5;
  R = Math.max(0, Math.min(100, R));

  if (R < 0) return 1.0;
  if (R > 100) return 4.5;
  return 1 + 0.035 * R + R * (R - 60) * (100 - R) * 7e-6;
}

export function mosToLevel(mos: number): QualityLevel {
  if (mos >= QUALITY_THRESHOLDS.excellent) return 'excellent';
  if (mos >= QUALITY_THRESHOLDS.good) return 'good';
  if (mos >= QUALITY_THRESHOLDS.degraded) return 'degraded';
  if (mos >= QUALITY_THRESHOLDS.poor) return 'poor';
  return 'critical';
}

// ── Previous stats for delta calculation ────────────────────────────

interface PrevStats {
  bytesReceived: number;
  bytesSent: number;
  packetsLost: number;
  packetsReceived: number;
  timestamp: number;
}

interface EMA {
  rtt: number;
  loss: number;
  jitter: number;
}

interface ZombieTracker {
  staleCount: number;
  lastBytesReceived: number;
}

interface LevelTracker {
  currentLevel: QualityLevel;
  consecutiveDown: number;
  consecutiveUp: number;
}

// ── Main monitor class ──────────────────────────────────────────────

export type SnapshotListener = (snapshot: QualitySnapshot) => void;
export type ZombieListener = (peerId: string) => void;

const EMA_ALPHA = 0.3;
const ZOMBIE_STALE_THRESHOLD = 4; // 4 polls × 2s = 8 seconds

export class ConnectionQualityMonitor {
  private peers = new Map<string, RTCPeerConnection>();
  private prevStats = new Map<string, PrevStats>();
  private ema = new Map<string, EMA>();
  private zombies = new Map<string, ZombieTracker>();
  private levelTrackers = new Map<string, LevelTracker>();
  private latestMetrics = new Map<string, PeerQualityMetrics>();
  private overallLevel: QualityLevel = 'good';

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private pollIntervalMs: number;
  private snapshotListeners = new Set<SnapshotListener>();
  private zombieListeners = new Set<ZombieListener>();
  private destroyed = false;

  constructor(pollIntervalMs = 2000) {
    this.pollIntervalMs = pollIntervalMs;
  }

  addPeer(peerId: string, pc: RTCPeerConnection): void {
    this.peers.set(peerId, pc);
    this.zombies.set(peerId, { staleCount: 0, lastBytesReceived: 0 });
    this.levelTrackers.set(peerId, { currentLevel: 'good', consecutiveDown: 0, consecutiveUp: 0 });
  }

  removePeer(peerId: string): void {
    this.peers.delete(peerId);
    this.prevStats.delete(peerId);
    this.ema.delete(peerId);
    this.zombies.delete(peerId);
    this.levelTrackers.delete(peerId);
    this.latestMetrics.delete(peerId);
  }

  start(): void {
    if (this.intervalId || this.destroyed) return;
    this.intervalId = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onSnapshot(cb: SnapshotListener): () => void {
    this.snapshotListeners.add(cb);
    return () => this.snapshotListeners.delete(cb);
  }

  onZombieDetected(cb: ZombieListener): () => void {
    this.zombieListeners.add(cb);
    return () => this.zombieListeners.delete(cb);
  }

  getLatestMetrics(peerId: string): PeerQualityMetrics | null {
    return this.latestMetrics.get(peerId) ?? null;
  }

  getOverallLevel(): QualityLevel {
    return this.overallLevel;
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    this.peers.clear();
    this.prevStats.clear();
    this.ema.clear();
    this.zombies.clear();
    this.levelTrackers.clear();
    this.latestMetrics.clear();
    this.snapshotListeners.clear();
    this.zombieListeners.clear();
  }

  // ── Polling ─────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    if (this.destroyed) return;

    const entries = Array.from(this.peers.entries());
    const peerMetrics = new Map<string, PeerQualityMetrics>();

    // Stagger polling to avoid burst (especially with 5+ peers)
    for (let i = 0; i < entries.length; i++) {
      const [peerId, pc] = entries[i];
      if (pc.connectionState === 'closed') continue;

      try {
        const metrics = await this.collectPeerMetrics(peerId, pc);
        if (metrics) {
          peerMetrics.set(peerId, metrics);
          this.latestMetrics.set(peerId, metrics);
        }
      } catch {
        // getStats can throw if connection is closing
      }
    }

    // Calculate overall level (worst peer determines it)
    this.overallLevel = this.calculateOverallLevel(peerMetrics);

    const snapshot: QualitySnapshot = {
      peers: peerMetrics,
      overallLevel: this.overallLevel,
      timestamp: Date.now(),
    };

    for (const listener of this.snapshotListeners) {
      try { listener(snapshot); } catch { /* listener error */ }
    }
  }

  private async collectPeerMetrics(
    peerId: string,
    pc: RTCPeerConnection,
  ): Promise<PeerQualityMetrics | null> {
    const stats = await pc.getStats();
    const now = Date.now();

    let rtt = 0;
    let availableOutgoingBitrate = 0;
    let packetLossRate = 0;
    let jitter = 0;
    let framesPerSecond = 0;
    let freezeCount = 0;
    let qualityLimitationReason = 'none';
    let totalBytesReceived = 0;
    let totalBytesSent = 0;
    let currentPacketsLost = 0;
    let currentPacketsReceived = 0;

    stats.forEach(report => {
      switch (report.type) {
        case 'candidate-pair':
          if (report.state === 'succeeded') {
            if (report.currentRoundTripTime != null) {
              rtt = report.currentRoundTripTime * 1000; // seconds → ms
            }
            if (report.availableOutgoingBitrate != null) {
              availableOutgoingBitrate = report.availableOutgoingBitrate;
            }
          }
          break;

        case 'remote-inbound-rtp':
          if (report.roundTripTime != null) {
            rtt = rtt || report.roundTripTime * 1000;
          }
          if (report.jitter != null) {
            jitter = report.jitter * 1000; // seconds → ms
          }
          break;

        case 'outbound-rtp':
          if (report.kind === 'video') {
            if (report.framesPerSecond != null) framesPerSecond = report.framesPerSecond;
            if (report.qualityLimitationReason != null) qualityLimitationReason = report.qualityLimitationReason;
            totalBytesSent += report.bytesSent ?? 0;
          }
          break;

        case 'inbound-rtp':
          if (report.kind === 'video') {
            if (report.freezeCount != null) freezeCount = report.freezeCount;
            if (report.framesPerSecond != null && framesPerSecond === 0) {
              framesPerSecond = report.framesPerSecond;
            }
          }
          totalBytesReceived += report.bytesReceived ?? 0;
          currentPacketsLost += report.packetsLost ?? 0;
          currentPacketsReceived += report.packetsReceived ?? 0;
          break;
      }
    });

    // Calculate packet loss rate from deltas
    const prev = this.prevStats.get(peerId);
    if (prev) {
      const deltaLost = Math.max(0, currentPacketsLost - prev.packetsLost);
      const deltaReceived = Math.max(0, currentPacketsReceived - prev.packetsReceived);
      const totalDelta = deltaLost + deltaReceived;
      packetLossRate = totalDelta > 0 ? deltaLost / totalDelta : 0;
    }

    this.prevStats.set(peerId, {
      bytesReceived: totalBytesReceived,
      bytesSent: totalBytesSent,
      packetsLost: currentPacketsLost,
      packetsReceived: currentPacketsReceived,
      timestamp: now,
    });

    // Apply EMA smoothing
    const prevEma = this.ema.get(peerId) ?? { rtt, loss: packetLossRate * 100, jitter };
    const smoothedRtt = prevEma.rtt * (1 - EMA_ALPHA) + rtt * EMA_ALPHA;
    const smoothedLoss = prevEma.loss * (1 - EMA_ALPHA) + packetLossRate * 100 * EMA_ALPHA;
    const smoothedJitter = prevEma.jitter * (1 - EMA_ALPHA) + jitter * EMA_ALPHA;
    this.ema.set(peerId, { rtt: smoothedRtt, loss: smoothedLoss, jitter: smoothedJitter });

    // Calculate MOS
    const mos = calculateMOS(smoothedRtt, smoothedLoss, smoothedJitter);
    const rawLevel = mosToLevel(mos);

    // Apply hysteresis
    const level = this.applyHysteresis(peerId, rawLevel, mos);

    // Zombie detection
    this.checkZombie(peerId, totalBytesReceived, pc.connectionState);

    return {
      peerId,
      timestamp: now,
      rtt: Math.round(smoothedRtt),
      packetLossRate: smoothedLoss / 100,
      jitter: Math.round(smoothedJitter),
      availableOutgoingBitrate,
      framesPerSecond,
      freezeCount,
      qualityLimitationReason,
      bytesReceived: totalBytesReceived,
      bytesSent: totalBytesSent,
      mos: Math.round(mos * 100) / 100,
      level,
    };
  }

  private applyHysteresis(peerId: string, rawLevel: QualityLevel, mos: number): QualityLevel {
    const tracker = this.levelTrackers.get(peerId);
    if (!tracker) return rawLevel;

    const levels: QualityLevel[] = ['excellent', 'good', 'degraded', 'poor', 'critical'];
    const currentIdx = levels.indexOf(tracker.currentLevel);
    const rawIdx = levels.indexOf(rawLevel);

    if (rawIdx > currentIdx) {
      // Quality worsening
      tracker.consecutiveDown++;
      tracker.consecutiveUp = 0;
      if (tracker.consecutiveDown >= STEP_DOWN_POLLS) {
        tracker.currentLevel = rawLevel;
        tracker.consecutiveDown = 0;
      }
    } else if (rawIdx < currentIdx) {
      // Quality improving — require MOS to exceed threshold + offset
      const targetThreshold = this.getLevelThreshold(tracker.currentLevel);
      if (targetThreshold !== null && mos >= targetThreshold + HYSTERESIS_OFFSET) {
        tracker.consecutiveUp++;
      } else {
        tracker.consecutiveUp = 0;
      }
      tracker.consecutiveDown = 0;
      if (tracker.consecutiveUp >= STEP_UP_POLLS) {
        tracker.currentLevel = rawLevel;
        tracker.consecutiveUp = 0;
      }
    } else {
      // Same level
      tracker.consecutiveDown = 0;
      tracker.consecutiveUp = 0;
    }

    return tracker.currentLevel;
  }

  private getLevelThreshold(level: QualityLevel): number | null {
    switch (level) {
      case 'excellent': return QUALITY_THRESHOLDS.excellent;
      case 'good': return QUALITY_THRESHOLDS.good;
      case 'degraded': return QUALITY_THRESHOLDS.degraded;
      case 'poor': return QUALITY_THRESHOLDS.poor;
      case 'critical': return null;
    }
  }

  private checkZombie(peerId: string, bytesReceived: number, connectionState: string): void {
    const tracker = this.zombies.get(peerId);
    if (!tracker) return;

    if (connectionState !== 'connected') {
      tracker.staleCount = 0;
      tracker.lastBytesReceived = bytesReceived;
      return;
    }

    if (bytesReceived === tracker.lastBytesReceived) {
      tracker.staleCount++;
      if (tracker.staleCount >= ZOMBIE_STALE_THRESHOLD) {
        for (const cb of this.zombieListeners) {
          try { cb(peerId); } catch { /* listener error */ }
        }
        tracker.staleCount = 0; // reset after firing
      }
    } else {
      tracker.staleCount = 0;
    }

    tracker.lastBytesReceived = bytesReceived;
  }

  private calculateOverallLevel(peers: Map<string, PeerQualityMetrics>): QualityLevel {
    if (peers.size === 0) return 'good';

    const levels: QualityLevel[] = ['excellent', 'good', 'degraded', 'poor', 'critical'];
    let worstIdx = 0;

    for (const metrics of peers.values()) {
      const idx = levels.indexOf(metrics.level);
      if (idx > worstIdx) worstIdx = idx;
    }

    return levels[worstIdx];
  }
}
