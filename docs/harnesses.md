# Detección de entornos de agentes

Jintia detecta harnesses por sus carpetas de configuración, no por el modelo
que ejecutan. La detección distingue alcance de proyecto y global, skills
existentes y soporte de hooks.

```bash
npx jintia detect . --json
npx jintia detect . --providers=claude,codex,cursor --json
```

La selección prioriza proveedores explícitos, luego carpetas del proyecto,
después carpetas globales y finalmente Claude Code y Codex como valores por
defecto. La detección es de solo lectura; instalar una skill o un hook requiere
una acción explícita.

## Estados y ciclo de vida

```bash
npx jintia harness status --project ./curso --providers=claude,codex,cursor --json
npx jintia harness install --project ./curso --scope=project --providers=claude,codex,cursor --yes
npx jintia harness update --project ./curso --scope=global --providers=claude,codex --yes
npx jintia harness repair --project ./curso --scope=project --providers=cursor --yes
npx jintia harness uninstall --project ./curso --scope=project --providers=cursor --yes
```

Los estados son `not-detected`, `detected`, `installed`, `outdated`,
`incomplete` y `repair-needed`. Las instalaciones gestionadas conservan
`.jintia-install.json` y `VERSION`; una ruta existente sin esa marca nunca se
sobrescribe. Las mutaciones requieren `--yes` y aceptan varios proveedores.
