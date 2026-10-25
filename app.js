import { readJSON, writeJSON } from "./storage.js";
import { initializeAuth } from "./supabase-auth.js";
import { supabase } from "./supabase-auth.js";
// La autenticación se valida antes de inicializar el estado local de la interfaz.
await initializeAuth();
import { showView, setupNavigation } from "./navigation.js";
import { openDialog, closeDialog, toast } from "./dialogs.js";

const welcomeChat = { id: "lida-welcome", name: "LIDA", userHandle: "@lida", lastMessage: "¡Bienvenido! Estoy aquí para ayudarte a conocer LIDA.", time: "Ahora", unread: false, favorite: true, online: false, system: true };
const state = {
  chats: readJSON("lida.chats", [welcomeChat]).filter(chat => chat.id === "lida-welcome"),
  messages: { "lida-welcome": readJSON("lida.messages", { "lida-welcome": [{ text: "¡Hola! 👋 Te doy la bienvenida a LIDA. Aquí podrás descubrir la comunidad, conversar y jugar. Explora la aplicación con la guía inicial.", mine: false, time: "Ahora", system: true }] })["lida-welcome"] || [{ text: "¡Hola! 👋 Te doy la bienvenida a LIDA. Aquí podrás descubrir la comunidad, conversar y jugar. Explora la aplicación con la guía inicial.", mine: false, time: "Ahora", system: true }] },
  statuses: readJSON("lida.statuses", []).filter(status => status.createdAt && Date.now() - new Date(status.createdAt).getTime() < 86400000),
  preferences: readJSON("lida.preferences", { accent: "#71ff9b", bubble: "#174b2a", chatBackground: "#080d0a", bubbleStyle: "solid", fontSize: 13, radius: 16, notifications: true, temporarySeconds: 0, chatNotifications: {} }),
  filter: "all",
  activeChatId: null,
  profile: readJSON("lida.profile", { name: "", handle: "", bio: "" }),
  registered: readJSON("lida.registered", false),
  guideCompleted: readJSON("lida.guideCompleted", false),
  guideSkipped: readJSON("lida.guideSkipped", false),
  guideVersion: readJSON("lida.guideVersion", 0),
  replyTo: null,
  mediaRecorder: null,
  recordingChunks: [],
  pendingVoice: null,
  guideStep: 0,
  directory: readJSON("lida.localContacts", [])
};
if (!state.chats.some(chat => chat.id === "lida-welcome")) state.chats.unshift(welcomeChat);
if (!state.messages["lida-welcome"] || !state.messages["lida-welcome"].length) state.messages["lida-welcome"] = [{ text: "¡Hola! 👋 Te doy la bienvenida a LIDA. Aquí podrás descubrir la comunidad, conversar y jugar. Explora la aplicación con la guía inicial.", mine: false, time: "Ahora", system: true }];
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
const initials = name => name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase();

// Keep the legacy UI profile synchronized after Supabase authentication.
window.addEventListener("lida:authenticated", () => {
  state.profile = readJSON("lida.profile", { name: "", handle: "", bio: "" });
  state.registered = true;
  renderProfile();
});

function persist() {
  writeJSON("lida.chats", state.chats);
  writeJSON("lida.messages", state.messages);
  writeJSON("lida.statuses", state.statuses);
  writeJSON("lida.preferences", state.preferences);
  writeJSON("lida.profile", state.profile);
  writeJSON("lida.registered", state.registered);
  writeJSON("lida.userDirectory", state.directory);
  writeJSON("lida.localContacts", state.directory);
  writeJSON("lida.guideCompleted", state.guideCompleted);
  writeJSON("lida.guideSkipped", state.guideSkipped);
  writeJSON("lida.guideVersion", state.guideVersion);
}
function renderChats() {
  const query = ($("#chat-search").value || "").toLowerCase().trim();
  const chats = state.chats.filter(chat => !chat.archived).sort((a,b) => Number(!!b.pinned)-Number(!!a.pinned)).filter(chat => {
    const matchesQuery = `${chat.name} ${chat.lastMessage || ""}`.toLowerCase().includes(query);
    const matchesFilter = state.filter === "all" || (state.filter === "unread" && chat.unread) || (state.filter === "favorites" && chat.favorite);
    return matchesQuery && matchesFilter;
  });
  $("#chat-list").innerHTML = chats.map(chat => `<button class="chat-row" data-chat-id="${esc(chat.id)}">
    <span class="avatar ${chat.online ? "online-avatar" : ""}">${esc(initials(chat.name))}</span>
    <span class="chat-copy"><span class="chat-title-line"><strong>${esc(chat.name)}</strong><time>${esc(chat.time || "")}</time></span><span class="chat-preview">${chat.unread ? '<i class="unread-dot"></i>' : ""}${esc(chat.lastMessage || "Inicia una conversación")}</span></span>
    ${chat.favorite ? '<span class="favorite-mark" aria-label="Favorito">★</span>' : ""}
  </button>`).join("");
  $("#chat-empty").classList.toggle("hidden", chats.length > 0);
}

function renderConversation(chatId) {
  const chat = state.chats.find(item => item.id === chatId);
  if (!chat) return;

  state.activeChatId = chatId;
  chat.unread = false;

  $("#conversation-name").textContent = chat.name;
  $("#conversation-avatar").textContent = initials(chat.name);
  $("#conversation-status").textContent = chat.system
    ? "Asistente de bienvenida · local"
    : "Conversación local";

  const expirySeconds = Number(state.preferences.temporarySeconds || 0);

  if (expirySeconds) {
    state.messages[chatId] = (state.messages[chatId] || []).filter(
      message =>
        !message.sentAt ||
        Date.now() - new Date(message.sentAt).getTime() <
          expirySeconds * 1000
    );
  }

  const messages = state.messages[chatId] || [];

  $("#message-list").innerHTML =
    `<div class="date-divider"><span>HOY</span></div>` +
    messages.map((message, index) => `
      <div class="message ${message.mine ? "mine" : "theirs"}"
           data-message-index="${index}">
        ${message.replyText
          ? `<div class="reply-quote">↳ ${esc(message.replyText)}</div>`
          : ""}
        ${message.type === "voice"
          ? `<audio controls preload="metadata" src="${message.audio}"></audio>
             <p>🎙 Nota de voz · ${esc(message.duration || "audio")}</p>`
          : `<p>${esc(message.text || "")}</p>`}
        <div class="message-tools">
          <time>${esc(message.time || "")}</time>
        </div>
        ${message.reaction
          ? `<span class="message-reaction">${esc(message.reaction)}</span>`
          : ""}
      </div>
    `).join("");

  $("#message-list").scrollTop = $("#message-list").scrollHeight;

  persist();
  renderChats();
  showView("conversation");
}

async function sendSupabaseMessage(conversationId, text) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Debes iniciar sesión para enviar mensajes.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: text,
      message_type: "text"
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

async function createSupabaseConversation(otherUserId) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Debes iniciar sesión para crear una conversación.");
  }

  if (!otherUserId || otherUserId === user.id) {
    throw new Error("Selecciona otro usuario válido.");
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({
      created_by: user.id,
      is_group: false,
      title: null
    })
    .select("id")
    .single();

  if (conversationError) throw conversationError;

  const { error: participantsError } = await supabase
    .from("conversation_participants")
    .insert([
      { conversation_id: conversation.id, user_id: user.id },
      { conversation_id: conversation.id, user_id: otherUserId }
    ]);

  if (participantsError) throw participantsError;

  return conversation.id;
}

