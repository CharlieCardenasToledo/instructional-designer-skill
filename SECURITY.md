# Seguridad

## Versiones con soporte

Los reportes se evalúan sobre la última release publicada y la rama principal.

## Reportar una vulnerabilidad

No publiques credenciales, cookies, ids privados de NotebookLM, configuraciones
institucionales ni datos de estudiantes en un issue.

Envía el reporte a
[charlie.act7@gmail.com](mailto:charlie.act7@gmail.com) con el asunto
`[SECURITY] Jintia`.

Incluye la versión, plataforma, impacto, pasos mínimos de reproducción y una
propuesta de mitigación si la tienes.

## Límites de confianza

- La app escribe en rutas seleccionadas por el usuario y en su directorio de
  configuración.
- NotebookLM MCP autentica y consulta servicios externos de Google.
- La extracción de paleta solicita una URL institucional.
- `winget`, Homebrew, gestores de paquetes, npm y LaTeX son dependencias
  externas.
- Los ZIP exportados pueden incluir configuración institucional y referencias
  de notebooks.

Revisa los ZIP antes de compartirlos y conserva secretos fuera del
repositorio.

La respuesta específica ante uso indebido de firmas se encuentra en
[CODE_SIGNING_POLICY.md](CODE_SIGNING_POLICY.md).
