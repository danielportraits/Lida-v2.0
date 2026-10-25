# Seguridad y privacidad — decisiones iniciales

Este documento describe objetivos y límites; no certifica que la aplicación sea segura para producción.

## Estado actual
- Los datos de la demo se guardan en `localStorage`.
- No hay cuentas ni servidor.
- No hay cifrado de extremo a extremo.
- No se debe almacenar información sensible.
- La caché del service worker puede mantener recursos estáticos en el dispositivo.

## Requisitos antes de producción
1. Usar HTTPS y sesiones seguras; evitar tokens sensibles persistidos en `localStorage`.
2. Validar autorización en el servidor para cada conversación, medio y acción.
3. Diseñar cifrado en tránsito y, si se promete, cifrado de extremo a extremo con revisión criptográfica independiente.
4. No exponer claves privadas o secretos de proveedores en el bundle web.
5. Aplicar controles de abuso, rate limits, reporte, bloqueo y gestión de incidentes.
6. Documentar qué datos se recopilan, finalidad, retención, eliminación y exportación.
7. Pedir consentimiento claro para notificaciones, contactos, cámara, micrófono y ubicación si se usan.
8. Evitar registrar contenido privado en analítica o logs.
9. Definir proceso de borrado de cuenta y sus datos asociados.
10. Realizar análisis de dependencias, pruebas de penetración y revisión legal aplicable.

## Reglas de diseño
- Privacidad por defecto.
- Permisos mínimos.
- No solicitar permisos del dispositivo hasta que una función los necesite.
- Explicar con claridad qué es local y qué se sincroniza.
- No presentar una respuesta placeholder como una acción completada.
