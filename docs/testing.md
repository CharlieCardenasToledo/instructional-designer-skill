# Pruebas

## Aplicación Desktop

```bash
cd app/desktop
npm test
npm run build
```

## Skill y toolchain

```bash
npm --prefix skill test
node --check skill/bin/jintia.js
node --check skill/scripts/rules-runner.js
node --check skill/scripts/state-manager.js
node --check skill/scripts/hook-runner.js
```

La matriz visual de GitHub Actions valida los motores reales en Ubuntu, macOS
y Windows. Si Windows falla durante la instalación de MiKTeX, el fallo ocurre
antes de las pruebas de la skill y debe distinguirse de un error del código.
