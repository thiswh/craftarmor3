# Инструкция по установке CraftArmor

## Шаг 1: Установка зависимостей

Выполните в терминале:

```bash
npm install @evershop/evershop
npm install --save-dev @types/node typescript @parcel/watcher @types/config @types/express @types/pg @types/react execa
```

## Шаг 2: Подготовка базы данных PostgreSQL

Убедитесь, что PostgreSQL установлен и запущен. Создайте пустую базу данных:

```sql
CREATE DATABASE craftarmor;
```

Или используйте существующую базу данных.

## Шаг 3: Запуск установки EverShop

Запустите интерактивную установку:

```bash
npm run setup
```

Во время установки вам будет предложено ввести:
- **Database Host** (обычно `localhost`)
- **Database Port** (обычно `5432`)
- **Database Name** (например, `craftarmor`)
- **Database User** (например, `postgres`)
- **Database Password** (ваш пароль PostgreSQL)
- **Shop Name** (например, `CraftArmor`)
- **Shop Email** (email магазина)
- **Admin Email** (email администратора)
- **Admin Password** (пароль администратора)
- **Admin Name** (имя администратора)

## Шаг 4: Установка прав на директории

Убедитесь, что следующие директории имеют права на запись (Windows обычно не требует этого):
- `public/`
- `.evershop`
- `.log`
- `media`

## Шаг 5: Сборка проекта

```bash
npm run build
```

## Шаг 6: Запуск в режиме разработки

Для разработки используйте:

```bash
npm run dev
```

Сайт будет доступен по адресу: http://localhost:3000
Админ-панель: http://localhost:3000/admin

## Шаг 7: (Опционально) Заполнение демо-данными

⚠️ **Важно**: Команда `seed` работает только после выполнения Шага 3 (`npm run setup`).

Для разработки можно заполнить магазин демо-данными:

**Все демо-данные (рекомендуется):**
```bash
npm run seed -- --all
```

**Или выборочно:**
```bash
npm run seed -- --categories --products --collections
```

Доступные опции:
- `--all` - все демо-данные
- `--attributes` или `-a` - атрибуты товаров
- `--categories` или `-c` - категории
- `--collections` или `--col` - коллекции
- `--products` или `-p` - товары
- `--widgets` или `-w` - виджеты
- `--pages` или `--pg` - CMS страницы

⚠️ **Внимание**: Используйте seed только в разработке, не в продакшене!

## Полезные команды

- `npm run start` - запуск в продакшн режиме
- `npm run start:debug` - запуск в режиме отладки
- `npm run user:create` - создание нового администратора
- `npm run user:changePassword` - смена пароля администратора

## Дальнейшая разработка

После установки вы можете:
1. Создавать кастомные расширения в `extensions/`
2. Создавать кастомные темы в `themes/`
3. Настраивать магазин через админ-панель

## Требования системы

- Node.js 18+
- PostgreSQL 16+
- npm
