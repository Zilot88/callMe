"use client";

import React from "react";
import { reportDiagnostic } from "../lib/diagnostics";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class VideoCallErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportDiagnostic({
      eventType: "component_crash",
      details: `${error.name}: ${error.message}`,
      error: info.componentStack || undefined,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReport = () => {
    const { error } = this.state;
    reportDiagnostic({
      eventType: "component_crash",
      details: `User-reported: ${error?.name}: ${error?.message}`,
      error: error?.stack || undefined,
    });
    alert("Отчёт отправлен. Спасибо!");
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full text-center space-y-4">
            <div className="text-5xl">😵</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Что-то пошло не так
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
              {this.state.error?.message || "Неизвестная ошибка"}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={this.handleRetry}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Попробовать снова
              </button>
              <button
                onClick={this.handleReport}
                className="w-full py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors text-sm"
              >
                Отправить отчёт
              </button>
              <a
                href="/"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1"
              >
                На главную
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
