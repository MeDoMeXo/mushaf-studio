/**
 * production-project-store — تخزين مشاريع «استوديو الإنتاج» في localStorage.
 *
 * المشاريع بيانات JSON فقط (اختيارات وتحرير وإعدادات) — الصوت نفسه
 * يُعاد جلبه من everyayah عند فتح المشروع، والملفات المرفوعة (موسيقى)
 * تُطلب إعادة ربطها. الحفظ التلقائي كل ١٥ ثانية يحمي من الانقطاع،
 * و«استعادة» تعيد آخر نسخة محفوظة تلقائياً.
 */

import type {
  ProductionProjectData,
  ProductionProjectSummary,
} from './production-types';

/** مفتاح قائمة المشاريع المحفوظة. */
const PROJECTS_KEY = 'quran_production_projects_v1';
/** مفتاح الحفظ التلقائي (آخر حالة للمشروع الجاري). */
const AUTOSAVE_KEY = 'quran_production_autosave_v1';
/** آخر مشروع مفتوح (يفتح تلقائياً عند العودة). */
const LAST_KEY = 'quran_production_last_v1';

/** سقف عدد المشاريع المحفوظة (الأقدم يُحذف عند التجاوز). */
const MAX_PROJECTS = 20;
/** سقف حجم JSON للمشروع الواحد قبل رفض الحفظ (وقاية الحصة). */
const MAX_PROJECT_JSON_BYTES = 512 * 1024;

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    return safeParse<T>(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** عنصر مخزَّن واحد (بيانات + وصفة العرض). */
interface StoredProject {
  id: string;
  updatedAt: number;
  /** مدة الخط المحرَّر وقت الحفظ — للعرض في البطاقة. */
  durationSec: number;
  surahName: string;
  reciterName: string;
  fromAyah: number;
  toAyah: number;
  data: ProductionProjectData;
}

function listStored(): StoredProject[] {
  const arr = readJson<StoredProject[]>(PROJECTS_KEY) ?? [];
  return Array.isArray(arr) ? arr.filter((p) => p && p.id && p.data) : [];
}

/** قائمة المشاريع المحفوظة (الأحدث أولاً). */
export function listProductionProjects(): ProductionProjectSummary[] {
  return listStored()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((p) => ({
      id: p.id,
      name: p.data.name,
      updatedAt: p.updatedAt,
      surahId: p.data.surahId,
      surahName: p.surahName,
      fromAyah: p.data.fromAyah,
      toAyah: p.data.toAyah,
      reciterName: p.reciterName,
      durationSec: p.durationSec,
    }));
}

/** قراءة مشروع كامل بمعرّفه — أو null. */
export function loadProductionProject(id: string): ProductionProjectData | null {
  const found = listStored().find((p) => p.id === id);
  return found ? found.data : null;
}

/** حفظ مشروع (جديد أو تحديث) — يعيد معرّفه أو null عند الفشل. */
export function saveProductionProject(
  id: string | null,
  data: ProductionProjectData,
  meta: { surahName: string; durationSec: number }
): string | null {
  if (JSON.stringify(data).length > MAX_PROJECT_JSON_BYTES) return null;
  const list = listStored().sort((a, b) => b.updatedAt - a.updatedAt);
  const now = Date.now();
  let finalId = id;
  if (!finalId || list.some((p) => p.id === finalId)) {
    if (!finalId) finalId = `prj-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
  const entry: StoredProject = {
    id: finalId,
    updatedAt: now,
    durationSec: Math.max(0, Math.round(meta.durationSec)),
    surahName: meta.surahName,
    reciterName: data.reciterName,
    fromAyah: data.fromAyah,
    toAyah: data.toAyah,
    data: { ...data, version: 1 },
  };
  const next = [entry, ...list.filter((p) => p.id !== finalId)].slice(0, MAX_PROJECTS);
  return writeJson(PROJECTS_KEY, next) ? finalId : null;
}

/** حذف مشروع محفوظ. */
export function deleteProductionProject(id: string): void {
  writeJson(PROJECTS_KEY, listStored().filter((p) => p.id !== id));
}

/** الحفظ التلقائي — بلا معرّف، يُستبدل كل مرة. */
export function writeProductionAutosave(
  data: ProductionProjectData,
  meta: { surahName: string; durationSec: number }
): void {
  writeJson(AUTOSAVE_KEY, { at: Date.now(), meta, data });
}

/** قراءة الحفظ التلقائي — null إن لم يوجد. */
export function readProductionAutosave(): {
  at: number;
  data: ProductionProjectData;
} | null {
  const raw = readJson<{ at: number; data: ProductionProjectData }>(AUTOSAVE_KEY);
  return raw && raw.data ? raw : null;
}

/** تذكّر آخر مشروع مفتوح (معرّفه) لفتحه تلقائياً عند العودة. */
export function rememberLastProject(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(LAST_KEY, id);
    else window.localStorage.removeItem(LAST_KEY);
  } catch {
    // تجاهل
  }
}

/** آخر مشروع مفتوح — null إن لم يوجد أو حُذف مشروعُه. */
export function readLastProjectId(): string | null {
  const id = typeof window === 'undefined' ? null : window.localStorage.getItem(LAST_KEY);
  return id && listStored().some((p) => p.id === id) ? id : null;
}

/** إزالة كل شيء (مشروع جديد نظيف). */
export function clearProductionAutosave(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // تجاهل
  }
}
