"use client";

import { useEffect, useRef } from "react";

interface DebugPanelProps {
  logs: string[];
  isOpen: boolean;
  onToggle: () => void;
}

export default function DebugPanel({ logs, isOpen, onToggle }: DebugPanelProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen]);

  const copyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    alert('Логи скопированы в буфер обмена!');
  };

  const downloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webrtc-debug-${new Date().toISOString()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="mb-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg flex items-center gap-2"
        title="Показать/скрыть debug панель"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Debug Logs ({logs.length})
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="bg-gray-900 text-gray-100 rounded-lg shadow-2xl w-[600px] max-h-[500px] flex flex-col">
          {/* Header */}
          <div className="bg-gray-800 px-4 py-3 rounded-t-lg flex justify-between items-center border-b border-gray-700">
            <h3 className="font-bold text-lg">🔍 WebRTC Debug Logs</h3>
            <div className="flex gap-2">
              <button
                onClick={copyLogs}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                title="Скопировать логи"
              >
                📋 Copy
              </button>
              <button
                onClick={downloadLogs}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                title="Скачать логи"
              >
                💾 Download
              </button>
              <button
                onClick={onToggle}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Logs Container */}
          <div className="overflow-y-auto p-4 space-y-1 font-mono text-xs flex-1">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Нет логов. Ожидание событий...
              </div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`${
                    log.includes('❌') ? 'text-red-400' :
                    log.includes('✅') ? 'text-green-400' :
                    log.includes('🧊') ? 'text-blue-400' :
                    log.includes('📥') || log.includes('📨') || log.includes('📤') ? 'text-yellow-400' :
                    log.includes('🔧') || log.includes('🔗') || log.includes('📡') ? 'text-purple-400' :
                    log.includes('👥') || log.includes('👤') || log.includes('👋') ? 'text-cyan-400' :
                    'text-gray-300'
                  }`}
                >
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

          {/* Footer Info */}
          <div className="bg-gray-800 px-4 py-2 rounded-b-lg border-t border-gray-700 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>📊 Всего событий: {logs.length}</span>
              <span>🕐 Последнее: {logs.length > 0 ? logs[logs.length - 1].match(/\[(.*?)\]/)?.[1] || 'N/A' : 'N/A'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
