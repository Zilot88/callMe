"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import MediaControls from "./MediaControls";
import DebugPanel from "./DebugPanel";
import QualityIndicator, { getQualityDotColor } from "./QualityIndicator";
import { reportDiagnostic } from "../lib/diagnostics";
import { useConnectionQuality } from "../hooks/useConnectionQuality";
import { ConnectionQualityMonitor } from "../lib/connection-quality";
import { AdaptiveBitrateController } from "../lib/adaptive-bitrate";
import { PeerHeartbeat } from "../lib/heartbeat";
import { applyCodecPreferences } from "../lib/codec-preferences";
import { getInitialQualityPreset, onNetworkChange } from "../lib/network-info";
import type { VideoQualityPreset, QualityLevel } from "../lib/webrtc-types";
import ShareLinkButton from "./ShareLinkButton";
import { useTranslation } from "../lib/i18n";

interface PeerConnection {
  connection: RTCPeerConnection;
  stream?: MediaStream;
  heartbeat?: PeerHeartbeat;
}

// ICE Server configurations for different regions
const ICE_SERVER_CONFIGS = {
  global: {
    name: "🌐 Глобальные",
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
        { urls: "stun:global.stun.twilio.com:3478" },
        { urls: "stun:stun.ekiga.net" },
        { urls: "stun:stun.schlund.de" },
        { urls: "stun:stun.voiparound.com" },
        { urls: "stun:stun.sipgate.net" },
        {
          urls: "turn:freeturn.net:3478",
          username: "free",
          credential: "free",
        },
        {
          urls: "turn:freeturn.net:5349",
          username: "free",
          credential: "free",
        },
      ],
    } as RTCConfiguration,
  },
  neutral: {
    name: "🌏 Нейтральные",
    config: {
      iceServers: [
        { urls: "stun:stun1.cht.com.net:3478" },
        { urls: "stun:s1.voipstation.jp:3478" },
        { urls: "stun:s2.voipstation.jp:3478" },
        { urls: "stun:stun.cloudflare.com:3478" },
        { urls: "stun:stun.sipnet.net:3478" },
        { urls: "stun:stun.voipgate.com:3478" },
        { urls: "stun:stunserver.org:3478" },
        { urls: "stun:stun.voiparound.com" },
        { urls: "stun:stun.voipbuster.com" },
        { urls: "stun:stun.voipstunt.com" },
        {
          urls: "turn:freeturn.net:3478",
          username: "free",
          credential: "free",
        },
        {
          urls: "turn:freeturn.net:5349",
          username: "free",
          credential: "free",
        },
        {
          urls: "turns:freeturn.net:5349",
          username: "free",
          credential: "free",
        },
        {
          urls: "turn:freestun.net:3478",
          username: "free",
          credential: "free",
        },
      ],
    } as RTCConfiguration,
  },
  europe: {
    name: "🇪🇺 Европа",
    config: {
      iceServers: [
        { urls: "stun:stun.cloudflare.com:3478" },
        { urls: "stun:stun.ekiga.net" },
        { urls: "stun:stun.ideasip.com" },
        { urls: "stun:stun.schlund.de" },
        { urls: "stun:stun.voiparound.com" },
        { urls: "stun:stun.voipbuster.com" },
        { urls: "stun:stun.sipgate.net" },
        { urls: "stun:stun.stunprotocol.org:3478" },
        {
          urls: "turn:freeturn.net:3478",
          username: "free",
          credential: "free",
        },
        {
          urls: "turn:freeturn.net:5349",
          username: "free",
          credential: "free",
        },
        {
          urls: "turns:freeturn.net:5349",
          username: "free",
          credential: "free",
        },
      ],
    } as RTCConfiguration,
  },
  turnOnly: {
    name: "🔒 Только TURN",
    config: {
      iceServers: [
        {
          urls: "turn:numb.viagenie.ca",
          username: "webrtc@live.com",
          credential: "muazkh",
        },
        {
          urls: "turn:freeturn.net:3478",
          username: "free",
          credential: "free",
        },
        {
          urls: "turn:freeturn.net:5349",
          username: "free",
          credential: "free",
        },
        {
          urls: "turns:freeturn.net:5349",
          username: "free",
          credential: "free",
        },
        {
          urls: "turn:freestun.net:3478",
          username: "free",
          credential: "free",
        },
        {
          urls: "turn:freestun.net:5349",
          username: "free",
          credential: "free",
        },
      ],
    } as RTCConfiguration,
  },
  metered: {
    name: "⭐ Metered (20GB)",
    config: {
      iceServers: [
        { urls: "stun:stun.relay.metered.ca:80" },
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "cbf0ad6518714f46c139ebe6",
          credential: "nkmonuq3beg/U+ws",
        },
        {
          urls: "turn:global.relay.metered.ca:80?transport=tcp",
          username: "cbf0ad6518714f46c139ebe6",
          credential: "nkmonuq3beg/U+ws",
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "cbf0ad6518714f46c139ebe6",
          credential: "nkmonuq3beg/U+ws",
        },
        {
          urls: "turns:global.relay.metered.ca:443?transport=tcp",
          username: "cbf0ad6518714f46c139ebe6",
          credential: "nkmonuq3beg/U+ws",
        },
      ],
    } as RTCConfiguration,
  },
};

// Order for auto-rotation of ICE configs
const ICE_ROTATION_ORDER: (keyof typeof ICE_SERVER_CONFIGS)[] = [
  "metered", "global", "neutral", "europe", "turnOnly",
];

interface VideoCallProps {
  roomId: string;
}

