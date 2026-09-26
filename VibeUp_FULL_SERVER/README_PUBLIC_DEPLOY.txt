VibeUp — публичный деплой

1. На VPS установи Docker Engine и Docker Compose.
2. Загрузи весь каталог проекта.
3. Скопируй .env.example в .env и заполни только серверные секреты.
4. Выполни: docker compose up -d --build
5. Настрой HTTPS reverse proxy на backend:3000. Recognition service наружу не публикуй.
6. Проверь: GET https://ТВОЙ-ДОМЕН/api/health
7. В www/config.js укажи тот же публичный HTTPS URL в SERVER_URL и затем собери APK.

Docker Compose автоматически запускает два контейнера: vibeup-api и recognizer. Backend обращается к recognizer по внутреннему адресу http://recognizer:8765/recognize.
