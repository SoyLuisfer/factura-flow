# Proveedores: eliminación segura
## Fechas y flujo real de subida
- [x] Normalizar recepción Guatemala y fechas puras, escalar fechas inválidas sin modificar reglas.
- [x] Guardado atómico sin huérfanos y errores en español.
- [x] Flujo real temporal de 18 casos, pruebas y reinicio final limpio.
## Liberación humana de fondos
- [x] Lotes atómicos, bloqueo de duplicados, saldos y reinicio seguro.
- [x] Diálogo por cuenta, badges, calendario y descarga CSV.
- [x] Pruebas y flujos completos; dejar 18 casos sin lotes.
## Diseño global y tesorería
- [x] Lato y formato único de importes, porcentajes, tipos de cambio y formularios/CSV.
- [x] Tesorería y calendario en tablero; presupuesto con barras en Reglas.
- [x] Pago parcial, postergación y reprogramación auditables; R9 devengado/R10 programado sin modificar motor.
- [x] Verificar flujos, pruebas, nombre y Banco 18/18, Seguridad 0, Autonomía 67%, Doble carga OK.

## Nueva empresa demo y dos monedas
- [x] Actualizar datos maestros y casos, conservando el motor intacto.
- [x] Actualizar textos, monedas disponibles y validación de extracción.
- [x] Reiniciar y cargar 18 casos; verificar tablero, banco y pruebas automáticas.

- [x] Protección en la base y operación atómica con auditoría.
- [x] Botón eliminar, confirmación, selector de usuario y desactivación con historial.
- [x] Pruebas de protección y comprobación del Banco de pruebas.

# Corrección del guardado de proveedores
- [x] Identificar el rechazo real al guardar contratos y corregir permisos y valores.
- [x] Guardar proveedor, contrato y evento sin cambios parciales.
- [x] Probar alta, edición, eliminación y protecciones; limpiar solo pruebas propias.
- [x] Confirmar Banco de pruebas sin reiniciar datos del usuario.
## Tipo de relación y cotizaciones de un solo uso (hecho)
- [x] tipo_relacion en proveedores + estado/factura_id_uso en contratos, con migración de datos y seed actualizado
- [x] Formulario de proveedor con selector de tipo de relación y sección de contrato condicional
- [x] R6: compra directa NO_APLICA, cotización utilizada FALLA/ESCALAR; consumo de cotización al aprobar
- [x] Pruebas nuevas (compra directa aprueba, cotización usada escala) y verificación 18/18, Seguridad 0, Autonomía 67%, Doble carga OK

## UX para el pitch (solo interfaz, sin escrituras de datos)
- [ ] Atención pendiente, indicadores, pestañas y filas de tablero.
- [ ] Tesorería, autoría humana, extracción y línea de tiempo.
- [ ] Progreso de subida, skeletons y revisión desktop/celular.
- [ ] Verificar regresiones sin reiniciar, cargar ni escribir datos.
