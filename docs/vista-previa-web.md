# Vista previa web de Neto

La interfaz se puede alojar en GitHub Pages. Las cuentas y movimientos se guardan
en IndexedDB en el navegador de cada visitante; el despliegue contiene únicamente
la aplicación compilada. Los datos de ejemplo solo se añaden al pulsar «Cargar ejemplo».

## Activación inicial

1. Comprobar que el repositorio admite GitHub Pages y que no hay un sitio existente
   que deba conservarse. Si ya lo hay, acordar otro destino antes de desplegar.
2. En Settings → Pages del repositorio, elegir GitHub Actions como origen.
3. Subir el código revisado a la rama `codex/neto-web-preview`. El workflow
   `Neto · vista previa web` ejecuta los tests, comprueba los tipos, compila y despliega.
4. Abrir el enlace que devuelve el paso de despliegue cuando termine correctamente.
   No dar una URL por activa hasta comprobarla desde el navegador.

Si el entorno `github-pages` tiene restricciones de ramas, permitir
`codex/neto-web-preview` para ese despliegue. No desactivar revisiones obligatorias.

## Cada cambio

Hacer commit y push de los cambios a `codex/neto-web-preview`. GitHub Actions
actualizará el mismo enlace tras completar el despliegue. Recargar la página para
ver la nueva versión; la web alojada no recibe las ediciones locales al instante.
Si los tests o la compilación fallan, la versión publicada anterior permanece.

La compilación usa `/App-Gesti-n-Financiera/` como base de los recursos, y el router
actual con `#` permite navegar entre pantallas sin reglas de redirección adicionales.
La configuración de escritorio Tauri y el servidor de desarrollo conservan su base.

## Comprobaciones locales

```bash
export PATH=/workspace/.tooling/node22/bin:$PATH
cd /workspace/App-Gesti-n-Financiera
npm test
npm run build -- --base /App-Gesti-n-Financiera/
```

## Suscripciones e inversión

La base de datos v2 conserva cuentas y movimientos v1 y añade suscripciones,
posiciones de inversión e histórico diario de cartera. Las copias v2 incluyen
las tres tablas nuevas; se siguen admitiendo las copias v1.

Las suscripciones personales se integran en `#/recurrentes`, junto con pagos fijos
e ingresos recurrentes. El antiguo enlace `#/suscripciones` sigue abriendo la
misma sección con el filtro de suscripciones. El negocio conserva su pantalla.
Las fichas son plantillas y sus fechas solo organizan periodos: no crean gastos
ni ingresos anticipados. «Pagado» o «Cobrado» pide importe real, fecha hasta hoy,
cuenta y categoría; crea el movimiento y avanza un periodo en una transacción.
La clave única de ficha/periodo evita duplicados por doble confirmación.
Las tarjetas mantienen tres columnas en escritorio, dos en tamaños intermedios
y una en móvil. Hay filtros por tipo y categoría, búsqueda, estado e historial.
Las suscripciones existentes se conservan y sus pagos usan por defecto la
categoría contable Suscripciones, que puede cambiarse al confirmar.
Los totales del mes usan los movimientos reales, también tras corregirlos.
Eliminar la ficha conserva su historial de pagos y los movimientos asociados.

Las posiciones y cantidades se quedan en IndexedDB. La web descarga únicamente
un catálogo público común (`data/quotes.json`), sin enviar posiciones a proveedores.
Los activos del catálogo usan CoinGecko, Frankfurter/BCE y Yahoo Finance. Los
precios de acciones se convierten con el último cambio del BCE; para el histórico
se usa el cambio de cada fecha (o el último día hábil anterior). Los activos que
no están en el catálogo admiten precio manual en euros.

`python3 scripts/update-quotes.py` genera el catálogo al desplegar. Si una fuente
falla, conserva el precio anterior y su fecha original; no marca precios antiguos
como nuevos. La app indica la fuente y fecha de cada valoración, y avisa tras 48 h.
La serie de mercado es independiente del historial de la cartera: este último
registra las posiciones desde el alta, tomando la última valoración de cada día,
y puede cambiar por aportaciones, cambios de cantidad o bajas. No es una medida
de rentabilidad ajustada por flujos.

El workflow `refresh-quotes.yml` debe existir también en la rama predeterminada
para que GitHub ejecute su programación. Cada seis horas hace checkout de
`codex/neto-web-preview`, consulta precios, verifica y recompila la web, y publica
el mismo enlace. GitHub puede retrasar o desactivar ejecuciones programadas según
sus límites y la actividad del repositorio; las fechas visibles permiten detectarlo.
La publicación periódica no modifica las posiciones guardadas en cada navegador:
se actualizan al abrir Inversión o pulsar Actualizar precios. La siguiente visita
añade una valoración al histórico local; no se inventan valoraciones para los días
que no se abrió la app.

