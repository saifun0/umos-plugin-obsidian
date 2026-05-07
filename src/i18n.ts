export type UmOSLanguage = "en" | "ru";

type TranslationMap = Record<string, string>;

const EN_RU: TranslationMap = {
  " · ↑ repeats the latest command from an empty input": " · ↑ повторяет последнюю команду из пустого поля",
  " Add": " Добавить",
  " Add Column": " Добавить колонку",
  " Labels": " Метки",
  " Required parameter.": " Обязательный параметр.",
  "- Row 1": "- Строка 1",
  "- Row 2": "- Строка 2",
  "— Choose —": "— Выбрать —",
  "# Content": "# Контент",
  "# Left Column": "# Левая колонка",
  "# Prayer": "# Намаз",
  "# Projects": "# Проекты",
  "# Right Column": "# Правая колонка",
  "# Schedule": "# Расписание",
  "# Stats": "# Статистика",
  "# Tasks": "# Задачи",
  "# umOS — Demo": "# umOS — Демо",
  "## ✅ Tasks": "## ✅ Задачи",
  "## 🎬 Content and Projects": "## 🎬 Контент и проекты",
  "## 📅 Schedule": "## 📅 Расписание",
  "## 📆 Daily": "## 📆 Ежедневное",
  "## 📊 Stats": "## 📊 Статистика",
  "## 🕌 Prayer": "## 🕌 Намаз",
  "## Daily Rating": "## Оценка дня",
  "## Habits": "## Привычки",
  "## Information": "## Информация",
  "## Notes": "## Заметки",
  "## Notes\n\n\n\n": "## Заметки\n\n\n\n",
  "## Prayers": "## Намазы",
  "## Project Tasks": "## Задачи проекта",
  "## Related": "## Связанное",
  "## Review": "## Рецензия",
  "## Schedule\n\n> Day off\n\n": "## Расписание\n\n> Выходной\n\n",
  "## Schedule\n\n> No classes\n\n": "## Расписание\n\n> Нет пар\n\n",
  "## Tasks\n\n": "## Задачи\n\n",
  "## Tasks\n\n\n\n": "## Задачи\n\n\n\n",
  "```cols-umos\n## Column 1\nText.\n\n===\n\n## Column 2\nText.\n\n===\n\n## Column 3\nText.\n```": "```cols-umos\n## Колонка 1\nТекст.\n\n===\n\n## Колонка 2\nТекст.\n\n===\n\n## Колонка 3\nТекст.\n```",
  "```cols-umos\n## Left Column\nText in the first column.\n\n===\n\n## Right Column\nText in the second column.\n```": "```cols-umos\n## Левая колонка\nТекст первой колонки.\n\n===\n\n## Правая колонка\nТекст второй колонки.\n```",
  "```cols-umos\ncols: 2\n\n## Column 1\nText.\n\n===\n\n## Column 2\nText.\n```": "```cols-umos\ncols: 2\n\n## Колонка 1\nТекст.\n\n===\n\n## Колонка 2\nТекст.\n```",
  "```info-umos\ntitle: Name / Title\nimage: 00 Files/photo.png\ncaption: Photo caption\n---\nInformation\nField 1     | Value 1\nField 2     | Value 2\n\nActivity\nRole       | Description\n```": "```info-umos\ntitle: Имя / Название\nimage: 00 Files/photo.png\ncaption: Подпись к фото\n---\nИнформация\nПоле 1     | Значение 1\nПоле 2     | Значение 2\n\nДеятельность\nРоль       | Описание\n```",
  "← Back": "← Назад",
  "← Yesterday": "← Вчера",
  "→ Done": "→ Выполнено",
  "→ In Progress": "→ В процессе",
  "→ To Do": "→ К выполнению",
  "+ Add": "+ Добавить",
  "+ Add Card": "+ Добавить карточку",
  "+ Add Content Type": "+ Добавить тип контента",
  "+ Add Habit": "+ Добавить привычку",
  "+ Add Label": "+ Добавить метку",
  "+ Add Subtask": "+ Добавить подзадачу",
  "<mark class=\"umos-mark-blue\">text</mark>": "<mark class=\"umos-mark-blue\">текст</mark>",
  "<mark class=\"umos-mark-green\">text</mark>": "<mark class=\"umos-mark-green\">текст</mark>",
  "<mark class=\"umos-mark-purple\">text</mark>": "<mark class=\"umos-mark-purple\">текст</mark>",
  "<mark class=\"umos-mark-red\">text</mark>": "<mark class=\"umos-mark-red\">текст</mark>",
  "<mark class=\"umos-mark-yellow\">text</mark>": "<mark class=\"umos-mark-yellow\">текст</mark>",
  "<span class=\"umos-pill\">tag</span>": "<span class=\"umos-pill\">тег</span>",
  "<span>No tasks found</span>": "<span>Задачи не найдены</span>",
  "<svg...> or 00 Files/divider.svg": "<svg...> или 00 Files/divider.svg",
  "> [!arabic-umos] Ayah\n> ": "> [!arabic-umos] Аят\n> ",
  "> [!reflect-umos] Thought\n> ": "> [!reflect-umos] Мысль\n> ",
  "> [!stat-umos] Title\n> **42** tasks\n> **7** habits\n> **3** projects\n": "> [!stat-umos] Заголовок\n> **42** задачи\n> **7** привычек\n> **3** проекта\n",
  "> Empty column": "> Пустая колонка",
  "> This note was created automatically and shows only the current widgets after plugin cleanup.": "> Заметка создана автоматически и показывает только актуальные виджеты после чистки плагина.",
  "▶ In Progress": "▶ В процессе",
  "⚠️ Deadlines": "⚠️ Дедлайны",
  "⚠️ Overdue": "⚠️ Просрочено",
  "⚠️ This location is already saved": "⚠️ Эта локация уже сохранена",
  "⚡ Due today": "⚡ Срок сегодня",
  "⚡ Productivity": "⚡ Продуктивность",
  "✅ Image saved": "✅ Картинка сохранена",
  "✅ Profile saved": "✅ Профиль сохранён",
  "✅ Settings reset": "✅ Настройки сброшены",
  "✅ Tasks": "✅ Задачи",
  "✅ Vault Structure created": "✅ Структура хранилища создана",
  "✏️ Practice": "✏️ Практика",
  "✓ Done": "✓ Готово",
  "✕ Reset filters": "✕ Сбросить фильтры",
  "❌ Failed to create debug note": "❌ Ошибка при создании debug-note",
  "❌ Failed to create demo note": "❌ Ошибка при создании демо-заметки",
  "❌ Failed to create structure": "❌ Ошибка при создании структуры",
  "⭐ By rating": "⭐ По оценке",
  "🌤 Weather": "🌤 Погода",
  "🎬 Content": "🎬 Контент",
  "🎬 Current Content": "🎬 Текущий контент",
  "👋 Greeting": "👋 Приветствие",
  "💬 Seminar": "💬 Семинар",
  "💾 Save": "💾 Сохранить",
  "📃 Stats vault": "📃 Статистика vault",
  "📅 By deadline": "📅 По дедлайну",
  "📅 Schedule": "📅 Расписание",
  "📅 Schedule Editor": "📅 Редактор расписания",
  "📅 Upcoming": "📅 Предстоящие",
  "📆 Week Overview": "📆 Обзор недели",
  "📊 By progress": "📊 По прогрессу",
  "📊 Daily Metrics": "📊 Показатели дня",
  "📊 Stats": "📊 Статистика",
  "📖 Lecture": "📖 Лекция",
  "📝 Exam": "📝 Экзамен",
  "📝 Words of the Day": "📝 Слова дня",
  "🔤 By name": "🔤 По имени",
  "🔥 Overdue": "🔥 Просрочено",
  "🔥 Urgent Deadlines": "🔥 Горящие дедлайны",
  "🔬 Lab": "🔬 Лабораторная",
  "🔴 High": "🔴 Высокий",
  "🕌 All prayers completed": "🕌 Все намазы завершены",
  "🕌 Loading prayer times...": "🕌 Загрузка времён намаза...",
  "🕌 Loading...": "🕌 Загрузка...",
  "🕌 Prayer": "🕌 Намаз",
  "🕌 Prayer Times": "🕌 Времена намаза",
  "🕌 Prayers": "🕌 Намазы",
  "🕌 Prayers: last 14 days of range": "🕌 Намазы: последние 14 дней диапазона",
  "🕐 By date": "🕐 По дате",
  "🕐 Clock": "🕐 Часы",
  "🕐 Recently updated": "🕐 Обновлённые",
  "🗑️ Clear": "🗑️ Очистить",
  "🧭 Navigation": "🧭 Навигация",
  "😊 Mood": "😊 Настроение",
  "😴 Sleep": "😴 Сон",
  "🚀 Active Projects": "🚀 Активные проекты",
  "🚀 Projects": "🚀 Проекты",
  "🟡 Medium": "🟡 Средний",
  "🟢 Low": "🟢 Низкий",
  "14 days": "14 дней",
  "2026-06-01 or 2026-06-01 09:00": "2026-06-01 или 2026-06-01 09:00",
  "30 days": "30 дней",
  "7 days": "7 дней",
  "Accent block, purple": "Акцентный блок, фиолетовый",
  "Accent callout with the |center parameter": "Акцентный callout с параметром |center",
  "Accent color, for example #0ea5e9.": "Акцентный цвет, например #0ea5e9.",
  "Accent color, for example #27ae60.": "Акцентный цвет, например #27ae60.",
  "Accent inline tag": "Акцентный инлайн-тег",
  "accent must be a hex color, for example accent:#27ae60.": "accent должен быть hex-цветом, например accent:#27ae60.",
  "Actions": "Действия",
  "active": "в работе",
  "Active": "В работе",
  "active days": "активн. дней",
  "Active tasks": "Активные задачи",
  "Add and choose": "Добавить и выбрать",
  "Add Card": "Добавить карточку",
  "Add Content": "Добавить контент",
  "Add cssclass umos-divider-dots to frontmatter": "Добавить cssclass umos-divider-dots в frontmatter",
  "Add cssclass umos-divider-gradient to frontmatter": "Добавить cssclass umos-divider-gradient в frontmatter",
  "Add cssclass umos-divider-ornament to frontmatter": "Добавить cssclass umos-divider-ornament в frontmatter",
  "Add custom frontmatter keys separated by commas.": "Добавьте произвольные ключи frontmatter через запятую.",
  "Add tag…": "Добавить тег…",
  "Add task": "Добавить задачу",
  "Add tasks for the selected day under the schedule.": "Добавить под расписанием задачи выбранного дня.",
  "Adds a cssclass to the generated dashboard note.": "Добавляет cssclass в generated dashboard note.",
  "Adds a soft accent-colored glow.": "Добавляет мягкую подсветку в цвет акцента.",
  "Advance to Next School Day": "Переход на следующий учебный день",
  "Alias for countdown.": "Alias для countdown.",
  "Alias for date.": "Alias для date.",
  "Alias for legend.": "Alias для legend.",
  "Alias for target.": "Alias для target.",
  "Alias for target. Often used as create_in: current.": "Alias для target. Часто используется create_in: current.",
  "All": "Все",
  "All classes for today are done ✅": "Все пары на сегодня завершены ✅",
  "All enabled blocks pass schema validation.": "Все enabled blocks проходят schema validation.",
  "All prayers are completed for today": "Все намазы на сегодня совершены",
  "All prayers completed": "Все намазы совершены",
  "All priorities": "Все приоритеты",
  "All statuses": "Все статусы",
  "All types": "Все типы",
  "Allow progress input editing.": "Разрешить редактирование progress input.",
  "Animation": "Анимация",
  "Anime": "Аниме",
  "Apply": "Применить",
  "Apr": "апр",
  "April": "апреля",
  "Arabic — Arabic Text": "Arabic — Арабский текст",
  "Asr": "Аср",
  "Aug": "авг",
  "August": "августа",
  "Avatar": "Аватарка",
  "average": "среднее",
  "Back": "Назад",
  "Board ID in umOS storage. Different IDs create different boards.": "ID доски в хранилище umOS. Разные id создают разные доски.",
  "Board title": "Название доски",
  "Board with columns and cards": "Доска с колонками и карточками",
  "Book": "Книга",
  "Break": "Перерыв",
  "Build a dashboard from widgets, preview it, and write the result to a markdown note.": "Собрать dashboard из виджетов, preview и записать результат в markdown-заметку.",
  "By status": "По статусу",
  "By tags": "По тегам",
  "By type": "По типу",
  "Cache Date": "Дата кеша",
  "Calculation": "Расчёт",
  "Calculation Method": "Метод расчёта",
  "Calculation method, status bar, and linked note for the prayer dashboard.": "Метод расчёта, status bar и связанная заметка для prayer dashboard.",
  "Callouts": "Каллауты",
  "Cancel": "Отмена",
  "cancelled": "отменено",
  "Cancelled": "Отменён",
  "Card": "Карточка",
  "Card to the right of text: title, photo, table": "Карточка справа от текста: заголовок, фото, таблица",
  "Card with an image.": "Карточка с изображением.",
  "Cards in a grid.": "Карточки сеткой.",
  "Change": "Изменить",
  "Chart type for metrics.": "Тип графика для метрик.",
  "checked": "отмечен",
  "Choose": "Выбрать",
  "Choose a saved image/GIF or quickly add a URL/path.": "Выбери сохранённую картинку/GIF или быстро добавь URL/путь.",
  "Choose a widget to see snippets.": "Выбери widget, чтобы увидеть snippets.",
  "Choose from vault": "Выбрать из хранилища",
  "Choose Image": "Выбрать изображение",
  "Choose metrics for the Daily Metrics block on Home. Up to 4 can be active at once.": "Выберите метрики для блока «Показатели дня» на главной. Одновременно можно держать до 4.",
  "City": "Город",
  "City not set": "Город не указан",
  "Class Duration": "Длительность пары",
  "Class schedule with optional day tasks.": "Расписание занятий с опциональными задачами дня.",
  "Class type": "Тип занятия",
  "Classes per day": "Пар в день",
  "Clear": "Очистить",
  "Clipboard is unavailable": "Clipboard недоступен",
  "Closed notes will appear here": "Закрытые заметки появятся здесь",
  "Cloudy": "Облачно",
  "Collapse": "Свернуть",
  "Color": "Цвет",
  "Colors for select/chips.": "Цвета для select/chips.",
  "cols: 2\nLeft Column\n===\nRight Column": "cols: 2\nЛевая колонка\n===\nПравая колонка",
  "cols: N on the first line forces the count": "cols: N в первой строке принудительно задаёт количество",
  "Column count for grouped inputs.": "Количество колонок для grouped inputs.",
  "Column count, when it needs to be set explicitly.": "Количество колонок, если нужно задать явно.",
  "Columns — 2 Equal": "Колонки — 2 равные",
  "Columns — 3 Equal": "Колонки — 3 равные",
  "Columns — set count": "Колонки — задать число",
  "Columns — Two Columns": "Columns — Две колонки",
  "Comma-separated statuses: todo, doing, done, cancelled.": "Статусы через запятую: todo, doing, done, cancelled.",
  "Compact block for columns.": "Компактный блок для колонок.",
  "Compact list.": "Компактный список.",
  "Compact weekly history.": "Компактная недельная история.",
  "Complete": "Завершить",
  "Completion Date": "Дата завершения",
  "Content": "Контент",
  "Content Folder": "Папка контента",
  "Content Gallery": "Галерея контента",
  "Content gallery.": "Галерея контента.",
  "Content Type": "Тип контента",
  "Content Types": "Типы контента",
  "Content types and the rest of the gallery structure.": "Типы контента и остальная структура галерей.",
  "Content types for the media library. Each type has its own subfolder and progress rules.": "Типы контента для медиатеки. Каждый тип связан со своей подпапкой и правилами прогресса.",
  "Control size: sm or lg.": "Размер controls: sm или lg.",
  "Could not create daily note.": "Не удалось создать daily note.",
  "Could not determine the file for creating a task": "Не удалось определить файл для создания задачи",
  "Could not determine the task file.": "Не удалось определить файл для задачи.",
  "Could not find or create the daily note": "Не удалось найти или создать дневную заметку",
  "Could not mark prayer": "Не удалось отметить намаз",
  "Could not open Home": "Не удалось открыть Home",
  "Could not save settings": "Не удалось сохранить настройки",
  "Could not update prayers": "Не удалось обновить намазы",
  "Could not update weather": "Не удалось обновить погоду",
  "Count only tasks with this tag.": "Считать только задачи с этим тегом.",
  "Count only the specified statuses.": "Считать только указанные статусы.",
  "Countdown": "Обратный отсчет",
  "countdown Exam session 2026-07-01 accent:#27ae60 view:focus": "countdown Сессия 2026-07-01 accent:#27ae60 view:focus",
  "Countdown needs a date: YYYY-MM-DD or YYYY-MM-DD HH:MM.": "Нужна дата countdown: YYYY-MM-DD или YYYY-MM-DD HH:MM.",
  "Countdown needs a title.": "Нужен заголовок countdown.",
  "countdown target: current or daily.": "target для countdown: current или daily.",
  "Countdown time goes after the date: countdown Exam 2026-07-01 09:00.": "Время countdown укажи после даты: countdown Сессия 2026-07-01 09:00.",
  "Countdown title.": "Заголовок countdown.",
  "countdown view: full, focus, or minimal.": "view для countdown: full, focus или minimal.",
  "Create": "Создать",
  "Create a note with current plugin widgets and configuration examples.": "Создать заметку с актуальными виджетами плагина и примерами конфигурации.",
  "Create a profile from a preset or empty dashboard.": "Создай профиль из preset или пустой dashboard.",
  "Create debug-note": "Создать debug-note",
  "Create Demo Note": "Создать демо-заметку",
  "Create Directories": "Создать директории",
  "Create Note Automatically": "Создавать заметку автоматически",
  "Create project": "Создать проект",
  "Create Structure": "Создать структуру",
  "Created": "Создание",
  "Created...": "Создание...",
  "Critical / important": "Критично / важно",
  "Current day with countdown.": "Текущий день с countdown.",
  "Current Location": "Текущая локация",
  "Current Value Field": "Поле текущего значения",
  "Currently selected": "Сейчас выбрано",
  "Custom": "Произвольный",
  "Custom Metrics": "Свои метрики",
  "d": "д",
  "Daily Focus": "Фокус дня",
  "Daily forecast": "Прогноз по дням",
  "Daily forecast will update after weather loads": "Прогноз по дням обновится после загрузки погоды",
  "Daily frontmatter stats with charts.": "Статистика daily frontmatter с графиками.",
  "Daily Note": "Дневная заметка",
  "Daily note navigation.": "Навигация по daily notes.",
  "Daily note template: where it is stored, how it is named, and which blocks it includes.": "Шаблон ежедневной заметки: где хранится, как называется и какие блоки включает.",
  "Daily or weekly reflection in frontmatter.": "Ежедневная или недельная рефлексия в frontmatter.",
  "Daily rating in frontmatter.": "Оценка дня в frontmatter.",
  "Daily Ratings": "Оценки дня",
  "Daily review.": "Ежедневный review.",
  "Daily screen: navigation, prayers, schedule, tasks, and review.": "Ежедневный экран: навигация, намазы, расписание, задачи и review.",
  "Daily/weekly review and word-of-the-day history.": "Daily/weekly review и история слов дня.",
  "DailyNoteEnhancer is not initialized": "DailyNoteEnhancer не инициализирован",
  "Dashboard profiles JSON must be an object.": "Dashboard profiles JSON должен быть объектом.",
  "Dashboard profiles JSON must contain profiles: [].": "Dashboard profiles JSON должен содержать profiles: [].",
  "Dashboard profiles, presets, preview, note generation, and JSON transfer.": "Профили dashboard, presets, предпросмотр, генерация заметок и перенос JSON.",
  "Data Sync": "Синхронизация данных",
  "Date": "Дата",
  "Day": "День",
  "Day / night": "День / ночь",
  "days": "дней",
  "Deadline (optional)": "Дедлайн (необязательно)",
  "Dec": "дек",
  "December": "декабря",
  "Decrease": "Уменьшить",
  "Default": "Обычная",
  "Default free-form kanban board.": "Свободная kanban-доска default.",
  "Delete": "Удалить",
  "Delete Column": "Удалить колонку",
  "Delete Label": "Удалить метку",
  "Delete project": "Удалить проект",
  "Delete task?": "Удалить задачу?",
  "Demo Note": "Тестовая заметка",
  "Description": "Описание",
  "Description (optional)": "Описание (необязательно)",
  "Detect": "Определить",
  "Detect Automatically": "Определить автоматически",
  "Detection by IP address. If you use a VPN, it is better to save coordinates manually.": "Определение по IP-адресу. Если используете VPN, координаты лучше сохранить вручную.",
  "Dhuhr": "Зухр",
  "Display": "Отображение",
  "Dividers": "Разделители",
  "done": "завершено",
  "Done": "Завершено",
  "DONE": "ВЫПОЛНЕНО",
  "Done / ok": "Готово / ок",
  "Dots  · · · · ·": "Точки  · · · · ·",
  "Drizzle": "Морось",
  "Dropped": "Брошено",
  "Due": "Срок",
  "Due filter: today, overdue, or YYYY-MM-DD date.": "Фильтр срока: today, overdue или дата YYYY-MM-DD.",
  "Due filter: today, overdue, or YYYY-MM-DD.": "Фильтр срока: today, overdue или YYYY-MM-DD.",
  "Duplicate id inside imported JSON. Using the first occurrence.": "Duplicate id внутри импортируемого JSON. Используется первое вхождение.",
  "Duplicates plugin data into a file inside the vault so it is easier to move between devices.": "Дублирует данные плагина в файл внутри vault, чтобы их было проще переносить между устройствами.",
  "Edit": "Редактировать",
  "Edit Card": "Редактировать карточку",
  "Edit Column": "Редактировать колонку",
  "Edit Label": "Редактировать метку",
  "Edit Task": "Редактировать задачу",
  "Editable word of the day.": "Редактируемое слово дня.",
  "Embeds a GIF above the file tree in the file explorer.": "Встраивает GIF над деревом файлов в file explorer.",
  "Emoji and short symbols are supported.": "Поддерживаются emoji и короткие символы.",
  "Empty": "Пусто",
  "Empty icon for rating input.": "Пустая иконка rating input.",
  "Enable multiline text input.": "Включить многострочный text input.",
  "End of the range for statistic/date filters.": "Конец диапазона для статистического/датированного фильтра.",
  "End time": "Время окончания",
  "End time must be after start time.": "Время окончания должно быть позже начала.",
  "English": "Английский",
  "Enter a task description...": "Введите описание задачи...",
  "Enter a title": "Введите название",
  "Enter a title projects": "Введите название проекта",
  "Enter a title...": "Введите название...",
  "Enter a URL or file path": "Введите URL или путь к файлу",
  "ep.": "эп.",
  "error": "ошибка",
  "Error": "Ошибка",
  "Event": "Событие",
  "Event reached": "Событие наступило",
  "EventBus and widget diagnostics.": "Диагностика EventBus и виджетов.",
  "Events and widget diagnostics.": "Events и widget diagnostics.",
  "Exam": "Экзамен",
  "Exercise": "Упражнения",
  "Existing boards": "Существующие доски",
  "Existing files and folders will be moved to temp/": "Существующие файлы и папки будут перемещены в temp/",
  "Expand": "Развернуть",
  "Expand to full width": "Развернуть на всю ширину",
  "Explicit markdown file path for command input.": "Явный путь к markdown-файлу для command input.",
  "Fajr": "Фаджр",
  "Feb": "фев",
  "February": "февраля",
  "Feels like": "Ощущается",
  "File": "Файл",
  "File Name Format": "Формат имени файла",
  "File not found": "Файл не найден",
  "File where the plus button creates new tasks.": "Файл, куда создавать новые задачи из кнопки plus.",
  "Filters": "Фильтры",
  "First Class Number": "Номер первой пары",
  "First Class Start": "Начало первой пары",
  "First week start date in YYYY-MM-DD format": "Дата начала первой недели в формате YYYY-MM-DD",
  "Float": "Парение",
  "Focus — Centered": "Focus — По центру",
  "Focus — Important": "Focus — Важно",
  "Focused nested countdown.": "Фокусный nested countdown.",
  "Fog": "Туман",
  "Folder": "Папка",
  "Folder for daily notes": "Папка для ежедневных заметок",
  "Folder or comma-separated folder list for task counting.": "Папка или список папок через запятую для подсчёта задач.",
  "Folder or comma-separated folder list to search for markdown tasks.": "Папка или список папок через запятую, где искать markdown-задачи.",
  "Folder or comma-separated folder list to search for tasks.": "Папка или список папок через запятую, где искать задачи.",
  "Folder Path": "Путь к папке",
  "Folder projects": "Папка проектов",
  "Folders": "Папки",
  "For countdown, set date: YYYY-MM-DD or target: YYYY-MM-DD HH:mm": "Для countdown укажи date: YYYY-MM-DD или target: YYYY-MM-DD HH:mm",
  "For example: current_episode, current_page": "Например: current_episode, current_page",
  "For example: ep., pages, h": "Например: эп., стр., ч.",
  "For example: total_episodes, total_pages": "Например: total_episodes, total_pages",
  "For example: YYYY-MM-DD": "Например: YYYY-MM-DD",
  "Force-refresh all umOS API data": "Принудительное обновление всех API-данных umOS",
  "Free-form umOS kanban board.": "Свободная kanban-доска umOS.",
  "Freezing drizzle": "Ледяная морось",
  "Freezing rain": "Ледяной дождь",
  "Fri": "Пт",
  "Friday": "Пятница",
  "From vault": "Из vault",
  "Frontmatter field for saving the value.": "Frontmatter-поле для сохранения значения.",
  "Frontmatter field for the current progress value.": "Frontmatter-поле текущего значения progress input.",
  "Frontmatter field for the total progress value.": "Frontmatter-поле общего значения progress input.",
  "Frontmatter field where the value is saved.": "Frontmatter-поле, куда сохраняется значение.",
  "Frontmatter field where the word of the day is stored.": "Frontmatter-поле, где хранится слово дня.",
  "Frontmatter fields to track, for example [mood, productivity, sleep].": "Список frontmatter-полей для статистики, например [mood, productivity, sleep].",
  "Frontmatter input or command input.": "Frontmatter input или command input.",
  "Frontmatter key, for example exercise or reading.": "Ключ frontmatter, например exercise или reading.",
  "Frosted translucent background around the GIF.": "Матовый полупрозрачный фон вокруг GIF.",
  "Full school week.": "Вся учебная неделя.",
  "Full width": "На всю ширину",
  "Gallery view: grid cards or compact list.": "Вид галереи: карточки сеткой или компактный список.",
  "Game": "Игра",
  "GIF Panel": "GIF-панель",
  "GIF Path or URL": "Путь или URL GIF",
  "Glass Container": "Стеклянный контейнер",
  "Glow": "Свечение",
  "Good afternoon": "Добрый день",
  "Good evening": "Добрый вечер",
  "Good morning": "Доброе утро",
  "Good night": "Доброй ночи",
  "Gradient ────────": "Градиент ────────",
  "Gregorian": "Григорианская",
  "Grid of separate rings or nested rings.": "Сетка отдельных колец или вложенные кольца.",
  "Grouping": "Группировка",
  "h": "ч",
  "H1/H2 span full width, everything else uses 2 columns": "H1/H2 — на всю ширину, остальное в 2 колонки",
  "H2/H3 with a colored bar on the left": "H2/H3 с цветной полосой слева",
  "Habits": "Привычки",
  "Handle urgent items first": "Сначала закрываем горящие",
  "Headings Accent — Colored Headings": "Headings Accent — Цветные заголовки",
  "Heavy drizzle": "Сильная морось",
  "Heavy freezing drizzle": "Сильная ледяная морось",
  "Heavy freezing rain": "Сильный ледяной дождь",
  "Heavy rain": "Сильный дождь",
  "Heavy showers": "Сильный ливень",
  "Heavy snow": "Сильный снег",
  "Heavy snow showers": "Сильный снежный ливень",
  "Heavy thunderstorm with hail": "Сильная гроза с градом",
  "HEX accent color for cards.": "HEX-цвет акцента карточек.",
  "HEX accent color, for example: #3498db": "HEX-цвет акцента, например: #3498db",
  "HH:MM format (for example, 08:30)": "Формат HH:MM (например, 08:30)",
  "HH:MM format (for example, 10:00)": "Формат HH:MM (например, 10:00)",
  "Hidden": "Скрытые",
  "Hidden from Home. Restore it with one click.": "Скрыт с главной. Можно вернуть одним кликом.",
  "Hide": "Скрыть",
  "Hides the first heading and inline title": "Прячет первый заголовок и inline-title",
  "High": "Высокий",
  "High ⏫": "Высокий ⏫",
  "Highlight the current or next class.": "Подсвечивать текущую/следующую пару.",
  "Hijri": "Хиджри",
  "History": "История",
  "Home": "Главная",
  "Home Blocks": "Блоки на главной",
  "Home dashboard setup: folders, section order, and navigation cards.": "Настройка Home-дашборда: папки, порядок секций и навигационные карточки.",
  "Horizontal numbers in text": "Горизонтальные цифры в тексте",
  "Hourly": "По часам",
  "Hourly forecast": "Почасовой прогноз",
  "hours": "часов",
  "How many history days to show.": "Сколько дней истории показать.",
  "How many minutes after the last class Home starts showing the next school day.": "Через сколько минут после последней пары Home начнёт показывать следующий учебный день.",
  "How many recent days to use when no explicit range is set.": "Сколько последних дней брать, если не задан явный диапазон.",
  "Icon": "Иконка",
  "Icon or emoji for rating/chip/toggle.": "Иконка или emoji для rating/chip/toggle.",
  "Idea / note": "Идея / заметка",
  "If the day starts with class 2, set this to 2.": "Если день начинается со 2 пары, поставьте 2.",
  "If today's note does not exist, umOS creates it in the background on startup and after the day changes.": "Если заметки за сегодня нет, umOS создаст её в фоне при запуске и после смены дня.",
  "If true, new tasks are created in the current note.": "Если true, новые задачи создаются в текущей заметке.",
  "Image": "Изображение",
  "Image caption.": "Подпись под изображением.",
  "Image/GIF URL or path inside the vault.": "URL картинки/GIF или путь внутри vault.",
  "Important": "Важно",
  "Imported profile is newer.": "Импортируемый профиль новее.",
  "in progress": "в процессе",
  "In Progress": "В процессе",
  "in range": "в диапазоне",
  "Increase": "Увеличить",
  "Infobox": "Инфобокс",
  "Infobox (Wikipedia-style)": "Инфополе (Wikipedia-стиль)",
  "Infobox stays on screen as a sticky block.": "Инфобокс остаётся на экране как sticky-блок.",
  "Initial status filter when tasks need to be limited.": "Начальный фильтр статусов, если нужно ограничить задачи.",
  "Input type: text, number, rating, slider, command, and others.": "Тип input: text, number, rating, slider, command и другие.",
  "insert": "вставить",
  "Insert": "Вставить",
  "Interface language": "Язык интерфейса",
  "Interface language for umOS widgets, dashboards, modals, and settings.": "Язык интерфейса для виджетов, дашбордов, модальных окон и настроек umOS.",
  "Internal frontmatter identifier.": "Служебный идентификатор для frontmatter.",
  "Isha": "Иша",
  "Islam": "Ислам",
  "Jan": "янв",
  "January": "января",
  "Journal / personal thoughts, italic": "Дневник / личные мысли, курсив",
  "JSON file inside the vault.": "JSON-файл внутри vault.",
  "Jul": "июл",
  "July": "июля",
  "Jun": "июн",
  "June": "июня",
  "just now": "только что",
  "Kanban Board": "Канбан-доска",
  "Kanban board title.": "Заголовок kanban-доски.",
  "Kanban by study tag.": "Kanban по учебному тегу.",
  "Kanban for markdown tasks.": "Kanban по markdown-задачам.",
  "Kanban that creates tasks in the current dashboard.": "Kanban с созданием задач в текущий dashboard.",
  "Key": "Ключ",
  "Lab": "Лабораторная",
  "Label next to the input.": "Подпись рядом с input.",
  "label: Cover (URL)": "label: Обложка (URL)",
  "label: Deadline": "label: Дедлайн",
  "label: Description": "label: Описание",
  "label: Finish Date": "label: Дата окончания",
  "label: Genres": "label: Жанры",
  "label: Mood": "label: Настроение",
  "label: Priority": "label: Приоритет",
  "label: Productivity": "label: Продуктивность",
  "label: Rating": "label: Рейтинг",
  "label: Review": "label: Рецензия",
  "label: Sleep": "label: Сон",
  "label: Start Date": "label: Дата начала",
  "label: Status": "label: Статус",
  "Labels": "Метки",
  "Labels for select/toggles/chips.": "Подписи для select/toggles/chips.",
  "labels: [\"High\", \"Medium\", \"Low\"]": "labels: [\"Высокий\", \"Средний\", \"Низкий\"]",
  "labels: [\"Planned\", \"Active\", \"Done\", \"Cancelled\", \"On Hold\"]": "labels: [\"В планах\", \"В работе\", \"Завершён\", \"Отменён\", \"На паузе\"]",
  "labels: [\"Planned\", \"In Progress\", \"Done\", \"Dropped\", \"On Hold\"]": "labels: [\"В планах\", \"В процессе\", \"Завершено\", \"Брошено\", \"На паузе\"]",
  "Language": "Язык",
  "Large countdown without extra legend.": "Большой countdown без лишней легенды.",
  "last 14 days": "за 14 дней",
  "Last 14 days": "Последние 14 дней",
  "last 30 days": "за 30 дней",
  "Last 30 days": "Последние 30 дней",
  "last 7 days": "за 7 дней",
  "Last 7 days": "Последние 7 дней",
  "last year": "за год",
  "Last year": "Последний год",
  "Later": "Позже",
  "Latitude": "Широта",
  "Layout": "Макет",
  "Lecture": "Лекция",
  "Left Column": "Левая колонка",
  "Light drizzle": "Лёгкая морось",
  "Light rain": "Небольшой дождь",
  "Light showers": "Небольшой ливень",
  "Light snow": "Небольшой снег",
  "Limit task search to one folder or comma-separated folders.": "Ограничить поиск задач папкой или несколькими папками через запятую.",
  "Limits image height in the sidebar.": "Ограничивает высоту картинки в сайдбаре.",
  "Local profile is newer.": "Локальный профиль новее.",
  "Location": "Локация",
  "Longitude": "Долгота",
  "Low": "Низкий",
  "Low 🔽": "Низкий 🔽",
  "Low urgency": "Не срочно",
  "Maghrib": "Магриб",
  "Main direction...": "Главный вектор...",
  "Main infobox title.": "Главный заголовок инфобокса.",
  "Mar": "мар",
  "March": "марта",
  "Mark — Blue": "Метка — Синяя",
  "Mark — Green": "Метка — Зелёная",
  "Mark — Purple": "Метка — Фиолетовая",
  "Mark — Red": "Метка — Красная",
  "Mark — Yellow": "Метка — Жёлтая",
  "Mark as completed": "Отметить совершённым",
  "Markdown columns.": "Markdown-колонки.",
  "Maximum for rating/slider/number input.": "Максимум для rating/slider/number input.",
  "Maximum Height": "Максимальная высота",
  "Maximum rows in each diagnostics list.": "Максимум строк в каждом списке диагностики.",
  "May": "мая",
  "Medium": "Средний",
  "Medium 🔼": "Средний 🔼",
  "Metrics": "Метрики",
  "min": "мин",
  "Mini Schedule": "Мини-расписание",
  "Minimal countdown for a side column.": "Минимальный countdown для боковой колонки.",
  "Minimum for slider/number input.": "Минимум для slider/number input.",
  "minutes": "минут",
  "Minutes": "Минуты",
  "mo": "мес",
  "Mon": "Пн",
  "Monday": "Понедельник",
  "Month history.": "История за месяц.",
  "months": "месяцев",
  "Mood": "Настроение",
  "Mood, productivity, and sleep for a period.": "Mood, productivity и sleep за период.",
  "Moscow": "Москва",
  "Mostly clear": "Малооблачно",
  "Move": "Переместить",
  "Move all contents to temp/ and create default directories.": "Переместить всё содержимое в temp/ и создать директории по умолчанию.",
  "Move down": "Опустить ниже",
  "Move up": "Поднять выше",
  "Movie": "Фильм",
  "Multiple tags automatically added to new tasks.": "Несколько тегов, которые автоматически добавляются новым задачам.",
  "Multiple tags for new kanban tasks.": "Несколько тегов для новых kanban-задач.",
  "Name (for example: Home, Campus...)": "Название (например: Дом, Универ...)",
  "Named range, when supported by the widget.": "Именованный диапазон, если поддерживается виджетом.",
  "Navigation Cards": "Навигационные карточки",
  "nearest deadline": "ближайший дедлайн",
  "Needs attention": "Требует внимания",
  "Nested countdown rings.": "Вложенные countdown rings.",
  "Nested rings with legend.": "Вложенные кольца с легендой.",
  "New Card": "Новая карточка",
  "New Column": "Новая колонка",
  "New Dashboard": "Новый dashboard",
  "New Habit": "Новая привычка",
  "New Label": "Новая метка",
  "New profile.": "Новый профиль.",
  "New Project": "Новый проект",
  "New Task": "Новая задача",
  "New Type": "Новый тип",
  "Next": "Далее",
  "Next prayer": "Следующий намаз",
  "Next Release": "Следующий релиз",
  "Next week focus": "Фокус следующей недели",
  "Nickname": "Никнейм",
  "Night": "Ночь",
  "No active content": "Нет активного контента",
  "No active items": "Нет активных элементов",
  "No active work right now": "Активной работы сейчас нет",
  "No blocks yet.": "Блоков пока нет.",
  "No cards yet. Add the first Home link.": "Карточек пока нет. Добавьте первую ссылку для главной.",
  "No columns. Click Add Column.": "Нет колонок. Нажмите «Добавить колонку».",
  "No configuration errors yet.": "Ошибок конфигурации пока нет.",
  "No content types yet. Add at least one so the gallery is not empty.": "Типов контента пока нет. Добавьте хотя бы один, чтобы галерея не была пустой.",
  "No content types. Add them in plugin settings.": "Нет типов контента. Добавьте их в настройках плагина.",
  "No date": "Без даты",
  "no deadline": "без дедлайна",
  "No deadlines today": "Дедлайнов на сегодня нет",
  "No details.": "Нет деталей.",
  "No entries for this period": "Нет записей за этот период",
  "No events yet.": "Событий пока нет.",
  "No grouping": "Без группировки",
  "No habits yet.": "Привычек пока нет.",
  "No images found in the vault.": "Картинки в vault не найдены.",
  "No labels.": "Меток нет.",
  "No metrics enabled for stats": "Нет включённых метрик для статистики",
  "No preview": "Нет превью",
  "No profiles to import.": "Нет профилей для импорта.",
  "No profiles yet.": "Профилей пока нет.",
  "No projects": "Нет проектов",
  "No render events yet.": "Render-событий пока нет.",
  "No render events.": "Нет render-событий.",
  "No saved images yet.": "Сохранённых картинок пока нет.",
  "No saved locations": "Нет сохранённых локаций",
  "no service": "нет сервиса",
  "no tasks": "нет задач",
  "No tasks": "Нет задач",
  "No tasks for this day.": "На этот день задач нет.",
  "No tasks found in the selected range": "Задачи в выбранном диапазоне не найдены",
  "No Title — Hide H1": "No Title — Скрыть H1",
  "No title, large italic": "Без заголовка, крупный курсив",
  "No urgent deadlines 🎉": "Нет горящих дедлайнов 🎉",
  "none": "нет",
  "None": "Нет",
  "Normal width": "Обычная ширина",
  "not checked": "не отмечен",
  "note": "заметка",
  "Note": "Заметка",
  "Note Classes": "Классы заметки",
  "Note opened when the status bar is clicked.": "Заметка, которая откроется по клику на status bar.",
  "Note or folder opened on click.": "Заметка или папка, которая откроется по клику.",
  "Note path": "Путь к заметке",
  "Note Width": "Ширина заметок",
  "notes": "заметок",
  "Notes": "Заметки",
  "Nothing found": "Ничего не найдено",
  "Nothing found. Try another query or category.": "Ничего не найдено. Попробуй другой запрос или категорию.",
  "Nothing here yet.": "Пока здесь пусто.",
  "Nothing selected": "Ничего не выбрано",
  "Nothing urgent today": "Сегодня можно выдохнуть — срочных задач нет",
  "Nov": "ноя",
  "November": "ноября",
  "now": "сейчас",
  "Now": "Сейчас",
  "Observation, lesson, or adjustment...": "Наблюдение, урок или поправка...",
  "Oct": "окт",
  "October": "октября",
  "On Hold": "На паузе",
  "One main thing...": "Одна главная вещь...",
  "Only numeric values without a chart.": "Только числовые значения без графика.",
  "Only recent EventBus events.": "Только recent EventBus events.",
  "Only render count and validation issues.": "Только render count и validation issues.",
  "Only the next prayer.": "Только следующий намаз.",
  "Open": "Открыть",
  "Open Dashboard Studio": "Открыть Dashboard Studio",
  "Open note": "Открыть заметку",
  "Ornament  ──── ✦ ────": "Орнамент  ──── ✦ ────",
  "Other": "Прочее",
  "Overall task stats.": "Общая статистика задач.",
  "overdue": "просрочено",
  "Overdue": "Просрочено",
  "overdue task": "просроченная",
  "overdue tasks": "просроченные",
  "Overdue tasks.": "Просроченные задачи.",
  "Overview": "Обзор",
  "pages": "стр.",
  "Partial": "Частично",
  "Partly cloudy": "Переменная облачность",
  "Past": "Было",
  "Path": "Путь",
  "Path relative to the vault root, for example: umOS/sync.json. Empty value disables writing.": "Путь относительно корня vault, например: umOS/sync.json. Пустое значение отключает запись.",
  "Personal details, sidebar GIF panel, and infobox behavior.": "Личные данные, GIF-панель в сайдбаре и поведение инфобокса.",
  "Pill Tag": "Пилюля-тег",
  "Placeholder inside the text/command field.": "Подсказка внутри текстового/command поля.",
  "Placeholder text while the value is empty.": "Текст-подсказка, пока значение пустое.",
  "placeholder: Short project description...": "placeholder: Краткое описание проекта...",
  "placeholder: Word of the day...": "placeholder: Слово дня...",
  "placeholder: Write your review...": "placeholder: Напишите свой отзыв...",
  "planned": "в планах",
  "Planned": "В планах",
  "Practice": "Практика",
  "Prayer": "Намаз",
  "Prayer and geolocation for religious and weather blocks.": "Намаз и геолокация для религиозных и погодных блоков.",
  "Prayer Dashboard": "Дашборд намаза",
  "Prayer data is loading...": "Время намаза загружается...",
  "Prayer data is not loaded yet": "Время намаза ещё не загружено",
  "Prayer method": "Метод намаза",
  "Prayer stats as a ring chart.": "Статистика молитв кольцом.",
  "Prayer times and the next prayer.": "Время намазов и следующий намаз.",
  "Prayers": "Намазы",
  "Prayers · Aladhan": "Намазы · Aladhan",
  "PrayerService is not initialized": "PrayerService не инициализирован",
  "Preview may show an error block until the profile is fixed.": "Preview может показать error block, пока профиль не исправлен.",
  "Previous period": "Предыдущий период",
  "Priority": "Приоритет",
  "Productivity": "Продуктивность",
  "Profile": "Профиль",
  "Profile and Appearance": "Профиль и внешний вид",
  "Profile Export Path": "Путь экспорта профилей",
  "Profile, Home, daily note, stats, and utility actions.": "Профиль, главная, daily note, статистика и служебные действия.",
  "Profiles": "Профили",
  "Progress": "Прогресс",
  "project": "проект",
  "Project color": "Цвет проекта",
  "Project deleted": "Проект удалён",
  "Project folder not found": "Папка проекта не найдена",
  "Project gallery view: grid or list.": "Вид галереи проектов: grid или list.",
  "Project gallery.": "Галерея проектов.",
  "projects": "проекта",
  "Projects": "Проекты",
  "Projects as a list.": "Проекты списком.",
  "Projects as cards.": "Проекты карточками.",
  "Projects, content, and progress.": "Проекты, контент и прогресс.",
  "Question / unclear": "Вопрос / неясно",
  "Question set: daily or weekly review.": "Набор вопросов: ежедневный или недельный review.",
  "Quick Add": "Быстро добавить",
  "Quick toggle for nested layout.": "Быстрый переключатель вложенного layout.",
  "Quiet today - no active tasks": "Сегодня спокойно — активных задач нет",
  "Quote / verse with the |center parameter": "Цитата / стих с параметром |center",
  "Rain": "Дождь",
  "Range": "Диапазон",
  "Range end": "Конец диапазона",
  "Range end date in YYYY-MM-DD format.": "Дата конца диапазона в формате YYYY-MM-DD.",
  "Range start": "Начало диапазона",
  "Range start date in YYYY-MM-DD format.": "Дата начала диапазона в формате YYYY-MM-DD.",
  "Reading": "Чтение",
  "Reading — Reading Mode": "Reading — Режим чтения",
  "Recent EventBus events, widget configuration errors, and render count.": "Последние события EventBus, ошибки конфигурации виджетов и счётчик render.",
  "Recently Closed": "Недавно закрытые",
  "Recurrence": "Повторение",
  "Recurring friction or noise...": "Повторяющийся тормоз или шум...",
  "Reference-style infobox.": "Инфобокс в стиле справки.",
  "Reflect — Reflection": "Reflect — Рефлексия",
  "Regular frontmatter text input.": "Обычный frontmatter text input.",
  "Remaining": "Осталось",
  "Removes content max-width": "Убирает max-width контента",
  "Reset": "Сбросить",
  "Reset filters": "Сбросить фильтры",
  "Reset Settings": "Сбросить настройки",
  "Reset to Planned": "Сбросить на «В планах»",
  "Restore all settings to their defaults": "Вернуть все настройки к значениям по умолчанию",
  "Review needs a key: win, lesson, tomorrow, weekly_win, weekly_friction, weekly_next.": "Нужен ключ review: win, lesson, tomorrow, weekly_win, weekly_friction, weekly_next.",
  "Review needs text after the key.": "Нужен текст review после ключа.",
  "review win Finished dashboard studio today": "review win Сегодня добил dashboard studio",
  "Right Column": "Правая колонка",
  "Rime fog": "Изморозь",
  "Room": "Аудитория",
  "RTL, large Amiri font": "RTL, крупный шрифт Amiri",
  "Run": "Выполнить",
  "Russian": "Русский",
  "Same as dateFrom, but in snake_case.": "То же, что dateFrom, но в snake_case.",
  "Same as dateTo, but in snake_case.": "То же, что dateTo, но в snake_case.",
  "Sat": "Сб",
  "Saturday": "Суббота",
  "Save": "Сохранить",
  "Save Current": "Сохранить текущую",
  "Saved": "Сохранённые",
  "Saved Locations": "Сохранённые локации",
  "Schedule": "Расписание",
  "Schedule and school grid parameters.": "Параметры расписания и учебной сетки.",
  "schedule Math monday 09:00-10:30 room:301 type:lecture": "schedule Математика monday 09:00-10:30 room:301 type:lecture",
  "Schedule needs a class name after schedule.": "Нужно название пары после schedule.",
  "Schedule needs a weekday: monday, tuesday ... saturday.": "Нужен день недели: monday, tuesday ... saturday.",
  "Schedule needs time in 09:00-10:30 format.": "Нужно время в формате 09:00-10:30.",
  "Schedule plus due/scheduled tasks for the day.": "Расписание плюс due/scheduled задачи дня.",
  "schedule type: lecture, seminar, lab, practice, or exam.": "type для schedule: lecture, seminar, lab, practice или exam.",
  "schedule week: current, week1, or week2.": "week для schedule: current, week1 или week2.",
  "Scheduled": "Запланировано",
  "Scheduled date filter: today or YYYY-MM-DD.": "Фильтр scheduled date: today или YYYY-MM-DD.",
  "School grid: anchor date, class duration, and slot parameters.": "Учебная сетка: якорная дата, длительность пар и параметры слотов.",
  "Search": "Поиск",
  "Search by description...": "Поиск по описанию…",
  "Search by name or path...": "Поиск по названию или пути...",
  "Search by title...": "Поиск по названию...",
  "Search files...": "Поиск файла...",
  "Search formatting...": "Поиск форматирования…",
  "Search projects...": "Поиск проектов...",
  "sec": "сек",
  "seconds": "секунд",
  "Selected": "Выбрано",
  "Selection": "Выбор",
  "Seminar": "Семинар",
  "Sep": "сен",
  "Separate board for content.": "Отдельная доска для контента.",
  "Separate placeholder for command input.": "Отдельный placeholder для command input.",
  "September": "сентября",
  "Series": "Сериал",
  "Serif font, 68ch width, 1.85 line height": "Засечный шрифт, ширина 68ch, межстрочник 1.85",
  "Set automatically when the task is completed": "Проставляется автоматически при выполнении задачи",
  "Set the card label, path, icon, and accent color.": "Укажите подпись, путь, иконку и акцентный цвет карточки.",
  "Shared geolocation settings for prayer and weather widgets.": "Единые настройки геолокации для намаза и погодных виджетов.",
  "Short description": "Краткое описание",
  "Short diagnostics summary.": "Короткая diagnostics-сводка.",
  "Short lesson of the day.": "Короткий урок дня.",
  "Short project description...": "Краткое описание проекта...",
  "Show": "Показать",
  "Show a timer until the class starts or ends.": "Показывать таймер до начала или конца пары.",
  "Show comparison with the previous period.": "Показывать сравнение с предыдущим периодом.",
  "Show GIF Panel": "Показывать GIF-панель",
  "Show legend next to the nested visual.": "Показывать легенду рядом с nested-визуалом.",
  "Show only tasks with the selected priority.": "Показывать только задачи выбранного приоритета.",
  "Show only tasks with this tag, for example tasks/study or #tasks/study.": "Показывать только задачи с этим тегом, например tasks/study или #tasks/study.",
  "Show only tasks with this tag.": "Показывать только задачи с этим тегом.",
  "Show Past Classes": "Показывать прошедшие пары",
  "Show quick command examples.": "Показывать быстрые примеры команд.",
  "Show recent command history.": "Показывать историю последних команд.",
  "Show sunrise alongside prayer times.": "Показывать время восхода рядом с намазами.",
  "Show sunrise together with prayer times.": "Показывать время восхода вместе с временами намаза.",
  "Show the next prayer in the status bar.": "Показывать следующий намаз в статусной строке.",
  "Showers": "Ливень",
  "Shown in the home greeting.": "Отображается в приветствии на главной.",
  "Simple information card.": "Простая информационная карточка.",
  "Sleep": "Сон",
  "Slots": "Слоты",
  "Snow": "Снег",
  "Snow grains": "Снежные зёрна",
  "Snow showers": "Снежный ливень",
  "Soft wide": "Чуть шире",
  "Soft Wide — Soft wide": "Soft Wide — Чуть шире",
  "Soft Wide Note": "Мягкая широкая заметка",
  "Sort": "Сортировка",
  "Sort string such as priority-asc, priority-desc, dueDate-asc, status-asc.": "Сортировка вида priority-asc, priority-desc, dueDate-asc, status-asc.",
  "Specific file for new tasks.": "Конкретный файл для создания новых задач.",
  "Start": "Начать",
  "Start Date": "Дата начала",
  "Start date filter: today or YYYY-MM-DD.": "Фильтр start date: today или YYYY-MM-DD.",
  "Start of the range for statistic/date filters.": "Начало диапазона для статистического/датированного фильтра.",
  "Start time": "Время начала",
  "Started work waiting for the next step": "То, что уже начато и ждёт следующего шага",
  "Stat — Mini Stats": "Stat — Мини-статистика",
  "Stats": "Статистика",
  "Stats for study tasks.": "Статистика по учебным задачам.",
  "Stats range": "Диапазон статистики",
  "Stats range end.": "Конец диапазона статистики.",
  "Stats range start.": "Начало диапазона статистики.",
  "Stats range tasks": "Диапазон статистики задач",
  "Status": "Статус",
  "Step for slider/number input.": "Шаг изменения для slider/number input.",
  "Stick on Scroll": "Закреплять при скролле",
  "Study": "Учёба",
  "Study dashboard: schedule, tasks, and stats.": "Учебный dashboard: расписание, задачи и статистика.",
  "Study Tasks": "Учебные задачи",
  "Study tasks by tag.": "Учебные задачи по тегу.",
  "Subfolder inside the root content folder.": "Подпапка внутри корневой папки контента.",
  "Subject": "Предмет",
  "Subtask description...": "Описание подзадачи...",
  "Subtasks": "Подзадачи",
  "Subtitle under the title.": "Подзаголовок под названием.",
  "subtitle: Infobox example": "subtitle: Пример infobox",
  "Subtle panel motion when you want it to feel alive.": "Лёгкое движение панели, если хочется живости.",
  "Suffix next to the number, for example %, pages, or h.": "Суффикс рядом с числом, например %, стр. или ч.",
  "suffix: h": "suffix: ч",
  "Sun": "Вс",
  "Sunday": "Воскресенье",
  "Sunrise": "Восход",
  "SVG Divider": "SVG-разделитель",
  "Swing": "Покачивание",
  "Switch week": "Переключить неделю",
  "Sync File Path": "Путь к файлу синхронизации",
  "System": "Система",
  "Tag": "Тег",
  "Tag added to new kanban tasks.": "Тег, который добавляется новым kanban-задачам.",
  "Tag automatically added to new tasks.": "Тег, который автоматически добавляется новым задачам.",
  "Tags": "Теги",
  "Target date/time: YYYY-MM-DD or YYYY-MM-DD HH:MM.": "Целевая дата/время: YYYY-MM-DD или YYYY-MM-DD HH:MM.",
  "task": "задача",
  "task already active": "задача уже в работе",
  "Task list with filters and quick creation.": "Список задач с фильтрами и быстрым созданием.",
  "Task needs a description after task.": "Нужно описание задачи после task.",
  "task Prepare notes tomorrow #study !high": "task Подготовить конспект tomorrow #study !high",
  "Task summary.": "Сводка по задачам.",
  "task/countdown/schedule/review commands.": "task/countdown/schedule/review команды.",
  "tasks": "задачи",
  "Tasks": "Задачи",
  "TASKS": "ЗАДАЧ",
  "tasks already active": "задачи уже в работе",
  "Tasks due today.": "Задачи со сроком на сегодня.",
  "Tasks, stats, and kanban.": "Задачи, статистика и kanban.",
  "Teacher": "Преподаватель",
  "Template Blocks": "Блоки шаблона",
  "Text in three columns": "Текст в три колонки",
  "Text in two columns, separated by ===": "Текст в две колонки, разделитель ===",
  "Text on the left.": "Текст слева.",
  "Text on the right.": "Текст справа.",
  "The best result of the day...": "Самый хороший результат дня...",
  "The key is used in frontmatter and should not change after notes of this type have been created.": "Ключ нужен для frontmatter и не должен меняться после того, как вы уже создали заметки этого типа.",
  "The latest saved cache is shown below.": "Ниже показан последний сохраненный кеш.",
  "The profile will generate, but some fields are ignored by widgets.": "Профиль сгенерируется, но есть поля, которые виджеты игнорируют.",
  "The same version already exists.": "Такая же версия уже есть.",
  "This week": "За неделю",
  "This widget has no quick snippets yet.": "У этого widget пока нет quick snippets.",
  "Thu": "Чт",
  "Thunderstorm": "Гроза",
  "Thunderstorm with hail": "Гроза с градом",
  "Thursday": "Четверг",
  "Time to target": "До цели осталось",
  "Title": "Название",
  "Title above the task list.": "Заголовок над списком задач.",
  "title: Card": "title: Карточка",
  "title: Card\nsubtitle: Example": "title: Карточка\nsubtitle: Пример",
  "title: My Projects": "title: Мои проекты",
  "title: Project Tasks": "title: Задачи проекта",
  "title: Projects\ncreate_in: current": "title: Проекты\ncreate_in: current",
  "title: Tasks for today": "title: Задачи на сегодня",
  "title: Tasks for today\ndue: today\ncreate_in: current": "title: Задачи на сегодня\ndue: today\ncreate_in: current",
  "title: Until Exams": "title: До сессии",
  "title: Until Exams\ndate: 2026-07-01 00:00\nview: focus": "title: До сессии\ndate: 2026-07-01 00:00\nview: focus",
  "title: Until Summer": "title: До лета",
  "title: Until Summer\ndate: 2026-06-01 00:00\nlayout: nested": "title: До лета\ndate: 2026-06-01 00:00\nlayout: nested",
  "to do": "к выполнению",
  "To Do": "К выполнению",
  "today": "сегодня",
  "Today": "Сегодня",
  "Today none classes 🎉": "Сегодня нет пар 🎉",
  "today!": "сегодня!",
  "Today!": "Сегодня!",
  "Todo and doing tasks.": "Todo и doing задачи.",
  "tomorrow": "завтра",
  "Tomorrow": "Завтра",
  "Tomorrow →": "Завтра →",
  "Tomorrow focus": "Фокус завтра",
  "TOTAL": "ВСЕГО",
  "Total Value Field": "Поле общего количества",
  "Tue": "Вт",
  "Tuesday": "Вторник",
  "Type": "Тип",
  "type: chips requires a properties array": "Для type: chips нужен массив properties",
  "type: command\nplaceholder: task Prepare notes tomorrow #study !high\nhistory: true": "type: command\nplaceholder: task Подготовить конспект tomorrow #study !high\nhistory: true",
  "type: numbers requires a properties array": "Для type: numbers нужен массив properties",
  "type: ratings requires a properties array": "Для type: ratings нужен массив properties",
  "type: toggles requires a properties array": "Для type: toggles нужен массив properties",
  "umOS — Settings": "umOS — Настройки",
  "umOS: prayer times loaded": "umOS: времена намаза загружены",
  "umOS: refreshing API data...": "umOS: обновляю API-данные...",
  "umOS: weather loaded": "umOS: погода загружена",
  "Uncheck": "Снять отметку",
  "Unit": "Единица",
  "Unknown": "Неизвестно",
  "Unknown command": "Неизвестная команда",
  "Until Event": "До события",
  "Until Target": "До цели",
  "Update location": "Обновить местоположение",
  "updated": "обновлено",
  "Updated": "Обновлено",
  "URL or file path in the vault": "URL или путь к файлу в хранилище",
  "URL or image path in the vault.": "URL или путь к изображению во vault.",
  "URL or vault file path, for example: 00 Files/avatar.png": "URL или путь к файлу во vault, например: 00 Files/avatar.png",
  "Values for select input.": "Значения для select input.",
  "Vault path to .svg or inline SVG code. When empty, the default line is used.": "Путь к .svg во vault или inline SVG-код. Если пусто, используется линия по умолчанию.",
  "Vault Structure": "Структура хранилища",
  "Verse — Centered": "Verse — По центру",
  "Verse — Quote / Verse": "Verse — Цитата / Стих",
  "Visual density and size.": "Плотность и размер визуала.",
  "Weather": "Погода",
  "Weather · Open-Meteo": "Погода · Open-Meteo",
  "Weather forecast mode": "Режим прогноза погоды",
  "WeatherService is not initialized": "WeatherService не инициализирован",
  "Wed": "Ср",
  "Wednesday": "Среда",
  "week 1": "нед. 1",
  "Week 1": "Неделя 1",
  "week 2": "нед. 2",
  "Week 2": "Неделя 2",
  "Weekly review.": "Недельный review.",
  "Weekly win": "Победа недели",
  "weeks": "недель",
  "Weeks": "Недели",
  "What did you understand today?": "Что сегодня понял?",
  "What got in the way?": "Что мешало?",
  "What moved forward most...": "Что продвинулось сильнее всего...",
  "What needs to be finished today": "То, что важно завершить в течение дня",
  "What should be considered?": "Что стоит учесть?",
  "What to show: everything, only events, widgets, or a compact summary.": "Что показывать: всё, только события, виджеты или компактную сводку.",
  "What to show: the time list, only the next prayer, or both blocks.": "Что показывать: список времён, только следующий намаз или оба блока.",
  "What worked?": "Что получилось?",
  "When off, mini schedule keeps only current and upcoming classes for the day.": "Если выключить, в mini schedule останутся только текущая и будущие пары дня.",
  "Where command input actions go: current or daily note.": "Куда направлять действие command input: current или daily note.",
  "Where to create new tasks: current or the default daily note.": "Куда создавать новые задачи: current или daily note по умолчанию.",
  "Where to create tasks: current for the current note, or the default daily note.": "Куда создавать задачи: current для текущей заметки или daily note по умолчанию.",
  "Which schedule parts to show: current day, week, or both blocks.": "Какие части расписания показывать: текущий день, неделю или оба блока.",
  "Which tasks to pull in: due date, scheduled date, or both.": "Какие задачи подтягивать: по сроку, по scheduled date или оба типа.",
  "Wide — Full width": "Wide — На всю ширину",
  "Wider than a regular note, but not full-screen": "Шире обычной заметки, но не на весь экран",
  "Widget title.": "Заголовок виджета.",
  "Widget type is not set (type)": "Не указан тип виджета (type)",
  "Widget visual size: full or compact.": "Визуальный размер виджета: полный или компактный.",
  "Width for cssclasses: umos-wide-soft. Wider than a standard note, but not full-screen.": "Ширина для cssclasses: umos-wide-soft. Это шире стандартной заметки, но не на весь экран.",
  "Wind": "Ветер",
  "wk": "нед",
  "Word of the Day": "Слово дня",
  "Word of the day in word_of_day.": "Слово дня в word_of_day.",
  "Word of the day...": "Слово дня...",
  "Word-of-the-day history.": "История слов дня.",
  "Worth noting": "На заметку",
  "Write...": "Написать...",
  "y": "г",
  "Year": "Год",
  "years": "лет"
};

