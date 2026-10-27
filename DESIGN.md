# Núcleo — plan de diseño

## Concepto

El reformer y el ritmo de la semana del estudio. En Núcleo cada clase tiene 6 reformers, y la interfaz los muestra tal cual: **6 carriles** dentro de cada bloque de clase, uno por reformer, que se ven ocupados o libres. La grilla semanal es la protagonista: un alumno abre la app y entiende la semana de un vistazo, sin leer números.

Trabajo de la página principal: que alguien encuentre un horario con lugar y lo reserve en pocos toques.

El prototipo `/antes` queda fuera de este plan: su estilo genérico (tarjetas iguales, degradado decorativo) es parte de la demostración.

## Tres principios

1. **El color es un estado.** Eucalipto es libre (y la acción principal), ámbar son los últimos 2 lugares, grafito es completa y rosa reformer es lo tuyo. Ningún color se usa como decoración. Si algo necesita destacar, se le da un estado, no una sombra.
2. **Los datos se leen como datos.** Horarios, cupos y montos van grandes, en cifras tabulares, alineados en columnas. La tipografía hace la jerarquía; no hay íconos de relleno ni etiquetas sobre cada título.
3. **Decir qué pasó.** Cada acción termina con una frase concreta: "Reservaste el jueves 18:00 con Lucía. Te queda 1 crédito". La regla de cancelación y el total se ven antes de pagar, y los errores dicen qué hacer ("La clase se llenó mientras elegías. Anotate en la lista de espera o elegí otro horario").

## Color

La paleta de partida del brief se mantiene. Se agregan las tintas (versiones oscuras para texto y bordes) y los fondos tenues de cada estado, porque el ámbar y el rosa no llegan a 3:1 sobre blanco como objeto gráfico: cada carril de esos colores lleva un borde con su tinta.

### Base

| Token        | Hex       | Uso                                                       | Contraste                            |
| ------------ | --------- | --------------------------------------------------------- | ------------------------------------ |
| `cal`        | `#F5F7F6` | fondo general                                             | —                                    |
| `superficie` | `#FFFFFF` | bloques de clase libres, paneles, campos                  | —                                    |
| `linea`      | `#D6DDDA` | bordes de 1 px, divisores                                 | —                                    |
| `grafito`    | `#1F2A33` | texto; clase completa                                     | 14,6:1 con blanco · 13,4:1 sobre cal |
| `grafito-2`  | `#55626B` | texto secundario                                          | 5,8:1 sobre cal                      |
| `ocupado`    | `#C4CCCF` | carril ocupado por otra persona                           | —                                    |
| `error`      | `#B3412F` | errores de formulario y desborde del prototipo en `/caso` | 5,6:1 con blanco                     |

### Estados

| Estado          | Color                 | Tinta                                                                  | Fondo tenue                 | Uso                                             |
| --------------- | --------------------- | ---------------------------------------------------------------------- | --------------------------- | ----------------------------------------------- |
| libre           | `eucalipto` `#2E5E4E` | blanco (7,4:1)                                                         | `eucalipto-tenue` `#E3EEE9` | carriles libres, botón principal, foco, enlaces |
| últimos lugares | `ambar` `#E0A339`     | `ambar-tinta` `#7A4E05` (6,1:1 sobre su fondo)                         | `ambar-tenue` `#F8EBD2`     | carriles libres cuando quedan 1 o 2; avisos     |
| completa        | `grafito` `#1F2A33`   | blanco                                                                 | —                           | bloque entero en grafito                        |
| tu reserva      | `rosa` `#E7B4A6`      | `rosa-tinta` `#8E4A3C` (6,6:1 con blanco; 3,6:1 sobre rosa como borde) | `rosa-tenue` `#F7E6E1`      | tu carril, tus reservas en "Mis reservas"       |

### Modo oscuro (panel de administración)

No es "casi negro con acento ácido": es el mismo grafito llevado a superficie, con el eucalipto aclarado lo justo para mantener contraste.

