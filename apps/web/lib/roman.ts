const NUMERALS: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

export function toRoman(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  let n = Math.floor(value);
  let out = "";
  for (const [v, sym] of NUMERALS) {
    while (n >= v) {
      out += sym;
      n -= v;
    }
  }
  return out;
}

export function toRomanLower(value: number): string {
  return toRoman(value).toLowerCase();
}
