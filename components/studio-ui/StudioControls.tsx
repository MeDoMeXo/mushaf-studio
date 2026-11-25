'use client';

import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

/* -------------------------------------------------------------------------- */
/* StudioSlider (Radix UI Slider with RTL support + golden accent)            */
/* -------------------------------------------------------------------------- */
interface StudioSliderProps {
  id?: string;
  label: string;
  valueDisplay: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  accent?: 'gold' | 'emerald';
}

export function StudioSlider({
  id,
  label,
  valueDisplay,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
  onCommit,
  accent = 'gold',
}: StudioSliderProps) {
  return (
    <div className={disabled ? 'opacity-45' : ''}>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <label
          htmlFor={id}
          className="font-semibold text-[var(--ink-muted)]"
        >
          {label}
        </label>
        <span className="font-mono text-[11px] font-bold text-[var(--ink-primary)] tabular-nums">
          {valueDisplay}
        </span>
      </div>
      <SliderPrimitive.Root
        id={id}
        dir="rtl"
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(vals) => {
          if (typeof vals[0] === 'number') onChange(vals[0]);
        }}
        onValueCommit={(vals) => {
          if (onCommit && typeof vals[0] === 'number') onCommit(vals[0]);
        }}
        aria-label={label}
        className="relative flex h-5 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[var(--border-hairline)]">
          <SliderPrimitive.Range
            className={
              accent === 'gold'
                ? 'absolute h-full rounded-full bg-[var(--brand-gold)]'
                : 'absolute h-full rounded-full bg-[var(--brand-emerald)] dark:bg-[#E6C75A]'
            }
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-4 w-4 cursor-grab rounded-full border-2 border-[var(--surface-card)] bg-[var(--brand-gold)] shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2 active:cursor-grabbing dark:border-[#0A1513]" />
      </SliderPrimitive.Root>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* StudioSwitch (Radix UI Switch with crisp RTL animation)                    */
/* -------------------------------------------------------------------------- */
interface StudioSwitchProps {
  id?: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  compact?: boolean;
}

export function StudioSwitch({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  compact = false,
}: StudioSwitchProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        compact
          ? 'py-1'
          : 'rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--surface-subtle)]/70'
      }`}
    >
      <div className="min-w-0">
        <label
          htmlFor={id}
          className="block cursor-pointer text-xs font-semibold text-[var(--ink-primary)]"
        >
          {label}
        </label>
        {description && (
          <p className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
            {description}
          </p>
        )}
      </div>
      <SwitchPrimitive.Root
        id={id}
        dir="rtl"
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="peer relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-stone-400/45 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2 data-[state=checked]:bg-[var(--brand-emerald)] dark:bg-stone-600/60 dark:data-[state=checked]:bg-[var(--brand-gold)]"
      >
        <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 translate-x-0 data-[state=checked]:-translate-x-4 dark:data-[state=checked]:bg-[#0A1513]" />
      </SwitchPrimitive.Root>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* StudioTooltip (Radix UI Tooltip for pro workbench icon buttons)            */
/* -------------------------------------------------------------------------- */
export const StudioTooltipProvider = TooltipPrimitive.Provider;

interface StudioTooltipProps {
  content: string;
  shortcut?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
}

export function StudioTooltip({
  content,
  shortcut,
  side = 'bottom',
  children,
}: StudioTooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={240}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[#14201C] px-2.5 py-1.5 text-[11px] font-semibold text-[#FAF7F0] shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <span>{content}</span>
          {shortcut && (
            <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-[#E6C75A]">
              {shortcut}
            </kbd>
          )}
          <TooltipPrimitive.Arrow className="fill-[#14201C]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
