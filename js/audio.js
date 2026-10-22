/* ================================================================================================================
   L95-3 · IL MOTORE AUDIO — un contesto, un modulo, una funzione: `suona(nome)`.

   CARICA FILE, e regge anche senza: un file che manca è silenzio, non un errore. Il motore carica SOLO i file
   elencati in `AUDIO_PRESENTI` (su GitHub Pages un 404 è una riga rossa), e la lista la tiene allineata alla
   cartella `.claude/verifica-asset.js`. I file li genera `.claude/genera-audio.js` (L95-3a).

   PAVIMENTI (DESIGN-MOVIMENTO, principi 5-6):
   · l'AudioContext nasce AL PRIMO GESTO, mai al boot (iOS: senza gesto resta sospeso, e Chrome scrive un avviso);
   · niente autoplay, niente <audio> nel markup, niente coda di suoni in ritardo: un file non ancora pronto è silenzio;
   · `suona()` è SEMPRE sicura: senza contesto, senza file, ad audio spento, fuori manifesto → non fa nulla e non lancia;
   · UN SUONO PER NOME PER FRAME. `render()` può girare tre volte nello stesso task (L95-1): una decisione che rende
     tre volte non deve fare tre click;
   · la scelta acceso/spento vive in localStorage (`hos_audio`), MAI in S: è del dispositivo, non della carriera.

   ⚠ Tutto quello che sta qui è transitorio: il contesto, i buffer, i loop in corso, il registro. Nulla entra in S.
   ================================================================================================================ */

/* ── 1 · IL MANIFESTO: quarantasei nomi — i quattordici di DESIGN-MOVIMENTO, i dodici rimasti del secondo giro (L116-1; `scheda` uscito in L118-1) e i venti del terzo (L118-1, file in arrivo) — e che cosa ne fa il motore ── */
/* I file: dal L114-2 tredici sono gli MP3 di ElevenLabs (stereo, 44,1 kHz); `tocco` è stato il WAV generato da
   `.claude/genera-audio.js` (L95-3a: mono, 22.050 Hz, picco −3 dBFS) fino al L218-1 (10/10), quando è arrivato il clic di ElevenLabs. Quando Giacomo
   sostituirà un file con un campione CC0 cambia UNA riga qui (e AUDIO_PRESENTI), non il motore: `file:` porta
   l'estensione, .wav o .mp3.
   ⚠ I GAIN SONO BILANCIATI SUL VOLUME MISURATO, non a occhio: a picco uguale i quattordici file differiscono di
   8 dB di RMS (snodo e finale −13, esito −21). Ogni gain porta il suo file verso −19 dB RMS (× 0,6 il valore base),
   e i due loop stanno un altro 40% sotto, perché sono un letto e non un evento. È un bilanciamento di RMS: le note
   gravi (snodo, 110 Hz) all'orecchio suonano più piano di quel che il numero dice — va ritoccato ascoltando. */
/* ⚑ L114-2 (26/9) · I FILE VERI DI ELEVENLABS al posto di tredici sintetici. Resta sintetico `tocco` (il file nuovo è quasi
   muto: picco −52,6 dBFS, RMS −74 — inservibile, lo rigenera Giacomo). `finale` (73 KB) entra con l'eccezione di peso di
   `urne`/`aula` (decisione di Cowork, 26/9 sera: 3 s, suona una volta per carriera). I GAIN RIFATTI con la stessa regola di L95-3a, sul volume misurato dei file nuovi (decodificati in Chrome,
   .claude/musica-prova/rms.html): gain = 0,6 × 10^((−19 − RMS)/20), i loop × 0,6, e un TETTO nuovo perché il picco dopo il gain
   non passi −1 dBFS (serviva a `mappa`: la formula dava 9,6). ⚠ Quattro file nuovi sono molto più bassi degli altri (mappa −43,
   snodo −42, soglia −41, mese −37 dB RMS) e prendono gain da 4,8 a 8,4: va ascoltato, un gain alto alza anche il fruscio. */
const AUDIO_MANIFEST = {
  tocco:    { file:'tocco.mp3',    loop:false, gain:1.16 },   // L218-1 (10/10, ElevenLabs, 0,5 s): RMS −27, picco −2,3 → tetto del picco (la regola dava 1,51); il sintetico tocco.wav (gain 0,68, rendeva −23,6) è in DA-CANCELLARE/
  carta:    { file:'carta.mp3',    loop:false, gain:0.64 },   // RMS −19,5
  chip:     { file:'chip.mp3',     loop:false, gain:1.43 },   // RMS −27, tetto del picco
  mese:     { file:'mese.mp3',     loop:false, gain:0.93 },   // L218-2 (10/10, ElevenLabs, 1,0 s): RMS −22,8, picco −5,8 → regola di sopra (il vecchio era −37, gain 4,77: in scarti/mese-v1.mp3)
  giornale: { file:'giornale.mp3', loop:false, gain:0.87 },   // L218-3 (10/10, ElevenLabs, 1,1 s): RMS −23,5, picco +0,2 decodificato in Chrome → tetto del picco (la regola dava 1,01), rende −24,7 (il vecchio era −31,5, gain 2,53: in scarti/giornale-v1.mp3)
  mappa:    { file:'mappa.mp3',    loop:false, gain:1.51 },   // L218-2 (10/10, 0,8 s): RMS −27,5, picco −4,6 → tetto del picco (la regola dava 1,60; il vecchio era −43,1, gain 7,33)
  urne:     { file:'urne.mp3',     loop:true,  gain:0.49 },   // RMS −21,7, loop
  esito:    { file:'esito.mp3',    loop:false, gain:0.46 },   // RMS −16,6
  esito_no: { file:'esito_no.mp3', loop:false, gain:1.12 },   // RMS −24,4
  snodo:    { file:'snodo.mp3',    loop:false, gain:0.44 },   // L218-2 (10/10, 2,0 s): RMS −16,4, picco −0,2 → regola di sopra (il vecchio era −41,9, gain 8,38)
  soglia:   { file:'soglia.mp3',   loop:false, gain:1.02 },   // L218-2 (10/10, 2,0 s): RMS −23,6, picco −6,4 → regola di sopra (il vecchio era −41,3, gain 7,82)
  finale:   { file:'finale.mp3',   loop:false, gain:0.65 },   // RMS −19,7 · 73 KB: l'eccezione di peso di urne/aula (L114-2, Cowork 26/9)
  telefono: { file:'telefono.mp3', loop:false, gain:1.39 },   // RMS −26,3
  aula:     { file:'aula.mp3',     loop:true,  gain:0.29 },   // RMS −17,1, loop
  /* ⚑ L116-1 (26/9) · IL SECONDO GIRO, tredici effetti di ElevenLabs (PROMPT-AUDIO-ELEVENLABS § «Secondo giro»). Gain con la
     regola di sopra, sul volume misurato in Chrome (`.claude/musica-prova/rms-cdp.js`): 0,6 × 10^((−19 − RMS)/20), tetto del
     picco a −1 dBFS. Due eccezioni DICHIARATE: (1) LA FOLLA (applauso, folla, fischi, protesta) sta a −28 dB invece di −23,4, cioè
     sotto la musica di campagna (mus-campagna rende −25,2: −15,3 × 0,32), come vuole L116-1; `protesta` è un loop e prende
     anche il × 0,6 dei letti. ⚑ L118-1 (27/9): `scheda` (il cassetto) è USCITO — a Giacomo non piaceva; al suo posto `pagina`, qui sotto. */
  positivo: { file:'positivo.mp3', loop:false, gain:1.03 },   // RMS −23,7
  negativo: { file:'negativo.mp3', loop:false, gain:1.12 },   // L218-2 (10/10, 0,8 s): RMS −24,4, picco −9,5 → regola di sopra (il vecchio era −35,3, gain 3,43)
  firma:    { file:'firma.mp3',    loop:false, gain:0.80 },   // L218-2 (10/10, 1,2 s): RMS −21,5, picco +0,4 decodificato in Chrome → regola di sopra (tetto 0,85; il vecchio era −26,2, gain 0,89)
  monete:   { file:'monete.mp3',   loop:false, gain:0.85 },   // RMS −22
  applauso: { file:'applauso.mp3', loop:false, gain:0.44 },   // RMS −20,9 · folla: −28
  folla:    { file:'folla.mp3',    loop:false, gain:0.69 },   // L218-3 (10/10, ElevenLabs, 3,0 s): RMS −24,8, picco −8,4 · folla: −28 (il vecchio era −14,3, gain 0,21: in scarti/folla-v1.mp3)
  protesta: { file:'protesta.mp3', loop:true,  gain:0.19 },   // RMS −18,2 · folla: −28, e loop × 0,6
  fischi:   { file:'fischi.mp3',   loop:false, gain:0.73 },   // L218-3 (10/10, ElevenLabs, 2,0 s): RMS −25,3, picco −8,2 · folla: −28 (il vecchio era −10,9 saturo, gain 0,14: in scarti/fischi-v1.mp3)
  flash:    { file:'flash.mp3',    loop:false, gain:1.13 },   // RMS −28,2, tetto del picco
  bussare:  { file:'bussare.mp3',  loop:false, gain:0.50 },   // RMS −17,4
  macchina: { file:'macchina.mp3', loop:false, gain:1.24 },   // RMS −29, tetto del picco
  allarme:  { file:'allarme.mp3',  loop:false, gain:0.37 },   // L218-2 (10/10, 1,5 s): RMS −14,8, picco 0 → regola di sopra (il vecchio era −38,3, gain 5,54; l'alternativa trattenuta allarme-r1 resta in giro-suoni/, la sceglie Giacomo all'ascolto)
  /* ⚑ L118-1 (27/9) · IL TERZO GIRO, venti nomi (PROMPT-AUDIO-ELEVENLABS § «Terzo giro»). Col file, dal 27/9: `pagina`, `martelletto`, `passi` (L130-1); dal 28/9 (L137-1)
     campanella, porta, bicchieri, stretta, sussurro, radio, telex (le prime versioni di Lyria erano state scartate da Cowork: questi sono ElevenLabs e due ritagli). Gli altri NON ci sono ancora: è una lista-promessa,
     come la musica di L114-1. Gli agganci sono già al loro posto (nel punto dove si decide, `suonoCarta` per le carte che entrano), e
     finché un file manca il nome è silenzio SENZA consumare un posto del gesto (vedi `suona`). ⚠ Il gain qui è il valore base 0,6:
     quando arriva il file si rifà con la regola di sopra (0,6 × 10^((−19 − RMS)/20), tetto del picco a −1 dBFS) e si aggiunge ad AUDIO_PRESENTI. */
  pagina:      { file:'pagina.mp3',      loop:false, gain:0.42 },  // il cassetto che si apre (al posto di `scheda`) · L218-3 (10/10, ElevenLabs, 0,6 s): RMS −22, picco 0 → regola di sopra × 0,5 (6 dB sotto: gesto frequente, come era `scheda`), rende −29,5 (il vecchio di Gemini, −17,7 e gain 0,26, è in scarti/pagina-v1.mp3)
  martelletto: { file:'martelletto.mp3', loop:false, gain:1.01 },  // la legge approvata · ARRIVATO il 27/9 (L130-1, ritaglio Lyria di Cowork, 2,2 s): RMS −23,5, picco −1,4 → regola di sopra (a 0,6 rendeva −27,9, 4,5 dB sotto i vicini)
  campanella:  { file:'campanella.mp3',  loop:false, gain:0.90 },  // si apre una seduta, un dibattito · ARRIVATO il 28/9 (L137-1, ElevenLabs, 3 s): RMS −22,5, picco −2,2 → regola di sopra
  stretta:     { file:'stretta.mp3',     loop:false, gain:1.06 },  // un accordo, una maggioranza ricostruita · L137-1 (0,9 s): RMS −26,5, picco −1,5 → tetto del picco (la regola dava 1,42)
  bicchieri:   { file:'bicchieri.mp3',   loop:false, gain:0.94 },  // un accordo festeggiato · L137-1 (1,1 s): RMS −22,9, picco −1,9 → regola di sopra
  passi:       { file:'passi.mp3',       loop:false, gain:1.05 },  // un ministero che si apre, una visita · L218-3 (10/10, ElevenLabs, 3,0 s): RMS −24,3, picco −1,4 → tetto del picco (la regola dava 1,10), rende −23,9 come `bussare`, che sostituisce (il vecchio di L130-1, −19,8 saturo e gain 0,66, è in scarti/passi-v1.mp3)
  porta:       { file:'porta.mp3',       loop:false, gain:1.00 },  // il retroscena (i beat `rb_`) · L137-1 (1,2 s): RMS −23,4, picco −1,5 → regola di sopra
  sussurro:    { file:'sussurro.mp3',    loop:false, gain:1.08 },  // fuori verbale, indiscrezioni · L137-1 (1,9 s): RMS −26,2, picco −1,7 → tetto del picco (la regola dava 1,37)
  radio:       { file:'radio.mp3',       loop:false, gain:0.92 },  // l'estero e le crisi internazionali, FINO AL 1989 · L137-1 (ritaglio Lyria, 2,5 s): RMS −22,7, picco −1,4 → regola di sopra
  telex:       { file:'telex.mp3',       loop:false, gain:0.62 },  // dispacci e diplomazia, FINO AL 1989 · L218-3 (10/10, ElevenLabs, 2,4 s): RMS −19,3, picco −0,9 → regola di sopra (tetto 0,99), rende −23,5 (il ritaglio Lyria di L137-1, −15,4 e gain 0,40, è in scarti/telex-v1.mp3)
  notifica:    { file:'notifica.mp3',    loop:false, gain:0.91 },  // DAL 2000: al posto di `giornale` · L218-1 (10/10, ElevenLabs, 1,5 s): RMS −24,4, picco −0,2 → tetto del picco (la regola dava 1,12)
  vibrazione:  { file:'vibrazione.mp3',  loop:false, gain:1.92 },  // DAL 2000: al posto di `telefono` · L218-2 (10/10, ElevenLabs «r1», 2,0 s): RMS −29,1, picco −22,4 → regola di sopra (tetto 11,7)
  borsa:       { file:'borsa.mp3',       loop:false, gain:0.64 },  // mercati, spread · L141-1 (28/9, ritaglio Lyria di Cowork, 3,0 s): RMS −19,6, picco −1,4 → regola di sopra
  sirena:      { file:'sirena.mp3',      loop:false, gain:0.59 },  // ordine pubblico (mai una tragedia) · L218-1 (10/10, 4,0 s): RMS −18,9, picco −0,4 → regola di sopra (tetto 0,93)
  ambulanza:   { file:'ambulanza.mp3',   loop:false, gain:0.35 },  // sanità (mai una tragedia) · L141-1 (4,0 s): RMS −14,4, picco −1,4 → regola di sopra
  cantiere:    { file:'cantiere.mp3',    loop:false, gain:0.55 },  // infrastrutture, grandi opere · L218-1 (10/10, 3,0 s): RMS −18,3, picco +0,7 decodificato in Chrome → regola di sopra (tetto 0,82)
  treno:       { file:'treno.mp3',       loop:false, gain:0.91 },  // trasporti · L218-1 (10/10, 4,0 s): RMS −23,6, picco −0,2 → tetto del picco (la regola dava 1,02)
  orologio:    { file:'orologio.mp3',    loop:false, gain:0.84 },  // scadenza, ultimatum, la fiducia che si vota · L141-1 (3,2 s, quattro colpi): RMS −21,9, picco −0,2 → regola di sopra (il tetto del picco è 0,91)
  fanfara:     { file:'fanfara.mp3',     loop:false, gain:0.33 },  // l'insediamento, la vittoria larga · L218-3 (10/10, ElevenLabs, 4,0 s, scelta da Giacomo): RMS −13,7, picco 0 → regola di sopra (tetto 0,89), rende −23,3 (il vecchio di L141-1, −13,9 e gain 0,33, è in scarti/fanfara-v1.mp3)
  campane:     { file:'campane.mp3',     loop:false, gain:0.41 },  // la festa nazionale · L141-1 (4,0 s): RMS −15,6, picco −1,5 → regola di sopra
  /* ⚑ L218-8 (11/10) · GLI EFFETTI E2 DEI FORMATI NUOVI (PROPOSTA-AUDIO.md §E2, giro suoni 8, ElevenLabs). ⚠ SENZA AGGANCIO: i formati
     viaggio sulla mappa, negoziato e discorso (DESIGN-FORMATI.md) non esistono ancora nel gioco, quindi nessun `suona()` li chiama;
     file, gain e lista sono pronti per quando nasceranno (il gain si rifà solo se cambia il file). Misure in Chrome:
     `.claude/misura-l218-8-e2.js`; il giro 9 (L218-9: viaggio-auto e negoziato-fogli rifatti, discorso-leggio) `.claude/misura-l218-9.js`. */
  'viaggio-aereo':      { file:'viaggio-aereo.mp3',      loop:false, gain:0.43 },  // viaggio: il volo · 3,0 s: RMS −16,0, picco +0,1 → regola di sopra (tetto 0,89)
  'viaggio-auto':       { file:'viaggio-auto.mp3',       loop:false, gain:1.09 },  // viaggio: l'auto ufficiale · L218-9 (giro 9, rifatto) 3,0 s: RMS −24,2, picco −2,4 → regola di sopra (tetto 1,17; quello del giro 8, −28,5, è in giro-suoni/prove/viaggio-auto-giro8.mp3)
  'viaggio-elicottero': { file:'viaggio-elicottero.mp3', loop:false, gain:0.56 },  // viaggio: l'elicottero · 3,0 s: RMS −18,4, picco −6,7 → regola di sopra
  'negoziato-penna':    { file:'negoziato-penna.mp3',    loop:false, gain:0.93 },  // negoziato: la proposta sul tavolo · 1,2 s: RMS −31,4, picco −0,3 → tetto del picco (la regola dava 2,51)
  'negoziato-sedie':    { file:'negoziato-sedie.mp3',    loop:false, gain:0.71 },  // negoziato: l'apertura · 2,0 s: RMS −20,5, picco 0 → regola di sopra (tetto 0,89)
  'negoziato-porta':    { file:'negoziato-porta.mp3',    loop:false, gain:1.28 },  // negoziato: porte chiuse · 1,5 s: RMS −25,6, picco −5,0 → regola di sopra
  'negoziato-fogli':    { file:'negoziato-fogli.mp3',    loop:false, gain:1.10 },  // negoziato: la controproposta · L218-9 (giro 9, rifatto) 1,5 s: RMS −24,7, picco −1,8 → tetto del picco (la regola dava 1,16; quello del giro 8, −30,0, è in giro-suoni/prove/negoziato-fogli-giro8.mp3)
  'discorso-microfono': { file:'discorso-microfono.mp3', loop:false, gain:0.84 },  // discorso: l'inizio · 1,5 s: RMS −21,9, picco −0,5 → regola di sopra
  'discorso-eco':       { file:'discorso-eco.mp3',       loop:false, gain:0.82 },  // discorso: la pausa, la sala vuota · 2,5 s: RMS −21,7, picco −0,3 → regola di sopra
  'discorso-leggio':    { file:'discorso-leggio.mp3',    loop:false, gain:1.58 },  // discorso: si prende la parola (E2j) · L218-9 (giro 9) 1,5 s: RMS −27,4, picco −10,3 → regola di sopra (tetto 2,93): il «+6 dB» della consegna sta nel gain, non nel file (niente ffmpeg; rende come gli altri, picco reso −6,3)
  /* ⚑ L218-13 (12/10) · F5, I MOMENTI MUTI (PROPOSTA-AUDIO.md §F5, giro suoni 13, ElevenLabs). Gain con la regola di sopra sul volume
     misurato in Chrome (`.claude/musica-prova/rms-cdp.js`), tetto del picco −1 dBFS. Agganci: timbro → `chiudiBilancio` (il bilancio
     dell'anno); calcolatrice → la manovra che entra (`SUONO_CARTA`, specie `budget`); consenso-su/-giu e sondaggio → `forseSondaggio`
     (uno solo: la direzione se il sondaggio si è mosso di almeno un margine dal consecutivo di prima, altrimenti `sondaggio`); nomina →
     `rimpastoEntra` e la scelta del ministro nuovo (carta `rimpasto`); banchi → `goOpposizione` dopo una sconfitta dal governo;
     votazione → la questione di fiducia votata; dimissioni → «Chiedi le dimissioni» nello scandalo e `condannaLieve`; traguardo → una
     promessa di campagna mantenuta (`resaPromesseCampagna`, nel mese nuovo); salva → `uiSlotSave` riuscito; scorri → il bottone ≡ del
     pannello Partita (i cassetti hanno già `pagina`). Nei gesti di una scelta il nuovo è il SECONDO suono, dopo `tocco`: `suonoEsito`
     resta oltre il tetto (AUDIO_TETTO_GESTO), cioè il nuovo suona AL POSTO dell'esito. ⚠ `no` (azione non disponibile): file e gain,
     NESSUN aggancio — i bottoni non disponibili del gioco sono `disabled` e il tocco su di loro non arriva a nessun gestore; resta
     muto per decisione di Giacomo del 12/10 (L229-1): non si aggiunge un ascoltatore. */
  timbro:          { file:'timbro.mp3',          loop:false, gain:0.89 },  // F5a · 0,8 s: RMS −25,1, picco 0 → tetto del picco (la regola dava 1,21)
  calcolatrice:    { file:'calcolatrice.mp3',    loop:false, gain:0.80 },  // F5b · 1,5 s: RMS −21,5, picco +0,9 decodificato in Chrome → regola di sopra (tetto 0,80)
  'consenso-su':   { file:'consenso-su.mp3',     loop:false, gain:0.93 },  // F5c · 0,8 s: RMS −22,8, picco −2,0 → regola di sopra
  'consenso-giu':  { file:'consenso-giu.mp3',    loop:false, gain:0.82 },  // F5d · 0,8 s: RMS −21,7, picco −6,2 → regola di sopra
  nomina:          { file:'nomina.mp3',          loop:false, gain:0.75 },  // F5e · 1,5 s: RMS −20,9, picco +0,1 → regola di sopra (tetto 0,88)
  banchi:          { file:'banchi.mp3',          loop:false, gain:0.93 },  // F5f · 2,0 s: RMS −24,5, picco −0,4 → tetto del picco (la regola dava 1,13)
  votazione:       { file:'votazione.mp3',       loop:false, gain:1.14 },  // F5g · 1,5 s: RMS −24,6, picco −6,7 → regola di sopra
  dimissioni:      { file:'dimissioni.mp3',      loop:false, gain:0.83 },  // F5i · 1,5 s: RMS −21,8, picco −3,0 → regola di sopra
  traguardo:       { file:'traguardo.mp3',       loop:false, gain:1.21 },  // F5j · 1,2 s: RMS −25,1, picco −3,5 → regola di sopra (tetto 1,33)
  salva:           { file:'salva.mp3',           loop:false, gain:0.76 },  // F5k · 0,6 s · L218-15 (12/10): rifatto (cartella di cuoio che si chiude), RMS −21,0, picco −1,4 → regola 0,76 (il primo, −33,2, stava al tetto 1,88 e restava basso)
  scorri:          { file:'scorri.mp3',          loop:false, gain:0.71 },  // F5l · 0,5 s: RMS −20,5, picco −2,9 → regola di sopra
  no:              { file:'no.mp3',              loop:false, gain:1.00 },  // F5m · 0,5 s: RMS −23,4, picco −3,1 → regola di sopra · senza aggancio
  sondaggio:       { file:'sondaggio.mp3',       loop:false, gain:0.67 },  // F5o · 1,2 s: RMS −19,9, picco −6,3 → regola di sopra
  /* ⚑ L218-14 (12/10, giro suoni 14) · gli ultimi due di §F5. brusio → la carta-scandalo che entra (riga di `SUONO_CARTA` per specie,
     PRIMA di `sussurro`: lo scandalo del ministro suonava `sussurro`, ora `brusio` al suo posto; `sussurro` resta ai testi d'indiscrezione);
     rotativa → la prima pagina «edizione straordinaria»: il titolo del mese che è un EVENTO fuori calendario (`pri:1` senza `serie`:
     inchiesta, scandalo, legge, voto locale; ~5% dei titoli nel banco), al posto di giornale/notifica — `suonoTitolo()` qui sotto. */
  brusio:          { file:'brusio.mp3',          loop:false, gain:0.27 },  // F5h · 2,0 s: RMS −12,1, picco +0,1 → regola di sopra (tetto 0,88)
  rotativa:        { file:'rotativa.mp3',        loop:false, gain:0.86 },  // F5n · 2,0 s: RMS −22,1, picco −0,5 → regola di sopra (tetto 0,94)
  /* ⚑ L245-5 (20/10) · LA GUERRA SUL TAVOLO (L218-17, giro suoni 17: ElevenLabs, 192 kbps così come sono). Gain con la regola di sopra
     (0,6 × 10^((−19 − RMS)/20), tetto del picco −1 dBFS) sulle misure del giro suoni. Agganci: mappa-segno → un segno sul territorio
     nato in questo mese che compare sul tavolo (fissoEntra, ui.js; anche crisi e cantiere); colonna → la dichiarazione di guerra
     (guerraDichiara); nave → la dichiarazione, se la riga di RIVALI non è `confine`; sirena-aerea → un'area che diventa `colpita`
     (crisiMese, una volta per passaggio). */
  'mappa-segno':   { file:'mappa-segno.mp3',     loop:false, gain:0.91 },  // 0,65 s: RMS −24,3, picco −0,2 → tetto del picco (la regola dava 1,10)
  colonna:         { file:'colonna.mp3',         loop:false, gain:0.39 },  // 3,0 s: RMS −15,3, picco 0,0 → regola di sopra (abbassato)
  nave:            { file:'nave.mp3',            loop:false, gain:0.20 },  // 3,0 s: RMS −9,5, picco 0,0 → regola di sopra (≈ −14 dB: molto forte)
  'sirena-aerea':  { file:'sirena-aerea.mp3',    loop:false, gain:0.35 },  // 4,0 s: RMS −14,3, picco −0,2 → regola di sopra (abbassato)
  /* ⚑ L245-7 (22/10) · L'ATTACCO (L218-17, giro suoni 17: ElevenLabs, così come sono). Gain con la regola di sopra sulle misure del giro
     suoni. Agganci: campane-lutto → la carta d'attacco grave che entra (suonoCarta, `attacco:'grave'`; la leggera suona `allarme`);
     candele → la risposta «unità nazionale» (attaccoRisposta, game.js). */
  'campane-lutto': { file:'campane-lutto.mp3',   loop:false, gain:1.10 },  // 4,0 s: RMS −24,3, picco −4,0 → regola di sopra (picco reso −3,2)
  candele:         { file:'candele.mp3',         loop:false, gain:0.84 }   // 3,0 s: RMS −21,9, picco −5,5 → regola di sopra
};
/* ⚠ I FILE CHE ESISTONO DAVVERO in assets/audio/. Il motore carica SOLO questi: un nome del manifesto che non è
   qui non genera nessuna richiesta di rete. Si aggiorna a mano quando un file cambia, e se la lista e la cartella
   divergono `.claude/verifica-asset.js` diventa rossa. Dal 13/9 i quattordici di L95-3a; dal 26/9 (L114-2) dodici sono MP3 di ElevenLabs;
   dal 26/9 sera (L116-1) i tredici del secondo giro, tutti MP3 di ElevenLabs. L118-1 (27/9): `scheda.mp3` esce; i venti del terzo giro
   entrano qui uno per uno, quando arriva il file. */
