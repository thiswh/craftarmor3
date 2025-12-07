# CraftArmor Ecommerce Store

Магазин CraftArmor построен на платформе EverShop.

## Установка

1. Убедитесь, что у вас установлены:
   - Node.js 18+
   - PostgreSQL 16+
   - npm

2. Установите зависимости (уже установлены):
   ```bash
   npm install
   ```

3. Настройте базу данных PostgreSQL и запустите установку:
   ```bash
   npm run setup
   ```
   Во время установки вам будет предложено ввести:
   - Данные подключения к базе данных
   - Информацию о магазине
   - Создать администратора

4. Соберите проект:
   ```bash
   npm run build
   ```

5. Запустите в продакшн режиме:
   ```bash
   npm run start
   ```

6. Запустите в режиме разработки:
   ```bash
   npm run dev
   ```

## Доступ

- Сайт: http://localhost:3000
- Админ-панель: http://localhost:3000/admin

## Структура проекта

- `extensions/` - кастомные расширения
- `themes/` - кастомные темы
- `config/` - конфигурационные файлы (создается после setup)
- `public/` - публичные файлы (создается после build)
- `media/` - загруженные файлы

## Разработка

После установки вы можете:
- Создавать кастомные расширения в `extensions/`
- Создавать кастомные темы в `themes/`
- Настраивать магазин через админ-панель

## Демо-данные

⚠️ **Важно**: Команда `seed` работает только после выполнения `npm run setup` (создания конфигурации).

Для заполнения магазина демо-данными (только для разработки):

**Все демо-данные (рекомендуется):**
```bash
npm run seed -- --all
```

**Или выборочно:**
```bash
# Только атрибуты
npm run seed -- --attributes

# Только категории
npm run seed -- --categories

# Только коллекции
npm run seed -- --collections

# Только товары
npm run seed -- --products

# Только виджеты
npm run seed -- --widgets

# Только CMS страницы
npm run seed -- --pages

# Комбинация опций
npm run seed -- --categories --products --collections
```

## Создание пользователя

Создание нового администратора:
```bash
npm run user:create -- --email "email@example.com" --password "password" --name "Your Name"
```
