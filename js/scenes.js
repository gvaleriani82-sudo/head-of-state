/* ============================================================
   SISTEMA SCENE (raster evento + hero home) — ARTE SU FILE (B2, 26 lug 2026).

   I base64 inline sono STATI RIMOSSI: il set vecchio è stato sostituito, non estratto.
   Ogni valore qui è un PATH relativo alla root del sito (`assets/scenes/…webp`), servito
   come file. Il selettore (scenaSrc in js/ui.js) riconosce ancora anche i data-URL, quindi
   la forma inline resta legale — semplicemente non la usiamo più.
   Fonte delle assegnazioni: CATALOGO-SCENE.md (69 assegnazioni verificate a vista).

   FORMA DI UN BUCKET
     stringa                → una sola immagine per ogni caso (es. hero)
     { base, grave, florido }         → varianti TONALI, scelte dal `tono` della carta
     { …, italia1950, italia1960 }    → varianti d'EPOCA, chiavi = tag-era del motore
     array in una variante            → rotazione anti-ripetizione (hash stabile sull'id-carta)

   ORDINE DI SCELTA (scenaSrc): variante d'epoca tonale → tono se era-viva → scena d'epoca
   del bucket → base se era-viva → NESSUNA scena. Il tono vince quando ha arte era-viva
   (una scuola «grave» resta in rovina anche nel '50); la scena d'epoca copre il caso neutro
   e i `base` mancanti. Mai una variante d'epoca sbagliata: meglio nessuna scena.

   I 5 «BUCHI DICHIARATI» (`sanita.base`, `scuola.base`, `ordinepubblico.base`, `giustizia.grave`,
   `stampa.base`) sono stati TAPPATI (L8-1, 26 lug): i file esistono ora e sono cablati. In più
   `crisi.italia1950` (crisi-anni50) copre lo scenario '50, che prima restava senza scena (base+grave
   sono `contemporanea`). ⚠️ Le 5 nuove `base` NON sono era-flaggate (default = universale): se qualcuna
   fosse moderna, si vedrebbe nel '50 — da guardare a occhio (l'era-gating è l'unico strato di giudizio).

   REGOLA-FALLBACK (vedi CSS #home-hero/.ag-scene): uno slot vuoto/assente non attiva scena,
   il 375px non si rompe. Gli slot hanno aspect-ratio 16/9 + fondo panel2, quindi occupano il
   loro posto anche prima che il file arrivi (niente salto di layout).
   ============================================================ */

const S_ = 'assets/scenes/';   // prefisso unico: se la cartella si sposta, si cambia qui

