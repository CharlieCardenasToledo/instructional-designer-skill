# Dockerfile: TeX Live minimal para compilación LaTeX en contenedor
# Base: Alpine Linux (~150 MB) + TeX Live minimal (~500 MB compressed)
# Tamaño final imagen: ~650-700 MB (comprimido)

FROM alpine:3.19

RUN apk update && apk add --no-cache \
    texlive-latex \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-lang-spanish \
    texlive-bibtex \
    biber \
    bash \
    && rm -rf /var/cache/apk/*

# Directorio de trabajo
WORKDIR /workspace

# Comando por defecto: mantener contenedor vivo
CMD ["bash"]