function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || !state.activeChatId) return;

  const messages = state.messages[state.activeChatId] || [];
  const time = new Date().toLocaleTimeString("es-DO", {
    hour: "2-digit",
    minute: "2-digit"
  });

  messages.push({
    text: trimmed,
    mine: true,
    time,
    sentAt: new Date().toISOString(),
    ...(state.replyTo
      ? { replyText: state.replyTo.text || "Nota de voz" }
      : {})
  });

  state.replyTo = null;

  const replyBanner = $("#reply-banner");
  if (replyBanner) replyBanner.remove();

  state.messages[state.activeChatId] = messages;

  const chat = state.chats.find(
    item => item.id === state.activeChatId
  );

  if (chat) {
    chat.lastMessage = trimmed;
    chat.time = time;
  }

  persist();
  renderConversation(state.activeChatId);
}

function renderFriends() {
  const input = $("#friend-search");
  const query = (input?.value || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");

  const friends = state.directory.filter(person =>
    `${person.name} ${person.handle}`.toLowerCase().includes(query)
  );

  const list = $("#friend-list");
  const count = $("#friend-count");

  if (!list || !count) return;

  count.textContent = String(state.directory.length);

  list.innerHTML = friends.length
    ? friends.map(person => `
        <article class="friend-result">
          <span class="avatar">${esc(initials(person.name))}</span>
          <div class="friend-result-copy">
            <strong>${esc(person.name)}</strong>
            <small>${esc(person.handle)} · contacto local</small>
          </div>
          <button class="secondary-button"
                  data-contact-chat="${esc(person.id)}">
            Mensaje
          </button>
          <button class="icon-button"
                  data-contact-remove="${esc(person.id)}"
                  aria-label="Eliminar ${esc(person.name)}">×</button>
        </article>
      `).join("")
    : `<div class="friend-empty">${
        query
          ? "No hay contactos que coincidan con la búsqueda."
          : "Todavía no has agregado contactos. Pulsa «Agregar persona» para guardar uno."
      }</div>`;
}


function openNewChat() {
  openDialog(`
    <p class="eyebrow">COMUNIDAD LIDA</p>
    <h2>Buscar persona</h2>
    <p>Busca una cuenta registrada usando su nombre de usuario.</p>

    <label class="field-label" for="contact-handle">Nombre de usuario</label>
    <div class="username-input-wrap">
      <span>@</span>
      <input
        id="contact-handle"
        class="dialog-input"
        maxlength="20"
        placeholder="usuario"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
      >
    </div>

    <button class="primary-button full-width" id="search-contact">
      Buscar usuario
    </button>
    <div id="contact-search-result" aria-live="polite"></div>
  `);

  $("#search-contact").addEventListener("click", async () => {
    const input = $("#contact-handle");
    const result = $("#contact-search-result");
    const button = $("#search-contact");
    const handle = input.value.trim().replace(/^@/, "").toLowerCase();

    if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
      result.textContent = "Escribe un usuario válido (3–20 letras, números o guiones bajos).";
      return;
    }

    button.disabled = true;
    result.textContent = "Buscando usuario…";

    try {
      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Inicia sesión para buscar usuarios.");

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("username", handle)
        .maybeSingle();

      if (error) throw error;

      if (!profile) {
        result.textContent = "No encontramos una cuenta con ese usuario.";
        return;
      }

      if (profile.id === user.id) {
        result.textContent = "Ese es tu propio usuario.";
        return;
      }

      result.replaceChildren();

      const name = document.createElement("p");
      name.textContent = profile.display_name || profile.username;

      const username = document.createElement("p");
      username.textContent = "@" + profile.username;

      const addButton = document.createElement("button");
      addButton.className = "primary-button full-width";
      addButton.textContent = "Enviar solicitud de contacto";

      result.append(name, username, addButton);

      addButton.addEventListener("click", async () => {
        addButton.disabled = true;
        addButton.textContent = "Enviando solicitud…";

        try {
          const { error: requestError } = await supabase
            .from("contacts")
            .insert({
              requester_id: user.id,
              addressee_id: profile.id,
              status: "pending"
            });

          if (requestError) {
            if (requestError.code === "23505") {
              throw new Error("Ya existe una solicitud o contacto entre estas cuentas.");
            }
            throw requestError;
          }

          result.textContent = "Solicitud de contacto enviada.";
        } catch (error) {
          console.error("Error al enviar solicitud:", error);
          result.textContent = error.message || "No se pudo enviar la solicitud.";
          addButton.disabled = false;
          addButton.textContent = "Reintentar solicitud";
        }
      });
    } catch (error) {
      console.error("Error al buscar usuario:", error);
      result.textContent = error.message || "No se pudo buscar el usuario.";
    } finally {
      button.disabled = false;
    }
  });
}