const SCENES = {
  /* --- i bucket tematici --- */
  economia:       { base:S_+'economia-base.webp', florido:S_+'economia-florido.webp',
                    italia1960:S_+'economia-anni60.webp', italia1970:S_+'economia-anni70.webp', italia1980:S_+'economia-anni80.webp',
                    italia1990:S_+'economia-anni90.webp' },
  lavoro:         { base:S_+'lavoro-base.webp', grave:S_+'lavoro-grave.webp', florido:S_+'lavoro-florido.webp',
                    italia1950:S_+'lavoro-anni50.webp', italia1970:S_+'lavoro-anni70.webp', italia1980:S_+'lavoro-anni80.webp',
                    italia1990:S_+'lavoro-anni90.webp' },   // L43-1: arrivata dopo L42-1, il buco e chiuso
  sanita:         { base:S_+'sanita-base.webp', grave:S_+'sanita-grave.webp', florido:S_+'sanita-florido.webp',
                    italia1950:S_+'sanita-anni50.webp' },   // L9-1: corsia d'epoca, copre le carte neutre/florido nel '50 (base è contemporanea)
  scuola:         { base:S_+'scuola-base.webp', grave:S_+'scuola-grave.webp', florido:S_+'scuola-florido.webp',
                    italia1950:S_+'scuola-anni50.webp' },
  ordinepubblico: { base:S_+'ordinepubblico-base.webp', grave:S_+'ordinepubblico-grave.webp', florido:S_+'ordinepubblico-florido.webp',
                    italia1950:S_+'ordinepubblico-anni50.webp' },   // L9-1: piazza/agenti d'epoca, copre tutti i toni nel '50 (bucket contemporanea)
  giustizia:      { base:S_+'giustizia-base.webp', grave:S_+'giustizia-grave.webp', florido:S_+'giustizia-florido.webp' },
  /* scandalo è grave per natura: resta bucket-STRINGA (sempre acceso, come prima di B2). Se fosse
     {grave:…} una carta-scandalo senza `tono` esplicito cadrebbe su un base inesistente → nessuna scena. */
  scandalo:       S_+'scandalo-grave.webp',
  infrastrutture: { base:S_+'infrastrutture-base.webp', grave:S_+'infrastrutture-grave.webp',
                    florido:S_+'infrastrutture-florido.webp', italia1950:S_+'infrastrutture-anni50.webp' },
  casa:           { base:S_+'casa-base.webp', grave:S_+'casa-grave.webp', florido:S_+'casa-florido.webp' },
  ambiente:       { base:S_+'ambiente-base.webp', grave:S_+'ambiente-grave.webp', florido:S_+'ambiente-florido.webp' },
  societacivile:  { base:S_+'societacivile-base.webp', florido:S_+'societacivile-florido.webp',
                    italia1950:S_+'societacivile-anni50.webp', italia1960:S_+'societacivile-anni60.webp',
                    italia1970:S_+'societacivile-anni70.webp', italia1980:S_+'societacivile-anni80.webp',
                    italia1990:S_+'societacivile-anni90.webp' },   // L42-1: i lenzuoli bianchi alle finestre — la piazza del '92, senza scritte e senza retorica
  esteri:         { base:S_+'esteri-base.webp', florido:S_+'esteri-florido.webp',
                    grave:[S_+'esteri-grave.webp', S_+'esteri-tavolo.webp'] },   // due stanze fredde: ruotano
  crisi:          { base:S_+'crisi-base.webp', grave:S_+'crisi-grave.webp', italia1950:S_+'crisi-anni50.webp' },
  /* i soccorsi tra le macerie stanno in `base`, non in `grave`: l'emergenza senza tono è già grave di suo
     (una carta-calamità neutra deve accendere la scena, non restare vuota). `florido` = i mezzi all'alba. */
  emergenza:      { base:S_+'emergenza-grave.webp', florido:S_+'emergenza-florido.webp' },
  elezioni:       { base:S_+'elezioni-base.webp', grave:S_+'elezioni-grave.webp', florido:S_+'elezioni-florido.webp' },
  /* L38-1: la `stampa-anni80` della prima passata era da scartare (orologio LED, sigle nei monitor) ed e' in
     assets/riserva/; questa e' la rigenerata, verificata a vista: monitor bianchi, nessun testo leggibile. */
  stampa:         { base:S_+'stampa-base.webp', grave:S_+'stampa-grave.webp',
                    italia1950:S_+'stampa-anni50.webp', italia1960:S_+'stampa-anni60.webp',
                    italia1970:S_+'stampa-anni70.webp', italia1980:S_+'stampa-anni80.webp',
                    italia1990:S_+'stampa-anni90.webp' },
  vitaprivata:    { base:S_+'vitaprivata-base.webp', florido:S_+'vitaprivata-florido.webp',
                    italia1950:S_+'vitaprivata-anni50.webp', italia1960:S_+'vitaprivata-anni60.webp',
                    italia1970:S_+'vitaprivata-anni70.webp', italia1980:S_+'vitaprivata-anni80.webp',
                    italia1990:S_+'vitaprivata-anni90.webp' },
  partito:        { base:[S_+'partito-base.webp', S_+'partito-riunione.webp'],                     // assemblea / riunione in penombra
                    grave:S_+'partito-grave.webp', florido:S_+'partito-florido.webp',
                    italia1950:S_+'partito-anni50.webp', italia1970:S_+'partito-anni70.webp', italia1980:S_+'partito-anni80.webp',
                    italia1990:S_+'partito-anni90.webp' },

  /* --- bucket NUOVI (lotti 4-5): soggetti che prima non esistevano, cablati sotto in SCENA_DI_* --- */
  /* il retroscena: 8 stanze del fuori-verbale in rotazione — l'anti-ripetizione più ricca del set */
  retro:          { base:[S_+'retro-accordo.webp', S_+'retro-industriale.webp', S_+'retro-cronista.webp',
                          S_+'retro-anticamera.webp', S_+'retro-stanza.webp', S_+'retro-canale.webp',
                          S_+'retro-sezione.webp', S_+'retro-auto.webp'] },
  elezioniScrutinio:{ base:S_+'elezioni-scrutinio.webp' },                    // le mani che contano le schede
  partitoNotte:   { base:S_+'partito-notte.webp' },                           // la sede la notte dello spoglio
  /* i tre bucket d'epoca con ripiego al presente: nel '50/'60 la scena giusta, oggi una neutra già in casa */
  istituzioni:    { base:S_+'partito-base.webp',        italia1950:S_+'istituzioni-anni50.webp' },
  cultura:        { base:S_+'societacivile-base.webp',  italia1950:S_+'cinema-anni50.webp' },
  festa:          { base:S_+'societacivile-base.webp',  italia1950:S_+'festa-anni50.webp' },
  mare:           { base:S_+'societacivile-base.webp',  italia1960:S_+'mare-anni60.webp' },
  /* L127-1b: il ministro che se ne va. La carta del rimpasto sceglie fra le due da `it.uscita` (scenaId, ui.js):
     «Sostituisci» → la scrivania svuotata; lealtà sotto 18 o dimissioni chieste dopo uno scandalo → la scalinata coi cronisti. */
  ministroCacciato:   S_+'ministro-cacciato.webp',
  ministroDimissioni: S_+'ministro-dimissioni.webp',

  /* --- home --- */
  hero: S_+'hero.webp',
};

