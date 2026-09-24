import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { localStorageAdapter } from "@/lib/storage";
import type { Task } from "@/lib/types";

/**
 * The "Void List" — a short, today-oriented task list.
 * Completed tasks don't get deleted; they get a `completedAt` timestamp so the
 * UI can animate them into the void (and a dim Completed section can show them).
 */

interface TaskState {
  tasks: Task[];
  addTask: (title: string) => void;
  renameTask: (id: string, title: string) => void;
  removeTask: (id: string) => void;
  completeTask: (id: string) => void;
  reopenTask: (id: string) => void;
  clearCompleted: () => void;
}

const createTaskId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],

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
        set({ tasks: [task, ...get().tasks] });
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
