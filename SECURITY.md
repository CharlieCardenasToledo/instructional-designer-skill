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

- La skill escribe únicamente en el proyecto y las rutas autorizadas por el usuario.
- NotebookLM MCP autentica y consulta servicios externos de Google.
- npm, Python, LaTeX y los motores visuales opcionales son dependencias externas.
- Los proyectos y ZIP que el usuario prepare pueden incluir configuración
  institucional y referencias de notebooks.

Revisa los ZIP antes de compartirlos y conserva secretos fuera del
repositorio.

Los problemas de seguridad exclusivos de la aplicación deben reportarse en
[`jintia-desktop`](https://github.com/CharlieCardenasToledo/jintia-desktop/security).
