"use client";

interface MediaControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  isCallActive: boolean;
  hideMyVideo?: boolean;
  onToggleHideMyVideo?: () => void;
  participantCount?: number;
}

export default function MediaControls({
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
  isCallActive,
  hideMyVideo = false,
  onToggleHideMyVideo,
  participantCount = 1,
}: MediaControlsProps) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 justify-center items-center p-2 sm:p-4">
      {/* Кнопка микрофона */}
      <button
        onClick={onToggleAudio}
        disabled={!isCallActive}
        className={`flex-1 min-w-[80px] sm:flex-none px-4 sm:px-5 py-3 sm:py-3 rounded-full font-medium text-base sm:text-base transition-all ${
          isCallActive
            ? isAudioEnabled
              ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:scale-105"
              : "bg-red-500 hover:bg-red-600 text-white shadow-lg hover:scale-105"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
        title={isAudioEnabled ? "Выключить микрофон" : "Включить микрофон"}
      >
        <span className="hidden sm:inline">{isAudioEnabled ? "🎤 Микрофон" : "🎤 Выкл"}</span>
        <span className="sm:hidden text-xl">🎤</span>
      </button>

      {/* Кнопка камеры */}
      <button
        onClick={onToggleVideo}
        disabled={!isCallActive}
        className={`flex-1 min-w-[80px] sm:flex-none px-4 sm:px-5 py-3 sm:py-3 rounded-full font-medium text-base sm:text-base transition-all ${
          isCallActive
            ? isVideoEnabled
              ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:scale-105"
              : "bg-red-500 hover:bg-red-600 text-white shadow-lg hover:scale-105"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
        title={isVideoEnabled ? "Выключить камеру" : "Включить камеру"}
      >
        <span className="hidden sm:inline">{isVideoEnabled ? "📹 Камера" : "📹 Выкл"}</span>
        <span className="sm:hidden text-xl">📹</span>
      </button>

      {/* Кнопка "Скрыть себя" - показывается только если есть другие участники */}
      {participantCount > 1 && onToggleHideMyVideo && (
        <button
          onClick={onToggleHideMyVideo}
          disabled={!isCallActive}
          className={`flex-1 min-w-[80px] sm:flex-none px-4 sm:px-5 py-3 sm:py-3 rounded-full font-medium text-base sm:text-base transition-all ${
            isCallActive
              ? hideMyVideo
                ? "bg-gray-600 hover:bg-gray-700 text-white shadow-lg hover:scale-105"
                : "bg-purple-500 hover:bg-purple-600 text-white shadow-lg hover:scale-105"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
          title={hideMyVideo ? "Показать своё видео" : "Скрыть своё видео"}
        >
          <span className="hidden sm:inline">{hideMyVideo ? "👁️ Показать себя" : "👁️‍🗨️ Скрыть себя"}</span>
          <span className="sm:hidden text-xl">{hideMyVideo ? "👁️" : "👁️‍🗨️"}</span>
        </button>
      )}

      {/* Кнопка завершения звонка */}
      <button
        onClick={onEndCall}
        disabled={!isCallActive}
        className={`flex-1 min-w-[80px] sm:flex-none px-4 sm:px-5 py-3 sm:py-3 rounded-full font-medium text-base sm:text-base transition-all ${
          isCallActive
            ? "bg-red-600 hover:bg-red-700 text-white shadow-lg hover:scale-105"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
        title="Завершить звонок"
      >
        <span className="hidden sm:inline">📞 Завершить</span>
        <span className="sm:hidden text-xl">📞</span>
      </button>
    </div>
  );
}
