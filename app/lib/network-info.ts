// Network Information API wrapper
// Only available on Chrome/Edge/Android — Safari and Firefox do not support it

import type { VideoQualityPreset } from './webrtc-types';

export type EffectiveConnectionType = '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';

interface NetworkInformation extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

function getConnection(): NetworkInformation | null {
  if (typeof navigator === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (navigator as any).connection ?? null;
}

export function getEffectiveConnectionType(): EffectiveConnectionType {
  const conn = getConnection();
  const type = conn?.effectiveType;
  if (type === '4g' || type === '3g' || type === '2g' || type === 'slow-2g') return type;
  return 'unknown';
}

const NETWORK_TO_PRESET: Record<EffectiveConnectionType, VideoQualityPreset> = {
  '4g': 'high',
  '3g': 'medium',
  '2g': 'low',
  'slow-2g': 'minimal',
  'unknown': 'medium', // conservative default when API unavailable
};

export function getInitialQualityPreset(): VideoQualityPreset {
  return NETWORK_TO_PRESET[getEffectiveConnectionType()];
}

export function isNetworkInfoSupported(): boolean {
  return getConnection() !== null;
}

export function onNetworkChange(cb: (type: EffectiveConnectionType) => void): () => void {
  const conn = getConnection();
  if (!conn) return () => {};

  const handler = () => cb(getEffectiveConnectionType());
  conn.addEventListener('change', handler);
  return () => conn.removeEventListener('change', handler);
}
