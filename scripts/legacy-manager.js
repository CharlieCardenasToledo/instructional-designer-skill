const fs = require('fs');
const path = require('path');

/**
 * Legacy Manager - UIDE Instructional Design Skill
 * Mueve el contenido actual de una carpeta de semana a 'legacy' antes de reestructurar.
 */

const weekPath = process.argv[2];

if (!weekPath) {
    console.error("Error: Debes proporcionar la ruta de la semana. Ej: semanas/semana-08");
    process.exit(1);
}

const absolutePath = path.resolve(weekPath);
const legacyPath = path.join(absolutePath, 'legacy');

if (!fs.existsSync(absolutePath)) {
    console.error(`Error: La ruta ${absolutePath} no existe.`);
    process.exit(1);
}

// Generar subcarpeta con marca de tiempo para evitar colisiones
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
const runLegacyPath = path.join(legacyPath, `archive_${timestamp}`);

// Crear carpetas legacy y subcarpeta si no existen
if (!fs.existsSync(runLegacyPath)) {
    fs.mkdirSync(runLegacyPath, { recursive: true });
}

// Leer archivos en la carpeta de la semana
const files = fs.readdirSync(absolutePath);

files.forEach(file => {
    const oldPath = path.join(absolutePath, file);
    const newPath = path.join(runLegacyPath, file);

    // No mover la propia carpeta legacy ni archivos ocultos/configuración
    if (file !== 'legacy' && !file.startsWith('.')) {
        console.log(`Moviendo ${file} a legacy/archive_${timestamp}...`);
        fs.renameSync(oldPath, newPath);
    }
});

console.log(`Mantenimiento de legado completado con éxito. Archivos guardados en: legacy/archive_${timestamp}`);
