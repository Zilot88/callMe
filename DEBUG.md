# Руководство по отладке CallMe

## Как проверить, что все работает

### 1. Откройте консоль браузера (F12)

После открытия страницы видеозвонка, вы должны увидеть следующие сообщения:

```
✅ Initializing media...
✅ Requesting media access...
✅ Media access granted [MediaStream object]
✅ Connecting to Socket.IO server...
✅ Connected to server with ID: [socket-id]
✅ Ожидание участников...
```

### 2. Когда подключается второй пользователь

**На первом устройстве:**
```
📥 User joined: [socket-id-2]
📤 Creating peer connection with [socket-id-2], createOffer: false
✅ Adding 2 local tracks to peer [socket-id-2]
✅ Adding track: video, enabled: true
✅ Adding track: audio, enabled: true
```

**На втором устройстве:**
```
📥 Existing users: [[socket-id-1]]
📤 Creating peer connection with [socket-id-1], createOffer: true
📤 Creating offer for [socket-id-1]
✅ Offer created for [socket-id-1], setting local description
📨 Sending offer to [socket-id-1] via Socket.IO
```

### 3. Обмен WebRTC сигналами

Вы должны увидеть последовательность:
```
📥 Received offer from: [socket-id]
✅ Peer found for [socket-id], setting remote description
📤 Creating answer for [socket-id]
📨 Sending answer to [socket-id]

📥 Received answer from: [socket-id]
✅ Setting remote description from [socket-id]

🧊 ICE candidate for [socket-id]: host
🧊 ICE candidate for [socket-id]: srflx
🧊 Received ICE candidate from: [socket-id]
✅ Added ICE candidate from [socket-id]
```

### 4. Успешное соединение

Когда соединение установлено:
```
🔗 Connection state with [socket-id]: connecting
🧊 ICE connection state with [socket-id]: checking
🧊 ICE connection state with [socket-id]: connected
🔗 Connection state with [socket-id]: connected
✅ Successfully connected to [socket-id]

🎥 Received remote track from: [socket-id] Track kind: video
Remote stream: [MediaStream] Tracks: [video:true, audio:true]
✅ Saved stream to peer object
✅ Created video element for user: [socket-id]

🎥 Received remote track from: [socket-id] Track kind: audio
```

## Типичные проблемы

### Проблема 1: "Cannot read properties of undefined (reading 'getUserMedia')"
**Причина:** Код выполняется на сервере
**Решение:** ✅ Исправлено - добавлена проверка `typeof window !== 'undefined'`

### Проблема 2: Socket.IO не подключается
**Симптомы:**
- Нет сообщения "Connected to server with ID"
- Ошибка "Socket.IO connection error"

**Проверьте:**
1. Запущен ли сервер: `npm run dev`
2. Правильный ли порт: 8000
3. В консоли сервера должно быть: "User connected: [socket-id]"

### Проблема 3: Видео не показывается
**Симптомы:**
- Соединение установлено (connected)
- Треки получены (ontrack вызван)
- Но видео черное или пустое

**Проверьте:**
1. В консоли: "🎥 Received remote track" должно появиться 2 раза (video + audio)
2. Элемент video создан: "✅ Created video element for user"
3. Проверьте, что `autoplay` и `playsInline` установлены

### Проблема 4: Участники не видят друг друга
**Проверьте:**
1. Оба пользователя разрешили доступ к камере/микрофону
2. Оба видят "Участников: 2" (или больше)
3. В консоли обоих: "✅ Successfully connected to [socket-id]"
4. В консоли обоих: "🎥 Received remote track" (минимум 2 раза)

### Проблема 5: ICE connection failed
**Симптомы:**
```
🧊 ICE connection state with [socket-id]: failed
❌ Connection failed with [socket-id]
```

**Причины:**
- Проблемы с NAT/Firewall
- Не работают STUN серверы
- Нужен TURN сервер для relay

**Решение:**
- Для локальной сети это не должно быть проблемой
- Для интернета может потребоваться TURN сервер

## Полезные команды в консоли браузера

```javascript
// Проверить активные peer соединения
console.log(peersRef.current)

// Проверить локальный стрим
console.log(localStreamRef.current)

// Проверить Socket.IO соединение
console.log(socketRef.current.connected)

// Проверить количество треков
console.log(localStreamRef.current.getTracks())
```

## Как правильно тестировать

1. **Откройте два окна браузера** (или два устройства)
2. **В каждом откройте консоль (F12)** перед переходом на страницу
3. **Перейдите на** `http://192.168.50.57:8000/videocall`
4. **Разрешите доступ к камере/микрофону** в обоих окнах
5. **Следите за логами** в консоли обоих окон
6. **Сравните логи** - они должны быть симметричными

## Логи сервера

На сервере (в терминале где запущен `npm run dev`) вы должны видеть:

```
User connected: [socket-id-1]
Existing users: []

User connected: [socket-id-2]
Existing users: [[socket-id-1]]

Offer from [socket-id-2] to [socket-id-1]
Answer from [socket-id-1] to [socket-id-2]
ICE candidate from [socket-id-1] to [socket-id-2]
ICE candidate from [socket-id-2] to [socket-id-1]
```

## Контрольный чеклист

- [ ] Сервер запущен (`npm run dev`)
- [ ] Страница открывается без ошибок
- [ ] Разрешен доступ к камере/микрофону
- [ ] Видно свое видео
- [ ] Socket.IO подключен (есть socket ID в консоли)
- [ ] Второй пользователь подключился
- [ ] Счетчик участников обновился
- [ ] В консоли видны сообщения об обмене offer/answer
- [ ] В консоли видны ICE candidates
- [ ] Connection state = connected
- [ ] Получены remote tracks (video + audio)
- [ ] Видео элемент создан
- [ ] Видно видео собеседника
- [ ] Слышен звук собеседника
