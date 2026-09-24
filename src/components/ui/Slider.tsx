"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  max?: number;
  step?: number;
  className?: string;
  "aria-label": string;
}

/**
 * Radix slider dressed in the Void aesthetic — hairline track, violet range,
 * silver thumb that ignites on touch.
 */
export function Slider({
  value,
  onValueChange,
  max = 100,
  step = 1,
  className,
  "aria-label": ariaLabel,
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-4 w-full touch-none select-none items-center", className)}
      value={[value]}
      max={max}
      step={step}
      onValueChange={(values) => onValueChange(values[0] ?? value)}
    >
      <SliderPrimitive.Track className="relative h-[3px] grow overflow-hidden rounded-full bg-line">
        <SliderPrimitive.Range className="absolute h-full bg-glow/60" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        className="block size-3 rounded-full bg-mist shadow-[0_0_10px_rgba(139,124,246,0.35)] transition-[background-color,box-shadow] duration-300 hover:bg-silver hover:shadow-[0_0_14px_rgba(139,124,246,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow/60"
      />
    </SliderPrimitive.Root>
  );
}
