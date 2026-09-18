-- ─────────────────────────────────────────────────────────────────────────────
-- 049 — Les titres parlent portugais, et chacun raconte sa condition dans la
--       langue du joueur
--
-- Constaté le 2026-09-18 : `titles` n'avait pas de `name_pt` alors que le site
-- est en six langues — api/titles/index.php ne connaissait que fr/es/de/it et
-- servait l'anglais aux joueurs portugais. Et les `description_*` écrites par
-- les migrations 044/046 n'étaient jamais renvoyées par l'API : le client
-- affichait pour tous un texte de condition anglais codé en dur
-- (profile/titles-ui.js, titleConditionText). Les 14 titres d'avant la 044
-- n'avaient d'ailleurs aucune description.
--
-- Ici : deux colonnes (`name_pt`, `description_pt`), puis pour les 22 titres le
-- nom portugais et la description dans les six langues — condition lisible +
-- une phrase de lore, dans le ton de la 044. Les descriptions en/fr/es/de/it
-- des huit titres de 044/046 sont reprises à l'identique. sql/bdd_mysql.sql
-- porte désormais les mêmes textes dans son seed (il ne les avait pas : une base
-- neuve avait toutes les descriptions à NULL).
--
-- Rejouable : ADD COLUMN IF NOT EXISTS + UPDATE par slug (idempotents).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE titles
    ADD COLUMN IF NOT EXISTS name_pt        VARCHAR(100) NULL AFTER name_it,
    ADD COLUMN IF NOT EXISTS description_pt TEXT         NULL AFTER description_it;

UPDATE titles SET
    name_pt        = 'Thou Art I',
    description_en = 'Unlock 20 badges. The door of the Velvet Room opens to those who have gathered enough of themselves.',
    description_fr = 'Débloque 20 badges. La porte de la Velvet Room s''ouvre à qui a rassemblé assez de soi-même.',
    description_es = 'Desbloquea 20 insignias. La puerta de la Velvet Room se abre a quien ha reunido suficiente de sí mismo.',
    description_de = 'Schalte 20 Abzeichen frei. Die Tür des Velvet Room öffnet sich dem, der genug von sich selbst gesammelt hat.',
    description_it = 'Sblocca 20 badge. La porta della Velvet Room si apre a chi ha raccolto abbastanza di sé.',
    description_pt = 'Desbloqueie 20 emblemas. A porta da Velvet Room se abre para quem reuniu o suficiente de si mesmo.'
  WHERE slug = 'velvet_room_thou_art_i';

UPDATE titles SET
    name_pt        = 'Looking Cool',
    description_en = 'Equip the All-Out Attack theme with a Persona 5 signature track. Style is a choice, and you made it.',
    description_fr = 'Équipe le thème All-Out Attack avec une musique emblématique de Persona 5. Le style est un choix, et tu l''as fait.',
    description_es = 'Equipa el tema All-Out Attack con una canción emblemática de Persona 5. El estilo es una elección, y tú la hiciste.',
    description_de = 'Rüste das All-Out-Attack-Design mit einem Persona-5-Titelsong aus. Stil ist eine Entscheidung, und du hast sie getroffen.',
    description_it = 'Equipaggia il tema All-Out Attack con un brano simbolo di Persona 5. Lo stile è una scelta, e tu l''hai fatta.',
    description_pt = 'Equipe o tema All-Out Attack com uma música marcante de Persona 5. Estilo é uma escolha, e você a fez.'
  WHERE slug = 'joker_looking_cool';

UPDATE titles SET
    name_pt        = 'Memento Mori',
    description_en = 'Play on 100 different days. Every day counts, because none of them comes back.',
    description_fr = 'Joue 100 jours différents. Chaque jour compte, parce qu''aucun ne revient.',
    description_es = 'Juega 100 días distintos. Cada día cuenta, porque ninguno vuelve.',
    description_de = 'Spiel an 100 verschiedenen Tagen. Jeder Tag zählt, denn keiner kommt zurück.',
    description_it = 'Gioca in 100 giorni diversi. Ogni giorno conta, perché nessuno torna.',
    description_pt = 'Jogue em 100 dias diferentes. Cada dia conta, porque nenhum deles volta.'
  WHERE slug = 'makoto_yuki_memento_mori';

