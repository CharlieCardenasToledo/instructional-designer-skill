// onDark: variante a color (mantiene el punto teal y la flecha verde) pero
// con el cuerpo de la J en blanco, para no perderse sobre bg-brand-950. Usar
// en vez de la marca a color por defecto en cualquier superficie navy/oscura.
export function BrandMark({ mono = false, light = false, onDark = false, className = "", size = 36 } = {}) {
  const source = mono
    ? (light ? "/brand/jintia-mark-mono-light.svg" : "/brand/jintia-mark-mono-dark.svg")
    : onDark ? "/brand/jintia-mark-on-dark.svg" : "/brand/jintia-mark.svg";
  return `<img src="${source}" alt="" width="${size}" height="${size}" class="${className}" />`;
}
