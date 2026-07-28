# Gestión de harnesses

Usar `jintia detect` para una inspección rápida y `jintia harness status` para
conocer la versión y el estado de la skill en alcance de proyecto y global.

Antes de mutar, mostrar los proveedores y el alcance. Las operaciones de
instalación, actualización, reparación y desinstalación requieren `--yes`.
No eliminar ni reemplazar una carpeta que no contenga
`.jintia-install.json`.

Después de una mutación, ejecutar `jintia harness status --json` y reportar la
ruta, la versión y el estado final de cada proveedor.
