# Figuras TikZ — Paleta, Notación Chen y Exportación PNG

Referencia de la skill `instructional-designer-skill`. Leer cuando la tarea implique crear o editar diagramas TikZ, modelos ER o exportar figuras como PNG.

---

## Paleta de Colores de la Plantilla

Los diagramas **deben usar exclusivamente** estas variables semánticas. No usar colores hardcoded (`blue`, `green`, `#3A86FF`).

| Variable | Rol semántico | Uso típico |
|---|---|---|
| `weekaccent` | Color de acento institucional | Bordes de nodos principales, flechas de jerarquía |
| `weekaccentsoft` | Fondo suave del acento | Relleno de nodos destacados (`fill=weekaccentsoft`) |
| `mintline` | Verde operativo | Bordes de nodos de aplicación/transferencia |
| `mintbg` | Fondo verde suave | Relleno de nodos de aplicación |
| `slateline` | Gris técnico | Flechas secundarias, notas, etiquetas de puertos, textos de anotación |
| `softline` | Gris neutro | Bordes de contenedores o cajas de contexto (`titlebox`) |
| `softbg` | Fondo neutro | Relleno de contenedores agrupadores |
| `sandline` | Ámbar de advertencia | Bordes de nodos de datos, cilindros de BD |
| `sandbg` | Fondo ámbar suave | Relleno de nodos de advertencia o datos |

## Estructura obligatoria de figuras TikZ

```latex
\begin{figure}[H]
\centering
\begin{tikzpicture}[font=\sffamily\small, node distance=...]
  \tikzset{
    nodo/.style={draw=weekaccent, fill=weekaccentsoft, rounded corners=3pt, ...},
    svc/.style={draw=mintline, fill=mintbg, rounded corners=3pt, ...},
    db/.style={draw=sandline, fill=sandbg, cylinder, shape border rotate=90, ...},
    titlebox/.style={draw=softline, fill=softbg, rounded corners=3pt, ...},
    note/.style={align=center, text=slateline}
  }
  % Contenido del diagrama
\end{tikzpicture}
\caption{Descripción técnica de la relación representada.}
\label{fig:identificador_descriptivo}
\end{figure}
```

**PROHIBIDO:** Numerar figuras manualmente. El contador de LaTeX lo gestiona automáticamente.

## Referencias cruzadas a figuras — D2 (Spatial Contiguity, Mayer, effect size 1.10)

El párrafo que precede a una figura **debe terminar con referencia cruzada explícita**. Esto ancla el diagrama al argumento en el momento correcto y reduce la carga cognitiva de navegación.

```latex
% Al final del párrafo previo a la figura:
...como muestra la Figura~\ref{fig:identificador_descriptivo}.
```

**PROHIBIDO:** Insertar una figura sin que el párrafo previo la mencione explícitamente.

---

## Diagramas ER en Notación Chen (cursos de Bases de Datos)

Para figuras de modelo Entidad-Relación, usar los estilos y convenciones siguientes:

```latex
\tikzset{
  etype/.style={draw=weekaccent, fill=weekaccentsoft, rectangle,
                minimum width=2.5cm, minimum height=0.85cm,
                rounded corners=2pt, align=center, font=\sffamily\small\bfseries},
  attr/.style={draw=weekaccent, ellipse, minimum width=1.7cm,
               minimum height=0.58cm, align=center},
  attrm/.style={draw=weekaccent, double, ellipse, minimum width=1.7cm,
                minimum height=0.58cm, align=center},      % multivaluado
  attrd/.style={draw=weekaccent, dashed, ellipse, minimum width=1.7cm,
                minimum height=0.58cm, align=center},      % derivado
  comp/.style={draw=weekaccent, ellipse, minimum width=1.3cm,
               minimum height=0.52cm, align=center, font=\sffamily\scriptsize},
}
```

**Convenciones obligatorias:**
- Tipo de entidad → `etype` (rectángulo con `rounded corners=2pt`, nombre en MAYÚSCULAS).
- Atributo simple → `attr` (óvalo simple).
- Atributo multivaluado → `attrm` (óvalo doble — `double`).
- Atributo derivado → `attrd` (óvalo punteado — `dashed`).
- Atributo compuesto → nodo `attr` conectado a nodos `comp` (sub-óvalos).
- Atributo clave → nombre con `\underline{Nombre}` dentro del nodo `attr`.
- Usar **coordenadas absolutas** (no `node distance` relativo) para control preciso de separación.
- Separación mínima entre el centro de la entidad y sus atributos: 1.7–2.0 cm.

**Reglas de legibilidad y ancho:**
- Diseñar para que el ancho total del `tikzpicture` no supere ~15 cm, de modo que `\resizebox{\textwidth}{!}` aplique una escala ≥ 0.95 y el texto sea legible.
- Cuando el diagrama incluye múltiples entidades en línea (≥ 3), **omitir etiquetas de texto interior** (`lbl`) del tipo "clave", "multivaluado", "compuesto", "derivado". En su lugar, documentar la leyenda en el `\caption`. Esto reduce la anchura entre 4–6 cm.
- Si una etiqueta es imprescindible dentro de la figura, anclarla con `left=0.1cm of nodo` o `below=0.12cm of nodo` — nunca `above right` sobre nodos adyacentes.
- Para figuras con 1–2 entidades (sección aislada), las etiquetas internas sí son aceptables.

**Posiciones de referencia para diagramas de 3 entidades (sin etiquetas):**
```
ENTIDAD_A at (0,0) · ENTIDAD_B at (5.5,0) · ENTIDAD_C at (11.0,0)
Atributos laterales: ±1.8 cm del centro de entidad en x, ±1.2 cm en y
Atributo compuesto (arriba): y = +2.3 cm · sub-óvalos: y = +3.6 cm, x ± 0.8 cm
```

---

## Exportación de Figuras como PNG Standalone

Para generar imágenes PNG de alta resolución a partir de figuras TikZ:

Crear `latex/figures-png/fig-NOMBRE.tex` con:

```latex
\documentclass[border=10pt]{standalone}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{tikz}
\usetikzlibrary{arrows.meta,positioning,shapes.geometric,shapes.misc,fit,shadows,backgrounds,calc}
\usepackage{xcolor}

% Mismos colores que el documento principal
\definecolor{weekaccent}{RGB}{0,121,107}
\definecolor{weekaccentsoft}{RGB}{232,245,243}
\definecolor{softbg}{RGB}{250,251,253}
\definecolor{softline}{RGB}{212,220,230}
\definecolor{slateline}{RGB}{103,119,138}

\begin{document}
\begin{tikzpicture}[...]
  % Mismo código que en la sección correspondiente del documento principal
\end{tikzpicture}
\end{document}
```

Compilación y exportación (las reglas de rutas y comillas WSL están en `compilacion-wsl.md`):

```bash
wsl bash -c "cd '/mnt/d/Ruta/latex/figures-png' && pdflatex -interaction=nonstopmode fig-NOMBRE.tex"
wsl bash -c "cd '/mnt/d/Ruta/latex/figures-png' && pdftoppm -r 300 -png fig-NOMBRE.pdf fig-NOMBRE"
```

- El sufijo `-1` es automático: `pdftoppm` genera `fig-NOMBRE-1.png` para documentos de una página.
- Mantener los standalones sincronizados con el documento principal; si se edita una figura, actualizar también su standalone.
