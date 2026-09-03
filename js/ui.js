"use strict";
/* ============================================================
   UI — tutto ciò che si vede e si tocca.
   Disegna la schermata di nomina, l'intestazione con gli
   indicatori, le cinque schede (Governo, Paese, Bilancio,
   Partiti, Stampa) e gestisce i piccoli tocchi (cambio scheda,
   scelta candidato, cambio livello di una politica).
   ============================================================ */

/* ===== FASCIA LEGGERA — animazioni di presentazione =====
   render() ricrea i nodi con innerHTML interi: una transizione sul cambio di valore non scatterebbe mai.
   Il DOM è SEMPRE reso al valore finale (statico/reduced-motion corretti); playAnims() aggiunge il moto
   vecchio→nuovo leggendo UIVALS (mappa dei valori dell'ultimo render, FUORI da S come COAL/NOTTE: mai
   serializzata, mai tocca la logica). Sotto prefers-reduced-motion è un no-op. UIANIM traccia i rAF in volo. */
let UIVALS={}, UIANIM={}, lastTab=null, lastAgendaSig=null, lastDots={}, lastTerrPulse=null, PROMO_FIORE=false;   // lastTerrPulse (F2): l'area-che-chiama pulsa SOLO alla comparsa   // lastDots (E5): quali schede avevano il pallino l'ultimo render → il pulse scatta SOLO alla comparsa, mai a ogni re-render   // PROMO_FIORE: fioretto one-shot sul nuovo titolo a una transizione di carriera (consumato dal primo elemento-ruolo reso)
function motionReduced(){ return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
function topScroll(){ window.scrollTo({top:0, behavior: motionReduced()?'auto':'smooth'}); }   // torna-su: istantaneo sotto reduced-motion
function resetUIAnim(){ UIVALS={}; for(const k in UIANIM){ try{ cancelAnimationFrame(UIANIM[k]); }catch(e){} } UIANIM={}; lastTab=null; lastAgendaSig=null; lastDots={}; }   // a nuova partita / caricamento: prima apparizione senza animazione
/* riempimento barra animabile: a piena larghezza, scala da sinistra. data-to = % (clampata). */
function fillI(key, pct, color){ return '<i class="fill" data-anim="bar:'+key+'" data-to="'+pct+'" style="transform:scaleX('+(pct/100)+');background:'+color+'"></i>'; }
function fmtAnim(n, dec, signed){ return (signed&&n>0?'+':'')+n.toFixed(dec)+'%'; }
function countUp(el, from, to, dec, signed){
  const key=el.getAttribute('data-anim');
  if(UIANIM[key]) cancelAnimationFrame(UIANIM[key]);
  const final=el.textContent, t0=performance.now(), dur=400;   // 'final' = stringa esatta già renderizzata: l'ultimo frame la ripristina
  function frame(t){
    if(!el.isConnected){ delete UIANIM[key]; return; }          // nodo sostituito da un re-render: lascia perdere
    let k=(t-t0)/dur;
    if(k>=1){ el.textContent=final; delete UIANIM[key]; return; }
    k=1-Math.pow(1-k,3);                                         // easeOutCubic
    el.textContent=fmtAnim(from+(to-from)*k, dec, signed);
    UIANIM[key]=requestAnimationFrame(frame);
  }
  UIANIM[key]=requestAnimationFrame(frame);
}
/* Passata unica dopo ogni render: numeri che contano + barre che scorrono vecchio→nuovo. Idempotente e sicura
   sugli interrupt (il DOM è già al valore finale; i rAF in volo si autoannullano se il nodo esce dal DOM). */
function playAnims(){
  const reduce=motionReduced();
  document.querySelectorAll('.val[data-anim^="num:"]').forEach(function(el){
    const key=el.getAttribute('data-anim'), to=parseFloat(el.getAttribute('data-to')), from=UIVALS[key];
    UIVALS[key]=to;
    if(reduce || from==null || isNaN(to) || Math.abs(from-to)<0.005) return;
    countUp(el, from, to, parseInt(el.getAttribute('data-dec'),10)||0, el.getAttribute('data-sign')==='1');
  });
  document.querySelectorAll('i.fill[data-anim^="bar:"]').forEach(function(el){
    const key=el.getAttribute('data-anim'), to=parseFloat(el.getAttribute('data-to')), from=UIVALS[key];
    UIVALS[key]=to;
    if(reduce || from==null || isNaN(to) || Math.abs(from-to)<0.05) return;
    el.style.transition='none'; el.style.transform='scaleX('+(from/100)+')';   // riparti dal vecchio…
    void el.offsetWidth;                                                       // …forza un reflow…
    el.style.transition=''; el.style.transform='scaleX('+(to/100)+')';         // …e lascia partire la transition CSS verso il nuovo
  });
  /* aree della mappa: il colore di controllo (0=avversario, 1=tuo) sfuma vecchio→nuovo. Di fatto si vede
     riaprendo la mappa dopo un'intermedia che ha ribaltato aree: l'onda elettorale appare in dissolvenza. */
  document.querySelectorAll('[data-anim^="fill:"]').forEach(function(el){
    const key=el.getAttribute('data-anim'), to=parseInt(el.getAttribute('data-to'),10), from=UIVALS[key];
    UIVALS[key]=to;
    if(reduce || from==null || from===to) return;
    el.style.transition='none'; el.style.fill=(from===1)?'var(--acc)':'var(--mut2)';
    void el.getBoundingClientRect();                                           // reflow (gli elementi SVG non hanno offsetWidth)
    el.style.transition=''; el.style.fill='';                                  // torna al fill nuovo (attributo) con la transition CSS
  });
}
/* Firma del SET di carte in agenda (id, non lo stato risolto): cambia solo quando arrivano carte nuove (nuovo mese),
   non quando ne risolvi una o cambi scheda → l'entrata scaglionata parte solo quando serve davvero. */
function agendaSig(){ return (S.agenda||[]).map(function(a){
  return a.kind+':'+(a.kind==='conflitto'?(a.minA+'/'+a.minB):a.kind==='intermedia'?((a.ev&&a.ev.id)||'i'):a.kind==='rimpasto'?('r'+a.min):(a.min||(a.data&&a.data.id)||''));
}).join('|'); }
/* Notte elettorale (vetrina): azzera le barre dello spoglio così l'exit poll SALE da zero e ogni elezione
   riparte pulita (le chiavi notte:* persistono tra le tappe ma vanno resettate a ogni nuovo voto). */
function seedNotteAnim(){ ['bar:notte:bloc','bar:notte:me','bar:notte:opp'].forEach(function(k){ UIVALS[k]=0; }); (PAESE.partiti||[]).forEach(function(p){ UIVALS['bar:notte:seg:'+p.id]=0; }); }

/* --- Cornice-paese: legge tutto da PAESE (data.js) e lo applica all'interfaccia.
   Chiamata una volta al caricamento; richiamabile a mano dopo aver cambiato PAESE. --- */
function applyPaese(){
  const P=PAESE;
  document.documentElement.style.setProperty('--acc', P.colori.accento);
  const hf=document.getElementById('hdr-flag'); if(hf) hf.innerHTML=P.flag||'';   // bandiera nell'header (rete di sicurezza: applyPaese è chiamata in render)
  const hdr=document.getElementById('hdr-paese'); if(hdr) hdr.textContent=T(P.nome);
  const intro=document.getElementById('setup-intro');   // la intro per-paese/ruolo (dinamica) vive nel SETUP; la home ha un pitch generico statico
  const introPaese=(typeof curLang==='function'&&curLang()==='en')?T(P.nome):P.nomeArt;
  if(intro) intro.textContent = (typeof chosenMode!=='undefined' && chosenMode==='opposizione')
    ? T("Parti da sfidante: a governare %PAESE è l'avversario più forte. Niente nomina dei ministri — costruisci visibilità e credibilità mese per mese e, alle prossime elezioni (tra %A anni), riprenditi il paese.").replace('%PAESE',introPaese).replace('%A',P.mandatoMesi/12)
    : T('Guiderai %PAESE come %RUOLO per %A anni. Nomina i ministri, vara ogni anno la legge di bilancio e governa mese per mese tra dossier, opportunità e imprevisti. A fine mandato, i cittadini decidono se confermarti.').replace('%PAESE',introPaese).replace('%RUOLO',T(P.titoloRuolo)).replace('%A',P.mandatoMesi/12);
  /* hero home (raster, DORMIENTE): override per-paese P.hero, poi la hero condivisa SCENES.hero.
     Vuoto → slot spento (nessun .on) → home identica finché non arriva l'arte. */
  const hero=document.getElementById('home-hero');
  if(hero){ const hs=scenaSrc(P.hero)||scenaSrc('hero');
    if(hs){ hero.innerHTML='<img src="'+hs+'" alt="" decoding="async">'; hero.classList.add('on'); }   // hero = above the fold: decode async ma MAI lazy
    else { hero.classList.remove('on'); if(hero.firstChild) hero.innerHTML=''; }
  }
}

/* ===== SCENE EVENTO (raster) — DORMIENTE finché SCENES (js/scenes.js) non è popolato.
   scenaId: carta-agenda → id-scena (kind strutturale → kicker tematico → dicastero).
   agScene: rende lo slot .ag-scene SOLO se l'arte esiste; altrimenti '' → no-scena graceful.
   Agganciato in cima a OGNI card-agenda (prima di .ah) con un solo hook. ===== */
/* scenaSrc — variant-aware, ordine SICURO: (1) stringa/data-URL → fast-path IDENTICO (finché il bucket è una stringa le
   18 scene attuali restano byte-identiche); (2) bucket = oggetto tonale {grave,base,florido} → scelta per tono, default
   SEMPRE base (mai florido di default — «la cura»); (3) array → rotazione. tono/seed opzionali: senza carta (hero) → base.
   seed = id-carta → hash stabile → variante costante per quella carta (no flicker) e rotazione a parità di tono. */
function hashId(s){ s=String(s||''); var h=0; for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } return Math.abs(h); }
/* SRC DIRETTA (lotto asset esterni) — una scena può essere un data-URL base64 (forma storica, inline nei JS)
   oppure un PATH a un file servito (`assets/scenes/…webp`). Entrambe finiscono dritte in <img src>, quindi al
   selettore basta riconoscerle: nessun caricatore, nessun fetch, nessuna cache da gestire — ci pensa il browser.
   Il riconoscimento è per FORMA (schema data:/http:, path relativo, estensione d'immagine) così i due mondi
   convivono durante la migrazione: un bucket già migrato e uno ancora base64 funzionano fianco a fianco.
   NB: le chiavi-bucket ('economia', 'hero', …) non hanno né slash né estensione → non passano mai per errore. */
function scenaSrcDiretta(x){
  if(typeof x!=='string' || !x) return null;
  if(x.slice(0,5)==='data:') return x;                                              // base64 inline (forma storica)
  return /^(?:\.{0,2}\/|assets\/|https?:)|\.(?:webp|avif|png|jpe?g)$/i.test(x) ? x : null;   // path/URL d'asset
}
function scenaPick(x, seed){                                    // risolve una variante (stringa singola o array-rotazione) → data URL o path, o null
  if(Array.isArray(x)) return x.length ? x[hashId(seed)%x.length] : null;
  return (typeof x==='string' && x) ? x : null;                 // stringa = src già pronta (data-URL o path): passa intatta
}
function scenaVarianteKey(v, tono){                             // quale sottochiave sceglierebbe il tono (default base; sceglie grave/florido solo se presenti)
  if(tono==='grave' && v.grave) return 'grave';
  if(tono==='florido' && v.florido) return 'florido';
  return 'base';
}
/* ERA-GATING SCENE (lotto E-era): una variante MODERNA non deve MAI apparire nel '50 pur di mostrare qualcosa
   (meglio nessuna scena che la riforma agraria con le pale eoliche). SCENA_ERA[bucket] = 'contemporanea' (intero
   bucket-stringa) OPPURE oggetto {variante:'contemporanea', _annoMin:1954}. Non-flaggato = universale (viva in
   ogni era). `_annoMin` è ancora supportato ma da B2 non lo usa più nessuno: i bucket d'epoca hanno arte propria. */
function scenaEraOk(id, key){
  if(typeof SCENA_ERA==='undefined' || !SCENA_ERA) return true;
  var e=SCENA_ERA[id]; if(e==null) return true;                                 // bucket non flaggato → universale
  if(typeof e==='string') return (typeof eraCombacia==='function') ? eraCombacia(e) : true;   // intero bucket-stringa
  if(e._annoMin!=null){ var y=(typeof S!=='undefined' && S && S.year) || 9999; if(y < e._annoMin) return false; }   // ancora-anno (stampa: telecamere ≥1954)
  var flag = (key!=null) ? e[key] : null;
  return (flag==null) ? true : ((typeof eraCombacia==='function') ? eraCombacia(flag) : true);
}
/* VARIANTI D'EPOCA (B2): un bucket può portare sottochiavi col TAG-ERA del motore (`italia1950`,
   `italia1960`) accanto alle tonali. Le epoche stanno dalla più recente: giocando la linea italiana
   nel 1960 sono vive entrambe (il '50 ha coda 1961, il '60 apre dal '58) e deve vincere la più vicina
   all'anno. Non trovata → null, e il selettore ripiega sul tono/base come prima. */
var SCENA_ERE = ['italia1990','italia1980','italia1970','italia1960','italia1950'];   // L42-1: cinque decenni vestiti
function scenaEraKey(v){
  if(typeof eraCombacia!=='function') return null;
  for(var i=0;i<SCENA_ERE.length;i++){ var t=SCENA_ERE[i]; if(v[t]!=null && eraCombacia(t)) return t; }
  return null;
}
/* ORDINE DI SCELTA — il tono vince quando ha arte era-viva, l'epoca copre il resto:
     1. variante d'epoca TONALE (`italia1950_grave`)  — forma prevista, oggi nessun bucket la usa
     2. tono esplicito (grave/florido) se era-viva    — una scuola «grave» resta in rovina anche nel '50
     3. scena d'epoca del bucket                      — copre il caso neutro E i `base` mancanti nel '50
     4. base se era-viva
     5. NESSUNA scena → graceful (il CSS regge lo slot vuoto) */
function scenaSrc(id, tono, seed){
  if(!id) return null;
  var diretta=scenaSrcDiretta(id); if(diretta) return diretta;                 // src diretta (es. P.hero custom): data-URL o path d'asset
  if(typeof SCENES==='undefined' || !SCENES) return null;
  var v=SCENES[id]; if(v==null) return null;
  if(typeof v==='string') return scenaEraOk(id,null) ? v : null;                // bucket-stringa: era-gate secco → null = graceful
  if(typeof v!=='object') return null;
  var key=scenaVarianteKey(v, tono), era=scenaEraKey(v), p;
  if(era && v[era+'_'+key]!=null){ p=scenaPick(v[era+'_'+key], seed); if(p) return p; }             // 1
  if(key!=='base' && v[key]!=null && scenaEraOk(id,key)){ p=scenaPick(v[key], seed); if(p) return p; }   // 2
  if(era){ p=scenaPick(v[era], seed); if(p) return p; }                                            // 3
  if(v.base!=null && scenaEraOk(id,'base')){ p=scenaPick(v.base, seed); if(p) return p; }          // 4
  return null;                                                                                     // 5
}
function scenaTono(it){ if(!it) return null;
  var t=(it.data&&it.data.tono) || it.tono;                  // esplicito per-carta → vince
  if(t==='grave'||t==='florido') return t;
  if(typeof SCENA_TONO_KIND!=='undefined' && SCENA_TONO_KIND[it.kind]) return SCENA_TONO_KIND[it.kind];   // default per kind a valenza uniforme (conflitto/puntopartito/occasione/rinnovoInt)
  return null;
}
function scenaId(it){ if(!it) return null;
  if(it.kind && typeof SCENA_DI_KIND!=='undefined' && SCENA_DI_KIND[it.kind]) return SCENA_DI_KIND[it.kind];
  const k=(it.data&&it.data.kick)||null;
  if(k && typeof SCENA_DI_KICK!=='undefined' && SCENA_DI_KICK[k]) return SCENA_DI_KICK[k];
  if(it.min && typeof SCENA_DI_MIN!=='undefined' && SCENA_DI_MIN[it.min]) return SCENA_DI_MIN[it.min];
  return null;
}
/* L9-1 — selettori delle SCENE-MOMENTO (era-aware; SCENA_MOMENTO è in scenes.js). Tornano un path o null. */
function _sm(g){ return (typeof SCENA_MOMENTO!=='undefined' && SCENA_MOMENTO && SCENA_MOMENTO[g]) ? SCENA_MOMENTO[g] : null; }
function scenaIntervista(cornice){ var M=_sm('intervista'); if(!M) return null;
  if(cornice==='commissione') return M.aula;                                   // question time in aula (universale)
  if(cornice==='vertice') return M.vertice;                                    // foro multilaterale (contemporanea)
  if(typeof eraCombacia==='function'){ if(eraCombacia('italia1950')&&M.studio_italia1950) return M.studio_italia1950;   // '50 = studio radio
    if(eraCombacia('italia1960')&&M.studio_italia1960) return M.studio_italia1960; }                                    // '60 = studio TV d'epoca
  return M.studio; }
function scenaNotte(stadio, ultima, vinta){ var M=_sm('notte'); if(!M) return null;
  if(ultima) return vinta ? M.vittoria : M.sconfitta;
  return (stadio===0) ? M.attesa : M.spoglio; }
function scenaTelefono(missed){ var M=_sm('telefono'); if(!M) return null;
  if(missed) return M.corridoio;                                               // la chiamata appena chiusa (universale)
  if(typeof eraCombacia==='function' && (eraCombacia('italia1950')||eraCombacia('italia1960'))) return M.storico;
  return M.oggi; }
function scenaSoglia(tag){ var M=_sm('soglia'); return M ? (M[tag]||null) : null; }
/* L9-1 — mappa gli ESITI reali di gameOver sui 4 finali (accorpati per tono; vedi report L9-1). */
function scenaFinale(reason){ var M=_sm('finale'); if(!M) return null;
  var trionf = ((typeof S!=='undefined'&&S) ? ((S.mandatesWon||0)>=3 || (S.biografia&&S.biografia.trionfi>=2)) : false);
  if(reason==='ritiro' || (reason==='salute'&&(typeof S==='undefined'||!S||S.esitoSalute!=='fatale')) || reason==='mandatoInt')
    return trionf ? M.trionfo : M.dignita;                                     // uscite dignitose; carriera trionfale → trionfo
  if(reason==='crisi'||reason==='insolvenza'||reason==='rivolta'||reason==='condanna'||reason==='silurato'||(reason==='salute'&&typeof S!=='undefined'&&S&&S.esitoSalute==='fatale'))
    return M.caduta;                                                           // cadute: sfiducia/insolvenza/condanna/silurato/fine-salute
  return M.oblio; }                                                            // congresso/primaria/sconfittaLocale/sconfitta netta
function agScene(it){ if(!it || typeof SCENA_MAJOR==='undefined' || !SCENA_MAJOR[it.kind]) return '';   // display selettivo (ora incl. le carte locali)
  const bucket=scenaId(it); if(!bucket) return '';
  const seed=(it.data&&it.data.id) || it.kind || bucket;   // hash stabile: id-carta → stessa variante per quella carta
  const src=scenaSrc(bucket, scenaTono(it), seed);
  /* loading=lazy + decoding=async: con le scene su file (assets/) le carte fuori schermo non pagano la rete
     e la decodifica non blocca il render. Nessun salto di layout: .ag-scene ha aspect-ratio 16/9 + fondo panel2,
     quindi lo slot occupa il suo posto anche prima che l'immagine arrivi. Inerte sui base64 (già in memoria). */
  return src?`<div class="ag-scene on"><img src="${src}" alt="" loading="lazy" decoding="async"></div>`:''; }
/* Bandiere nei bottoni del selettore paese (schermata iniziale): iniettate da PAESI[c].flag. Una volta, al boot. */
function decorateCountrySelector(){
  document.querySelectorAll('#country-seg button').forEach(function(b){ const P=PAESI[b.dataset.c]; if(P) b.innerHTML=`<span class="flag">${P.flag||''}</span><span>${T(P.nome)}</span>`; });
}

/* --- Selettore difficoltà (schermata iniziale): aggiorna chosenDiff e l'evidenziazione. --- */
function setDiff(level, btn){
  chosenDiff=level;
  if(btn){ btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('on')); btn.classList.add('on'); }
  const d=document.getElementById('diff-desc');
  if(d) d.textContent=T({facile:'Più margine su conti e consenso, meno imprevisti.', normale:'Bilanciamento standard.', difficile:'Conti, elettori ed eventi più severi su tutti i fronti.'}[level]);
}

/* --- Selettore Ruolo (schermata iniziale): al governo (classico) o all'opposizione (sfidante). Aggiorna
   chosenMode, la descrizione, l'etichetta del bottone d'avvio e l'introduzione (via applyPaese). --- */
function setMode(m, btn){
  chosenMode=m;
  if(btn){ btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('on')); btn.classList.add('on'); }
  const d=document.getElementById('mode-desc');
  if(d) d.textContent = T((m==='opposizione')
    ? 'Parti da sfidante: il governo è dell\'avversario più forte. Conquista il paese alle prossime elezioni.'
    : 'Nomini il tuo governo e guidi il paese (modalità classica).');
  const b=document.getElementById('start-btn');
  if(b) b.textContent = T((m==='opposizione') ? "Guida l'opposizione →" : 'Forma il tuo governo →');
  applyPaese();   // ri-tesse l'introduzione sul ruolo scelto
}
/* Dispatcher del bottone d'avvio: prima la schermata "Chi sei" (lotto 2), poi il ruolo scelto. */
function avviaPartita(){ apriCreazione(); }

/* ===== CHI SEI — creazione del personaggio (sistema narrativo, lotto 2). Passo nuovo del flusso
   d'avvio: raccoglie nel transitorio CREA (pattern APT); initStatoBase lo copia in S.personaggio/S.eta
   e applica i crediti d'esordio. «Salta» = CREA null = personaggio neutro (identico a prima del lotto). ===== */
function apriCreazione(){
  CREA={nome:'', genere:'m', eta:52, background:null, famiglia:'borghese', orientamento:0, religiosita:'laico', livello:3, dicastero:'economia', terrIdx:1, avatar:null, avatarCustom:null};
  document.getElementById('start').style.display='none';
  document.getElementById('crea').style.display='block';
  window.scrollTo(0,0);
  renderCreazione();
}
/* L62-1 — il «← Indietro» del setup: se ci sei arrivato da una porta storica torna alla LINEA DEL TEMPO,
   non alla home. Altrimenti il giocatore che vuole cambiare porta deve rifare tutto il giro dall'inizio. */
function chiudiCreazione(){
  if(DA_STORICI){ tornaAiStorici(); return; }
  CREA=null; document.getElementById('crea').style.display='none'; document.getElementById('start').style.display='block';
}
/* Build B — pelle d'epoca: negli scenari storici il briefing di contesto è la PRIMA cosa (prima del gabinetto).
   Once-only STRUTTURALE: proseguiAvvio è il collo-di-bottiglia della sola-partita-nuova (il load passa da applySnap,
   mai da qui) → mostrato una volta a partita, mai al reload. Niente flag in S (che pre-gabinetto non esiste ancora). */
let CONTESTO_NEXT = null;   // transiente: la prosecuzione da eseguire alla chiusura del briefing (mai serializzato)
function mostraContestoScenario(sc, onDone){
  CONTESTO_NEXT = onDone || null;
  const paras = sc.contesto.map(p=>`<p style="margin:0 0 12px;line-height:1.5;font-size:14px;color:var(--mut)">${T(p)}</p>`).join('');
  document.getElementById('modal').innerHTML =
    `<div class="mt"><div class="kicker">${T(sc.nome)}</div><h2>${T('La situazione')}</h2></div>
     <div class="mtext" style="text-align:left">${paras}</div>
     <div class="choices"><button class="btn" style="width:100%" onclick="chiudiContesto()">${T('Comincia →')}</button></div>`;
  document.getElementById('ov').classList.add('on');
}
function chiudiContesto(){ document.getElementById('ov').classList.remove('on'); const f=CONTESTO_NEXT; CONTESTO_NEXT=null; if(f) f(); }
function proseguiAvvio(){ document.getElementById('crea').style.display='none';
  const sc=(typeof SCENARI!=='undefined')?SCENARI[chosenScenario]:null;
  if(sc && sc.contesto && sc.contesto.length){ mostraContestoScenario(sc, avviaRuolo); }   // scenario storico: briefing → poi il ruolo
  else avviaRuolo();                                                                        // presente: dritto al ruolo (nessun contesto)
}
function avviaRuolo(){
  if(CREA && CREA.livello===0) startAttivista();         // Build A: la gavetta da attivista (nessuna carica, nessun bilancio)
  else if(CREA && CREA.livello===1) startLocale();       // da politico locale: sindaco/governatore di un'area
  else if(CREA && CREA.livello===2) startMinistro();     // da ministro: si salta la nomina del gabinetto (sei TU un ministro)
  else if(CREA && CREA.livello===5) startDiplomatico();  // C2: percorso diplomatico (Ambasciatore → … → Segretario)
  else if(chosenMode==='opposizione') startOpposizione();
  else goAppoint(); }
function confermaCreazione(){ proseguiAvvio(); }                  // CREA resta: initStatoBase la consuma
function saltaCreazione(){ CREA=null; proseguiAvvio(); }          // neutro: nessun credito, età 52
/* le età credibili per la carica locale: sindaco di una grande città 35-48 (def 38), presidente di regione
   40-52 (def 44 — carica di più peso). Col ritmo della scalata, da ~38 si arriva al vertice intorno ai 50. */
function etaOptLocale(terrIdx){ const TE=(PAESE.territori||[])[terrIdx]||{}; return (TE.tipo==='regione')?[40,45,50]:[35,40,45]; }   // A.5 rework: età a scatti di 5
function allineaEtaLocale(){ if(!CREA) return; const opts=etaOptLocale(CREA.terrIdx); if(opts.indexOf(CREA.eta)<0) CREA.eta=opts[1]; }   // fuori fascia → al default della carica (2ª opzione)
function setCrea(campo,val){ if(!CREA) return; CREA[campo]=val;
  if(campo==='livello'){   // età coerente col gradino di partenza
    if(val===0 && [25,30,35].indexOf(CREA.eta)<0) CREA.eta=25;         // attivista: 25/30/35 (l'età di partenza tara il ritmo, paceMul)
    if(val===1) allineaEtaLocale();                                    // locale: la fascia dipende dalla CARICA (città/regione)
    if(val===2 && [40,45,50].indexOf(CREA.eta)<0) CREA.eta=45;         // ministro
    if(val===3 && [45,50,55,60].indexOf(CREA.eta)<0) CREA.eta=50;      // capo del governo
    if(val===5 && [40,45,50].indexOf(CREA.eta)<0) CREA.eta=45;         // diplomatico (C2)
  }
  if(campo==='terrIdx' && CREA.livello===1) allineaEtaLocale();        // cambio carica → l'età si riallinea (35→44 a regione, 52→38 a città)
  renderCreazione(); }
function renderCreazione(){
  if(typeof renderPortaSetup==='function') renderPortaSetup();   // L62-1 — l'etichetta della porta (o niente, nel presente)
  const C=CREA, el=document.getElementById('crea-campi'); if(!C||!el) return;
  const tit=t=>`<div style="font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin:16px 0 7px;">${t}</div>`;
  /* L69-1 — il terzo parametro era la TAGLIA DEL TESTO, e serviva solo a scendere sotto il minimo
     leggibile (10,5px per «Punto di partenza», 11,5px per «Orientamento»). Tolto il parametro, non solo
     i due casi: finché il meccanismo esiste, l'eccezione torna. Le etichette lunghe adesso vanno a capo
     dentro i 44px, che è il comportamento giusto. */
  const seg=(campo,opts)=>`<div class="seg" style="max-width:360px;margin:0 auto;">`+opts.map(o=>`<button class="${C[campo]===o.v?'on':''}" onclick="setCrea('${campo}',${typeof o.v==='string'?`'${o.v}'`:o.v})">${o.l}</button>`).join('')+`</div>`;
  const nota=t=>`<div style="font-size:12px;color:var(--mut2);margin:8px auto 0;max-width:360px;">${t}</div>`;
  let h='';
  /* IDENTITÀ in cima (campi principali, indipendenti dal livello): nome e GENERE ben visibili.
     nome: oninput aggiorna CREA senza re-render (il re-render farebbe perdere il focus a ogni tasto) */
  h+=tit(T('Nome'));
  h+=`<input id="crea-nome" value="${escAttr(C.nome)}" oninput="if(CREA)CREA.nome=this.value" placeholder="${T('Il tuo nome (facoltativo)')}" maxlength="24" style="width:100%;max-width:360px;text-align:center;background:var(--panel);border:1px solid var(--line2);border-radius:9px;padding:8px 10px;color:var(--txt);font-family:inherit;font-size:14px">`;
  h+=tit(T('Genere'))+seg('genere',[{v:'m',l:T('Uomo')},{v:'f',l:T('Donna')}]);
  h+=nota(T('Solo narrativo: cambia qualche testo, mai i numeri. I titoli istituzionali restano invariabili.'));
  /* Volto: badge ~72px dai 10 AVATARS illustrati (L11-2) + opzione «Nessuno» (iniziale) + la tua foto.
     Tondo 88→72px con 10 volti: 4 per riga a 375px (3 righe invece di 4, blocco ~250px anziché 379).
     Solo estetico: non tocca i numeri. Se AVATARS non è caricato, la sezione si omette. */
  if(typeof AVATARS!=='undefined' && AVATARS.length){
    h+=tit(T('Volto (facoltativo)'));
    h+=`<div style="display:flex;flex-wrap:wrap;gap:9px;justify-content:center;max-width:360px;margin:0 auto;">`;
    h+=`<button onclick="setCrea('avatar',null)" title="${T('Nessun volto')}" style="width:72px;height:72px;border-radius:50%;border:2px solid ${C.avatar==null?'var(--brand)':'var(--line2)'};background:var(--panel);color:var(--mut);font-family:inherit;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">${T('Nessuno')}</button>`;   /* L69-1: 11px → 12 */
    h+=AVATARS.map(function(a){ const sel=C.avatar===a.id;
      return `<button onclick="setCrea('avatar','${a.id}')" title="Ritratto" style="width:72px;height:72px;border-radius:50%;border:2px solid ${sel?'var(--brand)':'var(--line2)'};padding:0;cursor:pointer;overflow:hidden;background:none;"><img src="${a.img}" alt="" width="72" height="72" style="display:block;width:100%;height:100%;object-fit:cover;border-radius:50%;"></button>`; }).join('');
    /* terza via: «Carica la tua foto» → input file nascosto (#crea-foto) → canvas 160px WebP → data URL in C.avatarCustom.
       Una volta caricata, la tile mostra l'anteprima ed è selezionabile come un ritratto; il badge ↻ ri-apre il picker. */
    const cust=C.avatarCustom;
    if(cust){ const selC=C.avatar===cust;
      h+=`<div style="position:relative;width:72px;height:72px;">`
        +`<button onclick="selezionaFotoCustom()" title="${T('La tua foto')}" style="width:72px;height:72px;border-radius:50%;border:2px solid ${selC?'var(--brand)':'var(--line2)'};padding:0;cursor:pointer;overflow:hidden;background:none;"><img src="${cust}" alt="" width="72" height="72" style="display:block;width:100%;height:100%;object-fit:cover;border-radius:50%;"></button>`
        +`<button onclick="document.getElementById('crea-foto').click()" title="${T('Cambia foto')}" aria-label="${T('Cambia foto')}" style="position:absolute;right:-3px;bottom:-3px;width:27px;height:27px;border-radius:50%;border:1px solid var(--line2);background:var(--panel);color:var(--mut);font-size:13px;line-height:1;cursor:pointer;font-family:inherit;padding:0;">↻</button>`
        +`</div>`;
    } else {
      h+=`<button onclick="document.getElementById('crea-foto').click()" title="${T('Carica la tua foto')}" style="width:72px;height:72px;border-radius:50%;border:2px dashed var(--line2);background:var(--panel);color:var(--mut);font-family:inherit;font-size:12px;line-height:1.15;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:5px;"><span style="font-size:19px;line-height:1">+</span>${T('La tua foto')}</button>`;   /* L69-1: 10,5px → 12 (il «+» scende a 19 per far stare l'etichetta nei 72px) */
    }
    h+=`</div>`;
    h+=nota(T('Scegli un volto per il tuo personaggio, o lascia l\'iniziale del nome.'));
  }
  /* punto di partenza (lotto ascesa): dal politico locale fino al capo del governo — la stessa carriera, da gradini diversi */
  h+=tit(T('Punto di partenza'))+seg('livello',[{v:0,l:T('Attivista')},{v:1,l:T('Politico locale')},{v:2,l:T('Ministro')},{v:3,l:T('Capo del governo')},{v:5,l:T('Diplomatico')}]);
  if(C.livello===0){
    h+=nota(T('Il gradino zero: un attivista di 25 anni, senza carica né bilancio. Costruisci una base militante e la reputazione presso i gruppi, mese dopo mese, fino alla prima candidatura — da cui comincia la scala.'));
  } else if(C.livello===1){
    h+=nota(T('Il gradino più basso e il più giovane: sindaco di una città o presidente di una regione. Amministra bene, costruisci la notorietà, e il partito ti chiamerà a Roma. La stessa carriera, dalla gavetta.'));
    h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;max-width:360px;margin:9px auto 0;">`
      +(PAESE.territori||[]).map(function(TE,i){ const sel=C.terrIdx===i; const isC=TE.tipo==='città';   // (param rinominato da T: oscurava la funzione i18n)
        return `<button onclick="setCrea('terrIdx',${i})" style="padding:8px;border-radius:9px;border:1px solid ${sel?'var(--brand)':'var(--line2)'};background:${sel?'var(--acc-bg)':'var(--panel)'};color:var(--txt);font-family:inherit;font-size:12px;cursor:pointer;text-align:left;"><b>${nomeTerr(TE)}</b><br><span style="font-size:12px;color:var(--mut2)">${caricaTerr(TE)} · ${T(isC?'città':'regione')}</span></button>`; }).join('')+`</div>`;
  } else if(C.livello===2){
    h+=nota(T('Cominci più in basso: un dicastero sotto il premier del tuo partito. La stessa carriera, dal gradino prima — scala fino al vertice.'));
    h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;max-width:360px;margin:9px auto 0;">`
      +MINISTRIES.map(function(M){ const _nm=(typeof dicNm==='function'?dicNm(M.id):M.nm); return `<button onclick="setCrea('dicastero','${M.id}')" style="padding:9px 8px;border-radius:9px;border:1px solid ${C.dicastero===M.id?'var(--brand)':'var(--line2)'};background:${C.dicastero===M.id?'var(--acc-bg)':'var(--panel)'};color:var(--txt);font-family:inherit;font-size:12px;cursor:pointer;">${T(_nm)}</button>`; }).join('')+`</div>`;   // D3: nomi era-aware nel selettore
  } else if(C.livello===5){
    h+=nota(T('Il percorso alternativo: cominci dalla diplomazia, come Ambasciatore. Non governi mai un paese — sali costruendo rapporti e credito, missione dopo missione, fino alla chiamata a Segretario generale delle Nazioni Unite.'));
  } else h+=nota(T('Il gioco pieno, dall\'insediamento: nomini il governo e guidi il paese.'));
  const etaOpts=(C.livello===0?[25,30,35]:C.livello===1?etaOptLocale(C.terrIdx):C.livello===2?[40,45,50]:C.livello===5?[40,45,50]:[45,50,55,60]);   // A.5 rework: età a scatti di 5
  h+=tit(T('Età'))+seg('eta',etaOpts.map(n=>({v:n,l:String(n)})));
  if(C.livello===1){ const reg=((PAESE.territori||[])[C.terrIdx]||{}).tipo==='regione';
    h+=nota(T(reg?'Presidente di regione: una carica di peso, <b>40-52 anni</b>.':'Sindaco di una grande città: <b>35-48 anni</b>. Col ritmo della scalata, da ~38 si arriva al vertice intorno ai 50.')); }
  else h+=nota(T('Più giovane: più carriera davanti e più energia, meno autorevolezza · Più anziano: più rispetto, meno tempo.'));
  h+=tit(T('Background professionale'));
  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;max-width:360px;margin:0 auto;">`
    +[{id:null,nome:'Funzionario di partito'}].concat(BACKGROUNDS).map(b=>
      /* L69-1 — anche questa griglia a norma: era alta 35,1px. Con `min-height` e il centraggio, i nomi
         lunghi («Avvocato / Magistrato») vanno a capo dentro i 44 invece di allargare la colonna. */
      `<button onclick="setCrea('background',${b.id?`'${b.id}'`:'null'})" style="display:flex;align-items:center;justify-content:center;text-align:center;min-height:44px;padding:8px;border-radius:9px;border:1px solid ${C.background===b.id?'var(--brand)':'var(--line2)'};background:${C.background===b.id?'var(--acc-bg)':'var(--panel)'};color:var(--txt);font-family:inherit;font-size:12.5px;line-height:1.2;cursor:pointer;">${T(b.nome)}</button>`).join('')+`</div>`;
  const B=BACKGROUNDS.find(b=>b.id===C.background);
  h+=nota(B?T(B.desc):T('La politica è la tua professione: nessun credito particolare, nessuna diffidenza.'));
  h+=tit(T('Famiglia'))+seg('famiglia',[{v:'umili',l:T('Origini umili')},{v:'borghese',l:T('Borghese')},{v:'dinastia',l:T('Dinastia')}]);
  const F=FAMIGLIE.find(f=>f.id===C.famiglia);
  h+=nota(F?T(F.desc):'');
  h+=tit(T('Orientamento personale'))+seg('orientamento',[{v:-2,l:T('Sinistra')},{v:-1,l:T('Centro-sx')},{v:0,l:T('Centro')},{v:1,l:T('Centro-dx')},{v:2,l:T('Destra')}]);
  h+=tit(T('Religiosità'))+seg('religiosita',[{v:'laico',l:gnCrea('Laico','Laica')},{v:'credente',l:T('Credente')},{v:'devoto',l:gnCrea('Devoto','Devota')}]);
  h+=nota(T('Le tue convinzioni personali, non la linea del partito. Per ora solo registrate: conteranno più avanti.'));
  el.innerHTML=h;
}
/* il participio nella schermata di creazione (S non esiste ancora: legge CREA, non S.personaggio) */
function gnCrea(m,f){ return T((CREA&&CREA.genere==='f')?f:m); }

