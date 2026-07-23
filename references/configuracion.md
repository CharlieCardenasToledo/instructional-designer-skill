# Configuración del usuario

Leer esta referencia cuando una tarea dependa de identidad institucional, branding, ecosistema digital, notebooks o plantilla activa.

## Archivos

- `config/institution.json`: identidad, marca, integraciones y opciones.
- `config/notebooks.json`: asociación entre cursos y notebooks.
- `config/*.example.json`: ejemplos distribuibles; no contienen datos reales.
- `config/*.schema.json`: contratos para validar ambos archivos.

La aplicación de escritorio crea los archivos reales. Una actualización debe preservarlos. No guardar datos del usuario en `SKILL.md`, `references/` ni `templates/`.

## Configuración institucional

Campos principales:

```json
{
  "schemaVersion": 1,
  "institution": {
    "name": "Universidad Ejemplo",
    "faculty": "Facultad de Ingeniería",
    "career": "Ingeniería de Software",
    "author": "Ana López",
    "degree": "Mgtr."
  },
  "branding": {
    "primaryColor": "#00796B",
    "logoPath": "figure/logo-institution.png"
  },
  "digitalEcosystem": ["Canvas LMS", "Sistema académico"],
  "integrations": {
    "partnerName": "",
    "partnerModule": "",
    "partnerLogoPath": ""
  },
  "activeTemplate": "elegantbook-clasico",
  "options": {
    "evidenceMode": "notebooklm-preferred",
    "includeGradedActivities": false
  }
}
```

Convertir `branding.primaryColor` hexadecimal a RGB cuando se genere LaTeX. Si no existe logo, omitir `\logo{}`. No inventar integraciones.

## Registro de notebooks

```json
{
  "schemaVersion": 1,
  "courses": [
    {
      "courseCode": "IFT200",
      "courseName": "Interacción Persona Computador",
      "rootPath": "01 IFT200",
      "notebookId": "",
      "notebookUrl": "https://notebooklm.google.com/notebook/..."
    }
  ]
}
```

Los ids pertenecen a la biblioteca local de `notebooklm-mcp`. Si un id deja de existir, buscar por nombre. Antes de registrar una URL con `add_notebook`, pedir confirmación.

## Plantilla activa

Leer `templates/<activeTemplate>/meta.json`, `template.md` y `preamble.tex`. Si el id es inválido, usar `elegantbook-clasico` e informar la corrección.

La plantilla define la gramática visual. Las reglas pedagógicas y de evidencia siguen siendo las de `SKILL.md`.
