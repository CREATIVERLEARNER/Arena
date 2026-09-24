"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { TaskInput } from "@/components/tasks/TaskInput";
import { TaskItem } from "@/components/tasks/TaskItem";
import { EASE_VOID } from "@/lib/motion";
import {
  selectActiveTasks,
  selectCompletedTasks,
  useTaskStore,
} from "@/store/useTaskStore";

/**
 * The Void List — "focus for today". A short list of what matters now,
 * and below it, the dim shallows where completed tasks rest.
 */
export function TaskSection() {
  const activeTasks = useTaskStore(selectActiveTasks);
  const completedTasks = useTaskStore(selectCompletedTasks);
  const clearCompleted = useTaskStore((s) => s.clearCompleted);

  const [showDissolved, setShowDissolved] = useState(false);

  return (
    <section aria-label="Tasks" className="pb-10">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] tracking-[0.35em] text-faint uppercase">
          Focus for today
        </h2>
        <p className="font-mono text-[10px] tracking-[0.2em] text-ghost uppercase">
          {activeTasks.length} {activeTasks.length === 1 ? "open" : "open"}
        </p>
      </div>

      <TaskInput />

      {/* the living list */}
      {activeTasks.length > 0 ? (
        <ul className="mt-2">
          <AnimatePresence initial={false}>
            {activeTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="py-10 text-center text-sm font-light text-ghost">
          nothing claims your attention — add a focus above
        </p>
      )}

      {/* the shallows — dissolved tasks rest here */}
      {completedTasks.length > 0 && (
        <div className="mt-8 border-t border-line/40 pt-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowDissolved((open) => !open)}
              aria-expanded={showDissolved}
              className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-ghost uppercase transition-colors duration-500 hover:text-faint"
            >
              <motion.span
                animate={{ rotate: showDissolved ? 180 : 0 }}
                transition={{ duration: 0.6, ease: EASE_VOID }}
                className="grid place-items-center"
              >
                <ChevronDown className="size-3" aria-hidden />
              </motion.span>
              {completedTasks.length}{" "}
              {completedTasks.length === 1 ? "task dissolved" : "tasks dissolved"}
            </button>

            <button
              type="button"
              onClick={clearCompleted}
              className="font-mono text-[10px] tracking-[0.25em] text-ghost uppercase transition-colors duration-500 hover:text-mist"
              aria-label="Clear all completed tasks"
            >
              clear
            </button>
          </div>

          <AnimatePresence initial={false}>
            {showDissolved && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1, transition: { duration: 0.6, ease: EASE_VOID } }}
                exit={{ height: 0, opacity: 0, transition: { duration: 0.5, ease: EASE_VOID } }}
                className="overflow-hidden"
              >
                <ul className="mt-1">
                  <AnimatePresence initial={false}>
                    {[...completedTasks]
                      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
                      .map((task) => (
                        <TaskItem key={task.id} task={task} variant="dissolved" />
                      ))}
                  </AnimatePresence>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
