# umOS (Obsidian Plugin)

Комплексная система управления жизнью для Obsidian: домашний дашборд, ежедневные заметки, привычки, расписание, задачи, намаз, коран, финансы и многое другое.

## Возможности
- Домашний экран `Home` с настраиваемыми секциями и карточками навигации.
- Ежедневные заметки с шаблоном и включаемыми блоками.
- Намаз: расчёт времени, виджеты, статус‑бар.
- Коран: аят дня, трекер джузов.
- Рамадан: трекер поста и таравих.
- Привычки: дневной трекер + календарь привычек.
- Расписание: текущая/недельная сетка занятий с подсветкой и таймерами.
- Задачи: список, статистика, канбан, дедлайны.
- Помодоро‑таймер.
- Экзамены: список с приоритетами и темами.
- Финансы: транзакции, категории, месячный бюджет.
- Цели: виджет целей и быстрый добавлятор.
- Галерея контента (аниме, книги, фильмы и т.д.) и проектов.
- Погода на главном экране.
- Быстрый ввод задач/заметок и URI‑захват.

## Быстрый старт
1. Установите плагин в `vault/.obsidian/plugins/umos-plugin`.
2. Включите `umOS` в Obsidian.
3. В настройках плагина нажмите `Создать структуру`, чтобы создать базовые папки и дашборды.  
   Важно: все существующие файлы/папки будут перемещены в `temp/`.

## Команды и кнопки
Команды (Command Palette):
- `umOS: Открыть Home`
- `umOS: Быстрая задача`
- `umOS: Быстрая заметка`
- `umOS: Добавить цель`
- `umOS: Создать дневную заметку`
- `umOS: Редактор расписания`
- `umOS: Следующий намаз`
- `umOS: Помодоро: Старт/Пауза`
- `umOS: Отметить привычку`

Кнопки на ленте:
- `Home` (открыть главный экран)
- `Calendar` (создать дневную заметку)
- `Plus` (быстрая задача)

## Виджеты (Markdown code blocks)
Ниже список доступных блоков и ключевых параметров. Все параметры задаются в теле блока.

- `prayer-widget`  
  Параметры: `show: times|next|both`, `style: full|compact`, `show_sunrise: true|false`
- `ayat-daily`  
  Параметры: `count: number`, `language: ru.kuliev`, `show_arabic: true|false`
- `quran-tracker`  
  Параметры: `style: grid|progress|both`
- `ramadan-widget`  
  Параметры: `style: full|compact`
- `umos-stats`  
  Параметры: `metrics: ["mood","sleep",...]`, `period: number`, `chart: sparkline|bar|ring|none`, `compare: true|false`
- `schedule`  
  Параметры: `show: current|week|both`, `highlight: true|false`, `countdown: true|false`
- `content-gallery`  
  Параметры: `style: grid|list`
- `project-gallery`  
  Параметры: `style: grid|list`
- `habits`  
  Параметры: `date: today|YYYY-MM-DD`, `style: grid|list`
- `habit-calendar`  
  Параметры: `habit: exercise`, `months: number`
- `tasks-stats-widget`  
  Параметры: нет
- `tasks-widget`  
  Параметры: нет
- `tasks-kanban`  
  Параметры: нет
- `umos-goals`  
  Параметры: нет
- `daily-nav`  
  Параметры: нет
- `pomodoro`  
  Параметры: `style: full|compact`
- `exam-tracker`  
  Параметры: `show: upcoming|all`, `style: full|compact`
- `finance-tracker`  
  Параметры: `month: YYYY-MM`, `style: full|compact`
- `balance-tracker`  
  Параметры: нет

Пример:
````md
```prayer-widget
show: both
style: full
```
````

## Быстрый ввод и URI‑захват
Плагин поддерживает схему:
```text
obsidian://umos/capture?type=task&text=Купить%20молоко&priority=high
```
Параметры:
- `type`: `task` или `note`
- `text`: текст задачи/заметки
- `priority`: `high|medium|low|none` (для задач)

Если `text` не передан, откроется модалка быстрого ввода.

## Настройки
Все настройки доступны в UI и сохраняются через `saveData` плагина. Основные секции:
- Структура хранилища (скелет папок и дашбордов)
- Дневная заметка (путь, формат, секции)
- Привычки
- Быстрый ввод
- Геолокация (используется для намаза и погоды)
- Намаз
- Коран
- Рамадан
- Помодоро
- Экзамены
- Расписание
- Контент
- Главная
- Статистика
- Финансы

## Источники данных (API)
- Намаз: Aladhan API.
- Коран: Al Quran Cloud API.
- Геолокация: ip-api.com.
- Погода: Open‑Meteo.

## Разработка
```bash
npm install
npm run dev        # watch-сборка
npm run build      # production-сборка
npm run typecheck  # проверка типов
```

Сборка выполняется через `esbuild` (см. `esbuild.config.mjs`). Выходной файл: `main.js`.
