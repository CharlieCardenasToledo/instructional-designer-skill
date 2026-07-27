const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
    console.error('Uso: node latex-validator.js <ruta/guia.tex>');
    process.exit(1);
}
const absPath = path.resolve(filePath);
if (path.extname(absPath).toLowerCase() !== '.tex' || !fs.existsSync(absPath)) {
    console.error('La ruta debe apuntar a un archivo .tex existente.');
    process.exit(1);
}
const dir = path.dirname(absPath);
const baseName = path.basename(absPath, '.tex');
const run = (command, args, cwd) => {
    const result = spawnSync(command, args, { cwd, encoding: 'utf-8', stdio: 'inherit', timeout: 10 * 60 * 1000 });
    if (result.error || result.status !== 0) throw result.error || new Error(`${command} exit ${result.status}`);
};

try {
    run(process.execPath, [path.join(__dirname, 'latex-linter.js'), absPath], process.cwd());
    const screenshot = path.join(dir, 'figure', 'screenshot.mjs');
    if (fs.existsSync(screenshot)) run(process.execPath, ['screenshot.mjs'], path.dirname(screenshot));

    const commands = [
        ['pdflatex', ['-interaction=nonstopmode', `${baseName}.tex`]],
        ['biber', [baseName]],
        ['pdflatex', ['-interaction=nonstopmode', `${baseName}.tex`]],
        ['pdflatex', ['-interaction=nonstopmode', `${baseName}.tex`]],
    ];
    if (process.platform === 'win32') {
        const wslDir = dir.replace(/^([A-Za-z]):\\/, (_, drive) => `/mnt/${drive.toLowerCase()}/`).replace(/\\/g, '/');
        if (wslDir.includes("'") || baseName.includes("'")) throw new Error('La ruta contiene una comilla no soportada por WSL.');
        const command = commands.map(([name, args]) => `${name} ${args.map((arg) => `'${arg}'`).join(' ')}`).join(' && ');
        run('wsl.exe', ['bash', '-lc', `cd -- '${wslDir}' && ${command}`], dir);
    } else {
        commands.forEach(([command, args]) => run(command, args, dir));
    }
    console.log('Compilación exitosa. PDF generado con citas resueltas.');
} catch (error) {
    console.error(`Falló la validación/compilación: ${error.message}`);
    process.exit(1);
}
