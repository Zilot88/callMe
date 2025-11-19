"use client";

interface MediaControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  isCallActive: boolean;
}

export default function MediaControls({
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
  isCallActive,
}: MediaControlsProps) {
  return (
    <div className="flex gap-4 justify-center items-center p-4">
      <button
        onClick={onToggleAudio}
        disabled={!isCallActive}
        className={`px-6 py-3 rounded-full font-medium transition-colors ${
          isCallActive
            ? isAudioEnabled
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-red-500 hover:bg-red-600 text-white"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        {isAudioEnabled ? "🎤 Микрофон вкл" : "🎤 Микрофон выкл"}
      </button>

      <button
        onClick={onToggleVideo}
        disabled={!isCallActive}
        className={`px-6 py-3 rounded-full font-medium transition-colors ${
          isCallActive
            ? isVideoEnabled
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-red-500 hover:bg-red-600 text-white"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        {isVideoEnabled ? "📹 Камера вкл" : "📹 Камера выкл"}
      </button>

      <button
        onClick={onEndCall}
        disabled={!isCallActive}
        className={`px-6 py-3 rounded-full font-medium transition-colors ${
          isCallActive
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        📞 Завершить звонок
      </button>
    </div>
  );
}
