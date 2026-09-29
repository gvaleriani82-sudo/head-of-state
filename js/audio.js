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
     anche il × 0,6 dei letti. ⚑ L118-1 (27/9): `scheda` (il cassetto) è USCITO — a Giacomo non piaceva; al suo posto `pagina`, qui sotto. */
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
  allarme:  { file:'allarme.mp3',  loop:false, gain:5.54 },   // RMS −38,3 ⚠ basso
  /* ⚑ L118-1 (27/9) · IL TERZO GIRO, venti nomi (PROMPT-AUDIO-ELEVENLABS § «Terzo giro»). Col file, dal 27/9: `pagina`, `martelletto`, `passi` (L130-1); dal 28/9 (L137-1)
     campanella, porta, bicchieri, stretta, sussurro, radio, telex (le prime versioni di Lyria erano state scartate da Cowork: questi sono ElevenLabs e due ritagli). Gli altri NON ci sono ancora: è una lista-promessa,
     come la musica di L114-1. Gli agganci sono già al loro posto (nel punto dove si decide, `suonoCarta` per le carte che entrano), e
     finché un file manca il nome è silenzio SENZA consumare un posto del gesto (vedi `suona`). ⚠ Il gain qui è il valore base 0,6:
     quando arriva il file si rifà con la regola di sopra (0,6 × 10^((−19 − RMS)/20), tetto del picco a −1 dBFS) e si aggiunge ad AUDIO_PRESENTI. */
  pagina:      { file:'pagina.mp3',      loop:false, gain:0.26 },  // il cassetto che si apre (al posto di `scheda`) · ARRIVATO il 27/9 08:19 (Gemini, «taglio 1», 0,6 s): RMS −17,7, picco 0 → regola di sopra × 0,5 (6 dB sotto: gesto frequente, come era `scheda`)
  martelletto: { file:'martelletto.mp3', loop:false, gain:1.01 },  // la legge approvata · ARRIVATO il 27/9 (L130-1, ritaglio Lyria di Cowork, 2,2 s): RMS −23,5, picco −1,4 → regola di sopra (a 0,6 rendeva −27,9, 4,5 dB sotto i vicini)
  campanella:  { file:'campanella.mp3',  loop:false, gain:0.90 },  // si apre una seduta, un dibattito · ARRIVATO il 28/9 (L137-1, ElevenLabs, 3 s): RMS −22,5, picco −2,2 → regola di sopra
  stretta:     { file:'stretta.mp3',     loop:false, gain:1.06 },  // un accordo, una maggioranza ricostruita · L137-1 (0,9 s): RMS −26,5, picco −1,5 → tetto del picco (la regola dava 1,42)
  bicchieri:   { file:'bicchieri.mp3',   loop:false, gain:0.94 },  // un accordo festeggiato · L137-1 (1,1 s): RMS −22,9, picco −1,9 → regola di sopra
  passi:       { file:'passi.mp3',       loop:false, gain:0.66 },  // un ministero che si apre, una visita · ARRIVATO il 27/9 (L130-1, 2,9 s): RMS −19,8, picco 0 → regola di sopra, rende −23,4 come `bussare`, che sostituisce
  porta:       { file:'porta.mp3',       loop:false, gain:1.00 },  // il retroscena (i beat `rb_`) · L137-1 (1,2 s): RMS −23,4, picco −1,5 → regola di sopra
  sussurro:    { file:'sussurro.mp3',    loop:false, gain:1.08 },  // fuori verbale, indiscrezioni · L137-1 (1,9 s): RMS −26,2, picco −1,7 → tetto del picco (la regola dava 1,37)
  radio:       { file:'radio.mp3',       loop:false, gain:0.92 },  // l'estero e le crisi internazionali, FINO AL 1989 · L137-1 (ritaglio Lyria, 2,5 s): RMS −22,7, picco −1,4 → regola di sopra
  telex:       { file:'telex.mp3',       loop:false, gain:0.40 },  // dispacci e diplomazia, FINO AL 1989 · L137-1 (ritaglio Lyria, 2,4 s): RMS −15,4, picco 0 → regola di sopra
  notifica:    { file:'notifica.mp3',    loop:false, gain:0.6 },   // DAL 2000: al posto di `giornale`
  vibrazione:  { file:'vibrazione.mp3',  loop:false, gain:0.6 },   // DAL 2000: al posto di `telefono`
  borsa:       { file:'borsa.mp3',       loop:false, gain:0.64 },  // mercati, spread · L141-1 (28/9, ritaglio Lyria di Cowork, 3,0 s): RMS −19,6, picco −1,4 → regola di sopra
  sirena:      { file:'sirena.mp3',      loop:false, gain:0.6 },   // ordine pubblico (mai una tragedia)
  ambulanza:   { file:'ambulanza.mp3',   loop:false, gain:0.35 },  // sanità (mai una tragedia) · L141-1 (4,0 s): RMS −14,4, picco −1,4 → regola di sopra
  cantiere:    { file:'cantiere.mp3',    loop:false, gain:0.6 },   // infrastrutture, grandi opere
  treno:       { file:'treno.mp3',       loop:false, gain:0.6 },   // trasporti
  orologio:    { file:'orologio.mp3',    loop:false, gain:0.84 },  // scadenza, ultimatum, la fiducia che si vota · L141-1 (3,2 s, quattro colpi): RMS −21,9, picco −0,2 → regola di sopra (il tetto del picco è 0,91)
  fanfara:     { file:'fanfara.mp3',     loop:false, gain:0.33 },  // l'insediamento, la vittoria larga · L141-1 (4,0 s): RMS −13,9, picco −1,2 → regola di sopra
  campane:     { file:'campane.mp3',     loop:false, gain:0.41 }   // la festa nazionale · L141-1 (4,0 s): RMS −15,6, picco −1,5 → regola di sopra
};
/* ⚠ I FILE CHE ESISTONO DAVVERO in assets/audio/. Il motore carica SOLO questi: un nome del manifesto che non è
   qui non genera nessuna richiesta di rete. Si aggiorna a mano quando un file cambia, e se la lista e la cartella
   divergono `.claude/verifica-asset.js` diventa rossa. Dal 13/9 i quattordici di L95-3a; dal 26/9 (L114-2) dodici sono MP3 di ElevenLabs;
   dal 26/9 sera (L116-1) i tredici del secondo giro, tutti MP3 di ElevenLabs. L118-1 (27/9): `scheda.mp3` esce; i venti del terzo giro
   entrano qui uno per uno, quando arriva il file. */
