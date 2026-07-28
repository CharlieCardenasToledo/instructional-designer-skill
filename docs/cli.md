# CLI de Jintia

La skill incluye una interfaz determinista para usar la toolchain sin depender
de una conversación con un agente. Desde la carpeta de la skill:

```bash
npx jintia doctor
npx jintia harness status --project ./mi-curso --providers=claude,codex,cursor
npx jintia harness install --project ./mi-curso --scope=project --providers=claude,codex --yes
npx jintia init ./mi-curso --code IFT200 --name "Mi curso"
npx jintia syllabus validate ./mi-curso/README.md
npx jintia audit ./mi-curso/README.md --json
npx jintia validate semanas/semana-03/latex/guia-semana-03.tex
npx jintia compile semanas/semana-03/latex/guia-semana-03.tex
```

La CLI orquesta scripts existentes. Cada comando devuelve un código distinto
de cero cuando encuentra errores que deben bloquear el flujo.

## Operaciones visuales y estado

```bash
npx jintia visual render figure/specs/fig-id.json --template elegantbook-clasico
npx jintia visual inspect figure/manifest.json
npx jintia state update ./curso 03 compiled ./curso/semanas/semana-03/README.md
npx jintia context init ./curso
npx jintia context validate ./curso --json
npx jintia agents plan guide --json
npx jintia hook install ./curso
```

Los reportes de `audit` admiten `--json` para integraciones de Desktop, CI y
editores. Todos los comandos de la CLI admiten ahora `--json` y devuelven el
contrato `1.0.0` con `command`, `target`, `status`, `exitCode`, `checks`,
`artifacts`, `warnings` y `errors`. Cuando el comando produce un reporte propio,
se conserva dentro de `data`.

`JINTIA.md` es un contexto duradero opcional. Conserva decisiones de curso,
pedagogía y estilo editorial sin reemplazar el `README.md` canónico.
