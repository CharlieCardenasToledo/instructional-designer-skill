/**
 * icons.js — Helpers de iconos Lucide (Single Responsibility Principle)
 * Centraliza la carga de íconos para mantener consistencia visual.
 */
import { createIcons,
  Settings, Building2, BookOpen, FileText, Link2, Zap,
  CheckCircle2, XCircle, Loader2, FolderPlus, RefreshCw,
  Download, ClipboardCopy, KeyRound, Plus, Trash2, Pencil,
  Info, ChevronDown, AlertTriangle, Play, Package, Notebook,
  GraduationCap, Eye, LayoutTemplate
  ,Network, Save, Check, Quote, ShieldCheck, AlertCircle, Circle, LockKeyhole,
  Terminal, BrainCircuit, ChevronLeft, ChevronRight, Sparkles,
} from "lucide";

const ICONS = {
  Settings, Building2, BookOpen, FileText, Link2, Zap,
  CheckCircle2, XCircle, Loader2, FolderPlus, RefreshCw,
  Download, ClipboardCopy, KeyRound, Plus, Trash2, Pencil,
  Info, ChevronDown, AlertTriangle, Play, Package, Notebook,
  GraduationCap, Eye, LayoutTemplate,
  Network, Save, Check, Quote, ShieldCheck, AlertCircle, Circle, LockKeyhole,
  Terminal, BrainCircuit, ChevronLeft, ChevronRight, Sparkles,
};

/** Re-renderiza todos los data-lucide del DOM. Llamar después de cada render dinámico. */
export function refreshIcons() {
  createIcons({ icons: ICONS });
}

/** Genera un elemento <i> para interpolación en HTML dinámico. */
export function ic(name, size = 14) {
  return `<i data-lucide="${name}" width="${size}" height="${size}" style="display:inline-block;width:${size}px;height:${size}px;vertical-align:middle;flex-shrink:0"></i>`;
}
