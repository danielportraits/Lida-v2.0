// Aísla los datos por proyecto/ruta. Así dos repositorios GitHub Pages del mismo dominio no comparten mensajes ni perfiles.
const projectScope = (() => {
  const parts = location.pathname.split('/').filter(Boolean);
  // GitHub Pages de proyecto usa /nombre-repo/; el sitio de usuario usa raíz.
  return parts.length ? parts[0].toLowerCase().replace(/[^a-z0-9_-]/g, '') : 'root';
})();
const scopedKey = key => `lida:${projectScope}:${key.replace(/^lida\./, '')}`;
export function readJSON(key, fallback) {
  try { const value = localStorage.getItem(scopedKey(key)); return value === null ? structuredClone(fallback) : JSON.parse(value); }
  catch (error) { console.warn(`No se pudo leer ${key}:`, error); return structuredClone(fallback); }
}
export function writeJSON(key, value) {
  try { localStorage.setItem(scopedKey(key), JSON.stringify(value)); return true; }
  catch (error) { console.warn(`No se pudo guardar ${key}:`, error); return false; }
}
