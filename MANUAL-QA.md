## Marca y pantalla de carga
- [ ] La pantalla inicial muestra el archivo original `assets/brand/lida-logo-original.png`.
- [ ] No aparece una barra de progreso.
- [ ] El logo tiene un destello lento y respeta `prefers-reduced-motion`.
- [ ] La cabecera y el icono de instalación usan el logo original.
- [ ] La maqueta aprobada está conservada sin alteraciones en `assets/brand/lida-interface-reference.png`.

# Pruebas manuales de aceptación

## Navegación
- [ ] Chats, Estados, Play, Reels, Perfil y AI abren la vista correcta.
- [ ] El acceso rápido al avatar abre Perfil.
- [ ] El botón de volver desde una conversación regresa a Chats.

## Chats
- [ ] Buscar por nombre y texto de vista previa.
- [ ] Cambiar filtros y comprobar resultados.
- [ ] Abrir una conversación y enviar un mensaje.
- [ ] Recargar y comprobar que los mensajes locales persisten.
- [ ] Crear una conversación local.
- [ ] Alternar favorito y limpiar mensajes.

## Estados y perfil
- [ ] Crear un estado con texto.
- [ ] Editar nombre, usuario y biografía.
- [ ] Recargar y comprobar persistencia local.

## LIDA AI
- [ ] Los botones de sugerencia agregan mensajes.
- [ ] El formulario acepta texto y muestra claramente una respuesta de demostración.

## PWA y accesibilidad
- [ ] El manifest carga sin error.
- [ ] El service worker registra bajo HTTPS o localhost.
- [ ] No hay desbordamiento horizontal en pantalla móvil.
- [ ] Los controles son utilizables con teclado y lector de pantalla.
- [ ] La interfaz respeta la preferencia de movimiento reducido.


## Validación de versión base 0.2.0
- [ ] Al iniciar una cuenta nueva solo existe el chat de bienvenida de LIDA.
- [ ] La guía muestra seis pasos, se puede omitir y reabrir desde Perfil → Ayuda y guía.
- [ ] En Comunidad no aparecen usuarios ficticios.
- [ ] Mensajes locales se conservan al recargar en el mismo navegador.
- [ ] Tres en raya permite dos jugadores locales, gana quien alinee tres símbolos y permite reiniciar.
- [ ] Luz camina revela casillas rojas (reto), verdes (verdad) y vacías.
- [ ] El perfil puede editarse y conservarse localmente.
- [ ] La interfaz es utilizable en móvil y escritorio; no hay desbordamiento horizontal.
- [ ] La PWA instala/carga el shell en HTTPS o localhost.
- [ ] La documentación deja claro que no hay backend ni multijugador en línea.