/* ===== L95-4 — LE CLIP IN MOVIMENTO (`assets/video/`). Una clip ha lo STESSO NOME del .webp della scena che
   anima (l'hero fa eccezione: `home-hero`), perché il suo primo fotogramma è quell'immagine e il passaggio non
   deve vedersi. La lista è una promessa sulla cartella, come AUDIO_PRESENTI: il gioco chiede SOLO questi file
   (zero 404), e `.claude/verifica-asset.js` tiene allineate lista e cartella e pretende che ogni nome abbia la
   sua scena. Contratto e condizioni (movimento «pieno», niente risparmio dati) in DESIGN-MOVIMENTO.md e ui.js.
   ⚑ L119-1 (27/9): le clip arrivano da Gemini, ripulite da Cowork in `arte-sorgente/video-gemini/pronte/` (960×540, 10 s, muto);
   da questo lotto OGNI TURNO di Code porta quelle nuove qui e in cartella. `home-hero` è ora quella di Gemini (al posto di
   quella di ElevenLabs, decisione di Giacomo). */
const VIDEO_PRESENTI = ['home-hero', 'partito-base', 'vitaprivata-base', 'retro-sezione',
  /* 27/9 sera (L127-1): 31 clip di Kling. I momenti (elezioni-*, notte-*, telefono-*, intervista-*, finale-*) passano da
     `scenaMomentoHtml` (ui.js); le altre sono carte come sempre. */
  'elezioni-base', 'elezioni-florido', 'elezioni-scrutinio', 'esteri-base', 'esteri-florido',
  'finale-caduta', 'finale-dignita', 'finale-oblio', 'finale-trionfo',
  'intervista-aula', 'intervista-studio', 'intervista-studio-anni50', 'intervista-studio-anni60', 'intervista-vertice',
  'notte-attesa', 'notte-sconfitta', 'notte-spoglio', 'notte-vittoria',
  'partito-notte', 'partito-riunione',
  'retro-accordo', 'retro-anticamera', 'retro-canale', 'retro-cronista', 'retro-stanza',
  'telefono-anni50', 'telefono-corridoio', 'telefono-oggi',
  'vitaprivata-anni60', 'vitaprivata-anni90', 'vitaprivata-florido',
  /* 28/9 (L127-1b): il ministro che se ne va, sulla carta del rimpasto e nella fine `silurato` */
  'ministro-cacciato', 'ministro-dimissioni',
  /* 28/9 sera (L127-2): le cinque clip del PUNTO DI PARTENZA — non sono carte: le apre `apriPartenza()` (ui.js) all'ingresso
     in carriera; il .webp sta in assets/scenes/ come per ogni clip (fa da poster), nessuna carta lo nomina. */
  'partenza-attivista', 'partenza-locale', 'partenza-ministro', 'partenza-capo', 'partenza-diplomatico',
  /* 30/9 (L153-5): le clip delle PARTITE STORICHE — il paese (5 s, 960×540, mute; qui le bandiere ci vogliono), poi il decennio. Non sono
     carte: le apre `apriClipPorta()` (ui.js) quando si sceglie una porta, e la sequenza si DERIVA dalla porta (`porta-paese-<paese>`,
     `porta-decennio-<anno>`): una clip vale solo se il suo nome è qui. Il poster di un decennio è la sua miniatura `porta-decennio-*.webp`.
     30/9 sera: Francia e Regno Unito rifatte (immagine e clip), arrivate Germania e USA (gli USA non hanno porte oggi: la clip aspetta)
     e la prima clip di decennio, il 1950. */
  'porta-paese-italia', 'porta-paese-francia', 'porta-paese-regnounito', 'porta-paese-germania', 'porta-paese-usa',
  'porta-decennio-1950', 'porta-decennio-1960', 'porta-decennio-1970', 'porta-decennio-1980', 'porta-decennio-1990', 'porta-decennio-2000'];

