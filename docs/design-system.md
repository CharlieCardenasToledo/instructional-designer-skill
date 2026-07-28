# Sistema visual de Jintia

Este documento define las decisiones visuales compartidas por Jintia Desktop.
La interfaz sigue el principio de **contenido sólido, controles flotantes**:
el material Liquid Glass se reserva para navegación, barras, selectores y
acciones que flotan sobre el contenido.

## Identidad

- Nombre: **Jintia**
- Lema: **Diseña el camino del aprendizaje.**
- Autor y mantenedor: **Charlie Cárdenas Toledo**
- Símbolo: una ruta continua con nodos; representa conexión y recorrido, no
  un laberinto.

## Color

| Token | Valor | Uso |
| --- | --- | --- |
| `brand` | `#0f766e` | Acción principal, foco e identidad |
| `mint` | `#ccfbf1` | Estados suaves y selección |
| `ink` | `#0f172a` | Texto principal |
| `mist` | `#eef3f5` | Fondo de aplicación |
| `paper` | `#ffffff` | Tarjetas, formularios y contenido |

La interfaz debe conservar contraste suficiente en todos los fondos. Los
estados no pueden depender solo del color.

## Liquid Glass

- Se permite en la barra superior, grupos de controles de ventana, navegación
  secundaria flotante, cápsulas de acción y selectores.
- Debe combinar desenfoque y saturación del fondo con bordes e iluminaciones
  internas; una transparencia plana no es suficiente.
- Las tarjetas, tablas, formularios, contenido académico, textos legales y
  paneles de configuración permanecen opacos.
- Los radios concéntricos de una cápsula interior deben respetar el contenedor.
- Con `prefers-reduced-transparency`, el control utiliza una superficie opaca.
- Con `prefers-reduced-motion`, no se usan transiciones de desplazamiento ni
  transformaciones decorativas.

## Tipografía e iconos

La interfaz usa Inter con una pila de sistema como respaldo. Material Symbols
y Lucide se usan como vocabularios de iconos. Todo botón de icono necesita
nombre accesible mediante `aria-label` o texto visible.

## Foco y navegación

Todos los elementos interactivos deben mostrar `focus-visible` con un contorno
de al menos 2 px. El orden del teclado debe coincidir con el orden visual. Los
enlaces externos se abren mediante la capa segura de Tauri y solo hacia las
URLs autorizadas.
