# setup-docker.ps1 — Construir imagen Docker para compilación LaTeX
# Uso: .\setup-docker.ps1

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║ Instructional Designer Manager — Configuración Docker LaTeX║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Detectar Docker
$dockerCheck = try { docker --version 2>$null } catch { $null }

if (-not $dockerCheck) {
    Write-Host "❌ Docker no está instalado o no está en PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Opciones:" -ForegroundColor Yellow
    Write-Host "  1. Instala Docker Desktop: https://www.docker.com/products/docker-desktop"
    Write-Host "  2. O usa WSL2 con pdflatex instalado (fallback automático)"
    Write-Host ""
    Write-Host "Si instalas Docker después, ejecuta este script de nuevo."
    exit 1
}

Write-Host "✓ Docker detectado: $dockerCheck" -ForegroundColor Green
Write-Host ""

# Construir imagen
Write-Host "🔨 Construyendo imagen Docker 'ids-texlive:latest'..." -ForegroundColor Cyan
Write-Host "   (Primera vez: 2-5 minutos, tamaño final: ~700 MB)" -ForegroundColor Gray
Write-Host ""

$dockerfilePath = Join-Path (Get-Location) "Dockerfile"
if (-not (Test-Path $dockerfilePath)) {
    Write-Host "❌ Dockerfile no encontrado en $(Get-Location)" -ForegroundColor Red
    exit 1
}

docker build -t ids-texlive:latest -f "$dockerfilePath" .

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Imagen Docker construida exitosamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ahora puedes usar la app. Las compilaciones LaTeX usarán Docker automáticamente." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Error al construir imagen Docker" -ForegroundColor Red
    Write-Host "Intenta ejecutar: docker build -t ids-texlive:latest -f Dockerfile ." -ForegroundColor Yellow
    exit 1
}
