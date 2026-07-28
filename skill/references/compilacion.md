# Compilación LaTeX y scripts auxiliares

Referencia de `jintia-skill`. Leer cuando haya que compilar una guía, exportar figuras o usar los scripts de la carpeta `scripts/`.

## Comportamiento por plataforma

`scripts/latex-validator.js` ejecuta primero el linter y después cuatro pasos:
`pdflatex`, `biber`, `pdflatex` y `pdflatex`.

Kaohandt puede necesitar una ejecución adicional para estabilizar posiciones
marginales. Si el log contiene `Label(s) may have changed`,
`rerunfilecheck` o referencias indefinidas, repetir `pdflatex`.

- En Windows, el script usa primero `pdflatex` y `biber` nativos para compartir
  el entorno MiKTeX verificado por Jintia. Solo recurre a WSL 2 cuando falta
  alguno de los dos comandos.
- En macOS y Linux, utiliza `pdflatex` y `biber` instalados localmente.
- La aplicación de escritorio tiene además una previsualización rápida con el
  compilador LaTeX nativo; no sustituye la validación completa de la skill.

## Secuencia manual alternativa en Windows con WSL

```bash
# Sustituye [RUTA_WSL_LATEX] por la ruta WSL de la carpeta latex de tu semana.
# Ejemplo: /mnt/d/MisCursos/01_ASIGNATURA/semanas/semana-XX/latex
wsl bash -lc "cd '/mnt/d/MisCursos/01_ASIGNATURA/semanas/semana-XX/latex' && \\
  pdflatex -interaction=nonstopmode guia-semana-XX.tex && \\
  biber guia-semana-XX && \\
  pdflatex -interaction=nonstopmode guia-semana-XX.tex && \\
  pdflatex -interaction=nonstopmode guia-semana-XX.tex 2>&1 | tail -5"
```

## Secuencia manual en macOS o Linux

```bash
cd "/ruta/al/curso/semanas/semana-XX/latex"
pdflatex -interaction=nonstopmode guia-semana-XX.tex
biber guia-semana-XX
pdflatex -interaction=nonstopmode guia-semana-XX.tex
pdflatex -interaction=nonstopmode guia-semana-XX.tex
```

## Flujo cuando hay figuras HTML

1. Editar o crear archivos HTML en `latex/figure/` (ver `figuras-html.md`)
2. Capturar PNGs: `node screenshot.mjs` (desde `latex/figure/` en PowerShell)
3. Compilar LaTeX con el validador o la secuencia de la plataforma.
4. Verificar en el log que todos los PNG fueron cargados:
   ```bash
   wsl bash -c "grep -E 'figure/.*\.png' '.../guia-semana-XX.log' | head -20"
   ```

## Rutas y comillas en WSL

| Windows | WSL |
|---|---|
| `D:\MisCursos\...` | `/mnt/d/MisCursos/...` |
| `C:\Users\mi_usuario\...` | `/mnt/c/Users/mi_usuario/...` |

- La ruta dentro de `wsl bash -c "cd '...'"` usa `/mnt/d/` y barras `/`.
- Siempre usar **comillas simples** alrededor de la ruta en `cd '...'` — nunca variables con doble comilla dentro de `bash -c`. Las comillas simples manejan los espacios en los nombres de directorio.

---

## Scripts auxiliares (`scripts/`)

### `latex-validator.js` — compilación completa de una guía

Ejecuta el linter y la secuencia completa de compilación sobre un archivo
`.tex`. En Windows prefiere la instalación nativa y usa WSL como alternativa;
en macOS y Linux usa la instalación nativa. Si
detecta `figure/screenshot.mjs`, captura primero las figuras HTML.

```powershell
node [RUTA_SKILL]/scripts/latex-validator.js "[CURSO]/semanas/semana-XX/latex/guia-semana-XX.tex"
```

Reemplaza `[RUTA_SKILL]` con la ruta donde instalaste la skill.

La validación completa es la ruta recomendada antes de entregar una guía.

### `legacy-manager.js` — archivar contenido antes de reestructurar

Mueve todo el contenido actual de una carpeta de semana a una subcarpeta `legacy/` antes de regenerar la guía desde cero. Úsalo cuando la instrucción sea rehacer una semana completa sin perder lo anterior.

```powershell
node [RUTA_SKILL]/scripts/legacy-manager.js "[CURSO]/semanas/semana-XX"
```

### `pdf_cutter_template.py` — recortes de bibliografía

Plantilla para extraer rangos de páginas de los libros en `bibliografia/` y guardarlos como PDFs de lectura semanal. Requiere PyMuPDF (`pip install pymupdf`). Copiar la plantilla, editar la lista `cuts` (semana, libro, páginas, nombre) y ejecutarla desde la carpeta raíz del curso.

Salida estándar: `bibliografia/recortes_por_semana/semana-XX/[Nombre].pdf` (la misma carpeta que consulta la Política de Evidencia en `bibliografia.md`).
