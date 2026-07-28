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
                    italia1960:S_+'economia-anni60.webp' },
  lavoro:         { base:S_+'lavoro-base.webp', grave:S_+'lavoro-grave.webp', florido:S_+'lavoro-florido.webp',
                    italia1950:S_+'lavoro-anni50.webp' },
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
                    italia1950:S_+'societacivile-anni50.webp', italia1960:S_+'societacivile-anni60.webp' },
  esteri:         { base:S_+'esteri-base.webp', florido:S_+'esteri-florido.webp',
                    grave:[S_+'esteri-grave.webp', S_+'esteri-tavolo.webp'] },   // due stanze fredde: ruotano
  crisi:          { base:S_+'crisi-base.webp', grave:S_+'crisi-grave.webp', italia1950:S_+'crisi-anni50.webp' },
  /* i soccorsi tra le macerie stanno in `base`, non in `grave`: l'emergenza senza tono è già grave di suo
     (una carta-calamità neutra deve accendere la scena, non restare vuota). `florido` = i mezzi all'alba. */
  emergenza:      { base:S_+'emergenza-grave.webp', florido:S_+'emergenza-florido.webp' },
  elezioni:       { base:S_+'elezioni-base.webp', grave:S_+'elezioni-grave.webp', florido:S_+'elezioni-florido.webp' },
  stampa:         { base:S_+'stampa-base.webp', grave:S_+'stampa-grave.webp',
                    italia1950:S_+'stampa-anni50.webp', italia1960:S_+'stampa-anni60.webp' },
  vitaprivata:    { base:S_+'vitaprivata-base.webp', florido:S_+'vitaprivata-florido.webp',
                    italia1950:S_+'vitaprivata-anni50.webp', italia1960:S_+'vitaprivata-anni60.webp' },
  partito:        { base:[S_+'partito-base.webp', S_+'partito-riunione.webp'],                     // assemblea / riunione in penombra
                    grave:S_+'partito-grave.webp', florido:S_+'partito-florido.webp',
                    italia1950:S_+'partito-anni50.webp' },

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

  /* --- home --- */
  hero: S_+'hero.webp',
};

/* ===== L9-1 — SCENE DEI MOMENTI (NON card): fondi/illustrazioni per i modali di solo testo.
   Cablate direttamente nei render (intervista/notte/telefonata/finale) e nel selettore-scenario,
   MAI nel selettore-carta generico. Gli helper era-aware stanno in ui.js (dove vive eraCombacia). ===== */
const SCENA_MOMENTO = {
  intervista: { aula:S_+'intervista-aula.webp', studio:S_+'intervista-studio.webp', vertice:S_+'intervista-vertice.webp',
                studio_italia1950:S_+'intervista-studio-anni50.webp', studio_italia1960:S_+'intervista-studio-anni60.webp' },
  notte:      { attesa:S_+'notte-attesa.webp', spoglio:S_+'notte-spoglio.webp', vittoria:S_+'notte-vittoria.webp', sconfitta:S_+'notte-sconfitta.webp' },
  telefono:   { oggi:S_+'telefono-oggi.webp', storico:S_+'telefono-anni50.webp', corridoio:S_+'telefono-corridoio.webp' },
  finale:     { trionfo:S_+'finale-trionfo.webp', dignita:S_+'finale-dignita.webp', caduta:S_+'finale-caduta.webp', oblio:S_+'finale-oblio.webp' },
  soglia:     { contemporanea:S_+'soglia-presente.webp', italia1950:S_+'soglia-1950.webp' },
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
   (dossier, proposta, budget, ministro, rimpasto, premier, stampa) restano senza scena.
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
