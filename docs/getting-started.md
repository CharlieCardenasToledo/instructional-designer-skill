# Primeros pasos

Jíntia es una skill para Claude Code que convierte sílabos y fuentes del curso
en guías didácticas semanales, exportadas como HTML y PDF A4.

## Requisitos

| Requisito | Versión mínima |
|---|---|
| [Claude Code](https://claude.ai/code) | Cualquier versión reciente |
| Node.js | 22.12.0 |
| Cuenta de Google | Para NotebookLM (opcional pero recomendado) |

PDF local requiere además [Vivliostyle CLI](https://vivliostyle.org/):

```bash
npm install -g @vivliostyle/cli
```

## Instalación

```bash
npx @charlie.act7/jintia install
```

El instalador:

1. Copia la skill en `~/.claude/skills/jintia-skill`
2. Registra los comandos en Claude Code
3. Configura el servidor MCP de NotebookLM si hay credenciales disponibles

## Actualización

```bash
npx @charlie.act7/jintia update
```

## Verificar la instalación

```bash
npx @charlie.act7/jintia doctor
```

La salida muestra el estado de Node.js, Vivliostyle CLI y los temas instalados.
Si algún elemento falta, el doctor indica cómo resolverlo.

## Primer uso

Una vez instalada, abre Claude Code en la carpeta de tu proyecto y escribe:

```
/jintia guía semana 1
```

Jíntia te pedirá el sílabo del curso y las fuentes bibliográficas antes de
generar la guía.
