"use client";

import type { QualityLevel, VideoQualityPreset } from '../lib/webrtc-types';

const LEVEL_COLORS: Record<QualityLevel, string> = {
  excellent: 'bg-green-500',
  good: 'bg-green-400',
  degraded: 'bg-yellow-400',
  poor: 'bg-orange-500',
  critical: 'bg-red-500',
};

const LEVEL_LABELS: Record<QualityLevel, string> = {
  excellent: 'Отлично',
  good: 'Хорошо',
  degraded: 'Среднее',
  poor: 'Плохое',
  critical: 'Очень плохое',
};

const PRESET_LABELS: Record<VideoQualityPreset, string> = {
  high: '720p',
  medium: '480p',
  low: '360p',
  minimal: '240p',
  'audio-only': 'Только аудио',
};

const PULSE_LEVELS = new Set<QualityLevel>(['excellent', 'critical']);

interface QualityIndicatorProps {
  level: QualityLevel;
  preset?: VideoQualityPreset;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function QualityIndicator({
  level,
  preset,
  showLabel = false,
  size = 'md',
}: QualityIndicatorProps) {
  const color = LEVEL_COLORS[level];
  const pulse = PULSE_LEVELS.has(level) ? 'animate-pulse' : '';
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <div className="flex items-center gap-1.5" title={`${LEVEL_LABELS[level]}${preset ? ` (${PRESET_LABELS[preset]})` : ''}`}>
      <div className={`${dotSize} rounded-full ${color} ${pulse}`} />
      {showLabel && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {preset ? PRESET_LABELS[preset] : LEVEL_LABELS[level]}
        </span>
      )}
    </div>
  );
}

// Utility for DOM-based per-peer quality dots (used in updateRemoteVideo)
export function getQualityDotClass(level: QualityLevel): string {
  return `absolute top-2 right-2 w-3 h-3 rounded-full ${LEVEL_COLORS[level]}${PULSE_LEVELS.has(level) ? ' animate-pulse' : ''}`;
}
