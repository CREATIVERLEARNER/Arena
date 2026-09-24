# Void — Personal Study Sanctuary

A hyper-minimalist, distraction-free study and productivity app. Void is designed
to help you enter deep focus: a calm, dark, aesthetic digital sanctuary combining
a focus timer, a minimalist task manager, and ambient soundscapes in a single
cohesive dashboard.

> Originally scaffolded inside the `Arena` repository.

## Tech Stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | [Next.js 16](https://nextjs.org) (App Router) + React 19      |
| Language   | TypeScript (strict)                                           |
| Styling    | Tailwind CSS 4 (custom `@theme` design tokens, animations)    |
| State      | Zustand 5 (`persist` middleware + storage adapter)            |
| Motion     | Framer Motion + Tailwind transitions (slow & calming)         |
| Icons      | Lucide React                                                  |
| Primitives | Radix UI (accessible slider/dialog/tooltip)                   |
| Storage    | LocalStorage now, Supabase/Firebase-ready via `StorageAdapter` |

## Getting Started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Architecture

```
src/
├── app/                  # App Router — layout, globals.css (design tokens), page
├── components/           # Modular UI (TimerDisplay, TaskItem, SoundToggle, …)
├── hooks/                # useStoreHydration and other shared hooks
├── lib/                  # Pure logic & types
│   ├── storage.ts        #   StorageAdapter — LocalStorage now, Supabase later
│   ├── time.ts           #   Clock formatting & day-key helpers
│   ├── timer-meta.ts     #   Timer mode labels/defaults/bounds
│   ├── types.ts          #   Domain types (Task, TimerMode, FocusLog)
│   └── utils.ts          #   cn() class merge helper
└── store/                # Zustand stores
    ├── useTimerStore.ts  #   Modes, session engine state, focus log, Zen Mode
    └── useTaskStore.ts   #   The "Void List" — add/edit/complete/dissolve
```

## Design System — "The Void Aesthetic"

- **Background** pure black `#000000` (Zen Mode) / deep charcoal `#09090b`
- **Primary text** silver `#e4e4e7` · **muted** `#a1a1aa` · **borders** `#27272a`
- **Accent** dim violet `#8b7cf6` — a whisper of glow, only while the timer runs
- **Type** Geist Sans for UI, Geist Mono for digits (zero layout shift)
- **Motion** slow fades (`cubic-bezier(0.16, 1, 0.3, 1)`), nothing snaps

## Roadmap

- [x] **Phase 1** — Setup & architecture (scaffold, design tokens, Zustand stores)
- [ ] **Phase 2** — UI shell & task manager (dashboard layout, Void List)
- [ ] **Phase 3** — Focus timer (drift-free engine, timer UI, Zen Mode)
- [ ] **Phase 4** — Sanctuary soundboard (ambient loops, per-sound volume mixer)
- [ ] **Phase 5** — Polish & persistence (stats, animations, final pass)
