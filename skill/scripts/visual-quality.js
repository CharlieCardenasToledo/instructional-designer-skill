"use strict";

const fs = require("fs");
const path = require("path");

function luminance(hex) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function inspectSvg(content) {
  const errors = [];
  const warnings = [];
  if (!/<svg\b[^>]*\bviewBox\s*=/i.test(content)) errors.push("SVG sin viewBox; puede recortarse o escalarse mal");
  if (/(?:href|xlink:href)\s*=\s*["']https?:/i.test(content)) errors.push("SVG depende de un recurso externo");
  const elements = (content.match(/<(?:path|rect|circle|ellipse|polygon|polyline|line|text)\b/gi) || []).length;
  const texts = [...content.matchAll(/<text\b([^>]*)>/gi)];
  if (elements > 250) warnings.push(`SVG denso: ${elements} elementos gráficos`);
  for (const match of texts) {
    const attributes = match[1];
    const size = attributes.match(/font-size\s*[:=]\s*["']?([\d.]+)/i);
    if (size && Number(size[1]) < 10) errors.push(`texto SVG menor de 10 px: ${size[1]} px`);
  }
  if (texts.length > 40) warnings.push(`SVG contiene ${texts.length} etiquetas de texto; evaluar división progresiva`);
  return { errors, warnings, metrics: { elements, textElements: texts.length } };
}

function inspectHtml(content) {
  const errors = [];
  const warnings = [];
  if (/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i.test(content)) errors.push("HTML depende de un recurso remoto");
  if (!/<meta\b[^>]*charset=/i.test(content)) warnings.push("HTML sin declaración explícita de charset");
  if (/@keyframes\b|animation\s*:/i.test(content)) errors.push("HTML contiene animaciones y no es determinista");
  if (/transition\s*:/i.test(content)) warnings.push("HTML contiene transiciones; desactivarlas antes de capturar");
  const controls = (content.match(/<(?:button|input|select|textarea)\b/gi) || []).length;
  const labels = (content.match(/<label\b/gi) || []).length;
  if (controls > labels + 1) warnings.push("varios controles HTML pueden carecer de etiqueta visible");
  return { errors, warnings, metrics: { controls, labels } };
}

function inspectTextDiagram(content, engine) {
  const errors = [];
  const warnings = [];
  const lines = content.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith("//"));
  const edges = engine === "graphviz"
    ? (content.match(/->/g) || []).length
    : (content.match(/-->|->/g) || []).length;
  if (edges > 50 || lines.length > 100) warnings.push(`${engine} denso: ${edges} relaciones en ${lines.length} líneas`);
  const longLabels = [...content.matchAll(/(?:label\s*=\s*|\[)(?:"([^"]+)"|([^\]\n]+))/g)]
    .map(match => match[1] || match[2])
    .filter(label => label.length > 80);
  if (longLabels.length) warnings.push(`${longLabels.length} etiqueta(s) superan 80 caracteres`);
  return { errors, warnings, metrics: { lines: lines.length, edges } };
}

function inspectSource(file, engine) {
  if (!fs.existsSync(file)) return { errors: ["fuente visual inexistente"], warnings: [], metrics: {} };
  const content = fs.readFileSync(file, "utf8");
  const extension = path.extname(file).toLowerCase();
  if (extension === ".svg") return inspectSvg(content);
  if (extension === ".html" || engine === "html") return inspectHtml(content);
  if (["graphviz", "mermaid", "d2"].includes(engine)) return inspectTextDiagram(content, engine);
  return { errors: [], warnings: [], metrics: {} };
}

module.exports = { contrastRatio, inspectSvg, inspectHtml, inspectSource };
