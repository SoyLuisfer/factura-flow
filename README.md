# Factura Flow

Vamos a construir "Contralor", un agente de cuentas por pagar para el reto Blinka del 30X Hackathon. El agente revisa las facturas de una empresa y decide qué hacer con cada una: PAGAR, FRENAR, ESCALAR a una persona o POSTERGAR, dentro de reglas que la empresa configura. Deja un registro auditable de cada decisión. No se mueve dinero real ni hay integración bancaria: la app decide, registra y explica. Toda la interfaz va en español.



Empresa demo (ficticia): Pollos Hermanos, S. A., empresa guatemalteca de producción y venta de alimentos con contratistas y proveedores en Guatemala, Colombia, México y Argentina.



PRINCIPIOS NO NEGOCIABLES (esto es lo que evalúa el jurado; aprobar un pago indebido descalifica):

1. La IA SOLO lee facturas y las convierte en datos estructurados. La IA NUNCA decide.

2. La decisión la toma un motor de reglas determinista en TypeScript puro, sin ninguna llamada a IA, en src/lib/motorReglas.ts. Debe ser una función pura: evaluarFactura(factura, contexto) => resultado.

3. Una factura solo puede quedar en PAGAR si TODOS los controles están en OK o NO_APLICA. Cualquier FALLA o NO_EVALUABLE impide PAGAR.

4. Nada en la app puede poner una factura en PAGAR excepto: (a) el motor con todos los controles OK, o (b) la aprobación explícita de una persona, registrando su nombre, fecha y hora, y comentario.

5. Cada decisión guarda la traza completa de controles evaluados, para que cualquier persona entienda el porqué sin abrir el código.



En esta etapa construye solo el modelo de datos y los datos demo. En el siguiente mensaje te paso el motor de reglas y los casos de prueba. Las demás pantallas y la lectura con IA vienen después. Deja ya una navegación lateral con: Tablero, Subir factura, Registro de auditoría, Reglas, Proveedores y Banco de pruebas (las que aún no existen pueden mostrar "Próximamente").



=== MODELO DE DATOS (Lovable Cloud) ===

- empresa (1 fila): razon_social, pais_constitucion, id_fiscal, direccion, moneda_reporte.

- cuentas_bancarias: id (texto, ej. BANK-USD), banco, moneda, numero, saldo_disponible.

- politicas: id, version (texto: v1, v2…), vigente (bool, solo una vigente), creada_en, creada_por, parametros (jsonb). Al editar la política nunca se sobrescribe: se crea una versión nueva y la anterior queda en el historial.

- tipos_cambio: moneda, por_usd (unidades de la moneda por 1 USD), vigente_desde, vigente_hasta.

- proveedores: id, nombre, pais, tipo, categoria, moneda_factura, cuenta_pago (id de cuenta_bancaria desde la que se le paga), permite_conversion (bool), banco_beneficiario, cuenta_beneficiario, expediente_completo (bool), activo (bool).

- contratos: id, proveedor_id, concepto, tipo (mensual | unica), monto, moneda.

- pagos_previos: id, proveedor_id, factura, monto, moneda, monto_usd, categoria, fecha_pago, cuenta, decidido_por.

- facturas: id, codigo (ej. F01), archivo_url, nombre_archivo, canal (correo | whatsapp | slack | otro), fecha_recepcion, tipo_documento, emisor, receptor, numero, fecha_emision, fecha_vencimiento, descripcion, monto, moneda, pago_banco, pago_cuenta, confianza_extraccion (0 a 1), texto_original, creada_en.

- decisiones: id, factura_id, decision (PAGAR | FRENAR | ESCALAR | POSTERGAR), estado (final | pendiente_aprobacion | aprobada_humano | rechazada_humano), decidido_por, decidido_en, motivo, controles (jsonb), proveedor_id, categoria, monto_usd, cuenta_pago, fecha_programada_pago, politica_version, escalar_a (Finanzas | Contabilidad | null), factura_relacionada_id (para duplicados), aprobador, aprobado_en, comentario_aprobacion, ajuste (jsonb).

