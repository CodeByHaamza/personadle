/**
 * scripts/avatar_census.js — Recensement des portraits de profil par personnage.
 *
 * `profile/avatars_data.js` ne connaît que des noms de fichiers rangés par jeu :
 * rien n'y dit QUI est sur l'image. Les noms sont hétérogènes (`Yuki.gif`,
 * `makoto_yuki.jpg`, `pfp_makoto.gif` désignent la même personne ; `Makoto.jpg`
 * en désigne une autre), donc aucune heuristique sur le nom de fichier ne tient.
 * D'où la table ci-dessous, tenue à la main.
 *
 * Elle sert deux choses :
 *   - `npm run avatars:census` — combien de portraits par personnage, pour savoir
 *     qui en manque avant d'aller en chercher ;
 *   - l'ordre du fichier : chaque groupe est trié protagoniste → cast principal →
 *     personnages secondaires, et le champ `role` ci-dessous en est la source.
 *
 * Ajouter un portrait sans l'inscrire ici le fait apparaître en « NON RECENSÉ » :
 * c'est voulu, c'est le rappel qu'il manque son personnage.
 */

import { AVATAR_GROUPS } from "../profile/avatars_data.js";

/**
 * Rosters par groupe, dans l'ordre d'affichage voulu.
 * `role` : "protagoniste" | "principal" | "secondaire".
 */
