# Instalador opcional para Windows 10/11.
# La aplicación Tauri es el flujo recomendado: valida cada dependencia y pide
# confirmación antes de instalar componentes del sistema. Este script solo
# prepara Node.js y Git para quien prefiera una terminal.
[CmdletBinding()]
param([switch]$Install)

$ErrorActionPreference = 'Stop'
$skillDir = Join-Path $env:USERPROFILE '.claude\skills\instructional-designer-skill'

function Test-Tool([string]$name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
function Show-Status([string]$name, [string]$command) {
    if (Test-Tool $command) { Write-Host "[OK] ${name}: $(& $command --version 2>&1 | Select-Object -First 1)" -ForegroundColor Green }
    else { Write-Host "[--] ${name} no está instalado" -ForegroundColor Yellow }
}

Write-Host "Instructional Designer Skill - preparación del entorno" -ForegroundColor Cyan
Write-Host "No requiere privilegios de administrador. No instala TeX Live automáticamente."
Show-Status 'Node.js' 'node'
Show-Status 'npm' 'npm'
Show-Status 'Git' 'git'
Show-Status 'Python' 'python'

if ($Install) {
    if (-not (Test-Tool 'winget')) { throw 'winget no está disponible. Instala App Installer desde Microsoft Store o usa la aplicación Tauri.' }
    foreach ($package in @('OpenJS.NodeJS.LTS','Git.Git')) {
        & winget install --id $package --exact --source winget --accept-source-agreements --accept-package-agreements
        if ($LASTEXITCODE -ne 0) { throw "winget no pudo instalar $package (código $LASTEXITCODE)." }
    }
    Write-Host 'Reabre la terminal para actualizar PATH y vuelve a ejecutar el verificador.' -ForegroundColor Green
}

if (Test-Path (Join-Path $PSScriptRoot 'desktop-manager')) {
    Write-Host "El instalador de escritorio está en $PSScriptRoot\desktop-manager" -ForegroundColor Gray
    Write-Host 'Ejecuta npm install y npm run tauri:dev solo para desarrollo.' -ForegroundColor Gray
}

Write-Host "`nSiguiente paso recomendado: abre la aplicación y completa el onboarding secuencial." -ForegroundColor Cyan
Write-Host "Skill destino: $skillDir" -ForegroundColor Gray
