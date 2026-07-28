# Contribuir

Gracias por mejorar Jintia. El repositorio combina una
aplicación de escritorio y una skill; los cambios deben mantener ambos
contratos sincronizados.

## Preparar el entorno

```bash
git clone https://github.com/CharlieCardenasToledo/instructional-designer-skill.git
cd instructional-designer-skill/app/desktop
npm ci
npm test
```

Se requiere Node.js `^20.19.0` o `>=22.12.0` y Rust estable para ejecutar
Tauri. Consulta [app/desktop/README.md](app/desktop/README.md).

## Antes de proponer cambios

1. Abre o relaciona un issue.
2. Mantén separados los cambios de `app/desktop/` y `skill/` cuando no formen
   parte del mismo contrato.
3. No agregues configuraciones institucionales reales, ids de notebooks,
   cookies, tokens ni PDFs con restricciones.
4. Actualiza las versiones en todos los manifiestos cuando corresponda.
5. Agrega una entrada bajo `Sin publicar` en `CHANGELOG.md`.

## Validación

Desde `app/desktop/`:

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Valida la skill:

```bash
python -X utf8 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skill
```

La última ruta depende de la instalación de Codex. Si el validador no está
disponible, comprueba al menos el frontmatter, los enlaces y los archivos
referenciados por `SKILL.md`.

## Documentación

- `README.md` es la portada canónica en español.
- `README.en.md` debe conservar la misma información funcional.
- `app/desktop/README.md` es documentación para mantenedores.
- Los Markdown dentro de `skill/` forman parte del payload y no son notas
  auxiliares.

Usa español claro para la documentación principal. Evita prometer capacidades
que no estén implementadas o identificadas explícitamente como futuras.

## Pull requests

Describe el problema, la solución, las pruebas ejecutadas y cualquier cambio
visual. Incluye capturas Full HD cuando modifiques una pantalla. No combines
refactors no relacionados.
