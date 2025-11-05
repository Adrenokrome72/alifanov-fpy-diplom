// frontend/src/utils/toast.js
export function showToast(message, opts = {}) {
  const payload = {
    message: typeof message === "string" ? message : String(message),
    type: opts.type || "info", // 'success' | 'error' | 'info'
    duration: typeof opts.duration === "number" ? opts.duration : 4000,
  };
  try {
    window.dispatchEvent(new CustomEvent("mycloud:toast", { detail: payload }));
  } catch (e) {
    console[opts.type === "error" ? "error" : "log"](payload.message);
  }
}
