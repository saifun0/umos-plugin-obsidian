# AGENTS.md

This file provides guidance to Codex when working in this repository.

## Commands

```bash
npm run dev
npm run build
npm run typecheck
```

No test suite exists. Validate changes with `npm run typecheck` and manual checks in Obsidian.

## Architecture

**umOS** is an Obsidian plugin with a dashboard-style UI. Most user-facing modules are markdown code-block widgets registered in [src/main.ts](src/main.ts).

### Entry Point

[src/main.ts](src/main.ts) loads settings, services, the home view, widget processors, commands, and ribbon icons.

### Widget System

Widgets extend [src/core/BaseWidget.ts](src/core/BaseWidget.ts).

Key hooks:
- `render()`
- `subscribeToEvents()`
- `onWidgetLoad()`
- `onWidgetUnload()`

### Event Bus

[src/EventBus.ts](src/EventBus.ts) contains the typed event map used for cross-module communication.

### Settings & Data

[src/settings/Settings.ts](src/settings/Settings.ts) defines:
- `UmOSSettings` for user configuration
- `UmOSData` for persisted runtime state

Settings UI lives in [src/settings/SettingsTab.ts](src/settings/SettingsTab.ts) and section files under `src/settings/sections/`.

### Module Layout

```text
src/
├── main.ts, EventBus.ts
├── core/
├── settings/
├── home/
├── religion/
│   └── prayer/
├── productivity/
│   ├── kanban/
│   ├── schedule/
│   └── tasks/
├── content/
├── daily/
├── stats/
├── input/
├── weather/
├── time/
├── layout/
├── formatting/
└── utils/
```

### Widget Block Names

`prayer-widget`, `umos-stats`, `words-of-day`, `schedule`, `content-gallery`, `project-gallery`, `tasks-stats-widget`, `tasks-widget`, `tasks-kanban`, `daily-nav`, `word-of-day`, `countdown`, `countdown-rings`, `kanban-board`, `cols-umos`, `info-umos`, `umos-input`

### Config Parsing

Use `parseWidgetConfig(source)` from [src/utils/config.ts](src/utils/config.ts).

## Build Output

esbuild bundles `src/main.ts` into `main.js`. Obsidian loads `main.js` and `styles.css`.
