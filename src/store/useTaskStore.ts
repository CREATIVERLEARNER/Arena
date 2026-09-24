import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { localStorageAdapter } from "@/lib/storage";
import { todayKey } from "@/lib/time";
import type { Task } from "@/lib/types";

/**
 * The "Void List" — a short, today-oriented task list.
 * Completed tasks don't get deleted; they get a `completedAt` timestamp so the
 * UI can animate them into the void (and a dim Completed section can show them).
 * When a new day dawns, dissolved tasks are swept away entirely.
 */

interface TaskState {
  tasks: Task[];
  /** The day this list belongs to — drives the daily rollover. */
  listDay: string;
  addTask: (title: string) => void;
  renameTask: (id: string, title: string) => void;
  removeTask: (id: string) => void;
  completeTask: (id: string) => void;
  reopenTask: (id: string) => void;
  clearCompleted: () => void;
  rolloverIfNeeded: () => void;
}

const createTaskId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      listDay: todayKey(),

      /** Newest tasks float to the top — the list is "what's next", not an archive. */
      addTask: (title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        const task: Task = {
          id: createTaskId(),
          title: trimmed,
          completed: false,
          createdAt: Date.now(),
          completedAt: null,
        };
        set({ tasks: [task, ...get().tasks], listDay: todayKey() });
      },

      renameTask: (id, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set({
          tasks: get().tasks.map((task) =>
            task.id === id ? { ...task, title: trimmed } : task,
          ),
        });
      },

      removeTask: (id) => {
        set({ tasks: get().tasks.filter((task) => task.id !== id) });
      },

      completeTask: (id) => {
        set({
          tasks: get().tasks.map((task) =>
            task.id === id && !task.completed
              ? { ...task, completed: true, completedAt: Date.now() }
              : task,
          ),
        });
      },

      reopenTask: (id) => {
        set({
          tasks: get().tasks.map((task) =>
            task.id === id
              ? { ...task, completed: false, completedAt: null }
              : task,
          ),
        });
      },

      clearCompleted: () => {
        set({ tasks: get().tasks.filter((task) => !task.completed) });
      },

      /** A new day: yesterday's dissolved tasks dissolve forever. */
      rolloverIfNeeded: () => {
        const state = get();
        const today = todayKey();
        if (state.listDay === today) return;
        set({
          listDay: today,
          tasks: state.tasks.filter((task) => !task.completed),
        });
      },
    }),
    {
      name: "void:tasks",
      version: 1,
      storage: createJSONStorage(() => localStorageAdapter),
    },
  ),
);

/** Selectors — components subscribe to slices, never to the whole store. */
export const selectActiveTasks = (state: TaskState) =>
  state.tasks.filter((task) => !task.completed);

export const selectCompletedTasks = (state: TaskState) =>
  state.tasks.filter((task) => task.completed);