const AUDIO_PRESENTI = ['tocco.mp3','carta.mp3','chip.mp3','mese.mp3','giornale.mp3','mappa.mp3','urne.mp3',
                        'esito.mp3','esito_no.mp3','snodo.mp3','soglia.mp3','finale.mp3','telefono.mp3','aula.mp3',   // L114-2
                        'pagina.mp3',   // L118-1: il primo del terzo giro (27/9 08:19)
                        'martelletto.mp3','passi.mp3',   // L130-1 (27/9 sera)
                        'campanella.mp3','porta.mp3','bicchieri.mp3','stretta.mp3','sussurro.mp3','radio.mp3','telex.mp3',   // L137-1 (28/9)
                        'borsa.mp3','ambulanza.mp3','orologio.mp3','fanfara.mp3','campane.mp3',   // L141-1 (28/9 sera)
                        'notifica.mp3','sirena.mp3','cantiere.mp3','treno.mp3',   // L218-1 (10/10, giro suoni 1; e tocco.mp3 al posto di tocco.wav in testa)
                        'viaggio-aereo.mp3','viaggio-auto.mp3','viaggio-elicottero.mp3','negoziato-penna.mp3','negoziato-sedie.mp3',
                        'negoziato-porta.mp3','negoziato-fogli.mp3','discorso-microfono.mp3','discorso-eco.mp3',   // L218-8 (11/10, E2: senza aggancio, formati da fare)
                        'discorso-leggio.mp3',   // L218-9 (11/10, giro 9: E2j, senza aggancio come gli altri E2)
                        'vibrazione.mp3',   // L218-2 (10/10, giro suoni 2; mappa, snodo, soglia, mese, negativo, firma, allarme cambiano solo il file)
                        'positivo.mp3','negativo.mp3','firma.mp3','monete.mp3','applauso.mp3','folla.mp3',
                        'protesta.mp3','fischi.mp3','flash.mp3','bussare.mp3','macchina.mp3','allarme.mp3',          // L116-1
                        'timbro.mp3','calcolatrice.mp3','consenso-su.mp3','consenso-giu.mp3','nomina.mp3','banchi.mp3','votazione.mp3',
                        'dimissioni.mp3','traguardo.mp3','salva.mp3','scorri.mp3','no.mp3','sondaggio.mp3',   // L218-13 (12/10, giro suoni 13: F5)
                        'brusio.mp3','rotativa.mp3',   // L218-14 (12/10, giro suoni 14: F5h, F5n — §F5 completa)
                        'mappa-segno.mp3','colonna.mp3','nave.mp3','sirena-aerea.mp3',   // L245-5 (20/10: la guerra sul tavolo, file di L218-17)
                        'campane-lutto.mp3','candele.mp3'];   // L245-7 (22/10: l'attacco, file di L218-17)

/* ── 6 · NIENTE SINTETICO A RUNTIME ────────────────────────────────────────────────────────────────────────
   Il motore carica FILE. I suoni li genera `.claude/genera-audio.js` una volta, fuori dal gioco (L95-3a); la prima
   stesura di questo modulo aveva un oscillatore di ripiego per ogni nome, tolto quando i file sono arrivati:
   un file mancante ora è SILENZIO, che è il comportamento che il gioco deve avere quando un campione sparisce. */

const AUDIO_CHIAVE = 'hos_audio', AUDIO_MASTER = 0.5, AUDIO_FADE_MS = 300, AUDIO_TETTO_GESTO = 2;   // L116-1: due effetti per gesto
let AUDIO_CTX = null, AUDIO_MASTER_GAIN = null, AUDIO_BUF = {}, AUDIO_LOOP = {}, AUDIO_QUESTO_FRAME = {}, AUDIO_FRAME_ARMATO = false;
let AUDIO_CONTESTI_CREATI = 0;       // la misura dello sblocco: deve restare 0 fino al primo gesto
let AUDIO_REGISTRO = [];             // {nome, t, esito} — lo legge sonda-movimento.js; transitorio, mai in S

function audioAcceso(){
  let v=null; try{ v=(typeof lsGet==='function')?lsGet(AUDIO_CHIAVE):localStorage.getItem(AUDIO_CHIAVE); }catch(e){ v=null; }
  return v!=='spento';               // default: acceso
}
/* ================================================================================================================
   L118-1 · I VOLUMI E «SILENZIA TUTTO» — tre cursori (effetti, musica, ambiente) e un interruttore sopra, nel menu Partita.
   · Il valore vive in localStorage (`hos_vol_effetti`, `hos_vol_musica`, `hos_vol_ambiente`, 0-100, default 100; `hos_muto`),
     MAI in S: è del dispositivo, come l'interruttore dell'audio.
   · Il cursore MOLTIPLICA il gain del manifesto, non lo sostituisce: ogni strato ha un suo nodo-bus (AUDIO_BUS) fra le voci e il
     master, e il cursore cambia il gain del bus — quindi anche MENTRE SUONA (musica e ambiente seguono il cursore in tempo reale).
   · Il cursore a 0 equivale a spento: lo strato non suona e non carica (`audioStratoVivo`).
   · «Silenzia tutto» SOSPENDE le scelte senza cancellarle: con `hos_muto` acceso tace tutto, e spegnendolo ognuno dei tre torna
     com'era (acceso o spento, al suo volume). Per questo il menu mostra le scelte (`audioAcceso`, `musicaPreferita`,
     `ambientePreferito`), mentre il motore legge le versioni vive (`audioVivo`, `musicaAccesa`, `ambienteAcceso`).
   ================================================================================================================ */
const AUDIO_VOL_CHIAVI = { effetti:'hos_vol_effetti', musica:'hos_vol_musica', ambiente:'hos_vol_ambiente' }, AUDIO_MUTO_CHIAVE = 'hos_muto';
let AUDIO_BUS = {};                  // {effetti, musica, ambiente}: i GainNode dei tre strati, nati con il contesto
function audioLeggi(k){ try{ return (typeof lsGet==='function')?lsGet(k):localStorage.getItem(k); }catch(e){ return null; } }
function audioScrivi(k, v){ try{ if(typeof lsSet==='function') lsSet(k, v); else localStorage.setItem(k, v); }catch(e){} }
function audioVolume(strato){
  const v=parseInt(audioLeggi(AUDIO_VOL_CHIAVI[strato]), 10);
  return isNaN(v) ? 100 : Math.max(0, Math.min(100, v));
}
function audioMuto(){ return audioLeggi(AUDIO_MUTO_CHIAVE)==='1'; }
function audioVivo(){ return audioAcceso() && !audioMuto(); }          // l'audio che suona davvero: scelto acceso e non silenziato
function audioStratoVivo(strato){ return audioVivo() && audioVolume(strato)>0; }
/* il gain del bus segue il cursore; `subito` per la nascita del contesto, altrimenti una rampa breve (niente click) */
function audioBusAggiorna(strato, subito){
  const B=AUDIO_BUS[strato]; if(!B || !AUDIO_CTX) return;
  const v=audioVolume(strato)/100, t=AUDIO_CTX.currentTime;
  try{ if(subito){ B.gain.value=v; } else { B.gain.cancelScheduledValues(t); B.gain.setValueAtTime(B.gain.value, t); B.gain.linearRampToValueAtTime(v, t+0.05); } }catch(e){}
}
/* ⚑ IL CURSORE: `prova` al rilascio (un effetto di prova sul cursore degli effetti). Non ridisegna il menu (il cursore morirebbe
   sotto il dito): passa da 0 a più di 0, e viceversa, accendendo o spegnendo lo strato. */
function setVolume(strato, v, prova){
  if(!AUDIO_VOL_CHIAVI[strato]) return;
  v=Math.max(0, Math.min(100, Math.round(+v||0)));
  const prima=audioVolume(strato);
  audioScrivi(AUDIO_VOL_CHIAVI[strato], String(v));
  audioBusAggiorna(strato);
  const et=document.getElementById('vol-'+strato+'-v'); if(et) et.textContent=v+'%';
  if(strato==='effetti'){ if(v===0) taciTutto(); if(prova && v>0) suona('chip'); }
  else if(strato==='musica'){ if(v===0) musicaFerma(); else if(prima===0 || !MUSICA_VOCE) musica(); }
  else if(strato==='ambiente'){ if(v===0) ambienteFerma(); else if(prima===0 || !AMBIENTE_VOCE) ambiente(); }
}
function setMuto(on){
  audioScrivi(AUDIO_MUTO_CHIAVE, on?'1':'0');
  if(on){ taciTutto(); musicaFerma(); ambienteFerma(); }
  else { musica(); ambiente(); }
  if(typeof ridisegnaAudio==='function') ridisegnaAudio();   // L120-1: il pannello aperto (menu Partita o «Suono» della home)
}
function setAudio(stato){
  if(stato!=='acceso' && stato!=='spento') return;
  try{ if(typeof lsSet==='function') lsSet(AUDIO_CHIAVE, stato); else localStorage.setItem(AUDIO_CHIAVE, stato); }catch(e){}
  if(stato==='spento'){ taciTutto(); if(typeof musicaFerma==='function') musicaFerma(); if(typeof ambienteFerma==='function') ambienteFerma(); }
  else { if(typeof musica==='function') musica(); if(typeof ambiente==='function') ambiente(); }   // L114-1/L116-2: riaccendendo l'audio tornano musica e ambiente (se accesi)
  if(typeof ridisegnaAudio==='function') ridisegnaAudio();   // L120-1: il pannello aperto (menu Partita o «Suono» della home)
}
function audioSegna(nome, esito){
  AUDIO_REGISTRO.push({ nome:nome, t:(typeof performance!=='undefined'?Math.round(performance.now()):0), esito:esito });
  if(AUDIO_REGISTRO.length>2000) AUDIO_REGISTRO.splice(0, AUDIO_REGISTRO.length-2000);
}

/* ── 2 · LO SBLOCCO: il contesto nasce al primo gesto ──────────────────────────────────────────────────────── */
function audioSblocca(){
  try{
    document.removeEventListener('pointerdown', audioSblocca, true);
    document.removeEventListener('touchend', audioSblocca, true);
  }catch(e){}
  if(AUDIO_CTX) return;
  const C=(typeof window!=='undefined') && (window.AudioContext || window.webkitAudioContext);
  if(!C) return;
  try{
    AUDIO_CTX=new C(); AUDIO_CONTESTI_CREATI++;
    AUDIO_MASTER_GAIN=AUDIO_CTX.createGain(); AUDIO_MASTER_GAIN.gain.value=AUDIO_MASTER;
    AUDIO_MASTER_GAIN.connect(AUDIO_CTX.destination);
    ['effetti','musica','ambiente'].forEach(function(k){ AUDIO_BUS[k]=AUDIO_CTX.createGain(); AUDIO_BUS[k].connect(AUDIO_MASTER_GAIN); audioBusAggiorna(k, true); });   // L118-1
    if(AUDIO_CTX.state==='suspended') AUDIO_CTX.resume();
  }catch(e){ AUDIO_CTX=null; return; }
  audioCaricaPresenti();
  try{ if(typeof musica==='function') musica(); }catch(e){}   // L114-1: la musica parte al primo gesto
  try{ if(typeof ambiente==='function') ambiente(); }catch(e){}   // L116-2: e l'ambiente
}
function audioCaricaPresenti(){
  /* DOPO lo sblocco, in ordine di manifesto, solo i file che ci sono. Finché un buffer non è pronto quel nome è
     silenzio: nessuna coda, nessun suono che arriva in ritardo a scena finita. */
  Object.keys(AUDIO_MANIFEST).forEach(function(nome){
    const M=AUDIO_MANIFEST[nome];
    if(AUDIO_PRESENTI.indexOf(M.file)<0) return;
    try{
      fetch('assets/audio/'+M.file).then(function(r){ return r.ok ? r.arrayBuffer() : null; })
        .then(function(ab){ if(!ab || !AUDIO_CTX) return null; return new Promise(function(ok, ko){ AUDIO_CTX.decodeAudioData(ab, ok, ko); }); })
        .then(function(buf){ if(buf) AUDIO_BUF[nome]=buf; })
        .catch(function(){});
    }catch(e){}
  });
}
try{
  document.addEventListener('pointerdown', audioSblocca, {capture:true, once:true, passive:true});
  document.addEventListener('touchend',    audioSblocca, {capture:true, once:true, passive:true});
  document.addEventListener('visibilitychange', function(){
    try{ if(!document.hidden && AUDIO_CTX && AUDIO_CTX.state==='suspended') AUDIO_CTX.resume(); }catch(e){}
  });
}catch(e){}

