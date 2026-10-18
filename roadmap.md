# Proveedores: eliminación segura
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
