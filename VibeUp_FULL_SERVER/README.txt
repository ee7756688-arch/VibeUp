VibeUp — cloud-ready build

Что изменено:
- офлайн-загрузка встроенного Fired up больше не требует server.js: приложение умеет копировать локальный MP3 из своих ресурсов во внутреннее хранилище;
- офлайн-загрузка HTTP/HTTPS-треков идёт напрямую по URL;
- убран экран с OAuth-токеном Яндекс Диска из обычного приложения;
- добавлен плавающий VibeUp AI-чат справа снизу; в этой версии он даёт рекомендации из каталога и ищет справки об исполнителях через Wikipedia API; это лёгкий первый AI-слой, не полноценная LLM;
- админка может загружать аудио и обложку в Яндекс Диск, публиковать их и обновлять облачный catalog.json;
- OAuth-токен хранится только в переменной окружения сервера, не в APK.

Настройка облака на ПК:
PowerShell:
$env:VIBEUP_YANDEX_TOKEN="ТВОЙ_ТОКЕН"
node server.js

Токен не отправляй в чат и не вставляй в APK. После первой публикации админка покажет публичный URL каталога. Его можно один раз указать в VibeUp → Настройки → Адрес облачного каталога.

Важно: для полноценного публичного релиза нужно заменить локальный server.js на постоянно работающий защищённый cloud backend и проверить права на музыкальный контент и условия выбранного облачного провайдера.


VibeUp upgraded test setup:
- Yandex token: set environment variable VIBEUP_YANDEX_TOKEN before starting server.js. Never put it in the APK.
- Optional AI: set VIBEUP_AI_KEY, and optionally VIBEUP_AI_URL and VIBEUP_AI_MODEL. Default is OpenAI-compatible /v1/chat/completions with model gpt-4o-mini.
- Offline downloads are stored in Capacitor internal DATA storage. A downloaded track is no longer removed by tapping the download button; removal is a separate button in the Offline page.
- The bundled Hush Fired up track can be downloaded without server.js because it is packaged with the app.