/* ── 3 · L'INTERFACCIA ─────────────────────────────────────────────────────────────────────────────────────── */
function suona(nome){
  try{
    const M=AUDIO_MANIFEST[nome];
    if(!M){ audioSegna(nome,'fuori manifesto'); return; }
    if(!audioAcceso()){ audioSegna(nome,'spento'); return; }
    if(audioMuto()){ audioSegna(nome,'silenziato'); return; }                       // L118-1
    if(audioVolume('effetti')===0){ audioSegna(nome,'volume a zero'); return; }        // L118-1: il cursore a 0 è spento
    /* L118-1 · un nome SENZA FILE (la lista-promessa del terzo giro) è silenzio e NON consuma un posto del gesto: altrimenti un
       aggancio nuovo senza file zittirebbe il suono vero che viene dopo di lui nello stesso gesto. */
    if(AUDIO_PRESENTI.indexOf(M.file)<0){ audioSegna(nome,'file assente'); return; }
    if(AUDIO_QUESTO_FRAME[nome]){ audioSegna(nome,'doppione nel frame'); return; }
    /* L116-1 · AL PIÙ DUE EFFETTI NELLO STESSO GESTO: il terzo si perde, non si accoda. Il gesto è il frame (lo stesso
       registro del «un suono per nome»): chi chiama per primo passa, quindi i punti che decidono chiamano in ordine d'importanza. */
    if(Object.keys(AUDIO_QUESTO_FRAME).length>=AUDIO_TETTO_GESTO){ audioSegna(nome,'oltre il tetto del gesto'); return; }
    AUDIO_QUESTO_FRAME[nome]=1;
    if(!AUDIO_FRAME_ARMATO){ AUDIO_FRAME_ARMATO=true;
      requestAnimationFrame(function(){ AUDIO_QUESTO_FRAME={}; AUDIO_FRAME_ARMATO=false; }); }
    if(!AUDIO_CTX){ audioSegna(nome,'nessun contesto (prima del primo gesto)'); return; }
    if(M.loop && AUDIO_LOOP[nome]){ audioSegna(nome,'loop gia in corso'); return; }
    if(AUDIO_BUF[nome]){ audioSuonaBuffer(nome, M); audioSegna(nome,'suonato'); return; }
    audioSegna(nome, 'file non ancora pronto');
  }catch(e){}
}
function taci(nome){
  try{
    const L=AUDIO_LOOP[nome]; if(!L || !AUDIO_CTX) return;
    const t=AUDIO_CTX.currentTime;
    L.g.gain.cancelScheduledValues(t); L.g.gain.setValueAtTime(L.g.gain.value, t);
    L.g.gain.linearRampToValueAtTime(0, t+AUDIO_FADE_MS/1000);
    try{ L.src.stop(t+AUDIO_FADE_MS/1000+0.02); }catch(e){}
    delete AUDIO_LOOP[nome];
    audioSegna(nome,'taciuto');
  }catch(e){}
}
function taciTutto(){ Object.keys(AUDIO_LOOP).forEach(taci); }

/* ── 4 · L116-1 · CHE COSA SUONA, deciso in due funzioni PURE (non scrivono S, non suonano: dicono un nome; il banco le legge) ── */
/* IL SECONDO SUONO DI UNA SCELTA (il primo è `tocco`): UNO solo, e al posto di `chip`, mai in più.
   · `firma` se la carta è il bilancio (approvare il bilancio è firmarlo);
   · `positivo` se TUTTE le voci del riepilogo (`it.esiti`, i chip che il giocatore vede) vanno dal verso buono, `negativo` se
     tutte da quello cattivo — il verso buono è «su» per tutto tranne il debito, che è buono quando scende. Una scelta con esiti
     MISTI non suona né l'uno né l'altro (L116-1);
   · altrimenti `monete` se fra gli esiti c'è il debito (la scelta ha mosso soldi), altrimenti `chip` se c'è un riepilogo;
   · niente riepilogo → niente (com'era). */
function suonoEsito(it){
  if(!it) return null;
  if(it.kind==='budget') return 'firma';
  const E=it.esiti||[]; if(!E.length) return null;
  let buoni=0, cattivi=0, soldi=false;
  E.forEach(function(e){ const giu=(e.k==='ind:debt'); if(giu) soldi=true; if((e.d>0)!==giu) buoni++; else cattivi++; });
  if(buoni && !cattivi) return 'positivo';
  if(cattivi && !buoni) return 'negativo';
  return soldi ? 'monete' : 'chip';
}
/* ⚑ L118-1 · CHI HA IL FILE. Un aggancio del terzo giro chiama un nome che oggi non ha file: dove quel nome PRENDE IL POSTO di un
   suono che c'è (`vibrazione` al posto di `telefono`, `passi` al posto di `bussare`…) si passa da `suonoPreferito(nuovo, vecchio)`,
   così finché il file nuovo manca suona il vecchio — nessun gesto diventa muto per un file che non è ancora arrivato.
   `AUDIO_CONTA_ASSENTI` è SOLO per il banco (`.claude/misura-suoni-terzo.js`): conta i nomi del terzo giro come se il file ci fosse. */
let AUDIO_CONTA_ASSENTI = false;
function audioHaFile(nome){ const M=AUDIO_MANIFEST[nome]; return !!M && (AUDIO_CONTA_ASSENTI || AUDIO_PRESENTI.indexOf(M.file)>=0); }
function suonoPreferito(nome, ripiego){ return audioHaFile(nome) ? nome : ripiego; }
/* L'EPOCA DEL SUONO (L118-1): `vibrazione` e `notifica` al posto di `telefono`/`giornale` DAL 2000; `radio` e `telex` FINO AL 1989. */
function audioAnno(){ return (typeof S!=='undefined' && S && S.year) ? S.year : 2026; }
function suonoTelefono(){ return audioAnno()>=2000 ? suonoPreferito('vibrazione','telefono') : 'telefono'; }
function suonoGiornale(){ return audioAnno()>=2000 ? suonoPreferito('notifica','giornale') : 'giornale'; }
/* L218-14 · il suono della PRIMA PAGINA del mese (`generaTitolo`): l'«edizione straordinaria» — un titolo-evento fuori calendario,
   `pri:1` senza `serie` (le serie manovra e voto sono il calendario) — suona la rotativa, gli altri giornale/notifica come prima. */
function suonoTitolo(t){ return (t && t.pri===1 && !t.serie) ? suonoPreferito('rotativa', suonoGiornale()) : suonoGiornale(); }

/* IL SUONO DI UNA CARTA CHE ENTRA, oltre a `carta`/`snodo` (il secondo del gesto): dalla SPECIE della carta (`kind`) o da
   KICKER E TITOLO, con la tabella qui sotto, la prima riga che risponde. MAI su un pilastro-cronaca (`cronaca:true`, che è muto
   del tutto) e MAI su una tragedia (`tono:'grave'`). Le parole sono radici scritte a mano, lette sul testo SORGENTE (italiano).
   ⚑ L118-1 · il terzo giro: righe nuove, con un quarto campo facoltativo — `id` (una regola sull'id della carta: i beat del
   retroscena sono `rb_…`), `prima` (l'anno sotto cui la riga vale: `radio`, `telex`), `dal` (l'anno da cui vale: `notifica`) e, dal L142-1, `noKind` (i tipi di carta
   che la riga salta: `campane` non suona per la vita privata, `personale`).
   Una riga il cui nome NON HA FILE si salta (`audioHaFile`): la carta suona come prima finché il file non arriva. Le righe nuove
   stanno PRIMA di quelle vecchie che coprono lo stesso tema (`borsa` prima di `allarme` sui mercati), così quando il file arriva
   il suono specifico vince sul generico — e prima delle righe per SPECIE (`macchina` prende tutti i dossier: `cantiere` e `treno`
   dopo di lei non uscivano mai, misurato). */
const SUONO_CARTA = [
  ['orologio', [],                            /scadenz|ultimatum|questione di fiducia|voto di fiducia|conto alla rovescia/i],
  ['porta',    [],                            /^$/, { id:/^rb_/ }],
  ['brusio',   ['scandalo'],                  /^$/],   // L218-14 (F5h): lo scandalo del ministro che esplode — PRIMA di `sussurro`, che lo prendeva per specie e ora resta ai testi d'indiscrezione
  ['sussurro', ['scandalo'],                  /fuori verbale|indiscrezion|confidenz|sussurr|soffiat|veleni/i],   // lo scandalo sussurra (prima era `flash`, che resta per la stampa)
  ['protesta', [],                            /sciopero|scioperi|ordine pubblico|corteo|cortei|manifestaz|protest|occupaz|piazza|picchett/i],
  ['sirena',   [],                            /polizia|criminalit|mafi[ao]|camorr|ndrangheta|rapin|carabinier|sequestr/i],
  ['fischi',   [],                            /contestaz|fischi|dissiden|ribell|rivolta/i],
  ['ambulanza',[],                            /sanit|ospedal|epidemi|pandemi|vaccin|medici/i],
  ['borsa',    [],                            /borsa|spread|rating|investitor|i mercati|mercati finanziari|titoli di stato/i],
  ['cantiere', [],                            /infrastruttur|grandi opere|cantier|ricostruzion|appalt|ediliz/i],   // senza «autostrad»: prendeva le gite della domenica
  ['treno',    [],                            /ferrovi|treni|trasport|alta velocit|pendolar/i],
  ['radio',    ['crisiInt'],                  /estero|internazional|guerra fredda|notizie da/i, { prima:1990 }],
  ['telex',    [],                            /dispacc|diplomaz|ambasciat|vertice|trattat|cancellerie/i, { prima:1990 }],
  ['notifica', ['stampa'],                    /social(?![a-z])|online|virale|sul web/i, { dal:2000 }],   // «social» col confine: senza, prendeva «Conflitto sociale» (L118-1, lezione 202)
  ['flash',    ['stampa','scandalo'],         /stampa|comunicazione|televisione|scandalo|intervista|giornal|conferenza/i],
  ['campanella',[],                           /question time|dibattito|seduta|interpellanz|in aula|mozione/i],   // L140-1: PRIMA di `macchina` — un dossier che parla di un dibattito in aula suona la campanella (dopo `macchina` non usciva mai)
  ['calcolatrice',['budget'],                 /^$/],   // L218-13 (F5b): la manovra che entra — prima di `macchina`, che la prendeva per «conti pubblici»
  ['macchina', ['dossier','inchiesta'],       /dossier|rapporto|inchiesta|indagine|toghe|giustizia|procura|conti pubblici/i],
  ['allarme',  ['crisiInt'],                  /crisi|emergenz|allarme|calamit|attentat|terror|i mercati|default/i],
  ['passi',    [],                            /visita|sopralluogo/i],   // senza «corridoi»: prendeva il kicker «Corridoio» (il treno veloce)
  ['bussare',  ['ministro','rimpasto','premier'], /udienza|visita|colloquio|palazzo|istituzioni|quirinale|eliseo/i],
  ['stretta',  [],                            /accordo|intesa|patto|alleanz/i],
  ['bicchieri',[],                            /brindisi|festegg|celebra/i],
  ['campane',  [],                            /festa nazionale|anniversari|liberazione|giubileo|14 luglio|bastiglia/i, { noKind:['personale'] }],   // L142-1: le campane sono della piazza, non di casa — «L'anniversario» della vita privata non le suona (la radice `anniversari` resta: serve alle feste nazionali)
  ['folla',    [],                            /campagna elettorale|comizio/i]
];
function suonoCarta(item){
  if(!item) return null;
  const d=item.data||{};
  if(d.attacco) return d.attacco==='grave' ? (audioHaFile('campane-lutto') ? 'campane-lutto' : null) : (audioHaFile('allarme') ? 'allarme' : null);   // L245-7: la carta d'attacco
  if(d.cronaca===true || d.tono==='grave') return null;
  const testo=String(d.kick||'')+' · '+String(d.t||''), anno=audioAnno();
  for(let i=0;i<SUONO_CARTA.length;i++){ const R=SUONO_CARTA[i], O=R[3]||{};
    if(!audioHaFile(R[0])) continue;                                   // L118-1: niente file, niente riga
    if(O.prima && anno>=O.prima) continue;
    if(O.dal && anno<O.dal) continue;
    if(O.noKind && O.noKind.indexOf(item.kind)>=0) continue;          // L142-1: una riga può escludere un tipo di carta (campane: non la vita privata)
    if(R[1].indexOf(item.kind)>=0 || R[2].test(testo) || (O.id && O.id.test(String(d.id||'')))) return R[0]; }
  return null;
}

function audioSuonaBuffer(nome, M){
  const src=AUDIO_CTX.createBufferSource(); src.buffer=AUDIO_BUF[nome]; src.loop=!!M.loop;
  const g=AUDIO_CTX.createGain(); g.gain.value=M.gain;
  src.connect(g); g.connect(AUDIO_BUS.effetti||AUDIO_MASTER_GAIN); src.start();   // L118-1: sul bus degli effetti (il cursore)
  if(M.loop) AUDIO_LOOP[nome]={src:src, g:g};
}

/* ================================================================================================================
   L114-1 · LA MUSICA — nello stesso modulo degli effetti (paletto: l'audio è un modulo solo), con un interruttore suo.

   UNDICI BRANI (DESIGN-TAVOLO § «Video e musica»): un tema per epoca e quattro di momento. L118-1: più le VARIANTI dei temi (`-b`,
   alternate a ogni giro: oggi `mus-1970-b`) e il TEMA DEL GIOCO fuori partita (`mus-tema`, lista-promessa). Il motore è nato con ZERO file (L114-1) e
   si accende da solo quando arrivano: si carica SOLO ciò che è in `MUSICA_PRESENTI`, che `.claude/verifica-asset.js` tiene
   allineata alla cartella (la stessa degli effetti, `assets/audio/`, come vuole L114-2). Un brano che manca è silenzio.
   L'INTERFACCIA per il gioco è una: `musica(stato)`. Senza argomento sceglie il brano dallo stato (`musicaScelta()`), e la
   chiama `render()` a ogni resa: è idempotente, agisce solo sul cambio. Con 'finale' la chiama `gameOver` sui motivi di
   `FINALI_CON_SUONO`. Sempre sicura, come `suona()`: senza contesto, senza file, a musica spenta non fa nulla e non lancia.
   QUALE BRANO, in quest'ordine:
     0. fuori partita (home, creazione, scenari storici: `fuoriPartita()`) → mus-tema (L118-1; dentro una partita non vale mai);
     1. 'finale'  — forzato da gameOver (non in loop), vale finché S è la stessa carriera; dal L218-9 mus-finale o mus-finale-b, a caso
                    (dal L218-22 anche mus-finale-c: una delle tre);
     2. la notte elettorale (NOTTE non nullo)                          → mus-notte (dal L218-9 alterna con mus-notte-b a ogni giro;
                                                                         dal L218-22 A → B → C, come tutti i temi con la -c);
     3. la crisi: al governo, livello 3, con l'allarme insolvenza acceso (`S.mesiSottoCrisi>0`) oppure in minoranza fuori
        dalla coabitazione (`S.minoranza && !S.coabitazione`)          → mus-crisi   (proposta di Code, L114-1);
     4. la campagna (`inCampagna()`, gli ultimi sei mesi del mandato)   → mus-campagna;
     5. l'epoca, dall'anno: fino al 1959 mus-1950 … 2000-2013 mus-2000; il presente (lo scenario 'presente', o dal 2014 una
        linea storica saldata al presente)                              → mus-presente.
        ⚑ L218-22: in Italia, USA, Regno Unito, Francia e Germania la A del decennio è la traccia del paese (`musicaAPaese()`).
   E UN VOLUME: a zero finché in agenda c'è un pilastro-tragedia non risolto (`cronaca:true` e `tono:'grave'`, G8), poi torna.
   COMPORTAMENTO: dissolvenza incrociata di 2,5 s al cambio; volume sotto gli effetti (MUSICA_GAIN); pausa col secondo piano
   (il contesto si sospende quando la pagina si nasconde, riprende quando torna); si carica solo il brano che serve, e al più
   quello della campagna due mesi prima che cominci.
   ⚠ Tutto qui è transitorio: nulla entra in S. La scelta accesa/spenta vive in localStorage (`hos_musica`).
   ================================================================================================================ */
/* L114-2 · il GAIN PER BRANO, sul volume misurato (RMS dei file di ElevenLabs, tutti e undici): gain = MUSICA_GAIN × 10^((−16 − RMS)/20),
   cioè un brano da −16 dB RMS suona a 0,35 e gli altri gli si allineano (con lo stesso tetto del picco a −1 dBFS degli effetti). */
