# Ngrok Setup (Windows + YooKassa Webhook)

## 1. Проверка ngrok.exe

У тебя бинарник:

`C:\Users\ba4a\Documents\ngrok.exe`

Проверка:

```cmd
"C:\Users\ba4a\Documents\ngrok.exe" version
```

## 2. Сохранить authtoken (один раз)

```cmd
"C:\Users\ba4a\Documents\ngrok.exe" config add-authtoken YOUR_NGROK_TOKEN
```

Токен берется из:

`https://dashboard.ngrok.com/get-started/your-authtoken`

## 3. Запустить локальный проект

```cmd
cd /d C:\Users\ba4a\PycharmProjects\craftarmor_3_0
npm run dev
```

## 4. Запустить туннель (в отдельном окне cmd)

```cmd
"C:\Users\ba4a\Documents\ngrok.exe" http 3000
```

Или если ты в папке `C:\Users\ba4a\Documents`:

```cmd
ngrok.exe http 3000
```

## 5. URL для YooKassa webhook

Возьми HTTPS `Forwarding` URL из ngrok и добавь путь:

`https://<YOUR_NGROK_HOST>/api/yookassa/webhook`

Пример:

`https://acre-utopia-quartered.ngrok-free.dev/api/yookassa/webhook`

## 6. Что важно

- Окно `npm run dev` и окно `ngrok http 3000` должны быть открыты одновременно.
- После перезапуска ngrok адрес меняется (на free плане), webhook URL в YooKassa надо обновить.
- `return_url` для checkout в dev берется из `shop.homeUrl` (`http://localhost:3000`).

## 7. Опционально: чтобы не писать полный путь к ngrok

Добавь `C:\Users\ba4a\Documents` в `PATH` Windows.
После этого можно запускать просто:

```cmd
ngrok http 3000
```