export const ROSTERS = {
  P1: [
    {
      nom: "Naoya Todou",
      role: "protagoniste",
      fichiers: [
        "Naoya.jpg",
        "Naoya1.jpg",
        "naoya_todou_p1.jpg",
        "naoya_todou_p1_2.jpg",
        "naoya_todou_p1_3.jpg",
      ],
    },
    { nom: "Masao Inaba", role: "principal", fichiers: ["Inaba.webp", "Inaba2.webp"] },
    { nom: "Kei Nanjo", role: "principal", fichiers: ["Kei.webp", "Kei2.jpg", "kei_nanjo_p1.jpg"] },
    { nom: "Hidehiko Uesugi", role: "principal", fichiers: ["Hidehiko.png", "Hidehiko.webp"] },
    {
      nom: "Eriko Kirishima",
      role: "principal",
      fichiers: [
        "Eriko.png",
        "eriko_kirishima_p1.jpg",
      ],
    },
    {
      nom: "Yukino Mayuzumi",
      role: "principal",
      fichiers: [
        "Yukino.webp",
        "yukino_mayuzumi_p1.jpg",
        "yukino_mayuzumi_p1_2.jpg",
      ],
    },
    { nom: "Yuka Ayase", role: "secondaire", fichiers: ["Yuka.webp"] },
    { nom: "Maki Sonomura", role: "principal", fichiers: ["maki_sonomura_p1.jpg", "maki_sonomura_p1_2.jpg"] },
    {
      nom: "Reiji Kido",
      role: "principal",
      fichiers: [
        "reiji_kido_p1.jpg",
        "reiji_kido_p1_2.jpg",
      ],
    },
  ],
  P2: [
    {
      nom: "Tatsuya Suou",
      role: "protagoniste",
      fichiers: [
        "Tatsuya.jpg",
        "Tatsuya2.jpg",
        "tatsuya_suou_p2.jpg",
        "tatsuya_suou_p2_2.jpg",
        "tatsuya_suou_p2_3.jpg",
      ],
    },
    {
      nom: "Maya Amano",
      role: "protagoniste",
      fichiers: [
        "Maya.jpg",
        "Maya2.jpeg",
        "maya_amano_p2.jpg",
        "maya_amano_p2_2.jpg",
        "maya_amano_p2_3.jpg",
        "maya_amano_p2_4.jpg",
        "maya_amano_p2_5.jpg",
      ],
    },
    {
      nom: "Eikichi Mishina",
      role: "principal",
      fichiers: [
        "Ekichi.jpeg",
        "Ekichi2.jpeg",
        "eikichi_mishina_p2.jpg",
        "eikichi_mishina_p2_2.jpg",
        "eikichi_mishina_p2_3.jpg",
      ],
    },
    {
      nom: "Lisa Silverman",
      role: "principal",
      fichiers: [
        "Lisa.jpeg",
        "lisa_silverman_p2.jpg",
        "lisa_silverman_p2_2.jpg",
      ],
    },
    { nom: "Jun Kurosu", role: "principal", fichiers: ["Jun.jpg", "JOKER.webp"] },
    { nom: "Baofu", role: "principal", fichiers: ["baofu_p2.jpg", "baofu_p2_2.jpg"] },
    {
      nom: "Katsuya Suou",
      role: "principal",
      fichiers: [
        "katsuya_suou_p2.jpg",
        "katsuya_suou_p2_2.jpg",
        "katsuya_suou_p2_3.jpg",
        "katsuya_suou_p2_4.jpg",
      ],
    },
    {
      nom: "Ulala Serizawa",
      role: "principal",
      fichiers: [
        "ulala_serizawa_p2.jpg",
        "ulala_serizawa_p2_2.jpg",
      ],
    },
    { nom: "Yukino Mayuzumi (P2)", role: "principal", fichiers: ["yukino_mayuzumi_p2.jpg"] },
  ],
  P3: [
    {
      nom: "Makoto Yuki",
      role: "protagoniste",
      fichiers: [
        "makoto_yuki.jpg",
        "Yuki.gif",
        "Yuki.jpeg",
        "yuki.jpg",
        "Yuki2.gif",
        "makoto_yuki_p3.jpg",
        "makoto_yuki_p3_2.jpg",
        "makoto_yuki_p3_3.jpg",
        "makoto_yuki_p3_4.jpg",
        "makoto_yuki_p3_5.jpg",
        "makoto_yuki_p3_6.jpg",
        "makoto_yuki_p3_7.jpg",
      ],
    },
    {
      nom: "Kotone Shiomi",
      role: "protagoniste",
      fichiers: [
        "Kotone.jpeg",
        "Kotone2.jpeg",
        "Kotone3.jpeg",
        "kotone_pdp.jpg",
        "kotone_shiomi.jpg",
        "kotone_shiomi_p3p.jpg",
        "kotone_shiomi_p3p_2.jpg",
        "kotone_shiomi_p3p_3.jpg",
        "kotone_shiomi_p5x_crossover.jpg",
        // Animés (2.3) — le suffixe `_anim_` les fait remonter dans l'onglet
        // « Animés » de la galerie, cf. scripts/sort_avatars_data.mjs.
        "kotone_shiomi_p3_anim_butterfly.webp",
        "kotone_shiomi_p3_anim_listening.webp",
        "kotone_shiomi_p3_anim_orpheus.webp",
        "kotone_shiomi_p3_anim_pink.webp",
      ],
    },
    {
      nom: "Aigis",
      role: "protagoniste",
      // Protagoniste de P3FES « The Answer » — d'où sa place juste
      // après Kotone plutôt que dans le cast principal (Hamza, 2026-09-23).
      fichiers: [
        "aigis_train.jpg",
        "aigis.gif",
        "Aigis.jpg",
        "Aigis2.jpg",
        "aigis_p3.jpg",
        "aigis_p3_2.jpg",
        "aigis_p3_3.jpg",
      ],
    },
    {
      nom: "Yukari Takeba",
      role: "principal",
      fichiers: [
        "Yukari.jpg",
        "Yukari2.jpg",
        "yukari_takeba_p3.jpg",
        "yukari_takeba_p3_2.jpg",
        "yukari_takeba_p3_3.jpg",
      ],
    },
    {
      nom: "Junpei Iori",
      role: "principal",
      fichiers: [
        "Junpei.png",
        "Junpei2.jpg",
        "junpei_iori_p3.jpg",
        "junpei_iori_p3_2.jpg",
        "junpei_iori_p3_3.jpg",
        "junpei_iori_p3_4.jpg",
      ],
    },
    {
      nom: "Akihiko Sanada",
      role: "principal",
      fichiers: [
        "Akihiko.jpg",
        "akihiko_sanada_p3.jpg",
        "akihiko_sanada_p3_2.jpg",
      ],
    },
    {
      nom: "Mitsuru Kirijo",
      role: "principal",
      fichiers: [
        "Mitsuru.jpg",
        "Mitsuru.webp",
        "mitsuru_kirijo_p3.jpg",
        "mitsuru_kirijo_p3_2.jpg",
        "mitsuru_kirijo_p3_3.jpg",
        "mitsuru_kirijo_p3_4.jpg",
        "mitsuru_kirijo_p3_5.jpg",
        "mitsuru_kirijo_p3_6.jpg",
      ],
    },
    {
      nom: "Fuuka Yamagishi",
      role: "principal",
      fichiers: [
        "Fuuka.jpeg",
        "Fuuka2.jpeg",
        "fuuka_yamagishi_p3.jpg",
        "fuuka_yamagishi_p3_2.jpg",
        "fuuka_yamagishi_p3_3.jpg",
      ],
    },
    {
      nom: "Koromaru",
      role: "principal",
      fichiers: [
        "Koromaru.jpg",
        "Koromaru2.jpg",
        "koromaru_p3.jpg",
        "koromaru_p3_2.jpg",
      ],
    },
    {
      nom: "Ken Amada",
      role: "principal",
      fichiers: [
        "Ken.jpeg",
        "ken_amada_p4au.jpg",
        "ken_amada_p3.jpg",
        "ken_amada_p3_2.jpg",
        "ken_amada_p3_3.jpg",
      ],
    },
    {
      nom: "Shinjiro Aragaki",
      role: "principal",
      fichiers: [
        "Shinji.jpg",
        "Shinji.webp",
        "shinjiro_aragaki_p3.jpg",
        "shinjiro_aragaki_p3_2.jpg",
        "shinjiro_aragaki_p3_3.jpg",
      ],
    },
    {
      nom: "Elisabeth",
      role: "secondaire",
      fichiers: [
        "Elisabeth.jpeg",
        "Elisabeth2.jpeg",
        "elisabeth_p3.jpg",
        "elisabeth_p3_2.jpg",
        "elisabeth_p3_3.jpg",
        "elisabeth_p3_4.jpg",
      ],
    },
    {
      nom: "Theodore",
      role: "secondaire",
      fichiers: [
        "theodore.jpeg",
        "theodore2.jpeg",
        "theodore3.jpeg",
        "theodore4.jpeg",
        "theodore5.jpeg",
        "theodore_p3_anim_elevator.webp",
        "theodore_p3_anim_look_back.webp",
      ],
    },
    { nom: "Metis", role: "secondaire", fichiers: ["Metis.jpg", "Metis2.jpeg", "metis_p3.jpg"] },
    {
      nom: "Ryoji Mochizuki",
      role: "secondaire",
      fichiers: [
        "ryoji_mochizuki_p3.jpg",
        "ryoji_mochizuki_p3_2.jpg",
        "ryoji_mochizuki_p3_3.jpg",
        "ryoji_mochizuki_p3_4.jpg",
      ],
    },
    {
      nom: "Takaya Sakaki",
      role: "secondaire",
      fichiers: [
        "takaya_sakaki_p3.jpg",
        "takaya_sakaki_p3_2.jpg",
      ],
    },
    {
      nom: "Jin Shirato",
      role: "secondaire",
      fichiers: [
        "jin_shirato_p3.jpg",
        "jin_shirato_p3_2.jpg",
      ],
    },
    { nom: "Chidori Yoshino", role: "secondaire", fichiers: ["Chidori.jpg", "Chidori2.jpg"] },
  ],
  P4: [
    {
      nom: "Yu Narukami",
      role: "protagoniste",
      fichiers: [
        "Yu.gif",
        "Yu.jpg",
        "Yu2.gif",
        "Yu2.jpg",
        "yu_alt.jpg",
        "yu_cursed.jpg",
        "yu_narukami_mc_icon.jpg",
      ],
    },
    {
      nom: "Yosuke Hanamura",
      role: "principal",
      fichiers: [
        "Yosuke.jpg",
        "Yosuke2.jpg",
        "yosuke_hanamura_icon.jpg",
        "yosuke_hanamura_icon_1.jpg",
      ],
    },
    {
      nom: "Chie Satonaka",
      role: "principal",
      fichiers: [
        "Chie.jpg",
        "Chie2.jpg",
        "chie_satonaka_icon.jpg",
        "chiesatonaka_revivale.jpg",
      ],
    },
    { nom: "Yukiko Amagi", role: "principal", fichiers: ["Yukiko.jpg", "Yukiko2.jpg"] },
    { nom: "Kanji Tatsumi", role: "principal", fichiers: ["Kanji.jpg", "Kanji.avif"] },
    {
      nom: "Rise Kujikawa",
      role: "principal",
      fichiers: [
        "Rise.jpg",
        "Rise.png",
        "rise_revivale.jpg",
        "rise_kujikawa_p4.jpg",
      ],
    },
    { nom: "Teddie", role: "principal", fichiers: ["Teddie.jpg", "Teddie2.jpg"] },
    {
      nom: "Naoto Shirogane",
      role: "principal",
      fichiers: [
        "Naoto.jpg",
        "Naoto2.jpg",
        "naotoshirogane.jpg",
        "naoto_shirogane_icon_revivae.jpg",
        "naoto_p4r.jpg",
      ],
    },
    { nom: "Nanako Dojima", role: "secondaire", fichiers: ["Nanako.jpg", "Nanako2.jpg"] },
    { nom: "Tohru Adachi", role: "secondaire", fichiers: ["Adachi.jpg", "Adachi2.jpeg"] },
    {
      nom: "Marie",
      role: "secondaire",
      fichiers: [
        "Marie.jpg",
        "Marie2.webp",
        "hui_marie_p4r_pfp.jpg",
      ],
    },
    { nom: "Margaret", role: "secondaire", fichiers: ["margaret.jpg"] },
  ],
  P5: [
    {
      nom: "Ren Amamiya (Joker)",
      role: "protagoniste",
      fichiers: [
        "Joker.jpg",
        "joker_starlight.jpg",
        "Ren.gif",
        "Ren.webp",
        "Ren2.gif",
        "ren_t.webp",
        "ren_jazz.jpg",
      ],
    },
    {
      nom: "Ryuji Sakamoto",
      role: "principal",
      fichiers: [
        "Ryuji.jpg",
        "Ryuji.png",
        "ryuji_jazz.jpg",
      ],
    },
    { nom: "Ann Takamaki", role: "principal", fichiers: ["Ann.jpg", "Ann_2.jpg", "ann_jazz.jpg"] },
    {
      nom: "Morgana",
      role: "principal",
      fichiers: [
        "Morgana.jpg",
        "Morgana.png",
        "morgana_starlight.jpg",
        "morgana_dancing.jpg",
      ],
    },
    {
      nom: "Yusuke Kitagawa",
      role: "principal",
      fichiers: [
        "Yusuke.jpg",
        "Yusuke.webp",
        "yusukekitagawa_jazz.jpg",
      ],
    },
    {
      nom: "Makoto Niijima",
      role: "principal",
      fichiers: [
        "Makoto.jpg",
        "Makoto2.jpg",
        "makoto_nijima.jpg",
        "makotoniijima_jazz.jpg",
      ],
    },
    {
      nom: "Futaba Sakura",
      role: "principal",
      fichiers: [
        "Futaba.jpg",
        "Futaba.webp",
        "futaba_alt.jpg",
        "futaba_headphones.jpg",
        "futaba_persona5.jpg",
        "futaba_sakura_p5.jpg",
      ],
    },
    { nom: "Haru Okumura", role: "principal", fichiers: ["Haru.png", "Har.jpg", "haru_jazz.jpg"] },
    {
      nom: "Goro Akechi",
      role: "principal",
      fichiers: [
        "Akechi.jpg",
        "Akechi2.jpg",
        "akechi_alt.jpg",
        "akechi_jazz.jpg",
      ],
    },
    {
      nom: "Sumire Yoshizawa",
      role: "principal",
      fichiers: [
        "Sumire.jpg",
        "Sumire2.jpg",
        "sumire_jazz.jpg",
      ],
    },
    {
      nom: "Sophia",
      role: "principal",
      fichiers: [
        "sophia_p5s.jpg",
        "sophia_p5s_2.jpg",
        "sophia_p5s_3.jpg",
        "sophia_p5s_4.jpg",
        "sophia_p5s_5.jpg",
      ],
    },
    { nom: "Lavenza", role: "secondaire", fichiers: ["Lavenza.jpg", "Lavenza7.gif"] },
    { nom: "Caroline & Justine", role: "secondaire", fichiers: ["caroline_justine.png"] },
    { nom: "Takuto Maruki", role: "secondaire", fichiers: ["Maruki.gif"] },
    { nom: "Tae Takemi", role: "secondaire", fichiers: ["Tae.jpg", "Tae2.jpg"] },
    { nom: "Erina", role: "principal", fichiers: ["erina_p5t.jpg"] },
    {
      nom: "Sae Niijima",
      role: "secondaire",
      fichiers: [
        "sae_niijima_p5.jpg",
        "sae_niijima_p5_2.jpg",
      ],
    },
    {
      nom: "Zenkichi Hasegawa",
      role: "principal",
      fichiers: [
        "zenkichi_hasegawa_p5s.jpg",
        // Identifiés à tort comme Baofu à l'import : cheveux longs, lunettes et
        // barbe de trois jours, mais c'est bien Zenkichi (correction Hamza).
        "zenkichi_hasegawa_p5s_2.jpg",
        "zenkichi_hasegawa_p5s_3.jpg",
      ],
    },
  ],
  P5X: [
    {
      nom: "Wonder (Nagisa Kamishiro)",
      role: "protagoniste",
      fichiers: [
        "Wonder.jpg",
        "wonder1.png",
        "wonder2.png",
        "wonder_alt.jpg",
        "wonder_velvet.jpg",
        "wonder_joker_matching_p5x.jpg",
        "wonder_p5x.jpg",
      ],
    },
    { nom: "Lufel (Cattle)", role: "principal", fichiers: ["Lufel.png", "Lufel2.png"] },
    { nom: "Motoha Arai (Closer)", role: "principal", fichiers: ["Arai.png", "Arai2.png"] },
    { nom: "Kayo Tomiyama (Okyann)", role: "principal", fichiers: ["Kayo.png", "Kayo2.png"] },
    { nom: "Riko Tanemura (Wind)", role: "principal", fichiers: ["Riko.png", "Riko2.png"] },
    { nom: "Shun Kano (Soy)", role: "principal", fichiers: ["Shun.png", "Shun2.png"] },
    { nom: "Tomoko Noge (Moko)", role: "principal", fichiers: ["Tomoko.png", "Tomoko2.png"] },
    {
      nom: "Yaoling Li (Rin)",
      role: "principal",
      fichiers: [
        "Yaoling.png",
        "Yaoling2.png",
        "yaoling_li_p5x.jpg",
      ],
    },
    {
      nom: "YUI (Bui)",
      role: "principal",
      fichiers: [
        "YUI.png",
        "YUI2.png",
        "yui_comic_p5x.jpg",
        "yui_comic_p5x_2.jpg",
      ],
    },
    {
      nom: "Shoki Ikenami (Luce)",
      role: "principal",
      fichiers: [
        "luce.jpg",
        "shoki_ikenami_p5x.jpg",
        "shoki_ikenami_notte_p5x.jpg",
      ],
    },
    {
      nom: "Ayaka Sakai (Chord)",
      role: "principal",
      fichiers: [
        "ayaka_sakai_p5x.jpg",
        "ayaka_sakai_p5x_2.jpg",
        "ayaka_sakai_p5x_3.jpg",
        "ayaka_sakai_p5x_4.jpg",
        "ayaka_sakai_summer_p5x.jpg",
      ],
    },
    {
      nom: "Kira Kitazato (Messa)",
      role: "principal",
      fichiers: [
        "kira_kitazato_p5x.jpg",
        "kira_kitazato_p5x_2.jpg",
        "kira_kitazato_p5x_3.jpg",
      ],
    },
    {
      nom: "Yumi Shiina (Phoebe)",
      role: "principal",
      fichiers: [
        "yumi_shiina_p5x.jpg",
        "yumi_shiina_p5x_2.jpg",
        "yumi_shiina_p5x_3.jpg",
      ],
    },
    { nom: "Aran Hirano (Anri)", role: "principal", fichiers: ["aran_hirano_p5x.jpg"] },
    { nom: "Ichigo Shikano (Berry)", role: "principal", fichiers: ["ichigo_shikano_p5x.jpg"] },
    { nom: "Kiyoshi Kurotani (Key)", role: "principal", fichiers: ["kiyoshi_kurotani_p5x.jpg"] },
    { nom: "Kotone Montagne (Mont)", role: "principal", fichiers: ["kotone_montagne_p5x.jpg"] },
    { nom: "Kumi Katayama (Blitz)", role: "principal", fichiers: ["kumi_katayama_p5x.jpg"] },
    { nom: "Miyu Sahara (Puppet)", role: "principal", fichiers: ["miyu_sahara_p5x.jpg"] },
    {
      nom: "Mio Natsukawa (Matoi)",
      role: "principal",
      fichiers: [
        "mionatsukawa_persona_5_phantom_x.jpg",
        "mio_natsukawa_p5x.jpg",
      ],
    },
    { nom: "Narumi Nashimoto (Pinky)", role: "principal", fichiers: ["narumi_nashimoto_p5x.jpg"] },
    {
      nom: "Seiji Shiratori (Fleuret)",
      role: "principal",
      fichiers: [
        "seijishiratori_persona_5_phantom_x.jpg",
        "seiji_shiratori_p5x.jpg",
      ],
    },
    {
      nom: "Yukimi Fujikawa (Yuki)",
      role: "principal",
      fichiers: [
        "yukimifujikawa_persona_5_phantom_x.jpg",
      ],
    },
    { nom: "Hatsune Miku", role: "secondaire", fichiers: ["hatsune_miku_p5x.jpg"] },
    { nom: "Haruna Nishimori (Riddle)", role: "principal", fichiers: ["haruna_nishimori_p5x.jpg"] },
    {
      nom: "Leo Kamiyama (Leon)",
      role: "principal",
      fichiers: [
        "leo_kamiyama_p5x.jpg",
        "leo_kamiyama_p5x_2.jpg",
      ],
    },
    {
      nom: "Manaka Nagao (Ange)",
      role: "principal",
      fichiers: [
        "manaka_nagao_p5x.jpg",
        "manaka_nagao_p5x_2.jpg",
        "manaka_nagao_p5x_3.jpg",
        "manaka_nagao_p5x_4.jpg",
      ],
    },
    {
      nom: "Masaki Ashiya (Cherish)",
      role: "principal",
      fichiers: [
        "masaki_ashiya_p5x.jpg",
        "masaki_ashiya_p5x_2.jpg",
        "masaki_ashiya_p5x_3.jpg",
      ],
    },
    {
      nom: "Mayumi Hashimoto (Turbo)",
      role: "principal",
      fichiers: [
        "mayumi_hashimoto_p5x.jpg",
        "mayumi_hashimoto_p5x_2.jpg",
      ],
    },
    { nom: "Minami Miyashita (Marian)", role: "principal", fichiers: ["minami_miyashita_p5x.jpg"] },
    {
      nom: "Runa Dogenzaka (Howler)",
      role: "principal",
      fichiers: [
        "runa_dogenzaka_p5x.jpg",
        "runa_dogenzaka_p5x_2.jpg",
        "runa_dogenzaka_p5x_3.jpg",
      ],
    },
    {
      nom: "Toshiya Sumi (Sepia)",
      role: "principal",
      fichiers: [
        "toshiya_sumi_p5x.jpg",
        "toshiya_sumi_p5x_2.jpg",
      ],
    },
  ],
  // ⚠️ PQ ne se trie PAS par rôle comme les autres : son ordre est figé
  // P3 → P4 → P5 (et protagoniste d'abord dans chaque jeu), décision Hamza du
  // 2026-09-18, verrouillée par un cas exact dans tests/avatars_gallery.test.js.
  // C'est le style Etrian qu'on y cherche, jeu par jeu. Le champ `section`
  // marque le début de chaque bloc ; l'ordre de cette liste fait foi.
  PQ: [
    {
      nom: "Makoto Yuki",
      role: "protagoniste",
      section: "Persona 3",
      fichiers: [
        "makoto_yuki_pq2.jpg",
      ],
    },
    { nom: "Kotone Shiomi", role: "protagoniste", fichiers: ["kotone_pq.jpg"] },
    { nom: "Yukari Takeba", role: "principal", fichiers: ["yukari_pq2.jpg"] },
    { nom: "Junpei Iori", role: "principal", fichiers: ["junpei_pq.jpg"] },
    {
      nom: "Akihiko Sanada",
      role: "principal",
      // Le médaillon rond est un art de Persona Q : c'est le STYLE qu'on cherche
      // dans ce groupe, pas le jeu d'origine du personnage.
      fichiers: ["akihiko_pq2.jpg", "akihiko_sanada_pq.jpg"],
    },
    { nom: "Mitsuru Kirijo", role: "principal", fichiers: ["mitsuru_pq2.jpg"] },
    { nom: "Aigis", role: "principal", fichiers: ["aigis_pq2.jpg"] },
    { nom: "Koromaru", role: "principal", fichiers: ["koromaru_pq2.jpg", "koromaru_pq.jpg"] },
    { nom: "Ken Amada", role: "principal", fichiers: ["ken_amada_pq2.jpg"] },
    { nom: "Shinjiro Aragaki", role: "principal", fichiers: ["shinjiro_pq2.jpg"] },
    { nom: "Yu Narukami", role: "protagoniste", section: "Persona 4", fichiers: ["yu_pq.jpg"] },
    { nom: "Yosuke Hanamura", role: "principal", fichiers: ["yosuke_pq.jpg"] },
    { nom: "Chie Satonaka", role: "principal", fichiers: ["chie_pq.jpg"] },
    { nom: "Yukiko Amagi", role: "principal", fichiers: ["yukiko_pq.jpg"] },
    { nom: "Kanji Tatsumi", role: "principal", fichiers: ["kanji_pq.jpg"] },
    { nom: "Rise Kujikawa", role: "principal", fichiers: ["rise_pq.jpg"] },
    { nom: "Teddie", role: "principal", fichiers: ["teddie_pq.jpg"] },
    { nom: "Naoto Shirogane", role: "principal", fichiers: ["naoto_pq.jpg"] },
    {
      nom: "Ren Amamiya (Joker)",
      role: "protagoniste",
      section: "Persona 5",
      fichiers: [
        "joker_pq.jpg",
      ],
    },
    { nom: "Ryuji Sakamoto", role: "principal", fichiers: ["ryuji_pq.jpg"] },
    { nom: "Ann Takamaki", role: "principal", fichiers: ["ann_pq.jpg"] },
    { nom: "Morgana", role: "principal", fichiers: ["morgana_pq.jpg"] },
    { nom: "Yusuke Kitagawa", role: "principal", fichiers: ["yusuke_pq.jpg"] },
    { nom: "Makoto Niijima", role: "principal", fichiers: ["makoto_nijima_pq.jpg"] },
    { nom: "Haru Okumura", role: "principal", fichiers: ["haru_pq.jpg"] },
    { nom: "Goro Akechi (Crow)", role: "principal", fichiers: ["crow_pq2.jpg"] },
  ],
  // SPECIAL n'a pas de roster : ce sont des détournements, des crossovers et des
  // images d'anniversaire, pas des portraits de personnages. Le recensement les
  // compte à part et n'en attend rien.
  SPECIAL: [
  ],
};

