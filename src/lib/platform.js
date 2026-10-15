export const isStandalone = () =>
  window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;

export const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** A phone/tablet browser tab (not the installed app) where installing is the right move. */
export const shouldInstall = () =>
  !isStandalone() && (isIOS() || (/Android|Mobile/.test(navigator.userAgent) && navigator.maxTouchPoints > 0));