const MUSICA_MANIFEST = {
  'mus-1950':     { file:'mus-1950.mp3',     loop:true,  gain:0.40 },   // RMS −17,1
  'mus-1960':     { file:'mus-1960.mp3',     loop:true,  gain:0.30 },   // −14,6
  'mus-1970':     { file:'mus-1970.mp3',     loop:true,  gain:0.29 },   // −14,5
  'mus-1980':     { file:'mus-1980.mp3',     loop:true,  gain:0.28 },   // −14,1
  'mus-1990':     { file:'mus-1990.mp3',     loop:true,  gain:0.35 },   // −16,1
  'mus-2000':     { file:'mus-2000.mp3',     loop:true,  gain:0.28 },   // −14,2
  'mus-presente': { file:'mus-presente.mp3', loop:true,  gain:0.44 },   // −17,9
  'mus-crisi':    { file:'mus-crisi.mp3',    loop:true,  gain:0.55 },   // −19,9
  'mus-campagna': { file:'mus-campagna.mp3', loop:true,  gain:0.32 },   // −15,3
  'mus-notte':    { file:'mus-notte.mp3',    loop:true,  gain:0.42 },   // −17,6
  'mus-finale':   { file:'mus-finale.mp3',   loop:false, gain:0.71 },   // −22,2
  /* ⚑ L118-1 (27/9) · LE VARIANTI DEI TEMI: un tema d'epoca può avere una variante `-b` (campo `variante:` = il tema di cui è l'altra
     metà). `musicaScelta()` resta il punto unico e, quando la variante ha il file, ALTERNA A e B a ogni giro del brano (il brano
     non è più in loop: al giro successivo passa all'altro con la dissolvenza di sempre, mai lo stesso due volte di fila). */
  'mus-1970-b':   { file:'mus-1970-b.mp3',   loop:true,  gain:0.30, variante:'mus-1970' },   // −14,7 · Gemini, 2:57, 128 kbps (ricodificato da Cowork)
  /* ⚑ L122-1 (27/9) · le altre otto varianti (Gemini/Lyria, ~3 min, 128 kbps ricodificati da Cowork), tutte a −14,7 dB RMS misurati →
     gain 0,30 come `mus-1970-b`. Anche crisi e campagna alternano: musicaScelta passa da musicaGiroVariante anche per loro. */
  'mus-1950-b':     { file:'mus-1950-b.mp3',     loop:true, gain:0.30, variante:'mus-1950' },       // −14,7 · 3:01
  'mus-1960-b':     { file:'mus-1960-b.mp3',     loop:true, gain:0.30, variante:'mus-1960' },       // −14,7 · 2:59
  'mus-1980-b':     { file:'mus-1980-b.mp3',     loop:true, gain:0.30, variante:'mus-1980' },       // −14,7 · 2:59
  'mus-1990-b':     { file:'mus-1990-b.mp3',     loop:true, gain:0.30, variante:'mus-1990' },       // −14,7 · 2:57
  'mus-2000-b':     { file:'mus-2000-b.mp3',     loop:true, gain:0.30, variante:'mus-2000' },       // −14,7 · 3:02
  'mus-presente-b': { file:'mus-presente-b.mp3', loop:true, gain:0.30, variante:'mus-presente' },   // −14,7 · 3:02
  'mus-crisi-b':    { file:'mus-crisi-b.mp3',    loop:true, gain:0.30, variante:'mus-crisi' },      // −14,7 · 3:02
  'mus-campagna-b': { file:'mus-campagna-b.mp3', loop:true, gain:0.30, variante:'mus-campagna' },   // −14,7 · 2:59
  /* ⚑ L218-9 (11/10) · LE VARIANTI DI NOTTE E FINALE (Eleven Music v2.5, 1:00, 192 kbps come i due brani A: niente ffmpeg per i
     128). Gain sullo stesso volume reso degli altri brani (−25,2 dB: −14,7 × 0,30, −17,6 × 0,42, −22,2 × 0,71). La notte alterna
     a ogni giro come i temi; il finale NON è in loop e non alterna: `musica('finale')` sceglie una delle due e quella suona una
     volta (`musicaParti` alterna solo i temi in loop). Misure in Chrome: `.claude/misura-l218-9.js`. */
  'mus-notte-b':    { file:'mus-notte-b.mp3',    loop:true,  gain:0.58, variante:'mus-notte' },     // −20,4, picco −1,8 · 1:00
  'mus-finale-b':   { file:'mus-finale-b.mp3',   loop:false, gain:0.52, variante:'mus-finale' },    // −19,5, picco −0,4 (reso −6,1) · 1:00
  /* ⚑ L118-1 · IL TEMA DEL GIOCO, fuori partita (home, scelta del paese e del partito, scenari storici). Lista-promessa: il file
     arriva da Gemini (`arte-sorgente/audio-elevenlabs/mus-tema.mp3`); L122-1: arrivato, −14,7 dB RMS misurati, 3:00. */
  'mus-tema':     { file:'mus-tema.mp3',     loop:true,  gain:0.30 },
  /* ⚑ L218-16 (12/10) · LA VARIANTE DEL TEMA (Eleven Music v2.5, 2:00, 192 kbps così com'è: niente ffmpeg per i 128, 2,9 MB sotto il
     tetto dei 3). Gain sul volume reso degli altri brani (−25,2 dB): −17,9 RMS, picco −0,4 → 0,43 (picco reso −7,7). Fuori partita il
     tema alterna con lei a ogni giro, come i temi d'epoca. Misure in Chrome: `.claude/misura-l218-16.js`. */
  'mus-tema-b':   { file:'mus-tema-b.mp3',   loop:true,  gain:0.43, variante:'mus-tema' },   // −17,9, picco −0,4 · 2:00
  /* ⚑ L218-22 (15/10) · LE TERZE VARIANTI `-c` (§G3, Eleven Music v2.5, ~2:00, 192 kbps così come sono: niente ffmpeg per i 128).
     Come le `-b`: `variante:` = il tema, in loop, e `musicaVarianti()` le prende da sole → la rotazione è A → B → C a ogni giro; il
     finale non è in loop e `musica('finale')` sceglie fra tre dall'orologio. Gain sul volume reso degli altri brani (−25,2 dB), picco
     reso ≤ −1 dBFS (regola di L218-9). Misure in Chrome: `.claude/misura-l218-22.js` (RMS, picco del file · durata). */
  'mus-1950-c':       { file:'mus-1950-c.mp3',     loop:true,  gain:0.34, variante:'mus-1950' },      // −15,8, picco −0,3 · 2:00
  'mus-1960-c':       { file:'mus-1960-c.mp3',     loop:true,  gain:0.28, variante:'mus-1960' },      // −14,3, picco −0,2 · 2:00
  'mus-1970-c':       { file:'mus-1970-c.mp3',     loop:true,  gain:0.24, variante:'mus-1970' },      // −12,7, picco 0,0 · 2:00
  'mus-1980-c':       { file:'mus-1980-c.mp3',     loop:true,  gain:0.24, variante:'mus-1980' },      // −13,0, picco 0,0 · 2:00
  'mus-1990-c':       { file:'mus-1990-c.mp3',     loop:true,  gain:0.33, variante:'mus-1990' },      // −15,5, picco −0,3 · 2:00
  'mus-2000-c':       { file:'mus-2000-c.mp3',     loop:true,  gain:0.29, variante:'mus-2000' },      // −14,4, picco −0,2 · 1:52
  'mus-presente-c':   { file:'mus-presente-c.mp3', loop:true,  gain:0.53, variante:'mus-presente' },  // −19,6, picco −0,8 · 2:00
  'mus-campagna-c':   { file:'mus-campagna-c.mp3', loop:true,  gain:0.31, variante:'mus-campagna' },  // −15,0, picco −0,1 · 2:00
  'mus-crisi-c':      { file:'mus-crisi-c.mp3',    loop:true,  gain:0.35, variante:'mus-crisi' },     // −16,1, picco −0,7 · 2:00
  'mus-notte-c':      { file:'mus-notte-c.mp3',    loop:true,  gain:0.45, variante:'mus-notte' },     // −18,3, picco −1,0 · 2:00
  'mus-finale-c':     { file:'mus-finale-c.mp3',   loop:false, gain:0.40, variante:'mus-finale' },    // −17,3, picco −1,0 · 2:00
  /* ⚑ L218-22 · LE MUSICHE DEL PAESE (§G2, 35 brani: it us uk fr de × sei decenni e il presente; 192 kbps così come sono). Campo `paese:`
     (la sigla di `musicaPaese()`) e `decennio:` (il tema generico che sostituiscono). Nella partita di uno dei cinque paesi la traccia del
     paese PRENDE IL POSTO DELLA A nella rotazione del suo decennio (giro 0 → `mus-<p>-<d>`, giro 1 → `-b`, giro 2 → `-c`): lo fa un punto
     solo, `musicaAPaese()`, dentro `musicaVarianti()`; se il file non è in MUSICA_PRESENTI resta la A generica. Gli altri paesi suonano la
     generica. Gain come sopra (−25,2 dB resi, picco reso ≤ −1). */
  'mus-it-1950':       { file:'mus-it-1950.mp3',     loop:true, gain:0.49, paese:'it', decennio:'mus-1950' },     // −18,9, picco −1,5 · 2:00
  'mus-it-1960':       { file:'mus-it-1960.mp3',     loop:true, gain:0.28, paese:'it', decennio:'mus-1960' },     // −14,2, picco −0,1 · 2:00
  'mus-it-1970':       { file:'mus-it-1970.mp3',     loop:true, gain:0.31, paese:'it', decennio:'mus-1970' },     // −14,9, picco −0,3 · 2:00
  'mus-it-1980':       { file:'mus-it-1980.mp3',     loop:true, gain:0.28, paese:'it', decennio:'mus-1980' },     // −14,2, picco −0,2 · 2:00
  'mus-it-1990':       { file:'mus-it-1990.mp3',     loop:true, gain:0.42, paese:'it', decennio:'mus-1990' },     // −17,6, picco −0,7 · 2:00
  'mus-it-2000':       { file:'mus-it-2000.mp3',     loop:true, gain:0.33, paese:'it', decennio:'mus-2000' },     // −15,5, picco 0,0 · 2:00
  'mus-it-presente':   { file:'mus-it-presente.mp3', loop:true, gain:0.36, paese:'it', decennio:'mus-presente' }, // −16,4, picco −1,0 · 1:50
  'mus-us-1950':       { file:'mus-us-1950.mp3',     loop:true, gain:0.47, paese:'us', decennio:'mus-1950' },     // −18,7, picco −0,9 · 2:00
  'mus-us-1960':       { file:'mus-us-1960.mp3',     loop:true, gain:0.35, paese:'us', decennio:'mus-1960' },     // −16,1, picco −0,5 · 2:00
  'mus-us-1970':       { file:'mus-us-1970.mp3',     loop:true, gain:0.29, paese:'us', decennio:'mus-1970' },     // −14,4, picco 0,0 · 1:50
  'mus-us-1980':       { file:'mus-us-1980.mp3',     loop:true, gain:0.25, paese:'us', decennio:'mus-1980' },     // −13,3, picco −0,1 · 2:00
  'mus-us-1990':       { file:'mus-us-1990.mp3',     loop:true, gain:0.34, paese:'us', decennio:'mus-1990' },     // −15,9, picco −0,8 · 2:00
  'mus-us-2000':       { file:'mus-us-2000.mp3',     loop:true, gain:0.31, paese:'us', decennio:'mus-2000' },     // −15,0, picco −0,1 · 2:00
  'mus-us-presente':   { file:'mus-us-presente.mp3', loop:true, gain:0.34, paese:'us', decennio:'mus-presente' }, // −15,8, picco −0,1 · 2:00
  'mus-uk-1950':       { file:'mus-uk-1950.mp3',     loop:true, gain:0.55, paese:'uk', decennio:'mus-1950' },     // −20,0, picco −0,5 · 2:00
  'mus-uk-1960':       { file:'mus-uk-1960.mp3',     loop:true, gain:0.29, paese:'uk', decennio:'mus-1960' },     // −14,5, picco −0,3 · 2:00
  'mus-uk-1970':       { file:'mus-uk-1970.mp3',     loop:true, gain:0.31, paese:'uk', decennio:'mus-1970' },     // −15,0, picco −0,3 · 1:50
  'mus-uk-1980':       { file:'mus-uk-1980.mp3',     loop:true, gain:0.27, paese:'uk', decennio:'mus-1980' },     // −13,8, picco 0,0 · 2:00
  'mus-uk-1990':       { file:'mus-uk-1990.mp3',     loop:true, gain:0.45, paese:'uk', decennio:'mus-1990' },     // −18,3, picco −1,0 · 1:55
  'mus-uk-2000':       { file:'mus-uk-2000.mp3',     loop:true, gain:0.34, paese:'uk', decennio:'mus-2000' },     // −15,8, picco −0,4 · 2:00
  'mus-uk-presente':   { file:'mus-uk-presente.mp3', loop:true, gain:0.50, paese:'uk', decennio:'mus-presente' }, // −19,1, picco −1,1 · 2:00
  'mus-fr-1950':       { file:'mus-fr-1950.mp3',     loop:true, gain:0.46, paese:'fr', decennio:'mus-1950' },     // −18,5, picco −0,9 · 2:00
  'mus-fr-1960':       { file:'mus-fr-1960.mp3',     loop:true, gain:0.33, paese:'fr', decennio:'mus-1960' },     // −15,6, picco −1,1 · 1:56
  'mus-fr-1970':       { file:'mus-fr-1970.mp3',     loop:true, gain:0.28, paese:'fr', decennio:'mus-1970' },     // −14,1, picco −0,1 · 2:00
  'mus-fr-1980':       { file:'mus-fr-1980.mp3',     loop:true, gain:0.32, paese:'fr', decennio:'mus-1980' },     // −15,4, picco −0,3 · 1:55
  'mus-fr-1990':       { file:'mus-fr-1990.mp3',     loop:true, gain:0.30, paese:'fr', decennio:'mus-1990' },     // −14,9, picco −0,4 · 2:00
  'mus-fr-2000':       { file:'mus-fr-2000.mp3',     loop:true, gain:0.34, paese:'fr', decennio:'mus-2000' },     // −15,8, picco −0,4 · 2:00
  'mus-fr-presente':   { file:'mus-fr-presente.mp3', loop:true, gain:0.32, paese:'fr', decennio:'mus-presente' }, // −15,3, picco −1,1 · 2:00
  'mus-de-1950':       { file:'mus-de-1950.mp3',     loop:true, gain:0.43, paese:'de', decennio:'mus-1950' },     // −17,8, picco −0,7 · 2:00
  'mus-de-1960':       { file:'mus-de-1960.mp3',     loop:true, gain:0.35, paese:'de', decennio:'mus-1960' },     // −16,0, picco −0,2 · 2:00
  'mus-de-1970':       { file:'mus-de-1970.mp3',     loop:true, gain:0.44, paese:'de', decennio:'mus-1970' },     // −18,1, picco −0,8 · 2:00
  'mus-de-1980':       { file:'mus-de-1980.mp3',     loop:true, gain:0.30, paese:'de', decennio:'mus-1980' },     // −14,7, picco −0,2 · 2:00
  'mus-de-1990':       { file:'mus-de-1990.mp3',     loop:true, gain:0.35, paese:'de', decennio:'mus-1990' },     // −16,0, picco −0,1 · 2:00
  'mus-de-2000':       { file:'mus-de-2000.mp3',     loop:true, gain:0.29, paese:'de', decennio:'mus-2000' },     // −14,5, picco −0,3 · 2:00
  'mus-de-presente':   { file:'mus-de-presente.mp3', loop:true, gain:0.57, paese:'de', decennio:'mus-presente' }, // −20,3, picco −1,2 · 2:00
  /* ⚑ L245-5 (20/10) · LA MUSICA DELLA GUERRA (L218-17 e L218-28: Eleven Music v2.5, 192 kbps così come sono, tutti sotto i 3 MB). Gain sul
     volume reso degli altri brani (−25,2 dB: regola di L218-9), picco reso ≤ −1 dBFS. La sceglie musicaGuerra(), letta per prima in
     musicaScelta: tensione e guerra alternano A/B a ogni giro come le altre `-b`. */
  'mus-tensione':     { file:'mus-tensione.mp3',    loop:true,  gain:0.51 },                              // −19,4, picco −0,8 · 1:50
  'mus-tensione-b':   { file:'mus-tensione-b.mp3',  loop:true,  gain:0.42, variante:'mus-tensione' },     // −17,6, picco −0,7 · 2:00
  'mus-guerra':       { file:'mus-guerra.mp3',      loop:true,  gain:0.42 },                              // −17,6, picco −1,1 · 2:00
  'mus-guerra-b':     { file:'mus-guerra-b.mp3',    loop:true,  gain:0.51, variante:'mus-guerra' },       // −19,4, picco −0,4 · 2:00
  'mus-armistizio':   { file:'mus-armistizio.mp3',  loop:true,  gain:0.45 },                              // −18,3, picco −0,4 · 1:30
  'mus-dopoguerra':   { file:'mus-dopoguerra.mp3',  loop:true,  gain:0.47 },                              // −18,7, picco −1,1 · 1:30
  'mus-lutto':        { file:'mus-lutto.mp3',       loop:true,  gain:0.97 }                               // L245-7: −24,9, picco −7,2 · 1:30 (stessa regola: picco reso −7,5) — il mese dopo un attacco grave, musicaLutto()
};
/* ⚠ I BRANI CHE ESISTONO DAVVERO in assets/audio/: solo questi si chiedono alla rete. Si aggiorna a mano quando un file arriva;
   se lista e cartella divergono `.claude/verifica-asset.js` diventa rossa. L114-2 (26/9): TUTTI E UNDICI, a 192 kbps così come
   arrivano — i tre da un minuto a 1,46 MB, i sette temi e `mus-crisi` a 2,9 MB (il tetto dei brani è 3 MB: si caricano uno alla
   volta e a richiesta; la ricodifica a 128 kbps è un'ottimizzazione facoltativa per quando ci sarà ffmpeg). */
const MUSICA_PRESENTI = ['mus-1950.mp3','mus-1960.mp3','mus-1970.mp3','mus-1980.mp3','mus-1990.mp3','mus-2000.mp3',
                         'mus-presente.mp3','mus-crisi.mp3','mus-campagna.mp3','mus-notte.mp3','mus-finale.mp3',
                         'mus-1970-b.mp3',    // L118-1: la prima variante (Gemini)
                         'mus-tema.mp3','mus-1950-b.mp3','mus-1960-b.mp3','mus-1980-b.mp3','mus-1990-b.mp3','mus-2000-b.mp3',
                         'mus-presente-b.mp3','mus-crisi-b.mp3','mus-campagna-b.mp3',   // L122-1: il tema e le altre otto varianti
                         'mus-notte-b.mp3','mus-finale-b.mp3',    // L218-9: le varianti di notte e finale
                         'mus-tema-b.mp3',                        // L218-16: la variante del tema della home
                         'mus-1950-c.mp3','mus-1960-c.mp3','mus-1970-c.mp3','mus-1980-c.mp3','mus-1990-c.mp3','mus-2000-c.mp3',
                         'mus-presente-c.mp3','mus-campagna-c.mp3','mus-crisi-c.mp3','mus-notte-c.mp3','mus-finale-c.mp3',   // L218-22: le terze varianti
                         'mus-it-1950.mp3','mus-it-1960.mp3','mus-it-1970.mp3','mus-it-1980.mp3','mus-it-1990.mp3','mus-it-2000.mp3','mus-it-presente.mp3',
                         'mus-us-1950.mp3','mus-us-1960.mp3','mus-us-1970.mp3','mus-us-1980.mp3','mus-us-1990.mp3','mus-us-2000.mp3','mus-us-presente.mp3',
                         'mus-uk-1950.mp3','mus-uk-1960.mp3','mus-uk-1970.mp3','mus-uk-1980.mp3','mus-uk-1990.mp3','mus-uk-2000.mp3','mus-uk-presente.mp3',
                         'mus-fr-1950.mp3','mus-fr-1960.mp3','mus-fr-1970.mp3','mus-fr-1980.mp3','mus-fr-1990.mp3','mus-fr-2000.mp3','mus-fr-presente.mp3',
                         'mus-de-1950.mp3','mus-de-1960.mp3','mus-de-1970.mp3','mus-de-1980.mp3','mus-de-1990.mp3','mus-de-2000.mp3','mus-de-presente.mp3',   // L218-22: le 35 musiche del paese
                         'mus-tensione.mp3','mus-tensione-b.mp3','mus-guerra.mp3','mus-guerra-b.mp3','mus-armistizio.mp3','mus-dopoguerra.mp3',   // L245-5: la guerra
                         'mus-lutto.mp3'];   // L245-7: il lutto dopo un attacco grave
const MUSICA_CHIAVE = 'hos_musica', MUSICA_GAIN = 0.35, MUSICA_XFADE_S = 2.5, MUSICA_DUCK_S = 0.8;
let MUSICA_DIR = 'assets/audio/';     // `let`: la pagina di prova di L114-1 la punta ai segnaposto di .claude/musica-prova/
let MUSICA_BUF = {}, MUSICA_CARICO = {}, MUSICA_ORA = null, MUSICA_VOCE = null, MUSICA_ZITTA = false;
/* L146-1 · SOTTO LA VOCE: mentre parla la voce di una clip di partenza la musica scende a ×0,3 (≈ −10 dB) e poi torna piena.
   Non è un secondo meccanismo: il livello del brano lo decide UN punto solo, `musica()`, fra tre gradini — zero sotto un
   pilastro-tragedia (vince sempre), sotto-voce, pieno — e `musicaParti` parte al gradino in vigore. `MUSICA_SOTTOVOCE` lo
   accende e lo spegne `musicaSottovoce()` (oggi la chiama solo `parla()`, le voci del gioco: ⚑ L246-1, le clip di partenza e della porta hanno il gradino `MUSICA_CLIP_ZITTA`, a zero, qui sotto). Transitorio, mai in S. */