Object.assign(EN_RU, {
	"🕌 umOS: prayer times loaded": "🕌 umOS: времена намаза загружены",
	"🌤 umOS: weather loaded": "🌤 umOS: погода загружена",
	"❌ Could not open Home": "❌ Не удалось открыть Home",
	"❌ Could not save settings": "❌ Не удалось сохранить настройки",
	"↻ umOS: refreshing API data...": "↻ umOS: обновляю API-данные...",
} satisfies TranslationMap);

const RU_EN: TranslationMap = Object.fromEntries(
	Object.entries(EN_RU).map(([en, ru]) => [ru, en])
);

let currentLanguage: UmOSLanguage = "en";
let bodyObserver: MutationObserver | null = null;
let isLocalizing = false;
const registeredRoots = new Set<HTMLElement>();

export function normalizeLanguage(language: unknown): UmOSLanguage {
	return language === "ru" ? "ru" : "en";
}

export function setLanguage(language: unknown): void {
	currentLanguage = normalizeLanguage(language);
	localizeRegisteredRoots();
}

export function getLanguage(): UmOSLanguage {
	return currentLanguage;
}

export function getLocale(): string {
	return currentLanguage === "ru" ? "ru-RU" : "en-US";
}

export function t(text: string): string {
	return translateText(text, currentLanguage);
}

