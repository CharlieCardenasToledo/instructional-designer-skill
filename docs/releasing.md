# Publicar una versión

## Preparación

1. Mueve las entradas relevantes de `Sin publicar` a la nueva versión.
2. Sincroniza la versión pública de la skill, el plugin y la aplicación cuando
   corresponda.
3. Ejecuta desde `app/desktop/`:

   ```bash
   npm ci
   npm test
   npm run build
   cargo test --manifest-path src-tauri/Cargo.toml
   ```

4. Valida `skill/SKILL.md` y los esquemas JSON.
5. Comprueba los enlaces y las capturas del README.

## Publicación

Los workflows aceptan tags `v*`:

```bash
git tag v10.5.0
git push origin v10.5.0
```

- Windows publica NSIS `.exe` y MSI.
- macOS publica un DMG Apple Silicon.

Una ejecución manual mediante `workflow_dispatch` crea artifacts de Actions,
pero los pasos de GitHub Release solo se ejecutan para tags.

## Después de publicar

1. Comprueba que ambos jobs terminaron correctamente.
2. Descarga e instala cada artifact.
3. Verifica que los enlaces directos del README coincidan con los nombres
   publicados.
4. Añade notas de limitaciones conocidas.

El DMG actual no está firmado ni notarizado. No anuncies firma de código hasta
que el workflow la implemente y se haya verificado en un artifact publicado.
