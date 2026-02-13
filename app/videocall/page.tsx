"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import VideoCallErrorBoundary from "../components/ErrorBoundary";
import { reportDiagnostic } from "../lib/diagnostics";

function LoadingScreen() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
      reportDiagnostic({
        eventType: "loading_timeout",
        details: "JS chunk did not load within 15 seconds",
      });
    }, 15_000);
    return () => clearTimeout(timer);
  }, []);

  if (timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full text-center space-y-4">
          <div className="text-5xl">⏳</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Загрузка занимает слишком долго
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Проверьте интернет-соединение и попробуйте снова
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Перезагрузить
          </button>
          <a
            href="/"
            className="block text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            На главную
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Загрузка...</p>
      </div>
    </div>
  );
}

const VideoCall = dynamic(() => import("../components/VideoCall"), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export default function VideoCallPage() {
  return (
    <VideoCallErrorBoundary>
      <VideoCall />
    </VideoCallErrorBoundary>
  );
}
