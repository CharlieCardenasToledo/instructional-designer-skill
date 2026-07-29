/**
 * icons.js — Material Symbols Outlined (Sistema de iconos único)
 * Todos los iconos de la aplicación usan Material Symbols Outlined desde Google Fonts.
 */

const ICON_MAP = {
  "check": "done",
  "plus": "add",
  "graduation-cap": "school",
  "file-text": "description",
  "layout-template": "dashboard",
  "help-circle": "help",
  "settings": "settings",
  "minus": "remove",
  "square": "rectangle",
  "x": "close",
  "chevron-left": "chevron_left",
  "chevron-right": "chevron_right",
  "loader-2": "hourglass_empty",
  "alert-circle": "error",
  "check-circle-2": "check_circle",
  "shield-check": "verified",
  "palette": "palette",
  "lock-keyhole": "lock",
  "refresh-cw": "refresh",
  "play": "play_arrow",
  "brain-circuit": "psychology",
  "quote": "format_quote",
  "x-circle": "cancel",
  "folder-plus": "create_new_folder",
  "download": "download",
  "clipboard-copy": "content_copy",
  "key-round": "key",
  "trash-2": "delete",
  "pencil": "edit",
  "info": "info",
  "chevron-down": "expand_more",
  "alert-triangle": "warning",
  "package": "deployed_code",
  "notebook": "notebook",
  "eye": "visibility",
  "building-2": "domain",
  "book-open": "menu_book",
  "link-2": "link",
  "zap": "flash_on",
  "network": "hub",
  "save": "save",
  "circle": "circle",
  "terminal": "terminal",
  "sparkles": "star",
  "help-circle": "help",
  "file-image": "image",
  "layout-dashboard": "dashboard",
  "search": "search",
  "monitor": "monitor",
  "cloud-check": "cloud_done",
};

/** Placeholder para compatibilidad con código existente. Material Symbols no necesita inicialización. */
export function refreshIcons() {
  // Material Symbols Outlined no requiere inicialización JavaScript
  // Los iconos se renderizan automáticamente como fuente de texto
}

/**
 * Genera un elemento <i> con Material Symbols Outlined.
 * @param {string} name - Nombre del icono (mapea automáticamente de Lucide a Material Symbols)
 * @param {number} size - Tamaño en píxeles (default: 14)
 * @returns {string} HTML del icono
 */
export function ic(name, size = 14) {
  const iconName = ICON_MAP[name] || name;
  return `<i class="material-symbols-outlined" style="font-size:${size}px;width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;vertical-align:middle;">${iconName}</i>`;
}