- registro_eventos (append-only, nunca se edita ni se borra): id, fecha_hora, factura_id, evento (recibida | extraida | decidida | aprobada | rechazada | politica_modificada | proveedor_modificado), actor ("Agente (automático)" o el nombre de la persona), detalle.



Para el demo no hay login: el jurado entra directo. Las acciones humanas piden elegir el usuario en un selector: "Luis Samayoa (Finanzas)" o "Ana Morales (Contabilidad)".



=== DATOS DEMO ===

Crea una función seedDemo() que cargue estos datos al iniciar si la base está vacía. Agrega en "Banco de pruebas" un botón "Reiniciar datos demo" que borre facturas, decisiones y eventos, y vuelva a cargar los datos maestros.



Empresa: {"razon_social": "Pollos Hermanos, S. A.", "pais_constitucion": "Guatemala", "id_fiscal": "NIT 0000000-0 (ficticio)", "direccion": "Calzada Demo 10-20, Zona 10, Ciudad de Guatemala (ficticia)", "actividad": "Producción y venta de alimentos", "moneda_reporte": "GTQ"}



Cuentas bancarias: [{"id":"BANK-USD","banco":"Banco Andino Demo","moneda":"USD","numero":"DEMO-USD-0001","saldo_disponible":120000.0},{"id":"BANK-GTQ","banco":"Banco del Valle Demo","moneda":"GTQ","numero":"DEMO-GTQ-0002","saldo_disponible":150000.0}]



Política v1 (parametros, vigente desde 2026-10-01, creada_por "Dirección Financiera"):

{"receptor_valido":"Pollos Hermanos, S. A.","campos_obligatorios":["tipo_documento","emisor","receptor","numero","fecha_emision","descripcion","monto","moneda"],"tipos_documento_validos":["factura","cuenta de cobro","invoice"],"tope_por_pago_usd":25000.0,"tolerancia_contrato_pct":1.0,"postergacion_automatica_max_usd":5000.0,"calendario_pagos":{"dia_corte":"martes","dia_pago":"viernes"},"presupuesto_por_categoria_usd":{"Contratistas":25000.0,"Software y hosting":1500.0,"Servicios profesionales":3000.0,"Marketing":4000.0,"Proyectos":40000.0,"Oficina":1200.0},"umbral_confianza_extraccion":0.7}



Tipos de cambio (por 1 USD, vigentes 2026-10-01 a 2026-10-31): {"USD":1.0,"GTQ":7.7}