## Presupuestos personales

La base v3 añade límites por categoría y mes, con índice único y copias v3. Las
copias v1/v2 siguen siendo válidas; al restaurarlas, Presupuestos queda vacío.
La pantalla `#/presupuestos` cuenta gastos de cuentas personales (también el historial de cuentas eliminadas) fechados dentro del mes seleccionado y hasta el día local actual.
Excluye ingresos, transferencias, negocio y movimientos futuros. Las cuotas de
suscripción cuentan cuando su pago está registrado como gasto en Movimientos.

El disponible es la suma de límites menos el gasto en categorías presupuestadas;
los gastos sin límite se muestran aparte. Los avisos del 80 %, límite alcanzado y
exceso son visibles dentro de la app. El gráfico acumula gastos diarios, con una
referencia horizontal al límite y sin trazar días futuros; admite selección por
teclado y táctil. El detalle de cada categoría permite editar sus movimientos.

Cada mes conserva sus límites. Copiar el anterior solo añade categorías que
faltan, sin sobrescribir límites existentes ni copiar gastos. Eliminar un límite
conserva los movimientos. Al borrar una categoría desde Ajustes, sus límites se
trasladan a la categoría de destino y se suman por mes, junto con sus movimientos.
Esta operación y las copias entre meses son transaccionales.

## Apariencia personalizable

La estructura de la interfaz es neutra y las categorías y gráficos usan colores funcionales. Ajustes →
Apariencia y colores permite elegir cualquier hexadecimal RGB para el destaque,
ingresos, gastos e inversiones. Las categorías tienen selector libre y los
presupuestos pueden heredar su color o guardar uno propio, que se copia al mes
siguiente. Quitar el destaque general conserva los colores independientes.

Las variables del tema se actualizan desde IndexedDB sin recargar. Se generan
tonos claros para superficies y tonos con contraste mínimo 4,5:1 sobre blanco
para texto/trazos. Los indicadores siguen incluyendo etiquetas y cifras.
Las copias v4 conservan todas las elecciones; se admiten copias anteriores.
La migración v4 neutraliza solo los antiguos colores iniciales de categorías
que conservan su nombre y color originales; conserva otras combinaciones.

## Apartados, metas y reservas de ahorro

Las pantallas tienen composiciones distintas: Inicio conserva el resumen;
Presupuestos usa sobres con barras de consumo y un panel de ahorro; Suscripciones
combina catálogo y agenda; Inversión compara coste, valor actual y variación,
con reparto por tipo y selector explícito de valor propio o precio por unidad.
Las categorías sugeridas no crean límites hasta que el usuario los guarda.

Las metas permiten reservar un importe mensual o un porcentaje de un ingreso
de referencia elegido por el usuario. Con origen, se crea una cuenta de ahorro
y se registra un traspaso interno; no hay conexión bancaria ni órdenes externas.
El modo automático reserva únicamente la cuota del mes actual, al abrir Neto
o al actualizar saldos, siempre que haya dinero suficiente. No recupera meses
anteriores automáticamente. Cambiar una cuota conserva lo ya registrado.
Sin cuenta de origen, las aportaciones son seguimiento manual de ahorro ya
realizado y no alteran saldos ni el disponible para gastar. El ahorro previo
se mantiene como seguimiento y no añade dinero a cuentas.

«Aportar / recuperar meses» permite aportar ahora 300 € y atribuir 100 € a cada
uno de tres meses seleccionados. Se genera una única transferencia por 300 €,
con su fecha real hasta hoy y un desglose en aportaciones. Los meses son etiquetas
de reparto, no fechas de movimientos futuros. Se puede añadir otra aportación
al mismo mes; no sobrescribe las anteriores. Un identificador por operación evita
repetir el traspaso. Los céntimos se distribuyen sin pérdidas por redondeo.
Corregir la transferencia ajusta proporcionalmente el reparto; borrarla anula
sus aportaciones sin recrearla. Borrar la meta conserva cuentas y movimientos.

La base v7 añade fichas y registros de recurrentes, índices de idempotencia y
reparto de aportaciones. Las copias v8 incluyen estas tablas y admiten v1–v7.
Se validan importes, periodos y que cada reparto sume exactamente su transferencia.
Al eliminar una categoría se trasladan tanto movimientos y límites como fichas
fijas a la categoría elegida.

