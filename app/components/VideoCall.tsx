"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import MediaControls from "./MediaControls";
import DebugPanel from "./DebugPanel";

interface PeerConnection {
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

// ICE Server configurations for different regions
const ICE_SERVER_CONFIGS = {
  global: {
    name: "🌐 Глобальные",
    config: {
      iceServers: [
        // Google STUN
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        // Cloudflare STUN
        { urls: "stun:stun.cloudflare.com:3478" },
        // Twilio
        { urls: "stun:global.stun.twilio.com:3478" },
        // European
        { urls: "stun:stun.ekiga.net" },
        { urls: "stun:stun.schlund.de" },
        // VoIP
        { urls: "stun:stun.voiparound.com" },
        { urls: "stun:stun.sipgate.net" },
        // FREE TURN servers
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
        // Taiwan STUN
        { urls: "stun:stun1.cht.com.net:3478" },
        // Japan STUN
        { urls: "stun:s1.voipstation.jp:3478" },
        { urls: "stun:s2.voipstation.jp:3478" },
        // Cloudflare (global, neutral)
        { urls: "stun:stun.cloudflare.com:3478" },
        // Neutral VoIP servers
        { urls: "stun:stun.sipnet.net:3478" },
        { urls: "stun:stun.voipgate.com:3478" },
        { urls: "stun:stunserver.org:3478" },
        // International VoIP
        { urls: "stun:stun.voiparound.com" },
        { urls: "stun:stun.voipbuster.com" },
        { urls: "stun:stun.voipstunt.com" },
        // FREE TURN servers (не .ru домены!)
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
        // Cloudflare STUN
        { urls: "stun:stun.cloudflare.com:3478" },
        // European STUN
        { urls: "stun:stun.ekiga.net" },
        { urls: "stun:stun.ideasip.com" },
        { urls: "stun:stun.schlund.de" },
        // VoIP (Europe)
        { urls: "stun:stun.voiparound.com" },
        { urls: "stun:stun.voipbuster.com" },
        { urls: "stun:stun.sipgate.net" },
        { urls: "stun:stun.stunprotocol.org:3478" },
        // FREE TURN servers
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
        // Numb TURN (popular but sometimes unreliable)
        {
          urls: "turn:numb.viagenie.ca",
          username: "webrtc@live.com",
          credential: "muazkh",
        },
        // FREE TURN servers - multiple for failover
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
        // Will be loaded dynamically from API
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
    } as RTCConfiguration,
  },
};

export default function VideoCall() {
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<string>("Подключение...");
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [selectedRegion, setSelectedRegion] = useState<keyof typeof ICE_SERVER_CONFIGS>("metered");
  const [meteredIceServers, setMeteredIceServers] = useState<RTCConfiguration | null>(null);
  const [hideMyVideo, setHideMyVideo] = useState<boolean>(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteVideoContainerRef = useRef<HTMLDivElement>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());

  // Get ICE servers based on selected region
  const iceServers = selectedRegion === 'metered' && meteredIceServers
    ? meteredIceServers
    : ICE_SERVER_CONFIGS[selectedRegion].config;

  // Debug helper
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setDebugInfo(prev => [...prev.slice(-50), logMessage]); // Keep last 50 messages
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Проверяем, что мы в браузере
    if (typeof window === 'undefined') return;

    initializeMedia();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeMedia = async () => {
    try {
      addDebugLog("🚀 Initializing media...");

      // Проверяем поддержку WebRTC
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("WebRTC не поддерживается в этом браузере");
      }

      // Получаем доступ к камере и микрофону
      addDebugLog("📹 Requesting camera and microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      const tracks = stream.getTracks();
      addDebugLog(`✅ Media access granted: ${tracks.map(t => `${t.kind}:${t.label}`).join(', ')}`);

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        addDebugLog("📺 Local video element connected");
      }

      setConnectionStatus("Подключение к серверу...");

      // Подключаемся к Socket.IO серверу
      addDebugLog("🔌 Connecting to Socket.IO server...");
      const socket = io({
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        addDebugLog(`🔌 Connected to Socket.IO server, my ID: ${socket.id}`);
        setConnectionStatus("Ожидание участников...");
        setParticipantCount(1);
      });

      socket.on("connect_error", (error) => {
        addDebugLog(`❌ Socket.IO connection error: ${error.message}`);
        setConnectionStatus("Ошибка подключения к серверу");
      });

      socket.on("disconnect", (reason) => {
        addDebugLog(`❌ Disconnected from Socket.IO server: ${reason}`);
        setConnectionStatus("Отключено от сервера");
      });

      // Получаем список существующих пользователей
      socket.on("existing-users", (userIds: string[]) => {
        addDebugLog(`👥 Received existing users list: ${userIds.length} users`);
        userIds.forEach((userId) => {
          addDebugLog(`  └─ Will connect to: ${userId.substring(0, 8)}...`);
          createPeerConnection(userId, true);
        });
        setParticipantCount(userIds.length + 1);
      });

      // Новый пользователь присоединился
      socket.on("user-joined", (userId: string) => {
        addDebugLog(`👤 New user joined: ${userId.substring(0, 8)}...`);
        createPeerConnection(userId, false);
        setParticipantCount((prev) => prev + 1);
        setConnectionStatus("Участник присоединился");
      });

      // Получили offer от другого пользователя
      socket.on("offer", async ({ from, offer }) => {
        addDebugLog(`📥 Received offer from: ${from.substring(0, 8)}...`);
        const peer = peersRef.current.get(from);
        if (peer) {
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

      // Получили answer от другого пользователя
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

      // Получили ICE candidate
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

      // Пользователь отключился
      socket.on("user-left", (userId: string) => {
        addDebugLog(`👋 User left: ${userId.substring(0, 8)}...`);
        removePeer(userId);
        setParticipantCount((prev) => Math.max(1, prev - 1));
        setConnectionStatus("Участник отключился");
      });

    } catch (err: any) {
      addDebugLog(`❌ Failed to get local stream: ${err.message}`);
      setConnectionStatus("Ошибка доступа к камере/микрофону");
    }
  };

  const createPeerConnection = (userId: string, createOffer: boolean) => {
    addDebugLog(`🔧 Creating peer connection with ${userId}, initiator: ${createOffer}`);
    const peerConnection = new RTCPeerConnection(iceServers);

    // Track relay candidates
    let hasRelayCandidates = false;
    const candidateTimeout = setTimeout(() => {
      if (!hasRelayCandidates) {
        addDebugLog(`⚠️ WARNING: No TURN relay candidates for ${userId} - check TURN servers!`);
      }
    }, 10000); // Check after 10 seconds

    // Добавляем локальные треки
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks();
      addDebugLog(`➕ Adding ${tracks.length} local tracks to peer ${userId}`);
      tracks.forEach((track) => {
        addDebugLog(`  └─ ${track.kind}: enabled=${track.enabled}, readyState=${track.readyState}`);
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    } else {
      addDebugLog(`❌ No local stream available!`);
    }

    // Обработка входящих треков
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

      // Создаем или обновляем видео элемент для удаленного пользователя
      updateRemoteVideo(userId, remoteStream);
      setConnectionStatus("Звонок активен");
    };

    // Обработка ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        const candidateType = event.candidate.type;
        addDebugLog(`🧊 ICE candidate for ${userId}: ${candidateType} (${event.candidate.protocol})`);
        addDebugLog(`  └─ ${event.candidate.address || 'no-address'}:${event.candidate.port || 'no-port'}`);

        // Track relay candidates
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

    // Обработка ICE gathering state
    peerConnection.onicegatheringstatechange = () => {
      addDebugLog(`🧊 ICE gathering state for ${userId}: ${peerConnection.iceGatheringState}`);
    };

    // Обработка состояния соединения
    peerConnection.onconnectionstatechange = () => {
      addDebugLog(`🔗 Connection state with ${userId}: ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === "failed" ||
          peerConnection.connectionState === "disconnected") {
        addDebugLog(`❌ Connection ${peerConnection.connectionState} with ${userId}`);
        removePeer(userId);
      } else if (peerConnection.connectionState === "connected") {
        addDebugLog(`✅ Successfully connected to ${userId}`);
        // Log selected ICE candidate pair
        peerConnection.getStats().then(stats => {
          stats.forEach(stat => {
            if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
              addDebugLog(`  └─ Using ICE pair: ${stat.localCandidateId} ↔ ${stat.remoteCandidateId}`);
            }
          });
        });
      }
    };

    // Обработка ICE connection state
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

    // Обработка signaling state
    peerConnection.onsignalingstatechange = () => {
      addDebugLog(`📡 Signaling state with ${userId}: ${peerConnection.signalingState}`);
    };

    peersRef.current.set(userId, { connection: peerConnection });

    // Если мы инициаторы, создаем offer
    if (createOffer) {
      console.log(`📤 Creating offer for ${userId}`);
      peerConnection
        .createOffer()
        .then((offer) => {
          console.log(`✅ Offer created for ${userId}, setting local description`);
          return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
          if (socketRef.current) {
            console.log(`📨 Sending offer to ${userId} via Socket.IO`);
            socketRef.current.emit("offer", {
              to: userId,
              offer: peerConnection.localDescription,
            });
          }
        })
        .catch((err) => console.error(`❌ Error creating offer for ${userId}:`, err));
    }
  };

  const updateRemoteVideo = (userId: string, stream: MediaStream) => {
    let videoElement = remoteVideosRef.current.get(userId);

    if (!videoElement && remoteVideoContainerRef.current) {
      // Создаем новый видео элемент
      const container = document.createElement("div");
      container.className = "relative bg-black rounded-lg overflow-hidden shadow-xl";
      container.id = `peer-${userId}`;

      videoElement = document.createElement("video");
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = false; // Удаленное видео НЕ должно быть muted
      videoElement.className = "w-full h-full object-cover";
      videoElement.srcObject = stream;

      // Добавляем label с именем участника
      const label = document.createElement("div");
      label.className = "absolute bottom-2 left-2 bg-purple-600 text-white px-2 py-1 rounded text-xs sm:text-sm font-semibold";
      label.textContent = `Участник ${userId.substring(0, 4)}`;

      container.appendChild(videoElement);
      container.appendChild(label);
      remoteVideoContainerRef.current.appendChild(container);
      remoteVideosRef.current.set(userId, videoElement);
      console.log("Created video element for user:", userId);
    } else if (videoElement) {
      videoElement.srcObject = stream;
      console.log("Updated video stream for user:", userId);
    }
  };

  const removePeer = (userId: string) => {
    const peer = peersRef.current.get(userId);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(userId);
    }

    const videoElement = remoteVideosRef.current.get(userId);
    if (videoElement) {
      const container = document.getElementById(`peer-${userId}`);
      if (container) {
        container.remove();
      }
      remoteVideosRef.current.delete(userId);
    }
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    peersRef.current.forEach((peer) => {
      peer.connection.close();
    });
    peersRef.current.clear();

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    remoteVideosRef.current.clear();
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

  const reconnectAllPeers = () => {
    addDebugLog(`🔄 Reconnecting all peers with new ICE servers...`);

    // Get current peer IDs
    const peerIds = Array.from(peersRef.current.keys());

    if (peerIds.length === 0) {
      addDebugLog(`⚠️ No active peers to reconnect`);
      return;
    }

    // Close all existing connections
    peerIds.forEach(userId => {
      addDebugLog(`  └─ Closing connection to ${userId.substring(0, 8)}...`);
      removePeer(userId);
    });

    // Recreate connections with new ICE servers
    peerIds.forEach(userId => {
      addDebugLog(`  └─ Recreating connection to ${userId.substring(0, 8)}...`);
      createPeerConnection(userId, true);
    });

    addDebugLog(`✅ Reconnect initiated for ${peerIds.length} peer(s)`);
  };

  const requestMediaPermissions = async () => {
    try {
      console.log("Перезапрос доступа к камере и микрофону...");
      setConnectionStatus("Запрос разрешений...");

      // Останавливаем старые треки
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          console.log(`Stopping old track: ${track.kind}`);
          track.stop();
        });
      }

      // Запрашиваем новый доступ
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log("Новый доступ получен", newStream);

      localStreamRef.current = newStream;

      // Обновляем локальное видео
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }

      // Обновляем состояние кнопок
      const audioTrack = newStream.getAudioTracks()[0];
      const videoTrack = newStream.getVideoTracks()[0];
      setIsAudioEnabled(audioTrack?.enabled ?? true);
      setIsVideoEnabled(videoTrack?.enabled ?? true);

      // Заменяем треки во всех активных peer connections
      const audioTracks = newStream.getAudioTracks();
      const videoTracks = newStream.getVideoTracks();

      peersRef.current.forEach((peer, userId) => {
        console.log(`Обновление треков для пира ${userId}`);

        // Находим и заменяем аудио треки
        const audioSenders = peer.connection.getSenders().filter(s => s.track?.kind === 'audio');
        audioSenders.forEach((sender, index) => {
          if (audioTracks[index]) {
            sender.replaceTrack(audioTracks[index]);
            console.log(`Аудио трек заменен для ${userId}`);
          }
        });

        // Находим и заменяем видео треки
        const videoSenders = peer.connection.getSenders().filter(s => s.track?.kind === 'video');
        videoSenders.forEach((sender, index) => {
          if (videoTracks[index]) {
            sender.replaceTrack(videoTracks[index]);
            console.log(`Видео трек заменен для ${userId}`);
          }
        });
      });

      setConnectionStatus(peersRef.current.size > 0 ? "Подключено" : "Ожидание участников...");
      console.log("✅ Разрешения успешно обновлены");
    } catch (error) {
      console.error("❌ Ошибка при запросе разрешений:", error);
      setConnectionStatus("Ошибка доступа к медиа");
      alert("Не удалось получить доступ к камере или микрофону. Проверьте настройки браузера.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Sticky Header с управлением */}
      <div className="sticky top-0 z-50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2">
          {/* Заголовок и статус */}
          <div className="text-center mb-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
              Видеоконференция
              <span className="ml-2 sm:ml-3 text-sm sm:text-base font-normal text-gray-600 dark:text-gray-400">
                ({participantCount} {participantCount === 1 ? 'участник' : participantCount < 5 ? 'участника' : 'участников'})
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
              {connectionStatus}
            </p>
          </div>

          {/* Элементы управления */}
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

          {/* Настройки в одну строку */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4 mt-2 pb-2">
            {/* Region Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                🌍 Серверы:
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => {
                  const newRegion = e.target.value as keyof typeof ICE_SERVER_CONFIGS;
                  setSelectedRegion(newRegion);
                  addDebugLog(`🌍 Changed ICE servers to: ${ICE_SERVER_CONFIGS[newRegion].name}`);
                  setTimeout(() => reconnectAllPeers(), 100);
                }}
                className="px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg shadow-sm hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(ICE_SERVER_CONFIGS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Кнопка запроса разрешений */}
            <button
              onClick={requestMediaPermissions}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-all duration-200 hover:scale-105 active:scale-95"
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
              <span className="sm:hidden">Доступ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Контейнер видео на весь экран с отступами */}
      <div className="h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)] p-2 sm:p-4 md:p-6">
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

      {/* Debug Panel */}
      <DebugPanel
        logs={debugInfo}
        isOpen={showDebug}
        onToggle={() => setShowDebug(!showDebug)}
      />
    </div>
  );
}