/* ===== L124-1 — IL VIDEO INTRODUTTIVO (`assets/video/intro.*`). Non è una scena: sta FUORI da VIDEO_PRESENTI (non ha una
   carta né un .webp in assets/scenes) ma sotto la stessa guardia (`.claude/verifica-asset.js`): i file dichiarati qui devono
   esserci, un `intro.*` in cartella dev’essere dichiarato qui, e la clip non supera 10 MB. Lo apre `apriIntro()` (ui.js) al
   primo tocco sulla home, una volta per dispositivo. Montaggio di Cowork: `arte-sorgente/intro/monta.sh`. */
const INTRO_VIDEO = { clip:'intro.mp4', poster:'intro.webp', sottotitoli:{ it:'intro.it.vtt', en:'intro.en.vtt' } };

/* ===== L146-1 — LA VOCE DELLE CLIP DEL PUNTO DI PARTENZA (`assets/video/partenza-<nome>.voce.mp3` e `.it/.en.vtt`). La voce
   (ElevenLabs, voce «Statista» come l'intro) NON è dentro l'mp4: è un file a parte, perché la clip deve poter restare ferma
   sull'ultimo fotogramma mentre la voce finisce. La chiave è il nome di `PARTENZA_NOMI` (ui.js). Stessa guardia delle altre
   liste (`.claude/verifica-asset.js`): dichiarato = in cartella, in cartella = dichiarato, una voce ≤ 300 KB. I tempi dei cue
   sono MISURATI sulla voce (`.claude/partenza-voce/pause-cdp.js` → `cue.js`), non stimati. */
const PARTENZA_VOCE = {
  attivista:   { voce:'partenza-attivista.voce.mp3',   sottotitoli:{ it:'partenza-attivista.it.vtt',   en:'partenza-attivista.en.vtt' } },
  locale:      { voce:'partenza-locale.voce.mp3',      sottotitoli:{ it:'partenza-locale.it.vtt',      en:'partenza-locale.en.vtt' } },
  ministro:    { voce:'partenza-ministro.voce.mp3',    sottotitoli:{ it:'partenza-ministro.it.vtt',    en:'partenza-ministro.en.vtt' } },
  capo:        { voce:'partenza-capo.voce.mp3',        sottotitoli:{ it:'partenza-capo.it.vtt',        en:'partenza-capo.en.vtt' } },
  diplomatico: { voce:'partenza-diplomatico.voce.mp3', sottotitoli:{ it:'partenza-diplomatico.it.vtt', en:'partenza-diplomatico.en.vtt' } } };

/* ===== L127-3 — LE SCENE DEL PAESE (`assets/scenes/<scena>-<paese>.webp`, <paese> = un id di PAESI). Decisione di Giacomo
   del 27/9: le bandiere nazionali sono ammesse SOLO in un'immagine legata a un paese; una scena che il gioco mostra ovunque
   non ne ha. Quinta lista-promessa, stesso contratto delle altre: `scenaSrc` (ui.js) preferisce `<file scelto>-<S.paese>`
   solo se il nome è qui, e `.claude/verifica-asset.js` tiene allineate lista e cartella ed è rossa su un suffisso che non è
   un id di PAESI. Additivo: una scena senza variante di paese si vede come prima. Le sorgenti stanno in
   `arte-sorgente/video-gemini/immagini/` e si convertono con `node .claude/converti-scene.js`. */
