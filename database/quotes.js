/**
 * database/quotes.js
 *
 * Système de quotes multilingues pour le mode Classique.
 *
 * Architecture :
 *   - v2.0 : toutes les quotes restent en EN (champ `quote` dans characters_clean.js)
 *   - Post-v2.0 : ajouter les traductions officielles Atlus dans `characterQuotes`
 *     en sourçant uniquement les localisations officielles (jamais de traduction libre)
 *
 * Usage :
 *   import { getQuote } from '../database/quotes.js';
 *   const quote = getQuote('Ryuji Sakamoto', 'fr'); // → fallback EN si fr: null
 */

import { characters } from './characters_clean.js';

/**
 * Surcharges de traduction par personnage.
 * Structure : { [nom]: { en: string, fr: string|null, es: string|null, de: string|null } }
 *
 * v2.0 : objet vide — les quotes sont lues directement depuis characters_clean.js (EN).
 * Post-v2.0 : peupler avec les traductions officielles Atlus.
 *
 * Exemple (à ne pas remplir avant d'avoir les sources officielles) :
 * "Ryuji Sakamoto": {
 *   en: "You're a Phantom Thief now too, right?",
 *   fr: null,  // pas encore traduit → fallback EN
 *   es: null,
 *   de: null
 * }
 */
export const characterQuotes = {};

/**
 * Retourne la quote d'un personnage dans la langue demandée.
 * Fallback : langue demandée → EN (depuis characters_clean.js).
 *
 * @param {string} name - Nom du personnage (doit correspondre à characters_clean.js)
 * @param {string} [lang='en'] - Code langue : 'en' | 'fr' | 'es' | 'de'
 * @returns {string|null} La quote, ou null si le personnage est introuvable
 */
export function getQuote(name, lang = 'en') {
  // 1. Chercher une surcharge dans characterQuotes (post-v2.0)
  const override = characterQuotes[name];
  if (override) {
    const translated = override[lang];
    if (translated) return translated;
    // Fallback → EN de l'override
    if (override.en) return override.en;
  }

  // 2. Fallback → champ `quote` dans characters_clean.js (toujours EN)
  const char = characters.find(c => c.nom === name);
  return char?.quote ?? null;
}
