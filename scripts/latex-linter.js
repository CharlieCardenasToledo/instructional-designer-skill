const fs = require('fs');
const path = require('path');

/**
 * LaTeX Linter - Instructional Design Skill
 * Realiza un análisis estático de las guías LaTeX para asegurar el cumplimiento
 * de la política editorial y de los principios de diseño instruccional (R1, R2, D2, etc.).
 */

// Colores ANSI para salida en terminal
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    cyan: "\x1b[36m",
    bold: "\x1b[1m"
};

const mainFilePath = process.argv[2];

if (!mainFilePath) {
    console.error(`${colors.red}Error: Debes proporcionar la ruta del archivo principal .tex de la semana.${colors.reset}`);
    console.error(`Uso: node scripts/latex-linter.js "[CURSO]/semanas/semana-XX/latex/guia-semana-XX.tex"`);
    process.exit(1);
}

const absMainPath = path.resolve(mainFilePath);
if (!fs.existsSync(absMainPath)) {
    console.error(`${colors.red}Error: El archivo ${absMainPath} no existe.${colors.reset}`);
    process.exit(1);
}

const rootDir = path.dirname(absMainPath);

// Palabras o frases prohibidas (muletillas de IA)
const AI_TROPES = [
    { text: "querido estudiante", reason: "Tono no profesional / condescendiente" },
    { text: "a continuación veremos", reason: "Muletilla de transición de IA" },
    { text: "a continuación,", reason: "Transición débil/IA" },
    { text: "es importante destacar", reason: "Muletilla común de IA" },
    { text: "es importante mencionar", reason: "Muletilla común de IA" },
    { text: "recuerda que", reason: "Muletilla común de IA" },
    { text: "la regla de oro", reason: "Metáfora no técnica / muletilla de IA" },
    { text: "en resumen", reason: "Muletilla de resumen / IA" },
    { text: "bajo la lupa", reason: "Metáfora no técnica" },
    { text: "el corazón del sistema", reason: "Metáfora no técnica" },
    { text: "caja negra", reason: "Metáfora no técnica (usar términos específicos de abstracción)" }
];

let totalErrors = 0;
let totalWarnings = 0;

// Estructura para registrar los keyterms globales y sus archivos/líneas
const keytermsRegistry = {};

function logIssue(type, file, line, msg, rawLine = "") {
    const relativeFile = path.relative(rootDir, file);
    const color = type === "ERROR" ? colors.red : colors.yellow;
    console.log(`${color}${colors.bold}[${type}]${colors.reset} ${colors.cyan}${relativeFile}:${line}${colors.reset} - ${msg}`);
    if (rawLine) {
        console.log(`    > ${colors.bold}${rawLine.trim()}${colors.reset}`);
    }
    if (type === "ERROR") totalErrors++;
    else totalWarnings++;
}

// Limpia el código LaTeX para análisis de texto (R1)
function cleanLatexText(text) {
    // 1. Quitar comentarios LaTeX
    let cleaned = text.split('\n')
        .map(line => line.replace(/(^|[^\\])%.*$/, '$1'))
        .join('\n');
    
    // 2. Quitar entornos de matemáticas complejos y TikZ
    cleaned = cleaned.replace(/\$\$[\s\S]*?\$\$/g, ' ');
    cleaned = cleaned.replace(/\$[\s\S]*?\$/g, ' ');
    cleaned = cleaned.replace(/\\begin\{equation\}[\s\S]*?\\end\{equation\}/g, ' ');
    cleaned = cleaned.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, ' ');
    cleaned = cleaned.replace(/\\begin\{tabularx\}[\s\S]*?\\end\{tabularx\}/g, ' ');
    cleaned = cleaned.replace(/\\begin\{tabular\}[\s\S]*?\\end\{tabular\}/g, ' ');
    
    // 3. Reemplazar macros de formato simple por su contenido textual (repetir para anidados)
    for (let i = 0; i < 4; i++) {
        cleaned = cleaned.replace(/\\(?:keyterm|textit|textbf|enquote|emph|ref|textcite|parencite|section|subsection|chapter)\{([^{}]+)\}/g, '$1');
    }
    
    // 4. Limpiar otras macros LaTeX y llaves sueltas
    cleaned = cleaned.replace(/\\begin\{[a-zA-Z0-9*]+\}/g, ' ');
    cleaned = cleaned.replace(/\\end\{[a-zA-Z0-9*]+\}/g, ' ');
    cleaned = cleaned.replace(/\\[a-zA-Z0-9*]+/g, ' ');
    cleaned = cleaned.replace(/[{}]/g, ' ');
    
    return cleaned;
}

