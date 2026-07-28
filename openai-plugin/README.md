# Plugin universal de Jintia

Este directorio contiene los archivos fuente del plugin para ChatGPT y Codex.
La aplicación genera el paquete final incorporando `skill/` bajo
`skills/jintia-skill/`.

La instalación local:

1. prepara el plugin en `~/.codex/plugins/jintia`;
2. registra Jintia en `~/.agents/plugins/marketplace.json`;
3. conserva y sincroniza la configuración institucional y los notebooks;
4. requiere reiniciar ChatGPT y activar Jintia desde Plugins.

La exportación produce `jintia-openai-plugin-<versión>.zip`.

La publicación en el directorio universal público no se realiza
automáticamente. Requiere una cuenta elegible, revisión de los metadatos,
pruebas en las superficies admitidas y envío a OpenAI.