const MUSICA_SOTTOVOCE_K = 0.3;
let MUSICA_SOTTOVOCE = false, MUSICA_LIVELLO = 1;
function musicaSottovoce(on){ on=!!on; if(on===MUSICA_SOTTOVOCE) return; MUSICA_SOTTOVOCE=on; musica(); }
/* L246-1 (15/10) · ZITTA SOTTO LA VOCE DI UNA CLIP. Giacomo, iPhone, porta Italia anni '80: la musica copriva ancora la voce della clip
   anche dopo L231-1 (×0,3 all'apertura del velo; in Chrome la voce stava ~28 dB sopra: la misura di Chrome non dice Safari iOS). Durante
   le clip CON VOCE (partenza L146-1, porta L218-7) la musica non scende: si FERMA — un gradino suo, accanto a MUSICA_SOTTOVOCE e sopra
   di lui (che resta ai `parla()` del gioco: una voce del gioco che finisce a velo aperto non riaccende più la musica, perché spegne il
   suo flag e non questo). Dissolvenza a 0 in MUSICA_CLIP_ZITTA_S, ripresa in MUSICA_CLIP_RIPRESA_S. Lo accende e lo spegne SOLO
   `voceClipDuck()` (ui.js): apertura del velo con almeno una voce (anche sulla strada di ripiego dell'elemento: il gradino non guarda
   come suona la voce), fine dell'ultima voce, chiusura del velo («Salta», tocco, Esc, fine). Un brano che cambia a velo aperto
   (il paese e il decennio si fissano lì) parte già a zero: `musicaParti` legge `musicaGradino()`. Vale solo finché un velo è aperto
   (`veloClipAperto()`): un flag rimasto acceso non può tenere muta la partita. Transitorio, mai in S. Prova `.claude/prova-l246-1-musica-clip.js`. */
const MUSICA_CLIP_ZITTA_S = 0.4, MUSICA_CLIP_RIPRESA_S = 1;
let MUSICA_CLIP_ZITTA = false;
function veloClipAperto(){ try{ return (typeof PARTENZA_APERTA!=='undefined' && !!PARTENZA_APERTA) || (typeof PORTA_CLIP_APERTA!=='undefined' && !!PORTA_CLIP_APERTA); }catch(e){ return false; } }
function musicaClipZitta(on){ on=!!on; if(on===MUSICA_CLIP_ZITTA) return; MUSICA_CLIP_ZITTA=on; musica(); }
/* il gradino in vigore: zero sotto un pilastro-tragedia o sotto la voce di una clip, ×0,3 sotto una voce del gioco, pieno */
function musicaGradino(){ return (musicaTragedia() || musicaAttaccoZitta() || (MUSICA_CLIP_ZITTA && veloClipAperto())) ? 0 : (MUSICA_SOTTOVOCE ? MUSICA_SOTTOVOCE_K : 1); }
let MUSICA_FORZATA = null, MUSICA_FORZATA_S = null;
/* L172-5 · L'ANNO DELLA PORTA SCELTA (richiesta di Giacomo dell'1/10): dalla scelta di una porta sulla linea del tempo (storiciPorta,
   ui.js) all'avvio della partita (fine di avviaRuolo) musicaScelta() dà il tema del decennio della porta invece di mus-tema — sotto le
   clip del paese e del decennio, sulla creazione, sul briefing «La situazione». Transitorio: mai in S né in localStorage; lo azzerano
   apriCreazione (chi entra dal presente), chiudiCreazione (indietro alla home o alla linea del tempo) e initStatoBase (game.js: nasce la partita; da
   lì il tema lo dà musicaEpoca() da S.year, che per l'anno della porta è LO STESSO brano — musica() non vede un cambio e non fa stacchi). */
let MUSICA_PORTA = null, MUSICA_PORTA_PAESE = null;   // L218-22: e la chiave di PAESI della porta (la sua musica del paese)
function musicaPorta(anno, paese){ const a=(anno==null)?null:anno, p=(a==null)?null:(paese||null); if(a===MUSICA_PORTA && p===MUSICA_PORTA_PAESE) return; MUSICA_PORTA=a; MUSICA_PORTA_PAESE=p; musica(); }
let MUSICA_GIRO = {};                 // L118-1: {tema: n} — quanti giri ha fatto il tema; il resto sceglie A o B. Transitorio
let MUSICA_REGISTRO = [];             // {brano, t, esito} — la sequenza dei cambi, per le misure; transitorio

function musicaPreferita(){           // L118-1: la SCELTA (quella che il menu mostra), senza «Silenzia tutto» né cursore
  return audioLeggi(MUSICA_CHIAVE)!=='spenta';
}
function musicaAccesa(){
  if(!audioAcceso()) return false;    // con l'audio spento tace tutto
  return musicaPreferita() && audioStratoVivo('musica');   // L118-1: e tace silenziata o col cursore a zero
}
function setMusica(stato){
  if(stato!=='accesa' && stato!=='spenta') return;
  try{ if(typeof lsSet==='function') lsSet(MUSICA_CHIAVE, stato); else localStorage.setItem(MUSICA_CHIAVE, stato); }catch(e){}
  if(stato==='spenta') musicaFerma(); else musica();
  if(typeof ridisegnaAudio==='function') ridisegnaAudio();   // L120-1: il pannello aperto (menu Partita o «Suono» della home)
}
function musicaSegna(brano, esito){
  MUSICA_REGISTRO.push({ brano:brano, t:(typeof performance!=='undefined'?Math.round(performance.now()):0), esito:esito });
  if(MUSICA_REGISTRO.length>500) MUSICA_REGISTRO.splice(0, MUSICA_REGISTRO.length-500);
}
/* il brano dell'epoca, dall'anno del gioco */
function musicaEpoca(){
  if(typeof S==='undefined' || !S) return null;
  if(!S.scenario || S.scenario==='presente' || S.year>=2014) return 'mus-presente';
  return musicaEpocaAnno(S.year);
}
/* L172-5 · il tema d'epoca di un anno storico: una tabella sola per la partita (musicaEpoca) e per la porta scelta (MUSICA_PORTA) */
function musicaEpocaAnno(y){
  if(y>=2014) return 'mus-presente';
  return y<1960?'mus-1950' : y<1970?'mus-1960' : y<1980?'mus-1970' : y<1990?'mus-1980' : y<2000?'mus-1990' : 'mus-2000';
}
function musicaCrisi(){
  return !!(S && S.livello===3 && !S.opposizione && ((S.mesiSottoCrisi||0)>0 || (S.minoranza && !S.coabitazione)));
}
/* L245-7 · la carta d'attacco grave nell'agenda del mese (risolta o no): la musica a zero per tutto il mese, come sotto un
   pilastro-tragedia — ma letta a parte, perché musicaTragedia spegne anche il giro, le voci e gli ambienti, e la carta d'attacco è una
   decisione (la legge respinta deve poter dire voce-legge-no). Poi musicaLutto(): `mus-lutto` per il solo mese dopo. */
function musicaAttaccoZitta(){
  return !!(S && Array.isArray(S.agenda) && S.agenda.some(function(a){ return a && a.data && a.data.attacco==='grave'; }));
}
function musicaLutto(){
  const A=(typeof S!=='undefined' && S) ? S.attacco : null;
  return (A && A.grave && typeof A.ultimo==='number' && S.year!=null && (S.year*12+S.month)===A.ultimo+1) ? 'mus-lutto' : null;
}
function musicaTragedia(){
  return !!(S && Array.isArray(S.agenda) && S.agenda.some(function(a){ const d=a&&a.data; return a && !a.resolved && d && d.cronaca && d.tono==='grave'; }));
}
/* L118-1 · FUORI PARTITA: la home, la creazione, gli scenari storici. Si legge dallo schermo e non solo da S, perché dopo «Gioca
   di nuovo» S resta quella della carriera finita mentre si è già sulla home. */
function fuoriPartita(){
  if(typeof S==='undefined' || !S) return true;
  if(typeof document==='undefined' || typeof getComputedStyle!=='function') return false;
  return ['start','crea','storici'].some(function(id){ const e=document.getElementById(id); return !!(e && getComputedStyle(e).display!=='none'); });
}
/* ⚑ L218-22 · LA MUSICA DEL PAESE. Punto di verità unico: `musicaPaese()` (puro) dà la sigla dei cinque paesi con le loro tracce o null —
   dalla porta scelta finché c'è (MUSICA_PORTA_PAESE, messo da storiciPorta con SCENARI[id].paese), poi da S.paese (la stessa chiave per
   il presente e per le porte: `italia`, `usa`, `regnounito`, `francia`, `germania`). `musicaAPaese(tema)` dà la traccia del paese al posto
   della A del decennio, se è nel manifesto con quel `decennio` e il file è in MUSICA_PRESENTI; altrimenti il tema stesso (il ripiego). La
   chiama SOLO `musicaVarianti()`, quindi la usano insieme `musicaScelta()` (ramo dell'epoca e ramo della porta, via musicaGiroVariante),
   `musicaParti()` (alternanza e precarico: si carica la traccia del paese, non la generica) e nessun altro tema: notte, crisi, campagna,
   finale e tema del gioco non hanno tracce di paese. Transitorio, niente in S. */
const MUSICA_SIGLA_PAESE = { italia:'it', usa:'us', regnounito:'uk', francia:'fr', germania:'de' };
function musicaPaese(){
  const k=(MUSICA_PORTA!=null) ? MUSICA_PORTA_PAESE : ((typeof S!=='undefined' && S) ? S.paese : null);
  return (k && MUSICA_SIGLA_PAESE[k]) || null;
}
function musicaAPaese(tema){
  const p=musicaPaese(); if(!p || !tema) return tema;
  const k='mus-'+p+'-'+String(tema).replace(/^mus-/,''), M=MUSICA_MANIFEST[k];
  return (M && M.decennio===tema && MUSICA_PRESENTI.indexOf(M.file)>=0) ? k : tema;
}
/* L118-1 · le varianti di un tema che HANNO IL FILE, nell'ordine A, B, C (senza varianti: il tema solo); L218-22: la A è quella del paese */
function musicaVarianti(tema){
  const V=[musicaAPaese(tema)];
  Object.keys(MUSICA_MANIFEST).forEach(function(k){ const M=MUSICA_MANIFEST[k]; if(M.variante===tema && MUSICA_PRESENTI.indexOf(M.file)>=0) V.push(k); });
  return V;
}
function musicaGiroVariante(tema){ const V=musicaVarianti(tema); return V[(MUSICA_GIRO[tema]||0)%V.length]; }
/* il tema di un brano (una variante risponde col suo tema) */
function musicaTema(brano){ const M=MUSICA_MANIFEST[brano]; return (M && (M.variante || M.decennio)) || brano; }   // L218-22: la traccia del paese risponde col suo decennio
/* ⚑ L245-5 · LA MUSICA DELLA GUERRA (puro): in guerra mus-guerra/-b a rotazione, con la trattativa a 2 o più mus-armistizio; una crisi
   al gradino 3-4 senza guerra mus-tensione/-b; nel dopoguerra mus-armistizio i primi sei mesi se l'esito è pace o stallo, poi (e da
   subito per vittoria e sconfitta) mus-dopoguerra; altrimenti null — e musicaScelta va avanti come prima, byte per byte. */
const MUSICA_ARMISTIZIO_MESI = 6;
function musicaGuerra(){
  if(typeof S==='undefined' || !S) return null;
  if(typeof REGOLA_GUERRA!=='undefined' && !REGOLA_GUERRA) return null;
  const c=S.crisi;
  if(c && c.guerra) return (c.guerra.trattativa>=2) ? 'mus-armistizio' : musicaGiroVariante('mus-guerra');
  if(c && c.t>=3 && c.t<=4) return musicaGiroVariante('mus-tensione');
  const d=S.dopoguerra;
  if(d && typeof d.fino==='number' && S.year!=null){
    const dopo=(typeof GUERRA_K!=='undefined' && GUERRA_K.dopo) || 24, mesi=(S.year*12+S.month)-(d.fino-dopo);
    return ((d.esito==='pace' || d.esito==='stallo') && mesi<MUSICA_ARMISTIZIO_MESI) ? 'mus-armistizio' : 'mus-dopoguerra';
  }
  return null;
}
/* ⚑ IL PUNTO DI VERITÀ del brano: puro, legge lo stato e non tocca niente (lo usa anche la misura nel banco) */
function musicaScelta(){
  if(typeof INTRO_APERTA!=='undefined' && INTRO_APERTA) return null;   // L124-1: sotto il video introduttivo la musica tace (è nel video)
  if(MUSICA_PORTA!=null) return musicaGiroVariante(musicaEpocaAnno(MUSICA_PORTA));   // L172-5: dalla porta scelta all'avvio, il tema del suo decennio (con la sua -b); L218-22: e la traccia del suo paese
  if(fuoriPartita()) return musicaGiroVariante('mus-tema');     // L118-1: fuori partita, il tema del gioco (dentro non vale mai); L218-16: con la sua -b
  if(MUSICA_FORZATA && MUSICA_FORZATA_S===S) return MUSICA_FORZATA;
  if(typeof NOTTE!=='undefined' && NOTTE) return musicaGiroVariante('mus-notte');                   // L218-9: anche la notte ha la sua -b
  const mg=musicaGuerra(); if(mg) return mg;
  const ml=musicaLutto(); if(ml) return ml;                                                          // L245-7: il mese dopo un attacco grave, sotto la musica di guerra                                                          // L245-5: guerra, tensione, dopoguerra — L237-5 (passo 0): DOPO la notte, che suona anche in guerra
  if(musicaCrisi()) return musicaGiroVariante('mus-crisi');                                          // L122-1: anche crisi e campagna
  if(typeof inCampagna==='function' && inCampagna()) return musicaGiroVariante('mus-campagna');      // hanno la loro variante
  const ep=musicaEpoca();
  return ep ? musicaGiroVariante(ep) : ep;                       // L118-1: la variante di questo giro, se il tema ne ha una
}
function musicaCarica(brano){
  const M=MUSICA_MANIFEST[brano];
  if(!M || !AUDIO_CTX || MUSICA_BUF[brano] || MUSICA_CARICO[brano]) return;
  if(MUSICA_PRESENTI.indexOf(M.file)<0) return;       // niente file, niente richiesta: zero 404
  /* L114-2 · con risparmio dati o rete lenta i brani (fino a 2,9 MB) non si chiedono: gli effetti sì. Stessa condizione di rete
     delle clip (`reteLeggera()`, ui.js), senza quella del movimento. Letta qui, dove nasce la richiesta: il brano resta silenzio. */
  if(typeof reteLeggera==='function' && reteLeggera()){ musicaSegna(brano, 'risparmio dati (non caricato)'); return; }
  MUSICA_CARICO[brano]=true;
  try{
    fetch(MUSICA_DIR+M.file).then(function(r){ return r.ok ? r.arrayBuffer() : null; })
      .then(function(ab){ if(!ab || !AUDIO_CTX) return null; return new Promise(function(ok, ko){ AUDIO_CTX.decodeAudioData(ab, ok, ko); }); })
      .then(function(buf){ if(buf){ MUSICA_BUF[brano]=buf; if(MUSICA_ORA===brano && !MUSICA_VOCE) musicaParti(brano); } })
      .catch(function(){ MUSICA_CARICO[brano]=false; });
  }catch(e){ MUSICA_CARICO[brano]=false; }
}
function musicaParti(brano){
  const M=MUSICA_MANIFEST[brano], buf=MUSICA_BUF[brano];
  if(!M || !buf || !AUDIO_CTX) return;
  const t=AUDIO_CTX.currentTime, src=AUDIO_CTX.createBufferSource(), g=AUDIO_CTX.createGain();
  /* L118-1 · un tema CON VARIANTI non gira su sé stesso: suona una volta, e alla fine del giro passa all'altra metà */
  const tema=musicaTema(brano), alterna=musicaVarianti(tema).length>1 && !!(MUSICA_MANIFEST[tema]||{}).loop;   // L218-9: il finale (non in loop) non alterna
  src.buffer=buf; src.loop=!!M.loop && !alterna; g.gain.setValueAtTime(0, t);
  const pieno=(M.gain!=null)?M.gain:MUSICA_GAIN;       // L114-2: il gain del brano, sul volume misurato
  g.gain.linearRampToValueAtTime(pieno*musicaGradino(), t+MUSICA_XFADE_S);   // L146-1: al gradino in vigore (zero, sotto-voce, pieno); L246-1: letto ora, non dall'ultima musica() — un brano nuovo a velo aperto parte a zero
  src.connect(g); g.connect(AUDIO_BUS.musica||AUDIO_MASTER_GAIN); src.start();   // L118-1: sul bus della musica (il cursore)
  const V={ brano:brano, src:src, g:g, pieno:pieno, t0:t, dur:buf.duration };
  MUSICA_VOCE=V;
  musicaSegna(brano, 'parte');
  if(alterna){ musicaVarianti(tema).forEach(function(b){ musicaCarica(b); }); musicaArmaGiro(V, tema); }   // l'altra metà si carica ora
}
/* L118-1 · IL GIRO: MUSICA_XFADE_S prima della fine del brano si conta un giro e si richiama musica(), che sceglie l'altra variante
   e fa la dissolvenza incrociata di sempre. Il tempo si legge dal contesto audio (che si sospende col secondo piano), non dal
   timer: se il timer arriva prima del momento giusto si riarma per il resto. Se l'altra metà non è ancora pronta (rete lenta), il
   giro conta lo stesso e il brano nuovo parte quando arriva: un silenzio breve, mai lo stesso brano due volte di fila. */
