# Política de privacidad

## Resumen

Jintia Desktop no incorpora telemetría, publicidad ni un
backend propio. La aplicación no transfiere información a otros sistemas de
red salvo cuando la persona que instala u opera el programa solicita
explícitamente una función que requiere esa comunicación.

## Datos locales

La aplicación almacena localmente:

- estado del onboarding y preferencias;
- configuración institucional;
- referencias de cursos y notebooks;
- cursos visibles en el panel;
- rutas de instalación y exportación;
- archivos académicos creados por el usuario.

El usuario controla las carpetas de cursos y los ZIP exportados. Un ZIP de la
skill puede incluir `institution.json` y `notebooks.json`; debe revisarse antes
de compartirlo.

## Operaciones de red solicitadas por el usuario

La aplicación puede acceder a servicios externos cuando el usuario:

- autentica o consulta NotebookLM mediante
  `@charlie.act7/gemini-notebook-mcp`;
- solicita extraer colores desde un sitio web institucional;
- autoriza la instalación de dependencias mediante el gestor del sistema;
- descarga una actualización o instalador desde GitHub;
- sube una skill exportada a un servicio de Claude.

NotebookLM y Google procesan las consultas conforme a sus propias condiciones
y políticas. Los gestores de paquetes, GitHub y Claude aplican igualmente sus
políticas al uso de sus servicios.

## Información académica

La aplicación no sube automáticamente sílabos, guías, datos de estudiantes ni
carpetas de cursos. Una consulta realizada deliberadamente a NotebookLM puede
incluir el texto que el usuario o el agente decida enviar.

No deben almacenarse datos sensibles de estudiantes en configuraciones,
fixtures, issues o ZIP compartidos.

## Conservación y eliminación

El proyecto no conserva copias en un servidor propio. Los datos permanecen en
el equipo, en las carpetas elegidas por el usuario o en los servicios externos
que este haya utilizado. Pueden eliminarse desde la aplicación, borrando la
configuración local o retirando las carpetas correspondientes.

## Contacto

Para consultas de privacidad o seguridad, escribe a
[charlie.act7@gmail.com](mailto:charlie.act7@gmail.com).