| Token             | Claro     | Oscuro    |
| ----------------- | --------- | --------- |
| `cal`             | `#F5F7F6` | `#121A1F` |
| `superficie`      | `#FFFFFF` | `#1A242B` |
| `linea`           | `#D6DDDA` | `#2C3942` |
| `grafito` (texto) | `#1F2A33` | `#E4EAE8` |
| `grafito-2`       | `#55626B` | `#9DABA6` |
| `eucalipto`       | `#2E5E4E` | `#74B59D` |
| `eucalipto-tenue` | `#E3EEE9` | `#1E3530` |
| `ambar-tenue`     | `#F8EBD2` | `#3A2E17` |
| `rosa-tenue`      | `#F7E6E1` | `#3B2824` |
| `ocupado`         | `#C4CCCF` | `#3B4851` |
| bloque completo   | `#1F2A33` | `#33414B` |

## Tipografía

Una sola familia, **Onest** (variable, 400–800, cifras tabulares con `tnum`), cargada con `next/font` y `display: swap` con métricas de fallback para no mover el layout.

| Rol                                | Tamaño / interlínea    | Peso        | Notas                                      |
| ---------------------------------- | ---------------------- | ----------- | ------------------------------------------ |
| titular (`/caso`, retorno de pago) | 40/44 (30/34 en móvil) | 750         | `letter-spacing: -0.02em`                  |
| título de página                   | 28/34                  | 700         |                                            |
| sección                            | 20/26                  | 650         |                                            |
| subtítulo                          | 17/24                  | 600         |                                            |
| cuerpo                             | 16/24                  | 400         |                                            |
| chico                              | 14/20                  | 450         | texto secundario                           |
| leyenda                            | 12/16                  | 550         | carriles, metadatos de tabla               |
| dato grande                        | 32/36                  | 650 tabular | hora en la reserva y en el retorno de pago |
| dato                               | 20/24                  | 650 tabular | hora en cada bloque de la grilla           |
| dato chico                         | 14/20                  | 600 tabular | cupos ("4 de 6"), montos en tablas         |

Sin mayúsculas sostenidas. Títulos y botones en mayúscula inicial y el resto en minúscula ("Tus próximas clases", "Cancelar reserva"), como los ejemplos del brief.

## Forma

- Espaciado de base 4 px. Gutter lateral de 16 px en móvil, 32 px en escritorio, ancho máximo 1200 px (1440 px en el panel).
- Radios: 6 px en bloques y paneles, 3 px en carriles, 8 px en botones. Nada de píldoras salvo las pestañas de días.
- **Sin sombras** en la app: los bloques se separan con borde de 1 px `linea` y fondo de estado. Los diálogos usan un borde y un velo `grafito` al 40 %.
- Botón principal: fondo `eucalipto`, texto blanco, 44 px de alto mínimo. Secundario: borde `linea`, texto `grafito`. Sin flechas en los botones.
- Foco visible: anillo de 2 px `eucalipto` con separación de 2 px, en todo lo interactivo.

## La firma: los carriles

Cada bloque de clase lleva 6 carriles verticales (un reformer visto desde arriba es un rectángulo largo). En la grilla miden 10 × 24 px; en la reserva, 40 × 120 px con el número de reformer debajo.

| Carril                             | Relleno                    | Borde                          |
| ---------------------------------- | -------------------------- | ------------------------------ |
| libre                              | `eucalipto-tenue`          | `eucalipto` 1,5 px             |
| libre con 1–2 lugares              | `ambar-tenue`              | `ambar` 1,5 px + `ambar-tinta` |
| ocupado                            | `ocupado`                  | ninguno                        |
| tuyo                               | `rosa`                     | `rosa-tinta` 1,5 px            |
| retenido para vos (pago pendiente) | rayado `rosa`/`rosa-tenue` | `rosa-tinta` punteado          |

Los carriles son decorativos para lectores de pantalla (`aria-hidden`), y el bloque tiene el texto completo: "jueves 30, 18:00, Reformer clásico con Lucía Ferreyra, 4 de 6 lugares ocupados".

