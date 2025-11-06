// frontend/src/utils/toast.js
export function showToast(message, opts = {}) {
  const detail = {
    message: String(message ?? ""),
    type: opts.type || "info",
    timeout: typeof opts.timeout === "number" ? opts.timeout : 5000,
  };
  const ev = new CustomEvent("mycloud:toast", { detail });
  window.dispatchEvent(ev);
}
