VibeUp — полный серверный комплект

В этом архиве сервер распознавания больше не является временным локальным процессом. Весь стек включён в проект: Node/Express backend + отдельный ShazamIO recognition service. Docker Compose связывает их внутри одной сети.

1. Что находится внутри
- vibeup-api: основной Node.js API VibeUp;
- recognizer: FastAPI + ShazamIO;
- docker-compose.yml: запускает оба сервиса;
- recognition/Dockerfile: отдельный образ распознавания на Python 3.13;
- APK/web-клиент уже отправляет 10-секундный фрагмент на /api/recognize.

2. Публичный сервер
Разверни этот каталог на VPS/облачном сервере с Docker Engine + Docker Compose. Создай .env из .env.example и заполни серверные секреты. Затем: docker compose up -d --build

Основной backend слушает порт 3000. Для публичного доступа нужен HTTPS-домен/reverse proxy (например, Nginx/Caddy/Traefik) перед портом 3000. Порт 8765 наружу НЕ публикуется: recognizer доступен только backend-контейнеру.

3. Распознавание
Телефон -> VibeUp -> /api/recognize -> vibeup-api -> recognizer:8765 -> ShazamIO -> результат -> VibeUp. Пользователю не нужен установленный Shazam.

4. APK
Перед финальной сборкой открой www/config.js и укажи публичный HTTPS URL backend, например https://api.example.com. Секреты Yandex/OpenAI/admin никогда не помещай в APK.

5. Windows-тест
Для локального запуска полного стека нужен Docker Desktop. Запусти start-full-server.bat. Python на Windows устанавливать для сервера не требуется. Старый start_recognition.bat оставлен только для совместимости, но для полного стека его использовать не нужно.

6. Важно
Сам архив не создаёт публичный интернет-сервер автоматически: после распаковки стек нужно один раз развернуть на VPS/облачном хостинге и настроить HTTPS. Авторские права на музыку и условия использования сервиса распознавания необходимо проверить перед публичным релизом.
