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

// Crear carpeta legacy si no existe
if (!fs.existsSync(legacyPath)) {
    fs.mkdirSync(legacyPath, { recursive: true });
}

// Leer archivos en la carpeta de la semana
const files = fs.readdirSync(absolutePath);

files.forEach(file => {
    const oldPath = path.join(absolutePath, file);
    const newPath = path.join(legacyPath, file);

    // No mover la propia carpeta legacy ni archivos ocultos/configuración
    if (file !== 'legacy' && !file.startsWith('.')) {
        console.log(`Moviendo ${file} a legacy...`);
        fs.renameSync(oldPath, newPath);
    }
});

console.log("Mantenimiento de legado completado con éxito.");
