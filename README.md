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
├── components/
│   ├── dashboard/        # Dashboard shell, Header, TimerSection
│   ├── sound/            # SoundPanel — the Sanctuary ambient mixer (UI)
│   ├── tasks/            # TaskSection, TaskItem (dissolve ritual), TaskInput
│   └── ui/               # Radix-backed primitives (Slider)
├── hooks/                # useStoreHydration, useClientNow
├── lib/                  # Pure logic & types
│   ├── motion.ts         #   Shared Framer Motion easing/variants
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
- [x] **Phase 2** — UI shell & task manager (dashboard layout, Void List with dissolve ritual)
- [x] **Phase 3** — Focus timer (drift-free engine, progress ring, session flow, Zen Mode, shortcuts)
- [x] **Phase 4** — Sanctuary soundboard (six voices synthesized live via Web Audio, mixable + persisted)
- [x] **Phase 5** — Polish & persistence (7-day focus chart, daily rollover, a11y & touch pass)

## Features

- **Focus Timer** — Pomodoro (25/5), Deep Work (custom 5–240 min), Stopwatch.
  Drift-free wall-clock engine, draining violet progress ring, focus→break
  session chaining, daily focus log.
- **Zen Mode** — pure-black full-screen void with only the timer; breathing
  glow while running. `Z` to enter, `Esc` to surface.
- **Keyboard rituals** — `Space` begin/pause · `R` reset · `Z` zen · `Esc` exit.
- **Void List** — add/edit/delete tasks; completing one draws a line through
  it, blurs it into the void, and sinks it into a dim "dissolved" section.
  New days sweep yesterday's dissolved tasks away.
- **Sanctuary Soundboard** — six ambiences (Rain, Deep Space, White Noise,
  Fire, Café, Forest Night) synthesized live via Web Audio — no files, no
  network. Per-sound faders; the whole mix persists.
- **Focus analytics** — today's total in the header and timer, plus a minimal
  7-day bar chart scaled to your best day.
- **Persistence** — tasks, timer preferences, focus log and the sound mix all
  survive refreshes via a storage-adapter seam (LocalStorage now, cloud-ready).
