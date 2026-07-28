# Solución de problemas

## El diagnóstico marca Biber ausente

Ejecuta `jintia doctor --json` y configura Biber junto con tu distribución LaTeX.
La compilación de bibliografía no debe ocultarse con un fallback inventado.

## La auditoría reporta una clave bibliográfica

Añade una entrada con la misma clave a `reference.bib` y vuelve a ejecutar
`jintia audit guia.tex`.

## Un hook bloquea la compilación

Lee el ID `JIN-*` y corrige el archivo señalado. Puedes ejecutar el reporte con
`--json` para conservarlo en CI.

## Windows falla antes de probar la skill

Comprueba el paso que falló. Errores de Chocolatey o MiKTeX pertenecen al
entorno del runner; errores en `Run visual tests` sí corresponden al código de
la skill.
