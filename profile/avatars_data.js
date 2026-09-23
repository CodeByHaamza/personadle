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
    "naoya_todou_p1.jpg",
    "naoya_todou_p1_2.jpg",
    "naoya_todou_p1_3.jpg",
    // ── Cast principal ────────────────────────────────────────────────────
    // Masao Inaba
    "Inaba.webp",
    "Inaba2.webp",
    // Kei Nanjo
    "Kei.webp",
    "Kei2.jpg",
    "kei_nanjo_p1.jpg",
    // Hidehiko Uesugi
    "Hidehiko.png",
    "Hidehiko.webp",
    // Eriko Kirishima
    "Eriko.png",
    "eriko_kirishima_p1.jpg",
    // Yukino Mayuzumi
    "Yukino.webp",
    "yukino_mayuzumi_p1.jpg",
    "yukino_mayuzumi_p1_2.jpg",
    // Maki Sonomura
    "maki_sonomura_p1.jpg",
    // Reiji Kido
    "reiji_kido_p1.jpg",
    "reiji_kido_p1_2.jpg",
    // ── Personnages secondaires ───────────────────────────────────────────
    // Yuka Ayase
    "Yuka.webp",
  ] },
  { game: "P2", key: "persona2", avatars: [
    // ── Protagoniste(s) ───────────────────────────────────────────────────
    // Tatsuya Suou
    "Tatsuya.jpg",
    "Tatsuya2.jpg",
    "tatsuya_suou_p2.jpg",
    "tatsuya_suou_p2_2.jpg",
    "tatsuya_suou_p2_3.jpg",
    // Maya Amano
    "Maya.jpg",
    "Maya2.jpeg",
    "maya_amano_p2.jpg",
    "maya_amano_p2_2.jpg",
    "maya_amano_p2_3.jpg",
    "maya_amano_p2_4.jpg",
    "maya_amano_p2_5.jpg",
    // ── Cast principal ────────────────────────────────────────────────────
    // Eikichi Mishina
    "Ekichi.jpeg",
    "Ekichi2.jpeg",
    "eikichi_mishina_p2.jpg",
    "eikichi_mishina_p2_2.jpg",
    "eikichi_mishina_p2_3.jpg",
    // Lisa Silverman
    "Lisa.jpeg",
    "lisa_silverman_p2.jpg",
    "lisa_silverman_p2_2.jpg",
    // Jun Kurosu
    "Jun.jpg",
    "JOKER.webp",
    // Baofu
    "baofu_p2.jpg",
    "baofu_p2_2.jpg",
    "baofu_p2_3.jpg",
    "baofu_p2_4.jpg",
    // Katsuya Suou
    "katsuya_suou_p2.jpg",
    "katsuya_suou_p2_2.jpg",
    "katsuya_suou_p2_3.jpg",
    "katsuya_suou_p2_4.jpg",
    // Ulala Serizawa
    "ulala_serizawa_p2.jpg",
    "ulala_serizawa_p2_2.jpg",
    // Yukino Mayuzumi (P2)
    "yukino_mayuzumi_p2.jpg",
  ] },
  { game: "P3", key: "persona3", avatars: [
    // ── Protagoniste(s) ───────────────────────────────────────────────────
    // Makoto Yuki
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
    "yukari_takeba_p3.jpg",
    "yukari_takeba_p3_2.jpg",
    "yukari_takeba_p3_3.jpg",
    // Junpei Iori
    "Junpei.png",
    "Junpei2.jpg",
    "junpei_iori_p3.jpg",
    "junpei_iori_p3_2.jpg",
    "junpei_iori_p3_3.jpg",
    "junpei_iori_p3_4.jpg",
    // Akihiko Sanada
    "Akihiko.jpg",
    "akihiko_sanada_p3.jpg",
    "akihiko_sanada_p3_2.jpg",
    "akihiko_sanada_p3_3.jpg",
    // Mitsuru Kirijo
    "Mitsuru.jpg",
    "Mitsuru.webp",
    "mitsuru_kirijo_p3.jpg",
    "mitsuru_kirijo_p3_2.jpg",
    "mitsuru_kirijo_p3_3.jpg",
    "mitsuru_kirijo_p3_4.jpg",
    "mitsuru_kirijo_p3_5.jpg",
    "mitsuru_kirijo_p3_6.jpg",
    // Fuuka Yamagishi
    "Fuuka.jpeg",
    "Fuuka2.jpeg",
    "fuuka_yamagishi_p3.jpg",
    "fuuka_yamagishi_p3_2.jpg",
    "fuuka_yamagishi_p3_3.jpg",
    // Aigis
    "aigis_train.jpg",
    "aigis.gif",
    "Aigis.jpg",
    "Aigis2.jpg",
    "aigis_p3.jpg",
    "aigis_p3_2.jpg",
    "aigis_p3_3.jpg",
    // Koromaru
    "Koromaru.jpg",
    "Koromaru2.jpg",
    "koromaru_p3.jpg",
    "koromaru_p3_2.jpg",
    "koromaru_p3_3.jpg",
    // Ken Amada
    "Ken.jpeg",
    "ken_amada_p4au.jpg",
    "ken_amada_p3.jpg",
    "ken_amada_p3_2.jpg",
    "ken_amada_p3_3.jpg",
    // Shinjiro Aragaki
    "Shinji.jpg",
    "Shinji.webp",
    "shinjiro_aragaki_p3.jpg",
    "shinjiro_aragaki_p3_2.jpg",
    "shinjiro_aragaki_p3_3.jpg",
    // ── Personnages secondaires ───────────────────────────────────────────
    // Chidori Yoshino
    "Chidori.jpg",
    "Chidori2.jpg",
    // Metis
    "Metis.jpg",
    "Metis2.jpeg",
    "metis_p3.jpg",
    // Elisabeth
    "Elisabeth.jpeg",
    "Elisabeth2.jpeg",
    "elisabeth_p3.jpg",
    "elisabeth_p3_2.jpg",
    "elisabeth_p3_3.jpg",
    "elisabeth_p3_4.jpg",
    // Theodore
    "theodore.jpeg",
    "theodore2.jpeg",
    "theodore3.jpeg",
    "theodore4.jpeg",
    "theodore5.jpeg",
    // Jin Shirato
    "jin_shirato_p3.jpg",
    "jin_shirato_p3_2.jpg",
    // Ryoji Mochizuki
    "ryoji_mochizuki_p3.jpg",
    "ryoji_mochizuki_p3_2.jpg",
    "ryoji_mochizuki_p3_3.jpg",
    "ryoji_mochizuki_p3_4.jpg",
    // Takaya Sakaki
    "takaya_sakaki_p3.jpg",
    "takaya_sakaki_p3_2.jpg",
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
    "futaba_sakura_p5.jpg",
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
    "sophia_p5s_2.jpg",
    "sophia_p5s_3.jpg",
    "sophia_p5s_4.jpg",
    "sophia_p5s_5.jpg",
    // Erina
    "erina_p5t.jpg",
    // Zenkichi Hasegawa
    "zenkichi_hasegawa_p5s.jpg",
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
    // Sae Niijima
    "sae_niijima_p5.jpg",
    "sae_niijima_p5_2.jpg",
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
    "wonder_p5x.jpg",
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
    "mio_natsukawa_p5x.jpg",
    // Narumi Nashimoto (Pinky)
    "narumi_nashimoto_p5x.jpg",
    // Seiji Shiratori (Fleuret)
    "seijishiratori_persona_5_phantom_x.jpg",
    "seiji_shiratori_p5x.jpg",
    // Yukimi Fujikawa (Yuki)
    "yukimifujikawa_persona_5_phantom_x.jpg",
    // Haruna Nishimori (Riddle)
    "haruna_nishimori_p5x.jpg",
    // Leo Kamiyama (Leon)
    "leo_kamiyama_p5x.jpg",
    "leo_kamiyama_p5x_2.jpg",
    // Manaka Nagao (Ange)
    "manaka_nagao_p5x.jpg",
    "manaka_nagao_p5x_2.jpg",
    "manaka_nagao_p5x_3.jpg",
    "manaka_nagao_p5x_4.jpg",
    // Masaki Ashiya (Cherish)
    "masaki_ashiya_p5x.jpg",
    "masaki_ashiya_p5x_2.jpg",
    "masaki_ashiya_p5x_3.jpg",
    // Mayumi Hashimoto (Turbo)
    "mayumi_hashimoto_p5x.jpg",
    "mayumi_hashimoto_p5x_2.jpg",
    // Minami Miyashita (Marian)
    "minami_miyashita_p5x.jpg",
    // Runa Dogenzaka (Howler)
    "runa_dogenzaka_p5x.jpg",
    "runa_dogenzaka_p5x_2.jpg",
    "runa_dogenzaka_p5x_3.jpg",
    // Toshiya Sumi (Sepia)
    "toshiya_sumi_p5x.jpg",
    "toshiya_sumi_p5x_2.jpg",
    // ── Personnages secondaires ───────────────────────────────────────────
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
