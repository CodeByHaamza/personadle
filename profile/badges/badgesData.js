// ═══════════════════════════════════════════════════════════════════════════
// 🎖️ PERSONADLE - SYSTÈME DE BADGES
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// 📊 CATÉGORIES DE BADGES
// ───────────────────────────────────────────────────────────────────────────
export const BADGE_CATEGORIES = {
  ACHIEVEMENT: "achievement",    // Badges de statistiques
  EVENT: "event",                // Badges d'événements temporaires
  SECRET: "secret",              // Badges secrets (codes permanents)
  SOCIAL: "social"               // Badges sociaux (partage, etc.)
};

// ───────────────────────────────────────────────────────────────────────────
// 🎖️ LISTE COMPLÈTE DES BADGES
// ───────────────────────────────────────────────────────────────────────────
export const badgesList = [
  
  // ═════════════════════════════════════════════════════════════════════════
  // 🏆 BADGES DE RÉUSSITE (Achievement Badges)
  // ═════════════════════════════════════════════════════════════════════════
  
  {
    id: "ace_detective",
    name: "Ace Detective",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: "./profile/badges/images/Badges_Ace_Detective.png",
    condition: "Win 10 games",
    description: "You've proven your worth as a true detective. Nothing escapes your keen eye!",
    secret: false,
    check: (stats, profile) => {
      return (stats?.wins || 0) >= 10;
    }
  },

  {
    id: "ace_defective",
    name: "Ace Defective",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: "./profile/badges/images/Badges_Ace_Defective.png",
    condition: "Give up 10 times",
    description: "Sometimes the shadows are too strong. But you keep coming back!",
    secret: false,
    check: (stats, profile) => {
      return (stats?.giveups || 0) >= 10;
    }
  },


  {
    id: "shadow_slayer",
    name: "Shadow Slayer",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: "./profile/badges/images/Badges_Shadow_Slayer.png",
    condition: "Win 5 games in Silhouette mode",
    description: "You see through the darkness. Even shadows can't hide from you!",
    secret: false,
    check: (stats, profile) => {
      const silhouetteWins = stats?.modeCount?.Shadow || 0;
      return silhouetteWins >= 5;
    }
  },

  {
    id: "music_master",
    name: "Music Master",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: "./profile/badges/images/Badges_Music.png",
    condition: "Win 20 games in Music mode",
    description: "You'll never see it coming! A true connoisseur of Persona's legendary soundtracks.",
    secret: false,
    check: (stats, profile) => {
      const musicWins = stats?.modeCount?.Music || 0;
      return musicWins >= 20;
    }
  },

  {
    id: "burn_my_dread",
    name: "Memento Mori",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: "./profile/badges/images/Badges_Burn_My_Dread_Silver.png",
    condition: "Find 'Burn My Dread' in Music mode",
    description: "Three souls bound by fate, pointing their choices like guns. In the shadow of death, the truth demands a trigger.",
    secret: false,
    check: (stats, profile) => {
      return profile?.foundBurnMyDread === true;
    }
  },

  {
    id: "first_win",
    name: "First Victory",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: "./profile/badges/images/Badges_Fisrt_Win.png",
    condition: "Win your first game",
    description: "The first step on your journey as a Persona user. A wild card has awakened within you.",
    secret: false,
    check: (stats, profile) => {
        return (stats?.wins || 0) >= 1;
    }
},

{
    id: "p1_p2_fan",
    name: "Echoes of the Past",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: "./profile/badges/images/Badges_P1_P2_Fan.png",
    condition: "Win 15 games in Classic mode",
    description: "You've walked the same path as Naoya, Tatsuya, and Maya. The legacy of the first awakened lives on through you.",
    secret: false,
    check: (stats, profile) => {
        return (stats?.modeCount?.Classic || 0) >= 15;
    }
},

{
    id: "rentree",
    name: "Spring Awakening",
    category: BADGE_CATEGORIES.EVENT,
    img: "./profile/badges/images/Badges_Rentré.png",
    condition: "Log in on April 1st",
    description: "Cherry blossoms bloom as a new school year begins. You've entered the Velvet Room on Japan's opening ceremony day.",
    secret: false,
    check: (stats, profile) => {
        return profile.eventBadges?.rentree === true;
    }
},

{
    id: "sport",
    name: "Athletic Spirit",
    category: BADGE_CATEGORIES.EVENT,
    img: "./profile/badges/images/Badges_Sport.png",
    condition: "Redeem code 'SPORT' between April 6th and May 1st, 2025",
    description: "Like the sports teams of Gekkoukan, Yasogami, and Shujin, you've answered the call on International Sports Day!",
    secret: false,
    check: (stats, profile) => {
        return profile.eventBadges?.sport === true;
    }
},

  // ═════════════════════════════════════════════════════════════════════════
  // 👥 BADGES SOCIAUX (Social Badges)
  // ═════════════════════════════════════════════════════════════════════════

  {
    id: "take_the_pose",
    name: "Take The Pose",
    category: BADGE_CATEGORIES.SOCIAL,
    img: "./profile/badges/images/Badges_Take_The_Pose.png",
    condition: "Share your profile with others",
    description: "Strike a pose! You've shared your PersonaDLE journey with the world.",
    secret: false,
    check: (stats, profile) => {
      return profile?.hasSharedProfile === true;
    }
  },

  // ═════════════════════════════════════════════════════════════════════════
  // 🎟️ BADGES ÉVÉNEMENTIELS (Event Badges - Codes temporaires)
  // ═════════════════════════════════════════════════════════════════════════

  {
    id: "christmas_2025",
    name: "Christmas 2025",
    category: BADGE_CATEGORIES.EVENT,
    img: "./profile/badges/images/Badges_Christmas_2025.png",
    condition: "Redeem code during Christmas 2025",
    description: "Celebrate the holidays with PersonaDLE! May your New Year be full of All-Out Attacks!",
    secret: false,
    eventCode: "XMAS2025",
    eventStart: "2025-12-20",
    eventEnd: "2025-12-31",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("XMAS2025") || false;
    }
  },

  {
    id: "new_years_2026",
    name: "New Year's 2026",
    category: BADGE_CATEGORIES.EVENT,
    img: "./profile/badges/images/Badges_New_Years_2026.png",
    condition: "Redeem code during New Year 2026",
    description: "Ring in the new year with style! Here's to another year of unveiling the truth.",
    secret: false,
    eventCode: "NEWYEAR2026",
    eventStart: "2025-12-31",
    eventEnd: "2026-01-07",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("NEWYEAR2026") || false;
    }
  },

  {
    id: "valentine_2026",
    name: "Valentine's Day 2026",
    category: BADGE_CATEGORIES.EVENT,
    img: "./profile/badges/images/Badges_St_Valentin.png",
    condition: "Redeem code during Valentine's 2026",
    description: "A Social Link deepened! Love is in the air, just like a max rank romance.",
    secret: false,
    eventCode: "VALENTINE2026",
    eventStart: "2026-02-10",
    eventEnd: "2026-02-17",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("VALENTINE2026") || false;
    }
  },

  {
    id: "easter_2026",
    name: "Easter 2026",
    category: BADGE_CATEGORIES.EVENT,
    img: "./profile/badges/images/Badges_Paques.png",
    condition: "Redeem code during Easter 2026",
    description: "Hunt for easter eggs like you hunt for Personas! Spring brings new beginnings.",
    secret: false,
    eventCode: "EASTER2026",
    eventStart: "2026-04-01",
    eventEnd: "2026-04-10",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("EASTER2026") || false;
    }
  },

  // ═════════════════════════════════════════════════════════════════════════
  // 🔒 BADGES SECRETS (Secret Badges - Codes permanents)
  // ═════════════════════════════════════════════════════════════════════════

  {
    id: "true_hacker",
    name: "True Hacker",
    category: BADGE_CATEGORIES.SECRET,
    img: "./profile/badges/images/Badges_True_Hacker.png",
    condition: "???",
    description: "You cracked the code! Futaba would be proud of your hacking skills.",
    secret: true,
    permanentCode: "ALIBABA",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("ALIBABA") || false;
    }
  },

  {
    id: "tae_takemi",
    name: "Tae Takemi Fan",
    category: BADGE_CATEGORIES.SECRET,
    img: "./profile/badges/images/Badges_Tae_Takemi.png",
    condition: "???",
    description: "Support your local punk doctor! The Death confidant rewards the faithful.",
    secret: true,
    permanentCode: "DEATHQUEEN",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("DEATHQUEEN") || false;
    }
  },

  {
    id: "arati",
    name: "Arati's Blessing",
    category: BADGE_CATEGORIES.SECRET,
    img: "./profile/badges/images/Badges_Arati.png",
    condition: "???",
    description: "Recognized by a true Persona content creator! You're part of the community now.",
    secret: true,
    permanentCode: "ARATI",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("ARATI") || false;
    }
  },

  {
    id: "chef",
    name: "Master Chef",
    category: BADGE_CATEGORIES.SECRET,
    img: "./profile/badges/images/Badges_Chef.png",
    condition: "???",
    description: "Sojiro's curry, Nanako's cooking... You appreciate the finer culinary arts of Persona!",
    secret: true,
    permanentCode: "GOURMET",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("GOURMET") || false;
    }
  },

 {
  id: "truth_duality",
  name: "Truth & Duality",
  category: BADGE_CATEGORIES.SECRET,
  img: "./profile/badges/images/Badges_Truth_Duality.png",
  condition: "You have to find both Crow and Black Mask in All-Out Attack mode",
  description: "Two sides of the same coin. The pleasant boy and the black mask... Both faces of justice revealed.",
  secret: false,
  check: (stats, profile) => {
    // Vérifie si le joueur a trouvé les deux formes d'Akechi
    return profile?.foundCrow === true && profile?.foundBlackMask === true;
  }
}
];

