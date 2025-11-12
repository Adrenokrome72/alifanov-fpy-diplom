// frontend/src/utils/parseBytes.js
// Parse human-readable sizes like "15GB", "500 MB", "1024", "1.5 gb"
export default function parseBytes(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Math.max(0, Math.floor(input));
  const s = String(input).trim();
  if (s === "") return null;
  const m = s.replace(/,/g, "").match(/^([\d.]+)\s*([kmgtp]?b?)?$/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  const unit = (m[2] || "").toLowerCase();
  if (unit === "" || unit === "b") return Math.floor(value);
  if (unit === "k" || unit === "kb") return Math.floor(value * 1024);
  if (unit === "m" || unit === "mb") return Math.floor(value * 1024 ** 2);
  if (unit === "g" || unit === "gb") return Math.floor(value * 1024 ** 3);
  if (unit === "t" || unit === "tb") return Math.floor(value * 1024 ** 4);
  if (unit === "p" || unit === "pb") return Math.floor(value * 1024 ** 5);
  return null;
}