Proveedores: [{"id": "V001", "nombre": "Estudio Ceiba Diseño, S.A.", "pais": "Guatemala", "tipo": "Agencia", "categoria": "Marketing", "moneda_factura": "GTQ", "cuenta_pago": "BANK-GTQ", "permite_conversion": false, "banco_beneficiario": "Banco del Valle Demo", "cuenta_beneficiario": "DEMO-GT-110-4521", "expediente_completo": true, "activo": true, "tipo_relacion": "cotizacion"}, {"id": "V002", "nombre": "María José Castillo", "pais": "Colombia", "tipo": "Contratista", "categoria": "Contratistas", "moneda_factura": "USD", "cuenta_pago": "BANK-USD", "permite_conversion": false, "banco_beneficiario": "Banco Cafetero Demo", "cuenta_beneficiario": "DEMO-CO-220-7781", "expediente_completo": true, "activo": true, "tipo_relacion": "recurrente"}, {"id": "V003", "nombre": "Carlos Méndez", "pais": "México", "tipo": "Contratista", "categoria": "Contratistas", "moneda_factura": "USD", "cuenta_pago": "BANK-USD", "permite_conversion": false, "banco_beneficiario": "Banco Azteca Demo", "cuenta_beneficiario": "DEMO-MX-330-1209", "expediente_completo": true, "activo": true, "tipo_relacion": "recurrente"}, {"id": "V004", "nombre": "Lucía Fernández", "pais": "Argentina", "tipo": "Contratista", "categoria": "Contratistas", "moneda_factura": "USD", "cuenta_pago": "BANK-USD", "permite_conversion": false, "banco_beneficiario": "Banco Pampa Demo", "cuenta_beneficiario": "DEMO-AR-440-6630", "expediente_completo": true, "activo": true, "tipo_relacion": "recurrente"}, {"id": "V005", "nombre": "Quetzal Cloud Hosting S.A.S.", "pais": "Colombia", "tipo": "Proveedor", "categoria": "Software y hosting", "moneda_factura": "USD", "cuenta_pago": "BANK-GTQ", "permite_conversion": true, "banco_beneficiario": "Banco Cafetero Demo", "cuenta_beneficiario": "DEMO-CO-220-9902", "expediente_completo": true, "activo": true, "tipo_relacion": "recurrente"}, {"id": "V006", "nombre": "Morales & Asociados, Contadores", "pais": "Guatemala", "tipo": "Proveedor", "categoria": "Servicios profesionales", "moneda_factura": "GTQ", "cuenta_pago": "BANK-GTQ", "permite_conversion": false, "banco_beneficiario": "Banco del Valle Demo", "cuenta_beneficiario": "DEMO-GT-110-3378", "expediente_completo": true, "activo": true, "tipo_relacion": "recurrente"}, {"id": "V007", "nombre": "Ríos Abogados, S.C.", "pais": "México", "tipo": "Proveedor", "categoria": "Servicios profesionales", "moneda_factura": "USD", "cuenta_pago": "BANK-GTQ", "permite_conversion": false, "banco_beneficiario": "Banco Azteca Demo", "cuenta_beneficiario": "DEMO-MX-330-5544", "expediente_completo": true, "activo": true, "tipo_relacion": "cotizacion"}, {"id": "V008", "nombre": "Cóndor Data Labs Inc.", "pais": "Estados Unidos", "tipo": "Proveedor", "categoria": "Proyectos", "moneda_factura": "USD", "cuenta_pago": "BANK-USD", "permite_conversion": false, "banco_beneficiario": "Banco Andino Demo", "cuenta_beneficiario": "DEMO-US-550-0087", "expediente_completo": true, "activo": true, "tipo_relacion": "cotizacion"}, {"id": "V009", "nombre": "Kevin Ortiz", "pais": "Guatemala", "tipo": "Contratista", "categoria": "Contratistas", "moneda_factura": "GTQ", "cuenta_pago": "BANK-GTQ", "permite_conversion": false, "banco_beneficiario": "Banco del Valle Demo", "cuenta_beneficiario": "DEMO-GT-110-8812", "expediente_completo": true, "activo": true, "tipo_relacion": "recurrente"}, {"id": "V010", "nombre": "Licencias Volcán S.A.", "pais": "Guatemala", "tipo": "Proveedor", "categoria": "Software y hosting", "moneda_factura": "USD", "cuenta_pago": "BANK-USD", "permite_conversion": false, "banco_beneficiario": "Banco del Valle Demo", "cuenta_beneficiario": "DEMO-GT-USD-110-2290", "expediente_completo": true, "activo": true, "tipo_relacion": "recurrente"}, {"id": "V011", "nombre": "Sofía Herrera", "pais": "Colombia", "tipo": "Contratista", "categoria": "Contratistas", "moneda_factura": "USD", "cuenta_pago": "BANK-USD", "permite_conversion": false, "banco_beneficiario": "Banco Cafetero Demo", "cuenta_beneficiario": "DEMO-CO-220-4410", "expediente_completo": true, "activo": true, "tipo_relacion": "recurrente"}, {"id": "V012", "nombre": "Coworking Ceiba Zona 4", "pais": "Guatemala", "tipo": "Proveedor", "categoria": "Oficina", "moneda_factura": "GTQ", "cuenta_pago": "BANK-GTQ", "permite_conversion": false, "banco_beneficiario": "Banco del Valle Demo", "cuenta_beneficiario": "DEMO-GT-110-6025", "expediente_completo": true, "activo": true, "tipo_relacion": "recurrente"}, {"id": "V013", "nombre": "Andrés Pérez", "pais": "México", "tipo": "Contratista", "categoria": "Contratistas", "moneda_factura": "USD", "cuenta_pago": "BANK-USD", "permite_conversion": false, "banco_beneficiario": "Banco Azteca Demo", "cuenta_beneficiario": "DEMO-MX-330-7718", "expediente_completo": true, "activo": true, "tipo_relacion": "recurrente"}, {"id": "V014", "nombre": "Buzón Seguro Ltda.", "pais": "Colombia", "tipo": "Proveedor", "categoria": "Software y hosting", "moneda_factura": "USD", "cuenta_pago": "BANK-USD", "permite_conversion": false, "banco_beneficiario": "Banco Cafetero Demo", "cuenta_beneficiario": "DEMO-CO-220-3150", "expediente_completo": true, "activo": true, "tipo_relacion": "recurrente"}]



