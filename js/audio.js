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
/* I file sono i WAV generati da `.claude/genera-audio.js` (L95-3a): mono, 22.050 Hz, picco −3 dBFS. Quando Giacomo
   sostituirà un file con un campione CC0 cambia UNA riga qui (e AUDIO_PRESENTI), non il motore: `file:` porta
   l'estensione, .wav o .mp3.
   ⚠ I GAIN SONO BILANCIATI SUL VOLUME MISURATO, non a occhio: a picco uguale i quattordici file differiscono di
   8 dB di RMS (snodo e finale −13, esito −21). Ogni gain porta il suo file verso −19 dB RMS (× 0,6 il valore base),
   e i due loop stanno un altro 40% sotto, perché sono un letto e non un evento. È un bilanciamento di RMS: le note
   gravi (snodo, 110 Hz) all'orecchio suonano più piano di quel che il numero dice — va ritoccato ascoltando. */
const AUDIO_MANIFEST = {
  tocco:    { file:'tocco.wav',    loop:false, gain:0.68 },
  carta:    { file:'carta.wav',    loop:false, gain:0.54 },
  chip:     { file:'chip.wav',     loop:false, gain:0.63 },
  mese:     { file:'mese.wav',     loop:false, gain:0.52 },
  giornale: { file:'giornale.wav', loop:false, gain:0.55 },
  mappa:    { file:'mappa.wav',    loop:false, gain:0.34 },
  urne:     { file:'urne.wav',     loop:true,  gain:0.25 },
  esito:    { file:'esito.wav',    loop:false, gain:0.76 },
  esito_no: { file:'esito_no.wav', loop:false, gain:0.65 },
  snodo:    { file:'snodo.wav',    loop:false, gain:0.30 },
  soglia:   { file:'soglia.wav',   loop:false, gain:0.38 },
  finale:   { file:'finale.wav',   loop:false, gain:0.30 },
  telefono: { file:'telefono.wav', loop:false, gain:0.38 },
  aula:     { file:'aula.wav',     loop:true,  gain:0.38 }
};
/* ⚠ I FILE CHE ESISTONO DAVVERO in assets/audio/. Il motore carica SOLO questi: un nome del manifesto che non è
   qui non genera nessuna richiesta di rete. Si aggiorna a mano quando un file cambia, e se la lista e la cartella
   divergono `.claude/verifica-asset.js` diventa rossa. Dal 13/9 ci sono i quattordici di L95-3a. */
const AUDIO_PRESENTI = ['tocco.wav','carta.wav','chip.wav','mese.wav','giornale.wav','mappa.wav','urne.wav',
                        'esito.wav','esito_no.wav','snodo.wav','soglia.wav','finale.wav','telefono.wav','aula.wav'];

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
  if(stato==='spento') taciTutto();
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