export function translateText(text: string, language: UmOSLanguage = currentLanguage): string {
	if (!text) return text;
	const map = language === "ru" ? EN_RU : RU_EN;
	const exact = map[text];
	if (exact) return exact;

	const leading = text.match(/^\s*/)?.[0] ?? "";
	const trailing = text.match(/\s*$/)?.[0] ?? "";
	const trimmed = text.trim();
	if (trimmed && trimmed !== text) {
		const translated = translateText(trimmed, language);
		if (translated !== trimmed) return `${leading}${translated}${trailing}`;
	}

	const dynamic = translateDynamicText(trimmed || text, language);
	if (dynamic !== (trimmed || text)) {
		return trimmed ? `${leading}${dynamic}${trailing}` : dynamic;
	}

	return text;
}

export function localizeDom(root: ParentNode | null | undefined): void {
	if (!root || isLocalizing) return;
	isLocalizing = true;
	try {
		walkAndLocalize(root);
	} finally {
		isLocalizing = false;
	}
}

export function registerLocalizationRoot(root: HTMLElement): void {
	registeredRoots.add(root);
	localizeDom(root);
}

export function unregisterLocalizationRoot(root: HTMLElement): void {
	registeredRoots.delete(root);
}

export function installGlobalDomLocalization(): void {
	if (bodyObserver || typeof MutationObserver === "undefined" || !document.body) return;
	bodyObserver = new MutationObserver((records) => {
		if (isLocalizing) return;
		for (const record of records) {
			if (record.type === "characterData") {
				const parent = record.target.parentElement;
				if (parent && isLocalizableElement(parent)) localizeDom(parent);
				continue;
			}
			if (record.type === "attributes") {
				const target = record.target;
				if (target instanceof HTMLElement && isLocalizableElement(target)) localizeDom(target);
				continue;
			}
			for (const node of Array.from(record.addedNodes)) {
				if (node instanceof HTMLElement) {
					if (isLocalizableElement(node) || hasLocalizableDescendant(node)) localizeDom(node);
				} else if (node.parentElement && isLocalizableElement(node.parentElement)) {
					localizeDom(node.parentElement);
				}
			}
		}
	});
	bodyObserver.observe(document.body, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true,
		attributeFilter: ["placeholder", "title", "aria-label", "alt"],
	});
}