/**
 * Personnages de cast principal qui n'ont **aucun** portrait dans la galerie.
 *
 * Le recensement ci-dessus ne voit que ce qui existe : un personnage sans la
 * moindre image n'y apparaît pas du tout, et c'est justement le trou le plus
 * gênant. Cette liste est tenue à la main à partir du cast jouable de chaque
 * jeu — retirer une ligne quand le portrait arrive.
 */
export const ABSENTS = {
  P1: [],
  P2: ["Eriko Kirishima (P2)"],
  P3: ["Chihiro Fushimi", "Igor"],
  P4: ["Ryotaro Dojima", "Ai Ebihara", "Naoki Konishi", "Igor"],
  P5: ["Sojiro Sakura", "Sadayo Kawakami", "Igor"],
  P5X: ["Chizuko Nagao (Vino)"],
};

const ORDRE_ROLES = { protagoniste: 0, principal: 1, secondaire: 2 };

/** Nombre de portraits par personnage, tous groupes confondus. */
export function censusParPersonnage() {
  const total = new Map();
  for (const [groupe, roster] of Object.entries(ROSTERS)) {
    for (const p of roster) {
      const cle = p.nom;
      if (!total.has(cle)) total.set(cle, { nom: p.nom, role: p.role, groupes: {}, total: 0 });
      const e = total.get(cle);
      e.groupes[groupe] = p.fichiers.length;
      e.total += p.fichiers.length;
      // Le rôle le plus « haut » gagne : Makoto Yuki est protagoniste, même si
      // une de ses entrées le listait autrement.
      if (ORDRE_ROLES[p.role] < ORDRE_ROLES[e.role]) e.role = p.role;
    }
  }
  return [...total.values()];
}