// Analiza oraciones largas (R1) en un archivo
function checkSentenceLength(filePath, content) {
    const cleanedText = cleanLatexText(content);
    
    // Separar en oraciones basándose en puntos finales (seguidos de espacio y mayúscula o nueva línea)
    const sentences = cleanedText.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ"“])|(?<=[.!?])\s*\n/);
    
    sentences.forEach(sentence => {
        if (!sentence.trim()) return;
        
        // Contar palabras
        const words = sentence.trim().split(/\s+/).filter(w => {
            return w.length > 0 && /[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/.test(w);
        });
        
        if (words.length > 35) {
            // Intentar buscar la oración aproximada en el archivo original para referenciar la línea
            const approxText = sentence.substring(0, 40).trim();
            const lines = content.split('\n');
            let lineNum = 1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(approxText)) {
                    lineNum = i + 1;
                    break;
                }
            }
            logIssue(
                "WARNING", 
                filePath, 
                lineNum, 
                `Oración muy larga (R1): contiene ${words.length} palabras. Límite sugerido de 35. Divide la oración con un conector causal.`,
                sentence
            );
        }
    });
}

// Analiza un archivo individual
function lintFile(filePath) {
    if (!fs.existsSync(filePath)) {
        logIssue("ERROR", filePath, 0, `Archivo referenciado no existe: ${filePath}`);
        return "";
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Validar oraciones largas
    checkSentenceLength(filePath, content);
    
    let inFigure = false;
    let figureStartLine = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const rawLine = lines[i];
        
        // Quitar comentarios para el análisis de línea
        const line = rawLine.replace(/(^|[^\\])%.*$/, '$1').trim();
        if (!line) continue;
        
        // 1. Buscar muletillas de IA
        AI_TROPES.forEach(trope => {
            if (line.toLowerCase().includes(trope.text)) {
                logIssue("WARNING", filePath, lineNum, `Uso de muletilla/metáfora prohibida: "${trope.text}" - Razón: ${trope.reason}`, rawLine);
            }
        });
        
        // 2. Incisos con rayas dobles --- o em-dash —
        // Coincide con doble raya/raya larga delimitando texto sin espacios
        if (/(?:---|\u2014|--)[^\s]+.*?[^\s]+(?:---|\u2014|--)/.test(line) ||
            /\s+(?:---|\u2014|--)\s+.+?\s+(?:---|\u2014|--)/.test(line)) {
            logIssue("ERROR", filePath, lineNum, "Inciso entre rayas dobles/em-dash prohibido. Usa paréntesis o rompe la oración.", rawLine);
        }
        
        // 3. Comandos de LaTeX obsoletos o prohibidos
        if (line.includes("\\cite{") || line.includes("\\cite ")) {
            logIssue("ERROR", filePath, lineNum, "Uso de \\cite{} genérico prohibido. Usa \\textcite{} si el autor es sujeto, o \\parencite{} en caso contrario.", rawLine);
        }
        if (line.includes("\\hline")) {
            logIssue("ERROR", filePath, lineNum, "Uso de \\hline prohibido. Utiliza \\toprule, \\midrule y \\bottomrule de 'booktabs'.", rawLine);
        }
        
        // 4. Marcadores de posición pendientes
        if (/\[(?:Pendiente|PENDIENTE|TODO|Completar|Configure|PENDING)\]/i.test(line) || 
            /\[[^\]]*?pendiente[^\]]*?\]/i.test(line)) {
            logIssue("ERROR", filePath, lineNum, "Marcador de posición inconcluso o pendiente de verificación detectado.", rawLine);
        }
        
        // 5. Consistencia terminológica (R2): registrar keyterms
        const keytermRegex = /\\keyterm\{([^}]+)\}/g;
        let match;
        while ((match = keytermRegex.exec(line)) !== null) {
            const term = match[1].toLowerCase().trim();
            if (keytermsRegistry[term]) {
                const prev = keytermsRegistry[term];
                logIssue(
                    "WARNING", 
                    filePath, 
                    lineNum, 
                    `Término "${match[1]}" definido con \\keyterm{} múltiples veces. Ya se definió en ${path.relative(rootDir, prev.file)} línea ${prev.line}. Solo la primera ocurrencia debe usar \\keyterm{}.`, 
                    rawLine
                );
            } else {
                keytermsRegistry[term] = { file: filePath, line: lineNum };
            }
        }
        
        // 6. Contigüidad Espacial (D2)
        if (line.includes("\\begin{figure}")) {
            inFigure = true;
            figureStartLine = lineNum;
            
            // Buscar hacia atrás en las últimas 15 líneas
            let foundRef = false;
            const lookbackLimit = Math.max(0, i - 15);
            for (let j = i - 1; j >= lookbackLimit; j--) {
                const prevLine = lines[j].replace(/(^|[^\\])%.*$/, '$1'); // Quitar comentarios
                if (prevLine.includes("\\ref{fig:") || prevLine.includes("Figura~\\ref") || prevLine.toLowerCase().includes("figura")) {
                    foundRef = true;
                    break;
                }
            }
            if (!foundRef) {
                logIssue(
                    "WARNING", 
                    filePath, 
                    lineNum, 
                    "Principio de Contigüidad Espacial (D2): No se encontró una referencia a esta figura (\\ref{fig:...} o 'Figura') en los párrafos inmediatamente precedentes."
                );
            }
        }
    }
    
    return content;
}