function musicaArmaGiro(V, tema){
  if(!AUDIO_CTX) return;
  const resta=(V.t0+V.dur-MUSICA_XFADE_S)-AUDIO_CTX.currentTime;
  setTimeout(function(){
    if(MUSICA_VOCE!==V || !AUDIO_CTX) return;           // il brano è già cambiato (crisi, campagna, notte, cursore…)
    if(AUDIO_CTX.currentTime < V.t0+V.dur-MUSICA_XFADE_S-0.05){ musicaArmaGiro(V, tema); return; }
    MUSICA_GIRO[tema]=(MUSICA_GIRO[tema]||0)+1;
    musicaSegna(tema, 'giro '+MUSICA_GIRO[tema]);
    musica();
  }, Math.max(50, resta*1000));
}
function musicaSpegniVoce(dur){
  const V=MUSICA_VOCE; MUSICA_VOCE=null;
  if(!V || !AUDIO_CTX) return;
  const t=AUDIO_CTX.currentTime;
  try{ V.g.gain.cancelScheduledValues(t); V.g.gain.setValueAtTime(V.g.gain.value, t); V.g.gain.linearRampToValueAtTime(0, t+dur); V.src.stop(t+dur+0.05); }catch(e){}
  musicaSegna(V.brano, 'sfuma');
}
function musicaFerma(){ musicaSpegniVoce(MUSICA_XFADE_S); MUSICA_ORA=null; }
/* ⚑ L'INTERFACCIA per il gioco. `stato` facoltativo: 'finale' (da gameOver), altrimenti lo sceglie musicaScelta(). */
function musica(stato){
  try{
    /* L218-9 · il finale: una delle sue varianti con il file, a caso — dall'orologio e non da Math.random, che il banco semina */
    if(stato==='finale'){ const VF=musicaVarianti('mus-finale'); MUSICA_FORZATA=VF[Date.now()%VF.length]; MUSICA_FORZATA_S=(typeof S!=='undefined')?S:null; }
    if(!musicaAccesa()){ if(MUSICA_VOCE) musicaFerma(); return; }
    if(!AUDIO_CTX) return;                             // prima del primo gesto: niente (la prossima resa riprova)
    const brano=musicaScelta();
    /* il volume: a zero per la durata di un pilastro-tragedia, poi torna; sotto una voce di partenza a ×0,3 (L146-1). La tragedia vince. */
    const zitta=musicaTragedia() || musicaAttaccoZitta(), clip=!zitta && MUSICA_CLIP_ZITTA && veloClipAperto(), liv=musicaGradino();   // L246-1: zero anche sotto la voce di una clip
    if(liv!==MUSICA_LIVELLO){ const eraTragedia=MUSICA_ZITTA; MUSICA_ZITTA=zitta;
      /* L246-1: verso lo zero della clip 0,4 s, dallo zero della clip 1 s; il resto (tragedia, sotto-voce) con la rampa di sempre */
      const dur=clip ? MUSICA_CLIP_ZITTA_S : (MUSICA_LIVELLO===0 && !zitta && !eraTragedia ? MUSICA_CLIP_RIPRESA_S : MUSICA_DUCK_S);
      MUSICA_LIVELLO=liv;
      if(MUSICA_VOCE){ const t=AUDIO_CTX.currentTime, g=MUSICA_VOCE.g.gain;
        try{ g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime((MUSICA_VOCE.pieno||MUSICA_GAIN)*liv, t+dur); }catch(e){} }
      musicaSegna(brano, zitta?'a zero (tragedia)':(clip?'a zero (voce della clip)':(liv<1?'sotto la voce':'torna'))); }
    /* il successivo probabile: il brano della campagna due mesi prima che cominci */
    try{ if(typeof meseMandato==='function' && S && S.livello===3){ const fine=(PAESE.mandatoMesi||60), mm=meseMandato(); if(mm>=fine-8 && mm<fine-6) musicaCarica('mus-campagna'); } }catch(e){}
    if(brano===MUSICA_ORA) return;
    MUSICA_ORA=brano;
    musicaSpegniVoce(MUSICA_XFADE_S);                  // dissolvenza incrociata: il vecchio sfuma mentre il nuovo sale
    if(!brano) return;
    if(MUSICA_BUF[brano]) musicaParti(brano);
    else { musicaSegna(brano, MUSICA_PRESENTI.indexOf((MUSICA_MANIFEST[brano]||{}).file)<0 ? 'file assente (silenzio)' : 'in caricamento'); musicaCarica(brano); }
  }catch(e){}
}
/* il secondo piano: il contesto si sospende quando la pagina si nasconde (musica ed effetti insieme), e il listener di sopra
   lo riprende quando torna visibile */
try{
  document.addEventListener('visibilitychange', function(){
    try{ if(document.hidden && AUDIO_CTX && AUDIO_CTX.state==='running') AUDIO_CTX.suspend(); }catch(e){}
  });
}catch(e){}

/* ================================================================================================================
   L116-2 · GLI AMBIENTI — il terzo strato del modulo audio, sul modello della musica (L114-1), con un interruttore suo.

   QUATTRO LOOP da 15 s (ElevenLabs, generati col giro senza stacco): ufficio, aula, piazza, redazione. Si carica SOLO ciò che è
   in `AMBIENTI_PRESENTI` (stessa cartella `assets/audio/`, la guardia `.claude/verifica-asset.js` la tiene allineata): un ambiente
   che manca è silenzio, nessuna richiesta, zero 404. L'INTERFACCIA è una: `ambiente(stato)`, chiamata da `render()` accanto a
   `musica()` (idempotente: agisce solo sul cambio), dalla notte quando nasce e quando finisce, e da `gameOver` con 'fine'.
   QUALE, lo decide UN punto puro, `ambienteScelto()`:
     · SILENZIO (null) — la notte elettorale (NOTTE), la fine della carriera (forzata da gameOver, finché S è la stessa carriera),
       un pilastro-tragedia non risolto in agenda (`cronaca:true` e `tono:'grave'`: la regola della musica, `musicaTragedia()`);
     · la campagna (`inCampagna()`)                                   → amb-piazza, ovunque;
     · l'attivista (livello 0: il movimento, per strada)              → amb-piazza;
     · la mappa aperta → amb-piazza · un ministero aperto → amb-ufficio · la pagina di un partito → amb-aula;
     · la scheda: Governo e Bilancio (`gov`, `pol`) → amb-ufficio — ma Governo DALL'OPPOSIZIONE → amb-aula (l'opposizione sta in
       aula, non in un ufficio di governo) · Partiti (`par`) → amb-aula · Stampa (`stampa`) → amb-redazione · Paese, `attorno` e il
       tavolo (`paese`, `attorno`, `tavolo`) → amb-piazza · qualunque altra → amb-ufficio.
   COMPORTAMENTO: volume MOLTO basso — ogni loop a −38 dB RMS dopo il gain, 13 dB sotto la musica (−25) e 15 sotto gli effetti
   (−23): si sente nei silenzi; dissolvenza incrociata di 1,8 s al cambio di luogo (e verso il silenzio e dal silenzio); il giro
   è il `loop` del buffer (i file sono nati per girare); pausa col secondo piano (il contesto si sospende, sopra); con
   `reteLeggera()` non si carica, come la musica.
   ⚠ Tutto qui è transitorio: nulla entra in S. La scelta acceso/spento vive in localStorage (`hos_ambiente`); con l'audio spento
   tace comunque.
   ================================================================================================================ */
/* il GAIN per ambiente sul volume misurato (RMS in Chrome, rms-cdp.js): gain = 10^((−38 − RMS)/20) */
const AMBIENTI_MANIFEST = {
  'amb-ufficio':   { file:'amb-ufficio.mp3',   gain:1.03 },   // RMS −38,3
  'amb-aula':      { file:'amb-aula.mp3',      gain:0.35 },   // RMS −29,0
  'amb-piazza':    { file:'amb-piazza.mp3',    gain:1.27 },   // RMS −40,1
  'amb-redazione': { file:'amb-redazione.mp3', gain:0.18 },   // RMS −22,9
  /* L218-10 (giro suoni 10, E4): i quattro luoghi «di oggi» — schermi, telefoni, open space — DAL 1990, come i temi d'epoca. Il luogo lo
     decide ambienteScelto() come prima; la versione d'epoca la sceglie ambienteDEpoca() (sotto), che ripiega sul vecchio finché il file
     manca. Gain dalla regola sul volume dichiarato dal giro (medio): 10^((−38 − RMS)/20). 15 s, 192 kbps, 361 KB (tetto 400). */
  'amb-ufficio-oggi':   { file:'amb-ufficio-oggi.mp3',   gain:0.70 },   // RMS −34,9 / picco −6,6
  'amb-aula-oggi':      { file:'amb-aula-oggi.mp3',      gain:0.87 },   // RMS −36,8 / picco −15,9
  'amb-piazza-oggi':    { file:'amb-piazza-oggi.mp3',    gain:0.65 },   // RMS −34,3 / picco −18,8
  'amb-redazione-oggi': { file:'amb-redazione-oggi.mp3', gain:0.43 }    // RMS −30,6 / picco −17,4
};
/* ⚠ GLI AMBIENTI CHE ESISTONO DAVVERO in assets/audio/. L116-2 (26/9) era vuota: gli originali a 192 kbps pesavano 361 KB l'uno.
   L117-1 (27/9): entrano i quattro RICODIFICATI da Cowork a 112 kbps (arte-sorgente/audio-elevenlabs/ricodificati/), 206 KB l'uno,
   stessa durata (15,00 s) e volume −0,4 dB sugli originali: i gain del manifesto restano. Tetto della guardia: 400 KB. */
const AMBIENTI_PRESENTI = ['amb-ufficio.mp3', 'amb-aula.mp3', 'amb-piazza.mp3', 'amb-redazione.mp3',
                           'amb-ufficio-oggi.mp3', 'amb-aula-oggi.mp3', 'amb-piazza-oggi.mp3', 'amb-redazione-oggi.mp3'];   // L218-10 (E4)
/* L218-10 · L'EPOCA DEL LUOGO: dal 1990 (e nel presente) il luogo suona nella sua versione «-oggi», se il file c'è; prima del 1990, o
   senza file, il luogo di sempre. Puro. Lo stesso confine d'anno dei temi lo decide S.year (il presente parte nel 2026). */
const AMBIENTE_OGGI_DAL = 1990;
function ambienteDEpoca(amb){
  if(!amb || typeof S==='undefined' || !S) return amb;
  const oggi = !S.scenario || S.scenario==='presente' || (S.year!=null && S.year>=AMBIENTE_OGGI_DAL);
  const v = amb+'-oggi', M = AMBIENTI_MANIFEST[v];
  return (oggi && M && AMBIENTI_PRESENTI.indexOf(M.file)>=0) ? v : amb;
}
const AMBIENTE_CHIAVE = 'hos_ambiente', AMBIENTE_XFADE_S = 1.8;
let AMBIENTE_DIR = 'assets/audio/';   // `let`: la pagina di prova la punta ai file sorgente
let AMBIENTE_BUF = {}, AMBIENTE_CARICO = {}, AMBIENTE_ORA = undefined, AMBIENTE_VOCE = null;
let AMBIENTE_FORZATO_S = null;        // la carriera finita (gameOver): per lei, silenzio
let AMBIENTE_REGISTRO = [];           // {amb, t, esito} — la sequenza, per le misure; transitorio

function ambientePreferito(){         // L118-1: la SCELTA (quella che il menu mostra), senza «Silenzia tutto» né cursore
  return audioLeggi(AMBIENTE_CHIAVE)!=='spento';
}
function ambienteAcceso(){
  if(!audioAcceso()) return false;    // con l'audio spento tace tutto
  return ambientePreferito() && audioStratoVivo('ambiente');   // L118-1: e tace silenziato o col cursore a zero
}
function setAmbiente(stato){
  if(stato!=='acceso' && stato!=='spento') return;
  try{ if(typeof lsSet==='function') lsSet(AMBIENTE_CHIAVE, stato); else localStorage.setItem(AMBIENTE_CHIAVE, stato); }catch(e){}
  if(stato==='spento') ambienteFerma(); else ambiente();
  if(typeof ridisegnaAudio==='function') ridisegnaAudio();   // L120-1: il pannello aperto (menu Partita o «Suono» della home)
}
function ambienteSegna(amb, esito){
  AMBIENTE_REGISTRO.push({ amb:amb, t:(typeof performance!=='undefined'?Math.round(performance.now()):0), esito:esito });
  if(AMBIENTE_REGISTRO.length>500) AMBIENTE_REGISTRO.splice(0, AMBIENTE_REGISTRO.length-500);
}
/* ⚑ IL PUNTO DI VERITÀ del luogo che si sente: puro, legge lo stato e non tocca niente (lo legge anche la misura nel banco) */
function ambienteScelto(){
  if(typeof S==='undefined' || !S) return null;
  if(fuoriPartita()) return null;                                          // L118-1: sulla home tace (c'è il tema); prima restava il luogo della carriera abbandonata
  if(AMBIENTE_FORZATO_S===S) return null;                                  // la fine della carriera
  if(typeof NOTTE!=='undefined' && NOTTE) return null;                      // la notte elettorale
  if(typeof musicaTragedia==='function' && musicaTragedia()) return null;    // sotto un pilastro-tragedia
  if(typeof inCampagna==='function' && inCampagna()) return 'amb-piazza';
  if(S.livello===0) return 'amb-piazza';
  if(S.mappaAperta) return 'amb-piazza';
  if(S.ministeroAperto) return 'amb-ufficio';
  if(S.partitoAperto) return 'amb-aula';
  const t=S.tab;
  if(t==='gov') return S.opposizione ? 'amb-aula' : 'amb-ufficio';
  if(t==='pol') return 'amb-ufficio';
  if(t==='par') return 'amb-aula';
  if(t==='stampa') return 'amb-redazione';
  if(t==='paese' || t==='attorno' || t==='tavolo') return 'amb-piazza';
  return 'amb-ufficio';
}
function ambienteCarica(amb){
  const M=AMBIENTI_MANIFEST[amb];
  if(!M || !AUDIO_CTX || AMBIENTE_BUF[amb] || AMBIENTE_CARICO[amb]) return;
  if(AMBIENTI_PRESENTI.indexOf(M.file)<0) return;                           // niente file, niente richiesta: zero 404
  if(typeof reteLeggera==='function' && reteLeggera()){ ambienteSegna(amb, 'risparmio dati (non caricato)'); return; }
  AMBIENTE_CARICO[amb]=true;
  try{
    fetch(AMBIENTE_DIR+M.file).then(function(r){ return r.ok ? r.arrayBuffer() : null; })
      .then(function(ab){ if(!ab || !AUDIO_CTX) return null; return new Promise(function(ok, ko){ AUDIO_CTX.decodeAudioData(ab, ok, ko); }); })
      .then(function(buf){ if(buf){ AMBIENTE_BUF[amb]=buf; if(AMBIENTE_ORA===amb && !AMBIENTE_VOCE) ambienteParti(amb); } })
      .catch(function(){ AMBIENTE_CARICO[amb]=false; });
  }catch(e){ AMBIENTE_CARICO[amb]=false; }
}
function ambienteParti(amb){
  const M=AMBIENTI_MANIFEST[amb], buf=AMBIENTE_BUF[amb];
  if(!M || !buf || !AUDIO_CTX) return;
  const t=AUDIO_CTX.currentTime, src=AUDIO_CTX.createBufferSource(), g=AUDIO_CTX.createGain();
  src.buffer=buf; src.loop=true; g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(M.gain, t+AMBIENTE_XFADE_S);
  src.connect(g); g.connect(AUDIO_BUS.ambiente||AUDIO_MASTER_GAIN); src.start();   // L118-1: sul bus dell'ambiente (il cursore)
  AMBIENTE_VOCE={ amb:amb, src:src, g:g };
  ambienteSegna(amb, 'parte');
}
function ambienteSpegniVoce(dur){
  const V=AMBIENTE_VOCE; AMBIENTE_VOCE=null;
  if(!V || !AUDIO_CTX) return;
  const t=AUDIO_CTX.currentTime;
  try{ V.g.gain.cancelScheduledValues(t); V.g.gain.setValueAtTime(V.g.gain.value, t); V.g.gain.linearRampToValueAtTime(0, t+dur); V.src.stop(t+dur+0.05); }catch(e){}
  ambienteSegna(V.amb, 'sfuma');
}
function ambienteFerma(){ ambienteSpegniVoce(AMBIENTE_XFADE_S); AMBIENTE_ORA=undefined; }
/* ⚑ L'INTERFACCIA per il gioco. `stato` facoltativo: 'fine' (da gameOver) zittisce la carriera che è finita. */
function ambiente(stato){
  try{
    if(stato==='fine') AMBIENTE_FORZATO_S=(typeof S!=='undefined')?S:null;
    if(!ambienteAcceso()){ if(AMBIENTE_VOCE) ambienteFerma(); return; }
    if(!AUDIO_CTX) return;                                                   // prima del primo gesto: niente (la prossima resa riprova)
    const amb=ambienteDEpoca(ambienteScelto());                             // L218-10: il luogo (ambienteScelto) nella sua epoca
    if(amb===AMBIENTE_ORA) return;
    AMBIENTE_ORA=amb;
    ambienteSpegniVoce(AMBIENTE_XFADE_S);                                    // dissolvenza incrociata (o verso il silenzio)
    if(!amb){ ambienteSegna(null, 'silenzio'); return; }
    if(AMBIENTE_BUF[amb]) ambienteParti(amb);
    else { ambienteSegna(amb, AMBIENTI_PRESENTI.indexOf((AMBIENTI_MANIFEST[amb]||{}).file)<0 ? 'file assente (silenzio)' : 'in caricamento'); ambienteCarica(amb); }
  }catch(e){}
}

/* ================================================================================================================
   L218-4 · LE VOCI — il quarto strato dello stesso modulo (paletto: l'audio è un modulo solo). Frasi corte della voce
   «Statista» di ElevenLabs (in inglese: la lingua di scena del personaggio) nei grandi momenti della carriera, col
   SOTTOTITOLO nella lingua del gioco. Regole di L218 (CODA-LAVORI, 10/10):
   · L'INTERFACCIA è una: `parla(id)`. Sempre sicura come `suona()`: senza contesto, senza file, ad audio spento non fa nulla e non lancia.
     `id` può essere il nome di una COPPIA (`voce-vittoria` → `voce-vittoria-a` / `-b`, alternate a ogni chiamata: `VOCI_GIRO`).
   · Suona SOLO se `audioStratoVivo('effetti')` (audio acceso, non silenziato, cursore degli effetti sopra zero): passa dal bus degli
     effetti. Audio spento → niente voce E niente sottotitolo (il testo a schermo del momento basta).
   · Mai sopra un pilastro-tragedia (`musicaTragedia()`, la stessa lettura che azzera la musica). `nonPaesi` sulla voce del manifesto
     la tace in quei paesi (le due della fiducia: niente voto di fiducia nelle partite USA).
   · UNA VOCE PER VOLTA: la nuova sfuma la vecchia (300 ms). Mentre parla, la musica scende con `musicaSottovoce(true)` (lo stesso
     gradino della voce di partenza, L146-1) e risale alla fine.
   · Il SOTTOTITOLO (`#voce-sott`, nato qui la prima volta, in alto: in basso coprirebbe i bottoni dei modali) c'è solo mentre la
     voce suona; un tocco sul sottotitolo zittisce la voce.
   · Il file si carica alla prima richiesta (nessun precaricamento: quarantatré file da 100-205 KB dal L218-12, più le 39 di lei dal L255-1); se non è pronto entro VOCI_ATTESA_MS
     la voce si perde (niente voce in ritardo a momento finito).
   I FILE: `assets/audio/voci/<id>.mp3`, mono 44,1 kHz (ElevenLabs, modello Eleven v4: 130-150 kbps, non ricodificati — niente ffmpeg
   sul mini-PC), promessi da `VOCI_PRESENTI`, che `.claude/verifica-asset.js` tiene allineata alla cartella (un nome senza file è silenzio).
   IL GAIN con la regola degli effetti: 0,6 × 10^((−19 − RMS)/20), RMS misurato in Chrome (`.claude/musica-prova/rms-cdp.js`): le otto
   del giro 4 stanno fra −16,3 e −14,6 dB RMS, picco −1,0…−1,3 → gain 0,35-0,40. Da ascoltare (Giacomo): `VOCI_K` le alza o abbassa tutte.
   ⚠ Tutto qui è transitorio: nulla entra in S.
   ================================================================================================================ */
