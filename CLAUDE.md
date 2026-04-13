# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Watch-mode build (esbuild)
npm run build      # Production build → main.js
npm run typecheck  # TypeScript type checking (no emit)
```

No test suite exists. Verify changes via `npm run typecheck` and manual testing in Obsidian.

## Architecture

**umOS** is an Obsidian plugin providing a comprehensive life-management dashboard. It registers markdown code-block processors — each widget is triggered by a block name (e.g., ` ```prayer-widget ``` `) and renders into the note.

### Entry Point

[src/main.ts](src/main.ts) — `UmOSPlugin extends Plugin`. On load it:
1. Instantiates all services and passes them to widgets
2. Calls `registerWidgets()` which registers every widget as a markdown post-processor
3. Registers commands, status bar items, event handlers, and the URI handler

### Widget System

All widgets extend [src/core/BaseWidget.ts](src/core/BaseWidget.ts) (`BaseWidget extends MarkdownRenderChild`).

Lifecycle hooks to override (do **not** override `onload`/`onunload` directly unless calling `super`):
- `render()` — Required. Called on load. For async: `protected render(): void { void this.renderAsync(); }`
- `subscribeToEvents()` — Return `EventSubscription[]`; auto-cleaned on unload
- `onWidgetLoad()` / `onWidgetUnload()` — Pre/post render hooks

`EventSubscription` is exported from `BaseWidget`, not `EventBus`.

### Event Bus

[src/EventBus.ts](src/EventBus.ts) — Typed `EventBus<UmOSEventMap>`. All inter-module communication goes through it. Widgets receive the bus instance via constructor and call `this.eventBus.emit(...)` to notify others.

### Settings & Data

[src/settings/Settings.ts](src/settings/Settings.ts) — Two top-level types:
- `UmOSSettings` — user configuration (prayer method, layout toggles, etc.)
- `UmOSData` — persisted runtime state (pomodoro counts, finance transactions, balance entries, etc.)

Plugin data is saved via `plugin.saveData({ settings, data })`. Settings UI is in [src/settings/SettingsTab.ts](src/settings/SettingsTab.ts) (large file; sections are in `src/settings/sections/`).

### Module Layout

```
src/
├── main.ts, EventBus.ts
├── core/BaseWidget.ts
├── settings/          — Settings types, tab, section files
├── home/              — HomeView dashboard + section renderers
├── religion/          — prayer/, quran/, ramadan/
├── productivity/      — schedule/, tasks/, pomodoro/, exam/, goals/, habits/
├── finance/           — FinanceService, FinanceWidget
├── balance/           — BalanceService, BalanceWidget
├── content/           — ContentGallery, ProjectGallery
├── daily/             — DailyNavWidget, DailyNoteEnhancer
├── stats/             — StatsEngine, StatsWidget, Charts
├── input/             — 9 reusable input widgets + InputWidget base
├── weather/           — WeatherService
├── capture/           — QuickCaptureModal, URIHandler
└── utils/             — api.ts, config.ts (parseWidgetConfig), date.ts, dom.ts
```

### Widget Block Names

`prayer-widget`, `ayat-daily`, `quran-tracker`, `ramadan-widget`, `umos-stats`, `schedule`, `content-gallery`, `project-gallery`, `habits`, `habit-calendar`, `tasks-stats-widget`, `tasks-widget`, `tasks-kanban`, `umos-goals`, `daily-nav`, `pomodoro`, `exam-tracker`, `finance-tracker`, `balance-tracker`

### Config Parsing

Widget code blocks may contain YAML-like config. Use `parseWidgetConfig(source)` from [src/utils/config.ts](src/utils/config.ts) to parse it.

## Key Patterns

- **Async render**: `protected render(): void { void this.renderAsync(); }`
- **Pre-load data**: Override `onload()`, do setup, then call `super.onload()`
- **Adding a new widget**: create a class extending `BaseWidget`, add its block name + constructor call to `registerWidgets()` in `main.ts`
- **Adding a new event**: add to `UmOSEventMap` in `EventBus.ts`
- **Adding new persisted data**: add field to `UmOSData` in `Settings.ts` and to `DEFAULT_DATA`

## Build Output

esbuild bundles `src/main.ts` → `main.js` (CommonJS, inline sourcemap in dev). External: `obsidian`, `electron`, all Node builtins. The compiled `main.js` and `styles.css` are what Obsidian loads.
