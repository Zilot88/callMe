// Adaptive bitrate controller — progressive video quality degradation ladder
// Adjusts video bitrate/framerate/resolution based on quality monitoring signals

import type { QualityLevel, QualitySnapshot, VideoQualityPreset } from './webrtc-types';
import { QUALITY_PRESETS, PRESET_ORDER } from './webrtc-types';

export type PresetChangeListener = (preset: VideoQualityPreset, reason: string) => void;

// Consecutive snapshots required before level change
const DEGRADE_SNAPSHOTS = 3;   // 6 seconds at 2s polling
const IMPROVE_SNAPSHOTS = 5;   // 10 seconds at 2s polling

export class AdaptiveBitrateController {
  private currentPreset: VideoQualityPreset;
  private maxPreset: VideoQualityPreset = 'high';
  private peers = new Map<string, RTCPeerConnection>();
  private videoTrack: MediaStreamTrack | null = null;
  private frozen = false;

  // Counters for hysteresis
  private consecutiveBad = 0;
  private consecutiveGood = 0;

  private listeners = new Set<PresetChangeListener>();

  constructor(initialPreset: VideoQualityPreset = 'high') {
    this.currentPreset = initialPreset;
  }

  setPeers(peers: Map<string, RTCPeerConnection>): void {
    this.peers = peers;
  }

  setVideoTrack(track: MediaStreamTrack | null): void {
    this.videoTrack = track;
  }

  setParticipantCount(count: number): void {
    if (count <= 2) this.maxPreset = 'high';
    else if (count <= 4) this.maxPreset = 'medium';
    else this.maxPreset = 'low';

    // If current preset exceeds max, step down immediately
    const currentIdx = PRESET_ORDER.indexOf(this.currentPreset);
    const maxIdx = PRESET_ORDER.indexOf(this.maxPreset);
    if (currentIdx < maxIdx) {
      this.applyPreset(this.maxPreset, 'participant count increased');
    }
  }

  // Called by quality monitor subscription
  handleQualitySnapshot(snapshot: QualitySnapshot): void {
    if (this.frozen) return;

    const level = snapshot.overallLevel;

    if (this.shouldDegrade(level)) {
      this.consecutiveBad++;
      this.consecutiveGood = 0;
      if (this.consecutiveBad >= DEGRADE_SNAPSHOTS) {
        this.stepDown(`quality ${level} for ${this.consecutiveBad} snapshots`);
        this.consecutiveBad = 0;
      }
    } else if (this.shouldImprove(level)) {
      this.consecutiveGood++;
      this.consecutiveBad = 0;
      if (this.consecutiveGood >= IMPROVE_SNAPSHOTS) {
        this.stepUp(`quality ${level} for ${this.consecutiveGood} snapshots`);
        this.consecutiveGood = 0;
      }
    } else {
      // Stable — reset counters
      this.consecutiveBad = 0;
      this.consecutiveGood = 0;
    }
  }

  handleNetworkTypeChange(effectiveType: string): void {
    if (this.frozen) return;
    // Proactive step-down on network degradation
    const typeToPreset: Record<string, VideoQualityPreset> = {
      '4g': 'high',
      '3g': 'medium',
      '2g': 'low',
      'slow-2g': 'minimal',
    };
    const target = typeToPreset[effectiveType];
    if (!target) return;

    const targetIdx = PRESET_ORDER.indexOf(target);
    const currentIdx = PRESET_ORDER.indexOf(this.currentPreset);
    // Only step down proactively, never step up (let getStats confirm improvement)
    if (targetIdx > currentIdx) {
      this.applyPreset(target, `network type changed to ${effectiveType}`);
    }
  }

  forcePreset(preset: VideoQualityPreset): void {
    this.applyPreset(preset, 'manual override');
  }

  freeze(): void {
    this.frozen = true;
  }

  unfreeze(): void {
    this.frozen = false;
    this.consecutiveBad = 0;
    this.consecutiveGood = 0;
  }

  getCurrentPreset(): VideoQualityPreset {
    return this.currentPreset;
  }

  onPresetChange(cb: PresetChangeListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  destroy(): void {
    this.listeners.clear();
    this.peers.clear();
    this.videoTrack = null;
  }

  // ── Private ──────────────────────────────────────────────────────

  private shouldDegrade(level: QualityLevel): boolean {
    return level === 'degraded' || level === 'poor' || level === 'critical';
  }

  private shouldImprove(level: QualityLevel): boolean {
    return level === 'excellent';
  }

  private stepDown(reason: string): void {
    const currentIdx = PRESET_ORDER.indexOf(this.currentPreset);
    if (currentIdx >= PRESET_ORDER.length - 1) return; // already at audio-only

    const nextPreset = PRESET_ORDER[currentIdx + 1];
    this.applyPreset(nextPreset, `step-down: ${reason}`);
  }

  private stepUp(reason: string): void {
    const currentIdx = PRESET_ORDER.indexOf(this.currentPreset);
    if (currentIdx <= 0) return; // already at high

    const targetPreset = PRESET_ORDER[currentIdx - 1];

    // Don't exceed participant-count cap
    const maxIdx = PRESET_ORDER.indexOf(this.maxPreset);
    if (PRESET_ORDER.indexOf(targetPreset) < maxIdx) return;

    this.applyPreset(targetPreset, `step-up: ${reason}`);
  }

  private applyPreset(preset: VideoQualityPreset, reason: string): void {
    if (preset === this.currentPreset) return;

    const prevPreset = this.currentPreset;
    this.currentPreset = preset;

    const config = QUALITY_PRESETS[preset];

    if (!config) {
      // audio-only: disable video track and remove from senders
      if (this.videoTrack) {
        this.videoTrack.enabled = false;
      }
      this.peers.forEach(pc => {
        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(null).catch(() => {});
        }
      });
    } else {
      // Restore video if coming from audio-only
      if (prevPreset === 'audio-only' && this.videoTrack) {
        this.videoTrack.enabled = true;
        this.peers.forEach(pc => {
          const videoSender = pc.getSenders().find(s =>
            s.track === null || s.track?.kind === 'video'
          );
          if (videoSender) {
            videoSender.replaceTrack(this.videoTrack).catch(() => {});
          }
        });
      }

      // Apply bitrate/framerate/resolution parameters
      this.peers.forEach(pc => {
        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (!videoSender) return;

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const params = videoSender.getParameters() as any;
          if (!params.encodings || params.encodings.length === 0) return;

          params.encodings[0].maxBitrate = config.maxBitrate;
          params.encodings[0].maxFramerate = config.maxFramerate;
          params.encodings[0].scaleResolutionDownBy = config.scaleResolutionDownBy;
          params.degradationPreference = config.degradationPreference;

          videoSender.setParameters(params).catch(() => {});
        } catch {
          // Some browsers may not support certain parameters
        }
      });
    }

    for (const cb of this.listeners) {
      try { cb(preset, reason); } catch { /* listener error */ }
    }
  }
}
