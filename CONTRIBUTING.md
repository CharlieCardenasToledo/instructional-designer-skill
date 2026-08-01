# Contribuir

Este repositorio contiene Jintia Skill. Los cambios de la aplicación deben
proponerse en [`jintia-desktop`](https://github.com/CharlieCardenasToledo/jintia-desktop).

## Preparación

```bash
git clone https://github.com/CharlieCardenasToledo/instructional-designer-skill.git
cd instructional-designer-skill
npm ci
npm run skill:check
```

Se requiere Node.js 22.13 o superior. No agregues configuraciones
institucionales, credenciales, ids de notebooks ni documentos reales.

## Validación

```bash
npm run docs:check
npm run skill:check
npm run release:check
npm run release:skill
npm run release:skill:check
```

Describe en el pull request el problema, la solución y las pruebas ejecutadas.
Los cambios de `SKILL.md`, plantillas o contratos deben incluir pruebas de la
conducta modificada.
