// ═══════════════════════════════════════════════════════════════════════════
// 🎖️ PERSONADLE - SYSTÈME DE BADGES
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// 📁 BASE DES IMAGES — chemin absolu calculé depuis ce module
// import.meta.url = URL de ce fichier (profile/badges/badgesData.js)
// → fonctionne quelle que soit la page HTML qui importe ce module
// ───────────────────────────────────────────────────────────────────────────
const BADGE_IMG_BASE = new URL("./images/", import.meta.url).href;

// ───────────────────────────────────────────────────────────────────────────
// 📊 CATÉGORIES DE BADGES
// ───────────────────────────────────────────────────────────────────────────
export const BADGE_CATEGORIES = {
  ACHIEVEMENT: "achievement", // Badges de statistiques
  STREAK: "streak", // Badges de streak quotidienne
  EVENT: "event", // Badges d'événements temporaires
  SECRET: "secret", // Badges secrets (codes permanents)
  SOCIAL: "social", // Badges sociaux (partage, etc.)
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
    img: BADGE_IMG_BASE + "Badges_Ace_Detective.png",
    condition: "Win 10 games",
    description: "You've proven your worth as a true detective. Nothing escapes your keen eye!",
    secret: false,
    check: (stats, profile) => {
      return (stats?.wins || 0) >= 10;
    },
  },

  {
    id: "ace_defective",
    name: "Ace Defective",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badges_Ace_Defective.png",
    condition: "Give up 10 times",
    description: "Sometimes the shadows are too strong. But you keep coming back!",
    secret: false,
    check: (stats, profile) => {
      return (stats?.giveups || 0) >= 10;
    },
  },

  {
    id: "shadow_slayer",
    name: "Shadow Slayer",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badges_Shadow_Slayer.png",
    condition: "Win 5 games in Silhouette mode",
    description: "You see through the darkness. Even shadows can't hide from you!",
    secret: false,
    check: (stats, profile) => {
      const silhouetteWins = stats?.modeWins?.Silhouette || 0;
      return silhouetteWins >= 5;
    },
  },

  {
    id: "music_master",
    name: "Music Master",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badges_Music.png",
    condition: "Win 20 games in Music mode",
    description:
      "You'll never see it coming! A true connoisseur of Persona's legendary soundtracks.",
    secret: false,
    check: (stats, profile) => {
      const musicWins = stats?.modeWins?.Music || 0;
      return musicWins >= 20;
    },
  },

  {
    id: "burn_my_dread",
    name: "Memento Mori",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badges_Burn_My_Dread_Silver.png",
    condition: "Find 'Burn My Dread' in Music mode",
    description:
      "Three souls bound by fate, pointing their choices like guns. In the shadow of death, the truth demands a trigger.",
    secret: false,
    check: (stats, profile) => {
      return profile?.foundBurnMyDread === true;
    },
  },
  {
    id: "into_the_fog",
    name: "Unsolved Case",
    category: BADGE_CATEGORIES.ACHIEVEMENT, // On le passe en Achievement car il n'est plus secret
    img: BADGE_IMG_BASE + "Badges_something_wrong.png",
    condition: "Turn your back on the truth and let the fog settle over the final investigation",
    description:
      "The train departs, but the mystery remains. You chose the path of ignorance, leaving the true culprit smiling in the shadows.",
    secret: false, // 👁️ Visible : tout le monde sait comment l'avoir maintenant
    check: (stats, profile) => {
      return profile?.lostToNeverMore === true;
    },
  },
  {
    id: "velvet_headache",
    name: "Velvet Headache",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badges_velvet_headache.png",
    condition: "Find Wonder (Velvet) and Caroline & Justine in All-Out Attack",
    description:
      "So loud... The sisters are fighting, and the guest has a migraine. You've witnessed the true chaos of the Velvet Room.",
    secret: false, // Pas caché
    check: (stats, profile) => {
      // Vérifie si les deux drapeaux sont activés
      return profile?.foundWonderVelvet === true && profile?.foundTwins === true;
    },
  },

  {
    id: "first_win",
    name: "First Victory",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badges_Fisrt_Win.png",
    condition: "Win your first game",
    description:
      "The first step on your journey as a Persona user. A wild card has awakened within you.",
    secret: false,
    check: (stats, profile) => {
      return (stats?.wins || 0) >= 1;
    },
  },

  {
    id: "p1_p2_fan",
    name: "Echoes of the Past",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badges_P1_P2_Fan.png",
    condition: "Win 15 games in Classic mode",
    description:
      "You've walked the same path as Naoya, Tatsuya, and Maya. The legacy of the first awakened lives on through you.",
    secret: false,
    check: (stats, profile) => {
      // "Win 15 games" → victoires (modeWins), pas parties jouées (modeCount inclut les abandons)
      return (stats?.modeWins?.Classic || 0) >= 15;
    },
  },
  {
    id: "velvet_master",
    name: "Velvet Master",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badges_Velvet_master.png",
    condition: "Win 10 games in Personae mode",
    description: "You have mastered the velvet room. Igor is pleased with your progress.",
    secret: false,
    check: (stats, profile) => {
      // "Win 10 games" → victoires (modeWins), pas parties jouées (modeCount inclut les abandons)
      return (stats?.modeWins?.Personae || 0) >= 10;
    },
  },
  {
    id: "chinese_new_year",
    name: "Chinese New Year Achievement",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Chinesse_new_year.png",
    condition: "Find Wonder and Rin (CNY) in All-Out Attack",
    description: "Celebration time! You discovered the festive versions of the Phantom Thieves.",
    secret: false,
    check: (stats, profile) => {
      // Vérifie si les drapeaux sauvegardés par le mode All-Out Attack sont actifs
      return profile?.foundWonderCNY === true && profile?.foundRinCNY === true;
    },
  },

  {
    id: "twin_blade",
    name: "Twin Blade",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Twin_Blade.png",
    condition: "Find a Personae of Yosuke and Yusuke",
    description:
      "Wind and Ice, blades crossed! You've identified the personas of the dual-wielding artists.",
    secret: false,
    check: (stats, profile) => {
      // Vérifie si les drapeaux sauvegardés par le mode Personae sont actifs
      return profile?.foundYosuke === true && profile?.foundYusuke === true;
    },
  },
  {
    id: "persona_q_explorer",
    name: "Cinema Explorer",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badges_Persona_Q.webp",
    condition: "Find all 4 Persona Q exclusive characters in Silhouette mode",
    description:
      "You've ventured into the cinema's labyrinth and met its unique guardians. Rei, Zen, Hikari, and Nagi—all discovered in the shadows!",
    secret: false,
    check: (stats, profile) => {
      const requiredCharacters = ["Rei", "Zen", "Hikari", "Nagi"];
      const foundPQCharacters = profile?.foundPQCharacters || [];
      return requiredCharacters.every((char) => foundPQCharacters.includes(char));
    },
  },

  {
    id: "crimson_legacy",
    name: "Crimson Legacy",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Picaro.png",
    condition: "Find all 12 Picaro Personas",
    description:
      "Awarded to the Trickster who recognizes the past painted in red. You identified the rebellious spirits of legends reborn.",
    secret: true, // Ou true si tu veux que ce soit une surprise
    check: (stats, profile) => {
      // Vérifie si la liste 'picarosFound' dans le profil contient 12 éléments uniques
      return profile?.picarosFound && profile.picarosFound.length >= 12;
    },
  },

  {
    id: "rentree",
    name: "Spring Awakening",
    category: BADGE_CATEGORIES.EVENT,
    img: BADGE_IMG_BASE + "Badges_Rentré.png",
    condition: "Log in on April 1st",
    description:
      "Cherry blossoms bloom as a new school year begins. You've entered the Velvet Room on Japan's opening ceremony day.",
    secret: false,
    check: (stats, profile) => {
      return profile.eventBadges?.rentree === true;
    },
  },

  {
    id: "sport",
    name: "Athletic Spirit",
    category: BADGE_CATEGORIES.EVENT,
    img: BADGE_IMG_BASE + "Badges_Sport.png",
    condition: "Redeem code 'SPORT' between April 6th and May 1st, 2025",
    description:
      "Like the sports teams of Gekkoukan, Yasogami, and Shujin, you've answered the call on International Sports Day!",
    secret: false,
    check: (stats, profile) => {
      return profile.eventBadges?.sport === true;
    },
  },

  // ═════════════════════════════════════════════════════════════════════════
  // 👥 BADGES SOCIAUX (Social Badges)
  // ═════════════════════════════════════════════════════════════════════════

  {
    id: "take_the_pose",
    name: "Take The Pose",
    category: BADGE_CATEGORIES.SOCIAL,
    img: BADGE_IMG_BASE + "Badges_Take_The_Pose.png",
    condition: "Share your profile with others",
    description: "Strike a pose! You've shared your PersonaDLE journey with the world.",
    secret: false,
    check: (stats, profile) => {
      return profile?.hasSharedProfile === true;
    },
  },

  // ═════════════════════════════════════════════════════════════════════════
  // 🎟️ BADGES ÉVÉNEMENTIELS (Event Badges - Codes temporaires)
  // ═════════════════════════════════════════════════════════════════════════

  {
    id: "christmas_2025",
    name: "Christmas 2025",
    category: BADGE_CATEGORIES.EVENT,
    img: BADGE_IMG_BASE + "Badges_Christmas_2025.png",
    condition: "Redeem code during Christmas 2025",
    description:
      "Celebrate the holidays with PersonaDLE! May your New Year be full of All-Out Attacks!",
    secret: false,
    eventCode: "XMAS2025",
    eventStart: "2025-12-20",
    eventEnd: "2025-12-31",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("XMAS2025") || false;
    },
  },

  {
    id: "new_years_2026",
    name: "New Year's 2026",
    category: BADGE_CATEGORIES.EVENT,
    img: BADGE_IMG_BASE + "Badges_New_Years_2026.png",
    condition: "Redeem code during New Year 2026",
    description: "Ring in the new year with style! Here's to another year of unveiling the truth.",
    secret: false,
    eventCode: "NEWYEAR2026",
    eventStart: "2025-12-31",
    eventEnd: "2026-01-07",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("NEWYEAR2026") || false;
    },
  },
  {
    id: "chinese_new_year_2026",
    name: "Happy Chinese New Year 2026",
    category: BADGE_CATEGORIES.EVENT,
    img: BADGE_IMG_BASE + "Badges_Chiness_New_Year.webp",
    condition: "Type the chinese new year code during the 2026 celebration",
    description:
      "Ryuji & Wu Kong ready for the new year! May the year of the horse bring you strength and courage!",
    secret: false,
    eventCode: "CHINESNY2026",
    eventStart: "2026-02-01",
    eventEnd: "2026-03-01",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("CHINESNY2026") || false;
    },
  },

  {
    id: "valentine_2026",
    name: "Valentine's Day 2026",
    category: BADGE_CATEGORIES.EVENT,
    img: BADGE_IMG_BASE + "Badges_St_Valentin.png",
    condition: "Redeem code during Valentine's 2026",
    description: "A Social Link deepened! Love is in the air, just like a max rank romance.",
    secret: false,
    eventCode: "VALENTINE2026",
    eventStart: "2026-02-10",
    eventEnd: "2026-02-17",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("VALENTINE2026") || false;
    },
  },

  {
    id: "easter_2026",
    name: "Easter 2026",
    category: BADGE_CATEGORIES.EVENT,
    img: BADGE_IMG_BASE + "Badges_Paques.png",
    condition: "Redeem code during Easter 2026",
    description: "Hunt for easter eggs like you hunt for Personas! Spring brings new beginnings.",
    secret: false,
    eventCode: "EASTER2026",
    eventStart: "2026-04-01",
    eventEnd: "2026-04-10",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("EASTER2026") || false;
    },
  },

  // ═════════════════════════════════════════════════════════════════════════
  // 🔒 BADGES SECRETS (Secret Badges - Codes permanents)
  // ═════════════════════════════════════════════════════════════════════════

  {
    id: "true_hacker",
    name: "True Hacker",
    category: BADGE_CATEGORIES.SECRET,
    img: BADGE_IMG_BASE + "Badges_True_Hacker.png",
    condition: "???",
    description: "You cracked the code! Futaba would be proud of your hacking skills.",
    secret: true,
    permanentCode: "ALIBABA",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("ALIBABA") || false;
    },
  },

  {
    id: "tae_takemi",
    name: "Tae Takemi Fan",
    category: BADGE_CATEGORIES.SECRET,
    img: BADGE_IMG_BASE + "Badges_Tae_Takemi.png",
    condition: "???",
    description: "Support your local punk doctor! The Death confidant rewards the faithful.",
    secret: true,
    permanentCode: "DEATHQUEEN",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("DEATHQUEEN") || false;
    },
  },

  {
    id: "arati",
    name: "Arati's Blessing",
    category: BADGE_CATEGORIES.SECRET,
    img: BADGE_IMG_BASE + "Badges_Arati.png",
    condition: "???",
    description: "Recognized by a true Persona content creator! You're part of the community now.",
    secret: true,
    permanentCode: "ARATI",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("ARATI") || false;
    },
  },
  {
    id: "denial_of_self",
    name: "Denial of Self",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Denial_Of_Self.webp",
    condition: "Win 10 Expert games in each of the 6 modes",
    description:
      "You faced every Expert trial and denied nothing. The Shadow is you — and you mastered it.",
    secret: false,
    // Vérifié UNIQUEMENT côté serveur (condition_type `expert_modes_mastered`,
    // api/lib/condition_check.php) : les victoires Expert par mode ne sont pas
    // dans `stats` — le Mode Expert n'alimente pas `user_stats`, elles se
    // recalculent depuis `game_sessions` (cf. api/user/stats.php).
    // badgesManager fusionne `is_unlocked` renvoyé par GET /api/badges, qui fait foi.
    check: () => false,
  },

  {
    id: "gyotre",
    name: "Gyotre",
    category: BADGE_CATEGORIES.SECRET,
    img: BADGE_IMG_BASE + "Badge_Gyotre.webp",
    condition: "???",
    description: "A secret only the real ones know.",
    secret: true,
    permanentCode: "GYOTRE",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("GYOTRE") || false;
    },
  },
  {
    id: "dzulian",
    name: "The First Contractor",
    category: BADGE_CATEGORIES.SECRET,
    img: BADGE_IMG_BASE + "Badge_Dzulian.png",
    condition: "???",
    description:
      "When the code couldn't reach the PS1 era, Dzulian descended with the ancient texts. Megami Ibunroku, IS, EP—the trinity preserved. The GOAT who bridged two generations of Persona.",
    permanentCode: "DZULIAN",
    secret: true,
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("DZULIAN") || false;
    },
  },

  {
    id: "hippocampus_reload",
    name: "Hippocampus Reload",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badges_Zotomayo.webp",
    condition: "Find the ZUTOMAYO x P3R Mashup in Music mode",
    description:
      "Brainwaves synced! You found the chaotic mashup where growing pains meet mass destruction. The memory of this beat will never fade.",
    secret: false,
    check: (stats, profile) => {
      return profile?.foundZutomayo === true;
    },
  },

  {
    id: "chef",
    name: "Master Chef",
    category: BADGE_CATEGORIES.SECRET,
    img: BADGE_IMG_BASE + "Badges_Chef.png",
    condition: "???",
    description:
      "Sojiro's curry, Nanako's cooking... You appreciate the finer culinary arts of Persona!",
    secret: true,
    permanentCode: "GOURMET",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("GOURMET") || false;
    },
  },
  {
    id: "github_contributor",
    name: "Phantom Coder",
    category: BADGE_CATEGORIES.SECRET,
    img: BADGE_IMG_BASE + "Badges_Github_Morgana.png",
    condition: "???",
    description: "You checked the source code! A true Phantom Thief always gathers intel first.",
    secret: true,
    check: (stats, profile) => {
      // Ce badge se débloque si le flag 'visitedGithub' est à true dans le profil
      return profile?.visitedGithub === true;
    },
  },
  {
    id: "lobster",
    name: "Artistic Lobster",
    category: BADGE_CATEGORIES.SECRET,
    img: BADGE_IMG_BASE + "Badges_Lobster.png",
    condition: "???",
    description:
      "Magnificent! The contours, the form... This crustacean captures the very essence of beauty! I must paint this immediately!",
    secret: true,
    permanentCode: "LOBSTER",
    check: (stats, profile) => {
      return profile?.eventCodes?.includes("LOBSTER") || false;
    },
  },

  {
    id: "truth_duality",
    name: "Truth & Duality",
    category: BADGE_CATEGORIES.SECRET,
    img: BADGE_IMG_BASE + "Badges_Truth_Duality.png",
    condition: "You have to find both Crow and Black Mask in All-Out Attack mode",
    description:
      "Two sides of the same coin. The pleasant boy and the black mask... Both faces of justice revealed.",
    secret: false,
    check: (stats, profile) => {
      return profile?.foundCrow === true && profile?.foundBlackMask === true;
    },
  },

  // ── Nouveaux badges v2.1 — Gameplay ─────────────────────────────────────
  {
    id: "one_shot",
    name: "Critical Strike",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_One_Shot.webp",
    condition: "Guess correctly on the very first try",
    description:
      "Why waste time with strategy when you can just smash through? Awarded for a flawless first guess, striking the truth with the raw, unstoppable force of a one-hit KO.",
    secret: false,
    check: (stats, profile) => profile?.hasWonFirstTry === true,
  },
  {
    id: "aoa_vision",
    name: "Piercing the Fog",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Midnight_Vision.webp",
    condition: "Guess the All-Out Attack on the very first try",
    description:
      "The truth was shrouded in heavy fog, yet you didn't even need glasses to see the big picture. Awarded for instantly recognizing the All-Out Attack through the blinding static.",
    secret: false,
    check: (stats, profile) => profile?.hasWonAOAFirstTry === true,
  },
  {
    id: "emoji_decoder",
    name: "Emoji Decoder",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Emoji_Decoder.webp",
    condition: "Win 10 games in Emoji mode",
    description:
      "The Metaverse speaks a wordless language, a cacophony of cryptic symbols. With royal finesse, you deciphered the code of the digital soul.",
    secret: false,
    check: (stats, profile) => (stats?.modeWins?.Emoji || 0) >= 10,
  },
  {
    id: "navigator",
    name: "Eye of the Navigator",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Navigator.webp",
    condition: "Use the hint 50 times in Classic mode",
    description: "Fifty anomalies scanned and deciphered. No truth can hide from your radar.",
    secret: false,
    check: (stats, profile) => (profile?.classicHintsUsed || 0) >= 50,
  },
  {
    id: "velvet_regular",
    name: "Velvet Regular",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Velvet_Regular.webp",
    condition: "Play on 50 unique days",
    description:
      "Fifty days between mind and matter. The master of this room now recognizes your footsteps.",
    secret: false,
    check: (stats, profile) => (profile?.uniqueDaysPlayed || 0) >= 50,
  },
  {
    id: "strega",
    name: "Apostles of the Fall",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Strega.webp",
    condition: "Find Hypnos (Takaya), Moros (Jin) and Medea (Chidori) in Personae mode",
    description:
      "Why fight the inevitable? The world is a stage for the final act. We are simply the directors of your beautiful destruction.",
    secret: false,
    check: (stats, profile) =>
      profile?.foundHypnos === true && profile?.foundMoros === true && profile?.foundMedea === true,
  },
  {
    id: "twin_fist",
    name: "Twin Fist",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Twin_Fist.webp",
    condition: "Find a Persona of Makoto Nijima and Akihiko in Personae mode",
    description:
      "Nuclear force and crackling lightning! You've identified the personas of the two fiercest brawlers who lead with their knuckles.",
    secret: false,
    check: (stats, profile) =>
      profile?.foundMakotoNijima === true && profile?.foundAkihiko === true,
  },
  {
    id: "twin_spear",
    name: "Twin Spear",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Twin_Spear.webp",
    condition: "Find a Persona of Kotone and Ken in Personae mode",
    description:
      "One seeks vengeance through light, the other leads with a dancing blade. You've found the spear-wielding duo of the Moonlight Bridge.",
    secret: false,
    check: (stats, profile) => profile?.foundKotone === true && profile?.foundKen === true,
  },
  {
    id: "tradition_modernite",
    name: "Chronological Convergence",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Tradition_Modernite.webp",
    condition:
      "Find Naoto's & Futaba's personas + 'Secret Base' & 'When Mother Was There' in Music mode",
    description:
      "Two minds, a century apart, now perfectly synchronized in the infinite search for truth. Tradition and innovation are one.",
    secret: false,
    check: (stats, profile) =>
      profile?.foundNaotoPersona === true &&
      profile?.foundFutabaPersona === true &&
      profile?.foundSecretBase === true &&
      profile?.foundWhenMotherWasThere === true,
  },
  {
    id: "shapeshifter",
    name: "The Formless Soul",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Shapshifter.webp",
    condition: "Guess the same character in 3 different modes (cumulative)",
    description:
      "A mask may change, and the stage may shift, but the true self remains constant. Awarded to those who can pierce the cognitive distortions and recognize a single soul across three different realities.",
    secret: false,
    check: (stats, profile) => {
      const map = profile?.characterModeMap || {};
      return Object.values(map).some((modes) => modes.length >= 3);
    },
  },
  {
    id: "ideal_reality",
    name: "Gentle Illusion",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Ideal_Reality.webp",
    condition: "Give up when the target is 'Our Light' in Music mode",
    description:
      "Why struggle to reach the light when happiness can be given to you? You laid down your rebellious soul to embrace a painless, perfect dream.",
    secret: false,
    check: (stats, profile) => profile?.gaveUpOnOurLight === true,
  },
  {
    id: "for_real",
    name: "For Real",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badges_for_real.png",
    condition: "Find Ryuji's All-Out Attack in AOA mode and his persona in Personae mode",
    description:
      "YEAH! That's what I'm talking about! You found the most passionate Phantom Thief — both his Persona and his signature All-Out Attack!",
    secret: false,
    check: (stats, profile) =>
      profile?.foundRyujiAOA === true && profile?.foundRyujiPersona === true,
  },
  {
    id: "night_owl",
    name: "Phantom of the Night",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Night_Owl.webp",
    condition: "Play between midnight and 5 AM (Paris time)",
    description: "True thieves operate under the cover of darkness. The cognitive world is yours.",
    secret: false,
    check: (stats, profile) => profile?.playedAtNight === true,
  },
  {
    id: "nyx_hour",
    name: "Nyx Hour",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_Nyx_Hour.webp",
    condition: "Play between midnight and 12:30 AM (Paris time)",
    description:
      "The clock strikes twelve, but tomorrow never comes. You have witnessed the arrival of the end.",
    secret: false,
    check: (stats, profile) => profile?.playedAtNyxHour === true,
  },
  {
    id: "stylist",
    name: "Breathtaking Aesthetics",
    category: BADGE_CATEGORIES.ACHIEVEMENT,
    img: BADGE_IMG_BASE + "Badge_stylist.webp",
    condition: "Customize your profile: avatar + UI color + profile music + equipped title",
    description:
      "Such passion! Such composition! You refused the mediocrity of a default profile to forge a visual masterpiece that moves the very soul.",
    secret: false,
    check: (stats, profile) =>
      !!profile?.avatar &&
      !!(
        (profile?.profileTheme &&
          profile.profileTheme !== "all_out" &&
          profile.profileTheme !== "") ||
        (profile?.avatarBorderColor &&
          profile.avatarBorderColor !== "#000000" &&
          profile.avatarBorderColor !== "#ffffff")
      ) &&
      !!profile?.profileSong?.fichier &&
      !!(profile?.equippedTitleSlug || profile?.equippedTitleId),
  },

  // ── Streak badges ────────────────────────────────────────────────────────
  {
    id: "pyro_spark",
    name: "The Ignition",
    category: BADGE_CATEGORIES.STREAK,
    img: BADGE_IMG_BASE + "Badge_Pyro_Spark.webp",
    condition: "Reach a 7-day streak",
    description:
      "A tiny flicker in the dark. For seven days, you've kept the flame alive. The first step towards a scorching resolve.",
    secret: false,
    check: (stats, profile) => (stats?.streakRecord || 0) >= 7,
  },
  {
    id: "raphael",
    name: "The Divine Blaze",
    category: BADGE_CATEGORIES.STREAK,
    img: BADGE_IMG_BASE + "Badge_Raphael.webp",
    condition: "Reach a 30-day streak",
    description:
      "Thirty days. The flicker has ascended into a roaring inferno. Your resolve now burns with a heat that even the abyss cannot cool.",
    secret: false,
    check: (stats, profile) => (stats?.streakRecord || 0) >= 30,
  },
  {
    id: "surt",
    name: "Ragnarök's Dawn",
    category: BADGE_CATEGORIES.STREAK,
    img: BADGE_IMG_BASE + "Badge_Surt.webp",
    condition: "Reach a 90-day streak",
    description:
      "Ninety days of absolute, unrelenting persistence. You have summoned the world-ending fire of Surt. The old world of hesitation has been incinerated.",
    secret: false,
    check: (stats, profile) => (stats?.streakRecord || 0) >= 90,
  },
  {
    id: "lucifer",
    name: "Crest of the Morning Star",
    category: BADGE_CATEGORIES.STREAK,
    img: BADGE_IMG_BASE + "Badge_Lucifer.webp",
    condition: "Reach a 120-day streak",
    description:
      "One hundred and twenty sunrises. Beyond the fires of destruction lies the blinding clarity of the Morning Star. You have seized ultimate dominion over time itself.",
    secret: false,
    check: (stats, profile) => (stats?.streakRecord || 0) >= 120,
  },
  {
    id: "helel",
    name: "The Eternal Zenith",
    category: BADGE_CATEGORIES.STREAK,
    img: BADGE_IMG_BASE + "Badge_Helel.webp",
    condition: "Reach a 365-day streak",
    description:
      "Beyond rebellion, beyond ruin, lies the pure grace of the first star. You have walked the path for a year, reaching a state of perfection that even the gods envy.",
    secret: false,
    check: (stats, profile) => (stats?.streakRecord || 0) >= 365,
  },
  {
    id: "reborn_phoenix",
    name: "Phoenix Reborn",
    category: BADGE_CATEGORIES.STREAK,
    img: BADGE_IMG_BASE + "Badge_Reborn_Phenix.webp",
    condition: "Restore your streak after losing it (grace period)",
    description:
      "A momentary lapse in the flow of time! You refused to let the darkness claim your legacy. From the scattered ashes of yesterday, you soar toward a new dawn.",
    secret: false,
    check: (stats, profile) => profile?.streakRestorationUsed === true,
  },

  // ── Badges sociaux ───────────────────────────────────────────────────────
  {
    id: "best_bro",
    name: "Best Bro",
    category: BADGE_CATEGORIES.SOCIAL,
    img: BADGE_IMG_BASE + "Badges_Best_bro.png",
    condition: "Have 2 or more friends",
    description:
      "The bonds of friendship transcend time and fate. You've found your allies in the velvet web of connections.",
    secret: false,
    check: (stats, profile) => profile?.hasTwoFriends === true,
  },
  {
    id: "data_mining",
    name: "Data Mining",
    category: BADGE_CATEGORIES.SOCIAL,
    img: BADGE_IMG_BASE + "Badge_Data_Mining.webp",
    condition: "Visit 5 different user profiles",
    description:
      "Analyzing the competition or seeking new bonds? You've peered into the souls of five different users.",
    secret: false,
    check: (stats, profile) => (profile?.visitedProfileIds?.length || 0) >= 5,
  },
  {
    id: "leblanc_meeting",
    name: "Leblanc Meeting",
    category: BADGE_CATEGORIES.SOCIAL,
    img: BADGE_IMG_BASE + "Badge_Leblanc_Meeting.webp",
    condition: "3 or more friends logged in the same day as you",
    description:
      "Synchronized souls! You and your closest allies have converged. Even the busiest Phantom Thief needs a coffee break.",
    secret: false,
    check: (stats, profile) => !!profile?.leblanc3FriendsDay,
  },

  // ── Badges événementiels ─────────────────────────────────────────────────
  {
    id: "golden_week",
    name: "Golden Week",
    category: BADGE_CATEGORIES.EVENT,
    img: BADGE_IMG_BASE + "Badge_Golden_Week.webp",
    condition: "Log in between April 29 and May 5",
    description:
      "Even truth-seekers need a break. You spent the golden holidays forging bonds under the evening sun.",
    secret: false,
    check: (stats, profile) => profile?.eventBadges?.golden_week === true,
  },
  {
    id: "tanabata",
    name: "Tanabata",
    category: BADGE_CATEGORIES.EVENT,
    img: BADGE_IMG_BASE + "Badge_Tanabata.webp",
    condition: "Log in on July 7th",
    description:
      "The stars align for a single night. Your wish has been recorded in the celestial archives of the Sea of Souls.",
    secret: false,
    check: (stats, profile) => profile?.eventBadges?.tanabata === true,
  },
  {
    id: "promised_day",
    name: "The Promised Day",
    category: BADGE_CATEGORIES.EVENT,
    img: BADGE_IMG_BASE + "Badge_Promised_Day.webp",
    condition: "Play on December 31st AND January 1st",
    description:
      "The clock strikes twelve on the dying year. You faced the threshold of the new dawn without blinking.",
    secret: false,
    check: (stats, profile) => profile?.eventBadges?.promised_day === true,
  },

  // ── Badges secrets ───────────────────────────────────────────────────────
  {
    id: "hifumi_archives",
    name: "The Grandmaster's Tome",
    category: BADGE_CATEGORIES.SECRET,
    img: BADGE_IMG_BASE + "Badge_Hifumi_Archives.webp",
    condition: "???",
    description:
      "A true tactician studies the board before striking. You've uncovered the hidden reports.",
    secret: true,
    check: (stats, profile) => profile?.hifumiArchivesRead === true,
  },
  {
    id: "report",
    name: "The Priestess's Audit",
    category: BADGE_CATEGORIES.SECRET,
    img: BADGE_IMG_BASE + "Badge_Report.webp",
    condition: "???",
    description:
      "Channeling the meticulous wisdom of the High Priestess, you've documented the anomalies. Awarded to those who bear the heavy burden of paperwork to keep the system's chaos in check.",
    secret: true,
    check: (stats, profile) => profile?.reportSubmitted === true,
  },
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
    permanent: false,
  },
  NEWYEAR2026: {
    badgeId: "new_years_2026",
    start: "2025-12-31",
    end: "2026-01-31",
    permanent: false,
  },
  VALENTINE2026: {
    badgeId: "valentine_2026",
    start: "2026-02-14",
    end: "2026-03-01",
    permanent: false,
  },
  EASTER2026: {
    badgeId: "easter_2026",
    start: "2026-04-01",
    end: "2026-04-10",
    permanent: false,
  },
  CHINESNY2026: {
    badgeId: "chinese_new_year_2026",
    start: "2026-02-01",
    end: "2026-03-01",
    permanent: false,
  },

  // Codes permanents (secrets)
  ALIBABA: {
    badgeId: "true_hacker",
    permanent: true,
  },
  DEATHQUEEN: {
    badgeId: "tae_takemi",
    permanent: true,
  },
  ARATI: {
    badgeId: "arati",
    permanent: true,
  },
  DZULIAN: {
    badgeId: "dzulian",
    permanent: true,
  },
  GOURMET: {
    badgeId: "chef",
    permanent: true,
  },
  LOBSTER: {
    badgeId: "lobster",
    permanent: true,
  },

  SPORT: {
    badgeId: "sport",
    start: "2025-04-06", // 6 avril 2025
    end: "2025-05-01", // 1er mai 2025
    permanent: false,
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
  return badgesList.find((badge) => badge.id === badgeId) || null;
}

/**
 * Récupère tous les badges d'une catégorie
 * @param {string} category - La catégorie (BADGE_CATEGORIES)
 * @returns {Array} - Liste des badges de cette catégorie
 */
export function getBadgesByCategory(category) {
  return badgesList.filter((badge) => badge.category === category);
}
