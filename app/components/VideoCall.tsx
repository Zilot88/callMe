"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import MediaControls from "./MediaControls";
import DebugPanel from "./DebugPanel";
import QualityIndicator, { getQualityDotClass } from "./QualityIndicator";
import { reportDiagnostic } from "../lib/diagnostics";
import { useConnectionQuality } from "../hooks/useConnectionQuality";
import { ConnectionQualityMonitor } from "../lib/connection-quality";
import { AdaptiveBitrateController } from "../lib/adaptive-bitrate";
import { PeerHeartbeat } from "../lib/heartbeat";
import { applyCodecPreferences } from "../lib/codec-preferences";
import { getInitialQualityPreset, onNetworkChange } from "../lib/network-info";
import type { VideoQualityPreset, QualityLevel } from "../lib/webrtc-types";
import ShareLinkButton from "./ShareLinkButton";

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
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<string>("Подключение...");
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [selectedRegion, setSelectedRegion] = useState<keyof typeof ICE_SERVER_CONFIGS>("metered");
  const [meteredIceServers, setMeteredIceServers] = useState<RTCConfiguration | null>(null);
  const [hideMyVideo, setHideMyVideo] = useState<boolean>(false);
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
  // Disconnected peer timers
  const disconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // ICE restart tracking
  const iceRestartAttemptsRef = useRef<Map<string, number>>(new Map());
  const iceRestartTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
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

  // Auto-hide my video when exactly 2 participants + update ABC participant cap
  useEffect(() => {
    if (participantCount === 2) {
      setHideMyVideo(true);
    } else if (participantCount > 2) {
      setHideMyVideo(false);
    }
    abcRef.current?.setParticipantCount(participantCount);
  }, [participantCount]);

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
      setConnectionStatus("Ожидание участников...");
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
      setConnectionStatus("Ошибка подключения к серверу");
    });

    socket.on("disconnect", (reason) => {
      addDebugLog(`❌ Disconnected from Socket.IO server: ${reason}`);
      reportDiagnostic({ eventType: "socket_disconnected", details: reason });
      setConnectionStatus("Отключено от сервера");
    });

    return socket;
  }, [addDebugLog]);

  // ─── Create peer connection (with optional ICE config override) ────
  const createPeerConnection = useCallback((
    userId: string,
    createOffer: boolean,
    configOverride?: RTCConfiguration,
  ) => {
    const iceConfig = configOverride || getIceConfig(workingIceConfigRef.current || undefined);
    addDebugLog(`🔧 Creating peer connection with ${userId}, initiator: ${createOffer}`);
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
      setConnectionStatus("Звонок активен");
    };

    // ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        const candidateType = event.candidate.type;
        addDebugLog(`🧊 ICE candidate for ${userId}: ${candidateType} (${event.candidate.protocol})`);
        addDebugLog(`  └─ ${event.candidate.address || 'no-address'}:${event.candidate.port || 'no-port'}`);

        if (candidateType === 'relay') {
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
        const currentConfigKey = workingIceConfigRef.current || selectedRegionRef.current;
        workingIceConfigRef.current = currentConfigKey;
        reportDiagnostic({
          eventType: "peer_connected",
          details: `Connected to ${userId.substring(0, 8)}`,
          iceConfig: currentConfigKey,
        });
        // Clear disconnect timer if any
        const dt = disconnectTimersRef.current.get(userId);
        if (dt) { clearTimeout(dt); disconnectTimersRef.current.delete(userId); }
        // Log selected candidate pair
        peerConnection.getStats().then(stats => {
          stats.forEach(stat => {
            if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
              addDebugLog(`  └─ Using ICE pair: ${stat.localCandidateId} ↔ ${stat.remoteCandidateId}`);
            }
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

    // Build rotation order: working config first (if any), then the rest
    const order = workingIceConfigRef.current
      ? [workingIceConfigRef.current, ...ICE_ROTATION_ORDER.filter(k => k !== workingIceConfigRef.current)]
      : [...ICE_ROTATION_ORDER];

    if (attempt > order.length) {
      addDebugLog(`❌ All ICE configs exhausted for ${userId} after ${attempt - 1} attempts`);
      reportDiagnostic({ eventType: "peer_failed", details: `All ICE configs exhausted for ${userId.substring(0, 8)}` });
      removePeer(userId);
      return;
    }

    const nextConfigKey = order[attempt - 1];
    // Exponential backoff with jitter
    const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
    const jitter = Math.random() * baseDelay * 0.3;
    const delay = Math.round(baseDelay + jitter);

    addDebugLog(`🔄 ICE fallback ${attempt}/${order.length} for ${userId}: trying ${ICE_SERVER_CONFIGS[nextConfigKey].name} in ${delay}ms`);
    reportDiagnostic({
      eventType: "ice_fallback",
      details: `Attempt ${attempt} for ${userId.substring(0, 8)}: ${nextConfigKey}`,
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
      createPeerConnection(userId, true, nextConfig);
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
      container.className = "relative bg-black rounded-lg overflow-hidden shadow-xl";
      container.id = `peer-${userId}`;

      videoElement = document.createElement("video");
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = false;
      videoElement.className = "w-full h-full object-cover";
      videoElement.srcObject = stream;
      // Explicit play() for iOS Safari where autoplay can be blocked
      videoElement.play().catch(() => {});

      const label = document.createElement("div");
      label.className = "absolute bottom-2 left-2 bg-purple-600 text-white px-2 py-1 rounded text-xs sm:text-sm font-semibold";
      label.textContent = `Участник ${userId.substring(0, 4)}`;

      // Quality indicator dot (updated by quality monitor)
      const qualityDot = document.createElement("div");
      qualityDot.id = `quality-${userId}`;
      qualityDot.className = getQualityDotClass('good');

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
    iceRestartTimersRef.current.forEach(t => clearTimeout(t));
    iceRestartTimersRef.current.clear();
    disconnectTimersRef.current.forEach(t => clearTimeout(t));
    disconnectTimersRef.current.clear();
    abcRef.current?.destroy();
    abcRef.current = null;
  }, []);

  // ─── Re-acquire video track (iOS Safari kills video in background) ─
  const reacquireVideo = useCallback(async () => {
    try {
      addDebugLog("🔄 Re-acquiring video track...");
      reportDiagnostic({ eventType: "track_reacquiring", details: "Attempting to re-acquire video track" });
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
      addDebugLog("✅ Video track re-acquired successfully");
      reportDiagnostic({ eventType: "track_reacquired", details: `Video track re-acquired: ${newVideoTrack.label}` });
    } catch (err: any) {
      addDebugLog(`❌ Failed to re-acquire video: ${err.message}`);
      reportDiagnostic({ eventType: "track_reacquire_failed", details: err.message });
      setIsVideoEnabled(false);
    }
  }, [addDebugLog]);

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
      setConnectionStatus("Участник присоединился");
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
      setConnectionStatus("Участник отключился");
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
        if (dot) dot.className = getQualityDotClass(metrics.level);
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
      setConnectionStatus("Подключение к серверу...");
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

    // Handle iOS Safari background/foreground: video track can die
    // when the tab loses visibility, while audio keeps working.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check local video track
        if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack && videoTrack.readyState === 'ended') {
            addDebugLog("⚠️ Video track died while page was hidden — re-acquiring");
            reacquireVideo();
          }
        }
        // Check peer connections and restart ICE if degraded
        peersRef.current.forEach((peer, peerId) => {
          if (peer.connection.iceConnectionState !== 'connected'
              && peer.connection.iceConnectionState !== 'completed') {
            addDebugLog(`🔄 Peer ${peerId.substring(0, 8)} degraded after background — restarting ICE`);
            attemptIceRestart(peerId);
          }
        });
      }
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
      setConnectionStatus("Запрос разрешений...");

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

      setConnectionStatus(peersRef.current.size > 0 ? "Подключено" : "Ожидание участников...");
      addDebugLog("✅ Media permissions updated");
    } catch (error: any) {
      addDebugLog(`❌ Failed to get media: ${error.message}`);
      setConnectionStatus("Ошибка доступа к медиа");
      alert("Не удалось получить доступ к камере или микрофону. Проверьте настройки браузера.");
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
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const endCall = () => {
    cleanup();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Top Header - Title and Settings */}
      <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3">
          {/* Статус с кнопкой Debug и индикатором качества */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <QualityIndicator level={overallLevel} preset={currentPreset} showLabel size="md" />
            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 font-medium">
              {connectionStatus}
              <span className="ml-2 text-xs sm:text-sm font-normal text-gray-600 dark:text-gray-400">
                ({participantCount} {participantCount === 1 ? 'участник' : participantCount < 5 ? 'участника' : 'участников'})
              </span>
            </p>
            <ShareLinkButton size="small" variant="outlined" />
            {/* Debug Button */}
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all hover:scale-110"
              title={showDebug ? "Скрыть Debug логи" : "Показать Debug логи"}
            >
              <span className="text-lg">🕷️</span>
            </button>
          </div>

          {/* Настройки в одну строку - 50% на 50% */}
          <div className="flex gap-2 max-w-4xl mx-auto">
            {/* Region Selector - 50% */}
            <div className="flex-1 flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 shadow-sm">
              <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                🌍
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => {
                  const newRegion = e.target.value as keyof typeof ICE_SERVER_CONFIGS;
                  setSelectedRegion(newRegion);
                  addDebugLog(`🌍 Changed ICE servers to: ${ICE_SERVER_CONFIGS[newRegion].name}`);
                  setTimeout(() => reconnectAllPeers(), 100);
                }}
                className="flex-1 bg-transparent text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none"
              >
                {Object.entries(ICE_SERVER_CONFIGS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Кнопка запроса разрешений - 50% */}
            <button
              onClick={requestMediaPermissions}
              className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-all duration-200 hover:scale-105 active:scale-95"
              title="Перезапросить доступ к камере и микрофону"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3 sm:h-4 sm:w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span className="hidden sm:inline">Запросить доступ</span>
              <span className="sm:hidden">🎥🎤</span>
            </button>
          </div>
        </div>
      </div>

      {/* Контейнер видео на весь экран с отступами */}
      <div className="h-[calc(100vh-140px)] sm:h-[calc(100vh-160px)] p-2 sm:p-4 md:p-6 pb-20 sm:pb-24">
        {participantCount === 1 ? (
          /* Пока нет других участников - показываем большое локальное видео */
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-full max-w-3xl">
              <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl aspect-video">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!isVideoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <p className="text-white text-lg sm:text-xl">Камера выключена</p>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-black/70 text-white px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold">
                  Вы
                </div>
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg font-medium">
                Ожидание других участников...
              </p>
              <p className="text-gray-500 dark:text-gray-500 text-xs sm:text-sm mt-2">
                Поделитесь ссылкой на эту страницу
              </p>
            </div>
          </div>
        ) : (
          /* Есть другие участники - показываем сетку */
          <div className="h-full w-full">
            <div className={`grid gap-2 sm:gap-3 md:gap-4 h-full ${
              participantCount === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : participantCount === 3
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : participantCount === 4
                ? 'grid-cols-2'
                : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            }`}>
              {/* Локальное видео - скрываем если hideMyVideo === true */}
              {!hideMyVideo && (
                <div className="relative bg-black rounded-lg overflow-hidden shadow-xl">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                      <p className="text-white text-sm sm:text-base">Камера выключена</p>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs sm:text-sm font-semibold">
                    Вы
                  </div>
                </div>
              )}

              {/* Контейнер для удаленных видео */}
              <div
                ref={remoteVideoContainerRef}
                className={`contents ${hideMyVideo ? 'col-span-full' : ''}`}
              >
                {/* Видео элементы других участников будут добавлены динамически */}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer - MediaControls */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-lg border-t border-gray-200 dark:border-gray-700">
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
        />
      </div>

      {/* Debug Panel */}
      <DebugPanel
        logs={debugInfo}
        isOpen={showDebug}
        onToggle={() => setShowDebug(!showDebug)}
      />
    </div>
  );
}
