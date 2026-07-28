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