export function uninstallGlobalDomLocalization(): void {
	bodyObserver?.disconnect();
	bodyObserver = null;
	registeredRoots.clear();
}

function localizeRegisteredRoots(): void {
	for (const root of Array.from(registeredRoots)) {
		if (root.isConnected) {
			localizeDom(root);
		} else {
			registeredRoots.delete(root);
		}
	}
	document.querySelectorAll<HTMLElement>("[class*='umos-'], .notice").forEach((el) => localizeDom(el));
}

function walkAndLocalize(root: ParentNode): void {
	if (root instanceof HTMLElement) {
		localizeElement(root);
	}
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	while (node) {
		if (node instanceof Text) {
			localizeTextNode(node);
		} else if (node instanceof HTMLElement) {
			localizeElement(node);
		}
		node = walker.nextNode();
	}
}

function localizeElement(el: HTMLElement): void {
	if (shouldSkipElement(el)) return;
	for (const attr of ["placeholder", "title", "aria-label", "alt"]) {
		const value = el.getAttribute(attr);
		if (!value) continue;
		const translated = translateText(value);
		if (translated !== value) el.setAttribute(attr, translated);
	}
}

function localizeTextNode(node: Text): void {
	const parent = node.parentElement;
	if (!parent || shouldSkipElement(parent)) return;
	const value = node.nodeValue ?? "";
	const translated = translateText(value);
	if (translated !== value) node.nodeValue = translated;
}