Contratos y cotizaciones: [{"id": "CT-V002", "proveedor_id": "V002", "concepto": "Desarrollo backend", "tipo": "mensual", "monto": 3200.0, "moneda": "USD", "estado": "vigente"}, {"id": "CT-V003", "proveedor_id": "V003", "concepto": "Desarrollo móvil", "tipo": "mensual", "monto": 2800.0, "moneda": "USD", "estado": "vigente"}, {"id": "CT-V004", "proveedor_id": "V004", "concepto": "QA y pruebas", "tipo": "mensual", "monto": 2400.0, "moneda": "USD", "estado": "vigente"}, {"id": "CT-V005", "proveedor_id": "V005", "concepto": "Hosting y servidores", "tipo": "mensual", "monto": 300, "moneda": "USD", "estado": "vigente"}, {"id": "CT-V006", "proveedor_id": "V006", "concepto": "Servicios contables mensuales", "tipo": "mensual", "monto": 6500.0, "moneda": "GTQ", "estado": "vigente"}, {"id": "COT-V001-014", "proveedor_id": "V001", "concepto": "Campaña de lanzamiento Q4", "tipo": "unica", "monto": 46200.0, "moneda": "GTQ", "estado": "vigente"}, {"id": "COT-V007-003", "proveedor_id": "V007", "concepto": "Revisión de contratos de contratistas", "tipo": "unica", "monto": 1500, "moneda": "USD", "estado": "vigente"}, {"id": "COT-V008-001", "proveedor_id": "V008", "concepto": "Migración a data warehouse", "tipo": "unica", "monto": 32000.0, "moneda": "USD", "estado": "vigente"}, {"id": "CT-V009", "proveedor_id": "V009", "concepto": "Diseño UI", "tipo": "mensual", "monto": 9240.0, "moneda": "GTQ", "estado": "vigente"}, {"id": "CT-V010", "proveedor_id": "V010", "concepto": "Licencias de software de desarrollo", "tipo": "mensual", "monto": 480.0, "moneda": "USD", "estado": "vigente"}, {"id": "CT-V011", "proveedor_id": "V011", "concepto": "Investigación UX", "tipo": "mensual", "monto": 2000.0, "moneda": "USD", "estado": "vigente"}, {"id": "CT-V012", "proveedor_id": "V012", "concepto": "Membresía de coworking", "tipo": "mensual", "monto": 3850.0, "moneda": "GTQ", "estado": "vigente"}, {"id": "CT-V013", "proveedor_id": "V013", "concepto": "Desarrollo frontend", "tipo": "mensual", "monto": 2600.0, "moneda": "USD", "estado": "vigente"}, {"id": "CT-V014", "proveedor_id": "V014", "concepto": "Correo corporativo", "tipo": "mensual", "monto": 240.0, "moneda": "USD", "estado": "vigente"}]



