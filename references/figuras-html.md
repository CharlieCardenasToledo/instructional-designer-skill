# Figuras HTML — Mock-ups de Interfaz y Captura a PNG

Referencia de la skill `instructional-designer-uide`. Leer cuando la guía requiera figuras de interfaz de usuario (apps móviles, portales web), típicamente en cursos de HCI.

---

## Recursos Visuales HTML para Figuras

Cuando la figura pedagógica representa una interfaz de usuario real (app móvil, portal web), se generan archivos HTML en lugar de diagramas TikZ. Esta modalidad aplica cuando el principio enseñado requiere que el estudiante reconozca el contexto de uso (Aesthetic Usability Effect, Ley de Fitts, distancia cognitiva, signifiers).

### Cuándo usar HTML en lugar de TikZ

| Situación | Herramienta |
|---|---|
| Estructura conceptual, flujo, arquitectura | TikZ |
| Comparación de variantes UI, pantallas realistas | HTML + PNG |
| Diagrama de proceso con componentes de sistema | TikZ |
| Mock-up de app bancaria, portal académico, servicio digital | HTML + PNG |

### Stack tecnológico obligatorio

- **Framework:** Tailwind CSS via CDN — `<script src="https://cdn.tailwindcss.com"></script>`
- **Config de colores personalizados:** bloque `<script>tailwind.config = { ... }</script>` en el `<head>`
- **Fuente:** `fontFamily: { sans: ['Segoe UI', 'Arial', 'sans-serif'] }` en el config

### Branding local — Banco de Loja (app de referencia para HCI)

La app de referencia para ejemplos de banca móvil en Loja es **Banco de Loja** (`bancodeloja.fin.ec`, app iOS/Android disponible).

```js
tailwind.config = {
  theme: {
    extend: {
      colors: {
        loja: {
          DEFAULT: '#5CB326',   // verde lima primario (app real)
          dark:    '#4a9620',   // barra de estado / nav
          light:   '#eaf5da',   // fondo suave / chips
        }
      },
      fontFamily: { sans: ['Segoe UI', 'Arial', 'sans-serif'] }
    }
  }
}
```

### Estructura de pantallas HTML

**Regla principal:** Cada vista es un archivo HTML separado. No combinar múltiples teléfonos en un mismo archivo. LaTeX los une con `minipage`.

- **Sin carcasa de teléfono** — no usar frames/shells oscuros. La pantalla debe verse como una captura real de dispositivo.
- **Ancho fijo:** `w-[390px]` en el contenedor raíz (estándar iPhone / pantalla de referencia).
- **Fondo de body:** `bg-gray-100` — simula el fondo de pantalla del dispositivo.
- **Sombra ligera:** `shadow-lg` en el contenedor raíz.

Estructura mínima de cada archivo HTML:

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = { /* colores + fuente */ }
</script>
</head>
<body class="bg-gray-100 flex justify-center items-start p-0 m-0 font-sans">
  <div class="w-[390px] bg-white shadow-lg flex flex-col">
    <!-- Status bar -->
    <div class="bg-loja text-white text-[12px] px-5 h-11 flex justify-between items-center shrink-0">
      <span class="font-medium">09:41</span>
      <span class="font-medium">4G  86%</span>
    </div>
    <!-- Header de la app -->
    <div class="bg-loja text-white px-5 pt-4 pb-5 shrink-0">
      <div class="flex items-center gap-3">
        <span class="text-white/80 text-lg">←</span>
        <span class="text-[17px] font-bold">Título de la pantalla</span>
      </div>
    </div>
    <!-- Contenido -->
    <div class="bg-gray-50 px-4 py-5 flex-1"> ... </div>
    <!-- Footer con CTA -->
    <div class="bg-white px-4 pt-3 pb-8 shrink-0">
      <button class="w-full bg-loja text-white border-none rounded-full py-4 text-[15px] font-bold">
        Acción principal
      </button>
    </div>
  </div>
</body>
</html>
```

### Convención de nombres de archivos

| Tipo de figura | Archivos HTML | PNGs para LaTeX |
|---|---|---|
| Vista única | `concepto-loja.html` | `concepto-loja.png` |
| Comparación A/B | `concepto-plain-loja.html` + `concepto-polished-loja.html` | `concepto-plain-loja.png` + `concepto-polished-loja.png` |
| BAD/GOOD (Fitts) | `concepto-bad-loja.html` + `concepto-good-loja.html` | `concepto-bad-loja.png` + `concepto-good-loja.png` |

Todos los archivos van en `latex/figure/`.

### Integración en LaTeX

**Vista única:**
```latex
\begin{figure}[H]
\centering
\includegraphics[width=0.60\textwidth]{figure/concepto-loja.png}
\caption{Descripción de la figura.}
\label{fig:concepto}
\end{figure}
```

**Dos vistas lado a lado con subcaption:**
```latex
\begin{figure}[H]
\centering
\begin{minipage}[t]{0.45\textwidth}
  \centering
  \includegraphics[width=\textwidth]{figure/concepto-plain-loja.png}
  \par\smallskip
  {\small\itshape Sin tratamiento visual diferenciado}
\end{minipage}
\hfill
\begin{minipage}[t]{0.45\textwidth}
  \centering
  \includegraphics[width=\textwidth]{figure/concepto-polished-loja.png}
  \par\smallskip
  {\small\itshape Con tratamiento visual diferenciado}
\end{minipage}
\caption{Caption principal de la figura compuesta.}
\label{fig:concepto}
\end{figure}
```

---

## Captura de Screenshots HTML → PNG

Los archivos HTML se convierten a PNG mediante Puppeteer con el Chrome instalado en el sistema. No se descarga un Chromium adicional.

### Prerrequisitos

```powershell
# Desde la carpeta latex/figure/ del curso
npm install puppeteer-core --save-dev
```

Chrome en el sistema: `C:\Program Files\Google\Chrome\Application\chrome.exe`

### Script estándar (`screenshot.mjs`)

Crear este archivo en `latex/figure/` y adaptarlo a la lista de pantallas del curso:

```js
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const SCREENS = [
  { file: 'vista-a.html', out: 'vista-a.png', width: 390 },
  { file: 'vista-b.html', out: 'vista-b.png', width: 390 },
  // añadir una entrada por cada HTML
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const { file, out, width } of SCREENS) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
  const url = `file:///${join(__dirname, file).replace(/\\/g, '/')}`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(
    () => { const el = document.querySelector('[class]'); return el && getComputedStyle(el).fontFamily !== ''; },
    { timeout: 15000 }
  );
  const body = await page.$('body > div');
  await body.screenshot({ path: join(__dirname, out) });
  console.log(`OK  ${out}`);
  await page.close();
}

await browser.close();
console.log('Todos los PNG generados.');
```

### Ejecución

```powershell
# Desde la carpeta latex/figure/ del curso (Windows PowerShell)
node screenshot.mjs
```

Los PNG se generan en la misma carpeta `figure/` y quedan listos para que LaTeX los incluya.

**Nota:** El script usa `waitUntil: 'networkidle0'` para esperar que Tailwind CDN cargue completamente antes de capturar. Si el sistema no tiene acceso a internet, Tailwind no renderizará y los PNG saldrán sin estilos.
