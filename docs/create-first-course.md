# Tu primer curso

Esta guía crea un curso desde cero con sílabo, configuración institucional
y primera guía semanal.

## 1. Inicializar el proyecto

```bash
mkdir mi-curso && cd mi-curso
npx @charlie.act7/jintia init . --code IFT200 --name "Fundamentos de Bases de Datos"
```

Esto genera la estructura base:

```
mi-curso/
├── README.md              ← sílabo canónico
├── JINTIA.md              ← decisiones pedagógicas del curso
├── reference.bib          ← bibliografía BibTeX
├── semanas/               ← una carpeta por semana
└── figures/               ← imágenes y especificaciones visuales
```

## 2. Completar el sílabo

Edita `README.md` con la información del curso. El sílabo debe incluir al menos:

- Datos del curso (código, nombre, créditos, modalidad)
- Resultado de aprendizaje general
- Unidades con resultados por semana
- Bibliografía con claves BibTeX

Valida el sílabo:

```bash
npx @charlie.act7/jintia audit README.md
```

## 3. Configurar la institución

Edita `skill/config/institution.json`:

```json
{
  "schemaVersion": 1,
  "institution": {
    "name": "Universidad Internacional del Ecuador",
    "website": "https://www.uide.edu.ec/",
    "faculty": "Facultad de Ingeniería",
    "career": "Ingeniería de Software",
    "author": "Charlie Cárdenas Toledo",
    "degree": "Mgtr."
  },
  "branding": {
    "primaryColor": "#00796B",
    "logoPath": "assets/logo.png"
  },
  "activeTemplate": "jintia-clasico",
  "options": {
    "evidenceMode": "notebooklm-preferred"
  }
}
```

## 4. Configurar NotebookLM (opcional)

```bash
npx @charlie.act7/jintia doctor
```

El doctor guía la autenticación con Google y el registro del notebook del curso.

## 5. Generar la primera guía

```
/jintia guía semana 1
```

O desde la CLI:

```bash
npx @charlie.act7/jintia render semanas/semana-01/guide.json
npx @charlie.act7/jintia compile semanas/semana-01/guide.json
```

El PDF queda en `semanas/semana-01/guide.pdf`.

## JINTIA.md

Usa `JINTIA.md` para decisiones duraderas de pedagogía y estilo editorial del
curso. No reemplaza al sílabo; lo complementa con contexto que Jíntia consulta
en cada sesión.
