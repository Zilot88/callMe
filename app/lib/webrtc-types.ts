// Shared types for WebRTC connection resilience modules

export type QualityLevel = 'excellent' | 'good' | 'degraded' | 'poor' | 'critical';

export type VideoQualityPreset = 'high' | 'medium' | 'low' | 'minimal' | 'audio-only';

export interface PeerQualityMetrics {
  peerId: string;
  timestamp: number;
  rtt: number;                          // ms
  packetLossRate: number;               // 0-1
  jitter: number;                       // ms
  availableOutgoingBitrate: number;     // bps
  framesPerSecond: number;
  freezeCount: number;
  qualityLimitationReason: string;      // 'none'|'bandwidth'|'cpu'|'other'
  bytesReceived: number;
  bytesSent: number;
  mos: number;                          // 1.0-4.5
  level: QualityLevel;
}

export interface QualitySnapshot {
  peers: Map<string, PeerQualityMetrics>;
  overallLevel: QualityLevel;
  timestamp: number;
}

export interface QualityPresetConfig {
  maxBitrate: number;
  maxFramerate: number;
  scaleResolutionDownBy: number;
  degradationPreference: RTCDegradationPreference;
}

export const QUALITY_PRESETS: Record<VideoQualityPreset, QualityPresetConfig | null> = {
  high:        { maxBitrate: 1_500_000, maxFramerate: 30, scaleResolutionDownBy: 1,   degradationPreference: 'maintain-framerate' },
  medium:      { maxBitrate: 800_000,   maxFramerate: 24, scaleResolutionDownBy: 1.5, degradationPreference: 'maintain-framerate' },
  low:         { maxBitrate: 400_000,   maxFramerate: 15, scaleResolutionDownBy: 2,   degradationPreference: 'maintain-resolution' },
  minimal:     { maxBitrate: 150_000,   maxFramerate: 10, scaleResolutionDownBy: 4,   degradationPreference: 'maintain-resolution' },
  'audio-only': null, // video disabled entirely
};

export const PRESET_ORDER: VideoQualityPreset[] = ['high', 'medium', 'low', 'minimal', 'audio-only'];

// MOS thresholds with hysteresis
export const QUALITY_THRESHOLDS = {
  excellent: 4.0,
  good: 3.5,
  degraded: 3.0,
  poor: 2.5,
  // below poor = critical
} as const;

// Hysteresis: step-up requires MOS to exceed threshold + this offset
export const HYSTERESIS_OFFSET = 0.3;

// Consecutive polls required before level change
export const STEP_DOWN_POLLS = 3;  // 6 seconds at 2s interval
export const STEP_UP_POLLS = 5;    // 10 seconds at 2s interval
