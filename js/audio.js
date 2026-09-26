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

/* ── 1 · IL MANIFESTO: i quattordici nomi di DESIGN-MOVIMENTO, e che cosa ne fa il motore ─────────────────────── */
/* I file: dal L114-2 dodici sono gli MP3 di ElevenLabs (stereo, 44,1 kHz); `tocco` e `finale` restano i WAV generati da
   `.claude/genera-audio.js` (L95-3a: mono, 22.050 Hz, picco −3 dBFS). Quando Giacomo
   sostituirà un file con un campione CC0 cambia UNA riga qui (e AUDIO_PRESENTI), non il motore: `file:` porta
   l'estensione, .wav o .mp3.
   ⚠ I GAIN SONO BILANCIATI SUL VOLUME MISURATO, non a occhio: a picco uguale i quattordici file differiscono di
   8 dB di RMS (snodo e finale −13, esito −21). Ogni gain porta il suo file verso −19 dB RMS (× 0,6 il valore base),
   e i due loop stanno un altro 40% sotto, perché sono un letto e non un evento. È un bilanciamento di RMS: le note
   gravi (snodo, 110 Hz) all'orecchio suonano più piano di quel che il numero dice — va ritoccato ascoltando. */
/* ⚑ L114-2 (26/9) · I FILE VERI DI ELEVENLABS al posto di dodici sintetici. Restano sintetici `tocco` (il file nuovo è quasi
   muto: picco −52,6 dBFS, RMS −74 — inservibile, segnalato) e `finale` (73 KB, sopra il tetto dei 60 degli effetti: aspetta la
   ricodifica). I GAIN RIFATTI con la stessa regola di L95-3a, sul volume misurato dei file nuovi (decodificati in Chrome,
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
  finale:   { file:'finale.wav',   loop:false, gain:0.30 },   // sintetico (L95-3a): il nuovo (RMS −19,7 → 0,65) aspetta la ricodifica
  telefono: { file:'telefono.mp3', loop:false, gain:1.39 },   // RMS −26,3
  aula:     { file:'aula.mp3',     loop:true,  gain:0.29 }    // RMS −17,1, loop
};
/* ⚠ I FILE CHE ESISTONO DAVVERO in assets/audio/. Il motore carica SOLO questi: un nome del manifesto che non è
   qui non genera nessuna richiesta di rete. Si aggiorna a mano quando un file cambia, e se la lista e la cartella
   divergono `.claude/verifica-asset.js` diventa rossa. Dal 13/9 i quattordici di L95-3a; dal 26/9 (L114-2) dodici sono MP3 di ElevenLabs. */
const AUDIO_PRESENTI = ['tocco.wav','carta.mp3','chip.mp3','mese.mp3','giornale.mp3','mappa.mp3','urne.mp3',
                        'esito.mp3','esito_no.mp3','snodo.mp3','soglia.mp3','finale.wav','telefono.mp3','aula.mp3'];   // L114-2

/* ── 6 · NIENTE SINTETICO A RUNTIME ────────────────────────────────────────────────────────────────────────
   Il motore carica FILE. I suoni li genera `.claude/genera-audio.js` una volta, fuori dal gioco (L95-3a); la prima
   stesura di questo modulo aveva un oscillatore di ripiego per ogni nome, tolto quando i file sono arrivati:
   un file mancante ora è SILENZIO, che è il comportamento che il gioco deve avere quando un campione sparisce. */

const AUDIO_CHIAVE = 'hos_audio', AUDIO_MASTER = 0.5, AUDIO_FADE_MS = 300;
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
  if(stato==='spento'){ taciTutto(); if(typeof musicaFerma==='function') musicaFerma(); }
  else if(typeof musica==='function') musica();      // L114-1: riaccendendo l'audio torna anche la musica (se è accesa)
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
   se lista e cartella divergono `.claude/verifica-asset.js` diventa rossa. L114-2 (26/9): i tre brani da un minuto (1,46 MB, sotto il
   tetto dei 2); i sette temi e `mus-crisi` (2,9 MB a 192 kbps) aspettano la ricodifica a 128 kbps. */
const MUSICA_PRESENTI = ['mus-campagna.mp3','mus-notte.mp3','mus-finale.mp3'];
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
