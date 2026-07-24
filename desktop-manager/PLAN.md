# Plan de Implementación: Compilación de PDF en Step 7

## Objetivo
Compilar un PDF real desde el backend Rust (via pdflatex + WSL) cuando el usuario llega al paso 7 de onboarding. Mostrar el PDF compilado en la UI.

---

## Cambios Requeridos

### 1. Backend Rust — `src-tauri/src/course.rs`
**Agregar función: `compile_syllabus_pdf()`**

```rust
pub fn compile_syllabus_pdf(
    course_path: String,
    course_code: String,
    course_name: String,
    credits: u32,
    academic_period: String,
    semester: String,
    description: String,
    weeks_data: Vec<WeekData>,
) -> ActionResult
```

Pasos:
1. **Generar README.md** — usar `build_syllabus_md()` (ya existe)
2. **Convertir a LaTeX** — lee template embebido, reemplaza placeholders
3. **Ejecutar compilación** — calla `pdflatex` + `biber` via WSL (Windows) o directamente (macOS/Linux)
4. **Retornar PDF** — ruta del PDF compilado o error blocking

**Detalles técnicos:**
- Lee `preamble.tex` de templates embebidas (via `include_dir!()`)
- Reemplaza `{{PLACEHOLDER}}` con valores de config institucional + datos de semana
- En Windows: ejecuta `wsl.exe` con comando: `pdflatex -interaction=nonstopmode ... && biber ... && pdflatex ...` (3 pasadas)
- En macOS/Linux: ejecuta directamente `pdflatex` si está disponible
- Captura `.log` para mostrar errores en UI

### 2. Backend Rust — `src-tauri/src/lib.rs`
**Agregar comando Tauri:**

```rust
#[tauri::command]
async fn compile_syllabus_pdf(
    course_path: String,
    course_code: String,
    course_name: String,
    credits: u32,
    academic_period: String,
    semester: String,
    description: String,
    weeks_data: Vec<WeekData>,
) -> ActionResult {
    course::compile_syllabus_pdf(
        course_path, course_code, course_name, credits,
        academic_period, semester, description, weeks_data,
    )
}
```

Registrar en `invoke_handler`.

### 3. Frontend — `src/api.js`
**Agregar wrapper:**

```javascript
export async function compileSyllabusPdf(payload) {
  return invoke("compile_syllabus_pdf", payload);
}
```

### 4. Frontend — `src/onboarding.js`
**Modificar `animateFinalStep()`:**

Luego de generar el README.md (paso 2/75%), agregar paso 3 (75-95%):

```javascript
// ── 3 / 95% — compilar PDF ──────────────────────────────────────────
setRow(3, "active");
setMsg("Compilando PDF con pdflatex…");
setProgress(80);

let pdfPath;
try {
  const pdfResult = await compileSyllabusPdf({ 
    coursePath: testBasePath, 
    ...syllabusTestData 
  });
  if (pdfResult?.success) {
    pdfPath = pdfResult.path;
    setRow(3, "done");
    setProgress(95);
  } else {
    throw new Error(pdfResult?.message || "Compilación sin detalles");
  }
} catch (err) {
  setRow(3, "error");
  setRow(4, "error");
  setProgress(75);
  showError("Error al compilar PDF", "...", String(err));
  return;
}

// ── 4 / 100% — verificar PDF ────────────────────────────────────────
setRow(4, "active");
setMsg("Verificando documento compilado…");
// ... etc
```

**Actualizar `finalStep()` UI:**
- Cambiar "Verificando documento creado…" → "Compilando PDF con pdflatex…"
- Agregar fila 4: "Abriendo vista previa del PDF…"

**Actualizar `showSuccess()`:**
- Pasar `pdfPath` además de `syllabusData`
- Renderizar preview del PDF (no solo markdown)

### 5. Frontend — `src/onboarding.js` → Nueva función
**Agregar `renderSyllabusDoc(syllabusData, pdfPath, message)`:**

Muestra:
1. Mensaje de éxito
2. Vista previa del PDF (iframe o embed)
3. Botón para abrir PDF en visor nativo
4. Información del archivo (ruta, tamaño)

```javascript
function renderSyllabusDoc(syllabusData, pdfPath, message) {
  return `
    <div style="...">
      <div class="success-banner">
        <span class="material-symbols-outlined">check_circle</span>
        <div>
          <strong>Documento compilado exitosamente</strong>
          <p>${message}</p>
        </div>
      </div>
      <div class="pdf-preview">
        <iframe src="file:///${pdfPath}" style="width:100%;height:600px;border:none;border-radius:8px"></iframe>
      </div>
      <button onclick="window.open('file:///${pdfPath}')">Abrir en visor PDF</button>
      <div class="file-info">Archivo: ${pdfPath}</div>
    </div>
  `;
}
```

---

## Criterios de Éxito

✅ Paso 7 ejecuta compilación automática
✅ Si pdflatex falla → error bloqueante (sin "continuar de todos modos")
✅ Si pdflatex éxito → muestra PDF en iframe + botón para abrir
✅ Botón "Finalizar configuración" se habilita solo tras éxito
✅ Error muestra `.log` de pdflatex para debugging

---

## Dependencias del Sistema

| OS | Comando | Parámetro |
|----|---------|-----------|
| Windows | WSL 2 + TeX Live | `wsl.exe -- pdflatex ...` |
| macOS | TeX Live (Homebrew) | `pdflatex ...` |
| Linux | TeX Live | `pdflatex ...` |

**No es bloqueante:** Si pdflatex no está instalado, el usuario puede instalar via Paso 1 ("TeX Live (pdflatex)"). El Step 7 simplemente reportará error y pedirá reinstalar.

---

## Archivos a Modificar

1. ✏️ `desktop-manager/src-tauri/src/course.rs` — agregar `compile_syllabus_pdf()`
2. ✏️ `desktop-manager/src-tauri/src/lib.rs` — registrar comando
3. ✏️ `desktop-manager/src/api.js` — exponer `compileSyllabusPdf`
4. ✏️ `desktop-manager/src/onboarding.js` — integrar compilación + renderizar

---

## Timeline Estimado

- **course.rs**: 80 líneas (2-3 min)
- **lib.rs**: 2 líneas (1 min)
- **api.js**: 3 líneas (1 min)
- **onboarding.js**: 50 líneas + CSS (5-10 min)
- **Testing**: 3-5 min

**Total: ~15-20 minutos**