const SCENE_PAESE = ['elezioni-florido-italia', 'elezioni-grave-italia',
                     'elezioni-florido-francia', 'elezioni-florido-regnounito', 'elezioni-florido-germania'];

/* ===== L151-2 — LE SCENE D'AREA (`assets/scenes/<scena>-<area>.webp`). Una strada, un mercato, un tribunale «neutri» sono
   europei: fuori dall'Europa la scena si veste con l'AREA del paese, se la variante c'è. Sei aree (decise al vaglio di
   L150-1): europa · nordamerica · latina · asiaest · asiasud · africa; l'Europa NON ha varianti (è la scena-base).
   `AREA_DI_PAESE` dice l'area di ogni id di PAESI; `SCENE_AREA` è la sesta lista-promessa, stesso contratto di
   `SCENE_PAESE`: `scenaPaese()` (ui.js) prova prima `<file>-<paese>`, poi `<file>-<area del paese>` — IL PAESE VINCE
   SULL'AREA — e solo se il nome è qui; `.claude/verifica-asset.js` tiene allineate lista e cartella. Additivo: con la
   lista vuota tutto come prima. ⚠ SOLO NEL PRESENTE: una strada «nordamericana di oggi» sulla carta di una porta del
   1950 sarebbe peggio della neutra (la riga è in `scenaPaese`). Un'area non può chiamarsi come un id di PAESI.
   Le sorgenti arrivano in `arte-sorgente/scene-mondo/` e le porta il turno di Code (PROTOCOLLO-AUTONOMO, passo 2-bis). */
const AREA_DI_PAESE = { italia:'europa', francia:'europa', regnounito:'europa', germania:'europa', spagna:'europa',
                        usa:'nordamerica', canada:'nordamerica', australia:'nordamerica',
                        messico:'latina', brasile:'latina', argentina:'latina',
                        giappone:'asiaest', coreasud:'asiaest', india:'asiasud',
                        nigeria:'africa', sudafrica:'africa' };
const SCENE_AREA = [];

/* ===== L151-2 — LE IMMAGINI DEI DECENNI (`assets/scenes/porta-decennio-<anno>.webp`): la miniatura delle porte storiche che non
   hanno una `soglia-*` loro (Regno Unito, Francia, Germania) nella pagina degli storici — `sogliaSrc()` in ui.js. Lista-promessa:
   qui stanno gli ANNI che hanno il file. Il 1950 è entrato il 30/9 sera: la prima sorgente aveva un'insegna leggibile («CAFE»),
   quella rifatta (cantiere e radio, senza scritte) no. */
const PORTE_DECENNIO = [1950, 1960, 1970, 1980, 1990, 2000];

/* ===== L113-2 — LE PEDINE DEL TAVOLO (`assets/tavolo/<nome>.webp`, 256 × 256 con trasparenza, ≤ 60 KB, appoggiate in
   basso al centro). Terza lista-promessa, stesso contratto di AUDIO_PRESENTI e VIDEO_PRESENTI: il tavolo disegna SOLO
   le pedine di questa lista (zero 404, e niente segnaposto inventati finché il file non c'è), e `.claude/verifica-asset.js`
   tiene allineate lista e cartella. I nomi possibili sono i sette di PEDINE_NOMI (lo stile C di PROMPT-TAVOLO-CAMPIONI.md):
   un nome fuori da lì è rosso. Le sorgenti stanno in `arte-sorgente/tavolo/` e si convertono con
   `node .claude/tavolo-prova/converti-pedine.js`. Dove va ogni pedina lo decide `pedinaDi()` in ui.js. */
const PEDINE_NOMI = ['palazzo','citta','industria','campagna','porto','universita','montagna','sede'];
const PEDINE_PRESENTI = ['palazzo','citta','campagna','porto','universita','sede'];   // L152-4 (30/9): le cinque dello stile C ritagliate pulite (ritaglia-pedine.js). `industria` e `montagna` non sono pulite e restano fuori (il tentativo è in .claude/tavolo-prova/ritaglio-prove/). Sul tavolo oggi non se ne vede nessuna: tutte aspettano il campo `carattere` (il ripiego «tipo città → citta» di pedinaDi è spento: la pedina finiva sotto il cerchio della sua città).

