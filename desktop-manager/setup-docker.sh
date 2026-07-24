#!/bin/bash
# setup-docker.sh — Construir imagen Docker para compilación LaTeX
# Uso: bash setup-docker.sh

echo "╔════════════════════════════════════════════════════════════╗"
echo "║ Instructional Designer Manager — Configuración Docker LaTeX║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Detectar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado o no está en PATH"
    echo ""
    echo "Opciones:"
    echo "  1. Instala Docker Desktop: https://www.docker.com/products/docker-desktop"
    echo "  2. O usa pdflatex nativo (fallback automático)"
    echo ""
    echo "Si instalas Docker después, ejecuta este script de nuevo."
    exit 1
fi

DOCKER_VERSION=$(docker --version)
echo "✓ Docker detectado: $DOCKER_VERSION"
echo ""

# Construir imagen
echo "🔨 Construyendo imagen Docker 'ids-texlive:latest'..."
echo "   (Primera vez: 2-5 minutos, tamaño final: ~700 MB)"
echo ""

DOCKERFILE_PATH="$(dirname "$0")/Dockerfile"
if [ ! -f "$DOCKERFILE_PATH" ]; then
    echo "❌ Dockerfile no encontrado en $(dirname "$0")"
    exit 1
fi

docker build -t ids-texlive:latest -f "$DOCKERFILE_PATH" .

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Imagen Docker construida exitosamente"
    echo ""
    echo "Ahora puedes usar la app. Las compilaciones LaTeX usarán Docker automáticamente."
else
    echo ""
    echo "❌ Error al construir imagen Docker"
    echo "Intenta ejecutar: docker build -t ids-texlive:latest -f Dockerfile ."
    exit 1
fi