const AUDIO_PRESENTI = ['tocco.wav','carta.mp3','chip.mp3','mese.mp3','giornale.mp3','mappa.mp3','urne.mp3',
                        'esito.mp3','esito_no.mp3','snodo.mp3','soglia.mp3','finale.mp3','telefono.mp3','aula.mp3',   // L114-2
                        'pagina.mp3',   // L118-1: il primo del terzo giro (27/9 08:19)
                        'martelletto.mp3','passi.mp3',   // L130-1 (27/9 sera)
                        'campanella.mp3','porta.mp3','bicchieri.mp3','stretta.mp3','sussurro.mp3','radio.mp3','telex.mp3',   // L137-1 (28/9)
                        'borsa.mp3','ambulanza.mp3','orologio.mp3','fanfara.mp3','campane.mp3',   // L141-1 (28/9 sera)
                        'positivo.mp3','negativo.mp3','firma.mp3','monete.mp3','applauso.mp3','folla.mp3',
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
  /* ⚑ L118-1 · IL TEMA DEL GIOCO, fuori partita (home, scelta del paese e del partito, scenari storici). Lista-promessa: il file
     arriva da Gemini (`arte-sorgente/audio-elevenlabs/mus-tema.mp3`); L122-1: arrivato, −14,7 dB RMS misurati, 3:00. */
  'mus-tema':     { file:'mus-tema.mp3',     loop:true,  gain:0.30 }
};
/* ⚠ I BRANI CHE ESISTONO DAVVERO in assets/audio/: solo questi si chiedono alla rete. Si aggiorna a mano quando un file arriva;
   se lista e cartella divergono `.claude/verifica-asset.js` diventa rossa. L114-2 (26/9): TUTTI E UNDICI, a 192 kbps così come
   arrivano — i tre da un minuto a 1,46 MB, i sette temi e `mus-crisi` a 2,9 MB (il tetto dei brani è 3 MB: si caricano uno alla
   volta e a richiesta; la ricodifica a 128 kbps è un'ottimizzazione facoltativa per quando ci sarà ffmpeg). */
