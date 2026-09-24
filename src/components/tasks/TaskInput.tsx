"use client";

import { useState } from "react";

import { useTaskStore } from "@/store/useTaskStore";

/**
 * The invitation line of the Void List. Enter adds the task and keeps the
 * cursor in the flow — thought after thought, without ceremony.
 */
export function TaskInput() {
  const addTask = useTaskStore((s) => s.addTask);
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        addTask(value);
        setValue("");
      }}
      className="mt-3"
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={80}
        aria-label="New task"
        placeholder="what deserves your focus?"
        autoComplete="off"
        className="w-full border-b border-line bg-transparent py-2.5 text-[15px] font-light text-silver transition-colors duration-500 placeholder:text-ghost focus:border-glow/50 focus:outline-none"
      />
    </form>
  );
}
