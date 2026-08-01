# Publicar Jintia Skill

1. Sincroniza la versión en `skill/package.json`, los manifiestos Claude/OpenAI,
   `package.json` y `CHANGELOG.md`.
2. Revisa `release/release-config.json`, especialmente la versión MCP y la
   versión mínima compatible de Desktop.
3. Ejecuta:

   ```bash
   npm ci
   npm run docs:check
   npm run skill:check
   npm run release:check
   npm run release:skill
   npm run release:skill:check
   ```

4. Publica el tag de la skill:

   ```bash
   git tag -a vX.Y.Z -m "Jintia Skill X.Y.Z"
   git push origin vX.Y.Z
   ```

El workflow crea los ZIP desde blobs de Git, publica SHA256SUMS y genera
attestations. Después de publicar, actualiza `skill.lock.json` en
[`jintia-desktop`](https://github.com/CharlieCardenasToledo/jintia-desktop)
mediante un pull request independiente.