/* ===== L9-1 — SCENE DEI MOMENTI (NON card): fondi/illustrazioni per i modali di solo testo.
   Cablate direttamente nei render (intervista/notte/telefonata/finale) e nel selettore-scenario,
   MAI nel selettore-carta generico. Gli helper era-aware stanno in ui.js (dove vive eraCombacia). ===== */
const SCENA_MOMENTO = {
  intervista: { aula:S_+'intervista-aula.webp', studio:S_+'intervista-studio.webp', vertice:S_+'intervista-vertice.webp',
                studio_italia1950:S_+'intervista-studio-anni50.webp', studio_italia1960:S_+'intervista-studio-anni60.webp' },
  notte:      { attesa:S_+'notte-attesa.webp', spoglio:S_+'notte-spoglio.webp', vittoria:S_+'notte-vittoria.webp', sconfitta:S_+'notte-sconfitta.webp' },
  telefono:   { oggi:S_+'telefono-oggi.webp', storico:S_+'telefono-anni50.webp', corridoio:S_+'telefono-corridoio.webp' },
  finale:     { trionfo:S_+'finale-trionfo.webp', dignita:S_+'finale-dignita.webp', caduta:S_+'finale-caduta.webp', oblio:S_+'finale-oblio.webp',
                silurato:S_+'ministro-cacciato.webp' },   // L127-1b: la fine `silurato` è la scrivania svuotata
  /* L151-2: la voce `soglia` e il suo lettore `scenaSoglia()` (ui.js) sono tolti — nessuno li chiamava. I file `soglia-*.webp`
     restano VIVI: li usa `SOGLIE` (ui.js) per le miniature delle porte nella pagina degli storici. */
};

/* kicker (stringa-sorgente italiana, com'è nei pool) → id-scena */
const SCENA_DI_KICK = {
  // economia & bilancio
  'Bilancio':'economia','Fisco':'economia','Conti del governo':'economia','Credito':'economia',
  'Agenzie di rating':'economia','Crisi del debito':'economia','Sviluppo':'economia','Innovazione':'economia',
  'Digitale':'economia','Commercio':'economia','Consumatori':'economia','Crisi industriale':'economia',
  // lavoro
  'Lavoro':'lavoro','Welfare':'lavoro','Conflitto sociale':'lavoro',
  // sanità
  'Sanità':'sanita','Salute':'sanita','Prevenzione':'sanita',
  // ordine pubblico
  'Ordine pubblico':'ordinepubblico','Sicurezza':'ordinepubblico','Incidente':'ordinepubblico',
  // giustizia
  'Giustizia':'giustizia','Diritti':'giustizia','Aula':'giustizia','Coscienza':'giustizia',
  // scuola & cultura — 'Cultura'/'Costume' staccati su `cultura` (B2): scuola.base è un buco, e il cinema
  // d'epoca è la scena giusta per il costume, non l'aula
  'Scuola':'scuola','Istruzione':'scuola','Cultura':'cultura','Costume':'cultura',
  // infrastrutture & trasporti
  'Infrastrutture':'infrastrutture','Trasporti':'infrastrutture','Mobilità':'infrastrutture','Area vasta':'infrastrutture',
  // casa & città — 'Turismo' staccato su `mare` (B2): nel '60 la spiaggia di massa
  'Casa':'casa','Città':'casa','Centro storico':'casa','Territorio':'casa','Turismo':'mare','Acqua':'casa',
  // ambiente & energia
  'Ambiente':'ambiente','Crisi energetica':'ambiente','Agricoltura':'ambiente','Arma-energia':'ambiente',
  // società civile
  'Società civile':'societacivile','Società':'societacivile','Connazionali':'societacivile',
  // esteri & diplomazia
  'Esteri':'esteri','Foro multilaterale':'esteri','Assemblea internazionale':'esteri','Diplomazia pubblica':'esteri',
  'Alleanze':'esteri','Alleanza atlantica':'esteri','Difesa collettiva':'esteri','Cooperazione militare':'esteri',
  // crisi tra potenze
  'Crisi tra potenze':'crisi','Crisi diplomatica':'crisi','Crisi regionale':'crisi','Conflitto regionale':'crisi',
  'Allarme nucleare':'crisi','Crisi da disinnescare':'crisi','Caso consolare':'crisi',
  // emergenza & calamità
  'Calamità naturale':'emergenza','Emergenza':'emergenza','Emergenza umanitaria':'emergenza',
  // elezioni — 'Voto conteso' va allo scrutinio (le mani che contano), non al seggio generico
  'Voto conteso':'elezioniScrutinio',
  // il partito — 'Palazzo'/'Ombre' staccati su `retro` (B2): il sussurro nel corridoio, non l'assemblea;
  // 'Istituzioni'/'Pubblica amministrazione' su `istituzioni` (nel '50 l'aula parlamentare deserta)
  'Partito':'partito','Palazzo':'retro','Il pendolo':'partito','Istituzioni':'istituzioni','Pubblica amministrazione':'istituzioni',
  // stampa
  'Comunicazione':'stampa','Affondo':'stampa',
  // vita privata & famiglia
  'Vita privata':'vitaprivata','Famiglia':'vitaprivata',
  /* --- RIMAPPE audit E (copertura per-costruzione): kick nati dopo la mappa → bucket esistente. NESSUNA
     ramificazione d'era: la scelta d'epoca la fa il pool (eraViva), non questa mappa (una carta '50 e una moderna
     con lo stesso kick condividono la scena era-neutra). --- */
  'Campagna elettorale':'elezioni',
  'Servizi':'casa','Periferie':'casa','Opera pubblica':'infrastrutture','Comunità':'societacivile','Eventi':'festa','Dissesto':'ambiente','Scuole':'scuola',
  'Piano Marshall':'esteri','Trattati di Roma':'esteri','Trieste':'esteri','Ungheria':'esteri','Unione Europea':'esteri','Frontiere':'esteri','Guerra di Corea':'crisi','Salari':'lavoro',
  'Alluvione':'emergenza','Emergenza infrastrutture':'emergenza','Emergenza sanitaria':'emergenza','Scandalo':'scandalo','Politica interna':'partito',
  'Mediazione':'esteri','Rapporti con gli alleati':'esteri','Negoziato':'esteri',
  'Scandalo del governo':'scandalo','Manovra impopolare':'economia','Maggioranza in crisi':'partito','Promessa tradita':'partito','Piazza contro il governo':'ordinepubblico','Gaffe internazionale':'esteri',
  // 6 rimappe di giudizio (decise da Giacomo): Ombre→retro (il sussurro, non lo scandalo pubblico — B2: era 'partito', ora ha la stanza sua); Mezzogiorno→infrastrutture (opere, non faldoni); Terra→ambiente (paesaggio); Televisione→stampa; Anno Santo→societacivile; Colpo di fortuna→economia
  'Anno Santo':'societacivile','Terra':'ambiente','Televisione':'stampa','Ombre':'retro','Mezzogiorno':'infrastrutture','Colpo di fortuna':'economia',
};

