# CraftArmor Theme

Кастомная тема для EverShop магазина CraftArmor, основанная на стандартной теме "default".

## Подход

Эта тема **расширяет** стандартную тему EverShop, а не заменяет её полностью. 
Стандартная тема "default" используется как базовая, а мы переопределяем только нужные компоненты.

## Как это работает

1. **Базовая тема**: Стандартная тема "default" (встроена в EverShop)
2. **Наша тема**: `craftarmor` - переопределяет только нужные компоненты
3. **Приоритет**: Компоненты из `themes/craftarmor/` имеют приоритет над стандартными

## Структура

```
craftarmor/
├── src/
│   ├── components/    # Общие компоненты (переопределяют стандартные)
│   │   └── common/
│   └── pages/         # Компоненты для страниц (переопределяют стандартные)
│       └── all/       # Компоненты для всех страниц
│           └── All.tsx
├── public/            # Публичные ресурсы (логотипы, изображения)
└── package.json
```

## Переопределение компонентов

### Пример: Переопределение компонента для всех страниц

Создайте файл `src/pages/all/All.tsx` - он заменит стандартный компонент:

```tsx
import React from 'react';
import Area from '@evershop/evershop/src/components/common/Area';

export default function All() {
  return (
    <div className="craftarmor-theme">
      {/* Ваша кастомная разметка */}
      <Area id="body" />
    </div>
  );
}
```

### Пример: Переопределение компонента для конкретной страницы

Создайте файл `src/pages/homepage/HomepageBanner.tsx` - он добавится/заменит компонент на главной:

```tsx
import React from 'react';

export default function HomepageBanner() {
  return <div>Кастомный баннер для CraftArmor</div>;
}

export const layout = {
  areaId: 'homepageContent',
  sortOrder: 1
};
```

## Активация темы

Тема активирована в `config/default.json`: `"theme": "craftarmor"`

## Как работает переопределение

EverShop использует **каскадную систему**:
1. Сначала ищет компонент в теме `craftarmor` (themes/craftarmor/)
2. Если не найден - использует компонент из стандартной темы `default` (встроена в модули)

**Это означает**: Мы переопределяем только нужные компоненты, остальные автоматически берутся из стандартной темы!

### Пример

- Если в `themes/craftarmor/src/pages/all/All.tsx` есть компонент → используется он
- Если нет → используется стандартный из `default`
- Если в `themes/craftarmor/src/pages/homepage/` есть компонент → используется он
- Если нет → используется стандартный из `default`

**Итог**: Стандартная тема используется как базовая автоматически, мы только переопределяем нужное!

## Документация

- [Theme Overview](https://evershop.io/docs/development/theme/theme-overview)
- [View System](https://evershop.io/docs/development/theme/view-system)
- [Styling](https://evershop.io/docs/development/theme/styling)
- [Templating](https://evershop.io/docs/development/theme/templating)