// Validador específico para 01-introduccion.tex
function validateIntroduction(filePath) {
    if (!fs.existsSync(filePath)) return;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Comprobar elementos estructurales
    const checks = [
        { pattern: /\\chapter\{/, name: "\\chapter{...}" },
        { pattern: /\\guidesection\{/, name: "\\guidesection{...}" },
        { pattern: /\\editorialtitle\{/, name: "\\editorialtitle{...}{...}" },
        { pattern: /\\conceptline\{/, name: "\\conceptline{...}" },
        { pattern: /\\coursemeta\{/, name: "\\coursemeta{...}" },
        { pattern: /\\begin\{softblock\}/, name: "entorno softblock" }
    ];
    
    checks.forEach(check => {
        if (!check.pattern.test(content)) {
            logIssue("ERROR", filePath, 1, `Estructura incompleta: Falta el elemento obligatorio "${check.name}" en la introducción.`);
        }
    });
    
    // Alertas por listas de RA
    if (/\\begin\{itemize\}/.test(content) && (content.includes("resultado") || content.includes("objetivo"))) {
        logIssue("WARNING", filePath, 1, "La introducción no debe listar explícitamente los resultados de aprendizaje o temas en viñetas. Deben redactarse en prosa.");
    }
}

// Flujo Principal
console.log(`${colors.bold}${colors.cyan}Iniciando análisis estático (linting) de la guía LaTeX...${colors.reset}`);

// 1. Lint del archivo principal
const mainContent = lintFile(absMainPath);

// 2. Buscar archivos importados vía \input y analizarlos en orden
const inputs = [];
const inputRegex = /\\input\{([^}]+)\}/g;
let match;
while ((match = inputRegex.exec(mainContent)) !== null) {
    inputs.push(match[1]);
}

inputs.forEach(inputName => {
    // Resolver ruta del input. Aceptar si tiene o no extensión .tex
    let inputPath = path.join(rootDir, inputName);
    if (!inputPath.endsWith('.tex')) {
        inputPath += '.tex';
    }
    
    console.log(`${colors.cyan}Analizando archivo importado: ${inputName}...${colors.reset}`);
    lintFile(inputPath);
    
    // Si es la introducción, validar su estructura
    if (inputName.includes('introduccion')) {
        validateIntroduction(inputPath);
    }
});

console.log("\n------------------------------------------------");
if (totalErrors > 0 || totalWarnings > 0) {
    console.log(`${colors.bold}Resultados del Linter:${colors.reset}`);
    if (totalErrors > 0) {
        console.log(`  - ${colors.red}${totalErrors} error(es)${colors.reset} (deben corregirse obligatoriamente)`);
    }
    if (totalWarnings > 0) {
        console.log(`  - ${colors.yellow}${totalWarnings} advertencia(s)${colors.reset} (sugerencias de estilo/mejora)`);
    }
} else {
    console.log(`${colors.green}${colors.bold}¡Excelente! No se encontraron infracciones de estilo ni errores en la guía LaTeX.${colors.reset}`);
}
console.log("------------------------------------------------\n");

// Retorna código 1 si hay ERRORES críticos de política editorial
if (totalErrors > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