/* kind strutturale (carte narrative senza kicker tematico) → id-scena.
   B2: `intermedia` → partitoNotte (la sede la notte dello spoglio, non il seggio); `occasione` → retro
   (l'occasione di carriera si gioca in corridoio: 8 stanze in rotazione, addio wallpaper). */
const SCENA_DI_KIND = {
  scandalo:'scandalo', inchiesta:'scandalo', conflitto:'partito', personale:'vitaprivata',
  intermedia:'partitoNotte', puntopartito:'partito', premier:'partito', occasione:'retro',
  rinnovoInt:'esteri', crisiInt:'crisi', rimpasto:'partito', stampa:'stampa',
};

/* dicastero → id-scena (per proposta/budget/ministro, che non hanno un kicker tematico) */
const SCENA_DI_MIN = {
  economia:'economia', interno:'ordinepubblico', giustizia:'giustizia', esteri:'esteri', difesa:'crisi',
  lavoro:'lavoro', salute:'sanita', istruzione:'scuola', sviluppo:'economia', infrastrutture:'infrastrutture',
};

/* DISPLAY SELETTIVO: la scena compare SOLO sulle carte MAGGIORI/narrative — marca i momenti che
   contano, così non stanca e non allunga lo scroll delle carte di routine. Le carte NON elencate
   (dossier, proposta, budget, ministro, premier, stampa) restano senza scena (il rimpasto no dal L127-1b).
   [puntopartito e conflitto SONO major — accendono la scena-partito, vedi sotto]. */
