"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import MediaControls from "./MediaControls";

interface PeerConnection {
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

export default function VideoCall() {
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<string>("Подключение...");
  const [participantCount, setParticipantCount] = useState<number>(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteVideoContainerRef = useRef<HTMLDivElement>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());

  // ICE серверы для WebRTC
  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

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
      console.log("Initializing media...");

      // Проверяем поддержку WebRTC
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("WebRTC не поддерживается в этом браузере");
      }

      // Получаем доступ к камере и микрофону
      console.log("Requesting media access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log("Media access granted", stream);

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setConnectionStatus("Подключение к серверу...");

      // Подключаемся к Socket.IO серверу
      console.log("Connecting to Socket.IO server...");
      const socket = io({
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("Connected to server with ID:", socket.id);
        setConnectionStatus("Ожидание участников...");
        setParticipantCount(1);
      });

      socket.on("connect_error", (error) => {
        console.error("Socket.IO connection error:", error);
        setConnectionStatus("Ошибка подключения к серверу");
      });

      socket.on("disconnect", (reason) => {
        console.log("Disconnected from server:", reason);
        setConnectionStatus("Отключено от сервера");
      });

      // Получаем список существующих пользователей
      socket.on("existing-users", (userIds: string[]) => {
        console.log("Existing users:", userIds);
        userIds.forEach((userId) => {
          createPeerConnection(userId, true);
        });
        setParticipantCount(userIds.length + 1);
      });

      // Новый пользователь присоединился
      socket.on("user-joined", (userId: string) => {
        console.log("User joined:", userId);
        createPeerConnection(userId, false);
        setParticipantCount((prev) => prev + 1);
        setConnectionStatus("Участник присоединился");
      });

      // Получили offer от другого пользователя
      socket.on("offer", async ({ from, offer }) => {
        console.log("📥 Received offer from:", from);
        const peer = peersRef.current.get(from);
        if (peer) {
          console.log(`✅ Peer found for ${from}, setting remote description`);
          await peer.connection.setRemoteDescription(new RTCSessionDescription(offer));
          console.log(`📤 Creating answer for ${from}`);
          const answer = await peer.connection.createAnswer();
          await peer.connection.setLocalDescription(answer);
          console.log(`📨 Sending answer to ${from}`);
          socket.emit("answer", { to: from, answer });
        } else {
          console.error(`❌ No peer found for ${from}!`);
        }
      });

      // Получили answer от другого пользователя
      socket.on("answer", async ({ from, answer }) => {
        console.log("📥 Received answer from:", from);
        const peer = peersRef.current.get(from);
        if (peer) {
          console.log(`✅ Setting remote description from ${from}`);
          await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
        } else {
          console.error(`❌ No peer found for ${from}!`);
        }
      });

      // Получили ICE candidate
      socket.on("ice-candidate", async ({ from, candidate }) => {
        console.log("🧊 Received ICE candidate from:", from, "Type:", candidate.type);
        const peer = peersRef.current.get(from);
        if (peer) {
          try {
            await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log(`✅ Added ICE candidate from ${from}`);
          } catch (err) {
            console.error(`❌ Error adding ICE candidate from ${from}:`, err);
          }
        } else {
          console.error(`❌ No peer found for ${from}!`);
        }
      });

      // Пользователь отключился
      socket.on("user-left", (userId: string) => {
        console.log("User left:", userId);
        removePeer(userId);
        setParticipantCount((prev) => Math.max(1, prev - 1));
        setConnectionStatus("Участник отключился");
      });

    } catch (err) {
      console.error("Failed to get local stream", err);
      setConnectionStatus("Ошибка доступа к камере/микрофону");
    }
  };

  const createPeerConnection = (userId: string, createOffer: boolean) => {
    console.log(`Creating peer connection with ${userId}, createOffer: ${createOffer}`);
    const peerConnection = new RTCPeerConnection(iceServers);

    // Добавляем локальные треки
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getTracks();
      console.log(`Adding ${tracks.length} local tracks to peer ${userId}`);
      tracks.forEach((track) => {
        console.log(`Adding track: ${track.kind}, enabled: ${track.enabled}`);
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    } else {
      console.error("No local stream available!");
    }

    // Обработка входящих треков
    peerConnection.ontrack = (event) => {
      console.log("🎥 Received remote track from:", userId, "Track kind:", event.track.kind);
      const [remoteStream] = event.streams;
      console.log("Remote stream:", remoteStream, "Tracks:", remoteStream.getTracks().map(t => `${t.kind}:${t.enabled}`));

      const peer = peersRef.current.get(userId);
      if (peer) {
        peer.stream = remoteStream;
        console.log("✅ Saved stream to peer object");
      }

      // Создаем или обновляем видео элемент для удаленного пользователя
      updateRemoteVideo(userId, remoteStream);
      setConnectionStatus("Звонок активен");
    };

    // Обработка ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log(`🧊 ICE candidate for ${userId}:`, event.candidate.type);
        socketRef.current.emit("ice-candidate", {
          to: userId,
          candidate: event.candidate,
        });
      } else if (!event.candidate) {
        console.log(`✅ ICE gathering complete for ${userId}`);
      }
    };

    // Обработка состояния соединения
    peerConnection.onconnectionstatechange = () => {
      console.log(`🔗 Connection state with ${userId}:`, peerConnection.connectionState);
      if (peerConnection.connectionState === "failed" ||
          peerConnection.connectionState === "disconnected") {
        console.error(`❌ Connection ${peerConnection.connectionState} with ${userId}`);
        removePeer(userId);
      } else if (peerConnection.connectionState === "connected") {
        console.log(`✅ Successfully connected to ${userId}`);
      }
    };

    // Обработка ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE connection state with ${userId}:`, peerConnection.iceConnectionState);
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
      container.className = "relative bg-black rounded-lg overflow-hidden shadow-lg aspect-video";
      container.id = `peer-${userId}`;

      videoElement = document.createElement("video");
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = false; // Удаленное видео НЕ должно быть muted
      videoElement.className = "w-full h-full object-cover";
      videoElement.srcObject = stream;

      container.appendChild(videoElement);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800 dark:text-white">
          Общая конференция
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-2">
          Статус: <span className="font-semibold">{connectionStatus}</span>
        </p>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
          Участников: <span className="font-semibold text-blue-600 dark:text-blue-400">{participantCount}</span>
        </p>

        {/* Видео блок */}
        <div className="mb-8">
          {/* Локальное видео */}
          <div className="mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden max-w-md mx-auto">
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                <h3 className="font-semibold text-gray-800 dark:text-white">Вы</h3>
              </div>
              <div className="relative bg-black aspect-video">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!isVideoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <p className="text-white text-lg">Камера выключена</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Удаленные видео */}
          <div>
            <h3 className="text-2xl font-bold text-center mb-4 text-gray-800 dark:text-white">
              Другие участники
            </h3>
            <div
              ref={remoteVideoContainerRef}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {/* Видео элементы будут добавлены динамически */}
            </div>
            {participantCount === 1 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  Ожидание других участников...
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                  Поделитесь ссылкой на эту страницу с другими пользователями
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Элементы управления */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <MediaControls
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onEndCall={endCall}
            isCallActive={true}
          />
        </div>
      </div>
    </div>
  );
}
