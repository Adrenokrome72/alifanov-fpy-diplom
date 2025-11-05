// frontend/src/utils/formatBytes.js
export default function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return "—";
  const b = Number(bytes);
  if (!isFinite(b)) return "—";
  if (b === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  const val = b / Math.pow(1024, i);
  const decimals = val < 10 && i > 0 ? 2 : 1;
  return `${val.toFixed(decimals)} ${units[i]}`;
}
