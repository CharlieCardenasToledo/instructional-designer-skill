# ==============================================================================
# setup.ps1 — Instalador automático del Instructional Designer Skill
# Requisitos: Windows 10/11, PowerShell 5.1+ (ejecutar como Administrador)
# Uso: Clic derecho en setup.ps1 → "Ejecutar con PowerShell"
# ==============================================================================

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"   # más rápido sin barra de progreso

$SKILL_DIR = "$env:USERPROFILE\.claude\skills\instructional-designer-skill"
$LOG_FILE  = "$env:TEMP\ids-setup.log"

# ── Helpers ───────────────────────────────────────────────────────────────────
function Write-Step  { param($msg) Write-Host "`n[►] $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "    [✓] $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "    [!] $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "    [✗] $msg" -ForegroundColor Red }

function Test-Command { param($cmd) return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function Invoke-WithLog {
    param([scriptblock]$block)
    & $block 2>&1 | Tee-Object -FilePath $LOG_FILE -Append | Out-Null
}

# ── Banner ────────────────────────────────────────────────────────────────────
Clear-Host
Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║        Instructional Designer Skill — Setup v10.3            ║
║        Instalador automático para Windows 10/11              ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Magenta

Start-Transcript -Path $LOG_FILE -Append | Out-Null

# ── 1. Chocolatey ─────────────────────────────────────────────────────────────
Write-Step "Verificando Chocolatey (gestor de paquetes)..."
if (-not (Test-Command "choco")) {
    Write-Warn "Chocolatey no encontrado. Instalando..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Ok "Chocolatey instalado."
} else {
    Write-Ok "Chocolatey ya está instalado: $(choco --version)"
}

# ── 2. Git ────────────────────────────────────────────────────────────────────
Write-Step "Verificando Git..."
if (-not (Test-Command "git")) {
    Write-Warn "Git no encontrado. Instalando..."
    choco install git -y --no-progress | Out-Null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Ok "Git instalado: $(git --version)"
} else {
    Write-Ok "Git ya instalado: $(git --version)"
}

# ── 3. Node.js ────────────────────────────────────────────────────────────────
Write-Step "Verificando Node.js (>=18)..."
if (-not (Test-Command "node")) {
    Write-Warn "Node.js no encontrado. Instalando..."
    choco install nodejs-lts -y --no-progress | Out-Null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Ok "Node.js instalado: $(node --version)"
} else {
    $nodeVer = [int]((node --version) -replace 'v','').Split('.')[0]
    if ($nodeVer -lt 18) {
        Write-Warn "Node.js $nodeVer detectado, se requiere >=18. Actualizando..."
        choco upgrade nodejs-lts -y --no-progress | Out-Null
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    }
    Write-Ok "Node.js listo: $(node --version)"
}

# ── 4. Python 3 + PyMuPDF ─────────────────────────────────────────────────────
Write-Step "Verificando Python 3..."
if (-not (Test-Command "python")) {
    Write-Warn "Python no encontrado. Instalando..."
    choco install python3 -y --no-progress | Out-Null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Ok "Python instalado: $(python --version)"
} else {
    Write-Ok "Python ya instalado: $(python --version)"
}

Write-Warn "Instalando PyMuPDF (extractor de PDF)..."
python -m pip install --upgrade pip --quiet | Out-Null
python -m pip install pymupdf --quiet | Out-Null
Write-Ok "PyMuPDF instalado."

# ── 5. WSL 2 ─────────────────────────────────────────────────────────────────
Write-Step "Verificando WSL 2 (requerido para compilar LaTeX)..."
$wslStatus = wsl --status 2>&1
if ($LASTEXITCODE -ne 0 -or $wslStatus -match "no instalado") {
    Write-Warn "WSL no encontrado. Habilitando WSL 2 (requiere reinicio)..."
    wsl --install --no-distribution | Out-Null
    Write-Warn "WSL instalado. Se necesita REINICIAR el equipo."
    Write-Warn "Después del reinicio, ejecuta: wsl --install -d Ubuntu"
    Write-Warn "Luego vuelve a ejecutar este script para completar la instalación de TeX Live."
    $script:wslNeedsRestart = $true
} else {
    Write-Ok "WSL disponible."
    $script:wslNeedsRestart = $false
}

# ── 6. Ubuntu en WSL ──────────────────────────────────────────────────────────
if (-not $wslNeedsRestart) {
    Write-Step "Verificando distribución Linux en WSL..."
    $distros = wsl --list --quiet 2>&1 | Where-Object { $_ -match "Ubuntu|Debian" }
    if (-not $distros) {
        Write-Warn "Sin distribución Linux. Instalando Ubuntu..."
        wsl --install -d Ubuntu | Out-Null
        Write-Warn "Ubuntu instalado. Puede requerir reinicio si es primera vez."
    } else {
        Write-Ok "Distribución encontrada: $($distros[0])"
    }

    # ── 7. TeX Live vía WSL ───────────────────────────────────────────────────
    Write-Step "Verificando TeX Live en WSL (puede tardar 15-30 min si no está instalado)..."
    $texCheck = wsl bash -c "which pdflatex 2>/dev/null" 2>&1
    if (-not $texCheck) {
        Write-Warn "TeX Live no encontrado. Instalando texlive-full (~4GB)..."
        Write-Warn "Esto puede tardar entre 15 y 40 minutos dependiendo tu conexión."
        Write-Host "    [►] Actualizando repositorios..." -ForegroundColor Gray
        wsl bash -c "sudo apt-get update -qq" | Out-Null
        Write-Host "    [►] Instalando TeX Live completo..." -ForegroundColor Gray
        wsl bash -c "sudo apt-get install -y texlive-full 2>&1" | Out-Null
        $texCheck2 = wsl bash -c "which pdflatex 2>/dev/null" 2>&1
        if ($texCheck2) {
            Write-Ok "TeX Live instalado correctamente."
        } else {
            Write-Fail "TeX Live no se instaló. Revisa $LOG_FILE para detalles."
        }
    } else {
        Write-Ok "TeX Live ya instalado: $(wsl bash -c 'pdflatex --version 2>/dev/null | head -1')"
    }
}

# ── 8. Instalar el Skill ──────────────────────────────────────────────────────
Write-Step "Instalando el Instructional Designer Skill..."
$skillParent = "$env:USERPROFILE\.claude\skills"

if (-not (Test-Path $skillParent)) {
    New-Item -ItemType Directory -Force -Path $skillParent | Out-Null
}

if (Test-Path $SKILL_DIR) {
    Write-Warn "El skill ya existe en $SKILL_DIR"
    $update = Read-Host "    ¿Actualizar a la versión más reciente? (s/N)"
    if ($update -match "^[sS]") {
        Push-Location $SKILL_DIR
        git pull origin master | Out-Null
        Pop-Location
        Write-Ok "Skill actualizado."
    } else {
        Write-Ok "Skill sin cambios."
    }
} else {
    Write-Warn "Clonando repositorio del skill..."
    git clone https://github.com/CharlieCardenasToledo/instructional-designer-skill $SKILL_DIR | Out-Null
    Write-Ok "Skill instalado en: $SKILL_DIR"
}

# ── 9. Verificación final ─────────────────────────────────────────────────────
Write-Step "Verificación final del entorno..."
Write-Host ""

$checks = @(
    @{ name = "Git";      cmd = "git --version";           ok = (Test-Command "git") },
    @{ name = "Node.js";  cmd = "node --version";          ok = (Test-Command "node") },
    @{ name = "npm";      cmd = "npm --version";            ok = (Test-Command "npm") },
    @{ name = "Python";   cmd = "python --version";         ok = (Test-Command "python") },
    @{ name = "PyMuPDF";  cmd = "python -c 'import fitz'"; ok = $true },
    @{ name = "Skill";    cmd = "";                         ok = (Test-Path "$SKILL_DIR\SKILL.md") }
)

foreach ($c in $checks) {
    if ($c.ok) {
        if ($c.cmd) {
            $ver = (Invoke-Expression $c.cmd 2>&1 | Select-Object -First 1)
            Write-Ok "$($c.name): $ver"
        } else {
            Write-Ok "$($c.name): encontrado"
        }
    } else {
        Write-Fail "$($c.name): NO disponible"
    }
}

$pymupdfOk = python -c "import fitz; print('ok')" 2>&1
if ($pymupdfOk -eq "ok") { Write-Ok "PyMuPDF: disponible" } else { Write-Fail "PyMuPDF: error — $pymupdfOk" }

# ── 10. Resumen ───────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════════════════" -ForegroundColor Magenta

if ($wslNeedsRestart) {
    Write-Host @"

⚠  ACCIÓN REQUERIDA:
   Reinicia tu computadora para completar la instalación de WSL.
   Después del reinicio, ejecuta de nuevo este script para
   instalar TeX Live y finalizar la configuración.

"@ -ForegroundColor Yellow
} else {
    Write-Host @"

✓  Instalación completa.

Próximos pasos:
  1. Abre Claude Desktop o Claude Code
  2. El skill se detecta automáticamente desde:
     $SKILL_DIR
  3. Configura tu institución editando:
     $SKILL_DIR\references\plantilla-latex.md
     $SKILL_DIR\references\bibliografia.md
  4. Prueba escribiendo en Claude:
     /instructional-designer-skill

Log completo guardado en: $LOG_FILE

"@ -ForegroundColor Green
}

Stop-Transcript | Out-Null
Read-Host "Presiona Enter para cerrar"
