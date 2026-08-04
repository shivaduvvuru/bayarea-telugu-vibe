/** Tiny cross-component channel so the bottom tab bar can open the header menu. */
const EVENT = "batt:open-menu";

export function openMobileMenu() {
  window.dispatchEvent(new Event(EVENT));
}

export function onOpenMobileMenu(handler: () => void) {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