async function loadContactRequests() {
  const list = $("#contact-request-list");
  const count = $("#contact-request-count");

  if (!list || !count) return;

  list.classList.remove("hidden");
  list.textContent = "Cargando solicitudes…";

  try {
    const { data: { user }, error: authError } =
      await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error("Inicia sesión para ver tus solicitudes.");

    const { data: requests, error } = await supabase
      .from("contacts")
      .select("id, requester_id, created_at")
      .eq("addressee_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    count.textContent = String(requests.length);

    if (!requests.length) {
      list.textContent = "No tienes solicitudes pendientes.";
      return;
    }

    const requesterIds = [...new Set(requests.map(r => r.requester_id))];

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", requesterIds);

    if (profilesError) throw profilesError;

    const profilesById = new Map(
      profiles.map(profile => [profile.id, profile])
    );

    list.replaceChildren();

    requests.forEach(request => {
      const profile = profilesById.get(request.requester_id);
      if (!profile) return;

      const item = document.createElement("article");
      item.className = "friend-result";

      const info = document.createElement("div");
      info.className = "friend-result-copy";

      const name = document.createElement("strong");
      name.textContent = profile.display_name || profile.username;

      const username = document.createElement("small");
      username.textContent = "@" + profile.username;

      info.append(name, username);

      const accept = document.createElement("button");
      accept.className = "primary-button";
      accept.textContent = "Aceptar";

      const reject = document.createElement("button");
      reject.className = "secondary-button";
      reject.textContent = "Rechazar";

      accept.addEventListener("click", async () => {
        accept.disabled = true;
        reject.disabled = true;

        try {
          const { data: updated, error: updateError } = await supabase
            .from("contacts")
            .update({ status: "accepted" })
            .eq("id", request.id)
            .eq("addressee_id", user.id)
            .eq("status", "pending")
            .select("id")
            .maybeSingle();

          if (updateError) throw updateError;
          if (!updated) {
            throw new Error("La solicitud ya no está pendiente o no se pudo actualizar.");
          }

        
const conversationId = await createSupabaseConversation(
  request.requester_id
);

console.log("Conversación creada:", conversationId);


          

          toast("Solicitud aceptada. Conversación creada.");
          await loadContactRequests();
        } catch (error) {
          console.error("Error al aceptar solicitud:", error);
          toast(error.message || "No se pudo aceptar la solicitud.");
          accept.disabled = false;
          reject.disabled = false;
        }
      });

      reject.addEventListener("click", async () => {
        accept.disabled = true;
        reject.disabled = true;

        try {
          const { error: deleteError } = await supabase
            .from("contacts")
            .delete()
            .eq("id", request.id)
            .eq("addressee_id", user.id);

          if (deleteError) throw deleteError;

          toast("Solicitud rechazada.");
          await loadContactRequests();
        } catch (error) {
          console.error("Error al rechazar solicitud:", error);
          toast(error.message || "No se pudo rechazar la solicitud.");
          accept.disabled = false;
          reject.disabled = false;
        }
      });

      item.append(info, accept, reject);
      list.append(item);
    });
  } catch (error) {
    console.error("Error al cargar solicitudes:", error);
    list.textContent = error.message || "No se pudieron cargar las solicitudes.";
  }
}

function openRegistration() {
  openDialog(`<div class="registration-mark"><img src="./lida-logo-original.png" alt="LIDA"></div><p class="eyebrow">BIENVENIDO A LIDA</p><h2>Personaliza tu cuenta</h2><p class="muted">Crea tu perfil con nombre visible y usuario único. Esta versión guarda la cuenta en este navegador; para que el usuario sea único en todos los dispositivos y pueda recibir mensajes reales hace falta conectar un servidor.</p><label class="field-label" for="register-name">Nombre para mostrar</label><input id="register-name" class="dialog-input" maxlength="50" placeholder="Tu nombre" autocomplete="name"><label class="field-label" for="register-handle">Nombre de usuario</label><div class="username-input-wrap"><span>@</span><input id="register-handle" class="dialog-input" maxlength="20" placeholder="tu_usuario" autocomplete="username" autocapitalize="none" spellcheck="false"></div><label class="field-label" for="register-bio">Biografía (opcional)</label><textarea id="register-bio" class="dialog-input" maxlength="160" rows="2" placeholder="Cuéntale algo a la comunidad"></textarea><button class="primary-button full-width" id="complete-registration">Guardar perfil y entrar</button>`);
  $("#complete-registration").addEventListener("click", () => {
    const name = $("#register-name").value.trim();
    const handle = $("#register-handle").value.trim().replace(/^@/, "").toLowerCase();
    const bio = $("#register-bio").value.trim();
    if (!name) { toast("Escribe tu nombre para mostrar."); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) { toast("El usuario debe tener de 3 a 20 caracteres: letras, números o guion bajo."); return; }
    const accounts = readJSON("lida.localAccounts", []);
    if (accounts.some(account => account.handle === `@${handle}`)) { toast("Ese usuario ya está guardado en este navegador."); return; }
    state.profile = { name, handle: `@${handle}`, bio };
    state.registered = true;
    accounts.push({ handle: state.profile.handle, name, bio, createdAt: new Date().toISOString() });
    writeJSON("lida.localAccounts", accounts);
    persist(); renderProfile(); closeDialog(); showView("chats");
    showWelcomeToast();
    if (!state.guideCompleted && !state.guideSkipped) openGuide();
  });
}
function showWelcomeToast() {
  const element = $("#welcome-notice");
  if (!element) return;
  element.classList.add("visible");
  window.setTimeout(() => element.classList.remove("visible"), 10000);
}
function openStatusDialog() {
  openDialog(`<p class="eyebrow">COMPARTE UN MOMENTO</p><h2>Crear estado</h2><label class="field-label" for="status-media">Foto o vídeo (opcional)</label><input id="status-media" class="dialog-input" type="file" accept="image/*,video/*"><label class="field-label" for="status-text">Descripción (opcional)</label><textarea id="status-text" class="dialog-input" maxlength="240" rows="3" placeholder="Añade una descripción…"></textarea><p class="muted">El archivo y el texto se guardan solo en este navegador en esta versión.</p><button class="primary-button full-width" id="publish-status">Publicar estado</button>`);
  $("#publish-status").addEventListener("click", () => {
    const text = $("#status-text").value.trim(); const file = $("#status-media").files?.[0];
    if (!text && !file) { toast("Añade una foto, un vídeo o una descripción."); return; }
    const save = media => { state.statuses.unshift({ id: `status-${Date.now()}`, name: state.profile.name || "Mi perfil", text, media, mediaType:file?.type || "", time: "Ahora", createdAt: new Date().toISOString(), own: true }); persist(); renderStatuses(); closeDialog(); toast("Estado guardado en este dispositivo."); };
    if(file){ if(file.size>8*1024*1024){toast("El archivo debe pesar menos de 8 MB.");return;} const reader=new FileReader(); reader.onload=()=>save(reader.result); reader.readAsDataURL(file); } else save(null);
  });
}
function renderStatuses() {
  state.statuses = state.statuses.filter(status => status.createdAt && Number.isFinite(new Date(status.createdAt).getTime()) && Date.now() - new Date(status.createdAt).getTime() < 86400000);
  persist();
  $("#status-list").innerHTML = state.statuses.map(status => `<article class="status-row"><div class="status-ring"><div class="avatar">${esc(initials(status.name))}</div></div><div class="status-copy"><h3>${esc(status.name)} ${status.own ? '<span class="muted-inline">(tú)</span>' : ""}</h3>${status.media ? (status.mediaType.startsWith("video/") ? `<video class="status-media" controls preload="metadata" src="${status.media}"></video>` : `<img class="status-media" src="${status.media}" alt="Foto de estado">`) : ""}<p>${esc(status.text || "")}</p><small>${esc(status.time || "")}</small></div></article>`).join("");
}
function openGuide() {
  const steps = [
    { target: "chats", icon: "▤", title: "Mensajes", text: "Este es el inicio de LIDA. Aquí aparecen tus conversaciones y puedes abrir cualquier chat." },
    { target: "estados", icon: "◎", title: "Comunidad", text: "Aquí agregas personas, buscas tus contactos y abres una conversación. Las solicitudes reales entre cuentas requieren el servidor de LIDA." },
    { target: "chats", icon: "▤", title: "Mensajes", text: "Encuentra tus conversaciones y escribe desde la parte inferior. Mantén presente que los mensajes se guardan localmente hasta conectar Supabase." },
    { target: "chats", icon: "↩", title: "Acciones de mensaje", text: "Mantén pulsado un mensaje para abrir el menú: reaccionar, responder, reenviar o compartir." },
    { target: "chats", icon: "🎙", title: "Notas de voz y llamadas", text: "Puedes grabar una nota de voz en este dispositivo. Las llamadas muestran el acceso, pero solo funcionarán entre personas cuando conectemos el servicio en línea." },
    { target: "play", icon: "▷", title: "Games", text: "Entra a los minijuegos disponibles. Las salas en línea, invitaciones y resultados compartidos necesitan backend." },
    { target: "profile", icon: "◌", title: "Perfil", text: "Personaliza tu nombre, nombre de usuario y biografía. Desde aquí también puedes abrir las opciones de privacidad y apariencia." },
    { target: "profile", icon: "⚙", title: "Configuración", text: "El engranaje de la esquina superior derecha abre configuración: apariencia, privacidad, ayuda y opciones de cuenta." }
  ];
  state.guideStep = Math.max(0, Math.min(state.guideStep, steps.length - 1));
  const render = () => {
    const step = steps[state.guideStep];
    if (step.target && step.target !== "chats" && step.target !== "conversation") showView(step.target); else if (step.target === "chats") showView("chats");
    $$(".nav-item").forEach(item => item.classList.toggle("tour-focus", item.dataset.target === step.target));
    const gear = $("#settings-shortcut"); if (gear) gear.classList.toggle("tour-focus", step.title === "Configuración");
    openDialog(`<div class="tour-icon">${step.icon}</div><p class="eyebrow">RECORRIDO · ${state.guideStep + 1} DE ${steps.length}</p><div class="guide-progress">${steps.map((_,i)=>`<span class="${i <= state.guideStep ? "done" : ""}"></span>`).join("")}</div><h2>${step.title}</h2><p>${step.text}</p><div class="guide-actions"><button class="secondary-button" id="guide-skip">Omitir</button><button class="primary-button" id="guide-next">${state.guideStep === steps.length - 1 ? "Terminar" : "Siguiente"}</button></div>`);
    $("#guide-skip").addEventListener("click", () => { state.guideSkipped = true; persist(); $$(".tour-focus").forEach(item => item.classList.remove("tour-focus")); closeDialog(); toast("Puedes volver a abrir el recorrido desde Perfil → Ayuda."); });
    $("#guide-next").addEventListener("click", () => {
      if (state.guideStep >= steps.length - 1) { state.guideCompleted = true; state.guideVersion = 4; persist(); $$(".tour-focus").forEach(item => item.classList.remove("tour-focus")); closeDialog(); toast("Recorrido completado."); return; }
      state.guideStep += 1; render();
    });
  };
  render();
}
function openTicTacToe() {
  let board = Array(9).fill(""); let turn = "X"; let finished = false; let moves = 0;
  const winner = () => { for (const [a,b,c] of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]; return board.every(Boolean) ? "draw" : null; };
  const render = () => {
    const result = winner(); if (result) finished = true;
    openDialog(`<p class="eyebrow">GAMES · LOCAL</p><h2>Tres en raya</h2><p>${result ? (result === "draw" ? "Empate." : `Gana ${result === "X" ? "Jugador 1 (X)" : "Jugador 2 (O)"}.`) : `Turno de ${turn === "X" ? "Jugador 1 (X)" : "Jugador 2 (O)"}`}</p><div class="ttt-board">${board.map((cell,i)=>`<button class="ttt-cell" data-cell="${i}" ${cell || finished ? "disabled" : ""}>${cell}</button>`).join("")}</div><p class="demo-notice">Modo local para dos personas en este dispositivo; no es multijugador en línea.</p><button class="primary-button full-width" id="ttt-reset">${finished ? "Jugar de nuevo" : "Reiniciar partida"}</button>`);
    $$("[data-cell]").forEach(button => button.addEventListener("click", () => { const i=Number(button.dataset.cell); if (board[i] || finished) return; board[i]=turn; moves++; const win=winner(); if (!win) turn=turn === "X" ? "O" : "X"; render(); }));
    $("#ttt-reset").addEventListener("click", () => { board=Array(9).fill(""); turn="X"; finished=false; moves=0; render(); });
  }; render();
}
function openLuzCamina() {
  const board = Array.from({length:16}, (_,i)=>({id:i,type:Math.random()<.28?"reto":Math.random()<.5?"verdad":"vacia",open:false}));
  const render = () => {
    openDialog(`<p class="eyebrow">GAMES · LOCAL</p><h2>Luz camina</h2><p>Descubre casillas: rojo = reto, verde = verdad y vacía = sigue jugando.</p><div class="mines-board">${board.map(cell=>`<button class="mine-cell ${cell.open ? cell.type : ""}" data-mine="${cell.id}" ${cell.open?"disabled":""}>${cell.open ? (cell.type === "reto" ? "!" : cell.type === "verdad" ? "✓" : "·") : "?"}</button>`).join("")}</div><p id="mine-message" class="muted">Toca una casilla para revelar qué contiene.</p><p class="demo-notice">Tablero local de demostración. No hay salas ni jugadores remotos.</p><button class="primary-button full-width" id="mine-reset">Nuevo tablero</button>`);
    $$("[data-mine]").forEach(button=>button.addEventListener("click",()=>{const cell=board[Number(button.dataset.mine)]; cell.open=true; const msg=cell.type === "reto" ? "🔴 ¡Te ha tocado un reto! Elige uno seguro y divertido." : cell.type === "verdad" ? "🟢 ¡Te ha tocado verdad! Responde una pregunta si quieres." : "⬜ Casilla vacía. ¡Puedes seguir!"; render(); const message=$("#mine-message"); if(message) message.textContent=msg;}));
    $("#mine-reset").addEventListener("click",openLuzCamina);
  }; render();
}
function openHangman() {
  const levels=[{name:"Fácil",hint:"Brilla en el cielo durante la noche.",words:["LUNA","CASA","GATO","FLOR"]},{name:"Medio",hint:"Es el planeta donde vivimos.",words:["PLANETA","AMISTAD","VENTANA","TECLADO"]},{name:"Difícil",hint:"Grupo de estrellas que parece dibujar una figura.",words:["CONSTELACION","LABERINTO","INVISIBLE","AVENTURA"]}]; let level=0,word="",guessed=[],misses=0;
  const hints={LUNA:"Brilla en el cielo durante la noche.",CASA:"Lugar donde vive una familia.",GATO:"Animal doméstico que maúlla.",FLOR:"Parte colorida de muchas plantas.",PLANETA:"Cuerpo celeste que orbita una estrella.",AMISTAD:"Relación de afecto entre amigos.",VENTANA:"Abertura por la que entra luz y aire.",TECLADO:"Se usa para escribir en una computadora.",CONSTELACION:"Grupo de estrellas que forma una figura.",LABERINTO:"Camino complicado con muchas vueltas.",INVISIBLE:"Que no se puede ver.",AVENTURA:"Experiencia emocionante e inesperada."};const start=()=>{word=levels[level].words[Math.floor(Math.random()*levels[level].words.length)];levels[level].hint=hints[word];guessed=[];misses=0;render();};
  const render=()=>{const won=[...word].every(c=>guessed.includes(c));const lost=misses>=6;const stages=["","<circle cx='70' cy='30' r='12'/>","<circle cx='70' cy='30' r='12'/><path d='M70 42V76'/>","<circle cx='70' cy='30' r='12'/><path d='M70 42V76M70 52L52 66'/>","<circle cx='70' cy='30' r='12'/><path d='M70 42V76M70 52L52 66M70 52L88 66'/>","<circle cx='70' cy='30' r='12'/><path d='M70 42V76M70 52L52 66M70 52L88 66M70 76L54 96'/>","<circle cx='70' cy='30' r='12'/><path d='M70 42V76M70 52L52 66M70 52L88 66M70 76L54 96M70 76L86 96'/>"][misses];openDialog(`<p class="eyebrow">GAMES · AHORCADO</p><h2>El ahorcado</h2><div class="game-level">Nivel ${level+1} · ${levels[level].name}</div><svg class="hangman-drawing" viewBox="0 0 130 115" role="img" aria-label="Dibujo del ahorcado"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 105H112M35 105V12H70V18"/>${stages}</g></svg><p class="hangman-hint"><strong>Pista:</strong> ${levels[level].hint}</p><div class="hangman-word">${[...word].map(c=>guessed.includes(c)||won?c:"_ ").join(" ")}</div><p>${lost?`La palabra era ${word}.`:won?"¡Correcto! Has completado el nivel.":`Errores: ${misses}/6`}</p><div class="letter-grid">${"ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("").map(c=>`<button data-letter="${c}" ${guessed.includes(c)||won||lost?"disabled":""}>${c}</button>`).join("")}</div><p class="demo-notice">Partida local; puedes jugar por turnos en el mismo dispositivo.</p><button class="primary-button full-width" id="hangman-next">${won&&level<2?"Siguiente nivel":"Nueva palabra"}</button>`);$$('[data-letter]').forEach(b=>b.addEventListener('click',()=>{const c=b.dataset.letter;if(!guessed.includes(c)){guessed.push(c);if(!word.includes(c))misses++;}render();}));$('#hangman-next').addEventListener('click',()=>{if(won&&level<2)level++;start();});};start();
}
function openWordComplete(){const sets=[{name:"Fácil",items:[["C_S_","CASA"],["L_N_","LUNA"],["G_T_","GATO"]]},{name:"Medio",items:[["AM_ST_D","AMISTAD"],["PL_N_T_","PLANETA"]]},{name:"Difícil",items:[["C_NST_L_CI_N","CONSTELACION"],["L_B_R_NT_","LABERINTO"]]}];let level=0,idx=0;const render=()=>{const [mask,answer]=sets[level].items[idx];openDialog(`<p class="eyebrow">GAMES · COMPLETAR</p><h2>Completa la palabra</h2><div class="game-level">Nivel ${level+1} · ${sets[level].name}</div><div class="hangman-word">${mask}</div><label class="field-label" for="word-answer">Escribe la palabra completa</label><input id="word-answer" class="dialog-input" autocomplete="off" autocapitalize="characters"><p id="word-feedback" class="muted">Completa las letras que faltan.</p><button class="primary-button full-width" id="word-check">Comprobar</button>`);$('#word-check').addEventListener('click',()=>{if($('#word-answer').value.trim().toUpperCase()===answer){if(idx+1<sets[level].items.length)idx++;else if(level<2){level++;idx=0;}else{level=0;idx=0;}render();}else $('#word-feedback').textContent='Todavía no. Inténtalo de nuevo.';});};render();}
function openWordSearch(){
  const words=["SOL","LUNA","GATO","FLOR"];const rows=["S O L A R T E","L U N A C A S","G A T O M E S","F L O R P I N","A M I G O S X","R E D O L U Z","C A S A T R E"];let found=[];
  const render=()=>{openDialog(`<p class="eyebrow">GAMES · SOPA DE LETRAS</p><h2>Encuentra las palabras</h2><p>Busca las palabras de la lista y tócalas cuando las encuentres. Este modo de demostración marca palabras al seleccionarlas.</p><div class="wordsearch-grid">${rows.map(r=>`<div>${r.split(" ").map(c=>`<span>${c}</span>`).join("")}</div>`).join("")}</div><div class="word-list">${words.map(w=>`<button data-word="${w}" class="${found.includes(w)?"found":""}">${found.includes(w)?"✓ ":""}${w}</button>`).join("")}</div><p>${found.length}/${words.length} encontradas</p><button class="secondary-button full-width" id="wordsearch-reset">Reiniciar</button>`);$$('[data-word]').forEach(b=>b.addEventListener('click',()=>{if(!found.includes(b.dataset.word))found.push(b.dataset.word);render();}));$('#wordsearch-reset').addEventListener('click',()=>{found=[];render();});};render();
}
function openTruthDare(){let turn=1,kind="verdad",confirmed=false;const truths=["¿Qué pequeño detalle te alegra el día?","¿Qué habilidad te gustaría aprender?","¿Cuál es un recuerdo que te hace sonreír?"];const dares=["Haz una pose dramática durante cinco segundos.","Inventa un saludo secreto para ambos.","Describe una película usando solo gestos."];let prompt="";const render=()=>{prompt=kind==="verdad"?truths[Math.floor(Math.random()*truths.length)]:dares[Math.floor(Math.random()*dares.length)];openDialog(`<p class="eyebrow">GAMES · DOS JUGADORES</p><h2 class="truth-title">${kind==="verdad"?"💬 Verdad":"⚡ Reto"}</h2><div class="truth-card"><span class="truth-turn">Turno del jugador ${turn}</span><p>${prompt}</p><small>Respeta los límites de la otra persona: siempre se puede pasar.</small></div><div class="truth-actions"><button class="secondary-button" id="truth-pass">Pasar</button><button class="primary-button" id="truth-done">Ya cumplí</button></div><p class="muted">El otro jugador debe confirmar para avanzar.</p><button class="secondary-button full-width" id="truth-confirm">Confirmar cumplimiento del jugador ${turn}</button><button class="secondary-button full-width" id="truth-voice">🎙 Chat de voz durante el juego</button>`);$('#truth-pass').addEventListener('click',()=>{kind=kind==="verdad"?"reto":"verdad";render();});$('#truth-done').addEventListener('click',()=>{toast("Esperando confirmación del otro jugador.");$('#truth-confirm').classList.add('primary-button');});$('#truth-confirm').addEventListener('click',()=>{turn=turn===1?2:1;kind=Math.random()>.5?"verdad":"reto";render();});$('#truth-voice').addEventListener('click',()=>openDialog(`<p class="eyebrow">CHAT DE VOZ</p><h2>Voz durante el juego</h2><p>El acceso está preparado, pero la voz entre dos cuentas requiere conexión en tiempo real y señalización. No se iniciará una llamada falsa.</p>`));};render();}

function openHelp() { openDialog(`<p class="eyebrow">AYUDA</p><h2>Ayuda de LIDA</h2><p>Vuelve a consultar el recorrido guiado y las funciones de LIDA.</p><button class="primary-button full-width" id="reopen-guide">Abrir guía de LIDA</button><button class="secondary-button full-width" id="show-version-info">Estado y límites de la demo</button>`); $("#reopen-guide").addEventListener("click",()=>{closeDialog();state.guideStep=0;openGuide();}); $("#show-version-info").addEventListener("click",()=>{closeDialog();openDialog(`<p class="eyebrow">ESTADO DE LIDA</p><h2>Funciones y conexión</h2><p>Perfil y mensajes se guardan en este navegador. Los juegos son locales. Todavía no hay backend, sincronización, llamadas, notificaciones push reales ni IA conectada.</p>`);}); }
function openSettings() {
  openDialog(`<p class="eyebrow">LIDA · AJUSTES</p><h2>Configuración</h2><p>Administra tu experiencia y consulta la guía.</p><button class="settings-row" id="settings-account"><span class="settings-icon">◌</span><span><strong>Cuenta y perfil</strong><small>Personaliza tu identidad</small></span><span>›</span></button><button class="settings-row" id="settings-privacy"><span class="settings-icon">◇</span><span><strong>Privacidad y seguridad</strong><small>Datos guardados en este navegador</small></span><span>›</span></button><button class="settings-row" id="settings-appearance"><span class="settings-icon">◐</span><span><strong>Apariencia</strong><small>Tema oscuro y verde neón</small></span><span>›</span></button><button class="settings-row" id="settings-lock"><span class="settings-icon">⌑</span><span><strong>Bloqueo de la aplicación</strong><small>Configura un código de acceso</small></span><span>›</span></button><button class="settings-row" id="settings-help"><span class="settings-icon">?</span><span><strong>Ayuda y recorrido</strong><small>Aprende a usar LIDA</small></span><span>›</span></button>`);
  $("#settings-account").addEventListener("click", () => { closeDialog(); showView("profile"); editProfile(); });
  $("#settings-privacy").addEventListener("click", () => { closeDialog(); $("#privacy-button").click(); });
  $("#settings-appearance").addEventListener("click", () => { closeDialog(); $("#appearance-button").click(); });
  $("#settings-help").addEventListener("click", () => { closeDialog(); state.guideStep = 0; openGuide(); });
  $("#settings-lock").addEventListener("click", openAppLockSettings);
}

function openAppLockSettings(){
  const existing=readJSON("lida.appLock",null);
  openDialog(`<p class="eyebrow">PRIVACIDAD</p><h2>Bloqueo de LIDA</h2><p>Configura un PIN para bloquear esta interfaz en este navegador. La huella o Face ID solo pueden integrarse de forma segura con WebAuthn y compatibilidad del dispositivo; no se simulan.</p><label class="field-label" for="lock-pin">PIN de 4 a 8 dígitos</label><input id="lock-pin" class="dialog-input" type="password" inputmode="numeric" minlength="4" maxlength="8" placeholder="Nuevo PIN"><label class="field-label" for="lock-pin-confirm">Confirmar PIN</label><input id="lock-pin-confirm" class="dialog-input" type="password" inputmode="numeric" minlength="4" maxlength="8" placeholder="Repite el PIN"><button class="primary-button full-width" id="save-app-lock">${existing?"Cambiar PIN":"Activar bloqueo con PIN"}</button>${existing?'<button class="secondary-button full-width" id="remove-app-lock">Desactivar bloqueo</button>':""}<p class="muted">Este bloqueo local no sustituye la seguridad de una cuenta y solo protege esta instalación del navegador.</p>`);
  $("#save-app-lock").addEventListener("click",()=>{const pin=$("#lock-pin").value,confirm=$("#lock-pin-confirm").value;if(!/^\d{4,8}$/.test(pin)||pin!==confirm){toast("Usa un PIN de 4 a 8 dígitos y confirma que coincida.");return;}writeJSON("lida.appLock",{pin,enabled:true});closeDialog();toast("Bloqueo local configurado.");});
  $("#remove-app-lock")?.addEventListener("click",()=>{localStorage.removeItem(`lida:${location.pathname.split('/').filter(Boolean)[0]?.toLowerCase().replace(/[^a-z0-9_-]/g,'')||'root'}:appLock`);closeDialog();toast("Bloqueo desactivado.");});
}
function editProfile() {
  openDialog(`<p class="eyebrow">PERSONALIZACIÓN</p><h2>Editar perfil</h2><label class="field-label" for="edit-photo">Foto de perfil</label><input id="edit-photo" class="dialog-input" type="file" accept="image/*"><label class="field-label" for="edit-name">Nombre</label><input id="edit-name" class="dialog-input" maxlength="50" value="${esc(state.profile.name)}"><label class="field-label" for="edit-handle">Usuario</label><input id="edit-handle" class="dialog-input" maxlength="40" value="${esc(state.profile.handle)}"><label class="field-label" for="edit-bio">Biografía</label><textarea id="edit-bio" class="dialog-input" maxlength="160" rows="3">${esc(state.profile.bio)}</textarea><button class="primary-button full-width" id="save-profile">Guardar cambios</button>`);
  $("#save-profile").addEventListener("click", () => {
    const name = $("#edit-name").value.trim();
    const handle = $("#edit-handle").value.trim();
    if (!name || !handle) { toast("El nombre y el usuario son obligatorios."); return; }
    const normalizedHandle = handle.startsWith("@") ? handle.toLowerCase() : `@${handle.toLowerCase()}`;
    if (!/^@[a-z0-9_]{3,20}$/.test(normalizedHandle)) { toast("El usuario debe tener de 3 a 20 caracteres: letras, números o guion bajo."); return; }
    const file = $("#edit-photo").files?.[0];
    const save = photo => { state.profile = { ...state.profile, name, handle: normalizedHandle, bio: $("#edit-bio").value.trim(), ...(photo ? { photo } : {}) }; persist(); renderProfile(); closeDialog(); toast("Perfil actualizado."); };
    if (file) { if (!file.type.startsWith("image/") || file.size > 4*1024*1024) { toast("Elige una imagen de hasta 4 MB."); return; } const reader = new FileReader(); reader.onload = () => save(reader.result); reader.readAsDataURL(file); } else save(null);
  });
}
function renderProfile() {
  $("#profile-display-name").textContent = state.profile.name;
  $("#profile-handle").textContent = state.profile.handle;
  $(".profile-bio").textContent = state.profile.bio;
  if (state.profile.photo) {
    $(".profile-avatar").innerHTML = `<img src="${state.profile.photo}" alt="Foto de perfil" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
    $("#profile-shortcut").innerHTML = `<img src="${state.profile.photo}" alt="Foto de perfil" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
  } else { $(".profile-avatar").textContent = initials(state.profile.name); $("#profile-shortcut").textContent = initials(state.profile.name); }
}
function applyPreferences() {
  const p = state.preferences;
  document.documentElement.style.setProperty("--user-accent", p.accent || "#71ff9b");
  document.documentElement.style.setProperty("--neon", p.accent || "#71ff9b");
  document.documentElement.style.setProperty("--user-bubble", p.bubble || "#174b2a");
  document.documentElement.style.setProperty("--user-message-size", `${Number(p.fontSize) || 13}px`);
  document.documentElement.style.setProperty("--user-message-radius", `${Number(p.radius) || 16}px`);
  document.documentElement.style.setProperty("--user-chat-background", p.chatBackground || "#080d0a");
  document.documentElement.dataset.bubbleStyle = p.bubbleStyle || "solid";
}
function openAppearanceSettings() {
  const p = state.preferences;
  openDialog(`<p class="eyebrow">PERSONALIZACIÓN</p><h2>Apariencia del chat</h2>
  <label class="field-label" for="pref-accent">Color de acento</label><input id="pref-accent" class="dialog-input" type="color" value="${esc(p.accent)}">
  <label class="field-label" for="pref-bubble">Color de tus burbujas</label><input id="pref-bubble" class="dialog-input" type="color" value="${esc(p.bubble)}">
  <label class="field-label" for="pref-chat-bg">Color del fondo del chat</label><input id="pref-chat-bg" class="dialog-input" type="color" value="${esc(p.chatBackground || "#080d0a")}">
  <label class="field-label" for="pref-bubble-style">Diseño de las burbujas</label><select id="pref-bubble-style" class="dialog-input"><option value="solid" ${(p.bubbleStyle||"solid")==="solid"?"selected":""}>Rellenas</option><option value="outline" ${p.bubbleStyle==="outline"?"selected":""}>Contorno</option></select>
  <label class="field-label" for="pref-font">Tamaño del mensaje: <span id="pref-font-value">${p.fontSize}px</span></label><input id="pref-font" class="dialog-input" type="range" min="11" max="22" value="${p.fontSize}">
  <label class="field-label" for="pref-radius">Redondeo de burbujas: <span id="pref-radius-value">${p.radius}px</span></label><input id="pref-radius" class="dialog-input" type="range" min="4" max="30" value="${p.radius}">
  <button class="primary-button full-width" id="save-appearance">Guardar cambios</button>`);
  $("#pref-font").addEventListener("input", e => $("#pref-font-value").textContent = `${e.target.value}px`);
  $("#pref-radius").addEventListener("input", e => $("#pref-radius-value").textContent = `${e.target.value}px`);
  $("#save-appearance").addEventListener("click", () => { state.preferences = {...state.preferences, accent:$("#pref-accent").value, bubble:$("#pref-bubble").value, chatBackground:$("#pref-chat-bg").value, bubbleStyle:$("#pref-bubble-style").value, fontSize:Number($("#pref-font").value), radius:Number($("#pref-radius").value)}; persist(); applyPreferences(); closeDialog(); toast("Personalización guardada."); });
}
function openPrivacySettings() {
  const p = state.preferences;
  openDialog(`<p class="eyebrow">PRIVACIDAD Y SEGURIDAD</p><h2>Controles</h2>
  <label class="settings-row"><span><strong>Notificaciones dentro de LIDA</strong><small>Mostrar avisos locales</small></span><input id="pref-notifications" type="checkbox" ${p.notifications ? "checked" : ""}></label>
  <label class="field-label" for="pref-expiry">Mensajes temporales predeterminados</label><select id="pref-expiry" class="dialog-input"><option value="0" ${p.temporarySeconds===0?"selected":""}>Desactivados</option><option value="3600" ${p.temporarySeconds===3600?"selected":""}>1 hora</option><option value="86400" ${p.temporarySeconds===86400?"selected":""}>24 horas</option><option value="604800" ${p.temporarySeconds===604800?"selected":""}>7 días</option><option value="7776000" ${p.temporarySeconds===7776000?"selected":""}>90 días</option></select>
  <p class="muted">Los mensajes temporales se filtran de este navegador al abrir el chat. No se borran en otros dispositivos porque esta versión todavía no tiene servidor.</p><button class="primary-button full-width" id="save-privacy">Guardar privacidad</button>`);
  $("#save-privacy").addEventListener("click", () => { state.preferences = {...state.preferences, notifications:$("#pref-notifications").checked, temporarySeconds:Number($("#pref-expiry").value)}; persist(); applyPreferences(); closeDialog(); toast("Preferencias guardadas."); });
}
function setupAI() {
  const ask = text => {
    const input = text.trim(); if (!input) return;
    const area = $("#ai-messages");
    area.insertAdjacentHTML("beforeend", `<div class="ai-bubble user-ai">${esc(input)}</div><div class="ai-bubble assistant-ai"><strong>✦ LIDA AI</strong><p>Estoy en modo de demostración. Cuando conectemos el servicio de IA, podré responder a “${esc(input)}” con ayuda real.</p></div>`);
    $("#ai-input").value = ""; area.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  $("#ai-form").addEventListener("submit", event => { event.preventDefault(); ask($("#ai-input").value); });
  $$(".suggestion").forEach(button => button.addEventListener("click", () => ask(button.dataset.prompt)));
}
function setupEvents() {
  $("#chat-search").addEventListener("input", renderChats);
  $$(".filter-chip").forEach(button => button.addEventListener("click", () => { state.filter = button.dataset.filter; $$(".filter-chip").forEach(item => item.classList.toggle("selected", item === button)); renderChats(); }));
  $("#chat-list").addEventListener("click", event => { const row = event.target.closest("[data-chat-id]"); if (suppressChatClick) { suppressChatClick=false; event.preventDefault(); event.stopImmediatePropagation(); return; } if (row) renderConversation(row.dataset.chatId); });
  let chatHoldTimer = null;
  let suppressChatClick = false;
  const showChatActions = row => { const chat = state.chats.find(item => item.id === row.dataset.chatId); if (!chat) return;
    openDialog(`<p class="eyebrow">CONVERSACIÓN</p><h2>${esc(chat.name)}</h2><div class="message-action-list"><button data-chat-action="pin">${chat.pinned?"Desfijar":"📌 Fijar chat"}</button><button data-chat-action="archive">${chat.archived?"Desarchivar":"📦 Archivar chat"}</button><button data-chat-action="restrict">${chat.restricted?"Quitar restricción":"🔒 Restringir chat"}</button><button data-chat-action="mute">${chat.muted?"Activar notificaciones":"🔕 Silenciar notificaciones"}</button><button data-chat-action="delete">🗑 Eliminar chat local</button></div>`);
    $$('[data-chat-action]').forEach(btn=>btn.addEventListener('click',()=>{const a=btn.dataset.chatAction;if(a==='pin')chat.pinned=!chat.pinned;else if(a==='archive')chat.archived=!chat.archived;else if(a==='restrict')chat.restricted=!chat.restricted;else if(a==='mute')chat.muted=!chat.muted;else if(a==='delete'){state.chats=state.chats.filter(c=>c.id!==chat.id);delete state.messages[chat.id];}persist();renderChats();closeDialog();toast('Cambio aplicado en este dispositivo.');}));
  };
  const chatList = $("#chat-list");
  chatList.addEventListener("pointerdown", event=>{const row=event.target.closest("[data-chat-id]");if(!row)return;chatHoldTimer=setTimeout(()=>{chatHoldTimer=null;suppressChatClick=true;showChatActions(row);},550);});
  ["pointerup","pointercancel","pointerleave"].forEach(type=>chatList.addEventListener(type,()=>{if(chatHoldTimer){clearTimeout(chatHoldTimer);chatHoldTimer=null;}}));
  chatList.addEventListener("contextmenu",event=>{const row=event.target.closest("[data-chat-id]");if(row){event.preventDefault();showChatActions(row);}});

  $("#message-form").addEventListener("submit", event => { event.preventDefault();
    if (state.mediaRecorder?.state === "recording") { state.mediaRecorder.stop(); return; }
    if (state.pendingVoice) { const pending=state.pendingVoice; state.pendingVoice=null; const time=new Date().toLocaleTimeString("es-DO",{hour:"2-digit",minute:"2-digit"}); const messages=state.messages[state.activeChatId]||[]; messages.push({type:"voice",audio:pending.audio,text:"",mine:true,time,sentAt:new Date().toISOString(),duration:pending.duration}); state.messages[state.activeChatId]=messages; const chat=state.chats.find(item=>item.id===state.activeChatId); if(chat){chat.lastMessage="🎙 Nota de voz";chat.time=time;} persist(); $("#voice-waveform")?.classList.add("hidden"); renderConversation(state.activeChatId); return; }
    sendMessage($("#message-input").value); $("#message-input").value = ""; });
  $("#back-to-chats").addEventListener("click", () => showView("chats"));
  $("#new-chat-button").addEventListener("click", openNewChat);
  $("#new-chat-community").addEventListener("click", openNewChat);
  $("#view-contact-requests")?.addEventListener(
  "click",
  loadContactRequests
);
  $("#friend-search").addEventListener("input", renderFriends);
  $("#friend-list").addEventListener("click", event => {
    const remove = event.target.closest("[data-contact-remove]");
    const message = event.target.closest("[data-contact-chat]");
    if (remove) {
      state.directory = state.directory.filter(person => person.id !== remove.dataset.contactRemove);
      persist(); renderFriends(); toast("Contacto eliminado de este dispositivo.");
    }
    if (message) {
      const person = state.directory.find(item => item.id === message.dataset.contactChat);
      if (!person) return;
      let chat = state.chats.find(item => item.contactId === person.id);
      if (!chat) {
        chat = { id: `local-chat-${person.id}`, contactId: person.id, name: person.name, userHandle: person.handle, lastMessage: "Contacto local · no conectado", time: "Ahora", unread: false, favorite: false, online: false, system: false, localOnly: true };
        state.chats.push(chat); state.messages[chat.id] = [{ text: `Este chat está preparado localmente para ${person.name} (${person.handle}). Los mensajes no se entregan a otra persona hasta que LIDA tenga un servidor conectado.`, mine: false, time: "Ahora", system: true }]; persist();
      }
      renderConversation(chat.id);
    }
  });
  $("#new-status-button").addEventListener("click", openStatusDialog);
  $("#status-add").addEventListener("click", openStatusDialog);
  $("#edit-profile-button").addEventListener("click", editProfile);
  $("#profile-edit-main").addEventListener("click", editProfile);
  $("#profile-shortcut").addEventListener("click", () => showView("profile"));
  $("#settings-shortcut").addEventListener("click", () => openSettings());
  $("#search-button").addEventListener("click", () => { showView("chats"); $("#chat-search").focus(); });
  const messageList = $("#message-list");
  let pressTimer = null, pressedMessage = null;
  const openMessageActions = (messageEl) => {
    const index=Number(messageEl.dataset.messageIndex); const message=(state.messages[state.activeChatId]||[])[index]; if(!message)return;
    openDialog(`<p class="eyebrow">MENSAJE</p><h2>Acciones</h2><div class="reaction-picker">${["❤️","😂","👍","😮","😢","🔥"].map(emoji=>`<button type="button" data-quick-reaction="${emoji}">${emoji}</button>`).join("")}</div><div class="message-action-list"><button data-message-action="reply">↩ Responder</button><button data-message-action="forward">➦ Reenviar</button><button data-message-action="share">↗ Compartir</button><button data-message-action="copy">▢ Copiar texto</button></div>`);
    $$('[data-quick-reaction]').forEach(button=>button.addEventListener('click',()=>{message.reaction=button.dataset.quickReaction;persist();renderConversation(state.activeChatId);closeDialog();}));
    $$('[data-message-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.messageAction;closeDialog();if(action==='reply'){state.replyTo=message;let banner=$("#reply-banner");if(!banner){banner=document.createElement('div');banner.id='reply-banner';banner.className='reply-banner';$("#message-form").before(banner);}banner.innerHTML=`<span>Respondiendo a: ${esc(message.text||"Nota de voz")}</span><button type="button" id="cancel-reply" aria-label="Cancelar respuesta">×</button>`;$("#cancel-reply").addEventListener('click',()=>{state.replyTo=null;banner.remove();});$("#message-input").focus();}else if(action==='forward'){openDialog(`<p class="eyebrow">REENVIAR</p><h2>Reenviar mensaje</h2><p>${esc(message.text||"Nota de voz")}</p><p class="demo-notice">El reenvío a otra cuenta estará disponible al conectar LIDA a Supabase.</p>`);}else if(action==='share'){if(navigator.share)navigator.share({text:message.text||"Nota de voz"}).catch(()=>{});else toast('Compartir no está disponible en este navegador.');}else if(action==='copy'){navigator.clipboard?.writeText(message.text||"Nota de voz").then(()=>toast('Mensaje copiado.')).catch(()=>toast('No se pudo copiar el mensaje.'));}}));
  };
  messageList.addEventListener('pointerdown',event=>{const el=event.target.closest('.message');if(!el)return;pressedMessage=el;pressTimer=window.setTimeout(()=>{openMessageActions(el);pressTimer=null;},500);});
  ['pointerup','pointerleave','pointercancel'].forEach(type=>messageList.addEventListener(type,()=>{if(pressTimer){clearTimeout(pressTimer);pressTimer=null;}}));
  messageList.addEventListener('contextmenu',event=>{const el=event.target.closest('.message');if(el){event.preventDefault();openMessageActions(el);}});
  messageList.addEventListener('click',event=>{if(event.target.closest('audio'))return;const el=event.target.closest('.message');if(el&&pressedMessage===el&&pressTimer===null){/* long-press menu already handles action */}});
  $("#voice-note-button").addEventListener("click", async () => {
    if (state.mediaRecorder && state.mediaRecorder.state === "recording") { state.mediaRecorder.stop(); return; }
    if (state.pendingVoice) { toast("Pulsa enviar para mandar la nota de voz, o vuelve a tocar el micrófono para descartarla."); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast("Tu navegador no permite grabar aquí. Abre LIDA mediante HTTPS."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      const recorder = new MediaRecorder(stream); state.mediaRecorder=recorder; state.recordingChunks=[];
      const started=Date.now(); recorder.ondataavailable=event=>{if(event.data.size)state.recordingChunks.push(event.data);};
      recorder.onstop=()=>{ const blob=new Blob(state.recordingChunks,{type:recorder.mimeType||"audio/webm"}); stream.getTracks().forEach(track=>track.stop()); const reader=new FileReader(); reader.onload=()=>{state.pendingVoice={audio:reader.result,duration:`${Math.max(1,Math.round((Date.now()-started)/1000))} s`}; const wave=$("#voice-waveform"); if(wave){wave.classList.remove("hidden");wave.classList.add("voice-ready");wave.querySelector("b").textContent="Audio listo · pulsa ➤ para enviar";} $("#voice-note-button").classList.remove("recording"); $("#voice-note-button").textContent="🎙"; toast("Nota de voz lista. Pulsa el mismo botón ➤ para enviarla.");}; reader.readAsDataURL(blob); };
      recorder.start(); $("#voice-waveform")?.classList.remove("hidden"); $("#voice-waveform")?.classList.remove("voice-ready"); $("#voice-note-button").classList.add("recording"); $("#voice-note-button").textContent="■"; toast("Grabando… toca ■ para terminar y luego ➤ para enviar.");
    } catch(error) { toast("No se concedió permiso para usar el micrófono."); }
  });
  $("#sticker-button")?.addEventListener("click",()=>{openDialog(`<p class="eyebrow">STICKERS</p><h2>Elige un sticker</h2><div class="sticker-picker">${["😂","🥹","❤️","😍","🔥","👏","😎","🤗","💚","🎉","✨","👀"].map(st=>`<button type="button" data-sticker="${st}">${st}</button>`).join("")}</div>`);$$('[data-sticker]').forEach(btn=>btn.addEventListener('click',()=>{const input=$("#message-input");if(input){input.value += btn.dataset.sticker;input.focus();}closeDialog();}));});
  $("#call-audio").addEventListener("click", () => openDialog(`<p class="eyebrow">LLAMADA DE VOZ</p><h2>Función preparada</h2><p>El botón está disponible, pero la llamada entre usuarios todavía no puede conectarse hasta configurar el backend y el servicio de llamadas.</p><button class="primary-button full-width" id="close-call-info">Entendido</button>`));
  $("#call-video").addEventListener("click", () => openDialog(`<p class="eyebrow">VIDEOLLAMADA</p><h2>Función preparada</h2><p>La videollamada requiere señalización en tiempo real y conexión entre usuarios. La activaremos después de conectar las cuentas.</p><button class="primary-button full-width" id="close-call-info">Entendido</button>`));
  document.addEventListener("click", event => { if(event.target.closest("#close-call-info")) closeDialog(); });
  $("#attach-button")?.addEventListener("click", () => toast("Los archivos adjuntos requieren una fase posterior."));
  $("#conversation-menu").addEventListener("click", () => openDialog(`<p class="eyebrow">CONVERSACIÓN</p><h2>Opciones</h2><button class="settings-row" id="clear-chat"><span>⌫</span><span><strong>Limpiar mensajes locales</strong><small>Elimina los mensajes guardados en este dispositivo</small></span></button>`));
  document.addEventListener("click", event => { if (event.target.closest("#clear-chat")) { state.messages[state.activeChatId] = []; persist(); renderConversation(state.activeChatId); closeDialog(); toast("Mensajes locales eliminados."); } });
  $("#appearance-button").addEventListener("click", openAppearanceSettings);
  $("#privacy-button").addEventListener("click", openPrivacySettings);
  $("#about-button").addEventListener("click", () => openDialog(`<p class="eyebrow">ACERCA DE</p><h2>LIDA</h2><p>Prototipo local. Las cuentas globales y los mensajes entre dispositivos requieren autenticación y base de datos.</p><button class="primary-button full-width" id="about-guide">Volver a ver el recorrido guiado</button>`));
  document.addEventListener("click", event => { if (event.target.closest("#about-guide")) { closeDialog(); state.guideStep=0; openGuide(); } });
  const gameLaunchers = {"open-tictactoe":openTicTacToe,"open-luzcamina":openLuzCamina,"open-hangman":openHangman,"open-word-complete":openWordComplete,"open-wordsearch":openWordSearch,"open-truth-dare":openTruthDare};
  Object.entries(gameLaunchers).forEach(([id, launch]) => { const button = document.getElementById(id); if (button) button.addEventListener("click", event => { event.preventDefault(); showView("play"); try { launch(); } catch (error) { console.error("Error al abrir juego", id, error); toast("No se pudo abrir el juego. Recarga LIDA e inténtalo otra vez."); } }); });
  $("#help-button").addEventListener("click", openHelp);
}
// La creación de usuario es obligatoria: impide cerrar el diálogo antes de guardar un @usuario válido.
const registrationDialog = document.querySelector("#app-dialog");
registrationDialog?.addEventListener("cancel", event => { if (!state.registered || !state.profile.handle) event.preventDefault(); });
registrationDialog?.addEventListener("submit", event => { if (!state.registered || !state.profile.handle) { event.preventDefault(); event.stopImmediatePropagation(); } });
registrationDialog?.addEventListener("close", () => { if (!state.registered || !state.profile.handle) queueMicrotask(() => openRegistration()); });

setupNavigation();
setupEvents();
setupAI();
renderChats();
renderStatuses();
renderProfile();
applyPreferences();
showView("chats");
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(error => console.warn("No se pudo registrar el service worker:", error)));
}
window.addEventListener("load", () => {
  const splash = document.querySelector("#lida-splash");
  window.setTimeout(() => {
    if (splash) splash.classList.add("is-hidden");
    // Supabase owns signup/signin. Do not open the old local-only username dialog
    // while the Supabase gate is visible; it used to cover the real auth form.
    if (document.querySelector("#supabase-auth-gate")) return;
    if (!state.registered || !state.profile.handle) openRegistration();
    else if (state.guideVersion < 4 || (!state.guideCompleted && !state.guideSkipped)) { state.guideStep = 0; state.guideSkipped = false; openGuide(); }
    showWelcomeToast();
  }, 1200);
});
