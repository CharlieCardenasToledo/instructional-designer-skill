# Solicitud a SignPath Foundation

Este documento reúne la información verificable para completar personalmente
la solicitud en <https://signpath.org/apply>.

## Datos del proyecto

| Campo | Valor |
|---|---|
| Project name | Instructional Designer |
| Repository | `https://github.com/CharlieCardenasToledo/instructional-designer-skill` |
| Download page | `https://github.com/CharlieCardenasToledo/instructional-designer-skill/releases` |
| License | MIT |
| Maintainer | Charlie Cárdenas Toledo |
| Platform | Windows 10/11 x64 |
| Artifacts | NSIS EXE and Windows Installer MSI |
| Build system | GitHub Actions, GitHub-hosted `windows-latest` runner |
| Workflow | `.github/workflows/release-windows.yml` |

## Descripción breve

Instructional Designer is an open-source desktop application and agent skill
that configures an evidence-based instructional-design workflow for higher
education. The Windows application installs or exports the skill, manages
institutional settings and course structures, configures NotebookLM MCP, and
supports local LaTeX validation and PDF generation.

## Enlaces requeridos

- [Code signing policy](../CODE_SIGNING_POLICY.md)
- [Privacy policy](../PRIVACY.md)
- [Security policy](../SECURITY.md)
- [Build workflow](../.github/workflows/release-windows.yml)
- [Latest release](https://github.com/CharlieCardenasToledo/instructional-designer-skill/releases/latest)

## Declaraciones

- Todo el código propiedad del proyecto está publicado bajo MIT.
- No existe dual licensing comercial.
- El proyecto no contiene funciones de explotación o evasión de seguridad.
- La aplicación anuncia instalaciones y solicita confirmación antes de
  modificar herramientas del sistema.
- El instalador ofrece desinstalación mediante los mecanismos estándar de
  Windows.
- Los datos de red se describen en `PRIVACY.md`.
- Cada solicitud de firma tendrá aprobación manual.
- Solo se firmarán artifacts originados en GitHub Actions.

## Acciones personales antes de enviar

- [ ] Confirmar que la cuenta GitHub tiene 2FA habilitado.
- [ ] Leer y aceptar personalmente los términos de SignPath Foundation.
- [ ] Abrir `https://signpath.org/apply`.
- [ ] Completar los datos de contacto que solicite el formulario.
- [ ] Enviar los enlaces de política, privacidad, repositorio y releases.
- [ ] Conservar el correo de aprobación y las instrucciones de onboarding.

## Datos que llegarán después de la aprobación

No deben inventarse ni publicarse:

- `SIGNPATH_API_TOKEN`: secreto de GitHub;
- `SIGNPATH_ORGANIZATION_ID`: variable de GitHub;
- `SIGNPATH_PROJECT_SLUG`: variable de GitHub;
- `SIGNPATH_SIGNING_POLICY_SLUG`: variable de GitHub.

Cuando SignPath los entregue, configura las variables, instala la GitHub App,
define el artifact configuration para EXE/MSI y activa
`SIGNPATH_ENABLED=true`.