const SCENA_MAJOR = {
  event:1,        // eventi gravi one-off
  arco:1,         // archi narrativi (anche personali via filo)
  scandalo:1, inchiesta:1,       // lo scandalo del ministro / l'arco giudiziario
  intermedia:1,   // elezioni intermedie (la notte nazionale è un modale, non una card-agenda)
  crisiInt:1,     // crisi di mediazione internazionale
  occasione:1, rinnovoInt:1,     // le occasioni di carriera / la fine del mandato al vertice
  personale:1,    // eventi di vita privata
  locale:1,       // VARIANTI-SCENA (pilota 2026-07-04): le carte città/regione accendono la scena via scenaId (kick→bucket)
  puntopartito:1, conflitto:1,   // VARIANTI-SCENA batch 3: unità/trionfo (puntopartito) e spaccatura interna (conflitto) accendono la scena-partito
  rimpasto:1,    // L127-1b (28/9): la carta del rimpasto porta il ministro che esce (cacciato/dimissioni, da `it.uscita`)
  attivista:1,   // BUILD A (L2): la carta-mossa del mese. NON in SCENA_DI_KIND → scenaId cade sul `kick` (tema) → bucket tonale che ruota (anti-wallpaper, rifinitura B)
};
/* TONO PER KIND (valenza uniforme): le carte GENERATE senza campo `tono` proprio (partito/estero) prendono la valenza
   da qui. Le carte a valenza MISTA (crisiInt/personale/eventi-esteri, che hanno un `data` statico) si taggano per-carta
   e vincono su questa tabella. conflitto=spaccatura→grave · puntopartito=unità/trionfo→florido · occasione=carriera/
   trionfo→florido · rinnovoInt=culmine del mandato internazionale→florido. */
const SCENA_TONO_KIND = { conflitto:'grave', puntopartito:'florido', occasione:'florido', rinnovoInt:'florido' };

/* ERA-GATING SCENE — RI-DERIVATO SUL SET NUOVO (B2). Flag per-variante, parallelo a SCENES.
   Default non-flaggato = universale (vive in ogni epoca). Ho marcato 'contemporanea' SOLO dove il
   catalogo dichiara il soggetto moderno (parole sue: «moderno», «al presente», «robot e muletto»,
   «maxischermo», «pannelli solari / eolico», «schermi»); tutto il resto resta universale.
   ⚠️ È l'unico strato di GIUDIZIO di B2: il catalogo assegna i file, non le epoche. Da guardare a
   occhio giocando l'Italia-'50, dove un falso-universale si vede subito.
   NOVITÀ: `stampa` non usa più l'ancora _annoMin:1954 (telecamere TV) — ora l'epoca ha arte sua
   (tipografia '50, studio TV '60), quindi basta escludere la variante moderna. Il supporto a
   `_annoMin` resta nel selettore, semplicemente non serve più a nessuno. */
const SCENA_ERA = {
  economia:       { base:'contemporanea' },                              // via commerciale «al presente» (florido gru/cantieri = universale)
  lavoro:         { base:'contemporanea', florido:'contemporanea' },     // robot e muletto / officina moderna (grave capannone dismesso = universale)
  sanita:         { base:'contemporanea', florido:'contemporanea' },     // L8-4: base = corridoio moderno (linoleum/alluminio); grave (corsia con la muffa) = universale
  scuola:         { base:'contemporanea' },                              // L8-4: base = banchi in laminato/sedie di plastica/termosifoni; grave/florido universali, e c'è scuola-anni50 per il '50
  ambiente:       { base:'contemporanea', florido:'contemporanea' },     // pannelli solari / eolico (grave torre di raffreddamento = universale)
  infrastrutture: { florido:'contemporanea' },                           // città verde, tram, ciclabile
  elezioni:       { grave:'contemporanea' },                             // maxischermo in piazza
  partito:        { florido:'contemporanea' },                           // «emiciclo moderno» con gli schermi
  stampa:         { base:'contemporanea', grave:'contemporanea' },       // L8-4: base = open space con monitor su ogni scrivania; grave (podio+telecamere) già contemporanea; c'è stampa-anni50/60 per l'epoca
  ordinepubblico: 'contemporanea',                                       // antisommossa moderno / strada serale (intero bucket-stringa, invariato)
  emergenza:      'contemporanea',                                       // mezzi e soccorsi moderni (intero bucket-stringa, invariato)
  crisi:          { base:'contemporanea', grave:'contemporanea' },        // invariato dal set precedente
};