**El momento memorable.** Al confirmar una reserva, tu carril se llena de abajo hacia arriba con `rosa` (500 ms, `ease-out`), el bloque pasa a `rosa-tenue` y aparece la frase "Reservaste el jueves 18:00 con Lucía. Te queda 1 crédito". Con `prefers-reduced-motion` el carril aparece lleno sin animación. Es la única animación de la app de alumnos.

**El segundo momento**, en `/caso`: los carriles de las dos columnas se llenan en vivo a medida que llegan las 20 respuestas. En producción se llenan 6 y el resto cae a una fila de espera numerada; en el prototipo los carriles 7 a 20 se salen del bloque en `error` y el borde del bloque se pone rojo.

## Layout

### Horarios — escritorio (≥ 1024 px)

Filas = horarios de la semana, columnas = días de lunes a sábado (domingo cerrado, se aclara debajo de la grilla). La primera columna lleva la hora como dato.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▮▮▮▮▮▮ núcleo          horarios   packs   mis reservas            entrar   │
├────────────────────────────────────────────────────────────────────────────┤
│ horarios de la semana                                                      │
│ 27 oct – 1 nov                                      [‹]  [esta semana]  [›] │
│ ■ libre  ■ últimos lugares  ■ completa  ■ tu reserva   hora de Buenos Aires │
├───────┬──────────┬──────────┬──────────┬──────────┬──────────┬────────────┤
│       │ lun 27   │ mar 28   │ mié 29   │ jue 30   │ vie 31   │ sáb 1      │
├───────┼──────────┼──────────┼──────────┼──────────┼──────────┼────────────┤
│ 07:00 │┌────────┐│┌────────┐│          │┌────────┐│┌────────┐│            │
│       ││base 2/6│││clás 6/6│││          ││        ││        ││            │
│       ││Tomás   │││Lucía   ││          ││        ││        ││            │
│       ││▯▯▯▯▮▮  │││▮▮▮▮▮▮  ││          ││        ││        ││            │
│       │└────────┘│└────────┘│          │└────────┘│└────────┘│            │
│ 08:15 │   …      │          │          │          │          │            │
│ 09:30 │          │          │          │          │          │ ┌────────┐ │
│ 12:30 │          │          │          │          │          │            │
│ 18:00 │          │          │          │          │          │            │
│ 19:15 │          │          │          │          │          │            │
│ 20:30 │          │          │          │          │          │            │
└───────┴──────────┴──────────┴──────────┴──────────┴──────────┴────────────┘
```

Bloque de la grilla (todo el bloque es el enlace a la reserva):

```
┌──────────────────┐
│ Reformer clásico │  17 px 600
│ Lucía F.     4/6 │  14 px; cupo tabular a la derecha
│ ▮ ▮ ▯ ▮ ▯ ▮      │  carriles
└──────────────────┘
```

Teclado: la grilla es una lista de días con enlaces en orden (lunes primero, por hora); `Tab` recorre las clases, `←`/`→` cambian de semana cuando el foco está en los controles de semana.

### Horarios — móvil (360–767 px)

```
┌────────────────────────────┐
│ ▮▮▮▮▮▮ núcleo       entrar │
│ horarios de la semana      │
│ 27 oct – 1 nov   [‹] [›]   │
│ (lun 27)(mar 28)(mié 29)(… │  pestañas deslizables
│ ┌────────────────────────┐ │
│ │ 07:00  Reformer base   │ │
│ │        Tomás · 55 min  │ │
│ │ ▯▯▯▯▮▮      4 libres   │ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ 08:15  Reformer clásico│ │  completa: bloque grafito
│ │ ▮▮▮▮▮▮  completa       │ │
│ └────────────────────────┘ │
└────────────────────────────┘
```

### Reserva (pasos 2 y 3)

```
┌──────────────────────────────────────────────────────────┐
│ elegí la clase ─ confirmá ─ pagá                (2 de 3) │
│                                                          │
│ jueves 30 de octubre                                     │
│ 18:00 – 18:55                         (dato grande)      │
│ Reformer clásico con Lucía Ferreyra                      │
│                                                          │
│ ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐                                 │
│ │▮▮││▮▮││  ││▮▮││  ││▮▮│   quedan 2 lugares              │
│ └──┘└──┘└──┘└──┘└──┘└──┘                                 │
│   1   2   3   4   5   6                                  │
│                                                          │
│ cómo pagás                                               │
│ (●) usar 1 crédito            te quedan 3, vencen 21 nov │
│ ( ) pagar la clase suelta                     $ 22.000   │
│                                                          │
│ total ahora                                   $ 0        │
│ Podés cancelar hasta el jueves 30 a las 06:00 y          │
│ recuperás el crédito. Después, se pierde.                │
│                                                          │
│ [ Reservar ]                                             │
└──────────────────────────────────────────────────────────┘
```

Si pagás la clase suelta, el botón dice "Pagar $ 22.000" y aclara que el lugar queda retenido 10 minutos.

### Retorno del pago

Tres estados con la misma estructura: un carril grande que resume (lleno rosa = aprobado, rayado = pendiente, vacío con borde `error` = rechazado), una frase de qué pasó y una acción.

```
┌────────────────────────────────────┐
│ ┌──┐                               │
│ │▮▮│  Pagaste y reservaste         │
│ │▮▮│  jueves 30, 18:00 con Lucía   │
│ └──┘  reformer 4                   │
│ [ ver mis reservas ]  agregar otra │
└────────────────────────────────────┘
```

### Mis reservas

```
┌──────────────────────────────────────────────────────────┐
│ tus créditos                                             │
│ 3 disponibles   pack de 8 · vencen el 21 de noviembre    │
│                 [ comprar un pack ]                      │
├──────────────────────────────────────────────────────────┤
│ próximas                                                 │
│ jue 30  18:00  Reformer clásico · Lucía   reformer 4     │
│                cancelás sin costo hasta mié 29 06:00     │
│                                            [cancelar]    │
│ sáb 1   09:30  Fundamentos · Tomás       pago pendiente  │
│                                            [pagar]       │
├──────────────────────────────────────────────────────────┤
│ en lista de espera                                       │
│ vie 31  19:15  Reformer power   puesto 2       [salir]   │
├──────────────────────────────────────────────────────────┤
│ pasadas                                                  │
│ lun 20  07:00  Fundamentos         asististe             │
│ mié 22  18:00  Reformer clásico    cancelaste tarde      │
└──────────────────────────────────────────────────────────┘
```

### Agenda del administrador

Denso: bloques de 64 px de alto, sin aire de más. Atajos `j`/`k` (o `←`/`→`) para la semana anterior/siguiente y `t` para volver a esta semana.

```
┌───────────┬────────────────────────────────────────────────────────────────┐
│ núcleo    │ agenda  27 oct – 1 nov          [‹ j] [t] [k ›]     ◐ oscuro   │
│ admin     │ ocupación 68 %   ingresos $ 1.284.000   cancelaciones tarde 3   │
│           ├──────┬────────┬────────┬────────┬────────┬────────┬───────────┤
│ agenda    │      │ lun 27 │ mar 28 │ mié 29 │ jue 30 │ vie 31 │ sáb 1     │
│ plantillas│ 07:00│ 4/6 TA │ 6/6 LF │ 5/6 VS │ …                           │
│ instruct. │      │ ▮▮▮▮▯▯ │ ▮▮▮▮▮▮ │        │                             │
│ alumnos   │ 08:15│ …                                                       │
│ pagos     │      │                                                         │
│ métricas  │ ─────────────────────── panel lateral ───────────────────────  │
│ precios   │ jue 30 · 18:00 · Reformer clásico · Lucía      [cancelar clase]│
│ mensajes  │ 1 Sofía Demo        confirmada   crédito    [asistió]          │
│           │ 2 Martina Ríos      pendiente    vence 18:12                   │
│           │ espera: 1 Paula N. (con créditos) · 2 Juan P.                  │
└───────────┴────────────────────────────────────────────────────────────────┘
```

En móvil la barra lateral pasa a una fila de pestañas arriba y la grilla se reemplaza por la lista del día, igual que en horarios.

### `/caso`

```
┌──────────────────────────────────────────────────────────────┐
│ de prototipo a producción                        (titular)   │
│ Un estudio de pilates con un prototipo hecho con IA que      │
│ se veía bien y vendía lugares que no existían.               │
│                                                              │
│ ┌─────────────────────────┬──────────────────────────────┐  │
│ │ captura antes           │ captura después              │  │
│ │                     ◀ ║ ▶                              │  │  slider
│ └─────────────────────────┴──────────────────────────────┘  │
│                                                              │
│ qué se arregló                                               │
│ problema en el prototipo │ cómo se resolvió │ por qué importa│
│ … 7 filas                                                    │
│                                                              │
│ la prueba: 20 personas, 6 reformers                          │
│ [ Simular 20 reservas al mismo tiempo ]   quedan 4 usos      │
│ ┌ prototipo ──────────────────┐ ┌ producción ──────────────┐ │
│ │ ▮▮▮▮▮▮│▮▮▮▮▮▮▮▮▮▮▮▮▮▮ (rojo) │ │ ▮▮▮▮▮▮                   │ │
│ │ 20 de 6 lugares ocupados    │ │ 6 de 6 · 14 en espera    │ │
│ │ 14 personas sin reformer    │ │ ① ② ③ … ⑭                │ │
│ └─────────────────────────────┘ └──────────────────────────┘ │
│                                                              │
│ los números                                                  │
│ Lighthouse móvil antes / después · tests · concurrencia      │
└──────────────────────────────────────────────────────────────┘
```

## Experiencia

- Esqueletos de carga con las mismas medidas que el contenido final (sin saltos). Pulso suave de opacidad, desactivado con `prefers-reduced-motion`.
- Disponibilidad en tiempo real: la grilla consulta los cupos cada 10 segundos mientras la pestaña está visible y actualiza solo los carriles.
- Aviso de demo: franja fina en `grafito` arriba de todo, texto chico, sin botón de cerrar.

## Copy

Voseo rioplatense, mayúscula solo al inicio de la frase, verbos consistentes:

| Acción          | Botón                | Resultado                                                         |
| --------------- | -------------------- | ----------------------------------------------------------------- |
| reservar        | Reservar             | Reservaste el jueves 18:00 con Lucía. Te queda 1 crédito          |
| pagar           | Pagar $ 22.000       | Pagaste y reservaste el jueves 18:00                              |
| cancelar        | Cancelar reserva     | Cancelaste tu clase del jueves. Te devolvimos el crédito          |
| lista de espera | Anotarme en la lista | Te anotaste en la lista de espera. Sos el puesto 2                |
| pack            | Comprar pack de 8    | Compraste el pack de 8. Tenés 8 créditos hasta el 26 de noviembre |

Estados vacíos que invitan a actuar: "Todavía no reservaste ninguna clase. Elegí un horario de la semana".

## Revisión contra el brief y los defaults a evitar

Pasé el plan por la lista del brief y por lo que saldría "por defecto" con un pedido parecido:

- **Fondo crema con acento terracota**: `cal` es un gris verdoso frío, no crema. El rosa reformer es salmón claro y solo aparece en lo tuyo; nunca como acento de marca ni en botones. Lo verifiqué en la tabla de estados.
- **Casi negro con acento ácido**: el modo oscuro existe solo en el panel y usa grafito azulado con el eucalipto aclarado (`#74B59D`), un verde apagado, no ácido.
- **Tarjetas idénticas con la misma sombra**: no hay sombras; los bloques cambian de fondo según el estado, así que la grilla nunca se ve como una pared de tarjetas iguales. Corregí una primera idea de "tarjetas blancas con sombra suave" para los bloques libres: ahora llevan borde de 1 px y nada más.
- **Etiquetas en mayúsculas sobre cada título**: no hay eyebrows. El único texto chico antes de un título es el paso de la reserva ("2 de 3"), que es una secuencia real.
- **Resaltar una palabra del titular**: no se hace en ningún titular, tampoco en `/caso`.
- **Flechas en cada botón**: solo las flechas de semana anterior/siguiente, que son controles de navegación, con etiqueta accesible.
- **Animaciones de entrada en cada sección**: ninguna. Las únicas animaciones son el carril que se llena al reservar y los carriles de la simulación.
- **Degradados como decoración**: ninguno en producción. El único degradado del repo es el del prototipo `/antes`, a propósito.
- **Una sola familia con cifras tabulares**: Onest, con `tabular-nums` en todo dato.

## Decisiones tomadas durante la construcción

- **Mayúscula inicial en vez de minúscula inicial.** El plan proponía títulos en minúscula ("tus próximas clases"). Al escribir el copy real choqué con los ejemplos del brief, que van con mayúscula ("Reservaste el jueves 18:00 con Lucía"), y la minúscula hacía que los botones parecieran texto suelto. Quedó _sentence case_ en todo.
- **La sobreventa en rojo, solo en `/caso`.** En la simulación, los 6 carriles vendidos del prototipo usan el gris oscuro de "ocupado" y los 14 que sobran usan `error` (`#B3412F`), separados por una línea: es el único lugar del sitio donde aparece un carril rojo, porque es el único estado que no debería existir. La lista de espera de producción va en círculos neutros numerados: el puesto es un dato, no un estado de alarma.
- **El tema del panel se fija antes de pintar.** Un script mínimo en `<head>` deja la preferencia en `<html data-tema-panel>` y el CSS solo la aplica dentro de `#panel`; los diálogos se montan dentro del panel para heredarla. Así no hay destello de tema claro y el sitio público sigue siempre en claro.
- **Métricas como frases y barras finas.** Una cifra protagonista por vista (la ocupación), el resto en mosaicos chicos; las comparaciones van en texto ("+7 puntos frente a la semana anterior"), sin flechas ni verde/rojo de "bien/mal". Las barras son de una sola serie (sin leyenda: el título la nombra), de 24 px como máximo, con el extremo de datos redondeado, tooltip con mouse o teclado y la misma información como tabla.
- **Agenda densa.** Bloques de 64 px con iniciales del instructor y "+2 esp." cuando hay lista de espera. El detalle se abre en un panel lateral por URL (`?clase=`), para poder compartir el enlace.
- **Fotos sin personas.** Las dos fotos del estudio (Unsplash) muestran reformers y accesorios, nunca gente; los instructores van con iniciales.
- **El tercer paso de la reserva cambia de nombre.** El wireframe decía «elegí la clase ─ confirmá ─ pagá» siempre. Con crédito no hay nada que pagar, así que el tercer paso es «Tu lugar» (el reformer asignado) y, al confirmar, el indicador pasa a «3 de 3». Si la clase se paga suelta, sigue siendo «Pagá».
- **Reprogramar sin sorpresas.** Arrastrar una clase en la agenda es lo más rápido para el estudio, pero no puede ser la única forma (WCAG 2.5.7): el panel lateral tiene «Mover a otro horario» con día y hora. Mientras se arrastra, los horarios libres aparecen con borde punteado y el que está debajo del cursor se tiñe de eucalipto. Solo se mueven clases a más de 12 horas, a un horario también a más de 12 horas: así nadie queda atrapado por la regla de cancelación.
- **Exportaciones para la planilla real.** El CSV usa `;` y BOM porque la configuración regional argentina de Excel toma la coma como decimal; las celdas que empiezan con `=`, `+`, `-` o `@` se neutralizan para que nadie ejecute una fórmula con el nombre de un alumno.