const VOCI_MANIFEST = {
  'voce-insediamento-a':      { file:'voce-insediamento.mp3',        gain:0.40, f:{ file:'voce-insediamento-a-f.mp3', gain:0.64 }, en:'Today I accept this office not as a reward, but as a duty. I will govern for those who voted for me, and for those who did not. The work begins now.', it:'Oggi accetto questo incarico non come un premio, ma come un dovere. Governerò per chi mi ha votato e per chi non l\'ha fatto. Il lavoro comincia adesso.' },   // C1 · −15,6 / −1,2 (la presa Multilingual v2 è in giro-suoni/prova/: Giacomo sceglie) · dal L218-12 la -a della coppia (il file tiene il nome)
  'voce-vittoria-a':          { file:'voce-vittoria-a.mp3',          gain:0.37, f:{ file:'voce-vittoria-a-f.mp3', gain:0.83 }, en:'The people have spoken, and they have trusted us. Tonight we celebrate. Tomorrow, we keep our promises.', it:'Il popolo ha parlato e ci ha dato fiducia. Stanotte festeggiamo. Domani manteniamo le promesse.' },   // C2 · −16,2 / −1,0
  'voce-vittoria-b':          { file:'voce-vittoria-b.mp3',          gain:0.39, f:{ file:'voce-vittoria-b-f.mp3', gain:0.70 }, en:'It was a long campaign, and every vote counted. This victory belongs to all of you. Now the real work starts.', it:'È stata una campagna lunga, e ogni voto ha contato. Questa vittoria è di tutti voi. Ora comincia il lavoro vero.' },   // C3 · −15,7 / −1,1
  'voce-sconfitta-a':         { file:'voce-sconfitta-a.mp3',         gain:0.39, f:{ file:'voce-sconfitta-a-f.mp3', gain:0.72 }, en:'The voters have made their choice, and I respect it. We lost tonight, but we did not lose our purpose. We will be back.', it:'Gli elettori hanno scelto, e io rispetto la loro scelta. Stanotte abbiamo perso, ma non abbiamo perso la ragione per cui siamo qui. Torneremo.' },   // C4 · −15,7 / −1,1
  'voce-sconfitta-b':         { file:'voce-sconfitta-b.mp3',         gain:0.37, f:{ file:'voce-sconfitta-b-f.mp3', gain:0.72 }, en:'Defeat is part of democracy. I congratulate our opponents. Tomorrow, we begin again.', it:'La sconfitta fa parte della democrazia. Faccio i complimenti ai nostri avversari. Domani si ricomincia.' },   // C5 · −16,3 / −1,0
  'voce-fineanno-buono':      { file:'voce-fineanno-buono.mp3',      gain:0.35, f:{ file:'voce-fineanno-buono-f.mp3', gain:0.70 }, en:'We close this year stronger than we began it. Much remains to be done, but we are on the right road.', it:'Chiudiamo quest\'anno più forti di come l\'abbiamo cominciato. Resta molto da fare, ma la strada è quella giusta.' },   // C6 · −14,6 / −1,1
  'voce-fineanno-lucieombre': { file:'voce-fineanno-lucieombre.mp3', gain:0.39, f:{ file:'voce-fineanno-lucieombre-f.mp3', gain:0.64 }, en:'Another year behind us. Some promises kept, others still waiting. Let us keep going.', it:'Un altro anno alle spalle. Alcune promesse mantenute, altre ancora in attesa. Andiamo avanti.' },   // C7 · −15,7 / −1,3
  'voce-fineanno-difficile':  { file:'voce-fineanno-difficile.mp3',  gain:0.40, f:{ file:'voce-fineanno-difficile-f.mp3', gain:0.74 }, en:'It has been a hard year, and I will not pretend otherwise. Next year we must do better, and we will.', it:'È stato un anno difficile, e non farò finta che non lo sia stato. L\'anno prossimo dobbiamo fare meglio, e lo faremo.' },   // C8 · −15,6 / −1,0
  /* L218-5 (giro suoni 5): C9 e C11-C16, gain dalla regola sull'RMS misurato in Chrome. ⚠ Le otto di L218-4 qui sopra stanno fino a 0,07
     SOTTO la regola (C2 e C5 a −16,2/−16,3 darebbero 0,44, scritte 0,37): da ascoltare con Giacomo prima di ritoccarle. */
  'voce-fineanno-nuovocapitolo': { file:'voce-fineanno-nuovocapitolo.mp3', gain:0.41, f:{ file:'voce-fineanno-nuovocapitolo-f.mp3', gain:0.65 }, en:'A new chapter begins. New faces, new choices, the same country to serve.', it:'Comincia un nuovo capitolo. Volti nuovi, scelte nuove, lo stesso paese da servire.' },   // C9 · −15,6 / −1,2 (L218-5)
  'voce-fiducia-si':          { file:'voce-fiducia-si.mp3',          gain:0.39, f:{ file:'voce-fiducia-si-f.mp3', gain:0.77 }, nonPaesi:['usa'], en:'The chamber has renewed its confidence. The majority holds. Now, back to work.', it:'L\'aula ha rinnovato la fiducia. La maggioranza tiene. E adesso, al lavoro.' },   // C11 · −15,2 / −1,1 (L218-5)
  'voce-fiducia-no':          { file:'voce-fiducia-no.mp3',          gain:0.39, f:{ file:'voce-fiducia-no-f.mp3', gain:0.74 }, nonPaesi:['usa'], en:'The chamber has withdrawn its confidence. This government ends tonight, but our duty to the country does not.', it:'L\'aula ha tolto la fiducia. Questo governo finisce stanotte, ma il nostro dovere verso il paese no.' },   // C12 · −15,3 / −1,2 (L218-5)
  'voce-crisi':               { file:'voce-crisi.mp3',               gain:0.44, f:{ file:'voce-crisi-f.mp3', gain:0.75 }, en:'This is a serious moment for our country. I ask for calm, for unity, and for courage. We will face this together.', it:'È un momento grave per il nostro paese. Chiedo calma, unità e coraggio. Lo affronteremo insieme.' },   // C13 · −16,3 / −1,1 (L218-5)
  'voce-notte':               { file:'voce-notte.mp3',               gain:0.47, f:{ file:'voce-notte-f.mp3', gain:0.75 }, en:'The polls are closed. Now we wait, and every vote will be counted.', it:'I seggi sono chiusi. Ora si aspetta, e ogni voto sarà contato.' },   // C14 · −16,8 / −1,6 (L218-5)
  'voce-finale-alto':         { file:'voce-finale-alto.mp3',         gain:0.44, f:{ file:'voce-finale-alto-f.mp3', gain:0.84 }, en:'My time in office is over. History will judge what we built. I believe it will be kind.', it:'Il mio tempo al governo è finito. La storia giudicherà ciò che abbiamo costruito. Credo che sarà generosa.' },   // C15 · −16,3 / −1,1 (L218-5)
  'voce-finale-basso':        { file:'voce-finale-basso.mp3',        gain:0.46, f:{ file:'voce-finale-basso-f.mp3', gain:0.82 }, en:'My career ends here, not as I had hoped. But every defeat teaches something to those who come next.', it:'La mia carriera finisce qui, non come speravo. Ma ogni sconfitta insegna qualcosa a chi viene dopo.' },   // C16 · −16,6 / −1,2 (L218-5)
  /* L218-6 (giro suoni 6): C17-C24, gain dalla regola sull'RMS dichiarato dal giro (come L218-5). Agganci: dimissioni → `condannaLieve`
     (le dimissioni dopo la condanna: l'unico punto in cui il capo del governo si dimette e la carriera continua; il ritiro ha già
     la voce del finale); campagna → `campSforzo` quando apre la campagna sul territorio (una volta per campagna: `S.campNaz.sforzo`);
     governo → la conferma di una COALIZIONE (avvio e rielezione, la stessa condizione dei bicchieri, `suonoFormazione`) se nessuna
     voce sta parlando; ministro-via → «Chiedi le dimissioni» nello scandalo di un ministro; le quattro della guida → `guida(n)` qui sotto. */
  'voce-dimissioni':          { file:'voce-dimissioni.mp3',          gain:0.45, f:{ file:'voce-dimissioni-f.mp3', gain:0.81 }, en:'I have decided to step down. It is the right thing to do, for the country and for the institutions I have served.', it:'Ho deciso di dimettermi. È la cosa giusta da fare, per il paese e per le istituzioni che ho servito.' },   // C17 · −16,5 / −1,0 (L218-6)
  'voce-campagna':            { file:'voce-campagna.mp3',            gain:0.42, f:{ file:'voce-campagna-f.mp3', gain:0.70 }, en:'The campaign begins today. Every vote must be earned, street by street, town by town.', it:'La campagna comincia oggi. Ogni voto va conquistato, strada per strada, città per città.' },   // C18 · −15,9 / −1,0 (L218-6)
  'voce-governo':             { file:'voce-governo.mp3',             gain:0.44, f:{ file:'voce-governo-f.mp3', gain:0.64 }, en:'We have a government. Different voices, one commitment: to serve the country.', it:'Abbiamo un governo. Voci diverse, un solo impegno: servire il paese.' },   // C19 · −16,4 / −1,3 (L218-6)
  'voce-ministro-via':        { file:'voce-ministro-via.mp3',        gain:0.40, f:{ file:'voce-ministro-via-f.mp3', gain:0.65 }, en:'I have asked the minister to step aside. No one in this government is above accountability.', it:'Ho chiesto al ministro di farsi da parte. In questo governo nessuno è al di sopra delle proprie responsabilità.' },   // C20 · −15,5 / −1,2 (L218-6)
  'voce-guida-1':             { file:'voce-guida-1.mp3',             gain:0.42, en:'Welcome. Every decision you take here will shape your career, and your country.', it:'Benvenuto. Ogni decisione che prendi qui darà forma alla tua carriera, e al tuo paese.', itf:'Benvenuta. Ogni decisione che prendi qui darà forma alla tua carriera, e al tuo paese.' },   // C21 · −16,0 / −1,2 (L218-6)
  'voce-guida-2':             { file:'voce-guida-2.mp3',             gain:0.50, en:'Read every card carefully. Every choice has a price, and someone will remember it.', it:'Leggi ogni carta con attenzione. Ogni scelta ha un prezzo, e qualcuno se ne ricorderà.' },   // C22 · −17,5 / −1,2 (L218-6)
  'voce-guida-3':             { file:'voce-guida-3.mp3',             gain:0.48, en:'Watch your approval and your allies. Lose both, and you lose everything.', it:'Tieni d\'occhio il consenso e gli alleati. Se li perdi entrambi, perdi tutto.' },   // C23 · −17,1 / −1,2 (L218-6)
  'voce-guida-4':             { file:'voce-guida-4.mp3',             gain:0.44, en:'When the phone rings, answer. Some calls can wait. Most cannot.', it:'Quando squilla il telefono, rispondi. Alcune chiamate possono aspettare. Quasi tutte no.' },   // C24 · −16,3 / −1,1 (L218-6)
  /* L218-10 (giro suoni 10): F4a-F4f di PROPOSTA-AUDIO §F4, gain dalla regola sull'RMS dichiarato dal giro. Agganci (game.js):
     scandalo → il mese in cui lo scandalo di un ministro entra in agenda (dentro advanceMonth, non al caricamento: genAgenda gira
     anche in applySnap); rimpasto → `rimpastoEntra`; opposizione → `goOpposizione` dopo una sconfitta dal governo (non la salvezza
     dall'opposizione, non l'avvio all'opposizione); legge-si → `applicaLegge` quando approva; vittoria-c → terza della coppia
     `voce-vittoria` (voceScelta alterna -a/-b/-c). Tutte e quattro le nuove con agganci tacciono se un'altra voce parla (voceInCorso).
     `voce-alleanza`: dal L229-1 (Giacomo 12/10) parla quando un partito NUOVO entra al governo del giocatore — `voceAlleanza()` in
     game.js, chiamata da `rimpastoEntra` (al posto di voce-rimpasto, che resta il ripiego) e dalla coalizione piena del 2010 britannico. */
  'voce-scandalo':            { file:'voce-scandalo.mp3',            gain:0.40, f:{ file:'voce-scandalo-f.mp3', gain:0.82 }, en:'I have read the reports, like everyone else. If anyone on my team broke the rules, they will answer for it.', it:'Ho letto i giornali, come tutti. Se qualcuno della mia squadra ha violato le regole, ne risponderà.' },   // F4a · −15,4 / −1,2 (L218-10)
  'voce-rimpasto':            { file:'voce-rimpasto.mp3',            gain:0.38, f:{ file:'voce-rimpasto-f.mp3', gain:0.79 }, en:'Today I have reshaped the team. New energy, the same direction. The country cannot wait.', it:'Oggi ho cambiato la squadra. Energie nuove, la stessa direzione. Il paese non può aspettare.' },   // F4b · −15,0 / −1,0 (L218-10)
  'voce-alleanza':            { file:'voce-alleanza.mp3',            gain:0.38, f:{ file:'voce-alleanza-f.mp3', gain:0.79 }, en:'We do not agree on everything. But we agree on what matters most, and that is enough to govern together.', it:'Non siamo d\'accordo su tutto. Ma lo siamo su ciò che conta di più, e basta per governare insieme.' },   // F4c · −15,0 / −1,3 (L218-10) · aggancio L229-1: voceAlleanza
  'voce-opposizione':         { file:'voce-opposizione.mp3',         gain:0.46, f:{ file:'voce-opposizione-f.mp3', gain:0.81 }, en:'From today, we sit in opposition. We will watch, we will question, and we will be ready.', it:'Da oggi siamo all\'opposizione. Vigileremo, faremo domande, e saremo pronti.' },   // F4d · −16,7 / −1,2 (L218-10)
  'voce-legge-si':            { file:'voce-legge-si.mp3',            gain:0.44, f:{ file:'voce-legge-si-f.mp3', gain:0.71 }, en:'The law has passed. It was not easy, but it was right, and people will feel the difference.', it:'La legge è passata. Non è stato facile, ma era giusto, e la gente sentirà la differenza.' },   // F4e · −16,3 / −1,4 (L218-10)
  'voce-vittoria-c':          { file:'voce-vittoria-c.mp3',          gain:0.45, f:{ file:'voce-vittoria-c-f.mp3', gain:0.83 }, en:'They said it could not be done. Tonight, you proved them wrong. Thank you.', it:'Dicevano che era impossibile. Stanotte gli avete dato torto. Grazie.' },   // F4f · −16,5 / −1,5 (L218-10)
  /* L218-11 (giro suoni 11): F4g-F4m, gain dalla stessa regola. Agganci: sconfitta-c → terza della coppia `voce-sconfitta` (voceScelta
     gira su -a/-b/-c); coalizione-rotta → `rompiPartner` (game.js) SOLO dentro advanceMonth, al governo, livello 3, fuori dalla
     coabitazione: la rottura per tenuta (pickAlleato, in genAgenda — che gira anche in applySnap) e la tappa del 1982; non gli snodi
     tedeschi, che la raccontano da sé e dove in S1 (c) è il giocatore a cambiare campo; sondaggio-giu/-su → `forseSondaggio`, se il
     sondaggio si sposta dal precedente (consecutivo) di almeno SONDAGGIO_VOCE_SCARTO volte il margine, livello 3; protesta →
     `aggiornaRivolta` (model.js) quando un gruppo comincia a voltarti le spalle (il conto della rivolta passa da 0 a 1), dentro
     advanceMonth. Tutte zitte se un'altra voce parla (voceInCorso).
     ⚠ `voce-bilancio-si`: file e manifesto, NESSUN aggancio — `chiudiBilancio` chiude il bilancio DELL'ANNO, che parla già con
     voce-fineanno-<k>. `voce-legge-no` dal L230-1 la chiama `leggeRespinta` (game.js): la legge del capo del governo respinta in
     aula (`pBocciatura`/`votoInAula`), zitta se un'altra voce parla.
     Decisioni di Giacomo del 12/10 (L229-1): `voce-bilancio-si` RESTA senza aggancio (ogni gennaio si accavallerebbe a
     voce-fineanno-<k>); `voce-legge-no` la decide il voto in aula (L228-1, studio). */
  'voce-sconfitta-c':         { file:'voce-sconfitta-c.mp3',         gain:0.47, f:{ file:'voce-sconfitta-c-f.mp3', gain:0.84 }, en:'It is a bitter night, and I take full responsibility. Our party deserves a fresh start.', it:'È una notte amara, e me ne assumo tutta la responsabilità. Il partito merita di ripartire.' },   // F4g · −16,9 / −1,4 (L218-11)
  'voce-coalizione-rotta':    { file:'voce-coalizione-rotta.mp3',    gain:0.48, f:{ file:'voce-coalizione-rotta-f.mp3', gain:0.73 }, en:'Our partners have chosen to leave. I regret it, but this government will not stop working.', it:'I nostri alleati hanno scelto di andarsene. Mi dispiace, ma questo governo non smette di lavorare.' },   // F4h · −17,0 / −1,3 (L218-11)
  'voce-legge-no':            { file:'voce-legge-no.mp3',            gain:0.43, f:{ file:'voce-legge-no-f.mp3', gain:0.72 }, en:'The vote did not go our way. We will listen, we will improve it, and we will try again.', it:'Il voto non è andato come speravamo. Ascolteremo, la miglioreremo, e ci riproveremo.' },   // F4i · −16,1 / −1,5 (L218-11) · dal L230-1 in leggeRespinta
  'voce-sondaggio-giu':       { file:'voce-sondaggio-giu.mp3',       gain:0.45, f:{ file:'voce-sondaggio-giu-f.mp3', gain:0.81 }, en:'The polls are not kind this week. Polls change. Our work does not.', it:'I sondaggi non sono generosi questa settimana. I sondaggi cambiano. Il nostro lavoro no.' },   // F4j · −16,5 / −1,5 (L218-11)
  'voce-sondaggio-su':        { file:'voce-sondaggio-su.mp3',        gain:0.45, f:{ file:'voce-sondaggio-su-f.mp3', gain:0.85 }, en:'People are starting to notice. Let us not celebrate yet. Let us keep earning it.', it:'La gente comincia ad accorgersene. Non festeggiamo ancora. Continuiamo a meritarcelo.' },   // F4k · −16,5 / −1,5 (L218-11)
  'voce-bilancio-si':         { file:'voce-bilancio-si.mp3',         gain:0.44, f:{ file:'voce-bilancio-si-f.mp3', gain:0.72 }, en:'The budget is approved. Every number in it is a choice, and we stand by ours.', it:'Il bilancio è approvato. Ogni numero è una scelta, e noi difendiamo le nostre.' },   // F4l · −16,3 / −1,3 (L218-11) · senza aggancio
  'voce-protesta':            { file:'voce-protesta.mp3',            gain:0.42, f:{ file:'voce-protesta-f.mp3', gain:0.70 }, en:'I hear the voices in the streets. Protest is a right, and I will not ignore it.', it:'Sento le voci delle piazze. Protestare è un diritto, e non lo ignorerò.' },   // F4m · −15,9 / −1,3 (L218-11)
  /* L218-12 (giro suoni 12): F4n-F4t, gain dalla stessa regola sull'RMS dichiarato dal giro. Agganci (game.js): insediamento-b →
     la seconda della coppia `voce-insediamento` (dal L218-12 la C1 è la -a, il suo file tiene il nome voce-insediamento.mp3:
     diventaPremier e tornaAlGoverno chiamano la coppia e voceScelta alterna); candidatura → `diventaLocale` (l'attivista sceglie
     dove candidarsi: la prima carica); scandalo-chiuso → un arco della famiglia Scandali che si chiude al nodo `chiuso` con la
     prima scelta («Rivendichi la trasparenza»: non «Archivi in silenzio», nessun trionfo); sciopero, vertice, lutto, dibattito →
     `voceAgendaMese` (la carta entra in agenda nel mese nuovo, solo dentro advanceMonth: VOCI_CARTA). Tutte zitte se un'altra
     voce parla (voceInCorso). ⚠ `voce-lutto` («tragedia o disastro») NON sui pilastri-tragedia: lì `parla` tace per regola (L218,
     «mai sopra una tragedia»); la dicono i disastri inventati del gioco (`sisma`, `crollo`). Confermato da Giacomo il 12/10 (L229-1). */
  'voce-sciopero':            { file:'voce-sciopero.mp3',            gain:0.36, f:{ file:'voce-sciopero-f.mp3', gain:0.82 }, en:'This strike is a sign of real anger. My door is open, and I want an agreement by the end of the week.', it:'Questo sciopero è il segno di una rabbia vera. La mia porta è aperta, e voglio un accordo entro la settimana.' },   // F4n · −14,5 / −1,0 (L218-12)
  'voce-insediamento-b':      { file:'voce-insediamento-b.mp3',      gain:0.39, f:{ file:'voce-insediamento-b-f.mp3', gain:0.69 }, en:'I know the weight of this moment. I will not promise miracles. I promise work, honesty, and an open door.', it:'Conosco il peso di questo momento. Non prometto miracoli. Prometto lavoro, onestà e una porta aperta.' },   // F4o · −15,3 / −1,2 (L218-12)
  'voce-candidatura':         { file:'voce-candidatura.mp3',         gain:0.38, f:{ file:'voce-candidatura-f.mp3', gain:0.75, it:'Mi candido perché credo che le cose possano andare meglio, e sono pronta a dimostrarlo.' }, en:'I am standing for election because I believe things can be better, and I am ready to prove it.', it:'Mi candido perché credo che le cose possano andare meglio, e sono pronto a dimostrarlo.' },   // F4p · −15,0 / −1,4 (L218-12)
  'voce-vertice':             { file:'voce-vertice.mp3',             gain:0.48, f:{ file:'voce-vertice-f.mp3', gain:0.89 }, en:'At this summit, our country speaks with one voice. We came to listen, and to be heard.', it:'A questo vertice il nostro paese parla con una voce sola. Siamo venuti ad ascoltare, e a farci ascoltare.' },   // F4q · −17,0 / −1,3 (L218-12)
  'voce-scandalo-chiuso':     { file:'voce-scandalo-chiuso.mp3',     gain:0.43, f:{ file:'voce-scandalo-chiuso-f.mp3', gain:0.93 }, en:'The inquiry is closed, and the facts are clear. Now let us return to the questions that matter to people.', it:'L\'inchiesta è chiusa, e i fatti sono chiari. Ora torniamo alle domande che contano per la gente.' },   // F4r · −16,1 / −1,1 (L218-12)
  'voce-lutto':               { file:'voce-lutto.mp3',               gain:0.46, f:{ file:'voce-lutto-f.mp3', gain:0.85 }, en:'Our thoughts are with the families tonight. Every resource of the state is already on its way.', it:'Stanotte il nostro pensiero va alle famiglie. Tutte le risorse dello stato sono già in viaggio.' },   // F4s · −16,6 / −1,2 (L218-12)
  'voce-dibattito':           { file:'voce-dibattito.mp3',           gain:0.37, f:{ file:'voce-dibattito-f.mp3', gain:0.80 }, en:'Tonight, millions are watching. Speak clearly, answer honestly, and never lose your temper.', it:'Stasera ci guardano milioni di persone. Parla chiaro, rispondi con onestà, e non perdere mai la calma.' },   // F4t · −14,8 / −1,1 (L218-12)
  /* L245-6 (giro suoni 25, S2): la crisi subita. `voce-attacco-a` all'apertura della guerra difensiva (guerraApri, game.js),
     `voce-attacco-b` alla risposta «Chiami gli alleati» (crisiRicevuto). Gain dalla regola 0,6 × 10^((−19 − RMS)/20) sull'RMS del
     giro (lui −14,8 · −19,2, lei −22,6 · −20,1): lei pareggiata a lui (−19 reso). Le altre voci di S2 restano ai loro lotti. */
  'voce-attacco-a':           { file:'voce-attacco-a.mp3',           gain:0.37, f:{ file:'voce-attacco-a-f.mp3', gain:0.91 }, en:'We have been attacked. Our country will defend itself, with resolve and without hatred.', it:'Siamo stati attaccati. Il paese si difenderà, con fermezza e senza odio.' },   // S2 · −14,8 / −1,4 · lei −22,6 / −6,4
  'voce-attacco-b':           { file:'voce-attacco-b.mp3',           gain:0.61, f:{ file:'voce-attacco-b-f.mp3', gain:0.68 }, en:'I have asked our allies for help, and they will answer. We are not alone.', it:'Ho chiesto aiuto ai nostri alleati, e risponderanno. Non siamo soli.' },   // S2 · −19,2 / −2,5 · lei −20,1 / −4,4
};
const VOCI_PRESENTI = ['voce-insediamento.mp3', 'voce-vittoria-a.mp3', 'voce-vittoria-b.mp3', 'voce-sconfitta-a.mp3', 'voce-sconfitta-b.mp3',
                       'voce-fineanno-buono.mp3', 'voce-fineanno-lucieombre.mp3', 'voce-fineanno-difficile.mp3',   // L218-4 (giro suoni 4)
                       'voce-fineanno-nuovocapitolo.mp3', 'voce-fiducia-si.mp3', 'voce-fiducia-no.mp3', 'voce-crisi.mp3', 'voce-notte.mp3',
                       'voce-finale-alto.mp3', 'voce-finale-basso.mp3',   // L218-5 (giro suoni 5)
                       'voce-dimissioni.mp3', 'voce-campagna.mp3', 'voce-governo.mp3', 'voce-ministro-via.mp3',
                       'voce-guida-1.mp3', 'voce-guida-2.mp3', 'voce-guida-3.mp3', 'voce-guida-4.mp3',   // L218-6 (giro suoni 6)
                       'voce-scandalo.mp3', 'voce-rimpasto.mp3', 'voce-alleanza.mp3', 'voce-opposizione.mp3', 'voce-legge-si.mp3',
                       'voce-vittoria-c.mp3',   // L218-10 (giro suoni 10)
                       'voce-sconfitta-c.mp3', 'voce-coalizione-rotta.mp3', 'voce-legge-no.mp3', 'voce-sondaggio-giu.mp3',
                       'voce-sondaggio-su.mp3', 'voce-bilancio-si.mp3', 'voce-protesta.mp3',   // L218-11 (giro suoni 11)
                       'voce-sciopero.mp3', 'voce-insediamento-b.mp3', 'voce-candidatura.mp3', 'voce-vertice.mp3', 'voce-scandalo-chiuso.mp3',
                       'voce-lutto.mp3', 'voce-dibattito.mp3',   // L218-12 (giro suoni 12)
                       /* L255-1 (giro suoni 24): le 39 voci di lei, «Violetta» (Eleven Multilingual v2), `<id>-f.mp3` con l'id del manifesto;
                          L218-27 (giro suoni 27): sei rifatte più lente (finale-alto, sondaggio-giu, insediamento-b, vittoria-c, fineanno-nuovocapitolo,
                          ministro-via: 0,83-0,96× la durata di lui), gain rimisurato con .claude/misura-l255-1.js; le prese di prima in scarti/<nome>-f-v1.mp3 */
                       'voce-insediamento-a-f.mp3', 'voce-vittoria-a-f.mp3', 'voce-vittoria-b-f.mp3', 'voce-sconfitta-a-f.mp3', 'voce-sconfitta-b-f.mp3',
                       'voce-fineanno-buono-f.mp3', 'voce-fineanno-lucieombre-f.mp3', 'voce-fineanno-difficile-f.mp3', 'voce-fineanno-nuovocapitolo-f.mp3',
                       'voce-fiducia-si-f.mp3', 'voce-fiducia-no-f.mp3', 'voce-crisi-f.mp3', 'voce-notte-f.mp3', 'voce-finale-alto-f.mp3', 'voce-finale-basso-f.mp3',
                       'voce-dimissioni-f.mp3', 'voce-campagna-f.mp3', 'voce-governo-f.mp3', 'voce-ministro-via-f.mp3',
                       'voce-scandalo-f.mp3', 'voce-rimpasto-f.mp3', 'voce-alleanza-f.mp3', 'voce-opposizione-f.mp3', 'voce-legge-si-f.mp3', 'voce-vittoria-c-f.mp3',
                       'voce-sconfitta-c-f.mp3', 'voce-coalizione-rotta-f.mp3', 'voce-legge-no-f.mp3', 'voce-sondaggio-giu-f.mp3', 'voce-sondaggio-su-f.mp3',
                       'voce-bilancio-si-f.mp3', 'voce-protesta-f.mp3',
                       'voce-sciopero-f.mp3', 'voce-insediamento-b-f.mp3', 'voce-candidatura-f.mp3', 'voce-vertice-f.mp3', 'voce-scandalo-chiuso-f.mp3',
                       'voce-lutto-f.mp3', 'voce-dibattito-f.mp3',
                       'voce-attacco-a.mp3', 'voce-attacco-a-f.mp3', 'voce-attacco-b.mp3', 'voce-attacco-b-f.mp3'];   // L245-6 (giro suoni 25, S2)