UPDATE titles SET
    name_pt        = 'Não Tenho Medo',
    description_en = 'Win 50 Classic games. Fear was a setting, and you turned it off.',
    description_fr = 'Gagne 50 parties en Classique. La peur était un réglage, et tu l''as coupé.',
    description_es = 'Gana 50 partidas en Clásico. El miedo era un ajuste, y lo apagaste.',
    description_de = 'Gewinne 50 Klassik-Runden. Angst war eine Einstellung, und du hast sie abgeschaltet.',
    description_it = 'Vinci 50 partite in Classico. La paura era un''impostazione, e l''hai disattivata.',
    description_pt = 'Vença 50 partidas no Clássico. O medo era uma configuração, e você a desligou.'
  WHERE slug = 'aigis_i_am_not_afraid';

UPDATE titles SET
    name_pt        = 'Panquecas?',
    description_en = 'Play 3 different modes within 7 days. One slip is all it takes to give yourself away.',
    description_fr = 'Joue 3 modes différents en 7 jours. Un seul mot de trop suffit à se trahir.',
    description_es = 'Juega 3 modos distintos en 7 días. Basta un desliz para delatarse.',
    description_de = 'Spiel 3 verschiedene Modi innerhalb von 7 Tagen. Ein Versprecher genügt, um sich zu verraten.',
    description_it = 'Gioca 3 modalità diverse in 7 giorni. Basta una parola di troppo per tradirsi.',
    description_pt = 'Jogue 3 modos diferentes em 7 dias. Um deslize basta para se entregar.'
  WHERE slug = 'akechi_pancakes';

UPDATE titles SET
    name_pt        = 'Cavalgue o Vento',
    description_en = 'Have 5 friends. Nobody rides the wind alone.',
    description_fr = 'Aie 5 amis. Personne ne chevauche le vent seul.',
    description_es = 'Ten 5 amigos. Nadie cabalga el viento solo.',
    description_de = 'Hab 5 Freunde. Niemand reitet den Wind allein.',
    description_it = 'Avere 5 amici. Nessuno cavalca il vento da solo.',
    description_pt = 'Tenha 5 amigos. Ninguém cavalga o vento sozinho.'
  WHERE slug = 'yosuke_ride_the_wind';

UPDATE titles SET
    name_pt        = 'Chato, Não É?',
    description_en = 'Give up 50 times. Some people just stop caring — and say so.',
    description_fr = 'Abandonne 50 fois. Certains cessent simplement de s''en soucier — et le disent.',
    description_es = 'Ríndete 50 veces. Algunos simplemente dejan de importarles, y lo dicen.',
    description_de = 'Gib 50 Mal auf. Manche hören einfach auf, sich zu kümmern — und sagen es.',
    description_it = 'Arrenditi 50 volte. Alcuni smettono semplicemente di curarsene, e lo dicono.',
    description_pt = 'Desista 50 vezes. Algumas pessoas simplesmente param de se importar, e dizem isso.'
  WHERE slug = 'adachi_boring_isnt_it';

UPDATE titles SET
    name_pt        = 'Eu Me Lembrei',
    description_en = 'Unlock 15 badges. Piece by piece, the memories come back.',
    description_fr = 'Débloque 15 badges. Morceau par morceau, les souvenirs reviennent.',
    description_es = 'Desbloquea 15 insignias. Pieza a pieza, los recuerdos vuelven.',
    description_de = 'Schalte 15 Abzeichen frei. Stück für Stück kehren die Erinnerungen zurück.',
    description_it = 'Sblocca 15 badge. Pezzo dopo pezzo, i ricordi tornano.',
    description_pt = 'Desbloqueie 15 emblemas. Peça por peça, as memórias voltam.'
  WHERE slug = 'marie_i_remembered';

