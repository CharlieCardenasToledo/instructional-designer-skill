# Compilación LaTeX multiplataforma y Scripts Auxiliares

Referencia de la skill `instructional-designer-skill`. Leer cuando haya que compilar una guía, exportar figuras o usar los scripts de la carpeta `scripts/`.

---

## Compilación LaTeX via WSL

En Windows, WSL 2 con TeX Live es la opción recomendada para aislar la toolchain. En macOS/Linux también puedes usar `pdflatex` y `biber` instalados localmente. El validador detecta el sistema operativo y solo usa WSL cuando es necesario.

### Secuencia completa (3 pasadas)

```bash
# Sustituye [RUTA_WSL_CURSO] por la ruta WSL de la carpeta latex de tu semana.
# Ejemplo: /mnt/d/MisCursos/01_ASIGNATURA/semanas/semana-XX/latex
wsl bash -c "cd '/[RUTA_WSL_CURSO]/semanas/semana-XX/latex' && \\
  pdflatex -interaction=nonstopmode guia-semana-XX.tex && \\
  biber guia-semana-XX && \\
  pdflatex -interaction=nonstopmode guia-semana-XX.tex && \\
  pdflatex -interaction=nonstopmode guia-semana-XX.tex 2>&1 | tail -5"
```

### Flujo completo cuando hay figuras HTML

1. Editar o crear archivos HTML en `latex/figure/` (ver `figuras-html.md`)
2. Capturar PNGs: `node screenshot.mjs` (desde `latex/figure/` en PowerShell)
3. Compilar LaTeX: secuencia de 3 pasadas via WSL
4. Verificar en el log que todos los PNG fueron cargados:
   ```bash
   wsl bash -c "grep -E 'figure/.*\.png' '.../guia-semana-XX.log' | head -20"
   ```

### Reglas de rutas y comillas WSL (única fuente de verdad)

| Windows | WSL |
|---|---|
| `D:\MisCursos\...` | `/mnt/d/MisCursos/...` |
| `C:\Users\mi_usuario\...` | `/mnt/c/Users/mi_usuario/...` |

- La ruta dentro de `wsl bash -c "cd '...'"` usa `/mnt/d/` y barras `/`.
- Siempre usar **comillas simples** alrededor de la ruta en `cd '...'` — nunca variables con doble comilla dentro de `bash -c`. Las comillas simples manejan los espacios en los nombres de directorio.

---

## Scripts Auxiliares (`scripts/`)

### `latex-validator.js` — compilación completa de una guía

Ejecuta la secuencia completa de 3 pasadas (pdflatex → biber → pdflatex → pdflatex) via WSL sobre un archivo `.tex`. Si detecta `figure/screenshot.mjs` junto a la guía, captura primero los PNG de las figuras HTML (flujo completo en un solo comando). Usar rutas absolutas al invocarlo.

```powershell
node [RUTA_SKILL]/scripts/latex-validator.js "[CURSO]/semanas/semana-XX/latex/guia-semana-XX.tex"
```

> ⚙️ Reemplaza `[RUTA_SKILL]` con la ruta donde instalaste la skill (ej. `.claude/skills/instructional-designer-skill` o `.agents/skills/instructional-designer-skill`).

Equivale al comando WSL de arriba; útil como atajo. Si solo se necesita una pasada rápida sin citas, usar el comando WSL manual con una sola invocación de `pdflatex`.

### `legacy-manager.js` — archivar contenido antes de reestructurar

Mueve todo el contenido actual de una carpeta de semana a una subcarpeta `legacy/` antes de regenerar la guía desde cero. Úsalo cuando la instrucción sea rehacer una semana completa sin perder lo anterior.

```powershell
node [RUTA_SKILL]/scripts/legacy-manager.js "[CURSO]/semanas/semana-XX"
```

### `pdf_cutter_template.py` — recortes de bibliografía

Plantilla para extraer rangos de páginas de los libros en `bibliografia/` y guardarlos como PDFs de lectura semanal. Requiere PyMuPDF (`pip install pymupdf`). Copiar la plantilla, editar la lista `cuts` (semana, libro, páginas, nombre) y ejecutarla desde la carpeta raíz del curso.

Salida estándar: `bibliografia/recortes_por_semana/semana-XX/[Nombre].pdf` (la misma carpeta que consulta la Política de Evidencia en `bibliografia.md`).
