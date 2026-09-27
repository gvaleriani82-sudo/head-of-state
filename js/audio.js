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

/* ── 1 · IL MANIFESTO: ventisette nomi — i quattordici di DESIGN-MOVIMENTO e i tredici del secondo giro (L116-1) — e che cosa ne fa il motore ─────────────────────── */
/* I file: dal L114-2 tredici sono gli MP3 di ElevenLabs (stereo, 44,1 kHz); `tocco` resta il WAV generato da
   `.claude/genera-audio.js` (L95-3a: mono, 22.050 Hz, picco −3 dBFS). Quando Giacomo
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
  tocco:    { file:'tocco.wav',    loop:false, gain:0.68 },   // sintetico (L95-3a): il tocco di ElevenLabs è muto
  carta:    { file:'carta.mp3',    loop:false, gain:0.64 },   // RMS −19,5
  chip:     { file:'chip.mp3',     loop:false, gain:1.43 },   // RMS −27, tetto del picco
  mese:     { file:'mese.mp3',     loop:false, gain:4.77 },   // RMS −37 ⚠ basso
  giornale: { file:'giornale.mp3', loop:false, gain:2.53 },   // RMS −31,5
  mappa:    { file:'mappa.mp3',    loop:false, gain:7.33 },   // RMS −43,1 ⚠ basso, tetto del picco
  urne:     { file:'urne.mp3',     loop:true,  gain:0.49 },   // RMS −21,7, loop
  esito:    { file:'esito.mp3',    loop:false, gain:0.46 },   // RMS −16,6
  esito_no: { file:'esito_no.mp3', loop:false, gain:1.12 },   // RMS −24,4
  snodo:    { file:'snodo.mp3',    loop:false, gain:8.38 },   // RMS −41,9 ⚠ basso
  soglia:   { file:'soglia.mp3',   loop:false, gain:7.82 },   // RMS −41,3 ⚠ basso
  finale:   { file:'finale.mp3',   loop:false, gain:0.65 },   // RMS −19,7 · 73 KB: l'eccezione di peso di urne/aula (L114-2, Cowork 26/9)
  telefono: { file:'telefono.mp3', loop:false, gain:1.39 },   // RMS −26,3
  aula:     { file:'aula.mp3',     loop:true,  gain:0.29 },   // RMS −17,1, loop
  /* ⚑ L116-1 (26/9) · IL SECONDO GIRO, tredici effetti di ElevenLabs (PROMPT-AUDIO-ELEVENLABS § «Secondo giro»). Gain con la
     regola di sopra, sul volume misurato in Chrome (`.claude/musica-prova/rms-cdp.js`): 0,6 × 10^((−19 − RMS)/20), tetto del
     picco a −1 dBFS. Due eccezioni DICHIARATE: (1) LA FOLLA (applauso, folla, fischi, protesta) sta a −28 dB invece di −23,4, cioè
     sotto la musica di campagna (mus-campagna rende −25,2: −15,3 × 0,32), come vuole L116-1; `protesta` è un loop e prende
     anche il × 0,6 dei letti. (2) `scheda` suona a ogni cambio di scheda: 6 dB sotto gli altri (−29), un gesto frequente. */
  scheda:   { file:'scheda.mp3',   loop:false, gain:5.69 },   // RMS −44,1 ⚠ basso · 6 dB sotto (gesto frequente)
  positivo: { file:'positivo.mp3', loop:false, gain:1.03 },   // RMS −23,7
  negativo: { file:'negativo.mp3', loop:false, gain:3.43 },   // RMS −35,3, tetto del picco
  firma:    { file:'firma.mp3',    loop:false, gain:0.89 },   // RMS −26,2, tetto del picco
  monete:   { file:'monete.mp3',   loop:false, gain:0.85 },   // RMS −22
  applauso: { file:'applauso.mp3', loop:false, gain:0.44 },   // RMS −20,9 · folla: −28
  folla:    { file:'folla.mp3',    loop:false, gain:0.21 },   // RMS −14,3 · folla: −28
  protesta: { file:'protesta.mp3', loop:true,  gain:0.19 },   // RMS −18,2 · folla: −28, e loop × 0,6
  fischi:   { file:'fischi.mp3',   loop:false, gain:0.14 },   // RMS −10,9 · folla: −28
  flash:    { file:'flash.mp3',    loop:false, gain:1.13 },   // RMS −28,2, tetto del picco
  bussare:  { file:'bussare.mp3',  loop:false, gain:0.50 },   // RMS −17,4
  macchina: { file:'macchina.mp3', loop:false, gain:1.24 },   // RMS −29, tetto del picco
  allarme:  { file:'allarme.mp3',  loop:false, gain:5.54 }    // RMS −38,3 ⚠ basso
};
/* ⚠ I FILE CHE ESISTONO DAVVERO in assets/audio/. Il motore carica SOLO questi: un nome del manifesto che non è
   qui non genera nessuna richiesta di rete. Si aggiorna a mano quando un file cambia, e se la lista e la cartella
   divergono `.claude/verifica-asset.js` diventa rossa. Dal 13/9 i quattordici di L95-3a; dal 26/9 (L114-2) dodici sono MP3 di ElevenLabs;
   dal 26/9 sera (L116-1) i tredici del secondo giro, tutti MP3 di ElevenLabs. */
