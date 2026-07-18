import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, locale: "ar" | "en" = "ar") {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function formatRelativeTime(date: Date | string, locale: "ar" | "en" = "ar") {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-JO" : "en-US", {
    numeric: "auto",
  });

  if (diffMin < 1) return locale === "ar" ? "الآن" : "just now";
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  if (diffHr < 24) return rtf.format(-diffHr, "hour");
  if (diffDay < 30) return rtf.format(-diffDay, "day");
  return formatDate(d, locale);
}

export function formatJOD(amount: number, locale: "ar" | "en" = "ar") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US", {
    style: "currency",
    currency: "JOD",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function maskPhone(phone: string) {
  if (phone.length < 6) return phone;
  return phone.slice(0, 4) + " ••• " + phone.slice(-3);
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDateSmart(date: Date | string, locale: 'ar' | 'en' = 'ar'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return locale === 'ar' ? 'الآن' : 'just now';
  if (diffMin < 60) return locale === 'ar' ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
  if (diffHr < 24) return locale === 'ar' ? `منذ ${diffHr} ساعة` : `${diffHr}h ago`;
  if (diffDay < 7) return locale === 'ar' ? `منذ ${diffDay} يوم` : `${diffDay}d ago`;
  return formatDate(d, locale);
}