UPDATE titles SET
    name_pt        = 'Alcance a Verdade',
    description_en = 'Win at least once in all six modes. The truth hides in the fog until you look everywhere.',
    description_fr = 'Gagne au moins une fois dans les six modes. La vérité se cache dans le brouillard tant qu''on n''a pas cherché partout.',
    description_es = 'Gana al menos una vez en los seis modos. La verdad se esconde en la niebla hasta que miras en todas partes.',
    description_de = 'Gewinne mindestens einmal in allen sechs Modi. Die Wahrheit versteckt sich im Nebel, bis du überall gesucht hast.',
    description_it = 'Vinci almeno una volta in tutte le sei modalità. La verità si nasconde nella nebbia finché non guardi ovunque.',
    description_pt = 'Vença pelo menos uma vez em todos os seis modos. A verdade se esconde na névoa até que você procure em todo lugar.'
  WHERE slug = 'yu_reach_out_to_the_truth';

UPDATE titles SET
    name_pt        = 'Investigation Team',
    description_en = 'Win 8 Personae games. Eight members, eight cases closed.',
    description_fr = 'Gagne 8 parties en Personae. Huit membres, huit affaires résolues.',
    description_es = 'Gana 8 partidas en Personae. Ocho miembros, ocho casos cerrados.',
    description_de = 'Gewinne 8 Personae-Runden. Acht Mitglieder, acht gelöste Fälle.',
    description_it = 'Vinci 8 partite in Personae. Otto membri, otto casi chiusi.',
    description_pt = 'Vença 8 partidas no Personae. Oito membros, oito casos encerrados.'
  WHERE slug = 'investigation_team';

UPDATE titles SET
    name_pt        = 'Junes',
    description_en = 'Win 15 Music games. Every day''s great at your Junes.',
    description_fr = 'Gagne 15 parties en Musique. Every day''s great at your Junes.',
    description_es = 'Gana 15 partidas en Música. Every day''s great at your Junes.',
    description_de = 'Gewinne 15 Musik-Runden. Every day''s great at your Junes.',
    description_it = 'Vinci 15 partite in Musica. Every day''s great at your Junes.',
    description_pt = 'Vença 15 partidas no Música. Every day''s great at your Junes.'
  WHERE slug = 'junes';

UPDATE titles SET
    name_pt        = 'O Primeiro Despertar',
    description_en = 'Win 15 Classic games with the Persona 1 filter. It all began in 1996, at St. Hermelin.',
    description_fr = 'Gagne 15 parties en Classique avec le filtre Persona 1. Tout a commencé en 1996, à St. Hermelin.',
    description_es = 'Gana 15 partidas en Clásico con el filtro Persona 1. Todo empezó en 1996, en St. Hermelin.',
    description_de = 'Gewinne 15 Klassik-Runden mit dem Persona-1-Filter. Alles begann 1996, an der St. Hermelin.',
    description_it = 'Vinci 15 partite in Classico con il filtro Persona 1. Tutto è iniziato nel 1996, alla St. Hermelin.',
    description_pt = 'Vença 15 partidas no Clássico com o filtro Persona 1. Tudo começou em 1996, na St. Hermelin.'
  WHERE slug = 'naoya_first_awakening';

UPDATE titles SET
    name_pt        = 'Sempre Positiva',
    description_en = 'Win 10 Emoji games with the Persona 2 filter. Let''s positive thinking!',
    description_fr = 'Gagne 10 parties en Emoji avec le filtre Persona 2. Let''s positive thinking !',
    description_es = 'Gana 10 partidas en Emoji con el filtro Persona 2. Let''s positive thinking!',
    description_de = 'Gewinne 10 Emoji-Runden mit dem Persona-2-Filter. Let''s positive thinking!',
    description_it = 'Vinci 10 partite in Emoji con il filtro Persona 2. Let''s positive thinking!',
    description_pt = 'Vença 10 partidas no Emoji com o filtro Persona 2. Let''s positive thinking!'
  WHERE slug = 'maya_always_be_positive';