function shouldSkipElement(el: HTMLElement): boolean {
	const tag = el.tagName.toLowerCase();
	if (["script", "style", "code", "pre", "textarea"].includes(tag)) return true;
	if (el.closest("pre, code, textarea")) return true;
	if (el.hasAttribute("data-umos-no-i18n")) return true;
	return false;
}

function isLocalizableElement(el: HTMLElement): boolean {
	return !!el.closest("[class*='umos-'], .notice");
}

function hasLocalizableDescendant(el: HTMLElement): boolean {
	return !!el.querySelector("[class*='umos-'], .notice");
}

function translateDynamicText(text: string, language: UmOSLanguage): string {
	return language === "ru" ? dynamicEnToRu(text) : dynamicRuToEn(text);
}

function dynamicEnToRu(text: string): string {
	const prefixed = text.match(/^([^\p{L}\p{N}]+)\s+(.+)$/u);
	if (prefixed) {
		const translated = translateText(prefixed[2], "ru");
		if (translated !== prefixed[2]) return `${prefixed[1]} ${translated}`;
	}
	let commandMatch = text.match(/^umOS command: (.+)$/);
	if (commandMatch) return `umOS command: ${translateText(commandMatch[1], "ru")}`;
	let match = text.match(/^Selected: (.+)$/);
	if (match) return `Выбрано: ${match[1]}`;
	match = text.match(/^(\d+) min ago$/);
	if (match) return `${match[1]} мин назад`;
	match = text.match(/^(\d+) h ago$/);
	if (match) return `${match[1]} ч назад`;
	match = text.match(/^(\d+) d ago$/);
	if (match) return `${match[1]} д назад`;
	match = text.match(/^in (.+)$/);
	if (match) return `через ${match[1].replace(/h/g, "ч").replace(/min/g, "мин")}`;
	match = text.match(/^(\d+) done$/);
	if (match) return `${match[1]} готово`;
	match = text.match(/^(\d+) active$/);
	if (match) return `${match[1]} в работе`;
	match = text.match(/^(\d+) tasks$/);
	if (match) return `${match[1]} ${plural(Number(match[1]), "задача", "задачи", "задач")}`;
	match = text.match(/^(\d+) projects?$/);
	if (match) return `${match[1]} ${plural(Number(match[1]), "проект", "проекта", "проектов")}`;
	match = text.match(/^(\d+) notes?$/);
	if (match) return `${match[1]} ${plural(Number(match[1]), "заметка", "заметки", "заметок")}`;
	match = text.match(/^(\d+)\/(\d+) tasks$/);
	if (match) return `${match[1]}/${match[2]} задач`;
	match = text.match(/^Overdue tasks: (\d+)$/);
	if (match) return `Просроченные задачи: ${match[1]}`;
	match = text.match(/^Tasks due today: (\d+)$/);
	if (match) return `Задачи на сегодня: ${match[1]}`;
	match = text.match(/^Note for (.+) already exists$/);
	if (match) return `Заметка за ${match[1]} уже существует`;
	match = text.match(/^Daily note for (.+) created$/);
	if (match) return `Дневная заметка за ${match[1]} создана`;
	match = text.match(/^Failed to create note: (.+)$/);
	if (match) return `Не удалось создать заметку: ${match[1]}`;
	match = text.match(/^Task added: (.+)$/);
	if (match) return `Задача добавлена: ${match[1]}`;
	match = text.match(/^Countdown added: (.+)$/);
	if (match) return `Countdown добавлен: ${match[1]}`;
	match = text.match(/^Schedule updated: (.+)$/);
	if (match) return `Расписание обновлено: ${match[1]}`;
	match = text.match(/^Review saved: (.+)$/);
	if (match) return `Review сохранён: ${match[1]}`;
	match = text.match(/^File already exists: (.+)$/);
	if (match) return `Файл уже существует: ${match[1]}`;
	match = text.match(/^Created: (.+)$/);
	if (match) return `Создано: ${match[1]}`;
	match = text.match(/^Project already exists: (.+)$/);
	if (match) return `Проект уже существует: ${match[1]}`;
	match = text.match(/^Project created: (.+)$/);
	if (match) return `Проект создан: ${match[1]}`;
	match = text.match(/^Status: (.+)$/);
	if (match) return `Статус: ${translateText(match[1], "ru")}`;
	match = text.match(/^Unknown command "(.+)"\. Try task, countdown, schedule, or review\.$/);
	if (match) return `Неизвестная команда "${match[1]}". Попробуй task, countdown, schedule или review.`;
	match = text.match(/^Unknown review key "(.+)"\.$/);
	if (match) return `Неизвестный review-ключ "${match[1]}".`;
	match = text.match(/^Could not add task to (.+)\.$/);
	if (match) return `Не удалось добавить задачу в ${match[1]}.`;
	match = text.match(/^Invalid date: (.+)\. Format: YYYY-MM-DD\.$/);
	if (match) return `Некорректная дата: ${match[1]}. Формат: YYYY-MM-DD.`;
	match = text.match(/^Invalid countdown date: (.+)\.$/);
	if (match) return `Некорректная дата countdown: ${match[1]}.`;
	match = text.match(/^Invalid time: (.+)\. Format: HH:MM\.$/);
	if (match) return `Некорректное время: ${match[1]}. Формат: HH:MM.`;
	return text;
}

