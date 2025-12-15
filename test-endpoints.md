# Тестирование API endpoints расширения craftarmor-shipping

## 1. GET /api/delivery/points

Получение пунктов выдачи по границам карты.

### Параметры запроса:
- `bounds` (обязательный) - границы карты в формате: `minLat,minLng,maxLat,maxLng`
- `services` (опциональный) - фильтр по службам доставки: `cdek,russianpost,boxberry`

### Примеры запросов:

#### Через браузер:
```
http://localhost:3000/api/delivery/points?bounds=55.5,37.5,56.0,38.0
```

#### Через curl (PowerShell):
```powershell
curl "http://localhost:3000/api/delivery/points?bounds=55.5,37.5,56.0,38.0"
```

#### С фильтром по службам:
```powershell
curl "http://localhost:3000/api/delivery/points?bounds=55.5,37.5,56.0,38.0&services=cdek,russianpost"
```

#### Форматированный вывод (PowerShell):
```powershell
curl "http://localhost:3000/api/delivery/points?bounds=55.5,37.5,56.0,38.0" | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

### Пример ответа:
```json
{
  "success": true,
  "data": {
    "points": [
      {
        "id": 1,
        "external_id": "cdek-123",
        "latitude": 55.7558,
        "longitude": 37.6173,
        "address": "ул. Тверская, 1",
        "city": "Москва",
        "region": "Московская область",
        "postal_code": "101000",
        "name": "ПВЗ CDEK на Тверской",
        "schedule": {...},
        "metadata": {...},
        "service_code": "cdek",
        "service_name": "CDEK"
      }
    ],
    "count": 1,
    "bounds": {
      "minLat": 55.5,
      "minLng": 37.5,
      "maxLat": 56.0,
      "maxLng": 38.0
    }
  }
}
```

---

## 2. POST /api/delivery/calculate

Расчет стоимости доставки до выбранного пункта выдачи.

### Тело запроса (JSON):
```json
{
  "pointId": 1,
  "serviceCode": "cdek",
  "weight": 2.5,
  "length": 30,
  "width": 20,
  "height": 15,
  "declaredValue": 5000
}
```

### Обязательные параметры:
- `pointId` - ID пункта выдачи из БД
- `serviceCode` - код службы доставки (`cdek`, `russianpost`, `boxberry`)
- `weight` - вес в кг

### Опциональные параметры:
- `length`, `width`, `height` - размеры в см
- `declaredValue` - объявленная стоимость в рублях

### Примеры запросов:

#### Через curl (PowerShell):
```powershell
curl -X POST "http://localhost:3000/api/delivery/calculate" `
  -H "Content-Type: application/json" `
  -d '{\"pointId\": 1, \"serviceCode\": \"cdek\", \"weight\": 2.5, \"length\": 30, \"width\": 20, \"height\": 15}'
```

#### С использованием файла (PowerShell):
Создайте файл `calculate.json`:
```json
{
  "pointId": 1,
  "serviceCode": "cdek",
  "weight": 2.5,
  "length": 30,
  "width": 20,
  "height": 15,
  "declaredValue": 5000
}
```

Затем выполните:
```powershell
curl -X POST "http://localhost:3000/api/delivery/calculate" `
  -H "Content-Type: application/json" `
  -d (Get-Content calculate.json -Raw)
```

#### Форматированный вывод:
```powershell
$body = @{
  pointId = 1
  serviceCode = "cdek"
  weight = 2.5
  length = 30
  width = 20
  height = 15
  declaredValue = 5000
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/delivery/calculate" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

$response | ConvertTo-Json -Depth 10
```

### Пример ответа:
```json
{
  "success": true,
  "data": {
    "point": {
      "id": 1,
      "address": "ул. Тверская, 1",
      "city": "Москва",
      "serviceCode": "cdek"
    },
    "calculation": {
      "cost": 350,
      "currency": "RUB",
      "deliveryTimeMin": 1,
      "deliveryTimeMax": 3,
      "deliveryTimeUnit": "days"
    }
  }
}
```

---

## Проверка ошибок

### Ошибка валидации (400):
```json
{
  "success": false,
  "message": "Bounds parameter is required. Format: minLat,minLng,maxLat,maxLng"
}
```

### Пункт не найден (404):
```json
{
  "success": false,
  "message": "Delivery point not found"
}
```

### Внутренняя ошибка (500):
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "..."
}
```

---

## Быстрая проверка через браузер

1. Откройте браузер
2. Перейдите по адресу:
   ```
   http://localhost:3000/api/delivery/points?bounds=55.5,37.5,56.0,38.0
   ```
3. Должен вернуться JSON с пунктами выдачи (или пустой массив, если БД пустая)

---

## Примечания

- Убедитесь, что сервер запущен: `npm run dev`
- Если БД пустая, endpoints вернут пустые массивы
- Для расчета стоимости нужно сначала получить `pointId` из первого endpoint
- Для работы расчета стоимости нужно настроить переменные окружения:
  - `SHOP_SENDER_POSTAL` - почтовый индекс отправителя
  - `SHOP_SENDER_CITY` - город отправителя