UPDATE titles SET
    name_pt        = 'Shadows Converge',
    description_en = 'Win 50 games in Expert Mode, across all modes. Where the shadows gather, only the best remain.',
    description_fr = 'Gagne 50 parties en Mode Expert, tous modes confondus. Là où les ombres convergent, seuls les meilleurs restent.',
    description_es = 'Gana 50 partidas en Modo Experto, sumando todos los modos. Donde convergen las sombras, solo quedan los mejores.',
    description_de = 'Gewinne 50 Runden im Expertenmodus, über alle Modi hinweg. Wo die Schatten sich sammeln, bleiben nur die Besten.',
    description_it = 'Vinci 50 partite in Modalità Esperto, in tutte le modalità. Dove le ombre convergono, restano solo i migliori.',
    description_pt = 'Vença 50 partidas no Modo Expert, somando todos os modos. Onde as sombras convergem, só os melhores permanecem.'
  WHERE slug = 'shadows_converge';

UPDATE titles SET
    name_pt        = 'S.E.E.S.',
    description_en = 'A squad is not one person. Gather eight calling cards and the armband is yours.',
    description_fr = 'Une escouade, ce n''est pas une personne. Rassemble huit titres et le brassard est à toi.',
    description_es = 'Un escuadrón no es una sola persona. Reúne ocho títulos y el brazalete es tuyo.',
    description_de = 'Ein Trupp ist nicht eine Person. Sammle acht Titel, und die Armbinde gehört dir.',
    description_it = 'Una squadra non è una persona sola. Raccogli otto titoli e la fascia è tua.',
    description_pt = 'Um esquadrão não é uma pessoa só. Reúna oito títulos e a braçadeira é sua.'
  WHERE slug = 'sees';

UPDATE titles SET
    name_pt        = 'Compartilhamos a Mesma Alma',
    description_en = 'Take one bond all the way to rank 10. Two machines learned what that costs.',
    description_fr = 'Mène un lien social jusqu''au rang 10. Deux machines ont appris ce que ça coûte.',
    description_es = 'Lleva un vínculo hasta el rango 10. Dos máquinas aprendieron lo que cuesta.',
    description_de = 'Bring eine Bindung bis Rang 10. Zwei Maschinen haben gelernt, was das kostet.',
    description_it = 'Porta un legame fino al rango 10. Due macchine hanno imparato quanto costa.',
    description_pt = 'Leve um vínculo até o rank 10. Duas máquinas aprenderam o quanto isso custa.'
  WHERE slug = 'aigis_metis_same_soul';

UPDATE titles SET
    name_pt        = 'Não Sou uma Princesa',
    description_en = 'Win 25 games without a single wrong guess. Nobody is rescuing you — you do the rescuing.',
    description_fr = 'Gagne 25 parties sans une seule erreur. Personne ne vient te sauver : c''est toi qui sauves.',
    description_es = 'Gana 25 partidas sin un solo fallo. Nadie viene a salvarte: tú salvas.',
    description_de = 'Gewinne 25 Runden ohne einen einzigen Fehlversuch. Niemand rettet dich — du rettest.',
    description_it = 'Vinci 25 partite senza un solo errore. Nessuno viene a salvarti: salvi tu.',
    description_pt = 'Vença 25 partidas sem um único erro. Ninguém vem te salvar: quem salva é você.'
  WHERE slug = 'kotone_not_a_princess';

UPDATE titles SET
    name_pt        = 'O Caso Nunca Se Encerra',
    description_en = 'Identify 25 silhouettes. A detective does not stop at the first confession.',
    description_fr = 'Identifie 25 silhouettes. Un détective ne s''arrête pas aux premiers aveux.',
    description_es = 'Identifica 25 siluetas. Un detective no se detiene en la primera confesión.',
    description_de = 'Erkenne 25 Silhouetten. Ein Detektiv hört nicht beim ersten Geständnis auf.',
    description_it = 'Identifica 25 sagome. Un detective non si ferma alla prima confessione.',
    description_pt = 'Identifique 25 silhuetas. Um detetive não para na primeira confissão.'
  WHERE slug = 'naoto_case_never_closed';

