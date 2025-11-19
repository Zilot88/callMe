import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              CallMe
            </h1>
            <p className="text-2xl text-gray-600 dark:text-gray-300 mb-2">
              Общая видеоконференция
            </p>
            <p className="text-lg text-gray-500 dark:text-gray-400">
              Просто зайдите на сайт и автоматически присоединитесь к звонку
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 mb-12">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mb-6">
                <span className="text-5xl">🎥</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
                Присоединиться к конференции
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                Все пользователи автоматически объединяются в одну общую комнату. Никаких ID и настроек!
              </p>
            </div>

            <div className="flex justify-center">
              <Link
                href="/videocall"
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                <span className="text-2xl">📞</span>
                Войти в конференцию
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
              <div className="text-4xl mb-4">✨</div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Автоматически
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Просто зайдите на сайт - вы сразу в звонке
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Общая комната
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Все участники видят и слышат друг друга
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Без настроек
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Не нужно вводить ID или коды
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 text-center">
              Как это работает?
            </h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-1">
                    Откройте ссылку
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300">
                    Локальная сеть: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">https://192.168.50.57:4057</code>
                    <br />
                    Из интернета: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">https://176.36.188.208:4057</code>
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-1">
                    Нажмите "Войти в конференцию"
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300">
                    Разрешите доступ к камере и микрофону
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-1">
                    Готово!
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300">
                    Вы автоматически подключены ко всем участникам
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Совет:</strong> Откройте эту ссылку на разных устройствах в вашей локальной сети,
                и все автоматически присоединятся к одной конференции!
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-12 text-gray-500 dark:text-gray-400">
            <p>Powered by WebRTC & Socket.IO</p>
          </div>
        </div>
      </div>
    </div>
  );
}
