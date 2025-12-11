# Test API Extension

Тестовое расширение для EverShop, которое возвращает JSON по маршруту `/api/test`.

## Структура расширения

```
test-api/
├── src/
│   ├── api/
│   │   └── test/
│   │       ├── route.json              # Определение маршрута
│   │       └── getTestMiddleware.ts     # Middleware для обработки GET запроса
│   └── bootstrap.ts                    # Файл инициализации расширения
├── dist/                                # Скомпилированный код
├── package.json                         # Метаданные расширения
├── tsconfig.json                        # Конфигурация TypeScript
└── README.md                            # Документация
```

## API Endpoint

### GET /api/test

Возвращает JSON с тестовыми данными.

**Пример ответа:**
```json
{
  "success": true,
  "message": "Test API endpoint is working!",
  "data": {
    "timestamp": "2025-12-11T12:00:00.000Z",
    "shop": {
      "name": "CraftArmor",
      "language": "ru",
      "currency": "RUB"
    },
    "extension": {
      "name": "test-api",
      "version": "1.0.0",
      "description": "Test extension for EverShop"
    }
  }
}
```

## Активация

Расширение активировано в `config/default.json`:

```json
{
  "system": {
    "extensions": [
      {
        "name": "test-api",
        "resolve": "extensions/test-api",
        "enabled": true,
        "priority": 10
      }
    ]
  }
}
```

## Разработка

### Установка зависимостей

Из корня проекта:
```bash
npm install
```

Или из папки расширения:
```bash
cd extensions/test-api
npm install
```

### Компиляция

В режиме разработки (`npm run dev`) компиляция происходит автоматически.

Для production:
```bash
cd extensions/test-api
npm run compile
```

### Тестирование

После запуска сервера (`npm run dev` или `npm run start`), откройте в браузере:

```
http://localhost:3000/api/test
```

Должен вернуться JSON ответ.

## Документация

- [Extension Overview](https://evershop.io/docs/development/module/extension-overview)
- [Extension Development](https://evershop.io/docs/development/module/extension-development)
- [Create Your First Extension](https://evershop.io/docs/development/module/create-your-first-extension)