## Dinero real y cuentas

Los formularios de movimientos solo aceptan fechas válidas hasta el día actual.
Los registros antiguos con fecha futura permanecen visibles para corregirlos en
Movimientos, con aviso, pero se excluyen de saldos, gráficos y resúmenes actuales.

Todas las cuentas vigentes de un ámbito suman en su patrimonio. No hay acción de
archivar: se pueden eliminar incluso con historial y su saldo desaparece de las
vistas y los totales; las metas vinculadas se pausan. Internamente se conservan
referencias de cuenta y movimientos para respetar el historial y las transferencias
de las otras cuentas. Las antiguas cuentas archivadas se migran a eliminadas,
sin incorporar de nuevo su dinero al total.

Inicio muestra «Disponible para gastar»: suma actual de cuentas personales de
uso. El «Ahorro separado» suma las cuentas de tipo ahorro, incluidas las metas.
Ambos suman el total de cuentas personales. No se restan cuotas sin confirmar
ni se suman ingresos pendientes. El disponible no incluye la valoración de
inversiones. Un traspaso entre cuentas personales no es gasto ni ingreso.

Los servicios populares rellenan nombre, categoría e icono; Otros permite texto
libre. Los iconos disponibles de Simple Icons se guardan localmente bajo CC0,
con licencia en public/icons/services/LICENSE.md. Los servicios sin SVG usan un
símbolo genérico o iniciales. La referencia Figma compartida por el usuario no
pudo consultarse: el proxy del entorno deniega el dominio, por lo que sus recursos
no se han importado ni se atribuyen como fuente de los SVG incluidos.

## Desglose de viajes

Cada meta de viajes admite conceptos con nombre e importe previsto para el viaje
completo. El editor ofrece vuelos, alojamiento, comida y ocio, transporte,
actividades y seguro; permite conceptos propios, edición y eliminación.
La suma no puede superar el objetivo y la diferencia queda como «Sin asignar».
Reducir el objetivo por debajo del desglose existente requiere ajustar primero
sus conceptos. El guardado valida contra el objetivo actual dentro de una
transacción y modifica únicamente ese campo de la meta: no genera transferencias,
aportaciones ni gastos. Editar otros datos de la meta conserva el desglose.

Se ve dentro de la tarjeta del viaje en Presupuestos y Metas. Además del reparto
del objetivo, cada concepto muestra lo pagado y la parte del importe asignado
aún sin usar. «Registrar gasto» apunta el pago real desde la cuenta de ahorro,
asociándolo al viaje y, opcionalmente, a uno de sus conceptos. El gasto se cuenta
una sola vez en Movimientos, los resúmenes y los presupuestos de su categoría.
La meta distingue ahorro acumulado, dinero gastado y saldo disponible. En viajes,
el progreso incluye la parte ya pagada para que comprar un vuelo no borre ese
avance. El dinero retirado hacia otros destinos se resta del progreso financiado.

«Repartir restante» transfiere a una cuenta elegida o a otra meta sin generar otro
gasto. Reservar 200 €, gastar 150 € y devolver los 50 € restantes deja 150 € de
gasto real y cero disponibles en esa reserva. Se comprueba saldo suficiente, fecha
real y operación única. Los datos del viaje y sus pagos se incluyen en copias v8.

## Colores funcionales y tarjetas de suscripciones

El fondo, texto y selección siguen siendo neutros. Los valores iniciales usan
verde para ingresos, rojo para gastos y azul para la evolución de inversiones.
Cada categoría tiene un color coherente: comida verde, transporte azul, casa
violeta, ocio ámbar, salud turquesa y ropa rosa. Los gráficos y presupuestos usan
estos colores, y los avisos conservan texto y símbolos además de ámbar/rojo.
Los colores de gráficos/categorías elegidos expresamente siguen siendo editables.
La migración de base v6 y restauración de copias antiguas reemplazan únicamente
los tonos iniciales grises identificables; conservan otras elecciones.
Las copias v7 preservan el resultado. Las marcas usan sus colores en máscaras
SVG locales; no necesitan descargas externas al abrir la aplicación.

Las suscripciones guardadas aparecen en una cuadrícula de tres columnas en
escritorio, dos en anchuras intermedias y una en móvil. Cada tarjeta incluye
servicio, categoría, cuota y periodicidad, estado, fecha y acciones de edición y
renovación. Se mantienen filtros, ámbitos personal/negocio y confirmaciones.