const MUSICA_PRESENTI = ['mus-1950.mp3','mus-1960.mp3','mus-1970.mp3','mus-1980.mp3','mus-1990.mp3','mus-2000.mp3',
                         'mus-presente.mp3','mus-crisi.mp3','mus-campagna.mp3','mus-notte.mp3','mus-finale.mp3',
                         'mus-1970-b.mp3',    // L118-1: la prima variante (Gemini)
                         'mus-tema.mp3','mus-1950-b.mp3','mus-1960-b.mp3','mus-1980-b.mp3','mus-1990-b.mp3','mus-2000-b.mp3',
                         'mus-presente-b.mp3','mus-crisi-b.mp3','mus-campagna-b.mp3'];   // L122-1: il tema e le altre otto varianti
const MUSICA_CHIAVE = 'hos_musica', MUSICA_GAIN = 0.35, MUSICA_XFADE_S = 2.5, MUSICA_DUCK_S = 0.8;
let MUSICA_DIR = 'assets/audio/';     // `let`: la pagina di prova di L114-1 la punta ai segnaposto di .claude/musica-prova/
let MUSICA_BUF = {}, MUSICA_CARICO = {}, MUSICA_ORA = null, MUSICA_VOCE = null, MUSICA_ZITTA = false;
/* L146-1 · SOTTO LA VOCE: mentre parla la voce di una clip di partenza la musica scende a ×0,3 (≈ −10 dB) e poi torna piena.
   Non è un secondo meccanismo: il livello del brano lo decide UN punto solo, `musica()`, fra tre gradini — zero sotto un
   pilastro-tragedia (vince sempre), sotto-voce, pieno — e `musicaParti` parte al gradino in vigore. `MUSICA_SOTTOVOCE` lo
   accende e lo spegne `musicaSottovoce()` (la chiama ui.js, `apriPartenza`/`chiudiPartenza`). Transitorio, mai in S. */