const VOCI_DIR = 'assets/audio/voci/', VOCI_K = 1, VOCI_ATTESA_MS = 2500, VOCI_FADE_S = 0.3;
let VOCI_BUF = {}, VOCI_CARICO = {}, VOCI_GIRO = {}, VOCE_ORA = null, VOCE_TOKEN = 0, VOCE_ATTESA = null;   // L218-6: VOCE_ATTESA = la voce chiesta e in caricamento {tok, t0} · L255-1: BUF e CARICO per FILE, non per id
let VOCI_REGISTRO = [];               // {id, t, esito, file} — per le misure; transitorio (file: L255-1, sulla riga «parla»)
function voceSegna(id, esito, file){ VOCI_REGISTRO.push({ id:id, t:(typeof performance!=='undefined'?Math.round(performance.now()):0), esito:esito, file:file }); if(VOCI_REGISTRO.length>500) VOCI_REGISTRO.splice(0, VOCI_REGISTRO.length-500); }
/* L255-1 · LA VOCE DI LEI. `voceGenere()` (pura) = 'f' se il personaggio è una donna (`S.personaggio.genere`, già in S: nessun
   campo nuovo), altrimenti 'm'. `voceVariante(id)` = ciò che suona per quell'id: la voce di lei (`M.f`: file, gain e, dove l'accordo
   cambia, `it`) se il genere è 'f' E il suo file è in VOCI_PRESENTI, altrimenti la voce di lui; null se non c'è nessun file. Il
   genere non fa mai silenzio: senza `-f` (le quattro della guida) parla lui. Buffer e caricamenti sono per FILE, così una partita
   nuova di genere diverso nella stessa pagina non suona il buffer dell'altra.
   L255-2: `itf` sul manifesto = il sottotitolo IT per la giocatrice sulle voci SENZA `-f` (parla lui, il testo si rivolge a lei;
   oggi solo voce-guida-1, «Benvenuta»; l'inglese non accorda). Il genere lo dà CREA finché la carriera si compone (prima di
   initStatoBase: dal capo del governo la guida parla durante la nomina del gabinetto), poi S. */
function voceGenere(){
  if(typeof CREA!=='undefined' && CREA) return CREA.genere==='f' ? 'f' : 'm';   // L255-2: una carriera in composizione (CREA non ancora consumata: la nomina del gabinetto, dove suona voce-guida-1) vince su una S vecchia
  return (typeof S!=='undefined' && S && S.personaggio && S.personaggio.genere==='f') ? 'f' : 'm'; }
function voceVariante(id){
  const M=VOCI_MANIFEST[id]; if(!M) return null;
  if(voceGenere()==='f' && M.f && VOCI_PRESENTI.indexOf(M.f.file)>=0) return { file:M.f.file, gain:M.f.gain, it:M.f.it||M.it, en:M.f.en||M.en, f:true };
  return VOCI_PRESENTI.indexOf(M.file)>=0 ? { file:M.file, gain:M.gain, it:(voceGenere()==='f' && M.itf) ? M.itf : M.it, en:M.en, f:false } : null;   // L255-2: `itf`, la voce di lui che si rivolge a lei
}
function voceHaFile(id){ return !!voceVariante(id); }
/* PURA (salvo il turno della coppia): dal nome chiesto al nome che suona. Un nome del manifesto vale com'è; il nome di una coppia
   sceglie fra `-a`, `-b` e `-c` (L218-10: la vittoria ne ha tre; L218-11: anche la sconfitta; L218-12: l'insediamento ne ha due) QUELLE COL FILE, a turno. Null se non c'è niente da dire. */
function voceScelta(id){
  if(VOCI_MANIFEST[id]) return voceHaFile(id) ? id : null;
  const V=['-a','-b','-c'].map(function(s){ return id+s; }).filter(voceHaFile);   // L218-10: la terza della vittoria (-c)
  if(!V.length) return null;
  const n=VOCI_GIRO[id]||0; VOCI_GIRO[id]=n+1;
  return V[n%V.length];
}
function voceCarica(file){
  if(VOCI_CARICO[file]) return VOCI_CARICO[file];
  if(!AUDIO_CTX) return null;
  VOCI_CARICO[file]=fetch(VOCI_DIR+file).then(function(r){ return r.ok ? r.arrayBuffer() : null; })
    .then(function(ab){ if(!ab || !AUDIO_CTX) return null; return new Promise(function(ok, ko){ AUDIO_CTX.decodeAudioData(ab, ok, ko); }); })
    .then(function(buf){ if(buf) VOCI_BUF[file]=buf; delete VOCI_CARICO[file]; return buf; })
    .catch(function(){ delete VOCI_CARICO[file]; return null; });
  return VOCI_CARICO[file];
}
function voceSottotitolo(testo){
  try{
    let el=document.getElementById('voce-sott');
    if(!testo){ if(el) el.classList.remove('on'); return; }
    if(!el){
      el=document.createElement('div'); el.id='voce-sott'; el.setAttribute('aria-live', 'polite');
      el.innerHTML='<span></span>';
      el.addEventListener('click', function(ev){ ev.stopPropagation(); taciVoce(); });
      document.body.appendChild(el);
    }
    el.firstChild.textContent=testo;
    void el.offsetWidth;              // reflow forzato prima della classe: la dissolvenza entra anche nel task che lo crea (L146-1)
    el.classList.add('on');
  }catch(e){}
}
/* zittisce la voce in corso (sfumando) e chiude il sottotitolo; la musica risale */
function taciVoce(){
  try{
    const V=VOCE_ORA; VOCE_ORA=null; VOCE_TOKEN++;
    voceSottotitolo(null);
    if(V && AUDIO_CTX){ const t=AUDIO_CTX.currentTime; try{ V.g.gain.cancelScheduledValues(t); V.g.gain.setValueAtTime(V.g.gain.value, t); V.g.gain.linearRampToValueAtTime(0, t+VOCI_FADE_S); V.src.stop(t+VOCI_FADE_S+0.05); }catch(e){} voceSegna(V.id, 'taciuta'); }
    if(typeof musicaSottovoce==='function') musicaSottovoce(false);
  }catch(e){}
}
function voceParti(id, M){
  if(VOCE_ORA) taciVoce();
  const src=AUDIO_CTX.createBufferSource(); src.buffer=VOCI_BUF[M.file];
  const g=AUDIO_CTX.createGain(); g.gain.value=M.gain*VOCI_K;
  src.connect(g); g.connect(AUDIO_BUS.effetti||AUDIO_MASTER_GAIN);
  const V={ id:id, file:M.file, src:src, g:g }; VOCE_ORA=V;
  src.onended=function(){ if(VOCE_ORA!==V) return; VOCE_ORA=null; voceSottotitolo(null); if(typeof musicaSottovoce==='function') musicaSottovoce(false); voceSegna(id, 'finita'); };
  src.start();
  if(typeof musicaSottovoce==='function') musicaSottovoce(true);
  voceSottotitolo((typeof curLang==='function' && curLang()==='en') ? M.en : M.it);
  voceSegna(id, 'parla', M.file);
}
/* vero se una voce sta parlando o sta arrivando (chiesta e in caricamento, entro VOCI_ATTESA_MS): chi non vuole interrompere chiede
   prima (la voce del governo, la guida). Una voce in caricamento non è ancora VOCE_ORA: senza il secondo termine la voce del
   governo scavalcava quella della notte chiesta un attimo prima (sonda l218-6-voci-cdp.js). */
function voceInCorso(){ return !!VOCE_ORA || !!(VOCE_ATTESA && VOCE_ATTESA.tok===VOCE_TOKEN && Date.now()-VOCE_ATTESA.t0<=VOCI_ATTESA_MS); }
/* L218-6 · LA GUIDA DELLA PRIMA PARTITA (C21-C24). «Prima partita» = la prima partita NUOVA avviata su questo dispositivo:
   `guidaInizia()` (chiamata da avviaRuolo, cioè mai da un salvataggio) la riconosce dal segno `hos_guida_partita` in localStorage
   e accende GUIDA_ATTIVA (transitorio, spento da resetAll con `guidaFine()`); ogni battuta suona UNA volta per dispositivo
   (`hos_guida_<n>`). La battuta si segna detta solo se poteva suonare (audio vivo, contesto, file) e se nessun'altra voce parlava:
   altrimenti resta per il momento dopo. Agganci: 1 il benvenuto, chiusa la clip di partenza (o subito, se la clip non c'è);
   2 le carte, a fine del primo mese; 3 consenso e alleati, a fine del terzo; 4 il telefono, al primo squillo. Niente in S. */
let GUIDA_ATTIVA=false, GUIDA_MESI=0;
function guidaLS(k, v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } }
function guidaInizia(){ GUIDA_MESI=0; GUIDA_ATTIVA = !guidaLS('hos_guida_partita'); if(GUIDA_ATTIVA) guidaLS('hos_guida_partita', '1'); }
function guidaFine(){ GUIDA_ATTIVA=false; GUIDA_MESI=0; }
function guida(n){
  try{
    if(!GUIDA_ATTIVA || guidaLS('hos_guida_'+n)) return;
    const id='voce-guida-'+n;
    if(!voceHaFile(id) || !AUDIO_CTX || !audioStratoVivo('effetti') || voceInCorso()) return;
    if(typeof musicaTragedia==='function' && musicaTragedia()) return;
    guidaLS('hos_guida_'+n, '1');
    parla(id);
  }catch(e){}
}
/* a fine mese (advanceMonth): la seconda battuta dopo il primo mese, la terza dopo il terzo; se non poteva suonare riprova il mese dopo */
function guidaMese(){ if(!GUIDA_ATTIVA) return; GUIDA_MESI++; if(GUIDA_MESI>=1) guida(2); if(GUIDA_MESI>=3) guida(3); }
/* ⚑ L'INTERFACCIA per il gioco */
function parla(richiesta){
  try{
    if(!audioStratoVivo('effetti')){ voceSegna(richiesta, 'audio spento'); return; }
    if(typeof musicaTragedia==='function' && musicaTragedia()){ voceSegna(richiesta, 'tragedia'); return; }
    const id=voceScelta(richiesta);
    if(!id){ voceSegna(richiesta, (VOCI_MANIFEST[richiesta] || VOCI_MANIFEST[richiesta+'-a']) ? 'file assente' : 'fuori manifesto'); return; }
    const MM=VOCI_MANIFEST[id], M=voceVariante(id);   // L255-1: la variante (lei o lui) si decide qui, una volta per richiesta
    if(MM.nonPaesi && typeof S!=='undefined' && S && MM.nonPaesi.indexOf(S.paese)>=0){ voceSegna(id, 'non in questo paese'); return; }
    if(!AUDIO_CTX){ voceSegna(id, 'nessun contesto (prima del primo gesto)'); return; }
    const tok=++VOCE_TOKEN;
    if(VOCI_BUF[M.file]){ voceParti(id, M); return; }
    const t0=Date.now(); voceSegna(id, 'in caricamento'); VOCE_ATTESA={ tok:tok, t0:t0 };
    const p=voceCarica(M.file);
    if(p) p.then(function(buf){
      if(!buf || tok!==VOCE_TOKEN) return;                                      // un'altra voce (o un tocco) è arrivata prima
      if(Date.now()-t0>VOCI_ATTESA_MS){ voceSegna(id, 'troppo tardi'); return; }  // niente voce in ritardo a momento finito
      if(!audioStratoVivo('effetti')) return;
      voceParti(id, M);
    });
  }catch(e){}
}