/* Ri-seleziona la foto già caricata (come scegliere un ritratto). Il campo avatar diventa il data URL stesso,
   così S.personaggio.avatar lo porta e avatarImg() lo mostra ovunque (header, bilancio). */
function selezionaFotoCustom(){ if(CREA && CREA.avatarCustom) setCrea('avatar', CREA.avatarCustom); }

/* Carica una foto personale: file → canvas (ritaglio quadrato cover-fit centrato, ~160px) → WebP 0.8 (JPEG di
   ripiego) → data URL, salvato in CREA.avatarCustom e selezionato. Tutto nativo/offline (createImageBitmap +
   canvas + FileReader impliciti), iOS-safe. EXIF: createImageBitmap {imageOrientation:'from-image'} raddrizza
   i selfie verticali. L'immagine finisce nel salvataggio (S), MAI nel dist. Graceful: annullo/non-immagine/errore
   → no-op, nessun crash; senza foto il ripiego iniziale resta. */
async function caricaAvatarFile(input){
  try{
    var file = input && input.files && input.files[0];
    try{ input.value=''; }catch(e){}                                   // permette di ri-scegliere lo stesso file
    if(!file || !/^image\//.test(file.type||'')) return;               // annullo o non-immagine → no-op
    var SZ=160, bmp=null;
    try{ bmp = await createImageBitmap(file, {imageOrientation:'from-image'}); }   // EXIF applicato: viene dritto
    catch(e){ bmp = await createImageBitmap(file); }                                // ripiego (motore senza l'opzione)
    var cv=document.createElement('canvas'); cv.width=SZ; cv.height=SZ;
    var ctx=cv.getContext('2d');
    var iw=bmp.width, ih=bmp.height, side=Math.min(iw,ih);
    ctx.drawImage(bmp, (iw-side)/2, (ih-side)/2, side, side, 0, 0, SZ, SZ);         // cover-fit quadrato centrato
    if(bmp.close) bmp.close();
    var url=''; try{ url=cv.toDataURL('image/webp',0.8); }catch(e){}
    if(!url || url.slice(0,15)!=='data:image/webp') url=cv.toDataURL('image/jpeg',0.82);   // WebP non supportato → JPEG
    if(!CREA || !url) return;
    CREA.avatarCustom=url; CREA.avatar=url;                            // caricata e selezionata
    renderCreazione();
  }catch(e){ /* qualunque errore: no-op silenzioso, il ripiego iniziale resta */ }
}

/* --- Selettore Paese + Partito (schermata iniziale). Cambiando paese, PAESE diventa attivo, la cornice
   si aggiorna (applyPaese) e il partito di default torna al più forte (primo in elenco) del nuovo paese. --- */
function setCountry(c){
  chosenCountry=c; chosenScenario='presente'; PAESE=PAESI[c]; chosenPartito=PAESE.partiti[0].id;   // Build B: cambiare paese riazzera lo scenario (gli scenari sono per-paese)
  document.querySelectorAll('#country-seg button').forEach(b=>b.classList.toggle('on', b.dataset.c===c));
  applyPaese(); renderStartParties();
  if(typeof CREA!=='undefined' && CREA) renderCreazione();   // setup aperto: il punto-di-partenza locale dipende dai territori del paese → rirendi i campi
}
/* Build B — scelta dello scenario d'epoca. Sovrappone la lista-partiti dell'epoca al PAESE base (CLONE, mai muta
   PAESI). 'presente' = nessun override. Se lo scenario fissa un paese (es. italia1950), allinea anche il paese. */
function setScenario(id){
  const sc=(typeof SCENARI!=='undefined' && SCENARI[id]) ? SCENARI[id] : SCENARI.presente;
  chosenScenario=sc.id;
  if(sc.paese) chosenCountry=sc.paese;
  const base=PAESI[chosenCountry];
  PAESE = (typeof paeseConScenario==='function') ? paeseConScenario(base, sc.id==='presente'?null:sc) : base;   // (ii) overlay partiti+ue+intermedie
  chosenPartito=PAESE.partiti[0].id;
  document.querySelectorAll('#country-seg button').forEach(b=>b.classList.toggle('on', b.dataset.c===chosenCountry));
  applyPaese(); renderStartParties();
  if(typeof CREA!=='undefined' && CREA) renderCreazione();
}
/* L48-1 · IL SELETTORE A DUE LIVELLI. Con le porte di più paesi la lista crescerebbe senza fine: si mostrano
   solo quelle del paese scelto (e «Presente», che vale per tutti). Il dato per filtrare c'era già — `SCENARI`
   ha il campo `paese` da sempre. Se il paese cambia e lo scenario attivo non gli appartiene più, si torna al
   presente: è la stessa regola che `setCountry` applica già, resa visibile. */
/* ================================================================================================================
   L57-1 · LA VISTA DEGLI SCENARI — riorganizzata, non reinventata. `SCENARI` ha già `paese`, `setScenario`
   sposta già il paese: qui cambia solo come si arriva alle porte.
   ⚑ E LA STRISCIA ORA SI GENERA. Era scritta a mano in `index.html`, e il conto non tornava: `uk1960`,
   aggiunto in L55-1, **non aveva un bottone** — la nona porta esisteva nei dati ed era irraggiungibile.
   Nessuna guardia poteva vederlo: il markup non si esegue, e il banco headless non apre la home. Generandola
   da `SCENARI`, quella classe di difetto sparisce.
   ================================================================================================================ */
var SOGLIE={ presente:'assets/scenes/soglia-presente.webp', italia1950:'assets/scenes/soglia-1950.webp',
             italia1960:'assets/scenes/soglia-1960.webp', italia1970:'assets/scenes/soglia-1970.webp',
             italia1980:'assets/scenes/soglia-1980.webp', italia1990:'assets/scenes/soglia-1990.webp',
             italia2000:'assets/scenes/soglia-2000.webp' };
function sogliaHtml(id){   // degrado pulito: chi non ha la miniatura riceve il segnaposto, non un'immagine rotta
  return SOGLIE[id] ? '<img class="soglia-thumb" src="'+SOGLIE[id]+'" alt="">'
                    : '<span class="soglia-thumb soglia-vuota" aria-hidden="true"></span>';
}
/* le porte STORICHE di un paese, in ordine cronologico (il presente non è una porta storica) */
function portePaese(c){
  if(typeof SCENARI==='undefined') return [];
  return Object.keys(SCENARI).map(function(k){ return SCENARI[k]; })
    .filter(function(sc){ return sc.id!=='presente' && sc.paese===c; })
    .sort(function(a,b){ return (a.anno||0)-(b.anno||0); });
}
/* i paesi che HANNO una linea storica: la lista cresce da sola col fronte, e chi non ce l'ha non compare
   (non compare disabilitato: è il paletto della consegna) */
function paesiConLinea(){
  if(typeof SCENARI==='undefined') return [];
  var visti={}, out=[];
  Object.keys(SCENARI).forEach(function(k){ var sc=SCENARI[k];
    if(sc.id==='presente' || !sc.paese || visti[sc.paese]) return;
    visti[sc.paese]=1; out.push(sc.paese);
  });
  return out;
}
/* L62-1 — `renderScenarioSeg` e `renderScenariPaese` sono state TOLTE insieme alla striscia che riempivano,
   e con loro le due `querySelectorAll('#scenario-seg button')` di `setCountry` e `setScenario`: codice che
   punta a un elemento inesistente è della stessa famiglia del commento stale — non fa danni e mente.
   Le porte storiche continuano a generarsi da `SCENARI` in `portePaese`, che resta e serve la pagina
   storica: il difetto della porta irraggiungibile trovato in L57-1 non può tornare. */

/* ================================================================================================================
   L62-1 · UNA STRADA SOLA PER GLI SCENARI STORICI.
   Il difetto, dal playtest: la pagina «Scenari storici» era nuova (L57-1) ma la striscia-scenario era rimasta
   nel setup — da «Gioca oggi» si sceglieva il paese e ci si ritrovavano le porte storiche lì dentro. Due strade
   per la stessa stanza. Ora: «Gioca oggi» → presente e basta; le porte → solo dalla pagina a due passi.
   `DA_STORICI` è **transitorio di vista**, come `STORICI_PAESE`: la porta da cui si è entrati, per mostrarla
   come etichetta e per sapere dove tornare. Non entra mai in `S` (non è stato di partita: è come ci sei
   arrivato) e non sopravvive a un reload — e non deve, perché al reload si riparte dalla home.
   ================================================================================================================ */
var DA_STORICI=null;
function renderPortaSetup(){
  var box=document.getElementById('porta-fissa'), bp=document.getElementById('blocco-paese');
  if(!box) return;
  if(!DA_STORICI || typeof SCENARI==='undefined' || !SCENARI[DA_STORICI]){
    box.innerHTML=''; if(bp) bp.style.display='';       // presente: il paese si sceglie, come sempre
    return;
  }
  /* dalla porta storica il paese NON si sceglie: lo fissa la porta. Mostrarlo come selettore sarebbe la stessa
     ambiguità di prima, al contrario — un comando che non comanda. Chi cambia idea torna alla linea del tempo. */
  if(bp) bp.style.display='none';
  var sc=SCENARI[DA_STORICI], pn=(PAESI[sc.paese]||{}).nome||sc.paese;
  box.innerHTML='<div style="max-width:360px;margin:14px auto 0;display:flex;align-items:center;gap:10px;'
    +'padding:10px 12px;border:1px solid var(--line2);border-radius:10px;text-align:left">'
    +sogliaHtml(sc.id)
    +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--mut)">'+T('Scenario')+'</div>'
      +'<div style="font-weight:600">'+T(pn)+', '+(sc.anno||'')+'</div>'
    +'</div></div>'
    /* L68-1 — anche il ritorno è un bersaglio toccabile: era alto 20,6px, il peggiore di tutta la strada
       storica (ed era mio, di L62-1). min-height 44 e il testo resta a 13px. */
    +'<div style="max-width:360px;margin:2px auto 0;text-align:left">'
      +'<button onclick="tornaAiStorici()" style="display:inline-flex;align-items:center;min-height:44px;'
      +'background:transparent;border:none;color:var(--mut);'
      +'font-family:inherit;font-size:13px;cursor:pointer;padding:0 8px 0 0;text-decoration:underline">'
      +'← '+T('Cambia porta')+'</button></div>';
}
function tornaAiStorici(){     // dal setup si torna alla LINEA DEL TEMPO del paese giusto, non alla lista dei paesi
  var sc=(typeof SCENARI!=='undefined' && DA_STORICI) ? SCENARI[DA_STORICI] : null;
  DA_STORICI=null;
  if(typeof CREA!=='undefined') CREA=null;
  document.getElementById('crea').style.display='none';
  STORICI_PAESE=(sc && sc.paese) ? sc.paese : null;
  document.getElementById('storici').style.display='block';
  window.scrollTo(0,0); renderStorici();
}
/* ---- I DUE MODI DELLA HOME ---- */
function avviaOggi(){          // il presente, dritto: un tocco in meno (lo scenario non si sceglie più)
  DA_STORICI=null;
  if(typeof setScenario==='function') setScenario('presente');
  apriCreazione();
}
var STORICI_PAESE=null;        // transitorio della vista: quale paese si sta guardando (mai in S)
function apriStorici(){
  STORICI_PAESE=null;
  document.getElementById('start').style.display='none';
  document.getElementById('storici').style.display='block';
  window.scrollTo(0,0); renderStorici();
}
function chiudiStorici(){
  document.getElementById('storici').style.display='none';
  document.getElementById('start').style.display='block';
}
function storiciIndietro(){    // il ritorno dev'essere ovvio: dalla linea del tempo ai paesi, dai paesi alla home
  if(STORICI_PAESE){ STORICI_PAESE=null; renderStorici(); window.scrollTo(0,0); }
  else chiudiStorici();
}
function storiciPaese(c){ STORICI_PAESE=c; renderStorici(); window.scrollTo(0,0); }
function storiciPorta(id){     // scelta la porta: si entra nel setup con paese e scenario già impostati
  document.getElementById('storici').style.display='none';
  if(typeof setScenario==='function') setScenario(id);
  DA_STORICI=id;               // L62-1 — dopo setScenario: il setup la mostra come etichetta e sa dove tornare
  apriCreazione();
}
function renderStorici(){
  var b=document.getElementById('storici-body'); if(!b) return;
  if(!STORICI_PAESE){
    var cc=paesiConLinea();
    b.innerHTML='<div class="em" style="margin:0 0 4px">'+T('Scenari storici')+'</div>'
      +'<p style="font-size:13.5px;color:var(--mut);margin:0 0 16px;line-height:1.5">'
      +T('Scegli il paese: ogni linea storica ha le sue porte, una per decennio.')+'</p>'
      +'<div class="cands">'+cc.map(function(c){
          var p=PAESI[c]||{}, n=portePaese(c).length;
          return '<button class="cand" onclick="storiciPaese(\''+c+'\')">'
            +'<span class="cn">'+T(p.nome||c)+'</span>'
            +'<span class="cmeta"><small style="color:var(--mut2)">'+n+' '+T(n===1?'porta':'porte')+'</small></span></button>';
        }).join('')+'</div>';
    return;
  }
  var porte=portePaese(STORICI_PAESE), pn=(PAESI[STORICI_PAESE]||{}).nome||STORICI_PAESE;
  /* L68-1 — la linea del tempo è una LISTA VERTICALE, una riga per decennio: miniatura a sinistra, l'anno
     grande a destra col suo briefing. Sette porte in orizzontale su 375px non ci stanno, e nessuna taratura
     le fa stare. Il briefing era una lista SEPARATA sotto la striscia (stessi nomi, due volte): adesso sta
     dentro la riga che apre quella porta, che è il posto dove serve per scegliere.
     Una forma sola a ogni larghezza, non due: L57-1 insegna che ciò che non si esegue nessuno lo controlla. */
  b.innerHTML='<div class="em" style="margin:0 0 4px">'+T(pn)+'</div>'
    +'<p style="font-size:13.5px;color:var(--mut);margin:0 0 16px;line-height:1.5">'
    +T('La linea del tempo: scegli da dove cominciare.')+'</p>'
    +'<div class="linea-porte" id="storici-linea">'+porte.map(function(sc){
        var riga=(sc.intro||'');
        return '<button aria-label="'+escAttr(T(sc.nome))+'" onclick="storiciPorta(\''+sc.id+'\')">'
          +sogliaHtml(sc.id)
          +'<span class="pt-txt">'
            +'<span class="pt-anno">'+(sc.anno||T(sc.nome))+'</span>'
            +(riga?'<span class="pt-brief">'+T(riga)+'</span>':'')
          +'</span></button>';
      }).join('')+'</div>';
}
function renderStartParties(){
  const el=document.getElementById('party-list'); if(!el) return;
  el.innerHTML=PAESE.partiti.map(p=>`<button class="cand ${p.id===chosenPartito?'on':''}" onclick="setPartito('${p.id}')">
    <span class="cn">${T(p.nome)}</span>
    <span class="cmeta"><small style="color:var(--mut2)">${T(p.orientamento)}</small> <span class="mono" style="color:var(--mut)">${p.forza}%</span></span></button>`).join('');
}
function setPartito(id){ chosenPartito=id; renderStartParties(); }

/* ===== Persistenza — UI (schermata iniziale, modale "Partita", carriere). Il nucleo è in game.js. ===== */
function escAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
/* participi concordati col genere del personaggio IN CORSO (gn, game.js); per le carriere passate
   showCarriere usa l'etichetta CONGELATA alla chiusura (c.esitoTesto) — il genere era di quel personaggio */
function esitoLabel(r){ return ({crisi:gn('caduto per crisi di governo','caduta per crisi di governo'), insolvenza:gn('travolto dall\'insolvenza','travolta dall\'insolvenza'), rivolta:gn('caduto per la rivolta di un gruppo','caduta per la rivolta di un gruppo'), congresso:gn('sostituito dal partito','sostituita dal partito'), voto:gn('battuto al voto','battuta al voto'), primaria:gn('sconfitto alle primarie','sconfitta alle primarie'), ritiro:gn('ritirato a vita privata','ritirata a vita privata'), condanna:gn('travolto da una condanna','travolta da una condanna'), salute:T('per ragioni di salute'), silurato:gn('silurato dal premier','silurata dal premier'), sconfittaLocale:gn('sconfitto alle comunali','sconfitta alle comunali')})[r] || (r||T('concluso')); }   // i18n: frasi INTERE dentro gn (in EN convergono)
function renderStartPersistence(){
  const cont=document.getElementById('start-continue');
  if(cont){
    let html='';
    const t=lsGet('hos_autosave');
    if(t){ const p=parseSave(t); if(p.save){ const s=p.save.s; const pn=((PAESI[s.paese]||{partiti:[]}).partiti.find(function(x){return x.id===s.partito;})||{}).nome||'';
      html=`<div class="card" style="border-color:var(--brand);max-width:420px;margin:0 auto 16px;text-align:left"><div style="padding:12px 14px">
        <div class="contorno" style="letter-spacing:.16em;text-transform:uppercase;color:var(--brand)">${T('Carriera in corso')}</div>
        <div style="font-weight:600;font-size:15px;margin:3px 0 1px">${(PAESI[s.paese]||{}).nome||''} · ${escAttr(pn)}</div>
        <div style="font-size:12.5px;color:var(--mut)">${T("Anno")} ${s.year} · ${s.opposizione ? (s.mandate>0 ? `${T("Mandato")} ${s.mandate} ${T("· all'opposizione")}` : T("Sfidante all'opposizione")) : `${T("Mandato")} ${s.mandate}`}</div>
        <button class="btn" style="margin-top:10px;width:100%" onclick="continuaCarriera()">${T('Continua la carriera →')}</button></div></div>`;
    }}
    if(!storageOK()) html+=`<div class="note" style="border-color:var(--warn);color:var(--warn-ink);max-width:420px">${T('Salvataggio non disponibile in questo contesto: la partita gira lo stesso, ma <b>senza salvataggio automatico</b>. Usa <b>Esporta</b> dal menu ≡ per portarla via.')}</div>`;
    cont.innerHTML=html;
  }
  const prof=document.getElementById('start-profile');
  if(prof){ const pr=getProfilo();   // il nome si sceglie UNA volta, nella creazione del personaggio: qui solo lo storico
    prof.innerHTML=pr.carriere.length?`<div style="margin-top:16px"><button onclick="showCarriere()" style="background:transparent;border:none;color:var(--brand);font-family:inherit;font-size:13px;text-decoration:underline;cursor:pointer">${T('Le tue carriere')} (${pr.carriere.length}) →</button></div>`:'';
  }
}
function hideMenu(){ const m=document.getElementById('menu'); if(m) m.classList.remove('on'); }
/* E4c — audio rimosso per scelta (verdetto playtest): il gioco è muto. Nei save vecchi può esistere
   S.audio: campo ignoto e innocuo — nessuno lo legge, il round-trip lo trasporta senza effetti. */
function showPartita(){
  if(!S) return;
  const ok=storageOK();   // localStorage disponibile? (file:// su iOS lo blocca → degrada su export/import file)
  let h=`<div class="mt"><div class="kicker">${T('Partita')}</div><h2>${T('Salva e carica')}</h2></div>`;
  h+=`<div class="seg" id="lang-seg-menu" style="max-width:200px;margin:0 auto 10px;">
      <button data-l="it" class="${curLang()==='it'?'on':''}" onclick="setLang('it')">Italiano</button>
      <button data-l="en" class="${curLang()==='en'?'on':''}" onclick="setLang('en')">English</button></div>`;
  h+=`<div class="mtext">${T(aMetaMese()?"Sei a metà mese: il salvataggio riprenderà <b>dall'inizio del mese corrente</b>.":"Fotografia al confine del mese corrente.")}</div>`;
  h+=`<div class="choices">`;
  if(!ok) h+=`<div class="note" style="border-color:var(--warn);color:var(--warn-ink)">${T('Su questo dispositivo il salvataggio nel browser non è disponibile (stai aprendo il gioco da file locale). Per non perdere la carriera usa <b>Scarica file</b> qui sotto, e riprendila con <b>Importa</b>.')}</div>`;
  if(ok) for(let i=0;i<3;i++){ const info=slotInfo(i);
    h+=`<div class="opt" style="cursor:default"><div class="ol">${T('Slot')} ${i+1}${(info&&!info.corrotto)?': '+escAttr(info.nome):''}</div>`;
    h+=(info&&!info.corrotto)
      ? `<div class="oe">${info.paese} · ${escAttr(info.partito)} · ${T('anno')} ${info.anno}${(info.opp&&!info.mandato)?' · '+T('sfidante'):`, ${T('mandato')} ${info.mandato}${info.opp?' ('+T('opp.')+')':''}`}</div>
         <div style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap"><button class="mini-btn" onclick="uiSlotSave(${i})">${T('Sovrascrivi')}</button><button class="mini-btn" style="color:var(--brand);border-color:var(--brand)" onclick="uiSlotLoad(${i})">${T('Carica')}</button><button class="mini-btn" style="color:var(--neg);border-color:var(--neg)" onclick="uiSlotDel(${i})">${T('Elimina')}</button></div>`
      : `<div class="oe">${T(info&&info.corrotto?'salvataggio corrotto':'vuoto')}</div><div style="margin-top:7px"><button class="mini-btn" onclick="uiSlotSave(${i})">${T('Salva qui')}</button></div>`;
    h+=`</div>`;
  }
  h+=`<div class="opt" style="cursor:default"><div class="ol">${ok?T('Esporta / Importa'):T('Salva la carriera in un file')}</div><div class="oe">${T('Sposta la carriera tra PC e telefono.')}</div>
    <textarea id="io-text" readonly style="width:100%;height:60px;margin-top:7px;background:var(--bg2);border:1px solid var(--line2);border-radius:8px;color:var(--mut);font-family:'IBM Plex Mono',monospace;font-size:10px;padding:6px;resize:vertical"></textarea>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="mini-btn" onclick="uiExport()">${T('Esporta')}</button><button class="mini-btn" onclick="uiCopy()">${T('Copia')}</button><button class="mini-btn" onclick="uiDownload()">${T('Scarica file')}</button><button class="mini-btn" style="color:var(--brand);border-color:var(--brand)" onclick="uiImportToggle()">${T('Importa…')}</button></div>
    <div id="io-msg" style="font-size:12px;color:var(--mut);margin-top:6px"></div></div>`;
  h+=`<button class="opt" onclick="abbandonaPartita()"><span class="ol" style="color:var(--neg)">${T('Torna al menu iniziale')}</span><span class="oe">${T('Abbandona la partita in corso e torna alla schermata iniziale (nuova partita / cambia paese).')}</span></button>`;
  h+=`<button class="opt" onclick="hideMenu()"><span class="ol">${T('Chiudi')}</span></button></div>`;
  document.getElementById('menu-modal').innerHTML=h;
  document.getElementById('menu').classList.add('on');
}
/* TORNA AL MENU INIZIALE (fix playtest #3): abbandona la partita e riporta alla home, dove si inizia una nuova partita o si
   cambia paese. Con conferma (interrompe la partita). Un flusso solo con «Nuova partita»: abbandona → home → nuova. */
