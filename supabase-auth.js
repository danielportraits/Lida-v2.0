import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mountGate() {
  let gate = document.querySelector('#supabase-auth-gate');
  if (gate) return gate;
  gate = document.createElement('section');
  gate.id = 'supabase-auth-gate';
  gate.className = 'supabase-auth-gate';
  gate.innerHTML = `<div class="supabase-auth-card"><img src="./lida-logo-original.png" alt="LIDA" class="supabase-auth-logo"><p class="eyebrow">TU ESPACIO · TU CUENTA</p><h1 id="auth-title">Entra a LIDA</h1><p class="auth-subtitle">Crea tu cuenta para usar tu perfil en distintos dispositivos.</p><div class="auth-tabs"><button type="button" data-auth-mode="signup" class="active">Crear cuenta</button><button type="button" data-auth-mode="signin">Iniciar sesión</button></div><form id="supabase-auth-form"><div id="auth-name-field"><label for="auth-display-name">Nombre para mostrar</label><input id="auth-display-name" maxlength="50" autocomplete="name" placeholder="Tu nombre" required></div><div id="auth-username-field"><label for="auth-username">Nombre de usuario único</label><input id="auth-username" maxlength="20" pattern="[A-Za-z0-9_]{3,20}" autocomplete="username" autocapitalize="none" placeholder="tu_usuario" required><small>3–20 caracteres: letras, números o guion bajo.</small></div><div><label for="auth-email">Correo electrónico</label><input id="auth-email" type="email" autocomplete="email" placeholder="tu@correo.com" required></div><div><label for="auth-password">Contraseña</label><input id="auth-password" type="password" minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres" required></div><p id="auth-message" role="status" aria-live="polite"></p><button id="auth-submit" class="primary-button full-width" type="submit">Crear mi cuenta</button></form><p class="auth-footnote">Nunca compartas tu contraseña. LIDA usa autenticación de Supabase.</p></div>`;
  document.body.append(gate);
  return gate;
}

export async function initializeAuth() {
  const gate = mountGate();
  const app = document.querySelector('.app-shell');
  const splash = document.querySelector('#lida-splash');
  let mode = 'signup';
  let busy = false;
  const message = (text, error = false) => { const el = gate.querySelector('#auth-message'); el.textContent = text; el.dataset.error = error ? 'true' : 'false'; };
  const setMode = next => {
    mode = next;
    gate.querySelectorAll('[data-auth-mode]').forEach(b => b.classList.toggle('active', b.dataset.authMode === mode));
    gate.querySelector('#auth-title').textContent = mode === 'signup' ? 'Crea tu cuenta' : 'Bienvenido de nuevo';
    gate.querySelector('.auth-subtitle').textContent = mode === 'signup' ? 'Regístrate para comenzar a usar LIDA.' : 'Inicia sesión con tu correo y contraseña.';
    gate.querySelector('#auth-name-field').hidden = mode !== 'signup';
    gate.querySelector('#auth-username-field').hidden = mode !== 'signup';
    gate.querySelector('#auth-display-name').required = mode === 'signup';
    gate.querySelector('#auth-username').required = mode === 'signup';
    gate.querySelector('#auth-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    gate.querySelector('#auth-submit').textContent = mode === 'signup' ? 'Crear mi cuenta' : 'Iniciar sesión';
    message('');
  };
  gate.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.authMode)));
  const revealApp = async session => {
    const user = session.user;
    let profile = null;
    const { data } = await supabase.from('profiles').select('username,display_name,bio,avatar_url').eq('id', user.id).maybeSingle();
    profile = data;
    const username = profile?.username || user.user_metadata?.username || `user_${user.id.replaceAll('-', '').slice(0,12)}`;
    const name = profile?.display_name || user.user_metadata?.display_name || username;
    localStorage.setItem('lida.profile', JSON.stringify({ name, handle: `@${username}`, bio: profile?.bio || '', avatar: profile?.avatar_url || '' }));
    localStorage.setItem('lida.registered', 'true');
    gate.remove();
    if (app) app.style.visibility = 'visible';
    if (splash) splash.classList.add('is-hidden');
    window.dispatchEvent(new CustomEvent('lida:authenticated', { detail: { user, profile } }));
  };
  if (app) app.style.visibility = 'hidden';
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) message(`No se pudo comprobar la sesión: ${sessionError.message}`, true);
  if (session) { await revealApp(session); return; }
  gate.hidden = false;
  if (splash) splash.classList.add('is-hidden');
  gate.querySelector('#supabase-auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const submit = gate.querySelector('#auth-submit'); submit.disabled = true; submit.textContent = 'Conectando…'; message('');
    const email = gate.querySelector('#auth-email').value.trim();
    const password = gate.querySelector('#auth-password').value;
    try {
      if (mode === 'signup') {
        const displayName = gate.querySelector('#auth-display-name').value.trim();
        const username = gate.querySelector('#auth-username').value.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('El usuario debe tener entre 3 y 20 caracteres: letras, números o guion bajo.');
      
const redirectUrl = new URL('./', window.location.href).href;

const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: redirectUrl,
    data: {
      username,
      display_name: displayName
    }
  }
});

        if (error) throw error;
        if (data.session) { await revealApp(data.session); }
        else message('Cuenta creada. Revisa tu correo para confirmar la dirección y luego inicia sesión aquí.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) await revealApp(data.session);
      }
    } catch (error) {
      const raw = error?.message || 'No se pudo completar la operación.';
      let friendly = raw;
      if (/already registered|already exists/i.test(raw)) friendly = 'Ese correo ya tiene una cuenta. Usa Iniciar sesión.';
      else if (/username|duplicate key|profiles_username_key/i.test(raw)) friendly = 'Ese nombre de usuario ya está ocupado. Prueba otro.';
      else if (/invalid login credentials/i.test(raw)) friendly = 'Correo o contraseña incorrectos.';
      message(friendly, true);
    } finally {
      busy = false;
      if (document.body.contains(gate)) { submit.disabled = false; submit.textContent = mode === 'signup' ? 'Crear mi cuenta' : 'Iniciar sesión'; }
    }
  });
  setMode('signup');
}
