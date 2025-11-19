"use client";

import dynamic from "next/dynamic";

// Динамический импорт с отключенным SSR
const VideoCall = dynamic(() => import("../components/VideoCall"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Загрузка...</p>
      </div>
    </div>
  ),
});

export default function VideoCallPage() {
  return <VideoCall />;
}