UPDATE titles SET
    name_pt        = 'Não Preciso da Sua Pena',
    description_en = 'Land 25 quick wins in Classic. No hints, no help, no pity.',
    description_fr = 'Décroche 25 victoires rapides en Classique. Pas d''indice, pas d''aide, pas de pitié.',
    description_es = 'Consigue 25 victorias rápidas en Clásico. Sin pistas, sin ayuda, sin lástima.',
    description_de = 'Hol dir 25 schnelle Siege im Klassik-Modus. Keine Hinweise, keine Hilfe, kein Mitleid.',
    description_it = 'Ottieni 25 vittorie rapide in Classico. Niente indizi, niente aiuto, niente pietà.',
    description_pt = 'Consiga 25 vitórias rápidas no Clássico. Sem dicas, sem ajuda, sem pena.'
  WHERE slug = 'shinjiro_no_pity';

UPDATE titles SET
    name_pt        = 'Vou Roubar Seu Coração',
    description_en = 'Win 40 All-Out Attack rounds. The calling card is only the beginning.',
    description_fr = 'Gagne 40 parties en All-Out Attack. La carte de visite n''est qu''un début.',
    description_es = 'Gana 40 partidas de All-Out Attack. La tarjeta de presentación es solo el principio.',
    description_de = 'Gewinne 40 All-Out-Attack-Runden. Die Visitenkarte ist erst der Anfang.',
    description_it = 'Vinci 40 partite in All-Out Attack. Il biglietto da visita è solo l''inizio.',
    description_pt = 'Vença 40 partidas de All-Out Attack. O cartão de visita é só o começo.'
  WHERE slug = 'take_your_heart';

UPDATE titles SET
    name_pt        = 'Algumas Coisas Não Se Apagam',
    description_en = 'Play on 24 June, any year — the day Innocent Sin came out. A flame kept alight since 1999.',
    description_fr = 'Joue un 24 juin, n''importe quelle année — le jour de la sortie d''Innocent Sin. Une flamme entretenue depuis 1999.',
    description_es = 'Juega un 24 de junio, cualquier año: el día en que salió Innocent Sin. Una llama encendida desde 1999.',
    description_de = 'Spiel an einem 24. Juni, egal welches Jahr — dem Erscheinungstag von Innocent Sin. Eine Flamme, die seit 1999 brennt.',
    description_it = 'Gioca un 24 giugno, in qualsiasi anno — il giorno di uscita di Innocent Sin. Una fiamma accesa dal 1999.',
    description_pt = 'Jogue em um 24 de junho, de qualquer ano: o dia em que Innocent Sin foi lançado. Uma chama acesa desde 1999.'
  WHERE slug = 'tatsuya_dont_burn_out';

UPDATE titles SET
    name_pt        = 'Go Beyond',
    description_en = 'Everything Wonder: his five All-Out Attacks, himself in Classic and Emoji, Jánošík in Personae (normal and Expert), and every P5X song in Music (normal and Expert). Nothing left to find.',
    description_fr = 'Tout Wonder : ses cinq All-Out Attack, lui en Classique et en Émoji, Jánošík en Personae (normal et Expert), et toutes les musiques de P5X en Music (normal et Expert). Plus rien à trouver.',
    description_es = 'Todo Wonder: sus cinco All-Out Attack, él mismo en Clásico y Emoji, Jánošík en Personae (normal y Experto), y todas las canciones de P5X en Music (normal y Experto). Ya no queda nada por encontrar.',
    description_de = 'Alles über Wonder: seine fünf All-Out Attacks, er selbst in Klassik und Emoji, Jánošík in Personae (normal und Experte), und jeder P5X-Song in Music (normal und Experte). Nichts bleibt zu finden.',
    description_it = 'Tutto Wonder: i suoi cinque All-Out Attack, lui in Classico ed Emoji, Jánošík in Personae (normale ed Esperto), e ogni canzone di P5X in Music (normale ed Esperto). Niente più da trovare.',
    description_pt = 'Tudo de Wonder: seus cinco All-Out Attack, ele mesmo no Clássico e no Emoji, Jánošík no Personae (normal e Expert), e todas as músicas de P5X no Música (normal e Expert). Não sobra nada para encontrar.'
  WHERE slug = 'wonder_go_beyond';

-- ── Contrôle (à lancer à la main après application) ─────────────────────────
-- SELECT COUNT(*) FROM titles WHERE name_pt IS NULL OR description_pt IS NULL;   → 0
-- SELECT COUNT(*) FROM titles WHERE description_en IS NULL;                      → 0