En Presupuestos, Metas y Suscripciones, los importes informativos se presentan
en negro (o en blanco sobre el resumen oscuro). El porcentaje de consumo y el
detalle de gastos de un presupuesto también son neutros. El color de categoría,
marca, barras y avisos se conserva; Inicio, Movimientos e Inversión mantienen
el significado de ingreso/subida en verde y gasto/bajada en rojo.

## Legibilidad, composición y referencias visuales

La revisión visual usa `polish.css` como capa común de composición y controles.
Integra icono y título en la misma cabecera, amplía etiquetas, cifras y botones,
y define separaciones coherentes entre tarjetas. Conserva los colores de tema,
categoría y marca; los importes de presupuestos, metas y suscripciones siguen
neutros. Inicio prioriza disponible/ahorro y presenta el balance mensual en una
franja independiente. Metas usa tres columnas iguales con tarjetas de vista previa que abren un
panel central ampliado con los datos y acciones. Presupuestos reserva la tercera columna de la derecha para el ahorro y
rellena las dos columnas izquierdas con límites. El ahorro aparece desde el
inicio de ese bloque como tarjetas superpuestas con nombre y disponible. La tarjeta seleccionada queda completa
delante y abre el mismo panel de detalle. Las demás conservan cabeceras pulsables.
Recurrentes ordena por fecha de referencia y alinea cuota, estado y confirmación.

Las referencias aportadas se aplican a las tarjetas de cuentas por capas, anillos
segmentados más gruesos, indicadores de consumo alrededor de categorías y curvas
con puntos seleccionados y etiquetas de valor. Las curvas pasan por los datos
reales sin sobrepasar los valores de los extremos de cada tramo. Las áreas bajo
las líneas son decorativas y no añaden datos ni previsiones. Los anillos muestran
importe, nombre y porcentaje en su leyenda; los segmentos pequeños conservan
extremos planos para evitar exagerar su peso. El teclado permite recorrer meses,
seleccionar categorías y elegir fechas; la evolución de inversiones admite además
selección directa con puntero o toque sobre la curva.

Los formularios tienen cierre visible y pie de acciones accesible al desplazarse.
El editor del desglose de viajes separa concepto e importe en móvil para poder
leer ambos. La navegación móvil acorta Movimientos a Actividad para mantener las
etiquetas legibles. Se respetan las preferencias de movimiento y transparencia
reducidos. No hay cambios en el modelo ni en las operaciones financieras.

Validación: 112 pruebas de datos, compilación para Pages, revisión de las ocho
secciones personales a 1440, 1024, 768, 390 y 320 px, comprobaciones de gráficos
con teclado/puntero, contraste de la tarjeta oscura, diez formularios móviles,
detalle desplegable de ahorro y recorrido de pagos, gastos, aportaciones y cuentas.

## Cuadrículas y pila de metas

La cuadrícula de Metas mantiene tres columnas iguales desde 1024 px, incluso
si hay una sola tarjeta. En tamaños intermedios pasa a dos y en móvil a una.
Presupuestos usa una estructura de tres franjas iguales: las dos primeras se
reservan a límites y la tercera siempre pertenece a las metas. Los límites,
gastos sin presupuesto y propuestas permanecen en la zona izquierda. La
columna derecha está anclada al hacer scroll, con desplazamiento interno si
no cabe en la altura disponible. En tablet y móvil el ahorro pasa debajo y
deja de estar anclado para conservar la legibilidad. Las previews de metas muestran nombre,
disponible y progreso; los botones de aportar, gastar, repartir y editar se
encuentran dentro del panel ampliado. Su contenido se actualiza al guardar una
operación sin cerrar el detalle. Los formularios secundarios mantienen el
panel de la meta detrás y Escape solo cierra la ventana superior.

En Presupuestos, «Tu dinero para después» usa una pila vertical de tarjetas
reales: cada cabecera queda expuesta y pulsable y la tarjeta principal se ve
completa. Solo muestra nombre y disponible, con fondos derivados del color de
la meta. Al pulsar otra tarjeta, pasa al frente y se abre su detalle. No se
simulan metas si la lista está vacía. Se ofrecen Nueva meta y acceso al listado.

Verificado en navegador: tres columnas de Metas; dos de presupuestos y una
reservada para ahorro sin desplazarse al añadir límites ni al hacer scroll; detalle centrado,
aportar/gastar/repartir con actualización de importes, selección de principal,
cabeceras sin obstrucción, cierre de diálogos anidados, versiones de móvil,
y los casos de una meta y ninguna. Se mantienen las 112 pruebas de datos.
