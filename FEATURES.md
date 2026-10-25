# Mapa de funciones

## Chats — demostración implementada
- Lista de conversaciones de ejemplo.
- Búsqueda local.
- Filtros: todos, no leídos y favoritos.
- Abrir conversación.
- Enviar mensajes locales.
- Crear contacto/conversación local.
- Alternar favorito y limpiar mensajes locales.

## Estados — demostración implementada
- Lista de estados de ejemplo.
- Crear estado de texto local.
- Los estados no se distribuyen a otros usuarios.

## LIDA Play — pantalla de producto
- Portada y módulos visuales de descubrimiento.
- No hay catálogo, reproducción o proveedor multimedia conectado.

## Reels — pantalla de producto
- Pantalla placeholder para contenido vertical.
- No hay subida, reproducción ni feed real.

## Perfil — demostración implementada
- Editar nombre, identificador y biografía.
- Los datos se guardan localmente.

## LIDA AI — interfaz de demostración
- Sugerencias rápidas.
- Envío de texto y respuestas placeholder.
- No existe modelo de IA conectado ni búsqueda web real.

## Plataforma
- Diseño adaptable.
- Navegación por vistas.
- Manifest de PWA.
- Service worker de caché básica.
- Diálogos y notificaciones locales.

## Aún no implementado
Autenticación, recuperación de cuenta, contactos reales, mensajería en red, sincronización multi-dispositivo, cifrado de extremo a extremo, llamadas, notificaciones push, multimedia, moderación, reportes, bloqueo, panel de administración, pagos, analítica y proveedor de IA.

- Comunidad: guardar contactos por nombre y @usuario, filtrar la lista, eliminarlos y abrir un chat local vinculado. Los contactos son locales y no representan cuentas verificadas.

- Interfaz actualizada: brillo progresivo del logo durante 4,5 s, entrada directa a Mensajes, perfil personalizable, ajustes visibles, recorrido guiado por iconos y aviso de bienvenida que desaparece a los 10 s.
- Cuentas/contactos/mensajes entre distintos dispositivos: pendiente de backend; los datos actuales son locales al navegador.


## Interacción de mensajes y navegación (actualización 0.3)
- Pantalla de carga con halo y brillo progresivo del logo original durante 4,5 segundos.
- Recorrido emergente ampliado y forzado una vez para la versión 2 del tour; resalta iconos y ofrece progreso, omitir y continuar.
- Animación breve al cambiar de sección.
- Responder mensajes y añadir una reacción emoji en mensajes locales.
- Grabar notas de voz con permiso del micrófono del navegador y reproducirlas localmente.
- Botones de llamada y videollamada visibles; informan claramente que no se conectan todavía entre usuarios porque falta backend/señalización.
- Mensajes, reacciones y audio siguen siendo locales; no representan entrega remota.
