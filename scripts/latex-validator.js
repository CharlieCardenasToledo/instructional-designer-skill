const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * LaTeX Validator - Instructional Design Skill
 * Si existe figure/screenshot.mjs, captura primero los PNG de las figuras HTML.
 * Luego compila la guía con la secuencia completa de 3 pasadas via WSL:
 * pdflatex -> biber -> pdflatex -> pdflatex
 * (ver references/compilacion-wsl.md)
 */

const filePath = process.argv[2];

if (!filePath) {
    console.error("Error: Debes proporcionar la ruta del archivo .tex");
    console.error('Uso: node latex-validator.js "[CURSO]/semanas/semana-XX/latex/guia-semana-XX.tex"');
    process.exit(1);
}

const absPath = path.resolve(filePath);
const dir = path.dirname(absPath);
const baseName = path.basename(absPath, '.tex');

// Convertir ruta Windows (D:\...) a ruta WSL (/mnt/d/...)
function toWslPath(winPath) {
    return winPath
        .replace(/^([A-Za-z]):\\/, (m, drive) => `/mnt/${drive.toLowerCase()}/`)
        .replace(/\\/g, '/');
}

const wslDir = toWslPath(dir);

// Paso previo 1: ejecutar el linter de estilo LaTeX
const linterScript = path.join(__dirname, 'latex-linter.js');
console.log('Ejecutando análisis estático (linter) de la guía LaTeX...');
try {
    execSync(`node "${linterScript}" "${absPath}"`, {
        stdio: 'inherit'
    });
    console.log('Análisis estático completado.');
} catch (error) {
    console.error('El análisis estático detectó errores críticos de política editorial. Compilación abortada.');
    process.exit(1);
}

// Paso previo 2: capturar PNGs si la guía usa figuras HTML
const screenshotScript = path.join(dir, 'figure', 'screenshot.mjs');
if (fs.existsSync(screenshotScript)) {
    console.log('figure/screenshot.mjs detectado: capturando PNGs antes de compilar...');
    try {
        execSync('node screenshot.mjs', {
            cwd: path.join(dir, 'figure'),
            encoding: 'utf-8',
            stdio: 'inherit',
        });
    } catch (error) {
        console.error('Fallo la captura de screenshots. Abortando antes de compilar.');
        process.exit(1);
    }
}

const sequence = [
    `pdflatex -interaction=nonstopmode ${baseName}.tex`,
    `biber ${baseName}`,
    `pdflatex -interaction=nonstopmode ${baseName}.tex`,
    `pdflatex -interaction=nonstopmode ${baseName}.tex`,
].join(' && ');

const command = `wsl bash -c "cd '${wslDir}' && ${sequence}"`;

console.log(`Compilando ${baseName}.tex (pdflatex -> biber -> pdflatex -> pdflatex)...`);

try {
    const output = execSync(command, { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 });

    if (output.includes("Fatal error")) {
        console.error("Error fatal durante la compilación. Revisa los logs.");
        process.exit(1);
    }

    console.log("Compilación exitosa. PDF generado con citas resueltas.");
} catch (error) {
    console.error("Fallo durante la compilación:");
    console.error((error.stdout || error.message || '').split('\n').slice(-30).join('\n'));
    process.exit(1);
}
