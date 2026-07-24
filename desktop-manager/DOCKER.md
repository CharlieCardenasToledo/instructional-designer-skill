# Docker Setup — Compilación LaTeX en Contenedor

La app puede compilar PDFs usando Docker, WSL2, o pdflatex directo. **Docker es opcional pero recomendado** para evitar instalar TeX Live manualmente.

## ¿Por qué Docker?

- ✅ **Sin instalación manual**: No instales TeX Live ni pdflatex manualmente
- ✅ **Aislado**: Todo en contenedor, sin contaminar tu sistema
- ✅ **Reproducible**: Compilaciones idénticas en Windows/macOS/Linux
- ✅ **Fallback automático**: Si Docker no está, usa WSL (Windows) o pdflatex directo

## Instalación Rápida

### Windows 11

1. **Instala Docker Desktop**:
   ```powershell
   winget install Docker.DockerDesktop
   ```
   O descarga desde: https://www.docker.com/products/docker-desktop

2. **Habilita WSL 2** (Docker lo requiere):
   ```powershell
   wsl --set-default-version 2
   ```

3. **Construye imagen LaTeX** (ejecuta en terminal PowerShell):
   ```powershell
   cd .\desktop-manager
   .\setup-docker.ps1
   ```
   Espera 2-5 minutos en la primera construcción (~700 MB).

### macOS / Linux

1. **Instala Docker**:
   ```bash
   # macOS (Homebrew)
   brew install docker
   # O descarga Docker Desktop: https://www.docker.com/products/docker-desktop

   # Linux (Ubuntu/Debian)
   sudo apt install docker.io docker-compose
   ```

2. **Construye imagen LaTeX**:
   ```bash
   cd ./desktop-manager
   bash setup-docker.sh
   ```

## Uso

Una vez construida la imagen, la app **automáticamente**:

1. Detecta Docker disponible
2. Usa Docker para compilar LaTeX (si disponible)
3. Fallback a WSL (Windows) o pdflatex (macOS/Linux) si Docker no disponible

**No necesitas hacer nada especial** — funciona transparentemente.

## Troubleshooting

### "Docker no disponible" en Step 7

**Opción 1**: Instala Docker Desktop y ejecuta `setup-docker.ps1` / `setup-docker.sh`

**Opción 2**: Usa fallback WSL:
- Windows: Verifica WSL 2 + TeX Live instalado
- macOS/Linux: Instala pdflatex: `brew install basictex` o `apt install texlive-latex-base`

### "Imagen no encontrada" (Image not found)

Ejecuta setup script nuevamente:
```powershell
# Windows
.\setup-docker.ps1

# macOS/Linux
bash setup-docker.sh
```

### "Docker daemon not running"

Asegúrate que Docker Desktop está en ejecución:
- Windows: Abre Docker Desktop desde Start Menu
- macOS: Haz click en ícono Docker en menu bar
- Linux: `sudo systemctl start docker`

## Tamaño y Rendimiento

| Métrica | Valor |
|---------|-------|
| Imagen Docker (comprimida) | ~500-700 MB |
| Descargas adicionales | 0 (incluido en imagen) |
| Tiempo primera compilación | 2-3 segundos (overhead contenedor) |
| Compilaciones cacheadas | 1-2 segundos |
| RAM idle | Negligible (bajo demanda) |

## ¿Docker vs WSL vs pdflatex?

| Feature | Docker | WSL2 | pdflatex nativo |
|---------|--------|------|-----------------|
| Instalación | Simple (Docker Desktop) | Integrada (Windows) | Manual (apt/brew) |
| Aislamiento | Excelente | Bueno | Ninguno |
| Rendimiento | 2-3s compiled | 1-2s compiled | 1-2s compiled |
| Portabilidad | Windows/macOS/Linux | Solo Windows | Depende del OS |
| RAM overhead | 1.5-2.5 GB (Docker Desktop) | 1-2 GB (WSL) | Negligible |

**Recomendación**: Docker si quieres máxima compatibilidad y aislamiento. WSL si estás en Windows y ya lo tienes activo. pdflatex directo si ya lo instalaste.

---

Para más info: [Docker Docs](https://docs.docker.com/) | [TeX Live](https://www.tug.org/texlive/)
