/**
 * confirmBus.js
 *
 * window.confirm() is a native browser dialog -- it can't be styled, and
 * breaks the second it shows up next to a custom dark UI. This is the
 * same pub/sub shape as toastBus.js: requestConfirm() is called from
 * wherever a confirm used to happen (App.jsx's nav guard, a screen's
 * Exit button, History's Clear button), ConfirmDialog (mounted once in
 * App.jsx) is the only subscriber and renders the actual modal, and the
 * promise resolves true/false exactly like window.confirm() did -- so
 * every call site just adds `await` instead of restructuring.
 */
let activeResolve = null;
const listeners = new Set();

export function requestConfirm(options) {
  return new Promise((resolve) => {
    activeResolve = resolve;
    listeners.forEach((fn) => fn(options));
  });
}

export function resolveConfirm(result) {
  activeResolve?.(result);
  activeResolve = null;
  listeners.forEach((fn) => fn(null));
}

export function subscribeConfirm(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
