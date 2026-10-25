# Arquitectura técnica inicial

## Principios

- **PWA primero:** una interfaz web adaptable, instalable y con rutas relativas.
- **Separación por responsabilidad:** estilos, datos de demostración, persistencia y navegación se encuentran separados.
- **Prototipo honesto:** los módulos actuales no simulan seguridad o servicios de red inexistentes.
- **Evolución gradual:** conectar backend y servicios reales solo después de definir contratos, permisos y modelo de datos.

## Capas actuales

1. `index.html`: estructura semántica y puntos de montaje de cada vista.
2. `src/styles/`: tokens, estilos base y componentes.
3. `src/data/demo-data.js`: contenido de ejemplo.
4. `src/modules/storage.js`: lectura y escritura local en `localStorage`.
5. `src/modules/navigation.js`: cambio de vistas y estado de navegación.
6. `src/modules/dialogs.js`: diálogos modales y avisos.
7. `src/app.js`: orquestación de la experiencia de demostración.
8. `sw.js`: caché de recursos estáticos para disponibilidad básica sin conexión.

## Arquitectura futura (no implementada)

- Cliente web → API autenticada → servicios de aplicación.
- Identidad y sesiones seguras.
- Base de datos para usuarios, contactos, conversaciones y estados.
- Canal de mensajería en tiempo real.
- Almacenamiento privado de medios con URLs firmadas.
- Servicio de notificaciones push con consentimiento.
- Proveedor de IA detrás de una API del servidor; nunca colocar claves secretas en JavaScript público.
- Observabilidad, límites de uso, protección contra abuso y copias de seguridad.

## Límites actuales

`localStorage` es específico del navegador/dispositivo, no cifra los datos por sí mismo y puede borrarse. El service worker solo almacena recursos estáticos. Los mensajes de demostración no se envían a otra persona.
