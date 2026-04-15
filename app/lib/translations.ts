export type Locale = "en" | "ru";

export const translations = {
  // ─── Home page ────────────────────────────────────────────────────
  "home.title": { en: "Video Calls & Chats", ru: "Видеозвонки и чаты" },
  "home.subtitle": { en: "Create a room and share the link — no signup, no install", ru: "Создайте комнату и поделитесь ссылкой — без регистрации, без установки" },
  "home.video.title": { en: "Video Conference", ru: "Видеоконференция" },
  "home.video.desc": { en: "P2P video call via WebRTC. Create a room and invite participants by link.", ru: "P2P видеозвонок через WebRTC. Создайте комнату и пригласите участников по ссылке." },
  "home.video.create": { en: "Create Conference", ru: "Создать конференцию" },
  "home.video.placeholder": { en: "Paste link or room ID", ru: "Вставьте ссылку или ID комнаты" },
  "home.chat.title": { en: "Group Chat", ru: "Групповой чат" },
  "home.chat.desc": { en: "Real-time instant messaging. Create a chat and talk with friends.", ru: "Мгновенные сообщения в реальном времени. Создайте чат и общайтесь с друзьями." },
  "home.chat.create": { en: "Create Chat", ru: "Создать чат" },
  "home.chat.placeholder": { en: "Paste link or chat ID", ru: "Вставьте ссылку или ID чата" },
  "home.or": { en: "or", ru: "или" },

  // ─── Media controls ───────────────────────────────────────────────
  "mic.on": { en: "Mute microphone", ru: "Выключить микрофон" },
  "mic.off": { en: "Unmute microphone", ru: "Включить микрофон" },
  "cam.on": { en: "Turn off camera", ru: "Выключить камеру" },
  "cam.off": { en: "Turn on camera", ru: "Включить камеру" },
  "self.hide": { en: "Hide your video", ru: "Скрыть своё видео" },
  "self.show": { en: "Show your video", ru: "Показать своё видео" },
  "call.end": { en: "End call", ru: "Завершить звонок" },

  // ─── Video call ───────────────────────────────────────────────────
  "status.connecting": { en: "Connecting...", ru: "Подключение..." },
  "status.waiting": { en: "Waiting for participants...", ru: "Ожидание участников..." },
  "status.connecting_server": { en: "Connecting to server...", ru: "Подключение к серверу..." },
  "status.active": { en: "Call active", ru: "Звонок активен" },
  "status.error": { en: "Server connection error", ru: "Ошибка подключения к серверу" },
  "status.disconnected": { en: "Disconnected from server", ru: "Отключено от сервера" },
  "status.joined": { en: "Participant joined", ru: "Участник присоединился" },
  "status.left": { en: "Participant left", ru: "Участник отключился" },
  "status.requesting": { en: "Requesting permissions...", ru: "Запрос разрешений..." },
  "status.connected": { en: "Connected", ru: "Подключено" },
  "status.media_error": { en: "Media access error", ru: "Ошибка доступа к медиа" },
  "video.cam_off": { en: "Camera is off", ru: "Камера выключена" },
  "video.you": { en: "You", ru: "Вы" },
  "video.waiting": { en: "Waiting for other participants...", ru: "Ожидание других участников..." },
  "video.share_hint": { en: "Share the link to invite", ru: "Поделитесь ссылкой" },
  "video.participant": { en: "Participant", ru: "Участник" },
  "video.media_btn": { en: "Media", ru: "Медиа" },
  "video.media_error_alert": { en: "Could not access camera or microphone. Check browser settings.", ru: "Не удалось получить доступ к камере или микрофону. Проверьте настройки браузера." },

  // ─── ICE regions ──────────────────────────────────────────────────
  "ice.global": { en: "Global", ru: "Глобальные" },
  "ice.neutral": { en: "Neutral", ru: "Нейтральные" },
  "ice.europe": { en: "Europe", ru: "Европа" },
  "ice.turn_only": { en: "TURN Only", ru: "Только TURN" },
  "ice.metered": { en: "Metered (20GB)", ru: "Metered (20GB)" },

  // ─── Chat ─────────────────────────────────────────────────────────
  "chat.title": { en: "Chat", ru: "Чат" },
  "chat.no_connection": { en: "No connection", ru: "Нет связи" },
  "chat.joined": { en: "joined the chat", ru: "присоединился к чату" },
  "chat.left": { en: "left the chat", ru: "покинул чат" },
  "chat.you_joined": { en: "You joined as", ru: "Вы вошли как" },
  "chat.placeholder": { en: "Message...", ru: "Сообщение..." },
  "chat.enter_name": { en: "Enter name...", ru: "Введите имя..." },

  // ─── Nickname dialog ──────────────────────────────────────────────
  "nickname.title": { en: "What's your name?", ru: "Как вас зовут?" },
  "nickname.placeholder": { en: "Enter name", ru: "Введите имя" },
  "nickname.submit": { en: "Join chat", ru: "Войти в чат" },

  // ─── Share button ─────────────────────────────────────────────────
  "share.copy": { en: "Share", ru: "Поделиться" },
  "share.copied": { en: "Copied", ru: "Скопировано" },
  "share.snackbar": { en: "Link copied to clipboard", ru: "Ссылка скопирована в буфер обмена" },

  // ─── Quality indicator ────────────────────────────────────────────
  "quality.excellent": { en: "Excellent", ru: "Отлично" },
  "quality.good": { en: "Good", ru: "Хорошо" },
  "quality.degraded": { en: "Fair", ru: "Среднее" },
  "quality.poor": { en: "Poor", ru: "Плохое" },
  "quality.critical": { en: "Very poor", ru: "Очень плохое" },
  "quality.audio_only": { en: "Audio only", ru: "Только аудио" },

  // ─── Loading / errors ─────────────────────────────────────────────
  "loading": { en: "Loading...", ru: "Загрузка..." },
  "loading.chat": { en: "Loading chat...", ru: "Загрузка чата..." },
  "loading.timeout": { en: "Loading is taking too long", ru: "Загрузка занимает слишком долго" },
  "loading.timeout_hint": { en: "Check your internet connection and try again", ru: "Проверьте интернет-соединение и попробуйте снова" },
  "loading.reload": { en: "Reload", ru: "Перезагрузить" },
  "error.title": { en: "Something went wrong", ru: "Что-то пошло не так" },
  "error.unknown": { en: "Unknown error", ru: "Неизвестная ошибка" },
  "error.retry": { en: "Try again", ru: "Попробовать снова" },
  "error.report": { en: "Send report", ru: "Отправить отчёт" },
  "nav.home": { en: "Home", ru: "На главную" },

  // ─── Debug panel ──────────────────────────────────────────────────
  "debug.empty": { en: "No logs. Waiting for events...", ru: "Нет логов. Ожидание событий..." },
} as const;

export type TranslationKey = keyof typeof translations;