function dynamicRuToEn(text: string): string {
	const prefixed = text.match(/^([^\p{L}\p{N}]+)\s+(.+)$/u);
	if (prefixed) {
		const translated = translateText(prefixed[2], "en");
		if (translated !== prefixed[2]) return `${prefixed[1]} ${translated}`;
	}
	let commandMatch = text.match(/^umOS command: (.+)$/);
	if (commandMatch) return `umOS command: ${translateText(commandMatch[1], "en")}`;
	let match = text.match(/^Выбрано: (.+)$/);
	if (match) return `Selected: ${match[1]}`;
	match = text.match(/^(\d+) мин назад$/);
	if (match) return `${match[1]} min ago`;
	match = text.match(/^(\d+) ч назад$/);
	if (match) return `${match[1]} h ago`;
	match = text.match(/^(\d+) д назад$/);
	if (match) return `${match[1]} d ago`;
	match = text.match(/^через (.+)$/);
	if (match) return `in ${match[1].replace(/ч/g, "h").replace(/мин/g, "min")}`;
	match = text.match(/^(\d+) готово$/);
	if (match) return `${match[1]} done`;
	match = text.match(/^(\d+) в работе$/);
	if (match) return `${match[1]} active`;
	match = text.match(/^(\d+) задач[аи]?$/);
	if (match) return `${match[1]} tasks`;
	match = text.match(/^(\d+) проект(?:а|ов)?$/);
	if (match) return `${match[1]} projects`;
	match = text.match(/^(\d+) замет(?:ка|ки|ок)$/);
	if (match) return `${match[1]} notes`;
	match = text.match(/^(\d+)\/(\d+) задач$/);
	if (match) return `${match[1]}/${match[2]} tasks`;
	match = text.match(/^Просроченные задачи: (\d+)$/);
	if (match) return `Overdue tasks: ${match[1]}`;
	match = text.match(/^Задачи на сегодня: (\d+)$/);
	if (match) return `Tasks due today: ${match[1]}`;
	return text;
}

function plural(count: number, one: string, few: string, many: string): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return one;
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
	return many;
}