// ───────────────────────────────────────────────────────────────────────────
// 📋 DICTIONNAIRE DES CODES (Pour validation rapide)
// ───────────────────────────────────────────────────────────────────────────
export const eventCodes = {
  // Événements temporaires
  XMAS2025: { 
    badgeId: "christmas_2025", 
    start: "2025-12-01", 
    end: "2025-12-31",
    permanent: false 
  },
  NEWYEAR2026: { 
    badgeId: "new_years_2026", 
    start: "2025-12-31", 
    end: "2026-01-31",
    permanent: false 
  },
  VALENTINE2026: { 
    badgeId: "valentine_2026", 
    start: "2026-02-14", 
    end: "2026-03-01",
    permanent: false 
  },
  EASTER2026: { 
    badgeId: "easter_2026", 
    start: "2026-04-01", 
    end: "2026-04-10",
    permanent: false 
  },

  // Codes permanents (secrets)
  ALIBABA: { 
    badgeId: "true_hacker", 
    permanent: true 
  },
  DEATHQUEEN: { 
    badgeId: "tae_takemi", 
    permanent: true 
  },
  ARATI: { 
    badgeId: "arati", 
    permanent: true 
  },
  GOURMET: { 
    badgeId: "chef", 
    permanent: true 
  },


"SPORT": {
    badgeId: "sport",
    start: "2025-04-06",  // 6 avril 2025
    end: "2025-05-01",    // 1er mai 2025
    permanent: false
},
};

// ───────────────────────────────────────────────────────────────────────────
// 🔧 FONCTIONS UTILITAIRES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Vérifie si un code événementiel est actuellement valide
 * @param {string} code - Le code à vérifier
 * @returns {boolean} - True si le code est valide maintenant
 */
export function isEventCodeValid(code) {
  const codeData = eventCodes[code.toUpperCase()];
  if (!codeData) return false;
  if (codeData.permanent) return true;

  const now = new Date();
  const start = new Date(codeData.start);
  const end = new Date(codeData.end);
  
  return now >= start && now <= end;
}

/**
 * Récupère un badge par son ID
 * @param {string} badgeId - L'ID du badge
 * @returns {Object|null} - Le badge ou null
 */
export function getBadgeById(badgeId) {
  return badgesList.find(badge => badge.id === badgeId) || null;
}

/**
 * Récupère tous les badges d'une catégorie
 * @param {string} category - La catégorie (BADGE_CATEGORIES)
 * @returns {Array} - Liste des badges de cette catégorie
 */
export function getBadgesByCategory(category) {
  return badgesList.filter(badge => badge.category === category);
}