export default function VideoCall({ roomId }: VideoCallProps) {
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<string>("");
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [selectedRegion, setSelectedRegion] = useState<keyof typeof ICE_SERVER_CONFIGS>("metered");
  const [meteredIceServers, setMeteredIceServers] = useState<RTCConfiguration | null>(null);
  const [hideMyVideo, setHideMyVideo] = useState<boolean>(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState<boolean>(true);
  const [currentPreset, setCurrentPreset] = useState<VideoQualityPreset>('high');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteVideoContainerRef = useRef<HTMLDivElement>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());

  // ICE auto-rotation state
  const peerIceAttemptRef = useRef<Map<string, number>>(new Map());
  const workingIceConfigRef = useRef<keyof typeof ICE_SERVER_CONFIGS | null>(null);
  // Per-peer ICE config currently in use (so rotation can skip it on failure)
  const peerCurrentConfigRef = useRef<Map<string, keyof typeof ICE_SERVER_CONFIGS>>(new Map());
  // Per-peer counters of locally-gathered ICE candidate types (host/srflx/relay)
  const peerCandidateStatsRef = useRef<Map<string, { host: number; srflx: number; relay: number; prflx: number }>>(new Map());
  // Disconnected peer timers
  const disconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // ICE restart tracking
  const iceRestartAttemptsRef = useRef<Map<string, number>>(new Map());
  const iceRestartTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // reacquireVideo retry limit — prevents infinite loop when camera is genuinely unavailable
  const reacquireAttemptsRef = useRef<number>(0);
  const reacquireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Adaptive bitrate controller
  const abcRef = useRef<AdaptiveBitrateController | null>(null);
  // Total reconnection attempts (ICE restarts + full reconnections)
  const totalReconnectAttemptsRef = useRef<Map<string, number>>(new Map());

  // Ref to always have up-to-date selectedRegion + meteredIceServers in callbacks
  const selectedRegionRef = useRef(selectedRegion);
  selectedRegionRef.current = selectedRegion;
  const meteredIceServersRef = useRef(meteredIceServers);
  meteredIceServersRef.current = meteredIceServers;

  // Connection quality monitoring hook
  const { overallLevel, monitorRef } = useConnectionQuality(peersRef, true);

  const getIceConfig = useCallback((region?: keyof typeof ICE_SERVER_CONFIGS): RTCConfiguration => {
    const r = region || selectedRegionRef.current;
    if (r === 'metered' && meteredIceServersRef.current) {
      return meteredIceServersRef.current;
    }
    return ICE_SERVER_CONFIGS[r].config;
  }, []);

  // Update ABC participant cap (self-view stays visible regardless of count)
  useEffect(() => {
    abcRef.current?.setParticipantCount(participantCount);
  }, [participantCount]);

  // Speaker toggle — mutes local playback of every remote <video>
  // (does not stop sending audio TO peers — see toggleAudio for that).
  const isSpeakerEnabledRef = useRef(isSpeakerEnabled);
  isSpeakerEnabledRef.current = isSpeakerEnabled;
  useEffect(() => {
    remoteVideosRef.current.forEach(el => {
      el.muted = !isSpeakerEnabled;
      // After unmuting, browser may need an explicit play() to resume audio
      if (isSpeakerEnabled && el.paused) el.play().catch(() => {});
    });
  }, [isSpeakerEnabled]);

  // Debug helper
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setDebugInfo(prev => [...prev.slice(-50), logMessage]);
  }, []);

  // Load Metered.ca TURN credentials
  useEffect(() => {
    const loadMeteredCredentials = async () => {
      try {
        const response = await fetch('/api/turn-credentials');
        if (!response.ok) {
          throw new Error(`Failed to fetch TURN credentials: ${response.statusText}`);
        }
        const data = await response.json();
        setMeteredIceServers(data);
        addDebugLog('✅ Loaded Metered TURN credentials');
      } catch (error) {
        console.error('Failed to load Metered credentials:', error);
        addDebugLog('⚠️ Failed to load Metered TURN credentials - using fallback');
      }
    };

    loadMeteredCredentials();
  }, [addDebugLog]);

  // ─── Media acquisition with fallback chain ─────────────────────────
  const acquireMedia = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      addDebugLog("❌ getUserMedia not supported");
      reportDiagnostic({ eventType: "media_failed", details: "getUserMedia not supported" });
      return null;
    }

    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: 1280 }, height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    };
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true, noiseSuppression: true, autoGainControl: true,
    };

    const attempts: Array<{ label: string; constraints: MediaStreamConstraints }> = [
      { label: "video+audio", constraints: { video: videoConstraints, audio: audioConstraints } },
      { label: "audio-only", constraints: { video: false, audio: audioConstraints } },
      { label: "video-only", constraints: { video: videoConstraints, audio: false } },
    ];

    reportDiagnostic({ eventType: "media_requested", details: "Starting media acquisition" });

    for (const { label, constraints } of attempts) {
      try {
        addDebugLog(`📹 Trying ${label}...`);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const tracks = stream.getTracks().map(t => `${t.kind}:${t.label}`).join(', ');
        addDebugLog(`✅ Media access granted (${label}): ${tracks}`);

        if (label !== "video+audio") {
          reportDiagnostic({ eventType: "media_fallback", details: `Fell back to ${label}` });
        } else {
          reportDiagnostic({ eventType: "media_granted", details: tracks });
        }

        // Set content hint for video (helps encoder optimize for talking heads)
        stream.getVideoTracks().forEach(t => {
          if ('contentHint' in t) t.contentHint = 'motion';
        });

        return stream;
      } catch (err: any) {
        addDebugLog(`⚠️ ${label} failed: ${err.message}`);
      }
    }

    // All attempts failed — join as viewer
    addDebugLog("⚠️ All media attempts failed — joining as viewer");
    reportDiagnostic({ eventType: "media_failed", details: "All getUserMedia attempts failed, joining as viewer" });
    return null;
  }, [addDebugLog]);

  // ─── Socket connection with reconnect settings ─────────────────────
  const connectSocket = useCallback(() => {
    addDebugLog("🔌 Connecting to Socket.IO server...");
    reportDiagnostic({ eventType: "socket_connecting", details: "Initiating Socket.IO connection" });

    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      addDebugLog(`🔌 Connected to Socket.IO server, my ID: ${socket.id}`);
      reportDiagnostic({ eventType: "socket_connected", details: `id=${socket.id}` });
      setConnectionStatus(tRef.current("status.waiting"));
      setParticipantCount(1);
      // Join the specific room
      socket.emit("join-room", { roomId, type: "video" });
      addDebugLog(`🚪 Joined room: ${roomId}`);
    });

    socket.on("participant-count", (count: number) => {
      setParticipantCount(count);
    });

    socket.on("connect_error", (error) => {
      addDebugLog(`❌ Socket.IO connection error: ${error.message}`);
      reportDiagnostic({ eventType: "socket_connect_error", details: error.message });
      setConnectionStatus(tRef.current("status.error"));
    });

    socket.on("disconnect", (reason) => {
      addDebugLog(`❌ Disconnected from Socket.IO server: ${reason}`);
      reportDiagnostic({ eventType: "socket_disconnected", details: reason });
      setConnectionStatus(tRef.current("status.disconnected"));
    });

    return socket;
  }, [addDebugLog]);

  // ─── Create peer connection (with optional ICE config override) ────
  const createPeerConnection = useCallback((
    userId: string,
    createOffer: boolean,
    configOverride?: RTCConfiguration,
    configKeyOverride?: keyof typeof ICE_SERVER_CONFIGS,
  ) => {
    const configKey: keyof typeof ICE_SERVER_CONFIGS =
      configKeyOverride || workingIceConfigRef.current || selectedRegionRef.current;
    const iceConfig = configOverride || getIceConfig(configKey);
    peerCurrentConfigRef.current.set(userId, configKey);
    peerCandidateStatsRef.current.set(userId, { host: 0, srflx: 0, relay: 0, prflx: 0 });
    addDebugLog(`🔧 Creating peer connection with ${userId}, initiator: ${createOffer}, ice=${configKey}`);
    const peerConnection = new RTCPeerConnection(iceConfig);

    let hasRelayCandidates = false;
    const candidateTimeout = setTimeout(() => {
      if (!hasRelayCandidates) {
        addDebugLog(`⚠️ WARNING: No TURN relay candidates for ${userId} - check TURN servers!`);
      }
    }, 10000);

    // Add local tracks or recvonly transceivers
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks();
      addDebugLog(`➕ Adding ${tracks.length} local tracks to peer ${userId}`);
      tracks.forEach((track) => {
        addDebugLog(`  └─ ${track.kind}: enabled=${track.enabled}, readyState=${track.readyState}`);
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    } else {
      // No local media — add recvonly transceivers so we can receive remote streams
      addDebugLog(`👁️ No local stream — adding recvonly transceivers for ${userId}`);
      peerConnection.addTransceiver('audio', { direction: 'recvonly' });
      peerConnection.addTransceiver('video', { direction: 'recvonly' });
    }

    // Apply codec preferences (VP9 for Chrome, H.264 for Safari)
    applyCodecPreferences(peerConnection);

    // Set audio priority high, video priority low
    peerConnection.getSenders().forEach(sender => {
      if (!sender.track) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const params = sender.getParameters() as any;
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
        if (sender.track.kind === 'audio') {
          params.encodings[0].priority = 'high';
          params.encodings[0].networkPriority = 'high';
        } else if (sender.track.kind === 'video') {
          params.encodings[0].priority = 'low';
          params.encodings[0].networkPriority = 'low';
        }
        sender.setParameters(params).catch(() => {});
      } catch { /* unsupported browser */ }
    });

    // Create DataChannel heartbeat for zombie detection
    const heartbeat = new PeerHeartbeat(
      peerConnection,
      createOffer,
      {},
      () => {
        addDebugLog(`💓 Heartbeat failure for ${userId} — attempting ICE restart`);
        attemptIceRestart(userId);
      },
    );

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      addDebugLog(`🎥 Received remote track from ${userId}: ${event.track.kind}`);
      const [remoteStream] = event.streams;
      const trackInfo = remoteStream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`).join(', ');
      addDebugLog(`  └─ Stream tracks: ${trackInfo}`);

      const peer = peersRef.current.get(userId);
      if (peer) {
        peer.stream = remoteStream;
        addDebugLog(`✅ Saved stream to peer ${userId}`);
      }

      updateRemoteVideo(userId, remoteStream);
      setConnectionStatus(tRef.current("status.active"));
    };

    // ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        const candidateType = event.candidate.type;
        addDebugLog(`🧊 ICE candidate for ${userId}: ${candidateType} (${event.candidate.protocol})`);
        addDebugLog(`  └─ ${event.candidate.address || 'no-address'}:${event.candidate.port || 'no-port'}`);

        const stats = peerCandidateStatsRef.current.get(userId);
        if (stats && candidateType && candidateType in stats) {
          stats[candidateType as keyof typeof stats]++;
        }

        if (candidateType === 'relay') {
          if (!hasRelayCandidates) {
            reportDiagnostic({
              eventType: "ice_relay_found",
              details: `${userId.substring(0, 8)} via ${event.candidate.protocol} (${event.candidate.relatedAddress || 'no-related'})`,
              iceConfig: peerCurrentConfigRef.current.get(userId),
            });
          }
          hasRelayCandidates = true;
          clearTimeout(candidateTimeout);
          addDebugLog(`✅ TURN relay candidate found for ${userId}!`);
        }

        socketRef.current.emit("ice-candidate", {
          to: userId,
          candidate: event.candidate,
        });
      } else if (!event.candidate) {
        addDebugLog(`✅ ICE gathering complete for ${userId}`);
        clearTimeout(candidateTimeout);
        const stats = peerCandidateStatsRef.current.get(userId);
        if (stats) {
          addDebugLog(`  └─ Gathered: host=${stats.host} srflx=${stats.srflx} relay=${stats.relay}`);
          reportDiagnostic({
            eventType: "ice_gathering_complete",
            details: `${userId.substring(0, 8)} host=${stats.host} srflx=${stats.srflx} relay=${stats.relay}`,
            iceConfig: peerCurrentConfigRef.current.get(userId),
          });
          if (stats.relay === 0) {
            addDebugLog(`⚠️ No TURN relay candidates for ${userId} — TURN server unreachable or auth failed`);
          }
        }
      }
    };

    peerConnection.onicegatheringstatechange = () => {
      addDebugLog(`🧊 ICE gathering state for ${userId}: ${peerConnection.iceGatheringState}`);
    };

    // Connection state — auto-ICE rotation on failure
    peerConnection.onconnectionstatechange = () => {
      addDebugLog(`🔗 Connection state with ${userId}: ${peerConnection.connectionState}`);

      if (peerConnection.connectionState === "connected") {
        addDebugLog(`✅ Successfully connected to ${userId}`);
        // Clear all reconnection attempt counters
        peerIceAttemptRef.current.delete(userId);
        iceRestartAttemptsRef.current.delete(userId);
        totalReconnectAttemptsRef.current.delete(userId);
        const irt = iceRestartTimersRef.current.get(userId);
        if (irt) { clearTimeout(irt); iceRestartTimersRef.current.delete(userId); }
        // Determine which config was used — save for future peers
        const currentConfigKey = peerCurrentConfigRef.current.get(userId)
          || workingIceConfigRef.current
          || selectedRegionRef.current;
        workingIceConfigRef.current = currentConfigKey;
        // Clear disconnect timer if any
        const dt = disconnectTimersRef.current.get(userId);
        if (dt) { clearTimeout(dt); disconnectTimersRef.current.delete(userId); }
        // Log selected candidate pair and resolve its types for telemetry
        peerConnection.getStats().then(stats => {
          // RTCIceCandidateStats isn't in lib.dom — use a structural type
          type CandidateStat = { candidateType?: string; protocol?: string };
          let local: CandidateStat | undefined;
          let remote: CandidateStat | undefined;
          stats.forEach(stat => {
            if (stat.type === 'candidate-pair' && (stat as RTCIceCandidatePairStats).state === 'succeeded' && (stat as RTCIceCandidatePairStats).nominated) {
              const pair = stat as RTCIceCandidatePairStats;
              local = stats.get(pair.localCandidateId) as CandidateStat | undefined;
              remote = stats.get(pair.remoteCandidateId) as CandidateStat | undefined;
            }
          });
          const localType = local?.candidateType || 'unknown';
          const remoteType = remote?.candidateType || 'unknown';
          const protocol = local?.protocol || '?';
          addDebugLog(`  └─ Winning pair: ${localType}/${protocol} ↔ ${remoteType}`);
          reportDiagnostic({
            eventType: "peer_connected",
            details: `${userId.substring(0, 8)} pair=${localType}↔${remoteType} proto=${protocol}`,
            iceConfig: currentConfigKey,
          });
        }).catch(() => {
          reportDiagnostic({
            eventType: "peer_connected",
            details: `Connected to ${userId.substring(0, 8)}`,
            iceConfig: currentConfigKey,
          });
        });
      } else if (peerConnection.connectionState === "failed") {
        handlePeerFailed(userId);
      } else if (peerConnection.connectionState === "disconnected") {
        handlePeerDisconnected(userId);
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      addDebugLog(`🧊 ICE connection state with ${userId}: ${peerConnection.iceConnectionState}`);
      if (peerConnection.iceConnectionState === 'failed') {
        addDebugLog(`❌ ICE connection failed for ${userId} - NAT/firewall issue?`);
      } else if (peerConnection.iceConnectionState === 'checking') {
        addDebugLog(`🔍 Checking ICE candidates for ${userId}...`);
      } else if (peerConnection.iceConnectionState === 'connected') {
        addDebugLog(`✅ ICE connected to ${userId}`);
      }
    };

    peerConnection.onsignalingstatechange = () => {
      addDebugLog(`📡 Signaling state with ${userId}: ${peerConnection.signalingState}`);
    };

    peersRef.current.set(userId, { connection: peerConnection, heartbeat });

    if (createOffer) {
      addDebugLog(`📤 Creating offer for ${userId}`);
      peerConnection
        .createOffer()
        .then((offer) => {
          addDebugLog(`✅ Offer created for ${userId}, setting local description`);
          return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
          if (socketRef.current) {
            addDebugLog(`📨 Sending offer to ${userId} via Socket.IO`);
            socketRef.current.emit("offer", {
              to: userId,
              offer: peerConnection.localDescription,
            });
          }
        })
        .catch((err) => {
          addDebugLog(`❌ Error creating offer for ${userId}: ${err.message}`);
        });
    }

    return peerConnection;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addDebugLog, getIceConfig]);

  // ─── ICE Restart — lightweight reconnection (succeeds ~69% of the time) ─
  const attemptIceRestart = useCallback((userId: string): boolean => {
    const attempts = iceRestartAttemptsRef.current.get(userId) || 0;
    if (attempts >= 3) return false; // exhausted — fall through to full reconnection

    const peer = peersRef.current.get(userId);
    if (!peer || peer.connection.signalingState === 'closed') return false;

    iceRestartAttemptsRef.current.set(userId, attempts + 1);
    const totalAttempts = (totalReconnectAttemptsRef.current.get(userId) || 0) + 1;
    totalReconnectAttemptsRef.current.set(userId, totalAttempts);

    if (totalAttempts > 8) {
      addDebugLog(`❌ Max reconnection attempts (8) reached for ${userId.substring(0, 8)}`);
      removePeer(userId);
      return true; // handled, but gave up
    }

    addDebugLog(`🔄 ICE restart attempt ${attempts + 1}/3 for ${userId.substring(0, 8)}`);
    reportDiagnostic({ eventType: "ice_restart", details: `Attempt ${attempts + 1} for ${userId.substring(0, 8)}` });

    peer.connection.restartIce();

    // Create a new offer with iceRestart flag
    peer.connection.createOffer({ iceRestart: true })
      .then(offer => peer.connection.setLocalDescription(offer))
      .then(() => {
        if (socketRef.current) {
          socketRef.current.emit("offer", {
            to: userId,
            offer: peer.connection.localDescription,
          });
        }
      })
      .catch(err => {
        addDebugLog(`❌ ICE restart offer failed for ${userId.substring(0, 8)}: ${err.message}`);
      });

    // Timeout: if not connected in 10s, fall through to full reconnection
    const timer = setTimeout(() => {
      iceRestartTimersRef.current.delete(userId);
      const p = peersRef.current.get(userId);
      if (p && p.connection.connectionState !== 'connected') {
        addDebugLog(`⏰ ICE restart timeout for ${userId.substring(0, 8)} — falling back to full reconnection`);
        handlePeerFailed(userId);
      }
    }, 10000);
    iceRestartTimersRef.current.set(userId, timer);

    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addDebugLog]);

  // ─── Handle peer connection failure — ICE restart then full rotation ──
  const handlePeerFailed = useCallback((userId: string) => {
    // Try ICE restart first (lightweight, preserves media)
    if (attemptIceRestart(userId)) return;

    const attempt = (peerIceAttemptRef.current.get(userId) || 0) + 1;
    peerIceAttemptRef.current.set(userId, attempt);

    const totalAttempts = (totalReconnectAttemptsRef.current.get(userId) || 0) + 1;
    totalReconnectAttemptsRef.current.set(userId, totalAttempts);

    if (totalAttempts > 8) {
      addDebugLog(`❌ Max reconnection attempts (8) reached for ${userId.substring(0, 8)}`);
      reportDiagnostic({ eventType: "peer_failed", details: `Max attempts reached for ${userId.substring(0, 8)}` });
      removePeer(userId);
      return;
    }

    // Build rotation order excluding the config that just failed for this peer
    const failedConfig = peerCurrentConfigRef.current.get(userId);
    const order = ICE_ROTATION_ORDER.filter(k => k !== failedConfig);

    if (attempt > order.length) {
      // Report stats so we can see why no config worked
      const stats = peerCandidateStatsRef.current.get(userId);
      const statsStr = stats ? `host=${stats.host} srflx=${stats.srflx} relay=${stats.relay}` : 'no stats';
      addDebugLog(`❌ All ICE configs exhausted for ${userId} after ${attempt - 1} attempts (${statsStr})`);
      reportDiagnostic({
        eventType: "peer_failed",
        details: `All ICE configs exhausted for ${userId.substring(0, 8)} (${statsStr})`,
        iceConfig: failedConfig,
      });
      removePeer(userId);
      return;
    }

    const nextConfigKey = order[attempt - 1];
    // Exponential backoff with jitter
    const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
    const jitter = Math.random() * baseDelay * 0.3;
    const delay = Math.round(baseDelay + jitter);

    const failedStats = peerCandidateStatsRef.current.get(userId);
    const failedStatsStr = failedStats ? `host=${failedStats.host} srflx=${failedStats.srflx} relay=${failedStats.relay}` : '';
    addDebugLog(`🔄 ICE fallback ${attempt}/${order.length} for ${userId}: ${failedConfig || '?'} → ${ICE_SERVER_CONFIGS[nextConfigKey].name} in ${delay}ms (${failedStatsStr})`);
    reportDiagnostic({
      eventType: "ice_fallback",
      details: `Attempt ${attempt} for ${userId.substring(0, 8)}: ${failedConfig || '?'} → ${nextConfigKey} (${failedStatsStr})`,
      iceConfig: nextConfigKey,
    });

    // Close old connection
    const oldPeer = peersRef.current.get(userId);
    if (oldPeer) {
      oldPeer.heartbeat?.destroy();
      oldPeer.connection.close();
      peersRef.current.delete(userId);
    }

    setTimeout(() => {
      if (!socketRef.current?.connected) return;
      const nextConfig = getIceConfig(nextConfigKey);
      createPeerConnection(userId, true, nextConfig, nextConfigKey);
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addDebugLog, getIceConfig, createPeerConnection, attemptIceRestart]);

  // ─── Handle disconnected state — ICE restart first, then retry ─────
  const handlePeerDisconnected = useCallback((userId: string) => {
    if (disconnectTimersRef.current.has(userId)) return;

    addDebugLog(`⏳ Peer ${userId} disconnected — waiting 5s before reconnect...`);
    const timer = setTimeout(() => {
      disconnectTimersRef.current.delete(userId);
      const peer = peersRef.current.get(userId);
      if (peer && peer.connection.connectionState === "disconnected") {
        addDebugLog(`🔄 Peer ${userId} still disconnected — attempting ICE restart`);
        if (!attemptIceRestart(userId)) {
          handlePeerFailed(userId);
        }
      }
    }, 5000);
    disconnectTimersRef.current.set(userId, timer);
  }, [addDebugLog, handlePeerFailed, attemptIceRestart]);

  const updateRemoteVideo = (userId: string, stream: MediaStream) => {
    let videoElement = remoteVideosRef.current.get(userId);

    if (!videoElement && remoteVideoContainerRef.current) {
      const container = document.createElement("div");
      container.style.cssText = "position:relative;background:#000;border-radius:12px;overflow:hidden;min-height:0";
      container.id = `peer-${userId}`;

      videoElement = document.createElement("video");
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = !isSpeakerEnabledRef.current;
      videoElement.style.cssText = "width:100%;height:100%;object-fit:cover";
      videoElement.srcObject = stream;
      videoElement.play().catch(() => {});

      const label = document.createElement("div");
      label.style.cssText = "position:absolute;bottom:8px;left:8px;background:#7c3aed;color:#fff;padding:2px 10px;border-radius:8px;font-size:12px;font-weight:600";
      label.textContent = `${tRef.current("video.participant")} ${userId.substring(0, 4)}`;

      const qualityDot = document.createElement("div");
      qualityDot.id = `quality-${userId}`;
      qualityDot.style.cssText = "position:absolute;top:8px;right:8px;width:12px;height:12px;border-radius:50%;background:#4caf50";

      container.appendChild(videoElement);
      container.appendChild(label);
      container.appendChild(qualityDot);
      remoteVideoContainerRef.current.appendChild(container);
      remoteVideosRef.current.set(userId, videoElement);
    } else if (videoElement) {
      videoElement.srcObject = stream;
      videoElement.play().catch(() => {});
    }
  };

  const removePeer = (userId: string) => {
    const peer = peersRef.current.get(userId);
    if (peer) {
      peer.heartbeat?.destroy();
      peer.connection.close();
      peersRef.current.delete(userId);
    }

    const videoElement = remoteVideosRef.current.get(userId);
    if (videoElement) {
      const container = document.getElementById(`peer-${userId}`);
      if (container) container.remove();
      remoteVideosRef.current.delete(userId);
    }

    // Clean up all per-peer tracking state
    peerIceAttemptRef.current.delete(userId);
    iceRestartAttemptsRef.current.delete(userId);
    totalReconnectAttemptsRef.current.delete(userId);
    peerCurrentConfigRef.current.delete(userId);
    peerCandidateStatsRef.current.delete(userId);
    monitorRef.current?.removePeer(userId);
    const irt = iceRestartTimersRef.current.get(userId);
    if (irt) { clearTimeout(irt); iceRestartTimersRef.current.delete(userId); }
    const dt = disconnectTimersRef.current.get(userId);
    if (dt) { clearTimeout(dt); disconnectTimersRef.current.delete(userId); }
  };

  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    peersRef.current.forEach((peer) => {
      peer.heartbeat?.destroy();
      peer.connection.close();
    });
    peersRef.current.clear();

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    remoteVideosRef.current.clear();
    peerIceAttemptRef.current.clear();
    iceRestartAttemptsRef.current.clear();
    totalReconnectAttemptsRef.current.clear();
    peerCurrentConfigRef.current.clear();
    peerCandidateStatsRef.current.clear();
    iceRestartTimersRef.current.forEach(t => clearTimeout(t));
    iceRestartTimersRef.current.clear();
    disconnectTimersRef.current.forEach(t => clearTimeout(t));
    disconnectTimersRef.current.clear();
    abcRef.current?.destroy();
    abcRef.current = null;
    if (reacquireTimerRef.current) {
      clearTimeout(reacquireTimerRef.current);
      reacquireTimerRef.current = null;
    }
    reacquireAttemptsRef.current = 0;
  }, []);

  // ─── Re-acquire video track (iOS Safari kills video in background) ─
  const reacquireVideo = useCallback(async () => {
    // Hard cap on retries — getUserMedia from a hidden tab fails silently;
    // without this, track.onended handlers ping-pong forever.
    if (reacquireAttemptsRef.current >= 3) {
      addDebugLog(`⚠️ reacquireVideo: max attempts reached, giving up — tap camera button to retry`);
      setIsVideoEnabled(false);
      return;
    }
    if (document.visibilityState !== 'visible') {
      addDebugLog(`⏸️ reacquireVideo: page hidden, deferring`);
      return;
    }
    reacquireAttemptsRef.current += 1;
    try {
      addDebugLog(`🔄 Re-acquiring video track... (attempt ${reacquireAttemptsRef.current}/3)`);
      reportDiagnostic({ eventType: "track_reacquiring", details: `Attempt ${reacquireAttemptsRef.current}` });
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      // Replace in local stream
      const oldStream = localStreamRef.current;
      if (oldStream) {
        oldStream.getVideoTracks().forEach(t => {
          oldStream.removeTrack(t);
          if (t.readyState !== 'ended') t.stop();
        });
        oldStream.addTrack(newVideoTrack);
      }

      // Update local video element
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      // Replace in all peer connections
      peersRef.current.forEach((peer, peerId) => {
        const videoSender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack);
          addDebugLog(`  └─ Replaced video track for peer ${peerId.substring(0, 8)}`);
        }
      });

      // Monitor the new track too
      newVideoTrack.onended = () => {
        addDebugLog("⚠️ Re-acquired video track ended again");
        reportDiagnostic({ eventType: "track_ended", details: "Re-acquired video track ended" });
        reacquireVideo();
      };

      setIsVideoEnabled(true);
      reacquireAttemptsRef.current = 0; // success — reset counter for future detachments
      addDebugLog("✅ Video track re-acquired successfully");
      reportDiagnostic({ eventType: "track_reacquired", details: `Video track re-acquired: ${newVideoTrack.label}` });
    } catch (err: any) {
      addDebugLog(`❌ Failed to re-acquire video (attempt ${reacquireAttemptsRef.current}/3): ${err.message}`);
      reportDiagnostic({ eventType: "track_reacquire_failed", details: `Attempt ${reacquireAttemptsRef.current}: ${err.message}` });
      setIsVideoEnabled(false);
    }
  }, [addDebugLog]);

  // ─── Switch to next available camera (front/back on mobile, cycle on desktop) ─
  const [videoInputCount, setVideoInputCount] = useState<number>(0);
  const switchCamera = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setVideoInputCount(videoInputs.length);
      if (videoInputs.length < 2) {
        addDebugLog(`📷 Only ${videoInputs.length} camera(s) available — can't switch`);
        return;
      }

      const currentTrack = localStreamRef.current?.getVideoTracks()[0];
      const currentDeviceId = currentTrack?.getSettings().deviceId;

      // Pick next device in the list (cycle around)
      const currentIndex = videoInputs.findIndex(d => d.deviceId === currentDeviceId);
      const nextIndex = (currentIndex + 1) % videoInputs.length;
      const nextDevice = videoInputs[nextIndex];

      addDebugLog(`📷 Switching camera: ${currentTrack?.label || '?'} → ${nextDevice.label || nextDevice.deviceId.substring(0, 6)}`);
      reportDiagnostic({ eventType: "camera_switching", details: `${currentDeviceId?.substring(0, 6)} → ${nextDevice.deviceId.substring(0, 6)}` });

      // Stop the old track BEFORE requesting a new one — iOS Safari can only
      // hold one camera at a time, and getUserMedia will reject otherwise.
      if (currentTrack && localStreamRef.current) {
        localStreamRef.current.removeTrack(currentTrack);
        currentTrack.stop();
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: nextDevice.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) {
        addDebugLog(`❌ No video track in new stream`);
        return;
      }

      if (localStreamRef.current) {
        localStreamRef.current.addTrack(newVideoTrack);
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }

      // Replace the track in every peer connection without renegotiating
      peersRef.current.forEach((peer, peerId) => {
        const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack).catch(err => {
            addDebugLog(`⚠️ replaceTrack failed for ${peerId.substring(0, 8)}: ${err.message}`);
          });
        }
      });

      // Monitor the new track for unexpected ending
      newVideoTrack.onended = () => {
        addDebugLog("⚠️ Camera track ended after switch");
        reportDiagnostic({ eventType: "track_ended", details: "After camera switch" });
        reacquireVideo();
      };

      setIsVideoEnabled(true);
      reacquireAttemptsRef.current = 0;
      addDebugLog(`✅ Switched to camera: ${newVideoTrack.label}`);
      reportDiagnostic({ eventType: "camera_switched", details: newVideoTrack.label });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addDebugLog(`❌ Switch camera failed: ${msg}`);
      reportDiagnostic({ eventType: "camera_switch_failed", details: msg });
    }
  }, [addDebugLog, reacquireVideo]);

  // Detect how many cameras are available so the UI can hide the switch
  // button when there's only one.
  useEffect(() => {
    const detect = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === 'videoinput').length;
        setVideoInputCount(cams);
      } catch {
        setVideoInputCount(0);
      }
    };
    detect();
    navigator.mediaDevices?.addEventListener?.('devicechange', detect);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', detect);
    };
  }, []);

  // ─── Monitor tracks for unexpected ending ─────────────────────────
  const setupTrackMonitoring = useCallback((stream: MediaStream) => {
    stream.getVideoTracks().forEach(track => {
      track.onended = () => {
        addDebugLog(`⚠️ Video track ended unexpectedly: ${track.label}`);
        reportDiagnostic({ eventType: "track_ended", details: `Video track ended: ${track.label}` });
        reacquireVideo();
      };
    });
    stream.getAudioTracks().forEach(track => {
      track.onended = () => {
        addDebugLog(`⚠️ Audio track ended unexpectedly: ${track.label}`);
        reportDiagnostic({ eventType: "track_ended", details: `Audio track ended: ${track.label}` });
      };
    });
  }, [addDebugLog, reacquireVideo]);

  // ─── Setup socket event handlers ──────────────────────────────────
  const setupSocketHandlers = useCallback((socket: Socket) => {
    socket.on("existing-users", (userIds: string[]) => {
      addDebugLog(`👥 Received existing users list: ${userIds.length} users`);
      userIds.forEach((userId) => {
        addDebugLog(`  └─ Will connect to: ${userId.substring(0, 8)}...`);
        createPeerConnection(userId, true);
      });
      setParticipantCount(userIds.length + 1);
    });

    socket.on("user-joined", (userId: string) => {
      addDebugLog(`👤 New user joined: ${userId.substring(0, 8)}...`);
      createPeerConnection(userId, false);
      setParticipantCount((prev) => prev + 1);
      setConnectionStatus(tRef.current("status.joined"));
    });

    socket.on("offer", async ({ from, offer }) => {
      addDebugLog(`📥 Received offer from: ${from.substring(0, 8)}...`);
      const peer = peersRef.current.get(from);
      if (peer) {
        // Handle glare: both sides sent ICE restart offers simultaneously
        if (peer.connection.signalingState === 'have-local-offer') {
          if (socket.id! < from) {
            // Lower ID yields — rollback our offer and accept theirs
            addDebugLog(`  └─ Glare detected, rolling back our offer for ${from.substring(0, 8)}...`);
            await peer.connection.setLocalDescription({ type: 'rollback' });
          } else {
            // Higher ID wins — ignore their offer, they'll accept our answer
            addDebugLog(`  └─ Glare detected, ignoring offer from ${from.substring(0, 8)}...`);
            return;
          }
        }
        addDebugLog(`  └─ Setting remote description for ${from.substring(0, 8)}...`);
        await peer.connection.setRemoteDescription(new RTCSessionDescription(offer));
        addDebugLog(`  └─ Creating answer for ${from.substring(0, 8)}...`);
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        addDebugLog(`📨 Sending answer to ${from.substring(0, 8)}...`);
        socket.emit("answer", { to: from, answer });
      } else {
        addDebugLog(`❌ No peer found for ${from.substring(0, 8)}...!`);
      }
    });

    socket.on("answer", async ({ from, answer }) => {
      addDebugLog(`📥 Received answer from: ${from.substring(0, 8)}...`);
      const peer = peersRef.current.get(from);
      if (peer) {
        addDebugLog(`  └─ Setting remote description from ${from.substring(0, 8)}...`);
        await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
      } else {
        addDebugLog(`❌ No peer found for ${from.substring(0, 8)}...!`);
      }
    });

    socket.on("ice-candidate", async ({ from, candidate }) => {
      addDebugLog(`🧊 Received ICE candidate from ${from.substring(0, 8)}...: ${candidate.type}`);
      const peer = peersRef.current.get(from);
      if (peer) {
        try {
          await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
          addDebugLog(`  └─ Added ICE candidate from ${from.substring(0, 8)}...`);
        } catch (err: any) {
          addDebugLog(`❌ Error adding ICE candidate from ${from.substring(0, 8)}...: ${err.message}`);
        }
      } else {
        addDebugLog(`❌ No peer found for ${from.substring(0, 8)}...!`);
      }
    });

    socket.on("user-left", (userId: string) => {
      addDebugLog(`👋 User left: ${userId.substring(0, 8)}...`);
      removePeer(userId);
      setParticipantCount((prev) => Math.max(1, prev - 1));
      setConnectionStatus(tRef.current("status.left"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addDebugLog, createPeerConnection]);

  // ─── Main initialization effect ────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    reportDiagnostic({ eventType: "page_loaded", details: "VideoCall component mounted" });
    addDebugLog("🚀 Initializing...");

    // Initialize adaptive bitrate controller
    const initialPreset = getInitialQualityPreset();
    const abc = new AdaptiveBitrateController(initialPreset);
    abcRef.current = abc;
    abc.onPresetChange((preset, reason) => {
      addDebugLog(`📊 Quality preset changed to ${preset}: ${reason}`);
      reportDiagnostic({ eventType: "quality_preset_change", details: `${preset}: ${reason}` });
      setCurrentPreset(preset);
    });

    // Subscribe quality monitor to adaptive bitrate controller
    const unsubSnapshot = monitorRef.current?.onSnapshot((snapshot) => {
      abc.handleQualitySnapshot(snapshot);
      abc.setPeers(new Map(
        Array.from(peersRef.current.entries()).map(([id, p]) => [id, p.connection])
      ));

      // Update per-peer quality dots in DOM
      snapshot.peers.forEach((metrics, peerId) => {
        const dot = document.getElementById(`quality-${peerId}`);
        if (dot) dot.style.background = getQualityDotColor(metrics.level);
      });
    });

    // Subscribe to zombie detection
    const unsubZombie = monitorRef.current?.onZombieDetected((peerId) => {
      addDebugLog(`🧟 Zombie connection detected for ${peerId.substring(0, 8)} — attempting ICE restart`);
      reportDiagnostic({ eventType: "zombie_detected", details: `Peer ${peerId.substring(0, 8)}` });
      attemptIceRestart(peerId);
    });

    // Subscribe to Network Information API changes (Chrome/Android only)
    const unsubNetwork = onNetworkChange((type) => {
      addDebugLog(`🌐 Network type changed: ${type}`);
      abc.handleNetworkTypeChange(type);
    });

    const init = async () => {
      // 1. Acquire media FIRST — guarantees localStreamRef is set
      //    before any socket event triggers createPeerConnection.
      const stream = await acquireMedia();
      if (cancelled) return;

      if (stream) {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          addDebugLog("📺 Local video element connected");
        }
        const hasAudio = stream.getAudioTracks().length > 0;
        const hasVideo = stream.getVideoTracks().length > 0;
        setIsAudioEnabled(hasAudio);
        setIsVideoEnabled(hasVideo);

        // Set video track reference for adaptive bitrate
        const videoTrack = stream.getVideoTracks()[0];
        abc.setVideoTrack(videoTrack ?? null);

        // Monitor tracks for unexpected ending (iOS Safari background)
        setupTrackMonitoring(stream);
      } else {
        setIsAudioEnabled(false);
        setIsVideoEnabled(false);
      }

      if (cancelled) return;

      // 2. THEN connect socket — localStreamRef is guaranteed to be set
      setConnectionStatus(tRef.current("status.connecting_server"));
      const socket = connectSocket();
      setupSocketHandlers(socket);

      // Handle socket reconnection: clean stale peers, let existing-users re-create
      socket.on("connect", () => {
        if (peersRef.current.size > 0) {
          addDebugLog("🔄 Socket reconnected — cleaning stale peers");
          peersRef.current.forEach(peer => {
            peer.heartbeat?.destroy();
            peer.connection.close();
          });
          peersRef.current.clear();
        }
      });
    };

    init();

    // Handle background/foreground: iOS Safari kills video tracks; desktop
    // Chrome pauses <video> elements in hidden tabs and doesn't always resume.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      // Resume any paused <video> elements (Chrome pauses them when tab hides)
      const resumeVideo = (el: HTMLVideoElement | null) => {
        if (!el) return;
        if (el.paused) el.play().catch(() => {});
      };
      resumeVideo(localVideoRef.current);
      remoteVideosRef.current.forEach(resumeVideo);

      // iOS may have killed the local video track — give the browser a moment
      // to settle (it sometimes refuses getUserMedia for ~500ms after unhide)
      // then re-acquire.
      if (reacquireTimerRef.current) clearTimeout(reacquireTimerRef.current);
      reacquireTimerRef.current = setTimeout(() => {
        reacquireTimerRef.current = null;
        if (document.visibilityState !== 'visible') return;
        if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack && videoTrack.readyState === 'ended') {
            addDebugLog("⚠️ Video track died while page was hidden — re-acquiring");
            reacquireVideo();
          }
        }
      }, 500);

      // Check peer connections and restart ICE if degraded
      peersRef.current.forEach((peer, peerId) => {
        if (peer.connection.iceConnectionState !== 'connected'
            && peer.connection.iceConnectionState !== 'completed') {
          addDebugLog(`🔄 Peer ${peerId.substring(0, 8)} degraded after background — restarting ICE`);
          attemptIceRestart(peerId);
        }
      });
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubSnapshot?.();
      unsubZombie?.();
      unsubNetwork();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reconnectAllPeers = () => {
    addDebugLog(`🔄 Reconnecting all peers with new ICE servers...`);

    const peerIds = Array.from(peersRef.current.keys());

    if (peerIds.length === 0) {
      addDebugLog(`⚠️ No active peers to reconnect`);
      return;
    }

    // Reset ICE attempt counters when manually switching region
    peerIceAttemptRef.current.clear();
    workingIceConfigRef.current = null;

    peerIds.forEach(userId => {
      addDebugLog(`  └─ Closing connection to ${userId.substring(0, 8)}...`);
      removePeer(userId);
    });

    peerIds.forEach(userId => {
      addDebugLog(`  └─ Recreating connection to ${userId.substring(0, 8)}...`);
      createPeerConnection(userId, true);
    });

    addDebugLog(`✅ Reconnect initiated for ${peerIds.length} peer(s)`);
  };

  const requestMediaPermissions = async () => {
    try {
      addDebugLog("🔄 Requesting media permissions...");
      setConnectionStatus(tRef.current("status.requesting"));

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          addDebugLog(`  └─ Stopping old track: ${track.kind}`);
          track.stop();
        });
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      addDebugLog("✅ New media access granted");

      localStreamRef.current = newStream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }

      const audioTrack = newStream.getAudioTracks()[0];
      const videoTrack = newStream.getVideoTracks()[0];
      setIsAudioEnabled(audioTrack?.enabled ?? true);
      setIsVideoEnabled(videoTrack?.enabled ?? true);

      const audioTracks = newStream.getAudioTracks();
      const videoTracks = newStream.getVideoTracks();

      peersRef.current.forEach((peer, userId) => {
        addDebugLog(`  └─ Updating tracks for peer ${userId.substring(0, 8)}`);

        const audioSenders = peer.connection.getSenders().filter(s => s.track?.kind === 'audio');
        audioSenders.forEach((sender, index) => {
          if (audioTracks[index]) {
            sender.replaceTrack(audioTracks[index]);
          }
        });

        const videoSenders = peer.connection.getSenders().filter(s => s.track?.kind === 'video');
        videoSenders.forEach((sender, index) => {
          if (videoTracks[index]) {
            sender.replaceTrack(videoTracks[index]);
          }
        });
      });

      setConnectionStatus(peersRef.current.size > 0 ? tRef.current("status.connected") : tRef.current("status.waiting"));
      addDebugLog("✅ Media permissions updated");
    } catch (error: any) {
      addDebugLog(`❌ Failed to get media: ${error.message}`);
      setConnectionStatus(tRef.current("status.media_error"));
      alert(tRef.current("video.media_error_alert"));
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    // No stream at all — initial getUserMedia failed (e.g. permission denied
    // on a previous attempt). User-gesture tap is the right context to retry.
    if (!localStreamRef.current) {
      requestMediaPermissions();
      return;
    }
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    // Track died (e.g. iOS killed it in background and reacquire gave up)
    // — a tap counts as a user gesture, so getUserMedia will succeed here
    // when it kept failing in the background reacquire loop.
    if (!videoTrack || videoTrack.readyState === 'ended') {
      reacquireAttemptsRef.current = 0;
      reacquireVideo();
      return;
    }
    videoTrack.enabled = !videoTrack.enabled;
    setIsVideoEnabled(videoTrack.enabled);
  };

  const endCall = () => {
    cleanup();
    window.location.href = "/";
  };

  // MUI imports are used inline via the already-imported Box/Typography etc.
  // Additional MUI imports for the return JSX
  const MuiBox = require("@mui/material/Box").default;
  const MuiAppBar = require("@mui/material/AppBar").default;
  const MuiToolbar = require("@mui/material/Toolbar").default;
  const MuiTypography = require("@mui/material/Typography").default;
  const MuiChip = require("@mui/material/Chip").default;
  const MuiSelect = require("@mui/material/Select").default;
  const MuiMenuItem = require("@mui/material/MenuItem").default;
  const MuiFormControl = require("@mui/material/FormControl").default;
  const MuiIconButton = require("@mui/material/IconButton").default;
  const MuiButton = require("@mui/material/Button").default;
  const MuiTooltip = require("@mui/material/Tooltip").default;
  const MuiPaper = require("@mui/material/Paper").default;

  const gridCols = participantCount === 2 ? 2 : participantCount === 3 ? 3 : participantCount === 4 ? 2 : Math.min(participantCount, 4);

  return (
    <MuiBox sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      {/* Top Header */}
      <MuiAppBar position="static" sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
        <MuiToolbar variant="dense" sx={{ gap: { xs: 0.5, sm: 1 }, py: { xs: 0.25, sm: 1 }, minHeight: { xs: 44, sm: 48 } }}>
          <MuiIconButton href="/" size="small" sx={{ color: "grey.400", p: { xs: 0.5, sm: 1 } }}>
            <span style={{ fontSize: 18 }}>&#x2190;</span>
          </MuiIconButton>

          {/* Quality dot — label only on sm+ to save space */}
          <MuiBox sx={{ display: { xs: "none", sm: "flex" } }}>
            <QualityIndicator level={overallLevel} preset={currentPreset} showLabel size="sm" />
          </MuiBox>
          <MuiBox sx={{ display: { xs: "flex", sm: "none" } }}>
            <QualityIndicator level={overallLevel} preset={currentPreset} showLabel={false} size="sm" />
          </MuiBox>

          {/* Status text — desktop only, takes flex space */}
          <MuiTypography variant="body2" sx={{ color: "grey.300", flexGrow: 1, display: { xs: "none", sm: "block" }, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {connectionStatus}
          </MuiTypography>
          {/* On mobile, just spacer + participant chip */}
          <MuiBox sx={{ flexGrow: 1, display: { xs: "block", sm: "none" } }} />
          <MuiChip label={participantCount} size="small" sx={{ height: 20, fontSize: 11 }} />

          {/* Advanced ICE region selector — hidden on mobile (use Debug panel) */}
          <MuiFormControl size="small" sx={{ minWidth: 140, display: { xs: "none", md: "flex" } }}>
            <MuiSelect
              value={selectedRegion}
              onChange={(e: { target: { value: string } }) => {
                const newRegion = e.target.value as keyof typeof ICE_SERVER_CONFIGS;
                setSelectedRegion(newRegion);
                addDebugLog(`Changed ICE servers to: ${ICE_SERVER_CONFIGS[newRegion].name}`);
                setTimeout(() => reconnectAllPeers(), 100);
              }}
              sx={{ color: "white", fontSize: 12, "& .MuiSelect-icon": { color: "grey.400" } }}
            >
              {Object.entries(ICE_SERVER_CONFIGS).map(([key, value]) => (
                <MuiMenuItem key={key} value={key} sx={{ fontSize: 12 }}>
                  {value.name}
                </MuiMenuItem>
              ))}
            </MuiSelect>
          </MuiFormControl>

          {/* Media permissions button — hidden on mobile (camera button calls
              getUserMedia on tap when no stream exists) */}
          <MuiButton size="small" variant="outlined" onClick={requestMediaPermissions} sx={{ fontSize: 11, minWidth: 0, px: 1.5, display: { xs: "none", sm: "inline-flex" } }}>
            {t("video.media_btn")}
          </MuiButton>

          <ShareLinkButton size="small" variant="outlined" iconOnly={{ xs: true, sm: false }} />

          <MuiTooltip title={showDebug ? "Скрыть Debug" : "Debug"}>
            <MuiIconButton size="small" onClick={() => setShowDebug(!showDebug)} sx={{ color: "grey.400", p: { xs: 0.5, sm: 1 } }}>
              <span style={{ fontSize: 16 }}>&#x1F41B;</span>
            </MuiIconButton>
          </MuiTooltip>
        </MuiToolbar>
      </MuiAppBar>

      {/* Video Area */}
      <MuiBox sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", p: { xs: 1, sm: 2, md: 3 }, pb: 12 }}>
        {participantCount <= 1 ? (
          <MuiBox sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <MuiBox sx={{ width: "100%", maxWidth: 800 }}>
              <MuiPaper elevation={4} sx={{ position: "relative", bgcolor: "black", borderRadius: 2, overflow: "hidden", aspectRatio: "16/9" }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                {!isVideoEnabled && (
                  <MuiBox sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "grey.900" }}>
                    <MuiTypography sx={{ color: "grey.400" }}>{t("video.cam_off")}</MuiTypography>
                  </MuiBox>
                )}
                <MuiChip label={t("video.you")} size="small" sx={{ position: "absolute", bottom: 8, left: 8, bgcolor: "primary.main", color: "white" }} />
              </MuiPaper>
            </MuiBox>
            <MuiBox sx={{ textAlign: "center" }}>
              <MuiTypography sx={{ color: "grey.400" }}>{t("video.waiting")}</MuiTypography>
              <MuiTypography variant="caption" sx={{ color: "grey.600" }}>{t("video.share_hint")}</MuiTypography>
            </MuiBox>
          </MuiBox>
        ) : (
          <MuiBox sx={{
            minHeight: "100%",
            display: "grid",
            gridTemplateColumns: { xs: gridCols <= 2 ? `repeat(1, 1fr)` : `repeat(2, 1fr)`, sm: `repeat(${gridCols}, 1fr)` },
            // Rows: tall minimum so tiles stay readable on phones — when
            // they don't fit, parent scrolls. iPhone 13 portrait fits 2
            // rows comfortably; 3+ kicks in vertical scroll automatically.
            gridAutoRows: { xs: "minmax(240px, 1fr)", sm: "minmax(280px, 1fr)" },
            gap: { xs: 1, sm: 1.5, md: 2 },
          }}>
            {!hideMyVideo && (
              <MuiPaper elevation={3} sx={{ position: "relative", bgcolor: "black", borderRadius: 2, overflow: "hidden", minHeight: 0 }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                {!isVideoEnabled && (
                  <MuiBox sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "grey.900" }}>
                    <MuiTypography variant="body2" sx={{ color: "grey.400" }}>{t("video.cam_off")}</MuiTypography>
                  </MuiBox>
                )}
                <MuiChip label={t("video.you")} size="small" sx={{ position: "absolute", bottom: 8, left: 8, bgcolor: "primary.main", color: "white" }} />
              </MuiPaper>
            )}

            {/* Remote videos container */}
            <div
              ref={remoteVideoContainerRef}
              style={{ display: "contents" }}
            />
          </MuiBox>
        )}
      </MuiBox>

      {/* Bottom Controls */}
      <MuiPaper
        elevation={8}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          bgcolor: "background.paper",
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <MediaControls
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onEndCall={endCall}
          isCallActive={true}
          hideMyVideo={hideMyVideo}
          onToggleHideMyVideo={() => setHideMyVideo(!hideMyVideo)}
          participantCount={participantCount}
          onSwitchCamera={videoInputCount > 1 ? switchCamera : undefined}
          isSpeakerEnabled={isSpeakerEnabled}
          onToggleSpeaker={() => setIsSpeakerEnabled(v => !v)}
        />
      </MuiPaper>

      {/* Debug Panel */}
      <DebugPanel
        logs={debugInfo}
        isOpen={showDebug}
        onToggle={() => setShowDebug(!showDebug)}
      />
    </MuiBox>
  );
}
