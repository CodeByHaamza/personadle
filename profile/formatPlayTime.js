/**
 * formatPlayTime.js — Utilitaire partagé entre profile-page.js et profile-view.js
 * Convertit des minutes en chaîne lisible adaptée à la langue de l'utilisateur.
 */

export function formatPlayTime(totalMinutes) {
  const lang = localStorage.getItem("lang") || "en";

  const U = {
    en: { min: "min", h: "h", day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"], year: ["year", "years"] },
    fr: { min: "min", h: "h", day: ["jour", "jours"], week: ["semaine", "semaines"], month: ["mois", "mois"], year: ["an", "ans"] },
    es: { min: "min", h: "h", day: ["día", "días"], week: ["semana", "semanas"], month: ["mes", "meses"], year: ["año", "años"] },
    de: { min: "Min.", h: "Std.", day: ["Tag", "Tage"], week: ["Woche", "Wochen"], month: ["Monat", "Monate"], year: ["Jahr", "Jahre"] },
    it: { min: "min", h: "h", day: ["giorno", "giorni"], week: ["settimana", "settimane"], month: ["mese", "mesi"], year: ["anno", "anni"] },
  };
  const u = U[lang] || U.en;
  const p = (n, [sing, plur]) => `${n} ${n <= 1 ? sing : plur}`;

  const PER_HOUR  = 60;
  const PER_DAY   = PER_HOUR * 24;   // 1 440
  const PER_WEEK  = PER_DAY  * 7;    // 10 080
  const PER_MONTH = PER_DAY  * 30;   // 43 200
  const PER_YEAR  = PER_DAY  * 365;  // 525 600

  const m = Math.max(0, Math.round(totalMinutes));

  if (m < PER_DAY)   return `${m} ${u.min}`;
  if (m < PER_WEEK)  { const d = Math.floor(m / PER_DAY), h = Math.floor((m % PER_DAY) / PER_HOUR); return h > 0 ? `${p(d, u.day)} ${h}${u.h}` : p(d, u.day); }
  if (m < PER_MONTH) { const w = Math.floor(m / PER_WEEK), d = Math.floor((m % PER_WEEK) / PER_DAY); return d > 0 ? `${p(w, u.week)} ${p(d, u.day)}` : p(w, u.week); }
  if (m < PER_YEAR)  { const mo = Math.floor(m / PER_MONTH), w = Math.floor((m % PER_MONTH) / PER_WEEK); return w > 0 ? `${p(mo, u.month)} ${p(w, u.week)}` : p(mo, u.month); }
  const y = Math.floor(m / PER_YEAR), mo = Math.floor((m % PER_YEAR) / PER_MONTH);
  return mo > 0 ? `${p(y, u.year)} ${p(mo, u.month)}` : p(y, u.year);
}
