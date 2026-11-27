'use client';

/**
 * StudioInspectorSection — غلاف قسم خاضع لإعدادات لوحة التحكم
 * (SiteConfig.studio.hiddenInspectorSections) ويعرضه كستارة أكورديون منسدلة
 * من الأعلى للأسفل قابلة للفرد والطي منفردةً أو جماعياً.
 */
import React, { useState } from 'react';
import { isInspectorSectionHidden } from '@/lib/inspector-sections';
import { useApp } from '../AppProvider';
import {
  StudioAccordionCurtain,
  useInspectorAccordion,
} from './StudioAccordionCurtain';

interface StudioInspectorSectionProps {
  /** معرّف القسم المسجّل في lib/inspector-sections.ts */
  id: string;
  /** التسمية العربية للقسم في رأس الستارة */
  title: string;
  /** شارة إضافية مختصرة في رأس الستارة */
  badge?: React.ReactNode;
  /** أيقونة اختيارية في رأس الستارة */
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function StudioInspectorSection({
  id,
  title,
  badge,
  icon,
  children,
}: StudioInspectorSectionProps) {
  const { config } = useApp();
  const accordion = useInspectorAccordion();
  const [fallbackOpen, setFallbackOpen] = useState(true);

  if (isInspectorSectionHidden(config.studio.hiddenInspectorSections, id)) {
    return null;
  }

  const open = accordion ? accordion.isOpen(id) : fallbackOpen;
  const onToggle = accordion
    ? () => accordion.toggle(id)
    : () => setFallbackOpen((prev) => !prev);

  return (
    <StudioAccordionCurtain
      id={id}
      title={title}
      open={open}
      onToggle={onToggle}
      badge={badge}
      icon={icon}
    >
      {children}
    </StudioAccordionCurtain>
  );
}
