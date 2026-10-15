/**
 * toastBus.js
 *
 * A minimal pub/sub so any screen can fire an achievement toast
 * ("New personal best!", "Clean sweep streak") without threading a
 * callback prop through the whole app -- ToastHub (mounted once in
 * App.jsx) is the only subscriber, screens just call pushToast().
 */
const listeners = new Set();

export function pushToast(toast) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  listeners.forEach((fn) => fn({ id, tone: 'signal', ...toast }));
}

export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
