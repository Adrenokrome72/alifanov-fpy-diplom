export default function formatBytes(bytes, decimals = 1) {
  if (bytes === null || bytes === undefined) return "0 B";
  const b = Number(bytes);
  if (Number.isNaN(b)) return "0 B";
  if (b === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  const value = parseFloat((b / Math.pow(k, i)).toFixed(dm));
  return `${value} ${sizes[i]}`;
}
