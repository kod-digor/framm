import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number | bigint) {
  const value = Number(bytes);
  if (value === 0) return "0 Go";
  if (value >= 1_073_741_824) {
    const gb = value / 1_073_741_824;
    return `${gb % 1 === 0 ? gb : gb.toFixed(1)} Go`;
  }
  if (value >= 1_048_576) {
    const mb = value / 1_048_576;
    return `${mb % 1 === 0 ? mb : mb.toFixed(1)} Mo`;
  }
  if (value >= 1024) {
    return `${Math.round(value / 1024)} Ko`;
  }
  return "< 1 Ko";
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
