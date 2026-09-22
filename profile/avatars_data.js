// Mapping avatar → jeu. Chaque groupe est trié PROTAGONISTE, puis CAST
// PRINCIPAL, puis PERSONNAGES SECONDAIRES, et les portraits d'un même
// personnage se suivent (demande Hamza du 2026-09-22 — la galerie se parcourt à
// l'œil : on y cherche quelqu'un, pas le lot qui a livré l'image).
//
// L'ordre et le découpage viennent de `ROSTERS` dans scripts/avatar_census.js,
// qui sait QUI est sur chaque image — ce que les noms de fichiers ne disent pas
// de façon fiable (`Yuki.gif`, `makoto_yuki.jpg` et `pfp_makoto.gif` sont la
// même personne ; `Makoto.jpg` en est une autre). Pour déplacer un portrait,
// changer son personnage là-bas puis relancer la régénération.
//
// `npm run avatars:census` dit combien de portraits a chaque personnage, et
// lesquels n'en ont aucun.
export const AVATAR_GROUPS = [
  { game: "P1", key: "persona1", avatars: [
    // ── Protagoniste(s) ───────────────────────────────────────────────────
    // Naoya Todou
    "Naoya.jpg",
    "Naoya1.jpg",
    // ── Cast principal ────────────────────────────────────────────────────
    // Masao Inaba
    "Inaba.webp",
    "Inaba2.webp",
    // Kei Nanjo
    "Kei.webp",
    "Kei2.jpg",
    // Hidehiko Uesugi
    "Hidehiko.png",
    "Hidehiko.webp",
    // Eriko Kirishima
    "Eriko.png",
    // Yukino Mayuzumi
    "Yukino.webp",
    // ── Personnages secondaires ───────────────────────────────────────────
    // Yuka Ayase
    "Yuka.webp",
  ] },
  { game: "P2", key: "persona2", avatars: [
    // ── Protagoniste(s) ───────────────────────────────────────────────────
    // Tatsuya Suou
    "Tatsuya.jpg",
    "Tatsuya2.jpg",
    // Maya Amano
    "Maya.jpg",
    "Maya2.jpeg",
    // ── Cast principal ────────────────────────────────────────────────────
    // Eikichi Mishina
    "Ekichi.jpeg",
    "Ekichi2.jpeg",
    // Lisa Silverman
    "Lisa.jpeg",
    // Jun Kurosu
    "Jun.jpg",
    "JOKER.webp",
  ] },
  { game: "P3", key: "persona3", avatars: [
    // ── Protagoniste(s) ───────────────────────────────────────────────────
    // Makoto Yuki
    "makoto_yuki.jpg",
    "Yuki.gif",
    "Yuki.jpeg",
    "yuki.jpg",
    "Yuki2.gif",
    // Kotone Shiomi
    "Kotone.jpeg",
    "Kotone2.jpeg",
    "Kotone3.jpeg",
    "kotone_pdp.jpg",
    "kotone_shiomi.jpg",
    "kotone_shiomi_p3p.jpg",
    "kotone_shiomi_p3p_2.jpg",
    "kotone_shiomi_p3p_3.jpg",
    "kotone_shiomi_p5x_crossover.jpg",
    // ── Cast principal ────────────────────────────────────────────────────
    // Yukari Takeba
    "Yukari.jpg",
    "Yukari2.jpg",
    // Junpei Iori
    "Junpei.png",
    "Junpei2.jpg",
    // Akihiko Sanada
    "Akihiko.jpg",
    // Mitsuru Kirijo
    "Mitsuru.jpg",
    "Mitsuru.webp",
    // Fuuka Yamagishi
    "Fuuka.jpeg",
    "Fuuka2.jpeg",
    // Aigis
    "aigis_train.jpg",
    "aigis.gif",
    "Aigis.jpg",
    "Aigis2.jpg",
    // Koromaru
    "Koromaru.jpg",
    "Koromaru2.jpg",
    // Ken Amada
    "Ken.jpeg",
    "ken_amada_p4au.jpg",
    // Shinjiro Aragaki
    "Shinji.jpg",
    "Shinji.webp",
    // ── Personnages secondaires ───────────────────────────────────────────
    // Chidori Yoshino
    "Chidori.jpg",
    "Chidori2.jpg",
    // Metis
    "Metis.jpg",
    "Metis2.jpeg",
    // Elisabeth
    "Elisabeth.jpeg",
    "Elisabeth2.jpeg",
    // Theodore
    "theodore.jpeg",
    "theodore2.jpeg",
    "theodore3.jpeg",
    "theodore4.jpeg",
    "theodore5.jpeg",
  ] },
  { game: "P4", key: "persona4", avatars: [
    // ── Protagoniste(s) ───────────────────────────────────────────────────
    // Yu Narukami
    "Yu.gif",
    "Yu.jpg",
    "Yu2.gif",
    "Yu2.jpg",
    "yu_alt.jpg",
    "yu_cursed.jpg",
    "yu_narukami_mc_icon.jpg",
    // ── Cast principal ────────────────────────────────────────────────────
    // Yosuke Hanamura
    "Yosuke.jpg",
    "Yosuke2.jpg",
    "yosuke_hanamura_icon.jpg",
    "yosuke_hanamura_icon_1.jpg",
    // Chie Satonaka
    "Chie.jpg",
    "Chie2.jpg",
    "chie_satonaka_icon.jpg",
    "chiesatonaka_revivale.jpg",
    // Yukiko Amagi
    "Yukiko.jpg",
    "Yukiko2.jpg",
    // Kanji Tatsumi
    "Kanji.jpg",
    "Kanji.avif",
    // Rise Kujikawa
    "Rise.jpg",
    "Rise.png",
    "rise_revivale.jpg",
    "rise_kujikawa_p4.jpg",
    // Teddie
    "Teddie.jpg",
    "Teddie2.jpg",
    // Naoto Shirogane
    "Naoto.jpg",
    "Naoto2.jpg",
    "naotoshirogane.jpg",
    "naoto_shirogane_icon_revivae.jpg",
    "naoto_p4r.jpg",
    // ── Personnages secondaires ───────────────────────────────────────────
    // Nanako Dojima
    "Nanako.jpg",
    "Nanako2.jpg",
    // Tohru Adachi
    "Adachi.jpg",
    "Adachi2.jpeg",
    // Marie
    "Marie.jpg",
    "Marie2.webp",
    "hui_marie_p4r_pfp.jpg",
    // Margaret
    "margaret.jpg",
  ] },
  { game: "P5", key: "persona5", avatars: [
    // ── Protagoniste(s) ───────────────────────────────────────────────────
    // Ren Amamiya (Joker)
    "Joker.jpg",
    "joker_starlight.jpg",
    "Ren.gif",
    "Ren.webp",
    "Ren2.gif",
    "ren_t.webp",
    "ren_jazz.jpg",
    // ── Cast principal ────────────────────────────────────────────────────
    // Ryuji Sakamoto
    "Ryuji.jpg",
    "Ryuji.png",
    "ryuji_jazz.jpg",
    // Ann Takamaki
    "Ann.jpg",
    "Ann_2.jpg",
    "ann_jazz.jpg",
    // Morgana
    "Morgana.jpg",
    "Morgana.png",
    "morgana_starlight.jpg",
    "morgana_dancing.jpg",
    // Yusuke Kitagawa
    "Yusuke.jpg",
    "Yusuke.webp",
    "yusukekitagawa_jazz.jpg",
    // Makoto Niijima
    "Makoto.jpg",
    "Makoto2.jpg",
    "makoto_nijima.jpg",
    "makotoniijima_jazz.jpg",
    // Futaba Sakura
    "Futaba.jpg",
    "Futaba.webp",
    "futaba_alt.jpg",
    "futaba_headphones.jpg",
    "futaba_persona5.jpg",
    // Haru Okumura
    "Haru.png",
    "Har.jpg",
    "haru_jazz.jpg",
    // Goro Akechi
    "Akechi.jpg",
    "Akechi2.jpg",
    "akechi_alt.jpg",
    "akechi_jazz.jpg",
    // Sumire Yoshizawa
    "Sumire.jpg",
    "Sumire2.jpg",
    "sumire_jazz.jpg",
    // Sophia
    "sophia_p5s.jpg",
    // ── Personnages secondaires ───────────────────────────────────────────
    // Lavenza
    "Lavenza.jpg",
    "Lavenza7.gif",
    // Caroline & Justine
    "caroline_justine.png",
    // Takuto Maruki
    "Maruki.gif",
    // Tae Takemi
    "Tae.jpg",
    "Tae2.jpg",
  ] },
  { game: "P5X", key: "persona5x", avatars: [
    // ── Protagoniste(s) ───────────────────────────────────────────────────
    // Wonder (Nagisa Kamishiro)
    "Wonder.jpg",
    "wonder1.png",
    "wonder2.png",
    "wonder_alt.jpg",
    "wonder_velvet.jpg",
    "wonder_joker_matching_p5x.jpg",
    // ── Cast principal ────────────────────────────────────────────────────
    // Lufel (Cattle)
    "Lufel.png",
    "Lufel2.png",
    // Motoha Arai (Closer)
    "Arai.png",
    "Arai2.png",
    // Kayo Tomiyama (Okyann)
    "Kayo.png",
    "Kayo2.png",
    // Riko Tanemura (Wind)
    "Riko.png",
    "Riko2.png",
    // Shun Kano (Soy)
    "Shun.png",
    "Shun2.png",
    // Tomoko Noge (Moko)
    "Tomoko.png",
    "Tomoko2.png",
    // Yaoling Li (Rin)
    "Yaoling.png",
    "Yaoling2.png",
    "yaoling_li_p5x.jpg",
    // YUI (Bui)
    "YUI.png",
    "YUI2.png",
    "yui_comic_p5x.jpg",
    "yui_comic_p5x_2.jpg",
    // Shoki Ikenami (Luce)
    "luce.jpg",
    "shoki_ikenami_p5x.jpg",
    "shoki_ikenami_notte_p5x.jpg",
    // Ayaka Sakai (Chord)
    "ayaka_sakai_p5x.jpg",
    "ayaka_sakai_p5x_2.jpg",
    "ayaka_sakai_p5x_3.jpg",
    "ayaka_sakai_p5x_4.jpg",
    "ayaka_sakai_summer_p5x.jpg",
    // Kira Kitazato (Messa)
    "kira_kitazato_p5x.jpg",
    "kira_kitazato_p5x_2.jpg",
    "kira_kitazato_p5x_3.jpg",
    // Yumi Shiina (Phoebe)
    "yumi_shiina_p5x.jpg",
    "yumi_shiina_p5x_2.jpg",
    "yumi_shiina_p5x_3.jpg",
    // ── Personnages secondaires ───────────────────────────────────────────
    // Aran Hirano (Anri)
    "aran_hirano_p5x.jpg",
    // Ichigo Shikano (Berry)
    "ichigo_shikano_p5x.jpg",
    // Kiyoshi Kurotani (Key)
    "kiyoshi_kurotani_p5x.jpg",
    // Kotone Montagne (Mont)
    "kotone_montagne_p5x.jpg",
    // Kumi Katayama (Blitz)
    "kumi_katayama_p5x.jpg",
    // Miyu Sahara (Puppet)
    "miyu_sahara_p5x.jpg",
    // Mio Natsukawa (Matoi)
    "mionatsukawa_persona_5_phantom_x.jpg",
    // Narumi Nashimoto (Pinky)
    "narumi_nashimoto_p5x.jpg",
    // Seiji Shiratori (Fleuret)
    "seijishiratori_persona_5_phantom_x.jpg",
    // Yukimi Fujikawa (Yuki)
    "yukimifujikawa_persona_5_phantom_x.jpg",
    // Hatsune Miku
    "hatsune_miku_p5x.jpg",
  ] },
  { game: "PQ", key: "personaq", avatars: [
    // ── Persona 3 ─────────────────────────────────────────────────────────
    // Makoto Yuki
    "makoto_yuki_pq2.jpg",
    // Kotone Shiomi
    "kotone_pq.jpg",
    // Yukari Takeba
    "yukari_pq2.jpg",
    // Junpei Iori
    "junpei_pq.jpg",
    // Akihiko Sanada
    "akihiko_pq2.jpg",
    // Mitsuru Kirijo
    "mitsuru_pq2.jpg",
    // Aigis
    "aigis_pq2.jpg",
    // Koromaru
    "koromaru_pq2.jpg",
    // Ken Amada
    "ken_amada_pq2.jpg",
    // Shinjiro Aragaki
    "shinjiro_pq2.jpg",
    // ── Persona 4 ─────────────────────────────────────────────────────────
    // Yu Narukami
    "yu_pq.jpg",
    // Yosuke Hanamura
    "yosuke_pq.jpg",
    // Chie Satonaka
    "chie_pq.jpg",
    // Yukiko Amagi
    "yukiko_pq.jpg",
    // Kanji Tatsumi
    "kanji_pq.jpg",
    // Rise Kujikawa
    "rise_pq.jpg",
    // Teddie
    "teddie_pq.jpg",
    // Naoto Shirogane
    "naoto_pq.jpg",
    // ── Persona 5 ─────────────────────────────────────────────────────────
    // Ren Amamiya (Joker)
    "joker_pq.jpg",
    // Ryuji Sakamoto
    "ryuji_pq.jpg",
    // Ann Takamaki
    "ann_pq.jpg",
    // Morgana
    "morgana_pq.jpg",
    // Yusuke Kitagawa
    "yusuke_pq.jpg",
    // Makoto Niijima
    "makoto_nijima_pq.jpg",
    // Haru Okumura
    "haru_pq.jpg",
    // Goro Akechi (Crow)
    "crow_pq2.jpg",
  ] },
  { game: "SPECIAL", key: "special", avatars: [
    // Détournements, crossovers et images d'anniversaire — pas de roster.
    "Anniversary.gif",
    "catlisabeth.gif",
    "jack_frost_gurren_aggan.jpg",
    "jack_frost_icon_persona.jpg",
    "jack_frost_peace_sign.jpg",
    "jack_frost.jpg",
    "luix-dextructor-aigis.gif",
    "meme_chie_shut_teddie.jpg",
    "pfp_makoto.gif",
    "Yuki_Zutomayo.jpeg",
    "jojo_frost.jpg",
  ] },
];
