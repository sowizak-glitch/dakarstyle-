// Shared modal open/close helpers. The base app defines openModal()/
// closeModal() as plain top-level functions in a classic (non-module)
// <script>, which makes them reachable as window.openModal/window.closeModal
// from this separately-injected script. Falls back to manually toggling the
// same '.open' class the base app itself uses if, for any reason, those
// globals are not present (defensive: Global Core must never hard-depend on
// internals it does not own).
export function openModalSafe(id) {
  if (typeof window.openModal === 'function') return window.openModal(id);
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}
export function closeModalSafe(el) {
  if (typeof window.closeModal === 'function') return window.closeModal(el);
  el.classList.remove('open');
  document.body.style.overflow = '';
}