const AUDIO_PRESENTI = ['tocco.wav','carta.mp3','chip.mp3','mese.mp3','giornale.mp3','mappa.mp3','urne.mp3',
                        'esito.mp3','esito_no.mp3','snodo.mp3','soglia.mp3','finale.mp3','telefono.mp3','aula.mp3',   // L114-2
                        'scheda.mp3','positivo.mp3','negativo.mp3','firma.mp3','monete.mp3','applauso.mp3','folla.mp3',
                        'protesta.mp3','fischi.mp3','flash.mp3','bussare.mp3','macchina.mp3','allarme.mp3'];         // L116-1

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
function setAudio(stato){
  if(stato!=='acceso' && stato!=='spento') return;
  try{ if(typeof lsSet==='function') lsSet(AUDIO_CHIAVE, stato); else localStorage.setItem(AUDIO_CHIAVE, stato); }catch(e){}
  if(stato==='spento'){ taciTutto(); if(typeof musicaFerma==='function') musicaFerma(); if(typeof ambienteFerma==='function') ambienteFerma(); }
  else { if(typeof musica==='function') musica(); if(typeof ambiente==='function') ambiente(); }   // L114-1/L116-2: riaccendendo l'audio tornano musica e ambiente (se accesi)
  if(typeof showPartita==='function' && document.getElementById('menu-modal')) showPartita();   // il segmento acceso segue la scelta
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
    audioSegna(nome, AUDIO_PRESENTI.indexOf(M.file)<0 ? 'file assente' : 'file non ancora pronto');
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
/* IL SUONO DI UNA CARTA CHE ENTRA, oltre a `carta`/`snodo` (il secondo del gesto): dalla SPECIE della carta (`kind`) o da
   KICKER E TITOLO, con la tabella qui sotto, la prima riga che risponde. MAI su un pilastro-cronaca (`cronaca:true`, che è muto
   del tutto) e MAI su una tragedia (`tono:'grave'`). Le parole sono radici scritte a mano, lette sul testo SORGENTE (italiano). */
const SUONO_CARTA = [
  ['protesta', [],                            /sciopero|scioperi|ordine pubblico|corteo|cortei|manifestaz|protest|occupaz|piazza|picchett/i],
  ['fischi',   [],                            /contestaz|fischi|dissiden|ribell|rivolta/i],
  ['flash',    ['stampa','scandalo'],         /stampa|comunicazione|televisione|scandalo|intervista|giornal|conferenza/i],
  ['macchina', ['dossier','inchiesta'],       /dossier|rapporto|inchiesta|indagine|toghe|giustizia|procura|conti pubblici/i],
  ['allarme',  ['crisiInt'],                  /crisi|emergenz|allarme|calamit|attentat|terror|i mercati|default/i],
  ['bussare',  ['ministro','rimpasto','premier'], /udienza|visita|colloquio|palazzo|istituzioni|quirinale|eliseo/i],
  ['folla',    [],                            /campagna elettorale|comizio/i]
];
function suonoCarta(item){
  if(!item) return null;
  const d=item.data||{};
  if(d.cronaca===true || d.tono==='grave') return null;
  const testo=String(d.kick||'')+' · '+String(d.t||'');
  for(let i=0;i<SUONO_CARTA.length;i++){ const R=SUONO_CARTA[i]; if(R[1].indexOf(item.kind)>=0 || R[2].test(testo)) return R[0]; }
  return null;
}

function audioSuonaBuffer(nome, M){
  const src=AUDIO_CTX.createBufferSource(); src.buffer=AUDIO_BUF[nome]; src.loop=!!M.loop;
  const g=AUDIO_CTX.createGain(); g.gain.value=M.gain;
  src.connect(g); g.connect(AUDIO_MASTER_GAIN); src.start();
  if(M.loop) AUDIO_LOOP[nome]={src:src, g:g};
}

/* ================================================================================================================
   L114-1 · LA MUSICA — nello stesso modulo degli effetti (paletto: l'audio è un modulo solo), con un interruttore suo.

   UNDICI BRANI (DESIGN-TAVOLO § «Video e musica»): un tema per epoca e quattro di momento. Il motore è nato con ZERO file (L114-1) e
   si accende da solo quando arrivano: si carica SOLO ciò che è in `MUSICA_PRESENTI`, che `.claude/verifica-asset.js` tiene
   allineata alla cartella (la stessa degli effetti, `assets/audio/`, come vuole L114-2). Un brano che manca è silenzio.
   L'INTERFACCIA per il gioco è una: `musica(stato)`. Senza argomento sceglie il brano dallo stato (`musicaScelta()`), e la
   chiama `render()` a ogni resa: è idempotente, agisce solo sul cambio. Con 'finale' la chiama `gameOver` sui motivi di
   `FINALI_CON_SUONO`. Sempre sicura, come `suona()`: senza contesto, senza file, a musica spenta non fa nulla e non lancia.
   QUALE BRANO, in quest'ordine:
     1. 'finale'  — forzato da gameOver (non in loop), vale finché S è la stessa carriera;
     2. la notte elettorale (NOTTE non nullo)                          → mus-notte;
     3. la crisi: al governo, livello 3, con l'allarme insolvenza acceso (`S.mesiSottoCrisi>0`) oppure in minoranza fuori
        dalla coabitazione (`S.minoranza && !S.coabitazione`)          → mus-crisi   (proposta di Code, L114-1);
     4. la campagna (`inCampagna()`, gli ultimi sei mesi del mandato)   → mus-campagna;
     5. l'epoca, dall'anno: fino al 1959 mus-1950 … 2000-2013 mus-2000; il presente (lo scenario 'presente', o dal 2014 una
        linea storica saldata al presente)                              → mus-presente.
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
  'mus-finale':   { file:'mus-finale.mp3',   loop:false, gain:0.71 }    // −22,2
};
/* ⚠ I BRANI CHE ESISTONO DAVVERO in assets/audio/: solo questi si chiedono alla rete. Si aggiorna a mano quando un file arriva;
   se lista e cartella divergono `.claude/verifica-asset.js` diventa rossa. L114-2 (26/9): TUTTI E UNDICI, a 192 kbps così come
   arrivano — i tre da un minuto a 1,46 MB, i sette temi e `mus-crisi` a 2,9 MB (il tetto dei brani è 3 MB: si caricano uno alla
   volta e a richiesta; la ricodifica a 128 kbps è un'ottimizzazione facoltativa per quando ci sarà ffmpeg). */
const MUSICA_PRESENTI = ['mus-1950.mp3','mus-1960.mp3','mus-1970.mp3','mus-1980.mp3','mus-1990.mp3','mus-2000.mp3',
                         'mus-presente.mp3','mus-crisi.mp3','mus-campagna.mp3','mus-notte.mp3','mus-finale.mp3'];
const MUSICA_CHIAVE = 'hos_musica', MUSICA_GAIN = 0.35, MUSICA_XFADE_S = 2.5, MUSICA_DUCK_S = 0.8;
let MUSICA_DIR = 'assets/audio/';     // `let`: la pagina di prova di L114-1 la punta ai segnaposto di .claude/musica-prova/
let MUSICA_BUF = {}, MUSICA_CARICO = {}, MUSICA_ORA = null, MUSICA_VOCE = null, MUSICA_ZITTA = false;
let MUSICA_FORZATA = null, MUSICA_FORZATA_S = null;
let MUSICA_REGISTRO = [];             // {brano, t, esito} — la sequenza dei cambi, per le misure; transitorio

function musicaAccesa(){
  if(!audioAcceso()) return false;    // con l'audio spento tace tutto
  let v=null; try{ v=(typeof lsGet==='function')?lsGet(MUSICA_CHIAVE):localStorage.getItem(MUSICA_CHIAVE); }catch(e){ v=null; }
  return v!=='spenta';                // default: accesa se l'audio è acceso
}
function setMusica(stato){
  if(stato!=='accesa' && stato!=='spenta') return;
  try{ if(typeof lsSet==='function') lsSet(MUSICA_CHIAVE, stato); else localStorage.setItem(MUSICA_CHIAVE, stato); }catch(e){}
  if(stato==='spenta') musicaFerma(); else musica();
  if(typeof showPartita==='function' && document.getElementById('menu-modal')) showPartita();
}
function musicaSegna(brano, esito){
  MUSICA_REGISTRO.push({ brano:brano, t:(typeof performance!=='undefined'?Math.round(performance.now()):0), esito:esito });
  if(MUSICA_REGISTRO.length>500) MUSICA_REGISTRO.splice(0, MUSICA_REGISTRO.length-500);
}
/* il brano dell'epoca, dall'anno del gioco */
function musicaEpoca(){
  if(typeof S==='undefined' || !S) return null;
  if(!S.scenario || S.scenario==='presente' || S.year>=2014) return 'mus-presente';
  const y=S.year;
  return y<1960?'mus-1950' : y<1970?'mus-1960' : y<1980?'mus-1970' : y<1990?'mus-1980' : y<2000?'mus-1990' : 'mus-2000';
}
function musicaCrisi(){
  return !!(S && S.livello===3 && !S.opposizione && ((S.mesiSottoCrisi||0)>0 || (S.minoranza && !S.coabitazione)));
}
function musicaTragedia(){
  return !!(S && Array.isArray(S.agenda) && S.agenda.some(function(a){ const d=a&&a.data; return a && !a.resolved && d && d.cronaca && d.tono==='grave'; }));
}
/* ⚑ IL PUNTO DI VERITÀ del brano: puro, legge lo stato e non tocca niente (lo usa anche la misura nel banco) */
function musicaScelta(){
  if(typeof S==='undefined' || !S) return null;
  if(MUSICA_FORZATA && MUSICA_FORZATA_S===S) return MUSICA_FORZATA;
  if(typeof NOTTE!=='undefined' && NOTTE) return 'mus-notte';
  if(musicaCrisi()) return 'mus-crisi';
  if(typeof inCampagna==='function' && inCampagna()) return 'mus-campagna';
  return musicaEpoca();
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
  src.buffer=buf; src.loop=!!M.loop; g.gain.setValueAtTime(0, t);
  const pieno=(M.gain!=null)?M.gain:MUSICA_GAIN;       // L114-2: il gain del brano, sul volume misurato
  g.gain.linearRampToValueAtTime(MUSICA_ZITTA?0:pieno, t+MUSICA_XFADE_S);
  src.connect(g); g.connect(AUDIO_MASTER_GAIN); src.start();
  MUSICA_VOCE={ brano:brano, src:src, g:g, pieno:pieno };
  musicaSegna(brano, 'parte');
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
    if(stato==='finale'){ MUSICA_FORZATA='mus-finale'; MUSICA_FORZATA_S=(typeof S!=='undefined')?S:null; }
    if(!musicaAccesa()){ if(MUSICA_VOCE) musicaFerma(); return; }
    if(!AUDIO_CTX) return;                             // prima del primo gesto: niente (la prossima resa riprova)
    const brano=musicaScelta();
    /* il volume: a zero per la durata di un pilastro-tragedia, poi torna */
    const zitta=musicaTragedia();
    if(zitta!==MUSICA_ZITTA){ MUSICA_ZITTA=zitta;
      if(MUSICA_VOCE){ const t=AUDIO_CTX.currentTime, g=MUSICA_VOCE.g.gain;
        try{ g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(zitta?0:(MUSICA_VOCE.pieno||MUSICA_GAIN), t+MUSICA_DUCK_S); }catch(e){} }
      musicaSegna(brano, zitta?'a zero (tragedia)':'torna'); }
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
  'amb-redazione': { file:'amb-redazione.mp3', gain:0.18 }    // RMS −22,9
};
/* ⚠ GLI AMBIENTI CHE ESISTONO DAVVERO in assets/audio/. L116-2 (26/9): VUOTA — i quattro file ci sono in arte-sorgente a 192 kbps,
   361 KB l'uno, sopra il tetto di 250 KB del lotto, e sul PC non c'è un codificatore (niente ffmpeg, lame, sox) per portarli a
   96-128 kbps. Il motore è provato coi file veri nella pagina `.claude/musica-prova/ambienti.html`. Quando i file entrano, una riga qui. */
const AMBIENTI_PRESENTI = [];
const AMBIENTE_CHIAVE = 'hos_ambiente', AMBIENTE_XFADE_S = 1.8;
let AMBIENTE_DIR = 'assets/audio/';   // `let`: la pagina di prova la punta ai file sorgente
let AMBIENTE_BUF = {}, AMBIENTE_CARICO = {}, AMBIENTE_ORA = undefined, AMBIENTE_VOCE = null;
let AMBIENTE_FORZATO_S = null;        // la carriera finita (gameOver): per lei, silenzio
let AMBIENTE_REGISTRO = [];           // {amb, t, esito} — la sequenza, per le misure; transitorio

function ambienteAcceso(){
  if(!audioAcceso()) return false;    // con l'audio spento tace tutto
  let v=null; try{ v=(typeof lsGet==='function')?lsGet(AMBIENTE_CHIAVE):localStorage.getItem(AMBIENTE_CHIAVE); }catch(e){ v=null; }
  return v!=='spento';                // default: acceso se l'audio è acceso
}
function setAmbiente(stato){
  if(stato!=='acceso' && stato!=='spento') return;
  try{ if(typeof lsSet==='function') lsSet(AMBIENTE_CHIAVE, stato); else localStorage.setItem(AMBIENTE_CHIAVE, stato); }catch(e){}
  if(stato==='spento') ambienteFerma(); else ambiente();
  if(typeof showPartita==='function' && document.getElementById('menu-modal')) showPartita();
}
function ambienteSegna(amb, esito){
  AMBIENTE_REGISTRO.push({ amb:amb, t:(typeof performance!=='undefined'?Math.round(performance.now()):0), esito:esito });
  if(AMBIENTE_REGISTRO.length>500) AMBIENTE_REGISTRO.splice(0, AMBIENTE_REGISTRO.length-500);
}
/* ⚑ IL PUNTO DI VERITÀ del luogo che si sente: puro, legge lo stato e non tocca niente (lo legge anche la misura nel banco) */
function ambienteScelto(){
  if(typeof S==='undefined' || !S) return null;
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
  src.connect(g); g.connect(AUDIO_MASTER_GAIN); src.start();
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
    const amb=ambienteScelto();
    if(amb===AMBIENTE_ORA) return;
    AMBIENTE_ORA=amb;
    ambienteSpegniVoce(AMBIENTE_XFADE_S);                                    // dissolvenza incrociata (o verso il silenzio)
    if(!amb){ ambienteSegna(null, 'silenzio'); return; }
    if(AMBIENTE_BUF[amb]) ambienteParti(amb);
    else { ambienteSegna(amb, AMBIENTI_PRESENTI.indexOf((AMBIENTI_MANIFEST[amb]||{}).file)<0 ? 'file assente (silenzio)' : 'in caricamento'); ambienteCarica(amb); }
  }catch(e){}
}