function abbandonaPartita(){
  if(!confirm(T('Abbandonare la partita e tornare al menu iniziale? I progressi non salvati andranno persi.'))) return;
  hideMenu();
  S=null;
  ['game','appoint','over','crea','menu'].forEach(function(id){ var e=document.getElementById(id); if(e){ e.style.display=(id==='menu')?'':'none'; if(id==='menu') e.classList.remove('on'); } });
  const st=document.getElementById('start'); if(st) st.style.display='block';
  try{ resetUIAnim(); }catch(e){}
  try{ if(typeof renderStartPersistence==='function') renderStartPersistence(); }catch(e){}   // aggiorna «Continua la carriera» sulla home
  window.scrollTo(0,0);
}
function uiSlotSave(i){ const cur=(slotInfo(i)||{}).nome || (S&&S.personaggio&&S.personaggio.nome) || T('Carriera'); const nome=prompt(T('Nome dello slot %N:').replace('%N',i+1), cur); if(nome===null) return; if(!salvaSlot(i,nome)) alert(T('Salvataggio non riuscito (storage non disponibile).')); showPartita(); }
function uiSlotLoad(i){ if(!confirm(T('Caricare lo slot %N? La partita in corso verrà sostituita.').replace('%N',i+1))) return; const r=caricaSlot(i); if(r.err) alert(r.err); else { hideMenu(); if(r.warn) alert(r.warn); } }
function uiSlotDel(i){ if(!confirm(T('Eliminare lo slot %N?').replace('%N',i+1))) return; eliminaSlot(i); showPartita(); }
function uiExport(){ const ta=document.getElementById('io-text'); ta.readOnly=true; ta.value=exportText(); ta.focus(); ta.select(); document.getElementById('io-msg').textContent=T('Pronto: copia il testo o scarica il file.'); }
function uiCopy(){ const ta=document.getElementById('io-text'); if(!ta.value) ta.value=exportText(); ta.readOnly=false; ta.focus(); ta.select(); let ok=false; try{ ok=document.execCommand('copy'); }catch(e){} ta.readOnly=true; document.getElementById('io-msg').textContent= ok?T('Copiato negli appunti.'):T('Seleziona tutto il testo e copia a mano.'); }
function uiDownload(){ const txt=exportText(); try{ const b=new Blob([txt],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='head-of-state-'+(S?S.paese:'partita')+'.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ try{URL.revokeObjectURL(a.href);}catch(e){} },1500); document.getElementById('io-msg').textContent=T('File scaricato.'); }catch(e){ document.getElementById('io-msg').textContent=T('Download non disponibile qui: usa Copia.'); } }
function uiImportToggle(){ const ta=document.getElementById('io-text'); ta.readOnly=false; ta.value=''; ta.placeholder=T('Incolla qui un salvataggio…'); ta.focus(); document.getElementById('io-msg').innerHTML=`<button class="mini-btn" style="color:var(--brand);border-color:var(--brand)" onclick="uiImportDo()">${T('Carica dal testo')}</button>`; }
function uiImportDo(){ const ta=document.getElementById('io-text'); const r=caricaSalvataggio(ta.value); if(r.err){ document.getElementById('io-msg').innerHTML='<span style="color:var(--neg)">'+escAttr(r.err)+'</span>'; } else { hideMenu(); if(r.warn) alert(r.warn); } }
function showCarriere(){
  const pr=getProfilo();
  let h=`<div class="mt"><div class="kicker">${T('Storico')}</div><h2>${T('Le tue carriere')}</h2></div>`;
  if(!pr.carriere.length) h+=`<div class="mtext">${T('Ancora nessuna carriera conclusa. Le partite finite compariranno qui.')}</div>`;
  else h+=`<div style="padding:0 18px 8px">`+pr.carriere.map(function(c){ return `<div style="padding:8px 0;border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:600;font-size:13.5px">${escAttr(c.paese)} · ${escAttr(c.partito)}</span><span class="mono" style="font-size:12px;color:var(--mut)">${c.mandati} ${T('mandati')}</span></div><div style="font-size:12px;color:var(--mut)">${c.nome?escAttr(c.nome)+' · ':''}${c.anni} ${T('anni al potere')} · ${escAttr(c.esitoTesto||'')||esitoLabel(c.esito)}</div>${(c.tratti&&c.tratti.length)?`<div style="font-size:12px;color:var(--acc-ink);margin-top:2px">${c.tratti.map(escAttr).join(' · ')}</div>`:''}${c.racconto?`<div style="font-size:12px;color:var(--mut2);margin-top:3px;font-style:italic">${escAttr(c.racconto)}</div>`:''}</div>`; }).join('')+`</div>`;
  h+=`<div class="choices"><button class="opt" onclick="hideMenu()"><span class="ol">${T('Chiudi')}</span></button></div>`;
  document.getElementById('menu-modal').innerHTML=h;
  document.getElementById('menu').classList.add('on');
}

/* --- Pagina "Come si gioca": costruita AL MOMENTO dell'apertura, così legge sempre lo stato corrente
   (difficoltà e paese), non una copia congelata. Solo testo: non tocca S, agenda o avanzamento. --- */
function showHelp(){
  const D = S ? dif() : DIFFICOLTA[chosenDiff];   // in partita: S.diff; nella schermata iniziale: livello scelto
  const P = PAESE; const anni = P.mandatoMesi/12;
  document.getElementById('help-modal').innerHTML = buildHelp(D, P, anni);
  document.getElementById('help').classList.add('on');
}
function hideHelp(){ document.getElementById('help').classList.remove('on'); }
function buildHelp(D, P, anni){
  const sec=(t,b)=>`<div class="card"><div class="ct">${T(t)}</div><div class="log"><div class="li">${b}</div></div></div>`;
  return `<div class="mt" style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
      <div><div class="kicker">${T('Guida')}</div><h2>${T('Come si gioca')}</h2></div>
      <button onclick="hideHelp()" aria-label="${T('Chiudi')}" style="background:transparent; border:1px solid var(--line2); color:var(--mut); border-radius:9px; width:30px; height:30px; font-size:16px; line-height:1; cursor:pointer; flex-shrink:0; font-family:inherit;">×</button>
    </div>
    <div style="padding:6px 14px 16px;">
      ${sec('Obiettivo', T("Guidi il governo come <b>%RUOLO</b> per <b>%A anni</b>. Ogni mese prendi decisioni che muovono economia e consenso. A fine mandato si <b>vota</b>, e l'esito lo decidono le <b>forze dei partiti</b>. Se durante il mandato il consenso scende sotto <b>%N%</b>, cadi per crisi di governo.").replace('%RUOLO',T(P.titoloRuolo)).replace('%A',anni).replace('%N',D.sogliaCrisi))}
      ${sec('Stato del paese', T('In alto, sempre visibili: <b>Crescita</b>, <b>Debito/PIL</b>, <b>Disoccupazione</b> e <b>Consenso</b>. Nella scheda <b>Paese</b> trovi tutto il quadro: economia completa (deficit, fiducia dei mercati, reputazione, rapporto con la stampa), i servizi (sanità, sicurezza, ambiente) e il consenso dei sei gruppi sociali.'))}
      ${sec('La stampa', T('Ogni mese i media <b>titolano</b> sul tuo operato (la prima pagina, in Governo). Nella scheda <b>Stampa</b> gestisci la comunicazione: <b>una dichiarazione al mese</b> — intervista, annuncio, segnale a un alleato o attacco — col <b>tono</b> che scegli. Il rapporto coi media <b>amplifica o attutisce</b> i colpi politici.'))}
      ${sec('Gruppi sociali e consenso', T("Il consenso è la media dei <b>sei gruppi sociali</b>, pesata per il loro peso elettorale. Ogni politica o decisione fa contenti alcuni gruppi e scontenti altri. L'umore dei gruppi muove anche le <b>forze dei partiti</b>, che contano al voto. Sotto <b>%N%</b> di consenso è crisi di governo.").replace('%N',D.sogliaCrisi))}
      ${sec('Legge di bilancio e punti riforma', T('I punti riforma si <b>accumulano</b>: <b>+1 al mese</b>, fino a <b>3 in cassa</b> — i punti non spesi restano. A <b>gennaio</b> la manovra ne inietta <b>+3</b> (fino a 5; <b>+1</b> se controlli il territorio): è il momento delle riforme grosse. Ogni cambio di livello di una politica costa un punto; tornare indietro nello stesso mese è gratis.'))}
      ${sec('Ministri', T("Scegli i ministri tra candidati con un <b>profilo</b> (tecnico, progressista, conservatore, populista) e una <b>competenza</b>. La loro <b>lealtà</b> ne scala l'efficacia. Agiscono in quattro modi: <b>propongono</b> provvedimenti, <b>chiedono fondi</b> per il loro dicastero, possono finire in <b>scandali</b>, e a volte <b>si scontrano tra loro</b>: sta a te decidere."))}
      ${sec('Eventi e dossier', T("Ogni mese l'<b>agenda</b> porta dossier (situazioni da gestire) e, più di rado, <b>eventi gravi</b>. Risolvi le carte in agenda prima di avanzare al mese successivo."))}
      ${sec('Elezioni', T("Il mandato dura <b>%A anni</b>. %COME Altrimenti passi all'opposizione. La <b>difficoltà</b> influisce indirettamente, muovendo i gruppi e quindi le forze.").replace('%A',anni).replace('%COME', P.comeSiVince==='parlamentare'?T('Le forze dei partiti diventano <b>seggi</b> (su 100): per restare al governo la tua coalizione deve raggiungere <b>50 seggi</b>%X').replace('%X',T(P.coalizione?', formando alleanze coi partiti vicini.':' da sola.')):T('Si gioca al <b>testa a testa</b> col rivale più forte: gli altri si schierano per vicinanza e vinci se superi il <b>50%</b>.')))}
      <button class="btn" style="width:100%;" onclick="hideHelp()">${T('Chiudi')}</button>
    </div>`;
}

/* --- Schermata di nomina --- */
function dotsHTML(n){let s=''; for(let i=0;i<3;i++) s+=`<i class="${i<n?'f':''}"></i>`; return `<div class="dots">${s}</div>`;}
function renderAppoint(){
  let h='';
  for(const m of MINISTRIES){
    h+=`<div class="apt card" style="padding:13px 14px;"><div class="role">${icon(m.id,T(m.nm))} ${T(m.nm)}</div><div class="desc">${T(m.desc)}</div><div class="cands">`;
    APT.cands[m.id].forEach((c,i)=>{
      const on=APT.sel[m.id]===i;
      h+=`<button class="cand ${on?'on':''}" onclick="pickCand('${m.id}',${i})">
        <span class="cleft">${avatar(c)}<span class="cn">${c.nm}</span></span>
        <span class="cmeta"><span class="chip" style="background:${PROFCOL[c.profile]}22;color:${PROFCOL[c.profile]}">${gergo(T(PROF[c.profile]),'profilo')}</span>${dotsHTML(c.comp)}</span>
      </button>`;
    });
    h+=`</div></div>`;
  }
  document.getElementById('aptlist').innerHTML=h;
  document.getElementById('aptbtn').disabled = Object.keys(APT.sel).length<MINISTRIES.length;
}
function pickCand(mid,i){APT.sel[mid]=i; renderAppoint();}

/* --- Helper di disegno --- */
function barColor(v){return v>=66?'var(--pos)':v>=40?'var(--warn)':'var(--neg)';}
/* CANTIERE BUDGET — formattatore denaro (valore in MILIONI; separatore via fmt()). VALUTA-AWARE (fix cifre d'epoca):
   se S.valuta è impostata (es. lira nel '50) → simbolo d'epoca, ancorato a «mld» (14.900 mld di lire, niente auto-«tln»
   che suonerebbe posticcio). Default (presente, S.valuta null) = comportamento € IDENTICO. */
function euro(mln){ if(mln==null||isNaN(mln)) return ''; var a=Math.abs(mln);
  var V=(typeof S!=='undefined' && S && S.valuta) || null;
  if(V){ var gl=a/1000; return V.sym+' '+fmtMigliaia(gl, gl<10?1:0)+' '+T(V.mld); }   // valuta d'epoca: tutto in mld (con separatore migliaia)
  /* P2 — la valuta segue il paese. L'EUROZONA (e ogni paese non mappato) resta al RAMO € ATTUALE, INTATTO al byte.
     Gli altri passano dal ramo convertito: cross PRIMA dei gradini, «tln» sbloccato, separatore migliaia, decimali a scalare. */
  var CUR=(typeof VALUTE!=='undefined' && typeof S!=='undefined' && S) ? VALUTE[S.paese] : null;
  if(!CUR){
    if(a>=1e6) return '€'+fmt(a/1e6, a/1e6>=10?0:2)+' '+T('tln');
    if(a>=1000){ var g=a/1000; return '€'+fmt(g, g<10?2:g<100?1:0)+' '+T('mld'); }
    return '€'+fmt(a,0)+' '+T('mln');
  }
  var x=a*CUR.cross; var dec=function(v){ return v>=100?0:v>=10?1:2; };   // grandi cifre → intero+separatore (salva ¥/₩/₦); piccole → più decimali
  if(x>=1e6){ var t=x/1e6; return CUR.sym+fmtMigliaia(t, dec(t))+' '+T('tln'); }
  if(x>=1000){ var g2=x/1000; return CUR.sym+fmtMigliaia(g2, dec(g2))+' '+T('mld'); }
  return CUR.sym+fmtMigliaia(x, 0)+' '+T('mln'); }
/* come fmt() ma col separatore delle migliaia (le cifre-lire sono grandi: «14.900», non «14900») */
function fmtMigliaia(n, dec){ var s=fmt(n, dec); var parts=s.split(/[.,]/); var sep=(typeof curLang==='function'&&curLang()==='en')?',':'.';
  parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep); return parts.length>1 ? parts.join(s.indexOf(',')>-1?',':'.') : parts[0]; }
/* targhetta-costo di una scelta: mostra "€X · −Y% del bilancio" quando la carta DICHIARA un costo (lo rende VISIBILE,
   non più un incremento nascosto). Locale: costo.eur (€ mln) vs il bilancio comunale/regionale in €. */
/* L67-2 — il riepilogo sotto l'esito: cosa si e mosso davvero, in parole del cruscotto. Solo se c'e qualcosa. */
function esitiHtml(it){
  if(!it || !it.esiti || !it.esiti.length) return '';
  const NOMI={'ind:consenso':'Consenso','ind:debt':'Debito/PIL','ind:stampa':'Stampa','ind:fiducia':'Fiducia','ind:reputazione':'Reputazione','opp:visibilita':'Visibilità','opp:credibilita':'Credibilità'};
  const righe=it.esiti.map(function(e){
    const tipo=e.k.slice(0,3), id=e.k.slice(4);
    let nome;
    if(tipo==='grp') nome=nomeGruppo(id);
    else if(tipo==='cor'){ const C=(typeof CORRENTI_DEF!=='undefined')?CORRENTI_DEF.find(function(c){return c.id===id;}):null; nome=C?T(C.nome):id; }
    else nome=T(NOMI[e.k]||id);
    const su=e.d>0, dec=(e.k==='ind:debt')?1:0, testo=(su?'+':'−')+fmt(Math.abs(e.d),dec)+(e.k==='ind:debt'?' '+T('pt'):'');
    return '<span class="esito-riga"><span>'+nome+'</span><span class="mono" style="color:'+(su?'var(--pos)':'var(--neg)')+'">'+testo+'</span></span>';
  }).join('');
  return '<div class="esiti"><div class="contorno">'+T('Cosa si è mosso')+'</div>'+righe+'</div>';
}
/* ================================================================================================================
   L67-3 · IL GERGO SPIEGATO AL TOCCO. Sei parole che il gioco usa come fossero note — potere locale, intesa,
   punti riforma, congiuntura, profilo, tenuta — diventano un termine toccabile con una definizione di UNA riga
   che si apre sotto, dove il termine compare. Niente hover (sul telefono non esiste): tocco che apre e chiude.
   Il bersaglio tattile è 44px per costruzione (padding + margine negativo: la parola resta della sua taglia,
   l'area che si preme no). Le definizioni sono ancorate al codice: le soglie sono quelle del motore.
   ================================================================================================================ */
const GERGO_DEF = {
  potereLocale: 'La quota dei territori che i tuoi eletti controllano: sopra 50 la manovra di gennaio ti dà un punto riforma in più.',
  intesa:       'Il rapporto con un altro partito, da 0 a 100: sopra 60 quel partito entra nel tuo blocco e conta al voto.',
  puntiRiforma: 'Il credito con cui cambi politiche e leggi: +1 al mese fino a 3 in cassa, e la manovra di gennaio ne aggiunge 3.',
  congiuntura:  'Il vento dell\'economia che spinge o frena da solo, a prescindere da quello che fai tu.',
  profilo:      'L\'orientamento di un ministro o candidato — tecnico, progressista, conservatore, populista — che cambia l\'effetto delle sue politiche.',
  tenuta:       'Quanto un alleato regge nella coalizione, da 0 a 100: sotto 35 ti dà un ultimatum, sotto 20 rompe.'
};
function gergo(termine, chiave){
  const d=GERGO_DEF[chiave]; if(!d) return termine;
  return '<span class="gergo-wrap"><button type="button" class="gergo" aria-expanded="false" onclick="toggleGergo(this)">'+termine+'</button>'
       + '<span class="gergo-def" hidden><b>'+termine+'</b> — '+T(d)+'</span></span>';
}
/* La definizione NON resta accanto alla parola: molte delle sei stanno in righe a due colonne (etichetta a
   sinistra, valore a destra) o dentro un chip, e un blocco aperto li dentro si sovrappone al valore. Al primo
   tocco la si sposta in CODA alla scheda che la contiene, a tutta larghezza: sotto tutto, sopra niente. */
function toggleGergo(b){
  let def=b._gergoDef || b.nextElementSibling; if(!def || !def.classList.contains('gergo-def')) return;
  const aperto=!def.hidden;
  document.querySelectorAll('.gergo-def:not([hidden])').forEach(function(x){ x.hidden=true; });
  document.querySelectorAll('.gergo[aria-expanded="true"]').forEach(function(x){ x.setAttribute('aria-expanded','false'); });
  if(aperto) return;
  if(!b._gergoDef){ const host=b.closest('.card, .sticky-top, .ag') || b.parentElement; host.classList.add('gergo-host'); host.appendChild(def); b._gergoDef=def; }
  def.hidden=false; b.setAttribute('aria-expanded','true');
}
function costoChip(c){ if(!c || !c.costo) return '';
  var k=c.costo;
  if(k.pct!=null && S.locale && S.locale.budget){   // LOCALE: % del bilancio comunale/regionale → € (pct>0 spesa, pct<0 entrata)
    var sp=k.pct>0, e=Math.abs(k.pct)/100*S.locale.budget;
    return `<span class="ocost">${sp?'':T('entrata ')}${euro(e)} · ${sp?'−':'+'}${fmt(Math.abs(k.pct), Math.abs(k.pct)<10?1:0)}% ${T('del bilancio')}</span>`; }
  if(k.debito!=null && S.pil){   // NAZIONALE: punti di debito/PIL → € (debito>0 spesa che alza il debito, <0 entrata che lo abbassa)
    var spN=k.debito>0, eN=Math.abs(k.debito)*S.pil*10;
    return `<span class="ocost">${spN?'':T('entrata ')}${euro(eN)} · ${spN?'+':'−'}${fmt(Math.abs(k.debito),1)} ${T('pt debito')}</span>`; }
  return ''; }
function dlt(now,then,d=1,inv=false){
  const diff=now-then; if(Math.abs(diff)<0.05) return `<span style="color:var(--mut2)">–</span>`;
  const good=inv?diff<0:diff>0; return `<span style="color:${good?'var(--pos)':'var(--neg)'}">${sign(diff,d)}</span>`;
}
function setTab(t){S.tab=t; S.ministeroAperto=null; S.mappaAperta=null; S.partitoAperto=null; SALA_SUB=null; render();}   // cambiare tab chiude pagina-ministero, mappa, pagina-partito e composizione-dichiarazione (niente pagine fantasma)
function apriMinistero(id){ S.ministeroAperto=id; render(); }
function chiudiMinistero(){ S.ministeroAperto=null; QSEL=null; render(); }   // QSEL: azzera la zona selezionata della mappa-quartieri uscendo

/* --- Render principale --- */
/* APERTURA STAMPA (loop attivo — Lotto 1): c'è una parola che CONVIENE dire ORA? Asticella ALTA sul lato-opportunità (un REGALO,
   non "potresti sempre dire qualcosa"): un alleato che scivola da rinsaldare prima dell'ultimatum, o dati DAVVERO buoni da
   sbandierare (oltre il semplice "regge"). Usata sia dal pallino (attenzioni) sia dalla sala (evidenzia la mossa). Null se niente. */
function aperturaStampa(){
  if(!S || S.opposizione || S.livello!==3 || typeof mossaDisponibile!=='function' || !mossaDisponibile()) return null;
  var I=S.ind||{};
  if(S.coalizione && S.tenuta){   // alleato che SCIVOLA (prima dell'ultimatum a 35): rinsaldarlo ora è opportunità preventiva
    var cand=null, lowest=999;
    for(var i=0;i<S.coalizione.length;i++){ var id=S.coalizione[i]; if(id===S.partito) continue; var t=S.tenuta[id]; if(t!=null && t>=37 && t<=54 && t<lowest){ lowest=t; cand=id; } }
    if(cand) return {tipo:'segnale', ally:cand};
  }
  if((I.growth>=1.5) || (I.fiducia>=75) || (I.growth>=1 && I.unemp<=6.5)) return {tipo:'annuncio'};   // dati NOTEVOLMENTE buoni
  return null;
}
/* CORRENTE DA CURARE (loop attivo — Lotto 2): la corrente più calda che VALE curare ORA (umore < 47, PRIMA della soglia-sfida a
   35) con la leva pronta. Usata dal pallino (attenzioni) e per EVIDENZIARE nella scheda quale corrente + quale mossa (affinamento
   #1). mediazione=true → conviene la Mediazione (2+ correnti sotto 50); altrimenti l'Incarico sulla corrente indicata. */
function correnteDaCurare(){
  if(!S || S.opposizione || S.livello!==3 || !S.correnti || !S.correnti.length || typeof mossaPartitoDisponibile!=='function' || !mossaPartitoDisponibile()) return null;
  var lowest=S.correnti.slice().sort(function(a,b){return a.umore-b.umore;})[0];
  if(!lowest || lowest.umore>=47) return null;
  var mediazione=S.correnti.filter(function(c){return c.umore<50;}).length>=2;
  return { corrente:lowest.id, umore:lowest.umore, mediazione:mediazione };
}
/* CRUSCOTTO ATTENZIONE (loop attivo — Lotto 0): quali schede ti CHIAMANO, con priorità e cap. SELETTIVO — solo motivi reali
   e AZIONABILI (una leva pronta), mai sempre acceso. È un INVITO, non un castigo: si spegne quando lo stato rientra o quando
   agisci (la leva usata muove lo stato → al render successivo il pallino sparisce). La scheda-destinazione evidenzierà il PERCHÉ
   nel suo lotto. Solo al governo nazionale (liv 3): stampa/partito/politiche vivono lì; opposizione/segretario/diplomatico esclusi. */
function attenzioni(){
  var out=[];
  if(S && S.livello===0 && S.attivista){   // ATTIVISTA (rework L3): pallino SELETTIVO sul tab "Campagne" — solo momenti VERI (spento la gran parte dei mesi, o è rumore)
    var Ca=S.attivista.campagna;
    // pallino SOLO sulla DECADENZA (l'unica cosa non già in superficie): offerta e resa sono CARTE nel flusso → auto-evidenti nel Movimento, doparle qui sarebbe ridondante e rumoroso. Un buon giocatore (che nutre) NON lo vede mai; scatta solo su incuria e si spegne appena nutre → massimamente consequenziale.
    if(Ca && !S.attivista.laurea && Ca._calato && !Ca.resaPending) out.push({tab:'attorno', pri:6, motivo:'la campagna sta calando'});
    return out;
  }
  if(!S || S.opposizione || S.livello!==3) return out;
  var I=S.ind||{};
  // BILANCIO — una politica sotto pressione (loop attivo Lotto 3: motivo SPECIFICO, la scheda evidenzia quale), poi la manovra di gennaio, poi i conti sotto pressione
  var sp=(typeof politicaSottoPressione==='function')?politicaSottoPressione():null;
  if(sp) out.push({tab:'pol', pri:(I.deficit>6||(I.fiducia!=null&&I.fiducia<40))?9:8, motivo:'una politica sotto pressione', pol:sp.pol});
  else if(S.month===1 && (typeof rpLeft!=='function' || rpLeft()>1)) out.push({tab:'pol', pri:6, motivo:'la manovra ti aspetta'});
  else if(I.deficit>4.5 || (I.fiducia!=null && I.fiducia<50)) out.push({tab:'pol', pri:(I.deficit>6||(I.fiducia!=null&&I.fiducia<40))?9:5, motivo:'i conti sotto pressione'});
  // PARTITI — una corrente calda, con una leva pronta (Incarico/Mediazione): prima della soglia-sfida a 35 → curi in tempo
  var dc=correnteDaCurare(); if(dc) out.push({tab:'par', pri:dc.umore<38?8:4, motivo:'una corrente si scalda'});
  // PARTITI (Lotto A, fix playtest): la sfida interna e la tenuta degli alleati ora CHIAMANO — prima maturavano mute
  if(typeof sfidaAttiva==='function' && sfidaAttiva()){ var _mat=S.sfida&&S.sfida.maturazione>=2; out.push({tab:'par', pri:_mat?9:7, motivo:_mat?'il congresso incombe':'una sfida interna monta'}); }
  if(S.tenuta){ var _tmin=null; for(var _tk in S.tenuta){ if(_tmin==null||S.tenuta[_tk]<_tmin) _tmin=S.tenuta[_tk]; }
    if(_tmin!=null && _tmin<35 && (typeof mossaDisponibile!=='function'||mossaDisponibile())) out.push({tab:'par', pri:8, motivo:'un alleato al limite'}); }
  // STAMPA — press scivolata (recupero) O un'apertura VERA (opportunità, asticella alta); serve la parola pronta. Invito, mai castigo del silenzio.
  if(I.stampa!=null && (typeof mossaDisponibile!=='function' || mossaDisponibile())){
    var ap=aperturaStampa();
    if(I.stampa<45) out.push({tab:'stampa', pri:I.stampa<38?7:3, motivo:'la stampa aspetta una parola'});
    else if(ap) out.push({tab:'stampa', pri:4, motivo: ap.tipo==='segnale'?'un alleato da rinsaldare':'buoni dati da annunciare'});
  }
  // MINISTRI (P3 #9) — la lealtà scala l'efficacia e prepara scandali/dimissioni: un ministro che scivola ora CHIAMA
  //   (prima aveva solo il richiamo-conferenza, mai il pallino). Soglia d'attenzione <45, critica <35. Tab governo.
  var mlow=null; (S.ministers||[]).forEach(function(m){ if(m && !m.resigning && (mlow==null||m.loyalty<mlow.loyalty)) mlow=m; });
  if(mlow && mlow.loyalty<45) out.push({tab:'gov', pri:mlow.loyalty<35?7:3, motivo:'un ministro vacilla'});
  // F2 — la mappa che chiama: un territorio ti invita (pri bassa: è un'opportunità, non un'urgenza — mai ruba la scena)
  if(S.territorioChiama) out.push({tab:'par', pri:4, motivo:'un territorio ti chiama'});
  out.sort(function(a,b){ return b.pri-a.pri; });
  return out.slice(0,2);   // cap: max 2 pallini, i più urgenti — la selettività tiene il richiamo significativo
}
function render(){
  if(S.lingua===undefined) S.lingua='it';   // migrazione APT: i salvataggi pre-i18n partono in italiano
  if(S.tab==='ind'||S.tab==='con') S.tab='paese';   // guardia per stati pre-fusione: PRIMA del toggle delle sezioni (sec-ind/sec-con non esistono più)
  applyPaese();   // rete di sicurezza: la striscia-bandiera segue sempre PAESE, qualunque percorso porti qui (idempotente)
  try{ document.documentElement.style.setProperty('--hdrH', document.querySelector('header').offsetHeight+'px'); }catch(e){}   // la testata sticky (.sticky-top) si appoggia all'altezza REALE dell'header
  document.getElementById('yr').textContent=S.year;
  /* Volto in-game: ritrattino del giocatore nell'header (statico, immagine già inline). Si nasconde se non scelto. */
  const hav=document.getElementById('hdr-avatar'); if(hav){ const pim=avatarImg(S.personaggio&&S.personaggio.avatar);
    if(pim){ hav.innerHTML=`<img src="${pim}" alt="Il tuo volto">`; hav.style.display=''; } else { hav.innerHTML=''; hav.style.display='none'; } }
  const liv4=(S.livello===4 && S.intl);
  const liv5=(S.livello===5 && S.diplo);
  const liv0=(S.livello===0 && S.attivista);   // ATTIVISTA (Build A): superficie focalizzata sulla militanza
  const noNaz=liv4||liv5||liv0;   // Segretario (4)/diplomatico (5)/attivista (0): superfici focalizzate, niente cruscotto nazionale
  if(liv0){ if(S.tab!=='gov' && S.tab!=='attorno') S.tab='gov'; }   // ATTIVISTA (A.5): due tab — Movimento (gov) + Attorno; coerce solo i tab non validi
  else if(noNaz && S.tab!=='gov' && S.tab!=='paese') S.tab='gov';   // solo Governo + Paese (lo stato del mondo)
  document.getElementById('el').innerHTML = liv0
    ? `${T(MONTHS[S.month-1])} · ${T('Attivista')}`
    : liv4
    ? `${T(MONTHS[S.month-1])} · ${T('Segretario')} · ${T('mandato')} ${S.intl.mandato} · ${T('mese')} ${(S.intl.mesiInCarica||0)+1}/${S.intl.mandatoMesi}`
    : liv5
    ? `${T(MONTHS[S.month-1])} · ${typeof ruoloDiplo==='function'?ruoloDiplo():T('Ambasciatore')}`
    : S.opposizione
    ? `${T(MONTHS[S.month-1])} · <span style="color:var(--neg);font-weight:700">${T('OPPOSIZIONE')}</span> · ${T('governa')} ${(part(S.governoAvversario)||{}).nome||'—'} · ${T('anno')} ${S.turnInMandate+1}/${PAESE.mandatoMesi/12} ${T('al voto')}`
    : `${T(MONTHS[S.month-1])} · ${T('Mandato')} ${S.mandate}, ${T('anno')} ${S.turnInMandate+1}/${PAESE.mandatoMesi/12}`;
  const I=S.ind,P=S.prev; const riK=S.relInt||{}; const rk=id=>riK[id]!=null?riK[id]:50;
  document.getElementById('keys').innerHTML= liv0
    ? keyCard('Base','base',S.attivista.base,fmt(S.attivista.base,0),0,false,'')+   // ATTIVISTA (Build A): le 3 valute della gavetta, così il gate di laurea è VISIBILE (niente gate invisibile)
      keyCard('Autorevolezza','autorev',S.attivista.autorev,fmt(S.attivista.autorev,0),0,false,'')+
      keyCard('Gruppi','grpmed',mediaGruppi(),fmt(mediaGruppi(),0),0,false,'')
    : liv4
    ? keyCard('Coesione','coes',S.intl.coesione,fmt(S.intl.coesione,0),0,false,'')+   // Fetta 2: a livello 4 la striscia mostra il MODO INTERNAZIONALE, non i numeri nazionali (muti)
      keyCard('Autorità','aut',S.intl.autorevolezza,fmt(S.intl.autorevolezza,0),0,false,'')+
      keyCard('Mandato','mand',S.intl.mandato,String(S.intl.mandato),0,false,'')+
      keyCard('Mese','mesi',S.intl.mesiInCarica||0,String(S.intl.mesiInCarica||0),0,false,'')
    : liv5
    ? keyCard('Credito','cred',S.diplo.credito,fmt(S.diplo.credito,0),0,false,'')+   // C2: la striscia del diplomatico = credito + i rapporti che costruisce
      keyCard(T(typeof consessoBreve==='function'?consessoBreve():'ONU'),'consK',rk('consesso'),fmt(rk('consesso'),0),0,false,'')+   // D4: etichetta-nodo era-aware
      keyCard('Alleanza','allK',rk('alleanza'),fmt(rk('alleanza'),0),0,false,'')+
      keyCard('Rivale','rivK',rk('rivale'),fmt(rk('rivale'),0),0,false,'')
    : keyCard('Crescita','growth',I.growth,sign(I.growth,1)+'%',1,true,dlt(I.growth,P.growth,1))+
      keyCard('Debito/PIL','debt',I.debt,fmt(I.debt,0)+'%',0,false,dlt(I.debt,P.debt,0,true))+
      keyCard('Disocc.','unemp',I.unemp,fmt(I.unemp,1)+'%',1,false,dlt(I.unemp,P.unemp,1,true))+
      keyCard('Consenso','consenso',I.consenso,fmt(I.consenso,0)+'%',0,false,dlt(I.consenso,P.consenso,0));
  const pend=S.agenda.filter(a=>!a.resolved).length;
  const att=attenzioni(); const attSet={}; att.forEach(function(a){ attSet[a.tab]=a; });   // cruscotto attenzione (Lotto 0): pallini per-scheda
  const TABNM={gov:'Governo', attorno:'Campagne', paese:'Paese', pol:'Bilancio', par:'Partiti', stampa:'Stampa'};   // a liv0 il tab 'attorno' si chiama "Campagne" (rework L3); mostrato solo a liv0
  document.querySelectorAll('.tab').forEach(el=>{
    const t=el.dataset.t;
    el.classList.toggle('on',t===S.tab);
    let badge='';
    if(t==='gov'){ if(pend) badge=`<span class="badge">${pend}</span>`; }
    else if(attSet[t]) badge=`<span class="badge dot${lastDots[t]?'':' pulse'}" title="${escAttr(T(attSet[t].motivo))}"></span>`;   // pallino "questa scheda ti chiama" — pulse SOLO alla comparsa (E5): 2 battiti poi fermo, mai nagging
    if(TABNM[t]) el.innerHTML=T((liv0 && t==='gov')?'Movimento':TABNM[t])+badge;   // a liv0 la scheda "Governo" si chiama "Movimento"
    el.style.display = (t==='attorno') ? (liv0?'':'none')                        // "Attorno" esiste SOLO a liv0
      : (liv0 && t!=='gov') ? 'none'                                             // attivista: solo Movimento(gov) + Attorno
      : (noNaz && t!=='gov' && t!=='paese') ? 'none' : '';                       // Segretario/diplomatico: Governo+Paese
  });
  lastDots={}; att.forEach(function(a){ lastDots[a.tab]=1; });   // E5: fotografa i pallini di questo render → il pulse scatta solo alla PROSSIMA comparsa
  document.querySelectorAll('.sec').forEach(el=>el.classList.remove('on'));
  const secEl=document.getElementById('sec-'+S.tab); secEl.classList.add('on');
  if(lastTab!==S.tab){ secEl.classList.remove('secfade'); void secEl.offsetWidth; secEl.classList.add('secfade'); lastTab=S.tab; }   // dissolvenza solo al cambio reale di scheda
  if(S.tab==='gov') renderGov();
  if(S.tab==='attorno') renderAttorno();
  if(S.tab==='paese') renderPaese();
  if(S.tab==='pol') renderPol();
  if(S.tab==='par') renderPartiti();
  if(S.tab==='stampa') renderStampaTab();
  // endbar
  document.getElementById('advbtn').disabled = pend>0;
  const next = S.month<12?T(MONTHS[S.month]):T(MONTHS[0])+' '+(S.year+1);
  document.getElementById('ctx').innerHTML = pend>0
    ? `<b>${pend}</b> ${T(pend>1?'decisioni in agenda':'decisione in agenda')}`
    : `${T('Pronto. Prossimo:')} <b>${next}</b>`;
  document.getElementById('advbtn').textContent = T(pend>0?'Decidi prima →':'Avanza →');
  playAnims();   // moto vecchio→nuovo sui numeri/barre appena resi (no-op sotto reduced-motion)
}
function keyCard(l,k,num,v,dec,signed,d){return `<div class="key"><div class="lab">${T(l)}</div><div class="val" data-anim="num:${k}" data-to="${num}" data-dec="${dec}" data-sign="${signed?1:0}">${v}</div><div class="dlt">${d}</div></div>`;}

/* --- Scheda GOVERNO: agenda + ministri --- */
/* avatar circolare deterministico (iniziale + colore profilo), chip profilo, capitalizzazione.
   Usati dalle carte in cui parla un ministro. Solo presentazione. */
function avatarImg(id){ if(!id) return null; if(typeof id==='string' && id.slice(0,5)==='data:') return id;   // foto caricata dall'utente: il campo avatar È già il data URL
  if(typeof AVATARS==='undefined') return null; const a=AVATARS.find(function(x){return x.id===id;}); return a?a.img:null; }
/* L9-2 — RITRATTI dei personaggi (ministri/candidati): pool per MACRO-AREA + GENERE, indice STABILE dal nome
   (hash → stessa faccia per tutta la partita e dopo round-trip; NON salvato in S). Il profilo politico è ESCLUSO
   dalla scelta (lo dice già la chip). Degrado pulito: area senza pool su disco → null → avatar() cade sull'iniziale. */
var RITRATTI_AREA = {
  italia:'occ', francia:'occ', regnounito:'occ', germania:'occ', spagna:'occ', usa:'occ', canada:'occ', australia:'occ',
  messico:'lat', brasile:'lat', argentina:'lat',
  giappone:'asi', coreasud:'asi',
  india:'sud',
  nigeria:'afr', sudafrica:'afr',
};   // L10-1: prefissi allineati ai nomi-file su disco (occ/lat/asi/sud/afr), non ai nomi lunghi di L9-2
/* L11-3 — conteggio PER POOL **E GENERE**: un lotto d'arte parziale (es. 5 maschi ma 4 femmine) non produce più un
   path inesistente. Derivarlo a runtime dai file richiederebbe fetch/sonde (il gioco usa script classici, niente
   fetch): resta una tabella esplicita, ma **verificata contro il disco** da `node .claude/verifica-ritratti.js`,
   che va rilanciato quando arriva un lotto nuovo. Forma-numero (`occ:5`) ancora accettata per compatibilità. */
var RITRATTI_POOL = { occ:{m:5,f:5}, lat:{m:5,f:5}, asi:{m:5,f:5}, sud:{m:5,f:5}, afr:{m:5,f:5},
                      occ50:{m:8,f:2},    // L19-1: volti d'epoca. 8/2 di proposito: con la quota-genere del '50 il ~94% dei pescaggi è maschile
                      occ70:{m:4,f:2}, occ80:{m:3,f:3},    // L37-1: i due decenni nuovi (conteggi verificati sul disco)
                      occ90:{m:3,f:3} };   // L43-2: il '90, ora uniforme. LA LEZIONE della collisione: i primi due volti femminili erano
                                           //   su disco come `f2`/`f3`, il pool costruisce i path da `f1` in su e li ricompattai in `f1`/`f2`;
                                           //   il volto che arrivò dopo si chiamava `f1` e collise. Da qui in poi gli indici nuovi si AGGIUNGONO IN CODA.
/* L37-1 — POOL PER DECENNIO. Prima era per SCENARIO (`S.era==='italia1950'`): quel confronto è morto il 30 luglio,
   quando L30-1 ha rinominato l'era in `italia_repubblica` per tutta la linea. Da allora `occ50` **non veniva più
   pescato da nessuno** — regressione silenziosa, nessuna guardia poteva vederla (il path ripiegava su `occ`, che
   esiste). Ora la scelta si fa sull'ANNO dentro la linea, che è anche quello che serviva: un ministro del 1985
   non deve avere la brillantina.
     ≤1969 → occ50 · 1970-79 → occ70 · 1980-89 → occ80 · ≥1990 → occ90 · fuori dalla linea → occ (presente intatto)
   STABILITÀ — scelta (a), il volto si fissa alla nomina: `assegnaVolto` scrive `m.rit` e `ritrattoDi` lo rispetta
   per primo, quindi un ministro nominato nel '68 che serve fino al '74 **tiene la sua faccia**. È la stessa regola
   di L20-1 (niente ricalcolo sull'insieme) e l'unica coerente col mondo: una persona non cambia volto perché è
   cambiato il decennio. Chi non ha `rit` (le figure episodiche di una carta sola) pesca dal decennio corrente,
   che per loro è giusto: sono facce del momento, non personaggi che durano. */
function ritrattoPoolEra(pref){
  if(pref!=='occ') return pref;                                            // solo l'occidentale ha volti d'epoca: la linea è italiana
  /* `eraGiocata`/`annoGiocato` e non `S` diretto: la nomina del governo avviene PRIMA che S esista (il setup
     vive prima della partita), e senza questo il gabinetto d'avvio del 1980 nasceva col pool del presente. */
  var era=(typeof eraGiocata==='function') ? eraGiocata() : ((typeof S!=='undefined'&&S&&S.era)||'contemporanea');
  if(era!==LINEA_IT) return pref;                                          // presente o altra linea → invariato
  var y=(typeof annoGiocato==='function') ? annoGiocato() : ((typeof S!=='undefined'&&S&&S.year)||0);
  if(y>=1990) return 'occ90';
  if(y>=1980) return 'occ80';
  if(y>=1970) return 'occ70';
  return 'occ50';
}
/* L11-1 — gli 8 ARCHETIPI del fuori-verbale: personaggi FISSI (uno per figura ricorrente), NON pescati per
   area+genere — il nome del file è l'identità. Si agganciano al `filo` degli archi via il campo `arc`. */
var RITRATTI_ARC = {
  faccendiere:'assets/ritratti/arc-faccendiere.webp', industriale:'assets/ritratti/arc-industriale.webp',
  cronista:'assets/ritratti/arc-cronista.webp',       lobbista:'assets/ritratti/arc-lobbista.webp',
  notabile:'assets/ritratti/arc-notabile.webp',       diplomatico:'assets/ritratti/arc-diplomatico.webp',
  militante:'assets/ritratti/arc-militante.webp',     magistrato:'assets/ritratti/arc-magistrato.webp',
};
function ritrattoArc(f){ return (f && f.arc && RITRATTI_ARC[f.arc]) ? RITRATTI_ARC[f.arc] : null; }
/* ============================================================ L20-1 · DE-DUPLICA DEI VOLTI NEL GABINETTO.
   Il problema (misurato in L19-1): con un pool di 8-10 volti, l'hash fa collidere 4 ministri su 10 in media — e
   nella scheda Governo, dove ora i volti si vedono in fila, si nota. Il rimedio NON è allargare il pool.
   LA TRAPPOLA EVITATA (la tua): **niente ricalcolo sull'insieme.** Un rimpasto non deve spostare la faccia di
   ministri che non c'entrano. Quindi il volto risolto si **CONGELA** sul personaggio nel campo `rit` (dato puro,
   serializza come `g` e sopravvive al round-trip): chi è in carica non si ricalcola MAI, solo il nuovo arrivato
   evita le facce dei presenti. È coerente con L9-2, non un'eccezione: là si evitava la dipendenza dallo stato,
   qui la dipendenza dallo stato È il punto (il volto dipende da chi c'era al momento della nomina).
   L'hash resta la PRIMA scelta: si sposta solo se quella faccia è già occupata (passo +1 deterministico). ====== */
function volteOccupati(escludi){
  var out={}; ((typeof S!=='undefined'&&S&&S.ministers)||[]).forEach(function(m){
    if(escludi && m.min===escludi) return;
    var v=m&&m.rit; if(v) out[v]=1;
  }); return out;
}
/* Assegna e CONGELA `rit`: parte dall'indice-hash e cammina in avanti (mod n) fino al primo libero. Se il pool è
   saturo torna la scelta-hash (un duplicato è il tetto del pool, non un errore: 10 uomini su 8 volti fanno 2 doppi). */
function assegnaVolto(m, occupati, preferito){
  if(!m || !m.nm || typeof hashId!=='function') return null;
  var pref = RITRATTI_AREA[(typeof S!=='undefined'&&S&&S.paese)||'italia'];
  if(pref) pref = ritrattoPoolEra(pref);
  var conf = pref ? RITRATTI_POOL[pref] : null;
  if(!conf) return null;
  var g = (m.g==='f') ? 'f' : 'm';
  var n = (typeof conf==='number') ? conf : conf[g];
  if(!n) return null;
  /* CONTINUITÀ CON LA ROSA: se il candidato aveva già un volto mostrato al giocatore (`preferito`) e quel volto è
     ancora libero, si tiene — quello che hai visto scegliendo è quello che ottieni. Solo se collide si sposta. */
  if(preferito && (!occupati || !occupati[preferito])){ m.rit=preferito; if(occupati) occupati[preferito]=1; return preferito; }
  var base = Math.abs(hashId(m.nm)) % n;
  var scelto=null;
  for(var k=0;k<n;k++){
    var p='assets/ritratti/'+pref+'-'+g+(((base+k)%n)+1)+'.webp';
    if(!occupati || !occupati[p]){ scelto=p; break; }
  }
  if(!scelto) scelto='assets/ritratti/'+pref+'-'+g+(base+1)+'.webp';   // pool saturo: il tetto, non un errore
  m.rit=scelto;
  if(occupati) occupati[scelto]=1;
  return scelto;
}
/* Assegna a un GRUPPO (il gabinetto all'atto della formazione, o una rosa di candidati): ognuno parte dal suo
   hash e cede il passo a chi l'ha già preso, in ordine di lista. */
function assegnaVoltiGruppo(lista, occupati){
  occupati = occupati || {};
  (lista||[]).forEach(function(m){ var pre=m&&m.ritRosa; assegnaVolto(m, occupati, pre); });
  return occupati;
}
function ritrattoDi(m){
  if(m && m.rit) return m.rit;                            // L20-1: volto CONGELATO alla nomina → non cambia mai più
  if(!m || !m.nm || typeof hashId!=='function') return null;
  var pref = RITRATTI_AREA[(typeof S!=='undefined'&&S&&S.paese)||'italia'];
  if(pref) pref = ritrattoPoolEra(pref);                  // L19-1: nel '50 l'occidentale diventa `occ50` (volti d'epoca)
  var conf = pref ? RITRATTI_POOL[pref] : null;
  if(!conf) return null;                                // nessun pool per quest'area → iniziale (degrado pulito)
  var g = (m.g==='f') ? 'f' : 'm';                      // vecchi salvataggi senza g → maschile
  var n = (typeof conf==='number') ? conf : conf[g];    // numero = vecchia forma (stesso conteggio per entrambi)
  if(!n) return null;                                   // genere senza ritratti in questo pool → iniziale
  var idx = (Math.abs(hashId(m.nm)) % n) + 1;           // indice stabile dal NOME (non da S)
  return 'assets/ritratti/'+pref+'-'+g+idx+'.webp';
}
function avatar(m){ if(!m) return ''; const c=PROFCOL[m.profile]; let img=avatarImg(m.avatar);
  if(!img){ var rp=(typeof ritrattoDi==='function')?ritrattoDi(m):null; if(rp) img=rp; }   // L9-2: ritratto per macro-area+genere (dopo la foto-utente, prima dell'iniziale)
  if(img) return `<div class="avatar" style="border-color:${c};padding:0;overflow:hidden"><img src="${img}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`;
  const ini=(m.nm||'?').trim().charAt(0).toUpperCase(); return `<div class="avatar" style="border-color:${c};color:${c}">${ini}</div>`; }
function chipOf(m){ if(!m) return ''; const c=PROFCOL[m.profile]; return `<span class="chip" style="background:${c}22;color:${c}">${gergo(T(PROF[m.profile]),'profilo')}</span>`; }
function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }

/* Card di un ministro (RIUSABILE: elenco Governo e pagina-ministero). mode 'lista' → "Apri il ministero →";
   mode 'pagina' → "Sostituisci ministro". */
function renderMinistroCard(m, mode){
  if(!m) return `<div class="min"><div class="msum">Dicastero vacante.</div></div>`;
  const role=T(MINISTRIES.find(x=>x.id===m.min).nm);
  let footer='';
  if(mode==='lista') footer=`<button class="mini-btn" style="background:var(--acc-bg);border-color:var(--acc);color:var(--acc-ink);font-weight:600" onclick="apriMinistero('${m.min}')">${T('Apri il ministero →')}</button>`;
  else if(mode==='pagina') footer=`<button class="mini-btn" onclick="askReplace('${m.min}')">Sostituisci ministro</button>`;
  /* L12-1 — il VOLTO nella scheda Governo (playtest: «i volti si vedono solo al momento della scelta»). Tondo a
     sinistra di ruolo+nome: 34px in lista (come la nomina), 56px nella pagina del singolo ministero — è l'unico
     punto in cui hai una persona sola davanti. Il caso «Dicastero vacante» esce prima e resta intatto. */
  const face=(typeof avatar==='function')?avatar(m):'';
  return `<div class="min${mode==='pagina'?' solo':''}"><div class="mtop"><div class="mleft">${face}<div class="mwho">
    <div class="role">${role}</div><div class="who">${m.nm}</div>
    <span class="chip" style="background:${PROFCOL[m.profile]}22;color:${PROFCOL[m.profile]}">${gergo(T(PROF[m.profile]),'profilo')}</span></div></div>
    <div style="text-align:right;"><div class="role">${T('Competenza')}</div>${dotsHTML(m.comp)}</div></div>
    <div class="msum">${ministerSummary(m)}</div>
    <div class="loy"><div class="ll"><span>${T('Lealtà · efficacia')} ${effPct(m)}%</span><span class="mono">${fmt(m.loyalty,0)}</span></div>
    <div class="bar"><i style="width:${clamp(m.loyalty,2,100)}%;background:${barColor(m.loyalty)}"></i></div></div>
    ${footer}</div>`;
}
/* COSTO RICORRENTE delle politiche VISIBILE (cantiere Budget, gancio col loop attivo): la FISCAL già alimenta il deficit
   mensile — qui la si MOSTRA. Per-politica il costo del livello scelto; il totale = quanto pesa l'insieme sul deficit/anno. */
function fiscalRicorrente(id){ if(typeof FISCAL==='undefined' || !FISCAL[id]) return null; var v=FISCAL[id][S.pol[id]!=null?S.pol[id]:1]; return (v==null||v===0)?null:v; }
function polCostoTag(id){ var v=fiscalRicorrente(id); if(v==null) return '';   // + = costa (generosa), − = risparmia (sobria)
  var costa=v>0; return `<span class="polcost" style="color:${costa?'var(--warn-ink)':'var(--pos)'}">${costa?'+':'−'}${fmt(Math.abs(v),1)}% ${T('PIL/anno')}</span>`; }
function politicheTot(){ if(typeof FISCAL==='undefined'||typeof POLICIES==='undefined'||!S.pil) return null;
  var sum=0; POLICIES.forEach(function(p){ var f=FISCAL[p.id]; if(f){ var v=f[S.pol[p.id]!=null?S.pol[p.id]:1]; if(v) sum+=v; } });
  return { pct:Math.round(sum*10)/10, eurMln:sum*S.pil*10 }; }
function politicheTotRiga(){ var t=politicheTot(); if(!t) return '';   // il conto complessivo delle tue scelte di policy, ogni anno
  var costa=t.pct>0, c=costa?'var(--warn-ink)':'var(--pos)';
  return `<div class="fiscbar"><span class="fl">${T('Le tue politiche, ogni anno')}</span><span class="fv" style="color:${c}">${t.pct===0?'—':(costa?'+':'−')+fmt(Math.abs(t.pct),1)+'% '+T('PIL')+' · '+euro(Math.abs(t.eurMln))}</span></div>`; }
function levaEuroAnno(points){ return points*((S.locale&&S.locale.budget)||0)*0.012; }   // €mln/anno: la spesa corrente in servizi, proporzionale al bilancio (leva costo → €)
/* Un cursore di politica (RIUSABILE: Bilancio e pagina-ministero). Stessa logica RP/disabilitazione. */
function renderPolicySlider(p){
  const pnm=(typeof naLabel==='function'&&naLabel()&&p.nmNA)?p.nmNA:p.nm;   // sedia-swing: «Linea diplomatica» → «Allineamento» (asse autonomia) per i non allineati
  const plev=(typeof naLabel==='function'&&naLabel()&&p.levelsNA)?p.levelsNA:p.levels;
  const _sp=(typeof politicaSottoPressione==='function')?politicaSottoPressione():null;   // loop attivo Lotto 3: evidenzia LA politica sotto pressione + dove porta la revisione
  const press=(_sp && _sp.pol===p.id)?_sp:null;
  let h=`<div class="pol"${press?' style="background:var(--acc-bg);border-radius:8px;padding:6px 8px;margin:2px -8px"':''}><div class="pn">${T(pnm)}${press?` <span class="chip" style="background:var(--acc);color:#1a1408">${T('sotto pressione')}</span>`:''}${polCostoTag(p.id)}</div><div class="seg">`;
  plev.forEach((lab,i)=>{
    const on=S.pol[p.id]===i;
    const old=S.pol[p.id]; S.pol[p.id]=i; const cost=rpUsed(); S.pol[p.id]=old;
    const dis=(!on && cost>curRpMax());
    const rec=(press && !on && i===press.verso);   // il livello a cui porta il «rivedi»: un anello lo indica, così la mossa è visibile
    h+=`<button class="${on?'on':''}" ${dis?'disabled':''} onclick="setPol('${p.id}',${i})"${rec?' style="box-shadow:inset 0 0 0 2px var(--acc)"':''}>${T(lab)}</button>`;
  });
  return h+`</div></div>`;
}
/* Pagina di un ministero (drill-down da Governo): ministro + politiche + leggi del settore + spazio futuro. */
/* ===== Cruscotto LOCALE (livello 1): indicatori della città/regione + le tue leve (cursori). ===== */
function setLocaleLeva(id,i){ if(!S.locale) return; S.locale.leve[id]=i; simulateLocale(); render(); }
function renderLocaleInd(){
  const L=S.locale; let h='';
  const tR=(typeof terminoRegione==='function')?terminoRegione():'Regione';   // Fetta B: «Regione»→Stato/Provincia per le circoscrizioni estere
  const adReg=function(s){ if(typeof curLang==='function'&&curLang()==='en'){ if(tR==='Regione'||tR==='Comunità') return s; const adj=(tR==='Provincia')?'Provincial':(tR==='Prefettura')?'Prefectural':'State'; const noun=(tR==='Provincia')?'province':(tR==='Prefettura')?'prefecture':'state';
      return String(s).replace(/Regional/g,adj).replace(/region/g,noun); }
    if(tR==='Regione') return s; const agg=(tR==='Stato')?'statal':'provincial'; const della=(tR==='Stato')?'dello Stato':'della '+tR;
    return String(s).replace(/della Regione/g,della).replace(/Regione/g,tR).replace(/regionali/g,agg+'i').replace(/regionale/g,agg+'e'); };   // (rinominata da T: oscurava la funzione i18n)
  (LOCALE_IND[L.tipo]||[]).forEach(function(d){ const v=Math.round(L.ind[d.id]); const c=v<33?'var(--neg)':v<60?'var(--warn)':'var(--pos)';
    h+=`<div class="grp"><div class="top"><div class="nm">${adReg(T(d.nm))}<small>${adReg(T(d.desc))}</small></div><div class="pc mono" style="color:${c}">${v}</div></div><div class="bar">${fillI('loc:'+d.id, clamp(v,2,100), c)}</div></div>`; });
  return h;
}
function renderLocaleLeve(){
  const L=S.locale; let h='';
  const tR=(typeof terminoRegione==='function')?terminoRegione():'Regione';
  const adRegL=function(x){ if(typeof curLang==='function'&&curLang()==='en'){ if(tR==='Regione'||tR==='Comunità') return x; const adj=(tR==='Provincia')?'Provincial':(tR==='Prefettura')?'Prefectural':'State'; const noun=(tR==='Provincia')?'province':(tR==='Prefettura')?'prefecture':'state';
      return String(x).replace(/Regional/g,adj).replace(/region/g,noun); }
    if(tR==='Regione') return x; const agg=(tR==='Stato')?'statal':'provincial'; const della=(tR==='Stato')?'dello Stato':'della '+tR;
    return String(x).replace(/della Regione/g,della).replace(/Regione/g,tR).replace(/regionali/g,agg+'i').replace(/regionale/g,agg+'e'); };
  var tot=0; (LOCALE_LEVE[L.tipo]||[]).forEach(function(lv){ if(lv.ind) tot+=levaEuroAnno(lv.costo[L.leve[lv.id]||0]); });   // COSTO RICORRENTE dei servizi (cantiere Budget): la spesa corrente che le tue leve impegnano ogni anno
  if(tot>0) h+=`<div class="fiscbar" style="margin:0 0 9px"><span class="fl">${T('Servizi correnti')}</span><span class="fv">${euro(tot)}/${T('anno')}</span></div>`;
  (LOCALE_LEVE[L.tipo]||[]).forEach(function(lv){ const cur=L.leve[lv.id]||0;
    const tag=lv.ind?`<span class="polcost">${euro(levaEuroAnno(lv.costo[cur]))}/${T('anno')}</span>`:'';
    h+=`<div class="grp"><div class="top"><div class="nm">${adRegL(T(lv.nm))}</div>${tag}</div><div class="seg" style="margin-top:5px">`
      +lv.levels.map(function(lab,i){ return `<button class="${cur===i?'on':''}" style="font-size:12px" onclick="setLocaleLeva('${lv.id}',${i})">${T(lab)}</button>`; }).join('')+`</div></div>`; });
  return h;
}
function renderLocalePage(){
  const L=S.locale;
  let h=`<button class="mini-btn" style="margin-bottom:10px" onclick="chiudiMinistero()">← ${T('Governo')}</button>`;
  const tR=terminoRegione(); const tRa=(L.tipo==='città'?T('il Comune'):((typeof curLang==='function'&&curLang()==='en')?'the '+enTermine(tR):artTermine(tR)+' '+tR)); const tRA=tRa.charAt(0).toUpperCase()+tRa.slice(1);
  h+=`<div class="contorno" style="font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin:2px 2px 8px;">${escAttr(localeNome())} · ${tRa}</div>`;
  /* il volto del territorio: la mappa REALE (OpenStreetMap), in cima — il colore di ogni zona riflette gli indicatori
     sotto. Compare solo se il paese ha mappe locali generate (altrimenti: solo indicatori+leve, come prima). */
  if(mappaLocale()){
    const tQ = T(mappaLocale().et || ((L.tipo==='città') ? 'I quartieri' : 'Le zone'));
    h+=`<div class="card uno"><div class="ct">${tQ}</div><div class="mappa-wrap">${renderQuartieriSVG()}</div>
      <div class="mappa-leg"><span><i style="background:var(--pos)"></i>${T('curato')}</span><span><i style="background:var(--warn)"></i>${T('così così')}</span><span><i style="background:var(--neg)"></i>${T('trascurato')}</span></div>
      ${renderQuartieriInfo()}
      <div class="contorno" style="font-size:11px;color:var(--mut2);padding:0 14px 10px">${T('Confini reali © OpenStreetMap (ODbL)')}</div></div>`;
  }
  /* BILANCIO LOCALE in € (cantiere Budget): la cassa vera del Comune/Regione, dalla quale le carte con un costo dichiarato attingono. */
  if(L.budget!=null) h+=`<div class="card"><div class="ct">${T(L.tipo==='città'?'Bilancio del Comune':'Bilancio della Regione')}</div>
    <div class="ind" style="border-top:none"><div class="nm"><b style="font-size:17px">${euro(L.budget)}</b><small>${T('la cassa annua che puoi impegnare nelle tue scelte')}</small></div></div></div>`;
  h+=`<div class="card"><div class="ct">${tRA} · ${T('gli indicatori')}</div>${renderLocaleInd()}</div>`;
  h+=`<div class="card"><div class="ct">${T('Le tue leve')}</div><div style="font-size:12px;color:var(--mut2);padding:0 14px 4px">${T("Più servizi costano al bilancio; i tributi lo rimpinguano ma pesano sul consenso. Trova l'equilibrio.")}</div>${renderLocaleLeve()}</div>`;
  return h;
}
function renderMinisteroPage(minId){
  const M=MINISTRIES.find(x=>x.id===minId), m=getMin(minId), _nm=(typeof dicNm==='function'?dicNm(minId):M.nm);   // D3: nome dicastero era-aware (overlay '50)
  let h=`<button class="mini-btn" style="margin-bottom:10px" onclick="chiudiMinistero()">← ${T('Governo')}</button>`;
  h+=`<div class="contorno" style="font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin:2px 2px 8px;">${icon(minId,T(_nm))} ${T(_nm)} · ${T(M.desc)}</div>`;
  h+=budgetRow();   // RP+saldo sticky anche qui: da questa pagina si cambiano politiche e leggi che costano RP
  if(S.livello===2 && minId===S.dicastero){
    h+=`<div class="card"><div class="ct">${T('Il ministro · sei tu')}</div><div style="padding:6px 14px 12px;font-size:12.5px;color:var(--mut2)">${T('Questo è il <b>tuo</b> dicastero. Le leve e le leggi qui sotto sono le uniche che controlli: i risultati costruiscono il tuo capitale politico.')}</div></div>`;
  } else {
    h+=`<div class="card"><div class="ct">${T('Il ministro')}</div>${renderMinistroCard(m,'pagina')}</div>`;
  }
  const pols=POLICIES.filter(p=>p.min===minId);
  if(pols.length) h+=`<div class="card"><div class="ct">${T('Politiche del settore')}</div>${pols.map(renderPolicySlider).join('')}</div>`;
  const laws=leggiDelPaese().filter(L=>L.min===minId);
  if(laws.length) h+=`<div class="card g2"><div class="ct">${T('Leggi del settore')}</div>${laws.map(renderLegge).join('')}</div>`;
  const pend=(S.agenda||[]).filter(a=>!a.resolved && a.data && a.data.min===minId);
  h+=`<div class="card"><div class="ct">${T('Dossier di settore')}</div><div class="log">`;
  if(pend.length) h+=pend.map(a=>`<div class="li"><b>${T(a.data.kick||'Dossier')}.</b> ${T(a.data.t)} — <span style="color:var(--acc)">${T('in agenda di Governo')}</span></div>`).join('');
  else h+=`<div class="li" style="opacity:.65">${T("Nessuna situazione aperta per questo dicastero. Quando se ne presenta una (dossier o evento internazionale), compare qui e nell'agenda di Governo.")}</div>`;
  h+=`</div></div>`;
  return h;
}

/* ===== UFFICIO STAMPA — tab di primo livello (2026-06-11; ex drill-down "Sala stampa").
   Al governo: rapporto coi media, prima pagina in grande, e le azioni proattive col flusso
   azione → BERSAGLIO → TONO: l'anteprima mostra il comunicato vero, già col nome dentro
   (pool DICHIARAZIONI in data.js, tarato per la cadenza MENSILE). Da sfidante: rimando al loop
   d'opposizione + visibilità/credibilità in lettura (restano anche in Governo: niente dato orfano).
   SALA_SUB = {az, target} transitorio (mai in S), azzerato da setTab e spendiMossa. ===== */
let SALA_SUB=null;
function salaAz(a){ SALA_SUB=(SALA_SUB && SALA_SUB.az===a)?null:{az:a, target:null}; render(); }
function salaTarget(t){ if(SALA_SUB){ SALA_SUB.target=t; render(); } }
/* L'esposizione giudiziaria si vede QUI, mai come numero (lotto 3, scelta di Giacomo): fasce sfumate
   nel registro d'agenzia. Sotto 25 il silenzio — il premio di chi gioca pulito. */
function fasciaEsposizione(){
  const ex=S.esposizione||0;
  let t=null, col='var(--mut2)';
  if(S.inchiesta){ t=T('L\'inchiesta è in corso: il paese guarda l\'aula.'); col='var(--neg)'; }
  else if(ex>=60){ t=T('I riflettori giudiziari sono accesi: un avviso può arrivare.'); col='var(--neg)'; }
  else if(ex>=45){ t=T('Si mormora di te nei palazzi: i fascicoli si muovono.'); col='var(--warn-ink)'; }
  else if(ex>=25){ t=T('Qualche dossier circola nelle redazioni.'); }
  if(!t) return '';
  return `<div style="font-size:12px;color:${col};margin-top:7px;padding-top:7px;border-top:1px dashed var(--line)">${t}</div>`;
}
/* setLineaMedia (lotto stampa-opposizione): preferenza pura in S, cambiabile sempre, gratis. Persiste al confine
   di mese (commitSnap qui = autosave subito; a metà mese il caricamento riparte dal mese corrente, com'è documentato). */
function setLineaMedia(l){
  if(!S || !S.opposizione) return;
  if(['attacco','documentata','istituzionale'].indexOf(l)<0) return;
  S.lineaMedia=l;
  if(typeof commitSnap==='function') commitSnap();
  render();
}
function renderStampaTab(){
  const el=document.getElementById('sec-stampa');
  if(S.opposizione){
    const ob=(l,sub,v)=>{ const c=v<33?'var(--neg)':v<60?'var(--warn)':'var(--pos)'; return `<div class="grp"><div class="top"><div class="nm">${l}<small>${sub}</small></div><div class="pc mono" style="color:${c}">${Math.round(v)}</div></div><div class="bar"><i style="width:${clamp(v,2,100)}%;background:${c}"></i></div></div>`; };
    /* LA LINEA COI MEDIA (lotto stampa-opposizione): il timone al posto del cartello. Era-skin: il canale del
       tuo tempo ('50 = comizi e giornali di partito, TV solo dal '54 · presente = talk e social). */
    const lm=(typeof lineaMedia==='function')?lineaMedia():'documentata';
    const canale=(S.era===LINEA_IT)
      ? (S.year>=1954 ? T('Nel tuo tempo la linea passa dai comizi, dai giornali di partito e dalla nuova televisione.')
                      : T('Nel tuo tempo la linea passa dai comizi e dai giornali di partito.'))
      : T('Oggi la linea passa dai talk, dai social e dalle interviste.');
    const LDESC={ attacco:T('Attacco frontale: molta visibilità, ma la credibilità non cresce e si espone di più.'),
                  documentata:T('Critica documentata: la via bilanciata — colpi nel merito, visibilità e credibilità in equilibrio.'),
                  istituzionale:T('Profilo istituzionale: credibilità su e protetta, metà visibilità.') };
    const lbtn=(id,label)=>`<button class="${lm===id?'on':''}" onclick="setLineaMedia('${id}')">${label}</button>`;
    el.innerHTML=`<div class="contorno" style="font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin:2px 2px 8px;">${T('Ufficio stampa · comunicazione')}</div>`
      +`<div class="card"><div class="ct">${T('La linea coi media')}</div>
        <div class="seg" style="margin:6px 0 8px">${lbtn('attacco',T('Attacco'))}${lbtn('documentata',T('Documentata'))}${lbtn('istituzionale',T('Istituzionale'))}</div>
        <div style="font-size:12px;color:var(--mut);line-height:1.45">${LDESC[lm]} ${canale}</div></div>`
      +`<div class="card"><div class="ct">${T('Come ti vedono')}</div>${ob(T('Visibilità'),T('quanto i media parlano di te'),S.visibilita||0)}${ob(T('Credibilità'),T('quanto sei un\'alternativa seria'),S.credibilita||0)}${fasciaEsposizione()}</div>`
      +`<div class="card"><div class="ct">${T('Come funziona')}</div><div class="log"><div class="li">${T("La <b>linea</b> decide come la tua mossa mensile d'opposizione (scheda Governo) si traduce in visibilità e credibilità: la mossa resta una, cambia la resa. Puoi cambiarla quando vuoi, gratis — nessuna linea è giusta sempre: dipende da dove sei ferito. Vincendo le elezioni, qui troverai l'apparato di comunicazione del governo.")}</div></div></div>`;
    return;
  }
  const st=Math.round(S.ind.stampa||0), disp=mossaDisponibile();
  const fascia=fasciaEsposizione();
  const stCol=st>=60?'var(--pos)':st<=40?'var(--neg)':'var(--txt)';
  const sgn=n=>(n>=0?'+':'')+n;
  let h=`<div class="contorno" style="font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin:2px 2px 8px;">${T('Ufficio stampa · il rapporto coi media')}</div>`;
  h+=`<div class="card" style="padding:10px 14px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px"><span style="font-size:12.5px;color:var(--mut)">${T('Rapporto con la stampa')}</span><span class="mono" style="font-weight:600;font-size:16px;color:${stCol}">${st}<span class="contorno" style="color:var(--mut2);">/100</span></span></div>
    <div class="bar">${fillI('stampa:sala', clamp(st,2,100), st>=60?'var(--pos)':st<=40?'var(--neg)':'var(--brand)')}</div>
    <div style="font-size:12px;color:var(--mut2);margin-top:5px">${T('Sopra ~64 i colpi politici si attutiscono; sotto ~36 si gonfiano. Nel silenzio torna verso %N%X.').replace('%N',50+etaAutorev()).replace('%X',etaAutorev()?' ('+T('l\'età pesa:')+' '+T(etaAutorev()>0?'l\'autorevolezza aiuta':'devi conquistarti il rispetto')+')':'')}</div>${fascia}</div>`;
  if(S.titoloMese) h+=`<div class="card" style="padding:11px 14px;margin-bottom:12px"><div class="contorno" style="letter-spacing:.16em;text-transform:uppercase;color:var(--mut)">${T('La prima pagina')} · ${T(MONTHS[S.month-1])}</div>
    <div style="font-family:'Fraunces',serif;font-style:italic;font-size:16.5px;margin-top:4px;line-height:1.3">«${S.titoloMese.testo}»</div></div>`;
  if(S.promessa) h+=`<div class="banner" style="font-size:12.5px">${T('Intervista in piedi: hai promesso attenzione a <b>%G</b>. Colpirlo con le tue scelte nei prossimi mesi sarà rinfacciato.').replace('%G',nomeGruppo(S.promessa.grp))}</div>`;
  const stResto=disp?0:Math.max(1,cdStampa()-((S.year*12+S.month)-S.mossaUltima));   // il contatore legge cdStampa(): col personaggio anziano dice il numero vero
  /* Lotto 1: la sala EVIDENZIA la mossa che conviene (affinamento #1: segnale → capisco → agisco, niente caccia al tesoro) */
  const ap=disp?aperturaStampa():null;
  if(ap){ const reason= ap.tipo==='segnale' ? T('L\'alleato %A scivola: un segnale ora lo rinsalda, prima che chieda di più.').replace('%A', T((part(ap.ally)||{}).nome||'—')) : T('I numeri reggono davvero: è il momento di annunciare i risultati.');
    h+=`<div class="banner" style="border-color:var(--acc)"><b>${T('Conviene una mossa.')}</b> ${reason}</div>`; }
  h+=`<div class="card"><div class="ct">${T('La dichiarazione del mese')} ${disp?'':`<small style="color:var(--warn-ink);font-weight:600;text-transform:none;letter-spacing:0"> ${T('· già rilasciata: torna')} ${stResto<=1?T('il mese prossimo'):T('tra %N mesi').replace('%N',stResto)}</small>`}</div><div class="choices" style="padding:0 14px 14px;display:flex;flex-direction:column;gap:8px">`;
  const dis=disp?'':'disabled style="opacity:.5"';
  /* anteprima dei toni: comunicato col bersaglio già nominato + effetti in chiaro */
  const toni=(pool, repl, call, eff)=>`<div style="display:flex;flex-direction:column;gap:6px;padding:2px 0 4px">`+pool.map(d=>`<button class="opt" style="border-color:var(--brand)" onclick="${call(d.id)}"><span class="ol">${T(d.l)}</span><span class="oe" style="font-style:italic">«${T(d.testo).replace(/%[GAP]/g,repl)}»</span><span class="oe" style="color:var(--mut2)">${eff(d)}</span></button>`).join('')+`</div>`;
  // INTERVISTA: tema → tono
  h+=`<button class="opt" ${dis} onclick="salaAz('intervista')"><span class="ol">${T('Intervista')} ${SALA_SUB&&SALA_SUB.az==='intervista'?'▾':''}</span><span class="oe">${T('Scegli un tema e un tono: quel mondo ti ascolta — ma prometti, e i fatti contro di lui ti saranno rinfacciati')}</span></button>`;
  if(disp && SALA_SUB && SALA_SUB.az==='intervista'){
    if(!SALA_SUB.target) h+=`<div style="display:flex;flex-wrap:wrap;gap:6px;padding:0 2px">`+GROUPS.map(g=>`<button class="mini-btn" style="margin-top:0" onclick="salaTarget('${g.id}')">${T(g.nm)}</button>`).join('')+`</div>`;
    else h+=toni(DICHIARAZIONI.intervista, nomeGruppo(SALA_SUB.target), id=>`azioneIntervista('${SALA_SUB.target}','${id}')`, d=>`${T('tema')} ${sgn(d.grp)} · ${T('stampa')} ${sgn(d.stampa)} · ${T('promessa attiva')}`);
  }
  // ANNUNCIO: subito i toni
  h+=`<button class="opt" ${dis} onclick="salaAz('annuncio')"><span class="ol">${T('Annuncio dei risultati')}${ap&&ap.tipo==='annuncio'?` <span class="chip" style="background:var(--acc-bg);color:var(--acc-ink)">${T('consigliato')}</span>`:''} ${SALA_SUB&&SALA_SUB.az==='annuncio'?'▾':''}</span><span class="oe">${T('I fatti giudicano: regge se crescita ≥1, disoccupazione ≤7 o fiducia ≥70 — ora')} ${fmt(S.ind.growth,1)} · ${fmt(S.ind.unemp,1)} · ${fmt(S.ind.fiducia,0)}</span></button>`;
  if(disp && SALA_SUB && SALA_SUB.az==='annuncio') h+=toni(DICHIARAZIONI.annuncio, '', id=>`azioneAnnuncio('${id}')`, d=>`${T('se regge: ceto medio')} ${sgn(d.regge.cm)}, ${T('stampa')} ${sgn(d.regge.stampa)} · ${T('se gonfiato:')} ${d.gonfiato.cm}, ${T('stampa')} ${d.gonfiato.stampa}`);
  // SEGNALE: alleato → tono
  const alleati=(S.coalizione||[]).filter(id=>id!==S.partito && S.tenuta && S.tenuta[id]!=null);
  if(alleati.length){
    h+=`<button class="opt" ${dis} onclick="salaAz('segnale')"><span class="ol">${T('Segnale a un alleato')}${ap&&ap.tipo==='segnale'?` <span class="chip" style="background:var(--acc-bg);color:var(--acc-ink)">${T('consigliato')}</span>`:''} ${SALA_SUB&&SALA_SUB.az==='segnale'?'▾':''}</span><span class="oe">${T('Apertura pubblica: la tenuta si rinsalda senza concedere nulla')}</span></button>`;
    if(disp && SALA_SUB && SALA_SUB.az==='segnale'){
      if(!SALA_SUB.target) h+=`<div style="display:flex;flex-wrap:wrap;gap:6px;padding:0 2px">`+alleati.map(id=>`<button class="mini-btn" style="margin-top:0" onclick="salaTarget('${id}')">${T((part(id)||{}).nome)} · ${Math.round(S.tenuta[id])}</button>`).join('')+`</div>`;
      else h+=toni(DICHIARAZIONI.segnale, T((part(SALA_SUB.target)||{}).nome||''), id=>`azioneSegnale('${SALA_SUB.target}','${id}')`, d=>`${T('tenuta')} ${sgn(d.tenuta)}${d.stampa?` · ${T('stampa')} ${sgn(d.stampa)}`:''}`);
    }
  }
  // ATTACCO: avversario → tono
  const avversari=PAESE.partiti.filter(p=>!(S.coalizione||[]).includes(p.id)).map(p=>p.id);
  if(avversari.length){
    h+=`<button class="opt" ${dis} onclick="salaAz('attacco')"><span class="ol">${T('Attacco a un avversario')} ${SALA_SUB&&SALA_SUB.az==='attacco'?'▾':''}</span><span class="oe">${T('Ne eroda la forza')}${T(S.ind.consenso<45?' — <b>ora i media lo leggerebbero come diversivo</b> (consenso sotto 45)':' — ma la stampa giudica il tono')}</span></button>`;
    if(disp && SALA_SUB && SALA_SUB.az==='attacco'){
      if(!SALA_SUB.target) h+=`<div style="display:flex;flex-wrap:wrap;gap:6px;padding:0 2px">`+avversari.map(id=>`<button class="mini-btn" style="margin-top:0" onclick="salaTarget('${id}')">${T((part(id)||{}).nome)}</button>`).join('')+`</div>`;
      else h+=toni(DICHIARAZIONI.attacco, T((part(SALA_SUB.target)||{}).nome||''), id=>`azioneAttacco('${SALA_SUB.target}','${id}')`, d=>T('forza %A a lui, %B a te · stampa %C').replace('%A',d.forzaLui).replace('%B',sgn(d.forzaMia)).replace('%C',sgn(d.stampa)));
    }
  }
  h+=`</div></div>`;
  h+=`<div class="card"><div class="ct">${T('Come funziona')}</div><div class="log"><div class="li">${T("La stampa <b>commenta ogni mese</b> (la prima pagina, anche in Governo) e <b>amplifica o attutisce</b> i colpi politici secondo il rapporto. Le <b>conferenze stampa</b> arrivano dall'agenda; qui agisci tu: <b>una dichiarazione al mese</b>, col tono che scegli — più ti esponi, più incassi, più la stampa giudica.")}</div></div></div>`;
  el.innerHTML=h;
}

/* la VITA PERSONALE resa un INDICATORE VISIBILE (cantiere Fase 2): la serenità è l'UNICA dimensione personale VIVA
   (coniuge/figli sono personaggi che vi confluiscono; affetti/affettiSacrificati sono contatori-tratto di fine carriera),
   quindi UN solo indicatore chiaro, non due inventati. Stessa lingua visiva degli indicatori professionali
   (valore/100 + barra animata via fillI, la stessa della card "Notorietà"/"Capitale") + l'etichetta umana sotto, così
   il costo delle scelte vita-vs-carriera si VEDE muoversi. Solo con famiglia presente (come prima). */
function vitaPersonaleCard(){
  const fam=S.famiglia;
  if(!fam || !(fam.coniuge || (fam.figli&&fam.figli.length)) || fam.serenita==null) return '';
  const sv=Math.round(fam.serenita);
  const ink=sv>=60?'var(--pos)':sv>=35?'var(--warn-ink)':'var(--neg)';   // testo piccolo → ink scuri (contrasto ≥4,5:1)
  const barc=sv>=60?'var(--pos)':sv>=35?'var(--warn)':'var(--neg)';       // barra → amber vivido
  const lab=sv>=60?T('Affetti curati'):sv>=35?T('Affetti un po\' trascurati'):T('La famiglia è in crisi');
  return `<div class="card" style="padding:10px 14px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px"><span style="font-size:12.5px;color:var(--mut)">${T('Vita personale')}</span><span class="mono" style="font-weight:600;font-size:16px;color:${ink}">${sv}<span class="contorno" style="color:var(--mut2);">/100</span></span></div>
    <div class="bar">${fillI('vita', clamp(sv,2,100), barc)}</div>
    <div style="font-size:12px;color:${ink};font-weight:600;margin-top:7px">${lab}</div></div>`;
}
/* RIGA-BILANCIO persistente (cantiere Budget): le cifre in € del livello corrente, SEMPRE in vista mentre decidi — non più
   sepolte nella scheda Paese. Liv.1 = bilancio del Comune/Regione; liv.3/2 = Bilancio dello Stato + saldo annuo (segno+colore). */
function bilancioRiga(){
  if(S.opposizione || S.livello===4 || S.livello===5) return '';
  if(S.livello===1){ if(!S.locale || S.locale.budget==null) return '';
    return `<div class="fiscbar"><span class="fl">${T(S.locale.tipo==='città'?'Bilancio del Comune':'Bilancio della Regione')}</span><span class="fv">${euro(S.locale.budget)}</span></div>`;
  }
  if(S.pil){ const def=S.ind.deficit, salMln=S.pil*Math.abs(def)*10, disav=(def>0), c=!disav?'var(--pos)':def<=3?'var(--warn-ink)':'var(--neg)';
    return `<div class="fiscbar"><span class="fl">${T('Bilancio dello Stato')}</span><span class="fv">${euro(S.pil*(S.quotaSpesa!=null?S.quotaSpesa:0.48)*1000)} · <span style="color:${c}">${T('saldo')} ${disav?'−':'+'}${euro(salMln)}</span></span></div>`;   // bilancio = SPESA pubblica ≈ quota-PIL per-epoca (48% oggi, 22% nel '50 — bug sfuggito al fix-valuta: era 480 fisso); saldo = disavanzo
  }
  return '';
}
/* media della reputazione sui 6 gruppi — una delle valute del gate di laurea (Build A) */
/* L72-1 — IL PAVIMENTO E LA RIVOLTA, VISIBILI. Sulla barra di ogni gruppo un segno rosso dice dov'e' il pavimento
   (60% del target a leve neutre, pavimentoGruppo in model.js); quando un gruppo ci sta sotto, sotto la barra compare
   il conto alla rovescia — mesi sotto, mesi alla crisi — e in testa alla scheda di governo un banner lo ripete.
   Prevedibile e visibile e' informazione; prevedibile e nascosto sarebbe inganno (L59-4). Testo di decisione: 12px. */
function pavTick(id){ if(typeof pavimentoGruppo!=='function'||!S.groups||S.opposizione) return ''; const p=pavimentoGruppo(id); return `<b class="pav" style="left:${clamp(p,0,100)}%" title="${T('soglia')} ${fmt(p,0)}"></b>`; }
function rivoltaHtml(id){ const R=S.rivolta; if(S.opposizione||!R||!R[id]) return ''; const n=Math.max(0,(dif().mesiRivolta||6)-R[id]);
  return `<div class="rivolta">${T('Sotto la soglia da <b>%M</b> mesi · crisi fra <b>%N</b>').replace('%M',R[id]).replace('%N',n)}</div>`; }
function rivoltaBanner(){ const R=S.rivolta; if(S.opposizione||!R) return ''; let h='';
  for(const gr of GROUPS){ if(!R[gr.id]) continue; const n=Math.max(0,(dif().mesiRivolta||6)-R[gr.id]);
    h+=`<div class="banner rivolta-banner">${T('<b>%G</b> — un pezzo di paese ti ha voltato le spalle: sotto la soglia di %P da %M mesi. Riportalo sopra con le politiche, o fra <b>%N mesi</b> la crisi ti travolge.').replace('%G',T(gr.nm)).replace('%P',fmt(pavimentoGruppo(gr.id),0)).replace('%M',R[gr.id]).replace('%N',n)}</div>`; }
  return h; }
function mediaGruppi(){ if(typeof GROUPS==='undefined'||!S.groups) return 0; var s=0,n=0; GROUPS.forEach(function(g){ if(S.groups[g.id]!=null){ s+=S.groups[g.id]; n++; } }); return n?s/n:0; }
/* Scheda ATTIVISTA (Build A) — L1: cruscotto della militanza. Le 3 valute (base/autorev/reputazione media) con la SOGLIA
   di laurea visibile (gate non invisibile, rifinitura 2a) + i 6 gruppi col template `.grp` esistente. Le mosse arrivano a L2. */
function renderAttivista(){
  const A=S.attivista||{base:0,autorev:0}; const med=mediaGruppi();
  const SOG=(typeof LAUREA_SOGLIE!=='undefined')?LAUREA_SOGLIE:{base:60,rep:55,autorev:50};
  let h='';
  /* A.5 REWORK L2: la campagna vive NEL Movimento — barra compatta e INTEGRATA (borderless, sopra la carta), non un box a sé */
  if(A.campagna && !A.laurea){ const C=A.campagna, prog=Math.round(C.progresso||0);
    const laneTxt=(C.lane==='piazza')?T('la nutri con la piazza'):T('la nutri con l\'istituzionale');
    const resaTxt=C.resaPending?T('alla resa'):T('%N mesi alla resa').replace('%N',C.mesiRestanti);
    h+=`<div style="display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:12px;color:var(--mut);flex-wrap:wrap;">`
      +`<b style="color:var(--txt);font-size:12.5px">${T('Campagna')}: ${T(C.tipo)}</b>`
      +`<div style="flex:1;min-width:70px;max-width:130px;height:5px;background:var(--line2);border-radius:3px;overflow:hidden;"><i style="display:block;height:100%;width:${clamp(prog,2,100)}%;background:${barColor(prog)};"></i></div>`
      +`<span class="mono" style="color:${barColor(prog)};font-weight:600">${prog}%</span><span>· ${resaTxt} · ${laneTxt}</span></div>`;
  }
  if(A.laurea){
    /* LA LAUREA (Build A, L4): raggiunto il gate, la carta-mossa lascia il posto alla PRIMA CANDIDATURA. Il giocatore sceglie il
       territorio → diventaLocale() monta S.locale preservando l'identità. Nessuna pressione: l'offerta resta aperta, avanza quando vuole. */
    h+=`<div class="ag major">${agScene({kind:'attivista',data:{kick:'Società civile',tono:'florido',id:'laurea'}})}<div class="ah"><div class="kick">${T('La prima candidatura')}</div><h3>${T('Sei pronto a scendere in campo')}</h3></div>`;
    h+=`<div class="atext">${T('Hai costruito una base militante, la fiducia dei gruppi e l\'autorevolezza sul campo. Il partito ti offre la prima candidatura: scegli dove correre.')}</div>`;
    h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:2px 12px 12px;">`
      +(PAESE.territori||[]).map(function(TE,i){ const isC=TE.tipo==='città';
        return `<button onclick="diventaLocale(${i})" style="padding:8px;border-radius:9px;border:1px solid var(--line2);background:var(--panel);color:var(--txt);font-family:inherit;font-size:12px;cursor:pointer;text-align:left;"><b>${nomeTerr(TE)}</b><br><span style="font-size:12px;color:var(--mut2)">${caricaTerr(TE)} · ${T(isC?'città':'regione')}</span></button>`; }).join('')
      +`</div></div>`;
  } else {
    /* la CARTA-MOSSA del mese (Build A, L2): scena (RUOTA per tema, anti-wallpaper) + le 3 scelte. resolveItem le applica
       (muove le valute), agendaPending fa da gate → una mossa per turno. */
    (S.agenda||[]).forEach(function(it,idx){ if(it.kind!=='attivista'||!it.data) return; const d=it.data;
      h+=`<div class="ag major ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${T(d.kick)}</div><h3>${T(d.t)}</h3></div><div class="atext">${T(d.text)}</div>`;
      if(!it.resolved){ h+=`<div class="opts">`+d.ch.map(function(c,ci){ return `<button class="opt" onclick="resolveItem(${idx},${ci})"><span class="ol">${T(c.l)}</span><span class="oe">${T(c.e)}</span></button>`; }).join('')+`</div>`; }
      else h+=`<div class="outcome">${it.outcome||''}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    });
  }
  h+=`<div class="banner"><b>${T('La tua militanza.')}</b> ${T('Nessuna carica, nessun bilancio: costruisci mese per mese la tua base, la reputazione presso i gruppi e l\'autorevolezza sul campo, fino alla prima candidatura.')}</div>`;
  /* le tre valute del gate, con barra */
  h+=`<div class="card"><div class="ct">${T('Le tue tre valute')}</div>`;
  h+=indRow('Base militante', 'la forza di chi ti segue', fmt(A.base,0), A.base);
  h+=indRow('Autorevolezza di campo', 'quanto il partito ti prende sul serio', fmt(A.autorev,0), A.autorev);
  h+=indRow('Reputazione media', 'la fiducia media dei sei gruppi', fmt(med,0), med);
  h+=`<div class="log"><div class="li">${ A.laurea
    ? T('<b>Soglie raggiunte.</b> Il partito è pronto a candidarti: scegli dove correre, qui sopra.')
    : T('Per la prima candidatura servono <b>base ≥ %B</b>, <b>reputazione media ≥ %R</b> e <b>autorevolezza ≥ %A</b>: nessuna scorciatoia, serve il mix.').replace('%B',SOG.base).replace('%R',SOG.rep).replace('%A',SOG.autorev)}</div></div>`;
  h+=`</div>`;
  /* i 6 gruppi — stesso template .grp della scheda Paese */
  h+=`<div class="card"><div class="ct">${T('La fiducia dei gruppi')}</div>`;
  for(const gr of GROUPS){ const v=S.groups[gr.id];
    h+=`<div class="grp"><div class="top"><div class="nm">${icon(gr.id,T(gr.nm))} ${T(gr.nm)}<small>${T('peso')} ${gr.w}%</small></div>
      <div class="pc" style="color:${barColor(v)}">${fmt(v,0)}%</div></div>
      <div class="bar"><i style="width:${clamp(v,2,100)}%;background:${barColor(v)}"></i>${pavTick(gr.id)}</div>${rivoltaHtml(gr.id)}</div>`; }
  h+=`</div>`;
  /* come funziona — la tensione della cura (le mosse diventano bottoni a L2) */
  h+=`<div class="card"><div class="ct">${T('Come funziona')}</div><div class="log"><div class="li">${T('Ogni mese scegli come muoverti: organizzare un gruppo, una battaglia pubblica, tessere col partito. La via <b>istituzionale</b> è lenta e sicura e piace ai moderati; la <b>piazza</b> è veloce e rischiosa e scalda la base. Entrambe legittime — e il gate chiede il mix.')}</div></div></div>`;
  return h;
}
/* ATTORNO (A.5, lotto 1): la SECONDA superficie della gavetta. Lotto 1 = scaffold + lo stato PURO (campagna/eventi) atterrato
   in S.attivista; la logica di campagna (avvio→progresso→resa) e gli eventi reattivi arrivano nei lotti successivi. */
/* CRUSCOTTO "CAMPAGNE" (A.5 REWORK L3): consultazione — campagna in corso (dettaglio+decadenza) · storico · il campo (contesto vivo).
   L'avvio/resa sono CARTE nel flusso (L2), non bottoni qui. I pallini `attenzioni()` accendono il tab solo sui momenti veri. */
function renderAttorno(){
  var A=S.attivista||{}, C=A.campagna, h='';
  h+=`<div class="banner">${T('<b>Le tue campagne.</b> Il cruscotto dei tuoi impegni: quella in corso, quelle concluse, e il campo che ti si muove intorno. Le lanci e le chiudi nel flusso, tra le mosse.')}</div>`;
  /* CAMPAGNA IN CORSO */
  h+=`<div class="card"><div class="ct">${T('Campagna in corso')}${C?' · '+T(C.tipo):''}</div>`;
  if(C){
    var prog=Math.round(C.progresso||0);
    var laneTxt=(C.lane==='piazza')?T('La nutri con le battaglie pubbliche.'):T('La nutri organizzando e tessendo col partito.');
    h+=`<div class="grp"><div class="top"><div class="nm">${T('Progresso')}<small>${laneTxt}</small></div><div class="pc" style="color:${barColor(prog)}">${prog}%</div></div>
      <div class="bar"><i style="width:${clamp(prog,2,100)}%;background:${barColor(prog)}"></i></div></div>`;
    h+=`<div class="log"><div class="li">${ C.resaPending ? T('È il momento della resa: la chiudi dal flusso, nel Movimento.')
      : (C._calato ? T('Sta calando: questo mese non l\'hai nutrita nella sua corsia. Un contributo in-corsia e riparte.')
      : T('%N mesi alla resa · il risultato scala sul progresso.').replace('%N',C.mesiRestanti)) }</div></div>`;
  } else h+=`<div class="log"><div class="li">${ A.laurea ? T('Sei pronto a candidarti: la stagione delle campagne è chiusa.') : T('Nessuna campagna in corso. Quando è il momento, l\'occasione di lanciarne una comparirà nel flusso, tra le tue mosse.') }</div></div>`;
  h+=`</div>`;
  /* STORICO — le campagne concluse, con l'esito (non solo il nome) */
  var storia=A.campStoria||[];
  if(storia.length){
    h+=`<div class="card"><div class="ct">${T('Le campagne concluse')}</div>`;
    storia.forEach(function(s){ var esito=s.q>=70?T('riuscita'):(s.q>=35?T('a metà'):T('fiacca'));
      h+=`<div class="log"><div class="li">${T(s.tipo)} — <b>${esito}</b> · ${s.q}%</div></div>`; });
    h+=`</div>`;
  }
  /* IL CAMPO — contesto VIVO (chi è più con te / chi si raffredda), non un registro morto */
  if(typeof GROUPS!=='undefined' && S.groups){
    var gs=GROUPS.map(function(g){ return {nm:g.nm, v:S.groups[g.id]}; }).filter(function(x){ return x.v!=null; }).sort(function(a,b){ return b.v-a.v; });
    if(gs.length>1) h+=`<div class="card"><div class="ct">${T('Il campo')}</div><div class="log"><div class="li">${T('Più con te: <b>%T</b>. Più freddi: <b>%B</b>.').replace('%T',T(gs[0].nm)).replace('%B',T(gs[gs.length-1].nm))}</div></div></div>`;
  }
  var el=document.getElementById('sec-attorno'); if(el) el.innerHTML=h;
}
function renderGov(){
  if(S.livello===0){ document.getElementById('sec-gov').innerHTML=renderAttivista(); return; }   // ATTIVISTA (Build A): scheda focalizzata sulla militanza
  if(!S.opposizione && S.ministeroAperto==='__locale__'){ document.getElementById('sec-gov').innerHTML=renderLocalePage(); return; }   // drill-down: cruscotto locale (livello 1)
  if(!S.opposizione && S.ministeroAperto){ document.getElementById('sec-gov').innerHTML=renderMinisteroPage(S.ministeroAperto); return; }   // drill-down: pagina del ministero
  let h='';
  let fioreB='';   // fioretto promozione: il banner-ruolo (liv 4/5) lo consuma; premier/ministro lo lasciano alla cronaca
  if(PROMO_FIORE && (S.livello===4||S.livello===5)){ fioreB=' promo-fiore'; PROMO_FIORE=false; }
  if(S.livello===4){
    /* livello 4 — SEGRETARIO GENERALE DEL CONSESSO (fase C1a): non governi un paese, medi tra i blocchi. Due indicatori. */
    const I=S.intl||{coesione:50,autorevolezza:50,mandato:1};
    const ob=(l,sub,v)=>{ const c=v<33?'var(--neg)':v<60?'var(--warn)':'var(--pos)'; return `<div class="grp"><div class="top"><div class="nm">${l}<small>${sub}</small></div><div class="pc mono" style="color:${c}">${Math.round(v)}</div></div><div class="bar"><i style="width:${clamp(v,2,100)}%;background:${c}"></i></div></div>`; };
    h+=`<div class="banner${fioreB}">${T('<b>Sei %R.</b> Non governi un paese: medi tra le potenze. Tieni coese le Nazioni Unite — e l\'autorevolezza apre le porte del compromesso.').replace('%R', T(typeof ruoloIntl==='function'?ruoloIntl():'Segretario generale delle Nazioni Unite'))}</div>`;
    h+=`<div class="card"><div class="ct">${T('Le Nazioni Unite')} · ${T('mandato')} ${I.mandato}</div>${ob(T('Coesione'),T('quanto i membri restano allineati'),I.coesione)}${ob(T('Autorevolezza'),T('la tua credibilità di mediatore'),I.autorevolezza)}</div>`;
  }
  else if(S.livello===5){
    /* livello 5 — DIPLOMATICO (C2): non governi, costruisci standing. Credito + il rapporto col Consesso (il gate al vertice). */
    const D=S.diplo||{credito:50,grado:1};
    const cons=(S.relInt&&S.relInt.consesso!=null)?S.relInt.consesso:50;
    const ob=(l,sub,v)=>{ const c=v<33?'var(--neg)':v<60?'var(--warn)':'var(--pos)'; return `<div class="grp"><div class="top"><div class="nm">${l}<small>${sub}</small></div><div class="pc mono" style="color:${c}">${Math.round(v)}</div></div><div class="bar"><i style="width:${clamp(v,2,100)}%;background:${c}"></i></div></div>`; };
    const meta=T((D.grado>=2)?'rapporto con l\'ONU ≥ 75 → la chiamata a Segretario':'credito ≥ 70 → la promozione a Sottosegretario generale');
    h+=`<div class="banner${fioreB}">${T('<b>Sei %R.</b> Non governi un paese: costruisci rapporti e credito, missione dopo missione. La via al vertice del mondo passa dallo standing — %M.').replace('%R', T(typeof ruoloDiplo==='function'?ruoloDiplo():'Ambasciatore')).replace('%M', meta)}</div>`;
    h+=`<div class="card"><div class="ct">${T('La scala diplomatica')} · ${T(D.grado>=2?'Sottosegretario generale':'Ambasciatore')}</div>${ob(T('Credito diplomatico'),T('la tua reputazione tra i diplomatici'),D.credito)}${ob(T('Rapporto con l\'ONU'),T('il favore dei fori multilaterali: la porta del vertice'),cons)}</div>`;
  }
  else if(S.opposizione){
    h+=`<div class="banner" style="border-color:var(--neg)">${T('<b>All\'opposizione.</b> Governa %P: niente bilancio né ministri. Ogni mese una mossa; segui la tua risalita nella scheda <b>Partiti</b>.').replace('%P',T((part(S.governoAvversario)||{}).nome||'—'))}</div>`;
    const ob=(l,sub,v)=>{ const c=v<33?'var(--neg)':v<60?'var(--warn)':'var(--pos)'; return `<div class="grp"><div class="top"><div class="nm">${l}<small>${sub}</small></div><div class="pc mono" style="color:${c}">${Math.round(v)}</div></div><div class="bar"><i style="width:${clamp(v,2,100)}%;background:${c}"></i></div></div>`; };
    h+=`<div class="card"><div class="ct">${T('La tua opposizione')}</div>${ob(T('Visibilità'),T('quanto i media parlano di te'),S.visibilita||0)}${ob(T('Credibilità'),T('quanto sei un\'alternativa seria'),S.credibilita||0)}</div>`;
  }
  else if(S.livello===1){
    /* livello 1 — POLITICO LOCALE: la tua città/regione è tutto il gioco; notorietà = capitale */
    const L=S.locale, cap=Math.round(S.capitale||0), cons=Math.round(L.consenso||0);
    const capCol=cap>=65?'var(--pos)':cap<35?'var(--neg)':'var(--txt)', consCol=cons<40?'var(--neg)':cons<55?'var(--warn)':'var(--pos)';
    h+=`<div class="banner">${T('<b>Sei %R</b>. Amministra %L: i risultati costruiscono la tua notorietà, e il partito ti chiamerà a Roma.').replace('%R',escAttr(ruoloLocale())).replace('%L',escAttr(localeNome()))}</div>`;
    h+=`<div class="card" style="padding:10px 14px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px"><span style="font-size:12.5px;color:var(--mut)">${T('Notorietà')}</span><span class="mono" style="font-weight:600;font-size:16px;color:${capCol}">${cap}<span class="contorno" style="color:var(--mut2);">/100</span></span></div>
      <div class="bar">${fillI('cap:loc', clamp(cap,2,100), capCol)}</div>
      <div style="display:flex;justify-content:space-between;margin-top:7px;font-size:12px"><span style="color:var(--mut2)">${T(L.tipo==='città'?'Consenso cittadino':'Consenso regionale')}</span><span style="color:${consCol};font-weight:600">${cons}/100</span></div>
      <div style="font-size:11px;color:var(--mut2);margin-top:5px">${T('Sopra ~65 di notorietà, il partito può offrirti un posto a Roma. Sotto 40 di consenso rischi la mancata rielezione.')}</div></div>`;
    h+=`<div class="card uno" onclick="apriMinistero('__locale__')" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:12px 14px;margin-bottom:12px"><span><b>${T(entitaLocale()).charAt(0).toUpperCase()+T(entitaLocale()).slice(1)}</b><br><span style="font-size:12px;color:var(--mut)">${T('i tuoi indicatori e le tue leve')}</span></span><span style="color:var(--acc-ink);font-size:13px">${T('Apri →')}</span></div>`;
  }
  else if(S.livello===2){
    /* livello 2 — MINISTRO: il tuo dicastero è la home, gli indicatori nazionali sono del premier (in lettura) */
    const pn=(S.premier||{}).nome||'il premier', leal=Math.round((S.premier||{}).lealta||0), cap=Math.round(S.capitale||0);
    const Mn=(typeof dicNm==='function'?dicNm(S.dicastero):((MINISTRIES.find(x=>x.id===S.dicastero)||{}).nm||''));   // D3: nome era-aware
    const capCol=cap>=65?'var(--pos)':cap<35?'var(--neg)':'var(--txt)', lealCol=leal<25?'var(--neg)':leal<50?'var(--warn)':'var(--pos)';
    h+=`<div class="banner">${T('<b>Sei %R</b> nel governo di <b>%P</b>. Governa lui il paese; tu costruisci il tuo capitale e punti al vertice.').replace('%R',escAttr(ruoloDicastero())).replace('%P',escAttr(pn))}</div>`;
    h+=`<div class="card" style="padding:10px 14px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px"><span style="font-size:12.5px;color:var(--mut)">${T('Capitale politico')}</span><span class="mono" style="font-weight:600;font-size:16px;color:${capCol}">${cap}<span class="contorno" style="color:var(--mut2);">/100</span></span></div>
      <div class="bar">${fillI('cap:min', clamp(cap,2,100), capCol)}</div>
      <div style="display:flex;justify-content:space-between;margin-top:7px;font-size:12px"><span style="color:var(--mut2)">${T('Fiducia del premier')}</span><span style="color:${lealCol};font-weight:600">${leal}/100${leal<25?T(' · sei in bilico'):''}</span></div>
      <div style="font-size:11px;color:var(--mut2);margin-top:5px">${T('Sopra ~65 di capitale, un\'occasione per salire può aprirsi. Distinguerti dal premier rende, ma se la sua fiducia crolla rischi il rimpasto.')}</div></div>`;
    h+=`<div class="card uno" onclick="apriMinistero('${S.dicastero}')" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:12px 14px;margin-bottom:12px"><span><b>${T('Il tuo dicastero')}</b><br><span style="font-size:12px;color:var(--mut)">${Mn} — ${T('le tue leve, leggi e dossier')}</span></span><span style="color:var(--acc-ink);font-size:13px">${T('Apri →')}</span></div>`;
  }
  else if(S.month===1) h+=`<div class="banner">${T('È <b>gennaio</b>: vai alla scheda <b>Bilancio</b> per varare la manovra dell\'anno (hai %N punti riforma).').replace('%N',rpLeft())}</div>`;
  h+=rivoltaBanner();   // L72-1: se un gruppo e' sotto il pavimento, il conto alla rovescia sta in testa al Governo
  h+=bilancioRiga();   // il € del livello corrente, persistente in cima al Governo (cantiere Budget): sempre sott'occhio mentre decidi
  /* la prima pagina del mese: presenza fissa della stampa + scorciatoia alla tab Stampa (solo al governo) */
  if(!S.opposizione && S.livello!==4 && S.livello!==5 && S.titoloMese){   // la striscia-stampa nazionale non vale per il Segretario (liv 4) né per il diplomatico (liv 5)
    const tm=S.titoloMese;
    h+=`<div class="pressa" onclick="setTab('stampa')"><div class="pk">${T('La stampa')} · ${T(MONTHS[S.month-1])} · <span style="color:${tm.tono==='amica'?'var(--pos)':'var(--neg)'}">${T(tm.tono==='amica'?'benevola':'ostile')}</span></div>
      <div class="pt">«${tm.testo}»</div><div class="pl">${T('Ufficio stampa →')}</div></div>`;
  }
  h+=vitaPersonaleCard();   // vita personale: indicatore visibile (valore/100 + barra animata + etichetta umana), prima dell'agenda
  // agenda
  h+=`<div class="contorno" style="font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin:2px 2px 8px;">${T('Agenda di')} ${T(MONTHS[S.month-1])}</div>`;
  const _sig=agendaSig(), _enter=(_sig!==lastAgendaSig); lastAgendaSig=_sig;   // entrata scaglionata SOLO quando il set di carte cambia (nuovo mese), non a ogni decisione/cambio scheda
  h+=`<div class="agbox${_enter?' enter':''}">`;
  if(!S.agenda.length){
    h+=`<div class="ag"><div class="calm">${T('Nessun dossier urgente questo mese. Puoi avanzare al mese successivo.')}</div></div>`;
  }
  S.agenda.forEach((it,idx)=>{
    if(it.kind==='rimpasto'){
      h+=`<div class="ag ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${T('Rimpasto di governo')}</div>
        <h3>${T('Nuovo ministro:')} ${T(MINISTRIES.find(x=>x.id===it.min).nm)}</h3></div>
        <div class="atext">${T('Scegli chi guiderà il dicastero.')}</div>`;
      if(!it.resolved){ h+=`<div class="opts">`+it.cands.map((c,i)=>`<button class="opt" onclick="resolveItem(${idx},${i})">
        <span class="ol">${c.nm}</span><span class="oe"><span class="chip" style="background:${PROFCOL[c.profile]}22;color:${PROFCOL[c.profile]}">${gergo(T(PROF[c.profile]),'profilo')}</span> · ${T('competenza')} ${c.comp}/3</span></button>`).join('')+`</div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='proposta'){
      const m=getMin(it.min); const p=it.prop;
      const role=T(MINISTRIES.find(x=>x.id===it.min).nm);
      h+=`<div class="ag ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${T('Iniziativa del Ministro')}</div>
        <h3>${T(p.t)}</h3></div>
        <div class="say">${avatar(m)}<div class="body"><div class="nm">${m?m.nm:''} ${chipOf(m)}<small> · ${role}</small></div>
          <div class="bubble">${T('Propongo:')} ${T(p.text)}</div></div></div>`;
      if(!it.resolved){ h+=`<div class="opts">
        <button class="opt" onclick="resolveItem(${idx},0)"><span class="ol">${T('Approva')}</span><span class="oe">${T(p.e)}</span>${costoChip(p)}</button>
        <button class="opt" onclick="resolveItem(${idx},1)"><span class="ol">${T('Respingi')}</span><span class="oe">${T('Nessun effetto; il ministro la prende male')}</span></button></div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='budget'){
      const m=getMin(it.min); const b=it.req;
      const role=T(MINISTRIES.find(x=>x.id===it.min).nm);
      h+=`<div class="ag ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${T('Richiesta di bilancio')}</div>
        <h3>${T(b.t)}</h3></div>
        <div class="say">${avatar(m)}<div class="body"><div class="nm">${m?m.nm:''} ${chipOf(m)}<small> · ${role}</small></div>
          <div class="bubble">${T('Servono fondi per %X').replace('%X',T(b.text))}</div></div></div>`;
      if(!it.resolved){ h+=`<div class="opts">
        <button class="opt" onclick="resolveItem(${idx},0)"><span class="ol">${T('Concedi')}</span><span class="oe">${T(b.e)}</span>${costoChip(b)}</button>
        <button class="opt" onclick="resolveItem(${idx},1)"><span class="ol">${T('Nega')}</span><span class="oe">${T('Nessun costo, nessun miglioramento')}</span></button></div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='arco'){
      /* gli archi narrativi (lotto 4 + payoff fase A): carta maggiore. Il marker discreto = titolo dell'arco +
         capitolo (a.scelte.length+1), nella riga .kick esistente. Testi via arcoSub (%FILO/%RUOLO/%ECO/%FIGLIO). */
      const A=ARCHI_DEF.find(x=>x.id===it.arco); const a=S.archi&&S.archi.find(x=>x.id===it.arco); const node=A&&A.nodi[it.nodo];
      if(node){
        const sub=(s)=>(typeof arcoSub==='function')?arcoSub(T(s),a):T(s);   // i18n: T() sul template PRIMA di arcoSub (i %FILO/%ECO sopravvivono)
        const cap=(a&&a.scelte?a.scelte.length:0)+1;
        const filoTit=T(A.titolo||'la storia');
        /* L11-1 — il VOLTO del filo (archetipo fisso del fuori-verbale): riga sobria sotto il titolo, solo se
           l'arco ha un `filo` con `arc` mappato. Senza archetipo la riga non compare (nessun degrado brutto). */
        const _rf=(a&&a.filo&&typeof ritrattoArc==='function')?ritrattoArc(a.filo):null;
        const filoRow=_rf?`<div class="filo-tag"><img src="${_rf}" alt=""><span><b>${a.filo.nome}</b> — ${T(a.filo.ruolo||'')}</span></div>`:'';
        h+=`<div class="ag major ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${filoTit} · ${T('cap.')} ${cap}</div><h3>${sub(node.t)}</h3>${filoRow}</div>
          <div class="atext">${sub(node.text)}</div>`;
        if(!it.resolved){ h+=`<div class="opts">`+node.ch.map((c,i)=>
          `<button class="opt" onclick="resolveItem(${idx},${i})"><span class="ol">${sub(c.l)}</span><span class="oe">${sub(c.e)}</span></button>`).join('')+`</div>`; }
        else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
        h+=`</div>`;
      }
    } else if(it.kind==='personale'){
      /* eventi personali singoli (lotto 5 + vita personale): registro sobrio. %FIGLIO/%CONIUGE = nomi reali della famiglia. */
      const d=it.data;
      const sub=(s)=>String(s==null?'':s).replace(/%FIGLIO/g, (typeof figlioNome==='function'?figlioNome(0,99):T('tuo figlio'))).replace(/%CONIUGE/g, ((S.famiglia&&S.famiglia.coniuge&&S.famiglia.coniuge.nome)||T('chi ti ama')));
      h+=`<div class="ag major ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${T(d.kick)}</div><h3>${sub(T(d.t))}</h3></div>
        <div class="atext">${sub(T(d.text))}</div>`;
      if(!it.resolved){ h+=`<div class="opts">`+d.ch.map((c,i)=>
        `<button class="opt" onclick="resolveItem(${idx},${i})"><span class="ol">${sub(T(c.l))}</span><span class="oe">${sub(T(c.e))}</span></button>`).join('')+`</div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='locale'){
      /* eventi locali (livello 1): la vita amministrativa di città/regione */
      const d=it.data;
      h+=`<div class="ag ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${T(d.kick)}</div><h3>${T(d.t)}</h3></div>
        <div class="atext">${T(d.text)}</div>`;
      if(!it.resolved){ h+=`<div class="opts">`+d.ch.map((c,i)=>
        `<button class="opt" onclick="resolveItem(${idx},${i})"><span class="ol">${T(c.l)}</span><span class="oe">${T(c.e)}</span>${costoChip(c)}</button>`).join('')+`</div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='premier'){
      /* la mossa interna (lotto ascesa): lealtà vs ambizione */
      const pn=(S.premier||{}).nome||'il premier';
      h+=`<div class="ag ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">Politica interna</div><h3>Il premier ${pn} chiede la tua linea</h3></div>
        <div class="atext">Sul tavolo c'è una scelta del governo. Puoi sostenere ${pn} o marcare la tua autonomia: la lealtà ti fa salire piano e sicuro, l'ambizione in fretta ma ti espone.</div>`;
      if(!it.resolved){ h+=`<div class="opts">
        <button class="opt" onclick="resolveItem(${idx},0)"><span class="ol">Assecondare il premier</span><span class="oe">Lealtà +, capitale + (ascesa lenta e sicura)</span></button>
        <button class="opt" onclick="resolveItem(${idx},1)"><span class="ol">Distinguersi</span><span class="oe">Capitale e visibilità +, ma la sua fiducia cala</span></button></div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='ministro'){
      /* le carte del ministro (lotto contenuto fase 1): politica interna di gabinetto + grane del tuo settore.
         Testo adattivo: %DIC = nome del dicastero, %PREMIER = nome del premier (subMin in game.js). */
      const d=it.data;
      const kick = (d.tipo==='grane') ? (typeof dicNome==='function'?dicNome():T('Il tuo dicastero')) : T('Politica interna');
      h+=`<div class="ag ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${kick}</div><h3>${subMin(T(d.t))}</h3></div>
        <div class="atext">${subMin(T(d.text))}</div>`;
      if(!it.resolved){ h+=`<div class="opts">`+d.ch.map((c,i)=>
        `<button class="opt" onclick="resolveItem(${idx},${i})"><span class="ol">${subMin(T(c.l))}</span><span class="oe">${subMin(T(c.e))}</span></button>`).join('')+`</div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='occasione'){
      /* la salita (lotto ascesa): cogliere il salto o lasciare. internazionale = l'ATTO FINALE 3→4 (fase C1a) */
      const pn=(S.premier||{}).nome||T('il premier'); const intl=(it.tipo==='internazionale'); const daDiplo=(S.livello===5);
      const txt={ successione:T('Il governo di %PM è caduto. I notabili del partito guardano a te per la successione: il vertice è a un passo.').replace('%PM',pn),
        candidatura:T('Il partito ti offre la candidatura alla guida: il tuo nome è ormai quello dell\'ambizione che ha fatto strada. È il momento.'),
        primaria:T('Si apre una primaria per la leadership. Puoi sfidare %PM: le correnti ti seguono, ma in primaria nulla è scontato.').replace('%PM',pn),
        altoRapp:T('Il tuo nome circola tra le cancellerie: ti offrono il grado di Sottosegretario generale delle Nazioni Unite, un passo dal vertice del mondo.'),
        internazionale:T(daDiplo?'Le Nazioni Unite ti chiamano: dopo una carriera tessuta nella diplomazia, il mondo ti vuole come arbitro tra le potenze. È l\'atto finale.':'Le Nazioni Unite ti chiamano: dopo gli anni al vertice del tuo paese, il mondo ti vuole come arbitro tra le potenze. È l\'atto finale.') }[it.tipo];
      const titolo=T({ successione:'La successione', candidatura:'La candidatura offerta', primaria:'La primaria', altoRapp:'La promozione', internazionale:'La chiamata del mondo' }[it.tipo]);
      h+=`<div class="ag major ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${T(intl?'L\'atto finale · oltre il vertice':'L\'occasione · la salita')}</div><h3>${titolo}</h3></div>
        <div class="atext">${txt}</div>`;
      if(!it.resolved){ h+=`<div class="opts">
        <button class="opt" style="border-color:var(--acc)" onclick="resolveItem(${idx},0)"><span class="ol">${T('Cogli il salto')}</span><span class="oe">${T(intl?'Diventi Segretario generale delle Nazioni Unite — la stessa carriera, oltre il vertice nazionale':it.tipo==='altoRapp'?'Diventi Sottosegretario generale delle Nazioni Unite — un passo dal vertice':it.tipo==='primaria'?'Sfidi: l\'esito dipende dal capitale e dalle correnti':'Diventi capo del governo — la stessa carriera, al vertice')}</span></button>
        <button class="opt" onclick="resolveItem(${idx},1)"><span class="ol">${daDiplo?T('Resti %R').replace('%R',T(typeof ruoloDiplo==='function'?ruoloDiplo():'Ambasciatore')):intl?T('Resti %R').replace('%R',T(PAESE.titoloRuolo)):T('Lascia, resta ministro')}</span><span class="oe">${T('Non è ancora il tuo momento')}</span></button></div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='crisiInt'){
      /* crisi di mediazione (fase C1a): trilemma. Il compromesso (gateAut) è mostrato BLOCCATO se l'autorevolezza non basta. */
      const d=it.data; const aut=(S.intl||{}).autorevolezza||0;
      h+=`<div class="ag major ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${T(d.kick)} · ${T('mediazione')}</div><h3>${T(d.t)}</h3></div>
        <div class="atext">${T(d.text)}</div>`;
      if(!it.resolved){ h+=`<div class="opts">`+d.ch.map((c,i)=>{
        const locked=c.gateAut!=null && aut<c.gateAut;
        return `<button class="opt" ${locked?'disabled':''} style="${c.gateAut!=null&&!locked?'border-color:var(--acc)':''}" onclick="resolveItem(${idx},${i})"><span class="ol">${T(c.l)}</span><span class="oe">${locked?(T('Serve autorevolezza ≥ %N').replace('%N',c.gateAut)):T(c.e)}</span>${locked?'':costoChip(c)}</button>`;
      }).join('')+`</div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='rinnovoInt'){
      /* fine mandato internazionale (fase C1a): rinnovo o ritiro all'apice */
      const I=S.intl||{};
      h+=`<div class="ag major ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">Fine del mandato</div><h3>Le Nazioni Unite decidono</h3></div>
        <div class="atext">Cinque anni al vertice del mondo volgono al termine. I membri sono pronti a riconfermarti: puoi continuare, o ritirarti all'apice di una carriera che ha toccato il cielo.</div>`;
      if(!it.resolved){ h+=`<div class="opts">
        <button class="opt" style="border-color:var(--acc)" onclick="resolveItem(${idx},0)"><span class="ol">Accetti un nuovo mandato</span><span class="oe">Continui a guidare le Nazioni Unite</span></button>
        <button class="opt" onclick="resolveItem(${idx},1)"><span class="ol">Ti ritiri all'apice</span><span class="oe">Lasci da protagonista: la parola passa alla storia</span></button></div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='inchiesta'){
      /* l'arco giudiziario (lotto 3): carta maggiore, registro d'agenzia, %PM = archetipo a nome generato */
      const FD=INCHIESTA_FASI[it.fase-1]; const pm=(S.inchiesta&&S.inchiesta.pm)||'il pubblico ministero';
      h+=`<div class="ag major ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${T(FD.kick)} · ${T('fase')} ${it.fase}/4</div><h3>${T(FD.t)}</h3></div>
        <div class="atext">${T(FD.text).replace(/%PM/g,'<b>'+pm+'</b>')}</div>`;
      if(!it.resolved){ h+=`<div class="opts">`+FD.difese.map((id,i)=>{
        const D=DIFESE_INCHIESTA[id]||{};
        return `<button class="opt" onclick="resolveItem(${idx},${i})"><span class="ol">${T(D.l)||id}</span><span class="oe">${T(D.e)||''}</span></button>`;
      }).join('')+`</div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='scandalo'){
      const m=getMin(it.min); const s=it.scn;
      const role=T(MINISTRIES.find(x=>x.id===it.min).nm);
      h+=`<div class="ag major ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${T('Scandalo')}</div>
        <h3>${T(s.t)}</h3></div>
        <div class="say">${avatar(m)}<div class="body"><div class="nm">${m?m.nm:''} ${chipOf(m)}<small> · ${role}</small></div>
          <div class="cap">${cap(T(s.text))}</div></div></div>`;
      if(!it.resolved){ h+=`<div class="opts">
        <button class="opt" onclick="resolveItem(${idx},0)"><span class="ol">${T('Difendi il ministro')}</span><span class="oe">${T('Lo tieni; lealtà su, ma consenso giù')}</span></button>
        <button class="opt" onclick="resolveItem(${idx},1)"><span class="ol">${T('Chiedi le dimissioni')}</span><span class="oe">${T('Lascia; gesto di pulizia, consenso su. Sostituto il mese prossimo')}</span></button></div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='conflitto'){
      const c=it.confl; const mA=getMin(it.minA), mB=getMin(it.minB);
      const roleA=T(MINISTRIES.find(x=>x.id===it.minA).nm), roleB=T(MINISTRIES.find(x=>x.id===it.minB).nm);
      h+=`<div class="ag ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${T('Scontro nel governo')}</div>
        <h3>${T(c.tema)}</h3></div>
        <div class="say">${avatar(mA)}<div class="body"><div class="nm">${mA?mA.nm:''} ${chipOf(mA)}<small> · ${roleA}</small></div>
          <div class="bubble">${cap(T(c.a.pos))}</div></div></div>
        <div class="say">${avatar(mB)}<div class="body"><div class="nm">${mB?mB.nm:''} ${chipOf(mB)}<small> · ${roleB}</small></div>
          <div class="bubble">${cap(T(c.b.pos))}</div></div></div>`;
      if(!it.resolved){ h+=`<div class="opts">
        <button class="opt" onclick="resolveItem(${idx},0)"><span class="ol">${T('Dai ragione a %M').replace('%M',mA?mA.nm:'—')}</span><span class="oe">${T(c.a.e)}</span>${costoChip(c.a)}</button>
        <button class="opt" onclick="resolveItem(${idx},1)"><span class="ol">${T('Dai ragione a %M').replace('%M',mB?mB.nm:'—')}</span><span class="oe">${T(c.b.e)}</span>${costoChip(c.b)}</button></div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='stampa'){
      const d=it.data;
      h+=`<div class="ag ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${T('Conferenza stampa')}</div>
        <h3>${d.t}</h3></div>
        <div class="atext" style="font-style:italic">«${d.text}»</div>`;
      if(!it.resolved){ h+=`<div class="opts">`+d.ch.map((c,i)=>`<button class="opt" onclick="resolveItem(${idx},${i})"><span class="ol">${T(c.l)}</span><span class="oe">${T(c.e)}</span></button>`).join('')+`</div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='puntopartito'){
      /* l'appuntamento con le correnti (lotto ribilanciamento) */
      const d=it.data;
      h+=`<div class="ag ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${T('Il punto col partito')}</div>
        <h3>${T(d.t)}</h3></div>
        <div class="atext">${T(d.text)}</div>`;
      if(!it.resolved){ h+=`<div class="opts">`+d.ch.map((c,i)=>`<button class="opt" onclick="resolveItem(${idx},${i})"><span class="ol">${T(c.l)}</span><span class="oe">${T(c.e)}</span></button>`).join('')+`</div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else if(it.kind==='intermedia'){
      const r=it.ris, col=r.win?'var(--pos)':'var(--neg)';
      h+=`<div class="ag ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick" style="color:${col}">${T(r.tipo)}</div>
        <h3>${T(r.win?'Avanzi nel territorio':'Battuta d\'arresto')}</h3></div>
        <div class="atext">${T('Il tuo blocco: <b>%N%</b> — al voto precedente avevi <b>%M%</b>:').replace('%N',Math.round(r.quota)).replace('%M',Math.round(r.attesa))} <b style="color:${col}">${r.margine>=0?'+':''}${r.margine}</b>.</div>
        <div style="padding:0 15px 8px"><div class="bar"><i style="width:${clamp(r.quota,2,100)}%;background:${col}"></i></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--mut2);margin-top:3px"><span>${T('il tuo blocco')}</span><span>${T('atteso')} ${Math.round(r.attesa)}%</span></div></div>
        ${(r.aree&&r.aree.length)?`<div class="atext" style="padding-top:2px">${r.aree.map(a=>`<span style="color:${a.tuo?'var(--pos)':'var(--neg)'}">●</span> <b>${nomeTerr(a)}</b> ${T(a.tuo?'passa al tuo blocco':"all'opposizione")} — ${T('nuovo')} ${caricaTerr(a)}: ${a.titolare}`).join('<br>')}</div>`:''}
        ${r.pe?`<div class="atext" style="padding-top:4px"><b>${T('Il Parlamento europeo.')}</b></div>
        <div style="padding:0 15px 10px">${r.pe.gruppi.map(g=>`<div style="padding:3px 0"><div style="display:flex;justify-content:space-between;font-size:12px"><span style="font-weight:${g.tuo?700:400}">${T(g.nome)}${g.tuo?' <span class="chip" style="background:var(--acc-bg);color:var(--acc-ink)">'+T('tuo')+'</span>':''}</span><span class="mono">${g.quota}%</span></div><div class="bar" style="height:5px"><i style="width:${clamp(g.quota,2,100)}%;background:${g.tuo?'var(--acc)':'var(--mut2)'}"></i></div></div>`).join('')}
          <div style="font-size:12px;color:var(--mut);margin-top:5px">${T('Il tuo gruppo')} (<b>${T((r.pe.gruppi.find(g=>g.tuo)||{}).nome||'')}</b>): <b>${r.pe.rank}º ${T('per peso')} · ${r.pe.quota}%</b></div></div>`:''}`;
      if(!it.resolved) h+=`<div class="opts"><button class="opt" onclick="resolveItem(${idx},0)"><span class="ol">${T('Avanti →')}</span></button></div>`;
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    } else {
      const d=it.data; const major=it.kind==='event';
      let kicker=T(d.kick);
      if(!major && d.min){ const mn=getMin(d.min); if(mn) kicker=T('Proposta')+' · '+mn.nm; }
      h+=`<div class="ag ${major?'major':''} ${it.resolved?'done':''}">${agScene(it)}<div class="ah"><div class="kick">${kicker}</div><h3>${T(d.t)}</h3></div>
        <div class="atext">${T(d.text)}</div>`;
      if(!it.resolved){ h+=`<div class="opts">`+d.ch.map((c,i)=>{
        const lockedRep=c.need!=null && (S.ind.reputazione==null || S.ind.reputazione<c.need);     // opzione da mediatore: a soglia di reputazione, mostrata onesta
        const lockedUE=c.pesoUE!=null && (S.pesoUE==null || S.pesoUE<c.pesoUE);                    // soglia gemella: peso del tuo gruppo a Bruxelles
        const cEnte=c.ente!=null?(typeof ENTI_INT!=='undefined'&&ENTI_INT.find(x=>x.id===c.ente)):null;   // soglia di STANDING con un ente (fase A)
        const lockedEnte=c.ente!=null && (!S.relInt || (S.relInt[c.ente]||0) < (c.enteMin!=null?c.enteMin:60));
        const locked=lockedRep||lockedUE||lockedEnte;
        return `<button class="opt" ${locked?'disabled':''} onclick="resolveItem(${idx},${i})"><span class="ol">${T(c.l)}</span><span class="oe">${lockedRep?(T('Serve reputazione ≥ %N').replace('%N',c.need)):lockedUE?(T('Serve peso a Bruxelles ≥ %N').replace('%N',c.pesoUE)):lockedEnte?(T('Serve rapporto con %E ≥ %N').replace('%E',((cEnte&&cEnte.breve)||c.ente)).replace('%N',(c.enteMin!=null?c.enteMin:60))):T(c.e)}</span>${locked?'':costoChip(c)}</button>`;
      }).join('')+`</div>`; }
      else h+=`<div class="outcome">${it.outcome}</div>${esitiHtml(it)}`;
      h+=`</div>`;
    }
  });
  h+=`</div>`;   // chiude .agbox
  // ministri (o, all'opposizione, l'avviso di sola lettura)
  if(S.opposizione){
    h+=`<div class="card"><div class="ct">${T('Il Governo')}</div><div class="min"><div class="msum">${T("Governa <b>%P</b>. Non hai ministri: sei all'opposizione. Tornerai a nominare il governo vincendo le elezioni.").replace('%P',T((part(S.governoAvversario)||{}).nome||'—'))}</div></div></div>`;
  } else if(S.livello!==4){   // Fetta 2: il Segretario (liv. 4) non ha ministri nazionali → niente card-ministeri vuota
  /* L56-1 · LA PREROGATIVA: chiedere lo scioglimento. Compare solo quando è davvero una scelta — al governo,
     passati 18 mesi dal voto, e col mandato non agli sgoccioli. Mostra quel che il giocatore vedrebbe davvero:
     il sondaggio col suo margine (che mente già, per costruzione) e i mesi che restano. Non mostra il risultato. */
  if(typeof scioglimentoAmmesso==='function' && scioglimentoAmmesso()){
    const q=scioglimentoQuadro();
    const riga = (q.sond!=null)
      ? T('Ultimo sondaggio: <b>%V%</b> (± %M)').replace('%V',q.sond).replace('%M',q.margine)
      : T('Nessun sondaggio recente: andresti al buio.');
    /* L59-4(a) — la proiezione in SEGGI accanto al sondaggio: il sondaggio è una quota di voti, e nei paesi a
       collegi non dice da solo come finisce. Mostrata sempre, anche (soprattutto) quando è brutta. */
    /* ⚠ E la frase cambia dove si ritratta la maggioranza. Misurato: la proiezione azzecca l'esito nel 91%
       dei casi nel Regno Unito (partito solo) ma solo nel 35% nell'Italia del '70 — perché lì, dopo il voto,
       la coalizione si RIFORMA: il blocco che conta non è quello di oggi. Promettere «ti basterebbero per
       governare» sarebbe esattamente l'inganno che questa voce esiste per togliere. Quindi nei paesi a
       coalizione la carta dice il dato e si ferma lì, e ricorda che la maggioranza andrà ricostruita. */
    const coalPaese = !!(PAESE && PAESE.coalizione);
    const rigaSeggi = (q.seggi==null) ? '' : (coalPaese
      ? `<div class="mtext" style="padding-bottom:6px">${T('Con queste forze la tua maggioranza di oggi avrebbe <b>%S</b> seggi su 100.').replace('%S',q.seggi)} <span style="color:var(--mut2)">${T('Dopo il voto la maggioranza va ricostruita, e i numeri cambiano.')}</span></div>`
      : `<div class="mtext" style="padding-bottom:6px">${T('Con queste forze i seggi sarebbero <b>%S</b> su 100: %E.').replace('%S',q.seggi).replace('%E',T(q.magg?'ti basterebbero per governare':'non ti basterebbero'))} <span style="color:var(--mut2)">${T('La campagna li muove di qualche punto.')}</span></div>`);
    h+=`<div class="card"><div class="ct">${T('La prerogativa')}</div>
      <div class="mtext" style="padding-bottom:6px">${riga} · ${T('mancano <b>%N</b> mesi alla scadenza naturale.').replace('%N',q.mesiRestanti)}</div>${rigaSeggi}
      <button class="opt" onclick="if(confirm('${T('Chiedere lo scioglimento e andare al voto in anticipo?')}')) azioneScioglimento()">
        <span class="ol">${T('Chiedi lo scioglimento')}</span>
        <span class="oe">${T('Si vota adesso, e la scelta è tua · la stampa parla di opportunismo e gli alleati mormorano')}</span></button></div>`;
  }
  h+=`<div class="card g2"><div class="ct">I tuoi ministeri <small style="color:var(--mut2);font-weight:400">· tocca "Apri" per gestirli</small></div>`;
  for(const m of S.ministers) h+=renderMinistroCard(m,'lista');
  h+=`</div>`;
  }
  document.getElementById('sec-gov').innerHTML=h;
}

/* --- Scheda PAESE ("Stato del paese") — fusione di Indicatori + Consenso (2026-06-11), niente perso:
   strip saldo/debito → Economia (con reputazione e stampa in coda, come da ordine di Giacomo) →
   Servizi → Consenso coi 6 gruppi → Cronaca → Come funziona. --- */
function renderPaese(){
  const I=S.ind; const def=computeDeficit(); const cic=S.ciclo||0;
  const balText=def<=0?T('Avanzo')+' '+fmt(-def,1)+'%':T('Deficit')+' '+fmt(def,1)+'%';
  if(S.livello===1){   // da politico locale: la scheda "Paese" mostra la TUA città/regione, non la nazione
    let hl=`<div class="contorno" style="font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin:2px 2px 8px;">${escAttr(entitaLocale())}</div>`;
    hl+=`<div class="card"><div class="ct">${escAttr(S.locale.nome)} · ${T('i tuoi indicatori')}</div>${renderLocaleInd()}</div>`;
    hl+=`<div class="card"><div class="ct">${T('Come funziona')}</div><div class="log"><div class="li">${T('Sei %RUOLO: queste sono le sorti %DL. Le muovi dalle <b>leve</b> (scheda Bilancio) e dalle decisioni del mese. Buoni indicatori = consenso e <b>notorietà</b>, la credenziale per salire a Roma.').replace('%RUOLO',escAttr(ruoloLocale())).replace('%DL',diLuogo(S.locale.nome))}</div></div></div>`;
    document.getElementById('sec-paese').innerHTML=hl;
    return;
  }
  if(S.livello===4||S.livello===5){   // SEGRETARIO (liv 4) e DIPLOMATICO (liv 5, C2): la scheda «Paese» è LO STATO DEL MONDO, non il cruscotto nazionale (muto)
    const ri=S.relInt||{}; const cap=function(s){return s.charAt(0).toUpperCase()+s.slice(1);};
    let hw=`<div class="contorno" style="font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin:2px 2px 8px;">${T('Lo stato del mondo')}</div>`;
    hw+=(S.livello===5)
      ? `<div class="banner">${T('<b>I rapporti che costruisci.</b> Da %RUOLO non guidi un paese: tessi le relazioni, missione dopo missione (scheda <b>Governo</b>). Porta il <b>rapporto con %ENTE</b> a 75 e il vertice del mondo ti chiamerà.').replace('%RUOLO', T(typeof ruoloDiplo==='function'?ruoloDiplo():'Ambasciatore')).replace('%ENTE', T(typeof consessoNome==='function'?consessoNome():'le Nazioni Unite'))}</div>`
      : `<div class="banner">${T('<b>Il tabellone che arbitri.</b> Da %RUOLO non guidi un paese: tieni insieme i blocchi. Le tue mediazioni (scheda <b>Governo</b>) plasmano questi rapporti — e lo stato in cui lasci il mondo pesa sul tuo lascito.').replace('%RUOLO', T(typeof ruoloIntl==='function'?ruoloIntl():'Segretario Generale'))}</div>`;
    /* la LETTURA del mondo: una riga in parole sull'asse Occidente–rivale (il triangolo, visto dall'alto) */
    const al=ri.alleanza, rv=ri.rivale;
    if(al!=null && rv!=null){ const gap=al-rv;
      const lett = gap>=24?T('Il mondo pende a Occidente: stringi con l\'Alleanza, freddo con il rivale.')
        : gap<=-24?T('Hai riaperto con la potenza rivale: gli alleati ti guardano con sospetto.')
        : Math.abs(gap)<=10?T('Tieni un equilibrio fragile tra i blocchi: nessuno dei due prevale.')
        : (gap>0?T('Pendi lievemente verso l\'Alleanza, senza rompere col rivale.'):T('Pendi lievemente verso il rivale, senza rompere con l\'Alleanza.'));
      hw+=`<div class="card" style="border-left:3px solid var(--acc)"><div class="log"><div class="li">${lett}</div></div></div>`; }
    /* il TABELLONE: i blocchi che arbitri. NON 'consesso' (a livello 4 sei TU, già misurato dalla coesione in Governo) */
    if(typeof ENTI_INT!=='undefined' && Object.keys(ri).length){
      hw+=`<div class="card"><div class="ct">${T('Rapporti tra i blocchi')}</div>`;
      ENTI_INT.forEach(function(E){ if(E.societa || (S.livello===4 && E.id==='consesso') || ri[E.id]==null) return; const v=ri[E.id];   // a liv 4 il Consesso sei TU (nascosto); a liv 5 è il tuo OBIETTIVO (mostrato)
        const _nm=(E.id==='consesso'&&typeof consessoNome==='function')?consessoNome():(naLabel()&&E.nomeNA?E.nomeNA:E.nome);   // D4: nodo era-aware
        hw+=indRow(cap(T(_nm)), T(naLabel()&&E.descNA?E.descNA:E.desc), fmt(v,0), v); });
      const soc=ENTI_INT.filter(function(E){return E.societa && ri[E.id]!=null;});
      if(soc.length){
        hw+=`<div class="contorno" style="letter-spacing:.12em;text-transform:uppercase;color:var(--mut2);border-top:1px solid var(--line);margin-top:8px;padding-top:9px">${T('Società civile')}</div>`;
        soc.forEach(function(E){ const v=ri[E.id]; hw+=indRow(cap(T(E.nome)), E.desc, fmt(v,0), v); });
      }
      hw+=`</div>`;
    }
    hw+=(S.livello===5)
      ? `<div class="card"><div class="ct">${T('Come funziona')}</div><div class="log"><div class="li">${T('Le tue <b>missioni</b> (scheda Governo) muovono questi rapporti, e a questo livello lo standing <b>persiste</b>. Porta il <b>rapporto con %ENTE</b> a 75 e arriverà la chiamata al vertice; il <b>credito diplomatico</b> ti promuove prima al grado intermedio.').replace('%ENTE', T(typeof consessoNome==='function'?consessoNome():'le Nazioni Unite'))}</div></div></div>`
      : `<div class="card"><div class="ct">${T('Come funziona')}</div><div class="log"><div class="li">${T("Le <b>crisi di mediazione</b> (scheda Governo) muovono questi rapporti, e a questo livello le tue scelte <b>persistono</b>: il mondo non torna com'era. <b>Coesione</b> e <b>autorevolezza</b> decidono il tuo mandato; questo tabellone è il mondo che reagisce — e che racconterà il tuo lascito.")}</div></div></div>`;
    document.getElementById('sec-paese').innerHTML=hw;
    return;
  }
  let h=`<div class="contorno" style="font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin:2px 2px 8px;">${T('Stato del paese')}</div>`;
  if(S.livello===2) h+=`<div class="banner">${T('<b>Governa %PM.</b> Vedi gli indicatori nazionali, ma non li guidi: la politica generale è del premier. Tu incidi dal <b>tuo dicastero</b>.').replace('%PM', escAttr((S.premier||{}).nome||T('il premier')))}</div>`;
  h+=`<div class="budget">
    <div class="b"><div class="l">${T('Saldo di bilancio')}</div><div class="v" style="color:${def<=3?'var(--pos)':def<=4?'var(--warn)':'var(--neg)'}">${balText}</div></div>
    <div class="b"><div class="l">${T('Debito / PIL')}</div><div class="v" style="color:${I.debt<130?'var(--pos)':I.debt<150?'var(--warn)':'var(--neg)'}">${fmt(I.debt,0)}%</div></div></div>`;
  /* BILANCIO DELLO STATO (cantiere Budget): le cifre 2024 riconciliate rese in € — PIL, debito e saldo annuo derivati dal PIL per-paese. */
  if(S.pil){ var _q=(S.quotaSpesa!=null?S.quotaSpesa:0.48), pilMln=S.pil*1000, spesaMln=S.pil*_q*1000, debMln=S.pil*I.debt*10, salMln=S.pil*Math.abs(def)*10, disav=(def>0);
    h+=`<div class="card"><div class="ct">${T('Bilancio dello Stato')}</div>
      <div class="ind"><div class="nm"><b>${T('Spesa pubblica')}</b><small>${T('il bilancio annuo che il governo gestisce')}</small></div><div class="num">${euro(spesaMln)}</div></div>
      <div class="ind"><div class="nm"><b>${T('PIL nominale')}</b><small>${T('la ricchezza prodotta in un anno')}</small></div><div class="num">${euro(pilMln)}</div></div>
      <div class="ind"><div class="nm"><b>${T('Debito pubblico')}</b><small>${fmt(I.debt,0)}% ${T('del PIL')}</small></div><div class="num">${euro(debMln)}</div></div>
      <div class="ind"><div class="nm"><b>${T('Saldo annuo')}</b><small>${T(disav?'disavanzo':'avanzo')} ${fmt(Math.abs(def),1)}% ${T('del PIL')}</small></div><div class="num" style="color:${!disav?'var(--pos)':def<=3?'var(--warn-ink)':'var(--neg)'}">${disav?'−':'+'}${euro(salMln)}</div></div></div>`;
  }
  h+=`<div class="card"><div class="ct">${T('Economia')}</div>
    ${indRow('Crescita del PIL','variazione annua',sign(I.growth,1)+'%',(I.growth+6)/11*100,'crescita')}
    ${indRow('Congiuntura', cic>0.15?'vento a favore: l\'economia spinge da sola' : cic<-0.15?'vento contrario: l\'economia frena da sola' : 'fase stabile', T(cic>0.15?'Favorevole':cic<-0.15?'Avversa':'Stabile'), (cic+1)/2*100, null, 'congiuntura')}
    ${indRow('Disoccupazione','tasso',fmt(I.unemp,1)+'%',(20-I.unemp)/17*100)}
    ${indRow('Deficit','% del PIL',fmt(def,1)+'%',(8-Math.max(def,0))/8*100)}
    ${indRow('Fiducia dei mercati','alta = interessi a bada; bassa = spread che morde',fmt(I.fiducia,0),I.fiducia,'mercati')}
    ${I.reputazione!=null?indRow('Reputazione internazionale','alta = traino al commercio e opzioni da mediatore; bassa = porte chiuse',fmt(I.reputazione,0),I.reputazione,'reputazione'):''}
    ${(!S.opposizione && I.stampa!=null)?indRow('Rapporto con la stampa','alta = i media ti coprono; bassa = ogni passo falso costa caro',fmt(I.stampa,0),I.stampa,'stampa'):''}</div>`;
  /* RELAZIONI INTERNAZIONALI (lotto internazionale fase A): lo standing per-ente, accanto alla reputazione (lettura
     aggregata). Alto = sostegno e occasioni; basso = pressione e porte chiuse. Il TRIANGOLO si vede qui. */
  if(S.relInt && typeof ENTI_INT!=='undefined' && Object.keys(S.relInt).length){
    const cap=function(s){return s.charAt(0).toUpperCase()+s.slice(1);};
    h+=`<div class="card"><div class="ct">${T('Relazioni internazionali')}</div>`;
    ENTI_INT.forEach(function(E){ if(E.societa || S.relInt[E.id]==null) return; const v=S.relInt[E.id];   // prima gli enti GEOPOLITICI
      const _nm=(E.id==='consesso'&&typeof consessoNome==='function')?consessoNome():(naLabel()&&E.nomeNA?E.nomeNA:E.nome);   // D4: nodo era-aware
      h+=indRow(cap(T(_nm)), naLabel()&&E.descNA?E.descNA:E.desc, fmt(v,0), v); });   // sedia-swing: etichette "i due poli" per i non allineati (liv. nazionale)
    /* la SOCIETÀ CIVILE è un attore di natura diversa (fase B): sotto-titolo + separatore, non «un'altra potenza» */
    const soc=ENTI_INT.filter(function(E){return E.societa && S.relInt[E.id]!=null;});
    if(soc.length){
      h+=`<div class="contorno" style="letter-spacing:.12em;text-transform:uppercase;color:var(--mut2);border-top:1px solid var(--line);margin-top:8px;padding-top:9px">${T('Società civile')}</div>`;
      soc.forEach(function(E){ const v=S.relInt[E.id]; h+=indRow(cap(T(E.nome)), E.desc, fmt(v,0), v); });
    }
    h+=`</div>`;
  }
  h+=`<div class="card"><div class="ct">${T('Servizi')}</div>
    ${indRow('Sanità','qualità del servizio',fmt(I.sanita,0),I.sanita,'sanita')}
    ${indRow('Sicurezza','ordine pubblico',fmt(I.sicurezza,0),I.sicurezza,'sicurezza')}
    ${indRow('Ambiente','transizione ecologica',fmt(I.ambiente,0),I.ambiente,'ambiente')}</div>`;
  h+=rivoltaBanner();   // L72-1: il conto alla rovescia in testa, se un gruppo e' sotto il pavimento
  h+=`<div class="card"><div class="ct">${T('Consenso complessivo')} · ${fmt(S.ind.consenso,0)}%</div>`;
  for(const gr of GROUPS){const v=S.groups[gr.id];
    h+=`<div class="grp"><div class="top"><div class="nm">${icon(gr.id,T(gr.nm))} ${T(gr.nm)}<small>${T('peso')} ${gr.w}%</small></div>
      <div class="pc" style="color:${barColor(v)}">${fmt(v,0)}%</div></div>
      <div class="bar"><i style="width:${clamp(v,2,100)}%;background:${barColor(v)}"></i>${pavTick(gr.id)}</div>${rivoltaHtml(gr.id)}</div>`;}
  h+=`</div>`;
  const fioreL = PROMO_FIORE ? ' promo-fiore' : ''; if(PROMO_FIORE) PROMO_FIORE=false;   // premier/ministro (niente banner): il fioretto va sulla prima riga = l'annuncio della promozione
  h+=`<div class="card"><div class="ct">${T('Cronaca di governo')}</div><div class="log">
    ${S.log.slice(0,7).map((e,i)=>`<div class="li${i===0?fioreL:''}"><b>${e.t}.</b> ${e.x}</div>`).join('')}</div></div>`;
  h+=`<div class="card"><div class="ct">${T('Come funziona')}</div><div class="log">
    <div class="li">${T("Il consenso è la media dei gruppi, pesata per il loro peso elettorale. L'umore dei gruppi muove le <b>forze dei partiti</b>, che al voto decidono le elezioni (seggi o testa a testa, secondo il paese). Sotto il <b>%N%</b> rischi la crisi di governo. I ministri leali rendono più efficaci le tue politiche.").replace('%N',dif().sogliaCrisi)}</div></div></div>`;
  document.getElementById('sec-paese').innerHTML=h;
}
function indRow(nm,sub,num,pct,ic,gk){pct=clamp(pct,2,100);
  return `<div class="ind"><div class="nm"><b>${ic?icon(ic,T(nm))+' ':''}${gk?gergo(T(nm),gk):T(nm)}</b><small>${T(sub)}</small>
    <div class="bar">${fillI('ind:'+nm, pct, barColor(pct))}</div></div><div class="num">${num}</div></div>`;}

/* (la vecchia scheda Consenso è fusa in renderPaese — 2026-06-11) */

/* --- Componente RIUSABILE: una legge (stato, asse leggibile, costo RP, anteprima reazioni, bottone).
   Autosufficiente: pronto a traslocare nelle pagine-ministero del prossimo cantiere. --- */
function asseLabel(a){ return a>=1?'Piace a destra' : a<=-1?'Piace a sinistra' : 'Piace al centro'; }
function leggeRischio(L){   // alleati che perderebbero (rischio) o guadagnerebbero (graditi) tenuta con l'AZIONE corrente
  const inVigore=!!S.leggi[L.id], seg=inVigore?-1:1, rischio=[], graditi=[];
  for(const id of (S.coalizione||[])){ if(id===S.partito) continue;
    const d=seg*6*(1-Math.abs(part(id).asse-L.asse));
    if(d<-0.01) rischio.push(T(part(id).nome)); else if(d>0.01) graditi.push(T(part(id).nome));
  }
  return {rischio, graditi};
}
function renderLegge(L){
  const inVigore=!!S.leggi[L.id], oppo=S.opposizione;
  S.leggi[L.id]=!inVigore; const cost=rpUsed(); S.leggi[L.id]=inVigore;   // costo RP del toggle (per disabilitare il bottone)
  const troppo=cost>curRpMax(), r=leggeRischio(L);
  const badge=inVigore?`<span class="chip" style="background:var(--pos-bg);color:var(--pos)">${T('In vigore')}</span>`:`<span class="chip" style="background:var(--line2);color:var(--mut)">${T('Non in vigore')}</span>`;
  const meta=`${asseLabel(L.asse)} · ${L.costo} RP`
    + (!oppo&&r.rischio.length?` · <span style="color:var(--neg)">rischio: ${r.rischio.join(', ')}</span>`:'')
    + (!oppo&&r.graditi.length?` · <span style="color:var(--pos)">gradita a: ${r.graditi.join(', ')}</span>`:'');
  return `<div style="padding:11px 14px;border-top:1px solid var(--line)">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><div style="font-weight:600;font-size:14px">${T(L.nome)}</div>${badge}</div>
    <div style="color:var(--mut2);font-size:12.5px;margin:3px 0 5px">${T(L.desc)}</div>
    <div style="font-size:12px;color:var(--mut)${oppo?'':';margin-bottom:7px'}">${meta}</div>
    ${oppo?'':`<button class="opt" ${troppo?'disabled':''} style="${troppo?'opacity:.5;':''}" onclick="setLegge('${L.id}')"><span class="ol">${T(inVigore?'Abroga':'Approva')}${troppo?T(' — RP insufficienti'):' · '+L.costo+' RP'}</span></button>`}
  </div>`;
}

/* --- Scheda BILANCIO --- */
/* Riga RP+saldo col mese intessuto, in testata STICKY (resta visibile sotto l'header mentre scorri).
   UN SOLO componente per Bilancio e pagine-ministero: stessa riga, stesso comportamento ovunque si
   cambino politiche/leggi. Sempre aggiornata gratis: setPol/setLegge chiamano render(). */
/* L68-2 — questa testata e tutta la scheda Bilancio erano scritte CRUDE, senza `T()`: in una partita in
   inglese comparivano in italiano. La guardia i18n non poteva vederlo (vede gli orfani, non le chiavi
   mancanti) e lo scan `T(x)===x` l'abbiamo sempre fatto sulle stringhe che il lotto AGGIUNGEVA, mai su
   quelle che c'erano gia. Le ha trovate il cammino in EN fino al primo mese. */
function budgetRow(){
  const def=computeDeficit();
  return `<div class="sticky-top"><div class="budget"><div class="b"><div class="l">${gergo(T('Punti riforma'),'puntiRiforma')} · ${T(MONTHS[S.month-1])} — ${T(S.month===1?'manovra':'decreti')}</div><div class="v">${rpLeft()} / ${curRpMax()}</div></div>
    <div class="b"><div class="l">${T('Saldo previsto')}</div><div class="v" style="color:${def<=3?'var(--pos)':def<=4?'var(--warn)':'var(--neg)'}">${T(def<=0?'Avanzo':'Deficit')} ${fmt(Math.abs(def),1)}%</div></div></div></div>`;
}
function renderPol(){
  if(S.opposizione){
    let h=`<div class="banner" style="border-color:var(--neg)">${T("<b>Governa %P.</b> All'opposizione non vari il bilancio: le politiche le decide il governo in carica. Ne vedi gli effetti nella scheda <b>Paese</b>, e la tua risalita in <b>Partiti</b>.").replace('%P',T((part(S.governoAvversario)||{}).nome||'—'))}</div>`;
    h+=`<div class="card g2"><div class="ct">${T('Leggi in vigore')}</div>${leggiDelPaese().map(renderLegge).join('')}</div>`;
    document.getElementById('sec-pol').innerHTML=h;
    return;
  }
  if(S.livello===1){
    /* da politico locale: il bilancio è quello della tua città/regione (le leve locali) */
    let h=`<div class="banner">${T('<b>Bilancio %L.</b> Imposta le tue leve: più servizi migliorano gli indicatori ma costano al bilancio; i tributi lo rimpinguano ma pesano sul consenso.').replace('%L',diLuogo(S.locale.nome))}</div>`;
    h+=`<div class="card"><div class="ct">${T('Le tue leve')}</div>${renderLocaleLeve()}</div>`;
    h+=`<div class="card"><div class="ct">${T(S.locale.tipo==='città'?'Stato della città':'Stato della regione')}</div>${renderLocaleInd()}</div>`;
    document.getElementById('sec-pol').innerHTML=h;
    return;
  }
  if(S.livello===2){
    /* da ministro controlli solo il TUO settore: il resto del bilancio è del premier (in lettura) */
    const Mn=(typeof dicNm==='function'?dicNm(S.dicastero):((MINISTRIES.find(x=>x.id===S.dicastero)||{}).nm||''));   // D3: nome era-aware
    let h=budgetRow();
    h+=`<div class="banner">${T('<b>Bilancio del tuo dicastero.</b> Governa il paese %P: il bilancio nazionale è suo. Tu vari le politiche e le leggi di <b>%M</b> (i tuoi punti riforma).').replace('%P',escAttr((S.premier||{}).nome||T('il premier'))).replace('%M',T(Mn))}</div>`;
    const pols=POLICIES.filter(p=>p.min===S.dicastero);
    if(pols.length) h+=`<div class="card"><div class="ct">${T('Politiche di %M').replace('%M',T(Mn))}</div>${pols.map(renderPolicySlider).join('')}</div>`;
    const laws=leggiDelPaese().filter(L=>L.min===S.dicastero);
    if(laws.length) h+=`<div class="card g2"><div class="ct">${T('Leggi di %M').replace('%M',T(Mn))}</div>${laws.map(renderLegge).join('')}</div>`;
    document.getElementById('sec-pol').innerHTML=h;
    return;
  }
  let h=budgetRow();
  h+= S.month===1
    ? `<div class="banner">${T((!S.opposizione&&(S.potereLocale||0)>50)
        ? '<b>Gennaio — legge di bilancio.</b> Manovra: <b>+3 punti</b> <b>+1</b> dal territorio — in cassa ne hai <b>%N</b>. Imposta l\'anno.'
        : '<b>Gennaio — legge di bilancio.</b> Manovra: <b>+3 punti</b> — in cassa ne hai <b>%N</b>. Imposta l\'anno.').replace('%N',curRpMax())}</div>`
    : `<div class="banner">${T('<b>%M — decreti.</b> <b>+1 punto al mese</b>, fino a <b>3 in cassa</b>: risparmiando puoi varare una riforma grossa anche fuori manovra.').replace('%M',T(MONTHS[S.month-1]))}</div>`;
  /* Loop attivo Lotto 3: la scheda dice SUBITO quale politica è sotto pressione e la mossa — così non cerchi tra i cursori */
  const _spP=(typeof politicaSottoPressione==='function')?politicaSottoPressione():null;
  if(_spP){ const P=POLICIES.find(function(x){return x.id===_spP.pol;})||{}; const pnm=(typeof naLabel==='function'&&naLabel()&&P.nmNA)?P.nmNA:P.nm;
    h+=`<div class="banner" style="border-color:var(--acc)"><b>${T(_spP.kick)}.</b> ${T('%POL sotto pressione. Rivedi la politica (l\'anello indica dove porta) o tienila — entrambe le strade sono legittime.').replace('%POL','<b>'+T(pnm||'')+'</b>')}</div>`; }
  h+=politicheTotRiga();   // il conto complessivo delle politiche, ogni anno (cantiere Budget): il totale del ricorrente in cima alla manovra
  const polVis=(typeof eraVivaT==='function')?POLICIES.filter(eraVivaT):POLICIES;   // Build B (ii): le leve moderne (ambiente/immigrazione) sono nascoste nel '50 (restano neutre → math invariata); nel presente passano tutte
  const cats=[...new Set(polVis.map(p=>p.cat))];
  for(const cat of cats){
    h+=`<div class="card"><div class="ct">${T(cat)}</div>`;
    for(const p of polVis.filter(x=>x.cat===cat)) h+=renderPolicySlider(p);   // stesso componente delle pagine-ministero
    h+=`</div>`;
  }
  h+=`<div class="card g2"><div class="ct">${T('Leggi del paese')}</div>${leggiDelPaese().map(renderLegge).join('')}</div>`;   // leggi: riforme on/off, costano RP come il bilancio
  document.getElementById('sec-pol').innerHTML=h;
}
function setPol(id,i){
  if(S.livello===2 && (POLICIES.find(p=>p.id===id)||{}).min!==S.dicastero) return;   // da ministro: solo le leve del TUO dicastero
  const old=S.pol[id]; S.pol[id]=i;
  if(rpUsed()>curRpMax()){S.pol[id]=old; return;}
  S.ind.deficit=computeDeficit(); render();
}

/* ===== MAPPA DEL TERRITORIO — drill-down da Partiti (pattern pagine-ministero, 5 tab intatte).
   Colore = controllo (oro tuo blocco / grigio avversario), intensità = radicamento (|lean|),
   bordo blu = area simbolo. Le città sono cerchietti SOPRA le regioni. Tocco → pannello info.
   Se PAESE.mappa manca, la scheda Partiti tiene la lista testuale (degrado con grazia). ===== */
let MAPSEL=null;   // area selezionata (transitoria, mai in S)
function apriMappa(){ S.mappaAperta=true; MAPSEL=null; if(S.visite) S.visite.mappa=(S.visite.mappa||0)+1; render(); }   // L64-2: la visita si conta (misura del cantiere)
function chiudiMappa(){ S.mappaAperta=null; render(); }
function selArea(i){ MAPSEL=(MAPSEL===i)?null:i; render(); }
function leanLabel(l){ return T(l<=-2?'storicamente di sinistra':l===-1?'tende a sinistra':l===0?'contendibile':l===1?'tende a destra':'storicamente di destra'); }
function renderMappaSVG(){
  const M=PAESE.mappa, TE=PAESE.territori, asseTuo=part(S.partito).asse;
  let h=`<svg viewBox="${M.viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${T('Mappa del controllo politico')}">`;
  h+=`<path d="${M.sfondo}" fill="var(--bg2)" stroke="var(--line2)" stroke-width="0.7"/>`;
  const idx=TE.map((_,i)=>i).sort((a,b)=>((M.aree[a]&&M.aree[a].d?0:1)-(M.aree[b]&&M.aree[b].d?0:1))||(a-b));   // prima le regioni, poi le città sopra
  const chiamaIdx=(S.territorioChiama&&typeof S.territorioChiama.idx==='number')?S.territorioChiama.idx:null;   // F2
  for(const i of idx){
    const A=M.aree[i]; if(!A) continue;
    const t=S.territori[i]||{}, tuo=compatibile(t.partito,asseTuo), L=Math.abs(TE[i].lean);
    const op=L>=2?0.95:L===1?0.72:0.5;
    const sel=MAPSEL===i, chiama=(chiamaIdx===i);   // F2 — l'area che chiama pulsa (E5: alla comparsa, poi ferma)
    const lav=!!(t.spinta);   // L64-2: area lavorata in campagna
    const stroke=chiama?'var(--acc-ink)':((sel||TE[i].simbolo||lav)?'var(--brand)':'var(--panel)');
    const sw=chiama?2.4:(sel?2:(lav?1.8:(TE[i].simbolo?1.1:0.6)));
    const cls=chiama?` class="mappa-chiama${(typeof lastTerrPulse!=='undefined'&&lastTerrPulse)?'':' pulse'}"`:'';   // pulse SOLO alla comparsa (E5), poi fermo
    const common=`data-anim="fill:area:${i}" data-to="${tuo?1:0}" fill="${tuo?'var(--acc)':'var(--mut2)'}" fill-opacity="${op}" stroke="${stroke}" stroke-width="${sw}"${cls} onclick="selArea(${i})"`;
    h+= A.d ? `<path d="${A.d}" ${common}/>` : `<circle cx="${A.cx}" cy="${A.cy}" r="${A.r}" ${common}/>`;
  }
  if(chiamaIdx!=null) lastTerrPulse=1; else lastTerrPulse=null;   // E5: fotografa il pulse mostrato → alla prossima resa è fermo; reset quando l'invito finisce (il prossimo pulserà)
  return h+`</svg>`;
}
function renderMappaInfo(){
  if(MAPSEL==null) return `<div style="padding:4px 14px 12px;font-size:12px;color:var(--mut2)">${T("Tocca un'area per i dettagli.")}</div>`;
  const TE=PAESE.territori[MAPSEL], t=S.territori[MAPSEL]||{}, tuo=compatibile(t.partito, part(S.partito).asse);
  const pn=(part(t.partito)||{}).nome||'—';
  /* F2 — se l'area selezionata è quella che CHIAMA, la mini-scheda con la scelta prende il posto dell'info piatta.
     Map-native: la decisione vive qui (S.territorioChiama, dato puro), non come carta-agenda. */
  const chiama=(S.territorioChiama && S.territorioChiama.idx===MAPSEL);
  const def=chiama?(typeof defProblemaTerr==='function'?defProblemaTerr(S.territorioChiama.prob):null):null;
  /* L64-2 — in campagna, il pannello dell'area diventa il posto dove si decide: costo, ritorno, «Investi qui». */
  const camp=(typeof inCampagna==='function' && inCampagna());
  const investi=camp?(function(){ const sf=campSforzo(), c=costoInvestimento(MAPSEL), r=ritornoInvestimento(MAPSEL), tipo=tipoTerritorio(MAPSEL), qui=(S.campNaz&&S.campNaz.speso&&S.campNaz.speso[MAPSEL])||0;
      const nota=T(tipo==='roccaforte'?'roccaforte: rende poco, ci voti già':tipo==='bilico'?'in bilico: rende molto, se arrivi in tempo':'terreno avversario: costa il doppio, paga in prestigio anche se perdi')+(((S.potereLocale||0)>=60)?' · '+T('il potere locale abbassa il costo'):'');
      return `<div class="camp-area" style="margin:2px 14px 10px;padding:10px 12px;border:1px solid var(--brand);border-radius:11px;background:var(--brand-bg)">
        <div style="font-size:12px;color:var(--txt2);margin-bottom:6px">${nota}${qui?' · '+T('già investito: %C').replace('%C',qui):''}</div>
        <button class="opt" ${sf>=c?'':'disabled style="opacity:.5"'} onclick="investiTerritorio(${MAPSEL})"><span class="ol">${T('Investi qui')}</span><span class="oe">${T('costo %C · spinta +%S').replace('%C',c).replace('%S',r)} · ${sf} ${T('punti')}</span></button></div>`; })():'';
  const scheda=(chiama&&def)?`<div class="terr-call" style="margin:2px 14px 10px;padding:10px 12px;border:1px solid var(--acc);border-radius:11px;background:var(--acc-bg)">
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--acc-ink);font-weight:700">${T('Il territorio ti chiama')}</div>
      <div style="font-weight:600;font-size:14px;margin:4px 0 2px">${arcoTerrSub(T(def.t),TE)}</div>
      <div style="font-size:12.5px;color:var(--txt2);margin-bottom:8px">${arcoTerrSub(T(def.text),TE)}</div>
      <div class="choices" style="display:flex;flex-direction:column;gap:7px">`+
      def.ch.map(function(c,i){ return `<button class="opt" onclick="resolveTerritorio(${i})"><span class="ol">${T(c.l)}</span><span class="oe">${T(c.e)}</span></button>`; }).join('')+
      `</div></div>`:'';
  return `<div style="padding:2px 14px 12px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><b style="font-size:14.5px">${cap(nomeTerr(TE))}</b><span class="chip" style="background:${tuo?'var(--acc-bg)':'var(--line2)'};color:${tuo?'var(--acc-ink)':'var(--mut)'}">${T(tuo?'tuo blocco':'avversario')}</span></div>
    <div style="font-size:12.5px;color:var(--mut);margin-top:3px">${caricaTerr(TE)}: <b style="color:var(--txt)">${t.titolare||'—'}</b> · ${pn}</div>
    <div style="font-size:12px;color:var(--mut2);margin-top:2px">${cap(leanLabel(TE.lean))}${TE.simbolo?' · '+T('area simbolo'):''}</div></div>${scheda}${investi}`;
}
function renderMappaPage(){
  const asseTuo=part(S.partito).asse;
  const pl=(S.potereLocale!=null)?Math.round(S.potereLocale):null;
  const mie=S.territori.filter(t=>compatibile(t.partito,asseTuo)).length;
  let h=`<button class="mini-btn" style="margin-bottom:10px" onclick="chiudiMappa()">← ${T('Partiti')}</button>`;
  h+=`<div class="contorno" style="font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin:2px 2px 8px;">${T('Il territorio · controllo politico')}</div>`;
  if(typeof inCampagna==='function' && inCampagna()){ const sf=campSforzo(); h+=`<div class="banner camp-banner">${(sf>0?T('<b>Campagna sul territorio</b>: %N punti di sforzo da spendere, %M mesi al voto. Tocca un\'area e investi: dove vai, sposti; dove non vai, perdi terreno. Quel che resta a fine campagna si perde.').replace('%N',sf):T('<b>Campagna sul territorio</b>: sforzo esaurito, %M mesi al voto. Le aree lavorate sono segnate in blu.')).replace('%M',mesiAllaFine())}</div>`; }   // L64-2
  if(pl!=null) h+=`<div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;margin-bottom:12px"><span style="font-size:12.5px;color:var(--mut)">${gergo(T('Potere locale'),'potereLocale')}${pl>50?` · <b style="color:var(--acc-ink)">${T('controlli il territorio')}</b>`:''} · <b>${mie}</b>/${S.territori.length} ${T('aree')}</span><span class="mono" style="font-weight:600;font-size:16px;color:${pl>50?'var(--acc-ink)':'var(--txt)'}">${pl}<span class="contorno" style="color:var(--mut2);">/100</span></span></div>`;
  h+=`<div class="card uno"><div class="ct">${T('La mappa')}</div><div class="mappa-wrap">${renderMappaSVG()}</div>
    <div class="mappa-leg"><span><i style="background:var(--acc)"></i>${T('il tuo blocco')}</span><span><i style="background:var(--mut2)"></i>${T('avversario')}</span><span><i style="background:var(--acc);opacity:.5"></i>${T('tinta chiara = contendibile')}</span><span><i style="border:1.6px solid var(--brand)"></i>${T('area simbolo')}</span></div>
    ${renderMappaInfo()}</div>`;
  h+=`<div class="card"><div class="ct">${T('Aree simbolo')}</div>`+PAESE.territori.map(function(TE,i){ if(!TE.simbolo) return ''; const t=S.territori[i]||{}; const tuo=compatibile(t.partito,asseTuo); const pn=(part(t.partito)||{}).nome||'';
    return `<div class="grp"><div class="top"><div class="nm">${nomeTerr(TE)}<small>${caricaTerr(TE)}</small></div><span class="chip" style="background:${tuo?'var(--acc-bg)':'var(--line2)'};color:${tuo?'var(--acc-ink)':'var(--mut)'}">${T(tuo?'tuo':'avversario')}</span></div><div style="font-size:12px;color:var(--mut)">${t.titolare||'—'} · ${pn}</div></div>`; }).join('')+`</div>`;
  h+=`<div class="card"><div class="ct">${T('Come funziona')}</div><div class="log"><div class="li">${T('Ogni area ha una tendenza storica (tinta piena = roccaforte, chiara = contendibile) e un eletto locale. Alle <b>elezioni intermedie</b> le aree possono cambiare colore: più aree controlla il tuo blocco, più sale il <b>potere locale</b> (sopra 50 → <b>+1 punto riforma</b> a gennaio).')}</div></div></div>`;
  return h;
}

/* ===== MAPPA QUARTIERI (livello 1): mappa REALE del territorio locale (OpenStreetMap, ODbL), nel cruscotto locale.
   Geometria VERA da `MAPPE_LOCALI` (chiave `<paese>_<terrIdx>`, generata da .claude/genera-mappe-locali.js):
   città → distretti reali, regione → province reali. Il COLORE di ogni zona resta una lettura DERIVATA dagli
   indicatori della città (`S.locale.ind`): centro/periferia è ricavato dalla GEOMETRIA vera (campo `peri`, distanza
   dal centroide del territorio), non inventato. QSEL = zona selezionata (transitoria, mai in S), come MAPSEL.
   Se il paese non ha (ancora) mappe reali generate, `mappaLocale()` torna null e la card non compare. ===== */
let QSEL=null;
function selQuartiere(i){ QSEL=(QSEL===i)?null:i; render(); }
function qCol(v){ return v<33?'var(--neg)':v<60?'var(--warn)':'var(--pos)'; }   // stessa scala degli indicatori locali
function mappaLocale(){ if(typeof MAPPE_LOCALI==='undefined'||!S.locale) return null; return MAPPE_LOCALI[S.paese+'_'+S.locale.terrIdx]||null; }
/* tema-indicatori per zona, dal centro (peri basso) alla periferia (peri alto): la periferia attinge alle leve
   più fragili (casa/sicurezza/servizi) — è il payoff della «cura», ora su geometria vera. */
function quartiereTema(peri,tipo){
  if(tipo==='regione') return peri>=0.66?['sanita','ambiente'] : peri>=0.33?['mobilita','sviluppo'] : ['sanita','sviluppo'];
  return peri>=0.66?['casa','servizi'] : peri>=0.33?['mobilita','verde'] : ['servizi','sicurezza'];
}
function quartiereScore(a){ const L=S.locale; if(!L) return 50; const tema=quartiereTema(a.peri||0,L.tipo); let s=0,n=0;
  tema.forEach(function(id){ if(L.ind[id]!=null){ s+=L.ind[id]; n++; } }); return n?Math.round(s/n):50; }
function renderQuartieriSVG(){
  const M=mappaLocale(); if(!M) return '';
  let h=`<svg viewBox="${M.viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mappa reale del territorio">`;
  if(M.sfondo) h+=`<path d="${M.sfondo}" fill="var(--bg2)" stroke="var(--line2)" stroke-width="0.7"/>`;
  M.aree.forEach(function(a,i){ const v=quartiereScore(a), c=qCol(v), sel=QSEL===i;
    h+=`<path d="${a.d}" fill="${c}" fill-opacity="${sel?0.97:0.8}" stroke="${sel?'var(--brand)':'var(--panel)'}" stroke-width="${sel?1.6:0.5}" style="cursor:pointer" onclick="selQuartiere(${i})"/>`; });
  return h+`</svg>`;
}
function renderQuartieriInfo(){
  const M=mappaLocale(), L=S.locale; if(!M||!L) return '';
  if(QSEL==null||!M.aree[QSEL]) return `<div style="padding:4px 14px 12px;font-size:12px;color:var(--mut2)">${T('Tocca una zona per i dettagli.')}</div>`;
  const a=M.aree[QSEL], v=quartiereScore(a), c=qCol(v), indDefs=LOCALE_IND[L.tipo]||[], tema=quartiereTema(a.peri||0,L.tipo);
  const fonti=tema.map(function(id){ const d=indDefs.find(function(x){return x.id===id;})||{}; return T(d.nm||id)+' '+Math.round(L.ind[id]); }).join(' · ');
  let nota; if(a.peri>=0.66) nota=T(v<33?'Le zone esterne sono le più fragili: punta sulle leve qui sotto e si rialzano.':'Le zone esterne reggono.');
  else if(a.peri<=0.33) nota=T(v>=66?'Il cuore del territorio, ben tenuto.':'Il cuore del territorio.');
  else nota=T('Una zona intermedia.');
  return `<div style="padding:2px 14px 12px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><b style="font-size:14.5px">${escAttr(a.nm)}</b><span class="pc mono" style="color:${c}">${v}</span></div>
    <div style="font-size:12.5px;color:var(--mut);margin-top:3px">${fonti}</div>
    <div style="font-size:12px;color:var(--mut2);margin-top:3px">${nota}</div></div>`;
}

/* ===== IL TUO PARTITO — drill-down da Partiti (lotto primarie): le tre correnti, la sfida, le azioni. ===== */
function apriPartito(){ S.partitoAperto=true; if(S.visite) S.visite.partito=(S.visite.partito||0)+1; render(); }   // L64-2: la visita si conta
function chiudiPartito(){ S.partitoAperto=null; render(); }
function renderPartitoPage(){
  const me=part(S.partito)||{};
  const disp=mossaPartitoDisponibile();
  const dc=correnteDaCurare();   // loop attivo Lotto 2: la corrente da curare ORA (per evidenziarla + consigliare la mossa)
  const mediaU=Math.round(umoreMedio());
  let h=`<button class="mini-btn" style="margin-bottom:10px" onclick="chiudiPartito()">← ${T('Partiti')}</button>`;
  h+=`<div class="contorno" style="font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin:2px 2px 8px;">${T(me.nome||'Il tuo partito')} · ${T('la vita interna')}</div>`;
  /* la sfida, col volto specifico (nome + carica + area): è il payoff della mappa */
  if(S.sfida){
    h+=`<div class="banner" style="border-color:var(--neg)"><b>${T('La sfida monta.')}</b> ${S.sfida.volto}${S.sfida.area?`, ${S.sfida.carica} — <b>${S.sfida.area}</b>`:` (${S.sfida.carica})`} ${T('si muove contro la tua leadership')}${(S.sfida.maturazione||0)>0?` · ${T('matura da')} <b>${S.sfida.maturazione}</b> ${T(S.sfida.maturazione===1?'mese':'mesi')} ${T('(a 3 scatta il congresso)')}`:''}. ${T('Ricompatta le correnti sopra 45 per farla rientrare.')}</div>`;
  }
  /* L64-3 — la sfida si gestisce: tre azioni sotto il banner (una volta per sfida; promuovi e isola col raffreddamento di partito) */
  if(S.sfida && !S.opposizione){ const dispS=(typeof mossaPartitoDisponibile==='function')?mossaPartitoDisponibile():true; const fatto='<span class="chip" style="background:var(--line2);color:var(--mut)">'+T('già fatto')+'</span>';
    h+=`<div class="card"><div class="ct">${T('Lo sfidante: cosa ne fai')}</div><div class="choices" style="display:flex;flex-direction:column;gap:7px;padding:2px 14px 12px">
      <button class="opt" ${(S.sfida.promossoMese!=null||!dispS)?'disabled style="opacity:.5"':''} onclick="sfidaPromuovi()"><span class="ol">${T('Promuovi: un incarico di peso')} ${S.sfida.promossoMese!=null?fatto:''}</span><span class="oe">${T('Lo neutralizzi per un anno · o gli dai la statura per sfidarti meglio')}</span></button>
      <button class="opt" ${(S.sfida.isolato||!dispS)?'disabled style="opacity:.5"':''} onclick="sfidaIsola()"><span class="ol">${T('Isola: gli togli l\'area')} ${S.sfida.isolato?fatto:''}</span><span class="oe">${T('La sua corrente si stringe attorno a lui, le altre respirano · la sfida rallenta')}</span></button>
      <button class="opt" style="border-color:var(--neg)" onclick="sfidaAffronta()"><span class="ol">${T('Affronta subito: primarie alle tue condizioni')}</span><span class="oe">${T('Scegli tu il momento (+3) · ma in primaria si può perdere')}</span></button></div></div>`; }
  h+=`<div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;margin-bottom:12px"><span style="font-size:12.5px;color:var(--mut)">${T('Umore medio delle correnti')}</span><span class="mono" style="font-weight:600;font-size:16px;color:${mediaU<45?'var(--neg)':mediaU<55?'var(--warn-ink)':'var(--pos)'}">${mediaU}<span class="contorno" style="color:var(--mut2);">/100</span></span></div>`;
  h+=`<div class="card"><div class="ct">${T('Le correnti')}</div>`;
  (S.correnti||[]).forEach(function(c){
    const D=CORRENTI_DEF.find(function(d){return d.id===c.id;})||{};
    const col=c.umore<35?'var(--neg)':c.umore<50?'var(--warn)':'var(--pos)';
    h+=`<div class="grp"${dc&&dc.corrente===c.id?' style="background:var(--acc-bg);border-radius:8px;padding:4px 6px;margin:0 -6px"':''}><div class="top"><div class="nm">${T(D.nome)}${dc&&dc.corrente===c.id?` <span class="chip" style="background:var(--acc);color:#1a1408">${T('da curare')}</span>`:''}<small>${c.leader}</small></div><div class="pc mono" style="color:${col}">${Math.round(c.umore)}</div></div>
      <div class="bar">${fillI('corr:'+c.id, clamp(c.umore,2,100), col)}</div>
      <div style="font-size:12px;color:var(--mut2);margin-top:4px">${T(D.desc||'')}</div></div>`;
  });
  h+=`</div>`;
  /* chi sei diventato: i tratti guadagnati + gli ultimi fatti notevoli (sistema narrativo, lotto 1) */
  const tr=tratti();
  h+=`<div class="card"><div class="ct">${T('Chi sei diventato')}</div><div style="padding:2px 14px 12px">`;
  /* l'identità in testa (lotto 2): nome, età che avanza, background — l'orologio biografico fa parte del racconto */
  const pers=S.personaggio||{};
  const bgP=pers.background?T((BACKGROUNDS.find(function(b){return b.id===pers.background;})||{}).nome||''):'';
  const famP=pers.famiglia?T((FAMIGLIE.find(function(f){return f.id===pers.famiglia;})||{}).nome||''):'';
  const sub=[bgP?bgP.toLowerCase():null,famP?famP.toLowerCase():null].filter(Boolean).join(', ');
  const chiRiga=(pers.nome?escAttr(pers.nome)+', ':'')+(S.eta!=null?S.eta+' '+T('anni'):'')+(sub?' — '+sub:'');
  if(chiRiga) h+=`<div style="font-size:13px;margin:4px 0 2px"><b>${chiRiga}</b></div>`;
  /* ritratto privato (lotto 5): famiglia + integrità (etichetta sobria, mai numero; solo se dissonante) */
  const fam=S.famiglia;
  if(fam && (fam.coniuge || (fam.figli&&fam.figli.length))){
    const figliTxt=(fam.figli&&fam.figli.length)?fam.figli.map(f=>escAttr(f.nome)+' '+f.eta).join(', '):'';
    const pezzi=[]; if(fam.coniuge) pezzi.push(gn('sposato con','sposata con')+' '+escAttr(fam.coniuge.nome));
    if(figliTxt) pezzi.push(T(fam.figli.length===1?'figlio: ':'figli: ')+figliTxt);
    h+=`<div style="font-size:12px;color:var(--mut2);margin:2px 0 4px">${pezzi.join(' · ')}</div>`;
    /* serenità familiare (lotto ribilanciamento): etichetta sobria, mai un numero — l'inazione la erode */
    if(fam.serenita!=null){ const sv=fam.serenita; const lab=sv>=60?{t:T('Affetti curati'),c:'var(--pos)'}:sv>=35?{t:T('Affetti un po\' trascurati'),c:'var(--warn-ink)'}:{t:T('La famiglia è in crisi'),c:'var(--neg)'};
      h+=`<div style="font-size:12px;color:${lab.c};margin:2px 0 4px">${lab.t}</div>`; }
  }
  const dDiss=Math.abs((pers.orientamento||0)-((part(S.partito)||{}).asse||0));
  if(dDiss>=2 && S.integrita!=null){
    const lab=S.integrita>=65?{t:gn('Fedele alle sue idee','Fedele alle sue idee'),c:'var(--pos)'}:S.integrita>=40?{t:T('In tensione con la sua coscienza'),c:'var(--warn-ink)'}:{t:T('In rotta con la sua coscienza'),c:'var(--neg)'};
    h+=`<div style="font-size:12px;color:${lab.c};margin:2px 0 4px">${lab.t}</div>`;
  }
  if(tr.length){
    h+=`<div style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px">`+tr.map(function(id){ const D=TRATTI_DEF.find(function(d){return d.id===id;})||{}; return `<span class="chip" style="background:var(--acc-bg);color:var(--acc-ink);font-size:12px;padding:4px 10px">${D.nome||id}</span>`; }).join('')+`</div>`;
    h+=tr.map(function(id){ const D=TRATTI_DEF.find(function(d){return d.id===id;})||{}; return `<div style="font-size:12px;color:var(--mut2);margin-top:2px"><b style="color:var(--mut)">${D.nome}.</b> ${T(D.riga||'')}</div>`; }).join('');
  } else h+=`<div style="font-size:12.5px;color:var(--mut2);margin-top:4px">${T('Ancora nessun tratto: le scelte ripetute ti definiranno.')}</div>`;
  const ff=(S.biografia&&S.biografia.fatti.slice(-4).reverse())||[];
  if(ff.length) h+=`<div class="log" style="margin-top:9px">`+ff.map(function(f){return `<div class="li"><b>${f.anno}.</b> ${f.testo}</div>`;}).join('')+`</div>`;
  h+=`</div></div>`;
  /* le azioni di gestione: una mossa di partito ogni cdPartito() mesi (l'energia segue l'età) */
  /* Lotto 2: la scheda EVIDENZIA quale corrente curare + quale mossa (affinamento #1) */
  if(dc){ const nomeC=T((CORRENTI_DEF.find(function(d){return d.id===dc.corrente;})||{}).nome||'');
    const reason= dc.mediazione ? T('Due correnti scivolano: una mediazione le ricuce prima che la sfida monti.') : T('%C si scaldano: un incarico li rinsalda prima che la sfida monti.').replace('%C', nomeC);
    h+=`<div class="banner" style="border-color:var(--acc)"><b>${T('Conviene una mossa.')}</b> ${reason}</div>`; }
  const mesiResto=disp?0:Math.max(1,cdPartito()-((S.year*12+S.month)-S.mossaPartito));
  h+=`<div class="card"><div class="ct">${T('La mossa di partito')} ${disp?'':`<small style="color:var(--warn-ink);font-weight:600;text-transform:none;letter-spacing:0"> · ${T('disponibile tra')} ${mesiResto} ${T(mesiResto===1?'mese':'mesi')}</small>`}</div><div class="choices" style="padding:0 14px 14px;display:flex;flex-direction:column;gap:8px">`;
  const dis=disp?'':'disabled style="opacity:.5"';
  (S.correnti||[]).forEach(function(c){
    const D=CORRENTI_DEF.find(function(d){return d.id===c.id;})||{};
    h+=`<button class="opt" ${dis} onclick="azioneIncarico('${c.id}')"><span class="ol">${T('Incarico')} ${T(D.a||'')}${dc&&!dc.mediazione&&dc.corrente===c.id?` <span class="chip" style="background:var(--acc-bg);color:var(--acc-ink)">${T('consigliato')}</span>`:''}</span><span class="oe">${T(D.nome)} +8 · ${T('le altre due −2 (gelosie)')}</span></button>`;
  });
  const sotto=(S.correnti||[]).filter(function(c){return c.umore<50;});
  if(sotto.length>=2) h+=`<button class="opt" ${dis} onclick="azioneMediazione()"><span class="ol">${T('Mediazione interna')}${dc&&dc.mediazione?` <span class="chip" style="background:var(--acc-bg);color:var(--acc-ink)">${T('consigliato')}</span>`:''}</span><span class="oe">${T('Ricuci le due correnti più scontente (+7 e +7) · i Fedelissimi mugugnano (−2)')}</span></button>`;
  h+=`</div></div>`;
  h+=`<div class="card"><div class="ct">${T('Come funziona')}</div><div class="log"><div class="li">${T('Le correnti seguono il tuo modo di governare: <b>i Fedelissimi</b> il consenso, <b>i Pontieri</b> i ministri tecnici e i mercati, <b>i Militanti</b> la base e i ministri di linea. Le <b>nomine</b> contano, le <b>intermedie</b> pure. Sotto <b>35</b> una corrente fa montare la <b>sfida</b> (il volto arriva dai tuoi governatori sulla mappa); 3 mesi di malcontento maturo → <b>congresso anticipato</b>; se la sfida è viva alla vigilia delle elezioni → <b>primarie prima delle urne</b>. Perse = il partito ti scarica.')}</div></div></div>`;
  return h;
}

/* --- Scheda PARTITI: forza CORRENTE (S.forze) con freccia/delta coerenti col valore mostrato
   (1 decimale; freccia solo se la cifra visualizzata cambia di >0,15), badge Governo/Opposizione. --- */
/* ===== EMICICLO dei seggi (grafica vettoriale, lotto 2) — semicerchio SVG puro a PUNTINI-seggio,
   calcolato dai seggi reali. Partiti ordinati sinistra→destra per `asse`; ogni partito = blocco angolare
   contiguo. Colori MAI di brand: tuo partito = accento pieno, alleati = accento chiaro (stessa tinta,
   opacità), opposizione = neutro. Linea tratteggiata al vertice = maggioranza (50). Animazione §7:
   i puntini compaiono a ventaglio sx→dx (opacity/scale, ritardo per indice); reduced-motion → statico.
   Ri-render dello stesso stato → statico (firma in EMI_SIG, il ventaglio non ri-pulsa a ogni render). ===== */
let EMI_SIG=null;
function emiciclo(seggi, opts){
  opts=opts||{};
  const coal=opts.coal||S.coalizione||[S.partito], mine=opts.mine||S.partito;
  const ps=[...PAESE.partiti].filter(p=>(seggi[p.id]||0)>0).sort((a,b)=>((a.asse||0)-(b.asse||0))||((seggi[b.id]||0)-(seggi[a.id]||0)));
  const tot=ps.reduce((s,p)=>s+(seggi[p.id]||0),0); if(!tot) return '';
  /* file concentriche: seggi per fila proporzionali alla lunghezza dell'arco (resti ai più alti) */
  const RAGGI=[28,35,42,49,56], cx=58, cy=60, sumR=RAGGI.reduce((a,b)=>a+b,0);
  const perRiga=RAGGI.map(r=>({r, n:Math.floor(tot*r/sumR), resto:(tot*r/sumR)%1}));
  let usati=perRiga.reduce((s,x)=>s+x.n,0);
  perRiga.slice().sort((a,b)=>b.resto-a.resto).forEach(x=>{ if(usati<tot){x.n++;usati++;} });
  /* posizioni: t=0 (sinistra) → t=1 (destra), poi ordino per t così i partiti riempiono a spicchi contigui */
  const posti=[];
  perRiga.forEach(({r,n})=>{ for(let j=0;j<n;j++){ const t=n===1?0.5:j/(n-1), th=Math.PI-t*Math.PI;
    posti.push({x:cx+r*Math.cos(th), y:cy-r*Math.sin(th), t:t+r*1e-6}); } });
  posti.sort((a,b)=>a.t-b.t);
  /* firma: stesso stato → niente ri-animazione */
  const sig=(opts.key||'')+'|'+ps.map(p=>p.id+':'+seggi[p.id]).join(',');
  const anim=sig!==EMI_SIG && !motionReduced(); EMI_SIG=sig;
  let dots='', k=0;
  for(const p of ps){ const inCoal=coal.includes(p.id), me=p.id===mine;
    const fill=me?'var(--acc)':inCoal?'var(--acc)':'var(--mut2)';
    const op=me?'1':inCoal?'0.4':'0.45';
    for(let i=0;i<(seggi[p.id]||0) && k<posti.length;i++,k++){ const pt=posti[k];
      dots+=`<circle class="emi-dot${anim?' emi-anim':''}" cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="2.6" fill="${fill}" fill-opacity="${op}"${anim?` style="animation-delay:${k*7}ms"`:''}><title>${escAttr(T(p.nome))}</title></circle>`; }
  }
  return `<svg viewBox="0 0 116 66" role="img" aria-label="${T('Emiciclo')}: ${tot} ${T('seggi')}" style="display:block;width:100%;max-width:340px;margin:0 auto;overflow:visible">
    ${dots}
    <line x1="${cx}" y1="${cy-61}" x2="${cx}" y2="${cy-23}" stroke="var(--neg)" stroke-width="1" stroke-dasharray="2 2" opacity="0.55"/>
    <text x="${cx}" y="${cy-63}" text-anchor="middle" font-size="5.5" fill="var(--mut)">50</text>
  </svg>`;
}

/* L25-1 — la riga «Intesa» sotto ogni partito NON-tuo, **solo all'opposizione**: il tavolo delle alleanze è un
   lavoro che si deve vedere accumularsi. Mostra il valore, il tetto-per-distanza (così si capisce perché un partito
   lontano non arriverà mai) e segnala quando l'intesa ha superato 60, cioè quando quel partito ENTRA nel blocco. */
function rigaIntesa(p, mine){
  if(!S || !S.opposizione || mine) return '';
  if(typeof intesaDi!=='function' || typeof intesaCap!=='function') return '';
  var v=intesaDi(p.id), cap=intesaCap(p.id);
  if(cap<=0) return '';
  var dentro=v>=60;
  var col=dentro?'var(--pos)':(v>0?'var(--acc)':'var(--mut2)');
  var nota=dentro?T('nel tuo blocco'):(cap<60?T('troppo lontano')+' · '+T('tetto')+' '+cap:T('serve 60'));
  return `<div style="display:flex;align-items:center;gap:8px;margin-top:5px">
    <span style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);min-width:46px">${gergo(T('Intesa'),'intesa')}</span>
    <div class="bar" style="flex:1;position:relative">${fillI('intesa:'+p.id, clamp(v,2,100), col)}</div>
    <span class="mono" style="font-size:12px;color:${col};min-width:22px;text-align:right">${Math.round(v)}</span>
    <small style="font-size:11px;color:var(--mut2);white-space:nowrap">${nota}</small></div>`;
}
function renderPartiti(){
  if(S.partitoAperto && S.correnti){ document.getElementById('sec-par').innerHTML=renderPartitoPage(); return; }      // drill-down: la vita interna del partito
  if(S.mappaAperta && PAESE.mappa){ document.getElementById('sec-par').innerHTML=renderMappaPage(); return; }   // drill-down: la mappa del territorio
  const P=PAESE;
  const fz=id=>(S.forze&&S.forze[id]!=null)?S.forze[id]:((P.partiti.find(x=>x.id===id)||{}).forza||0);
  const ps=[...P.partiti].sort((a,b)=>fz(b.id)-fz(a.id));
  const coal=S.coalizione||[S.partito], hasSeats=!!S.seggi;
  const pl=(S.potereLocale!=null)?Math.round(S.potereLocale):null;
  const plBox = pl!=null ? `<div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;margin-bottom:12px"><span style="font-size:12.5px;color:var(--mut)">${gergo(T('Potere locale'),'potereLocale')}${pl>50?` · <b style="color:var(--acc-ink)">${T('controlli il territorio')}</b>`:''}</span><span class="mono" style="font-weight:600;font-size:16px;color:${pl>50?'var(--acc-ink)':'var(--txt)'}">${pl}<span class="contorno" style="color:var(--mut2);">/100</span></span></div>` : '';
  const asseTuo=part(S.partito).asse;
  const so=S.ultimoSondaggio;
  /* F3 — IL GRAFICO-TREND: la serie dei sondaggi con la banda d'incertezza, invece dei numeri nudi. Puro render
     di `S.sondStorico` (nessuna casualità qui: il valore è già stato generato e persistito al confine di mese →
     idempotente). SVG inline, larghezza fluida (375px senza salti), E5: nessuna animazione oltre opacity. */
  const graficoSond=(function(){
    const st=(S.sondStorico||[]); if(st.length<2) return '';
    const W=300, H=88, pad=7;
    const mm0=st[0].mm, mm1=st[st.length-1].mm, span=Math.max(1, mm1-mm0);
    const X=p=>pad+(p.mm-mm0)/span*(W-2*pad);
    const Y=v=>H-pad-(clamp(v,0,100)/100)*(H-2*pad);
    const linea=st.map((p,i)=>(i?'L':'M')+X(p).toFixed(1)+' '+Y(p.val).toFixed(1)).join(' ');
    const su=st.map(p=>X(p).toFixed(1)+' '+Y(p.val+p.margine).toFixed(1));
    const giu=st.slice().reverse().map(p=>X(p).toFixed(1)+' '+Y(p.val-p.margine).toFixed(1));
    const banda='M'+su.join(' L')+' L'+giu.join(' L')+' Z';
    const y50=Y(50).toFixed(1);
    const punti=st.map((p,i)=>{ const u=(i===st.length-1);
      return `<circle cx="${X(p).toFixed(1)}" cy="${Y(p.val).toFixed(1)}" r="${u?3.6:2.2}" fill="${u?'var(--acc)':'var(--brand)'}" opacity="${u?0.95:0.65}"/>`; }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;margin:2px 0 6px" role="img" aria-label="${T('Andamento dei sondaggi')}">
      <path d="${banda}" fill="var(--brand)" opacity="0.13"/>
      <line x1="${pad}" y1="${y50}" x2="${W-pad}" y2="${y50}" stroke="var(--neg)" stroke-width="1" opacity="0.45" stroke-dasharray="3 3"/>
      <path d="${linea}" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${punti}</svg>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--mut2);margin:-2px 0 4px"><span>${T('%N mesi fa').replace('%N',span)}</span><span>${T('oggi')}</span></div>`;
  })();
  const sondBox=(typeof periodoSondaggi==='function' && periodoSondaggi() && so)?`<div class="card" style="margin-bottom:12px;padding:11px 14px">
      <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);margin-bottom:6px">${T('Ultimo sondaggio')}</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><span style="font-size:12.5px;color:var(--mut2)">${T(so.tipo==='parlamentare'?'Il tuo blocco':'Testa a testa')} · ${T('margine')} ±${so.margine}</span><span class="mono" style="font-weight:600;font-size:17px">${so.val}%</span></div>
      ${graficoSond || `<div class="bar" style="position:relative"><i style="width:${clamp(so.val,2,100)}%;background:var(--brand)"></i><span style="position:absolute;left:50%;top:-2px;bottom:-2px;width:2px;background:var(--neg);opacity:.55"></span></div>`}
      <div style="font-size:11px;color:var(--mut2);margin-top:6px">${T("La tacca segna il 50%. I sondaggi hanno un margine d'errore: indicano la tendenza, non la certezza.")}</div></div>`:'';
  const campRiga=(typeof inCampagna==='function' && inCampagna() && PAESE.mappa)?`<div class="banner camp-banner" style="margin-bottom:12px">${T('Campagna sul territorio: <b>%N punti</b> da spendere sulla mappa, %M mesi al voto.').replace('%N',campSforzo()).replace('%M',mesiAllaFine())} <a href="#" onclick="apriMappa();return false;" style="font-weight:600">${T('Apri la mappa →')}</a></div>`:'';   // L64-2
  const territBox=(campRiga)+((S.territori&&S.territori.length)?(PAESE.mappa
    ? `<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;margin-bottom:12px"><span style="font-size:12.5px;color:var(--mut)">${T('Il territorio · <b>%N</b> aree su %M al tuo blocco').replace('%N',S.territori.filter(function(t){return compatibile(t.partito,asseTuo);}).length).replace('%M',S.territori.length)}</span><button class="mini-btn" style="margin-top:0;flex-shrink:0;background:var(--brand-bg);border-color:var(--brand);color:var(--brand);font-weight:600" onclick="apriMappa()">${T('Apri la mappa →')}</button></div>`
    : `<div class="card"><div class="ct">${T('Il territorio')}</div>`+PAESE.territori.map(function(TE,i){ const t=S.territori[i]||{}; const tuo=compatibile(t.partito,asseTuo); const pn=(part(t.partito)||{}).nome||''; return `<div class="grp"><div class="top"><div class="nm">${nomeTerr(TE)}<small>${caricaTerr(TE)}</small></div><span class="chip" style="background:${tuo?'var(--acc-bg)':'var(--line2)'};color:${tuo?'var(--acc-ink)':'var(--mut)'}">${T(tuo?'tuo':'avversario')}</span></div><div style="font-size:12px;color:var(--mut)">${t.titolare||'—'} · ${pn}</div></div>`; }).join('')+`</div>`):'');
  const mediaU=S.correnti?Math.round(umoreMedio()):null;
  const dcP=S.correnti?correnteDaCurare():null;   // loop attivo Lotto 2: evidenzia già sulla landing quale corrente curare
  const dcNome=dcP?T((CORRENTI_DEF.find(function(d){return d.id===dcP.corrente;})||{}).nome||''):'';
  /* Lotto A (fix playtest): quando c'è una corrente da curare, la MOSSA è in landing (un tap) — prima era 2 tap dentro il drill-down. */
  const dcA=dcP?T((CORRENTI_DEF.find(function(d){return d.id===dcP.corrente;})||{}).a||''):'';
  const dcAzione=dcP?`<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="mini-btn" style="margin-top:0;background:var(--acc-bg);border-color:var(--acc);color:var(--acc-ink);font-weight:600" onclick="azioneIncarico('${dcP.corrente}')">${T('Dai un incarico')} ${dcA} <small>(+8)</small></button>${dcP.mediazione?`<button class="mini-btn" style="margin-top:0" onclick="azioneMediazione()">${T('Media tra le correnti')}</button>`:''}</div>`:'';
  const partitoBox=S.correnti?`<div class="card" style="padding:10px 14px;margin-bottom:12px${dcP?';border-color:var(--acc)':''}"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:12.5px;color:var(--mut)">${T('Il tuo partito')} · ${T('umore')} <b style="color:${mediaU<45?'var(--neg)':mediaU<55?'var(--warn-ink)':'var(--pos)'}">${mediaU}</b>${S.sfida?` · <b style="color:var(--neg)">${T('sfida in corso')}</b>`:dcP?` · <b style="color:var(--acc-ink)">${dcNome} ${T('da curare')}</b>`:''}</span><button class="mini-btn" style="margin-top:0;flex-shrink:0;background:var(--brand-bg);border-color:var(--brand);color:var(--brand);font-weight:600" onclick="apriPartito()">${T('Apri')} →</button></div>${dcAzione}</div>`:'';
  /* l'aula: emiciclo dai seggi reali (solo dove c'è un parlamento). Affianca le barre, non le sostituisce. */
  const emiBox = hasSeats ? `<div class="card"><div class="ct">${T("L'aula")} · ${Object.values(S.seggi).reduce((a,b)=>a+b,0)} ${T('seggi')}</div>
    <div style="padding:8px 14px 2px">${emiciclo(S.seggi,{key:'par'})}</div>
    <div class="contorno" style="font-size:11px;color:var(--mut2);padding:0 15px 10px;text-align:center">${T('Il tuo partito pieno, gli alleati in chiaro · la linea tratteggiata segna la maggioranza (50)')}</div></div>` : '';
  let h=sondBox+partitoBox+plBox+emiBox+`<div class="card g2"><div class="ct">${T('Partiti')} · ${T(P.nome)}${hasSeats?' · '+T('seggi'):''}</div>`;
  for(const p of ps){
    const mine=p.id===S.partito, gov=coal.includes(p.id);
    const f=fz(p.id);
    const now=Math.round(f*10)/10, prev=Math.round(((S.forzePrev&&S.forzePrev[p.id]!=null)?S.forzePrev[p.id]:f)*10)/10, d=now-prev;
    const arr = d>0.15?`<span style="color:var(--pos)">▲ ${fmt(d,1)}</span>` : d<-0.15?`<span style="color:var(--neg)">▼ ${fmt(-d,1)}</span>` : `<span style="color:var(--mut2)">–</span>`;
    const badge = gov?`<span class="chip" style="background:var(--acc-bg);color:var(--acc-ink)">${T('Governo')}</span>`:`<span class="chip" style="background:var(--line2);color:var(--mut)">${T('Opposizione')}</span>`;
    const ten = (S.tenuta && S.tenuta[p.id]!=null) ? S.tenuta[p.id] : null;        // tenuta solo per gli alleati
    const tenCol = ten==null?'' : ten<20?'var(--neg)' : ten<35?'var(--warn-ink)' : 'var(--pos)';
    const tenBg  = ten==null?'' : ten<20?'var(--neg-bg)' : ten<35?'var(--warn-bg)' : 'var(--pos-bg)';
    const tenChip = ten!=null ? ` <span class="chip" style="background:${tenBg};color:${tenCol}">${gergo(T('tenuta'),'tenuta')} ${Math.round(ten)}</span>` : '';
    const seatTxt = hasSeats?` <small style="color:var(--mut2);font-weight:400">· ${S.seggi[p.id]} ${T('seggi')}</small>`:'';
    /* Lotto A (fix playtest): la leva sulla tenuta ORA VIVE ANCHE QUI — un tap dalla riga dell'alleato che scivola
       (prima stava solo in sala Stampa: la tab mostrava il problema senza offrire la mossa). Stesso gate (mossa stampa). */
    const segBtn = (ten!=null && ten<55 && !S.opposizione && typeof mossaDisponibile==='function' && mossaDisponibile() && typeof azioneSegnale==='function')
      ? `<div style="margin-top:6px"><button class="mini-btn" style="margin-top:0" onclick="azioneSegnale('${p.id}','felpata')">${T('Rinsalda l\'alleato')} · <small>${T('mossa stampa')}</small></button></div>` : '';
    h+=`<div class="grp" style="${mine?'box-shadow:inset 0 0 0 1px var(--acc);border-radius:10px;':''}">
      <div class="top"><div class="nm">${T(p.nome)} ${badge}${tenChip}<small>${T(p.orientamento)}</small></div>
      <div class="pc mono" style="color:${gov?'var(--acc)':'var(--txt)'}">${fmt(f,1)}%${seatTxt} <small style="font-weight:400">${arr}</small></div></div>
      <div class="bar">${fillI('forza:'+p.id, clamp(f,2,100), gov?'var(--acc)':'var(--mut2)')}</div>${segBtn}${rigaIntesa(p, mine)}</div>`;
  }
  const comeVince = P.comeSiVince==='parlamentare'
    ? T('A fine mandato le forze diventano <b>seggi</b> (su 100): per restare al governo la tua coalizione deve raggiungere <b>50 seggi</b>%X.').replace('%X', T(P.coalizione?', formando alleanze coi partiti vicini per asse politico':' da sola'))
    : T('A fine mandato si vota in un <b>testa a testa</b> col rivale più forte: gli altri partiti si schierano per vicinanza politica e vinci se superi il 50%.');
  const hasAllies = S.tenuta && Object.keys(S.tenuta).length>0;
  const tenNote = hasAllies?' '+T('Ogni <b>alleato</b> ha una <b>tenuta</b>: se trascuri la sua base cala, finché ti pone un <b>ultimatum</b> e — se lo ignori — <b>esce</b> dalla coalizione.'):'';
  const minNote = S.minoranza?' <b style="color:var(--neg)">'+T('Governi in minoranza')+'</b>: '+T('ogni mese rischi una <b>mozione di sfiducia</b> che porta a elezioni anticipate.'):'';
  const govLine = S.opposizione?T("Al <b>Governo</b> c'è l'avversario; il tuo partito è all'<b>Opposizione</b>."):T("I partiti al <b>Governo</b> formano la tua maggioranza, gli altri sono all'<b>Opposizione</b>.");
  const oppNote = S.opposizione?' <b style="color:var(--neg)">'+T("Sei all'opposizione")+'</b>: '+T('fai risalire la tua forza e vinci il prossimo voto per tornare al governo; se crolla sotto ~%N il partito ti scarica.').replace('%N',Math.round(Math.max(part(S.partito).forza*0.5,5))):'';
  h+=`</div>${territBox}<div class="card"><div class="ct">${T('Come funziona')}</div><div class="log">
    <div class="li">${T("Le forze <b>seguono l'umore dei gruppi sociali</b> che ogni partito rappresenta: base soddisfatta → il partito cresce, altrimenti cala (lentamente, ancorato alla forza iniziale).")} ${govLine} ${comeVince}${tenNote}${minNote}${oppNote}</div></div></div>`;
  document.getElementById('sec-par').innerHTML=h;
}