const MUSICA_SOTTOVOCE_K = 0.3;
let MUSICA_SOTTOVOCE = false, MUSICA_LIVELLO = 1;
function musicaSottovoce(on){ on=!!on; if(on===MUSICA_SOTTOVOCE) return; MUSICA_SOTTOVOCE=on; musica(); }
let MUSICA_FORZATA = null, MUSICA_FORZATA_S = null;
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
  const y=S.year;
  return y<1960?'mus-1950' : y<1970?'mus-1960' : y<1980?'mus-1970' : y<1990?'mus-1980' : y<2000?'mus-1990' : 'mus-2000';
}
function musicaCrisi(){
  return !!(S && S.livello===3 && !S.opposizione && ((S.mesiSottoCrisi||0)>0 || (S.minoranza && !S.coabitazione)));
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
/* L118-1 · le varianti di un tema che HANNO IL FILE, nell'ordine A, B… (senza varianti: il tema solo) */
function musicaVarianti(tema){
  const V=[tema];
  Object.keys(MUSICA_MANIFEST).forEach(function(k){ const M=MUSICA_MANIFEST[k]; if(M.variante===tema && MUSICA_PRESENTI.indexOf(M.file)>=0) V.push(k); });
  return V;
}
function musicaGiroVariante(tema){ const V=musicaVarianti(tema); return V[(MUSICA_GIRO[tema]||0)%V.length]; }
/* il tema di un brano (una variante risponde col suo tema) */
function musicaTema(brano){ const M=MUSICA_MANIFEST[brano]; return (M && M.variante) || brano; }
/* ⚑ IL PUNTO DI VERITÀ del brano: puro, legge lo stato e non tocca niente (lo usa anche la misura nel banco) */
function musicaScelta(){
  if(typeof INTRO_APERTA!=='undefined' && INTRO_APERTA) return null;   // L124-1: sotto il video introduttivo la musica tace (è nel video)
  if(fuoriPartita()) return 'mus-tema';                          // L118-1: fuori partita, il tema del gioco (dentro non vale mai)
  if(MUSICA_FORZATA && MUSICA_FORZATA_S===S) return MUSICA_FORZATA;
  if(typeof NOTTE!=='undefined' && NOTTE) return 'mus-notte';
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
  const tema=musicaTema(brano), alterna=musicaVarianti(tema).length>1;
  src.buffer=buf; src.loop=!!M.loop && !alterna; g.gain.setValueAtTime(0, t);
  const pieno=(M.gain!=null)?M.gain:MUSICA_GAIN;       // L114-2: il gain del brano, sul volume misurato
  g.gain.linearRampToValueAtTime(pieno*MUSICA_LIVELLO, t+MUSICA_XFADE_S);   // L146-1: al gradino in vigore (zero, sotto-voce, pieno)
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
    if(stato==='finale'){ MUSICA_FORZATA='mus-finale'; MUSICA_FORZATA_S=(typeof S!=='undefined')?S:null; }
    if(!musicaAccesa()){ if(MUSICA_VOCE) musicaFerma(); return; }
    if(!AUDIO_CTX) return;                             // prima del primo gesto: niente (la prossima resa riprova)
    const brano=musicaScelta();
    /* il volume: a zero per la durata di un pilastro-tragedia, poi torna; sotto una voce di partenza a ×0,3 (L146-1). La tragedia vince. */
    const zitta=musicaTragedia(), liv=zitta?0:(MUSICA_SOTTOVOCE?MUSICA_SOTTOVOCE_K:1);
    if(liv!==MUSICA_LIVELLO){ MUSICA_ZITTA=zitta; MUSICA_LIVELLO=liv;
      if(MUSICA_VOCE){ const t=AUDIO_CTX.currentTime, g=MUSICA_VOCE.g.gain;
        try{ g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime((MUSICA_VOCE.pieno||MUSICA_GAIN)*liv, t+MUSICA_DUCK_S); }catch(e){} }
      musicaSegna(brano, zitta?'a zero (tragedia)':(liv<1?'sotto la voce':'torna')); }
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
/* ⚠ GLI AMBIENTI CHE ESISTONO DAVVERO in assets/audio/. L116-2 (26/9) era vuota: gli originali a 192 kbps pesavano 361 KB l'uno.
   L117-1 (27/9): entrano i quattro RICODIFICATI da Cowork a 112 kbps (arte-sorgente/audio-elevenlabs/ricodificati/), 206 KB l'uno,
   stessa durata (15,00 s) e volume −0,4 dB sugli originali: i gain del manifesto restano. Tetto della guardia: 400 KB. */
const AMBIENTI_PRESENTI = ['amb-ufficio.mp3', 'amb-aula.mp3', 'amb-piazza.mp3', 'amb-redazione.mp3'];
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
    const amb=ambienteScelto();
    if(amb===AMBIENTE_ORA) return;
    AMBIENTE_ORA=amb;
    ambienteSpegniVoce(AMBIENTE_XFADE_S);                                    // dissolvenza incrociata (o verso il silenzio)
    if(!amb){ ambienteSegna(null, 'silenzio'); return; }
    if(AMBIENTE_BUF[amb]) ambienteParti(amb);
    else { ambienteSegna(amb, AMBIENTI_PRESENTI.indexOf((AMBIENTI_MANIFEST[amb]||{}).file)<0 ? 'file assente (silenzio)' : 'in caricamento'); ambienteCarica(amb); }
  }catch(e){}
}