/**
 * Fichiers présents dans avatars_data.js mais qu'aucun roster ne revendique.
 * SPECIAL est exclu : son roster est vide par conception (détournements et
 * crossovers, pas des portraits de personnages).
 */
export function nonRecenses() {
  const revendiques = new Set(
    Object.values(ROSTERS).flatMap((r) => r.flatMap((p) => p.fichiers))
  );
  return AVATAR_GROUPS.filter((g) => g.game !== "SPECIAL").flatMap((g) =>
    g.avatars.filter((a) => !revendiques.has(a)).map((a) => `${g.game}/${a}`)
  );
}

/** Fichiers revendiqués par un roster mais absents d'avatars_data.js. */
export function revendiquesAbsents() {
  const listes = new Set(AVATAR_GROUPS.flatMap((g) => g.avatars));
  return Object.entries(ROSTERS).flatMap(([groupe, roster]) =>
    roster.flatMap((p) => p.fichiers.filter((f) => !listes.has(f)).map((f) => `${groupe}/${f}`))
  );
}

// ── Sortie console ──────────────────────────────────────────────────────────
const estAppelDirect = process.argv[1] && process.argv[1].endsWith("avatar_census.js");
if (estAppelDirect) {
  const census = censusParPersonnage().sort(
    (a, b) => a.total - b.total || a.nom.localeCompare(b.nom)
  );

  const special = AVATAR_GROUPS.find((g) => g.game === "SPECIAL")?.avatars.length ?? 0;
  const totalListes = AVATAR_GROUPS.reduce((n, g) => n + g.avatars.length, 0);

  console.log(`\n📊 ${totalListes} portraits · ${census.length} personnages · ${special} images SPECIAL\n`);
  console.log("Du moins fourni au mieux fourni :\n");
  console.log("  n  rôle          personnage                        détail par jeu");
  console.log("  ─  ────────────  ────────────────────────────────  ──────────────");
  for (const p of census) {
    const detail = Object.entries(p.groupes)
      .map(([g, n]) => `${g}:${n}`)
      .join(" ");
    const alerte = p.total <= 1 ? " ⚠️" : p.total === 2 ? " ·" : "";
    console.log(
      `  ${String(p.total).padStart(2)} ${p.role.padEnd(13)} ${p.nom.padEnd(32)} ${detail}${alerte}`
    );
  }

  const orphelins = nonRecenses();
  const fantomes = revendiquesAbsents();
  if (orphelins.length) {
    console.log(`\n⚠️  ${orphelins.length} portrait(s) NON RECENSÉ(S) — ajoute-les à ROSTERS :`);
    orphelins.forEach((o) => console.log("     " + o));
  }
  if (fantomes.length) {
    console.log(`\n❌ ${fantomes.length} fichier(s) revendiqué(s) mais absent(s) d'avatars_data.js :`);
    fantomes.forEach((f) => console.log("     " + f));
  }
  if (!orphelins.length && !fantomes.length) {
    console.log("\n✅ Recensement complet : chaque portrait a son personnage.");
  }

  const nbAbsents = Object.values(ABSENTS).reduce((n, l) => n + l.length, 0);
  console.log(`\n🕳️  ${nbAbsents} personnage(s) de cast principal SANS AUCUN portrait :`);
  for (const [groupe, liste] of Object.entries(ABSENTS)) {
    if (liste.length) console.log(`     ${groupe.padEnd(5)} ${liste.join(", ")}`);
  }
  console.log("");
}
