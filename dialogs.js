let toastTimer;
export function openDialog(html) {
  const dialog = document.querySelector("#app-dialog");
  document.querySelector("#dialog-content").innerHTML = html;
  if (!dialog.open) dialog.showModal();
}
export function closeDialog() {
  const dialog = document.querySelector("#app-dialog");
  if (dialog.open) dialog.close();
}
export function toast(message) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("visible"), 2600);
}
document.addEventListener("click", event => {
  if (event.target.closest(".dialog-close")) closeDialog();
});
