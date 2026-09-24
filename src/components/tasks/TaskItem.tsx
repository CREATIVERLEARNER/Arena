"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { EASE_VOID } from "@/lib/motion";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/store/useTaskStore";

/** How long the dissolve ritual lasts before the task leaves the active list. */
const DISSOLVE_MS = 950;

interface TaskItemProps {
  task: Task;
  variant?: "active" | "dissolved";
}

/**
 * A single row of the Void List.
 *
 * Completing a task is a ritual, not a toggle: a line draws itself through the
 * title, the words blur and sink, the dot ignites — then the row collapses
 * away and the task reappears, dimmed, in the dissolved section below.
 */
export function TaskItem({ task, variant = "active" }: TaskItemProps) {
  const completeTask = useTaskStore((s) => s.completeTask);
  const reopenTask = useTaskStore((s) => s.reopenTask);
  const renameTask = useTaskStore((s) => s.renameTask);
  const removeTask = useTaskStore((s) => s.removeTask);

  const [dissolving, setDissolving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const dissolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDissolved = variant === "dissolved";

  // never let a pending dissolve outlive the component
  useEffect(
    () => () => {
      if (dissolveTimer.current) clearTimeout(dissolveTimer.current);
    },
    [],
  );

  const handleComplete = () => {
    if (dissolving) return;
    setDissolving(true);
    dissolveTimer.current = setTimeout(() => completeTask(task.id), DISSOLVE_MS);
  };

  const commitEdit = () => {
    if (draft.trim()) renameTask(task.id, draft);
    else setDraft(task.title); // empty edit = cancel
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(task.title);
    setEditing(false);
  };

  const struck = dissolving || isDissolved;

  return (
    <motion.li
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1, transition: { duration: 0.5, ease: EASE_VOID } }}
      exit={{ height: 0, opacity: 0, transition: { duration: 0.45, ease: EASE_VOID } }}
      className={cn("overflow-hidden", struck && !isDissolved && "pointer-events-none")}
    >
      <div className="group -mx-3 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-500 hover:bg-elevated/40">
        {/* the dot — a portal, not a checkbox */}
        {isDissolved ? (
          <span
            aria-hidden
            className="grid size-[18px] shrink-0 place-items-center rounded-full border border-glow/30 bg-glow/10 text-glow/70"
          >
            <Check className="size-2.5" strokeWidth={3} />
          </span>
        ) : (
          <button
            type="button"
            onClick={handleComplete}
            aria-label={`Complete task: ${task.title}`}
            className={cn(
              "grid size-[18px] shrink-0 place-items-center rounded-full border transition-all duration-500",
              dissolving
                ? "border-glow/70 bg-glow/15 text-glow"
                : "border-ghost text-transparent hover:border-glow/60 hover:shadow-[0_0_12px_rgba(139,124,246,0.2)]",
            )}
          >
            <Check className="size-2.5" strokeWidth={3} aria-hidden />
          </button>
        )}

        {/* title / editor */}
        {editing ? (
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitEdit();
              if (event.key === "Escape") cancelEdit();
            }}
            onBlur={commitEdit}
            autoFocus
            maxLength={80}
            aria-label="Edit task title"
            className="min-w-0 flex-1 border-b border-glow/40 bg-transparent py-0.5 text-[15px] font-light text-silver focus:outline-none"
          />
        ) : (
          <span className="relative min-w-0 flex-1">
            {/* the words themselves sink and blur into the void */}
            <motion.span
              initial={false}
              animate={
                dissolving
                  ? { opacity: 0, y: 5, filter: "blur(6px)" }
                  : { opacity: 1, y: 0, filter: "blur(0px)" }
              }
              transition={{ duration: 0.9, ease: EASE_VOID }}
              className={cn(
                "block truncate text-[15px] leading-snug font-light",
                isDissolved ? "text-mist/50" : "text-silver/90",
              )}
            >
              {task.title}
            </motion.span>

            {/* the drawn line */}
            <motion.span
              aria-hidden
              initial={false}
              animate={{ scaleX: struck ? 1 : 0 }}
              transition={{ duration: 0.7, ease: EASE_VOID }}
              className="absolute top-1/2 left-0 h-px w-full origin-left bg-faint"
            />
          </span>
        )}

        {/* hover rituals */}
        {isDissolved ? (
          <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={() => reopenTask(task.id)}
              aria-label={`Restore task: ${task.title}`}
              className="grid size-7 place-items-center rounded-md text-ghost transition-colors duration-300 hover:text-mist"
            >
              <RotateCcw className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => removeTask(task.id)}
              aria-label={`Delete task forever: ${task.title}`}
              className="grid size-7 place-items-center rounded-md text-ghost transition-colors duration-300 hover:text-mist"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </span>
        ) : (
          !editing && (
            <span className="touch-actions flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
              <button
                type="button"
                onClick={() => {
                  setDraft(task.title);
                  setEditing(true);
                }}
                aria-label={`Edit task: ${task.title}`}
                className="grid size-7 place-items-center rounded-md text-ghost transition-colors duration-300 hover:text-mist"
              >
                <Pencil className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => removeTask(task.id)}
                aria-label={`Delete task: ${task.title}`}
                className="grid size-7 place-items-center rounded-md text-ghost transition-colors duration-300 hover:text-mist"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </span>
          )
        )}
      </div>
    </motion.li>
  );
}
