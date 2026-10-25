const viewNames = ["chats", "conversation", "estados", "play", "profile", "ai"];
export function showView(name) {
  if (!viewNames.includes(name)) return;
  const main = document.querySelector("#app-main");
  const current = document.querySelector(".view.active");
  if (current && current.dataset.view !== name) { current.classList.add("view-leaving"); window.setTimeout(() => current.classList.remove("view-leaving"), 260); }
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.dataset.view === name));
  if (main) { main.classList.remove("view-transition"); void main.offsetWidth; main.classList.add("view-transition"); }
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.target === name));
  document.body.dataset.currentView = name;
  if (name !== "conversation") document.querySelector("#app-main")?.focus({ preventScroll: true });
}
export function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach(item => item.addEventListener("click", () => showView(item.dataset.target)));
}
