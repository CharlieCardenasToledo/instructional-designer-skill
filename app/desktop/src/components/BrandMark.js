export function BrandMark({ mono = false, light = false, className = "", size = 36 } = {}) {
  const source = mono ? (light ? "/brand/jintia-mark-mono-light.svg" : "/brand/jintia-mark-mono-dark.svg") : "/brand/jintia-mark.svg";
  return `<img src="${source}" alt="" width="${size}" height="${size}" class="${className}" />`;
}
