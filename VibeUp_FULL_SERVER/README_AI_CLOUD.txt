VibeUp AI + Yandex Cloud

1) Yandex token (PC/server only):
PowerShell:
$env:VIBEUP_YANDEX_TOKEN="YOUR_TOKEN"

2) AI key (PC/server only):
$env:VIBEUP_AI_KEY="YOUR_AI_KEY"
Optional:
$env:VIBEUP_AI_URL="https://api.openai.com/v1/chat/completions"
$env:VIBEUP_AI_MODEL="gpt-4o-mini"

Do NOT put either key into www/index.html or the APK.
The AI chat keeps recent conversation context on the device and sends the last messages to /api/ai. Artist/music questions trigger a small Wikipedia research step on the server before the AI answers.
