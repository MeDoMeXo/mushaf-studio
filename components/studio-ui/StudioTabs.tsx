'use client';

import React, { createContext, useContext, useRef } from 'react';
import {
  buildTabDomIds,
  resolveRovingTabIndex,
  type RovingDirection,
} from '@/lib/roving-tabs';

interface StudioTabsContextValue {
  idPrefix: string;
  value: string;
  onValueChange: (nextValue: string) => void;
  dir: RovingDirection;
  hasPanels: boolean;
  tabValues: readonly string[];
  registerTabNode: (val: string, node: HTMLButtonElement | null) => void;
  focusTab: (val: string) => void;
}

const StudioTabsContext = createContext<StudioTabsContextValue | null>(null);

function useStudioTabsContext(): StudioTabsContextValue {
  const ctx = useContext(StudioTabsContext);
  if (!ctx) {
    throw new Error('StudioTabs compound components must be used inside StudioTabsRoot.');
  }
  return ctx;
}

interface StudioTabsRootProps<T extends string> {
  /** Deterministic prefix used to construct SSR/CSR-identical DOM IDs. */
  idPrefix: string;
  value: T;
  onValueChange: (value: T) => void;
  /** Ordered list of tab values for RTL/LTR roving keyboard navigation. */
  tabValues: readonly T[];
  /** Set true only when corresponding StudioTabPanel elements are rendered. */
  hasPanels?: boolean;
  dir?: RovingDirection;
  className?: string;
  children: React.ReactNode;
}

/**
 * Hydration-safe, WCAG 2.2 AA & RTL-native Tabs primitive.
 *
 * Uses deterministic DOM IDs and consistent SSR/CSR tabIndex attributes,
 * avoiding Radix RovingFocusGroupCollectionSlot hydration mismatches in React 19.
 */
export function StudioTabsRoot<T extends string>({
  idPrefix,
  value,
  onValueChange,
  tabValues,
  hasPanels = false,
  dir = 'rtl',
  className,
  children,
}: StudioTabsRootProps<T>) {
  const tabNodesRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  const registerTabNode = (val: string, node: HTMLButtonElement | null) => {
    if (node) {
      tabNodesRef.current.set(val, node);
    } else {
      tabNodesRef.current.delete(val);
    }
  };

  const focusTab = (val: string) => {
    tabNodesRef.current.get(val)?.focus();
  };

  return (
    <StudioTabsContext.Provider
      value={{
        idPrefix,
        value,
        onValueChange: (next) => onValueChange(next as T),
        dir,
        hasPanels,
        tabValues,
        registerTabNode,
        focusTab,
      }}
    >
      <div dir={dir} className={className}>
        {children}
      </div>
    </StudioTabsContext.Provider>
  );
}

interface StudioTabsListProps {
  'aria-label': string;
  className?: string;
  children: React.ReactNode;
}

export function StudioTabsList({
  'aria-label': ariaLabel,
  className,
  children,
}: StudioTabsListProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={className}
    >
      {children}
    </div>
  );
}

interface StudioTabTriggerProps {
  value: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function StudioTabTrigger({
  value,
  disabled = false,
  className,
  children,
}: StudioTabTriggerProps) {
  const ctx = useStudioTabsContext();
  const active = ctx.value === value;
  const { tabId, panelId } = buildTabDomIds(ctx.idPrefix, value);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const items = ctx.tabValues.map((id) => ({ id }));
    const currentIndex = ctx.tabValues.indexOf(value);
    const nextIndex = resolveRovingTabIndex(items, currentIndex, e.key, ctx.dir);
    if (nextIndex === null) return;
    e.preventDefault();
    const nextValue = ctx.tabValues[nextIndex];
    if (nextValue) {
      ctx.onValueChange(nextValue);
      ctx.focusTab(nextValue);
    }
  };

  return (
    <button
      ref={(node) => ctx.registerTabNode(value, node)}
      type="button"
      role="tab"
      id={tabId}
      disabled={disabled}
      aria-selected={active}
      aria-controls={ctx.hasPanels ? panelId : undefined}
      data-state={active ? 'active' : 'inactive'}
      tabIndex={active ? 0 : -1}
      onClick={() => ctx.onValueChange(value)}
      onKeyDown={handleKeyDown}
      className={className}
    >
      {children}
    </button>
  );
}

interface StudioTabPanelProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export function StudioTabPanel({
  value,
  className,
  children,
}: StudioTabPanelProps) {
  const ctx = useStudioTabsContext();
  const active = ctx.value === value;
  if (!active) return null;

  const { tabId, panelId } = buildTabDomIds(ctx.idPrefix, value);

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      data-state="active"
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
