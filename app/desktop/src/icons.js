/**
 * icons.js — Helpers de iconos Lucide (Single Responsibility Principle)
 * Centraliza la carga de íconos para mantener consistencia visual.
 *
 * Única fuente de íconos de la app (manual de marca, sección 15).
 *
 * IMPORTANTE: `createIcons()` deriva la clave de búsqueda automáticamente
 * a partir del string pasado a `ic(name)` — convierte "check-circle-2" a
 * "CheckCircle2" y busca esa clave exacta en el objeto `icons`. Por eso
 * las claves de abajo son shorthand directo de los imports (deben
 * coincidir con el PascalCase real de cada componente de Lucide, no con
 * alias inventados): `ic("code-2")` funciona porque existe `Code2` en
 * este objeto, pero `ic("code")` NO encontraría nada.
 */
import {
  createIcons,
  AlertCircle, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Download, FileText, GraduationCap, HelpCircle, Info,
  LayoutTemplate, Loader2, LockKeyhole, Minus, Notebook,
  Palette, Play, Plus, RefreshCw, Search, Settings, Sparkles,
  Square, Trash2, ShieldCheck,
  Building2, BookOpen, Link2, Zap, XCircle, FolderPlus,
  ClipboardCopy, KeyRound, Pencil, ChevronDown, AlertTriangle,
  Package, Eye, Network, Save, Quote, Circle, Terminal,
  BrainCircuit, X,
  Route, Share2, SlidersHorizontal, Monitor, Laptop,
  ArrowLeft, ArrowRight, CloudCheck, FolderX,
  MoreHorizontal, ExternalLink, Copy, Bug,
  CircleAlert, TriangleAlert, PackageCheck,
  Code2, Puzzle, Archive, Users, Radar,
  RotateCcw, RefreshCcwDot, Bot, UserCog, LayoutDashboard,
  CirclePlus, SearchX, NotebookPen, Key, Hourglass,
  Star, Image, MoreVertical,
  Folder, Database, FlaskConical, Brain, FolderOpen,
} from "lucide";

const ICONS = {
  AlertCircle, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Download, FileText, GraduationCap, HelpCircle, Info,
  LayoutTemplate, Loader2, LockKeyhole, Minus, Notebook,
  Palette, Play, Plus, RefreshCw, Search, Settings, Sparkles,
  Square, Trash2, ShieldCheck,
  Building2, BookOpen, Link2, Zap, XCircle, FolderPlus,
  ClipboardCopy, KeyRound, Pencil, ChevronDown, AlertTriangle,
  Package, Eye, Network, Save, Quote, Circle, Terminal,
  BrainCircuit, X,
  Route, Share2, SlidersHorizontal, Monitor, Laptop,
  ArrowLeft, ArrowRight, CloudCheck, FolderX,
  MoreHorizontal, ExternalLink, Copy, Bug,
  CircleAlert, TriangleAlert, PackageCheck,
  Code2, Puzzle, Archive, Users, Radar,
  RotateCcw, RefreshCcwDot, Bot, UserCog, LayoutDashboard,
  CirclePlus, SearchX, NotebookPen, Key, Hourglass,
  Star, Image, MoreVertical,
  Folder, Database, FlaskConical, Brain, FolderOpen,
};

/** Re-renderiza todos los data-lucide del DOM. Llamar después de cada render dinámico. */
export function refreshIcons() {
  createIcons({ icons: ICONS });
}

/** Genera un elemento <i> para interpolación en HTML dinámico. */
export function ic(name, size = 14) {
  return `<i data-lucide="${name}" width="${size}" height="${size}" style="display:inline-block;width:${size}px;height:${size}px;vertical-align:middle;flex-shrink:0"></i>`;
}
