# `/jintia compile`

Renderiza una guía a HTML y genera PDF usando Vivliostyle CLI.
Vivliostyle se invoca como **proceso externo e independiente** (no importado),
lo que preserva la licencia MIT de Jintia.

## Requisitos

- Node.js ≥22.12.0
- Vivliostyle CLI instalado: `npm install --global @vivliostyle/cli`

## Ejemplos

```bash
# Compilar con motor por defecto (Vivliostyle)
node "<skill-root>/bin/jintia.js" compile semanas/semana-03/guide.json

# Compilar con Paged.js (MIT, no requiere Vivliostyle)
node "<skill-root>/bin/jintia.js" compile semanas/semana-03/guide.json --engine pagedjs

# Especificar salida
node "<skill-root>/bin/jintia.js" compile semanas/semana-03/guide.json --output semanas/semana-03/guia-semana-03.pdf
```

## Flujo completo recomendado

```bash
jintia validate guide.json        # linter pedagógico
jintia render   guide.json        # genera guide.html
jintia compile  guide.json        # genera guide.pdf
jintia preflight guide.pdf        # verifica paginación
```
