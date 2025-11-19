import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">

          {/* Main Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 mb-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
                Присоединиться к конференции
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                Все пользователи автоматически объединяются в одну общую комнату.
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
        </div>
      </div>
    </div>
  );
}