Pagos previos de octubre 2026: [{"id": "PAG-0412", "proveedor_id": "V003", "factura": "CM-2026-09", "monto": 2800.0, "moneda": "USD", "monto_usd": 2800.0, "categoria": "Contratistas", "fecha_pago": "2026-10-02", "cuenta": "BANK-USD", "decidido_por": "Luis Samayoa (manual)"}, {"id": "PAG-0413", "proveedor_id": "V002", "factura": "CC-MJC-009", "monto": 3200.0, "moneda": "USD", "monto_usd": 3200.0, "categoria": "Contratistas", "fecha_pago": "2026-10-02", "cuenta": "BANK-USD", "decidido_por": "Luis Samayoa (manual)"}, {"id": "PAG-0414", "proveedor_id": "V004", "factura": "LF-009", "monto": 2400.0, "moneda": "USD", "monto_usd": 2400.0, "categoria": "Contratistas", "fecha_pago": "2026-10-02", "cuenta": "BANK-USD", "decidido_por": "Luis Samayoa (manual)"}, {"id": "PAG-0415", "proveedor_id": "V009", "factura": "KO-009", "monto": 9240.0, "moneda": "GTQ", "monto_usd": 1200.0, "categoria": "Contratistas", "fecha_pago": "2026-10-02", "cuenta": "BANK-GTQ", "decidido_por": "Luis Samayoa (manual)"}, {"id": "PAG-0418", "proveedor_id": "V010", "factura": "LV-2026-09", "monto": 480.0, "moneda": "USD", "monto_usd": 480.0, "categoria": "Software y hosting", "fecha_pago": "2026-10-02", "cuenta": "BANK-USD", "decidido_por": "Luis Samayoa (manual)"}, {"id": "PAG-0420", "proveedor_id": "V005", "factura": "QC-2026-09", "monto": 300, "moneda": "USD", "monto_usd": 300.0, "categoria": "Software y hosting", "fecha_pago": "2026-10-02", "cuenta": "BANK-GTQ", "decidido_por": "Luis Samayoa (manual)"}, {"id": "PAG-0421", "proveedor_id": "V014", "factura": "BS-1009", "monto": 240.0, "moneda": "USD", "monto_usd": 240.0, "categoria": "Software y hosting", "fecha_pago": "2026-10-09", "cuenta": "BANK-USD", "decidido_por": "Luis Samayoa (manual)"}, {"id": "PAG-0425", "proveedor_id": "V001", "factura": "ED-0088", "monto": 11550.0, "moneda": "GTQ", "monto_usd": 1500.0, "categoria": "Marketing", "fecha_pago": "2026-10-09", "cuenta": "BANK-GTQ", "decidido_por": "Luis Samayoa (manual)"}, {"id": "PAG-0430", "proveedor_id": "V006", "factura": "A-2231", "monto": 6500.0, "moneda": "GTQ", "monto_usd": 844.16, "categoria": "Servicios profesionales", "fecha_pago": "2026-10-09", "cuenta": "BANK-GTQ", "decidido_por": "Luis Samayoa (manual)"}, {"id": "PAG-0434", "proveedor_id": "V012", "factura": "SC-0917", "monto": 3850.0, "moneda": "GTQ", "monto_usd": 500.0, "categoria": "Oficina", "fecha_pago": "2026-10-02", "cuenta": "BANK-GTQ", "decidido_por": "Luis Samayoa (manual)"}]



Al terminar, muestra en la página "Proveedores" una tabla simple con los proveedores cargados, para verificar que los datos quedaron bien.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f95ccaea-4dd3-4a8d-8d04-80fb8d618f8b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
