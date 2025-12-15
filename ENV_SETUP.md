# Настройка переменных окружения для craftarmor-shipping

## Структура .env файла

Создайте файл `.env` в корне проекта со следующим содержимым:

```env
# ============================================
# CDEK API Configuration
# ============================================
CDEK_API_URL=https://api.cdek.ru
CDEK_CLIENT_ID=OoggAQyuWQipMhhSLPx1cvv5jMbKBcuA
CDEK_CLIENT_SECRET=eIKzK3acHXK1vEBP1gZypYJNotwVbUiF

# ============================================
# Russian Post API Configuration
# ============================================
# URL для получения списка ПВЗ и других операций
RUSPOST_API_URL=https://otpravka-api.pochta.ru
# URL для калькулятора (расчет стоимости доставки)
RUSPOST_TARIFF_URL=https://tariff.pochta.ru
# Token и Key для базовой авторизации
RUSPOST_TOKEN=jz2xOI9B5LZXt7B1otImyg7mqQoYe0B5
RUSPOST_KEY=bGVuYXR1bGlub3ZhLmFvbEBnbWFpbC5jb206MTQxODE2Mjhwb2NodGE=

# ============================================
# Boxberry API Configuration
# ============================================
# URL API Boxberry (по умолчанию: https://api.boxberry.ru/json.php)
BOXBERRY_API_URL=https://api.boxberry.ru/json.php
# Получить можно в личном кабинете Boxberry
BOXBERRY_API_KEY=your_boxberry_api_key

# ============================================
# Shop Configuration (для расчета доставки)
# ============================================
# Почтовый индекс и город отправителя (магазина)
SHOP_SENDER_POSTAL=394051
SHOP_SENDER_CITY=Воронеж
```

## Важные замечания

### 1. CDEK
- ✅ `CDEK_API_URL` - URL API CDEK (по умолчанию: `https://api.cdek.ru`)
- ✅ `CDEK_CLIENT_ID` - используется
- ✅ `CDEK_CLIENT_SECRET` - используется

### 2. Russian Post
- ✅ `RUSPOST_API_URL` - URL для получения списка ПВЗ и других операций (по умолчанию: `https://otpravka-api.pochta.ru`)
- ✅ `RUSPOST_TARIFF_URL` - URL для калькулятора стоимости доставки (по умолчанию: `https://tariff.pochta.ru`)
- ✅ `RUSPOST_TOKEN` - используется
- ✅ `RUSPOST_KEY` - используется (без кавычек!)

**Важно для RUSPOST_KEY:**
- Уберите кавычки из значения!
- Должно быть: `RUSPOST_KEY=bGVuYXR1bGlub3ZhLmFvbEBnbWFpbC5jb206MTQxODE2Mjhwb2NodGE=`
- НЕ должно быть: `RUSPOST_KEY="bGVuYXR1bGlub3ZhLmFvbEBnbWFpbC5jb206MTQxODE2Mjhwb2NodGE="`

### 3. Boxberry
- ✅ `BOXBERRY_API_URL` - URL API Boxberry (по умолчанию: `https://api.boxberry.ru/json.php`)
- ✅ `BOXBERRY_API_KEY` - используется (если не указан, сервис будет возвращать пустой массив)

### 4. Магазин
- ✅ `SHOP_SENDER_POSTAL` - используется для расчета доставки
- ✅ `SHOP_SENDER_CITY` - используется для расчета доставки

## Проверка переменных

После создания `.env` файла, перезапустите сервер:

```bash
npm run dev
```

Проверьте логи при запуске - не должно быть ошибок о недостающих переменных окружения.

## Безопасность

⚠️ **ВАЖНО:** Файл `.env` уже добавлен в `.gitignore` и не будет закоммичен в Git.

Не коммитьте реальные ключи API в репозиторий!

