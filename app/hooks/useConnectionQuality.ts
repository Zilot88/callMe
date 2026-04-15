"use client";

import { useRef, useEffect, useState, useCallback } from 'react';
import { ConnectionQualityMonitor } from '../lib/connection-quality';
import type { QualityLevel, PeerQualityMetrics } from '../lib/webrtc-types';

interface PeerConnection {
  connection: RTCPeerConnection;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export function useConnectionQuality(
  peersRef: React.MutableRefObject<Map<string, PeerConnection>>,
  enabled: boolean,
) {
  const monitorRef = useRef<ConnectionQualityMonitor | null>(null);
  const [overallLevel, setOverallLevel] = useState<QualityLevel>('good');
  // Track peer keys to detect changes
  const lastPeerKeysRef = useRef<string>('');

  // Create monitor on mount
  useEffect(() => {
    if (!enabled) return;

    const monitor = new ConnectionQualityMonitor(2000);
    monitorRef.current = monitor;

    const unsub = monitor.onSnapshot((snapshot) => {
      // Only update state if level actually changed (avoid re-renders)
      setOverallLevel(prev => prev !== snapshot.overallLevel ? snapshot.overallLevel : prev);
    });

    monitor.start();

    return () => {
      unsub();
      monitor.destroy();
      monitorRef.current = null;
    };
  }, [enabled]);

  // Sync peers into the monitor every 2 seconds
  useEffect(() => {
    if (!enabled) return;

    const syncPeers = () => {
      const monitor = monitorRef.current;
      if (!monitor) return;

      const currentKeys = Array.from(peersRef.current.keys()).sort().join(',');
      if (currentKeys === lastPeerKeysRef.current) return;
      lastPeerKeysRef.current = currentKeys;

      // Remove peers that are no longer present
      const currentSet = new Set(peersRef.current.keys());
      // Monitor doesn't expose its peer list, so we track externally
      // Add all current peers (addPeer is idempotent in practice since
      // we only call when keys change)
      for (const [peerId, peer] of peersRef.current) {
        monitor.addPeer(peerId, peer.connection);
      }
    };

    const interval = setInterval(syncPeers, 2000);
    syncPeers(); // initial sync

    return () => clearInterval(interval);
  }, [enabled, peersRef]);

  const getPeerMetrics = useCallback((peerId: string): PeerQualityMetrics | null => {
    return monitorRef.current?.getLatestMetrics(peerId) ?? null;
  }, []);

  return {
    overallLevel,
    getPeerMetrics,
    monitorRef,
  };
}
