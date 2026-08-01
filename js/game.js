"use strict";
/* ============================================================
   GAME — il "regista" del gioco.
   Gestisce il flusso: nomina del governo, avvio di una nuova
   partita, generazione dell'agenda mensile, avanzamento del
   mese, elezioni di fine mandato, crisi e fine partita.
   Carica per ultimo: usa funzioni e dati definiti negli altri file.
   ============================================================ */

/* COAL = coalizione in costruzione durante la trattativa (passo 3); null fuori dalla trattativa */
let COAL=null;
/* NOTTE = spoglio elettorale in corso (risultato vero congelato + tappa); null fuori dalla notte.
   Come COAL: globale, MAI dentro S → mai serializzata, la notte resta atomica rispetto al salvataggio. */
let NOTTE=null;
/* TEL = telefonata in corso (F1). Come NOTTE: transitorio globale, MAI dentro S → il TIMER non è serializzato.
   In S vive solo S.telPendente (l'id della chiamata senza risposta): al reload il telefono squilla di nuovo da capo,
   con un timer fresco, senza che il reload la faccia perdere né permetta di schivarla. */
let TEL=null;
/* INTERVISTA = la catena F5 (2-3 Sfide concatenate, difficoltà crescente) in corso. Come NOTTE/TEL: transitorio globale,
   MAI in S → nessuno stato-catena ricaricabile per ritentare; il premio si applica solo alla chiusura. */
let INTERVISTA=null;
/* ATTESA = la chiusura della campagna PRIMA della notte (lotto PAYOFF NARRATIVO fase B). Congela il `vero`
   (calcolato UNA volta, qui) così la mossa di chiusura NON può cambiare il verdetto — esprime solo carattere.
   Stesso pattern atomico di NOTTE/COAL: globale, mai in S, mai serializzata. */
let ATTESA=null;
/* PRIM = primaria in corso (punteggio congelato all'apertura); null fuori. Stesso pattern atomico di NOTTE. */
let PRIM=null;

/* --- Nomina del governo --- */
function goAppoint(){
  APT={cands:{}, sel:{}};
  for(const m of MINISTRIES){
    const arr=[]; let guard=0;
    while(arr.length<3 && guard++<40){ const c=mkCand(); if(!arr.some(x=>x.profile===c.profile)) arr.push(c); }
    while(arr.length<3) arr.push(mkCand());
    /* L20-1 — la ROSA: i 3 candidati hanno volti distinti fra loro (è lì che il confronto visivo conta). Il volto
       mostrato resta `ritRosa`, e alla nomina ha la precedenza se libero: quello che vedi scegliendo è quello che ottieni. */
    if(typeof assegnaVoltiGruppo==='function'){ assegnaVoltiGruppo(arr); arr.forEach(c=>{ c.ritRosa=c.rit; }); }
    APT.cands[m.id]=arr;
  }
  document.getElementById('start').style.display='none';
  document.getElementById('over').style.display='none';
  document.getElementById('game').style.display='none';        // serve al rientro dall'opposizione (innocuo all'avvio)
  document.getElementById('ov').classList.remove('on');
  document.getElementById('appoint').style.display='block';
  renderAppoint();
}
function confirmCabinet(){
  const mins=MINISTRIES.map(m=>{const c=APT.cands[m.id][APT.sel[m.id]]; return {min:m.id, nm:c.nm, g:c.g, profile:c.profile, comp:c.comp, loyalty:62, rit:c.rit};});
  /* L20-1 — la formazione è l'unico momento in cui TUTTI sono "nuovi": si assegnano i volti in blocco, ognuno
     partendo dal suo hash e cedendo il passo a chi l'ha già preso (`rit` congelato). Da qui in poi nessuno cambia. */
  if(typeof assegnaVoltiGruppo==='function'){ mins.forEach(m=>{ m.rit=null; }); assegnaVoltiGruppo(mins); }
  if(S && S.opposizione) tornaAlGoverno(mins); else startGame(mins);   // rientro dall'opposizione vs nuova partita
}

/* ===== IL PERSONAGGIO (sistema narrativo, lotto 2) — chi sei all'inizio.
   defaultPersonaggio = il "neutro" (gioca identico a prima del lotto). applicaPersonaggio copia il
   transitorio CREA in S.personaggio/S.eta e applica i CREDITI D'ESORDIO: gruppi (il motore li riassorbe
   da solo, convergenza 0,12/mese), stampa e reputazione (rientrano alle loro àncore). Orientamento e
   religiosità sono SOLO registrati (serviranno alla dissonanza, lotto 5). ===== */
function defaultPersonaggio(){ return {nome:'', genere:'m', etaIniziale:52, background:null, famiglia:null, orientamento:0, religiosita:'laico'}; }
function applicaPersonaggio(){
  const c=CREA;
  S.personaggio = c ? { nome:(c.nome||'').trim().slice(0,24), genere:(c.genere==='f'?'f':'m'), etaIniziale:c.eta||52,
    background:c.background||null, famiglia:c.famiglia||null, avatar:c.avatar||null,
    orientamento:clamp(c.orientamento!=null?c.orientamento:0,-2,2), religiosita:c.religiosita||'laico' } : defaultPersonaggio();
  S.eta=S.personaggio.etaIniziale;
  const B=S.personaggio.background ? BACKGROUNDS.find(function(b){return b.id===S.personaggio.background;}) : null;
  if(B){
    if(B.groups) for(const g in B.groups){ if(S.groups[g]!=null) S.groups[g]=clamp(S.groups[g]+B.groups[g],0,100); }
    if(B.stampa) S.ind.stampa=clamp(S.ind.stampa+B.stampa,0,100);
    if(B.reputazione) S.ind.reputazione=clamp(S.ind.reputazione+B.reputazione,0,100);
  }
  const F=S.personaggio.famiglia ? FAMIGLIE.find(function(f){return f.id===S.personaggio.famiglia;}) : null;
  if(F && F.groups) for(const g in F.groups){ if(S.groups[g]!=null) S.groups[g]=clamp(S.groups[g]+F.groups[g],0,100); }
  /* esposizione giudiziaria iniziale (lotto 3): i due ganci del personaggio finalmente vivi —
     il magistrato sa come si sta lontani dai fascicoli (6 vs 12), la dinastia è osservata (+6). */
  S.esposizione=(S.personaggio.background==='magistrato'?6:12)+(S.personaggio.famiglia==='dinastia'?6:0);
  /* la vita personale (lotto 5): integrità dalla DISTANZA fra la tua coscienza e l'asse del partito che guidi
     (allineato 90 e immobile; il progressista a capo della destra parte già a 70 e governare lo logora);
     la famiglia generata dall'età, personaggi ricorrenti degli eventi. */
  S.integrita=integritaIniziale();
  S.famiglia=generaFamiglia();
  /* livello d'avvio (lotto ascesa): 2 = ministro sotto premier-AI, 3 = capo del governo (default). Il dicastero
     dal personaggio (default per background). startMinistro completa il resto; startGame/startOpposizione restano a 3. */
  S.livello=(c && (c.livello===0||c.livello===1||c.livello===2||c.livello===5))?c.livello:3;   // 0 = attivista (Build A) · 5 = percorso diplomatico (C2)
  S.dicastero=(S.livello===2)?((c && c.dicastero)||dicasteroDefault(S.personaggio.background)):null;
  CREA=null;   // consumata: la prossima partita ricompila da capo
}
/* il dicastero di partenza suggerito dal background (puro default UI; il giocatore può cambiarlo in creazione) */
function dicasteroDefault(bg){ return ({sindacalista:'lavoro', imprenditore:'economia', magistrato:'giustizia', docente:'istruzione', militare:'difesa', medico:'salute', giornalista:'interno'})[bg] || 'economia'; }
/* L'INTEGRITÀ (lotto 5): init dalla distanza orientamento↔asse (0..4) → 90−5·d. */
function integritaIniziale(){ const ori=(S.personaggio&&S.personaggio.orientamento)||0; const asse=(part(S.partito)||{}).asse||0; return clamp(90-5*Math.abs(ori-asse),0,100); }
/* La FAMIGLIA (lotto 5): coniuge ~78%, figli plausibili rispetto all'età; cresce a gennaio. Generata una
   volta e congelata in S.famiglia (dato puro) — mai ri-tirata al caricamento. */
/* il coniuge è di GENERE OPPOSTO al protagonista per default (niente same-sex a sorpresa): nome dalla lista
   del genere opposto. Fallback alla lista mista se un paese non ha le liste per genere. */
function nomeGenere(g){ const L=(g==='f')?PAESE.nomiF:PAESE.nomiM; return rnd((L&&L.length)?L:PAESE.nomi); }
function generaFamiglia(){
  const eta=(S.eta!=null)?S.eta:52;
  const gP=(S.personaggio&&S.personaggio.genere==='f')?'f':'m', gC=(gP==='f')?'m':'f';
  const coniuge=(Math.random()<0.78)?{nome:nomeGenere(gC), genere:gC}:null;
  const nfMax=eta<45?1:(eta<55?2:3);
  const nf=coniuge?Math.floor(Math.random()*(nfMax+1)):(Math.random()<0.4?1:0);
  const figli=[];
  for(let i=0;i<nf;i++){ const fe=clamp(eta-24-Math.floor(Math.random()*10)-i*3,0,55); figli.push({nome:rnd(PAESE.nomi), eta:fe}); }
  return {coniuge:coniuge, figli:figli, serenita:70};
}
function famigliaPresente(){ return !!(S.famiglia && (S.famiglia.coniuge || (S.famiglia.figli&&S.famiglia.figli.length))); }
/* la serenità familiare (lotto ribilanciamento): scende trascurando gli affetti, sale curandoli. Sotto 35 apre
   la crisi familiare (il popup). Vale solo se hai una famiglia. */
function serenitaMuovi(n){ if(S.famiglia && S.famiglia.serenita!=null) S.famiglia.serenita=clamp(S.famiglia.serenita+n,0,100); }
function haFiglioInEta(a,b){ return !!(S.famiglia && S.famiglia.figli && S.famiglia.figli.some(function(f){return f.eta>=a && f.eta<=b;})); }
function figlioNome(a,b){ if(!S.famiglia||!S.famiglia.figli) return 'tuo figlio'; const f=S.famiglia.figli.find(function(x){return x.eta>=a && x.eta<=b;}); return f?f.nome:'tuo figlio'; }
/* convalescente = nei mesi di riguardo dopo una cura (energia ridotta, deleghi). Temporaneo e lieve. */
function convalescente(){ return S.convalescenza!=null && (S.year*12+S.month) < S.convalescenza; }
/* Il participio giusto per il giocatore (genere NARRATIVO, mai statistico): gn('eletto','eletta').
   I titoli istituzionali NON passano da qui e restano invariabili (PAESE.titoloRuolo). */
function gn(m,f){ return T((S&&S.personaggio&&S.personaggio.genere==='f')?f:m); }
function bgNome(){ const p=S&&S.personaggio; if(!p||!p.background) return ''; const B=BACKGROUNDS.find(function(b){return b.id===p.background;}); return B?B.nome:''; }

/* --- Stato base comune ai due avvii (al GOVERNO e all'OPPOSIZIONE) ---
   Costruisce S e i derivati INDIPENDENTI dal ruolo: indicatori iniziali, leggi del paese, forze di partenza.
   Il ruolo (ministri/coalizione/territori) lo aggiunge il chiamante. Condiviso → un solo punto di verità. */
function initStatoBase(){
  try{ resetUIAnim(); }catch(e){}   // nuova partita: prima apparizione senza animazioni
  S={
    year:2026, annoInizio:2026, month:1, mandate:1, turnInMandate:0, mandatesWon:0, rp:3, diff:chosenDiff, partito:chosenPartito, lingua:(typeof chosenLang!=='undefined'?chosenLang:'it'),   // lingua = dato puro (it/en); annoInizio = anno d'avvio

    ind:{growth:0.8, debt:135, unemp:7.8, deficit:3.0, sanita:62, sicurezza:58, ambiente:50, consenso:50, fiducia:75, reputazione:60, stampa:55},
    groups:Object.assign({},GSTART),
    pol:{fisco:1,pensioni:1,sanita:1,investimenti:1,istruzione:1,lavoro:1,welfare:1,imprese:1,sicurezza:1,ambiente:1,immigrazione:1,difesa:1,linea_estera:1,cooperazione:1,commercio:1,industria_difesa:1,territorio:1,personale_san:1,universita:1,diritto_studio:1,trasporti:1,manutenzione:1},
    ministers:[], snap:null, gMod:0, uMod:0, lastEvent:null, recentDoss:[], recentEvent:[], recentInt:[], recentProp:[], recentBudget:[], recentScandalo:[], recentConflitto:[], pendingRimpasto:[], fidLivello:0, fidUltimo:{}, mesiSottoCrisi:0, opposizione:false, governoAvversario:null, recentOpp:[], mesiAlGoverno:0, ciclo:0, ministeroAperto:null, potereLocale:null, bloccoAtteso:null, campagnaMod:0, campagnaFaccia:false, territori:null, confUltimo:null, lastConfQ:null, puntoUltimo:null, recentPunto:[], ultimaLegge:null, titoloMese:null, lastTitolo:null, mossaUltima:null, promessa:null, correnti:null, sfida:null, mossaPartito:null, primariaUltima:null, esposizione:12, inchiesta:null, inchiestaUltima:null, inchiestaRoll:null, archi:[], archiRoll:null, archiUltimoStart:null, recentArchi:[], archiCooldown:{}, famiglia:null, integrita:90, convalescenza:null, recentPers:[], persUltimo:null,
    livello:3, premier:null, dicastero:null, capitale:0, premMossaUltimo:null, ministroUltimo:null, recentMinistro:[], silAvviso:null, premCrisiMesi:0, occUltima:null, mesiAltoCap:0,   // livello d'avvio (3=capo del governo, 2=ministro sotto premier-AI)
    relInt:{},   // relazioni internazionali per-ente (lotto internazionale fase A): standing 0-100, seed = reputazione iniziale
    recentTit:[], recentPot:[], recentConflInt:[], diplo:null, recentDiplo:[],   // paesi reali (Fetta A/B) + percorso diplomatico (C2): diplo = stato del diplomatico, recentDiplo = finestra missioni
    log:[], prev:null, tab:'gov', agenda:[],
  };
  S.snap=Object.assign({},S.pol);
  S.paese=chosenCountry;   // chiave del paese (per leggi: filtro per paese + stato iniziale)
  /* Build B — era: dato PURO (null=presente). Filtra i pool era-gated via eraViva(). Sopravvive allo snapshot come gli altri campi. */
  var _SC=(typeof SCENARI!=='undefined') ? SCENARI[chosenScenario] : null;
  S.era = (_SC && _SC.era) || null;
  S.scenario = chosenScenario || 'presente';   // L30-1 - dato puro: PIU scenari possono stare sulla stessa linea (il '50 e il '70), quindi l era non basta piu a ritrovarli
  /* Build B — anno d'avvio dallo scenario: l'orologio parte dall'epoca (year + annoInizio), non dal presente.
     Fondamentale quanto i partiti: l'immersione (la data dice il '50) e gli snodi ancorati a un anno reale
     (la legge truffa si ancora al '53 → se l'orologio partisse dal 2026, il '53 non arriverebbe mai). */
  if(_SC && _SC.anno){ S.year=_SC.anno; S.annoInizio=_SC.anno; }
  /* Build B 1b — anni di mandato già trascorsi (l'orologio-mandato parte a metà, non da zero): fa cadere
     l'elezione naturale sull'anno dello snodo. Percorso d'ingresso diverso dal reset turnInMandate=0 di A.5
     (quello è diventaLocale/rielezione; qui è l'avvio-governo → startGame non lo ritocca). */
  if(_SC && _SC.turnMandato!=null){ S.turnInMandate=_SC.turnMandato; }
  S.leggeTruffa=null;   // Build B (b) — scelta di governo sul premio: null=non decisa · 'approvata' · 'respinta' (dato puro, round-trip)
  /* SEED ECONOMICO per-paese (cantiere Budget): PIL (nuovo stato puro, € mld) + debito/PIL + base-disavanzo dalle cifre
     2024 riconciliate (CIFRE-ECONOMICHE.md); fallback ai valori storici se il paese non ha ancora il blocco (atomicità). */
  /* Build B — se è attivo uno scenario d'epoca, il suo seed economico (approssimato) VINCE sul presente del paese. */
  var _EC=(typeof SCENARI!=='undefined' && SCENARI[chosenScenario] && SCENARI[chosenScenario].economia) ? SCENARI[chosenScenario].economia
        : (typeof PAESI!=='undefined' && PAESI[chosenCountry] && PAESI[chosenCountry].economia) ? PAESI[chosenCountry].economia : null;
  S.pil = _EC ? _EC.pil : 2150;                        // PIL nominale, € mld
  S.deficitBase = _EC ? -_EC.deficit : 3.0;            // provvisorio; gioco: positivo=disavanzo (il blocco ha il segno reale, negativo=deficit)
  S.deficitTarget = _EC ? -_EC.deficit : null;         // il disavanzo REALE di partenza (cifra 2024); la base viene CALIBRATA sotto per centrarlo
  if(_EC) S.ind.debt = _EC.debito;                     // debito/PIL iniziale per-paese (sostituisce il 135 fisso)
  /* Fix cifre d'epoca (dati PURI, round-trip): la valuta (null=euro) e la quota di spesa pubblica per il DISPLAY. */
  S.valuta = (_SC && _SC.valuta) || null;              // es. lira nel '50; null = € (presente identico)
  S.quotaSpesa = (_SC && _SC.quotaSpesa!=null) ? _SC.quotaSpesa : 0.48;   // spesa/PIL mostrata (display-only); default oggi 48%
  /* Cantiere B — difficoltà d'epoca (dati PURI, round-trip). debtAncora: l'àncora fiscale di fiducia/interessi,
     RELATIVA al seed dell'epoca (default 135 = presente identico per costruzione). Va impostata PRIMA della
     calibrazione del deficit qui sotto (computeDeficit la legge). logorioEra: rate del logorio da incumbency
     per-scenario (null = default presente 0.002 in evolvePartiti). */
  S.debtAncora = (_SC && _SC.debtAncora!=null) ? _SC.debtAncora : 135;
  S.logorioEra = (_SC && _SC.logorioEra!=null) ? _SC.logorioEra : null;
  S.sfideUltimo = S.year*12 + S.month;   // D1a — sfide (quiz): la prima non prima di ~5 mesi dall'avvio (dato puro, round-trip)
  S.campNaz=null; S.campNazUltimo=null; S.promesseCampagna=[];   // Cantiere C — campagna nazionale (dati puri, round-trip)
  S.riallineamenti={};   // AVANZAMENTO — registro one-shot delle tappe-partiti già scattate (dato puro, round-trip; separato da truffaFatta)
  S.pilastri70={};             // L28-4 — pilastri-cronaca gia' usciti (one-shot, dato puro)
  S.rosterDelta={entra:[], esce:[], rinomina:[]};   // L34-1 - il registro delle nascite/morti/rinomine: e LUI la verita, PAESE ne e la proiezione
  S.divorzioBdi=null; S.scalaMobile=null; S.nucleare=null;   // L33-1 - snodi '80 (dati puri, round-trip)
  S.austerity=null; S.divorzio=null; S.solidarieta=null;   // L28-3 — snodi '70 (dati puri, round-trip): null = non ancora decisi
  S.apertura=null; S.aperturaEsito=null; S.enel=null;   // AVANZAMENTO Lotto 4 — snodi '60 (gemelli di leggeTruffa): apertura a sinistra + dilemma-Enel (dati puri, round-trip)
  S.richiamoCorrUltimo=null;   // CURA Lotto P3 — cooldown della carta-richiamo correnti (dato puro, round-trip)
  S.leggeroUltimo=null;        // G4 — cooldown del beat leggero (dato puro, round-trip)
  S.retroUltimo=null;          // L14-1 — cooldown del beat-retroscena (dato puro, round-trip)
  S.intese={};                 // L25-1 — il tavolo delle alleanze: {idPartito: 0-100}, dato puro e piatto
  S.tavoloPid=null;            // L25-1 — il partito con cui è aperto il tavolo (lo scrive filo() dell'arco `tavolo`)
  S.famOppUltimo=null;         // L25-2/L25-3 — mese dell'ultima carta di famiglia (media O base): il pavimento è UNO per tutte
  S.telUltimo=null;            // F1 — cooldown della telefonata (dato puro, round-trip); il TIMER vive in TEL, mai in S
  S.telPendente=null;          // F1 — id della telefonata senza risposta: al reload il telefono richiama
  S.scandaloUltimo=null;       // G3 — cooldown-famiglia degli archi-scandalo (~36m; stampato dal filo() alla nascita)
  S.famigliaVivaUltimo=null;   // G1 — cooldown dei giorni buoni / scelte di tempo (dato puro, round-trip)
  S.famigliaVivaFatti=[];      // G1 — once-in-vita già vissuti (matrimonio del figlio…)
  S.recentFamigliaViva=[];     // G1 — finestra anti-ripetizione dei beat ripetibili (domenica, compleanno…)
  S.territorioChiama=null;     // F2 — il territorio che chiama {idx,prob,nato} (dato puro, round-trip); il pulse è derivato
  S.territorioUltimo=null;     // F2 — cooldown dell'innesco-territorio
  S.territorioRecente=null;    // F2 — ultima area chiamata (anti-ripetizione)
  S.intervistaUltimo=null;     // F5 — cooldown dell'intervista incalzante (dato puro; la catena vive in INTERVISTA transitorio)
  S.recentSfide=[];            // Q-fix #2 — finestra «viste di recente» condivisa fra Sfida singola e intervista (anti-ripetizione)
  S.leggi={}; for(const L of LEGGI){ if(!L.paesi || L.paesi.indexOf(chosenCountry)>-1) S.leggi[L.id]= eraVivaT(L) && !!(L.iniziale&&L.iniziale[chosenCountry]); }   // Build B: gate-seed — una legge era-esclusa (es. reddito_citt iniziale:italia) NON parte attiva nel '50
  S.leggiSnap=Object.assign({},S.leggi);
  applicaPersonaggio();    // chi sei: S.personaggio/S.eta + crediti d'esordio sui gruppi (PRIMA del consenso, che li legge)
  S.ind.consenso=computeConsenso();
  S.ind.deficit=computeDeficit();
  S.ind.fiducia=targetFiducia();   // parte dal valore "vero" dato dai conti iniziali (~78)
  if(S.deficitTarget!=null){   // CALIBRAZIONE (cantiere Budget): il disavanzo di PARTENZA = cifra reale 2024 (non 3,4+interessi); poi il motore lo evolve
    S.deficitBase=0; const _k=computeDeficit();   // isola il contributo del motore (interessi sul debito alto + leggi iniziali), a fiducia corrente
    S.deficitBase=Math.round((S.deficitTarget-_k)*100)/100;   // base "primaria": base + motore = cifra reale
    S.ind.deficit=computeDeficit(); S.ind.fiducia=targetFiducia();   // riparte ESATTO sulla cifra reale, fiducia coerente
  }
  initRelInt();                    // relazioni internazionali (fase A): seed dallo standing iniziale (= reputazione corrente)
  S.prev={growth:S.ind.growth,debt:S.ind.debt,unemp:S.ind.unemp,consenso:S.ind.consenso};
  /* forze dei partiti: copia dai dati puliti (PAESI, mai mutato); da qui evolvono in S */
  S.forze=Object.fromEntries(PAESE.partiti.map(p=>[p.id,p.forza]));
  S.forzePrev=Object.assign({},S.forze);
  S.pesoUE=pesoUEBase();   // peso del tuo gruppo a Bruxelles (solo ue:true, altrove null); si aggiorna alle europee
  initCorrenti();          // le tre correnti interne del partito (lotto primarie)
  S.biografia=bioVuota();  // la memoria della carriera (sistema narrativo, lotto 1)
}

/* --- Nuova partita (al GOVERNO) --- */
function startGame(mins){
  initStatoBase();
  S.ministers=mins;
  /* coalizione di governo (passo 3): il tuo partito è sempre incluso; i seggi esistono dove c'è un parlamento */
  S.coalizione=[chosenPartito];
  S.seggi=(PAESE.coalizione||PAESE.comeSiVince==='parlamentare')?calcSeggi():null;
  /* minoranza all'avvio: nei parlamentari SENZA coalizione (UK) riflette i seggi veri del tuo partito (chi parte
     piccolo governa in minoranza); nei paesi a coalizione la decide la trattativa iniziale; negli USA non esiste. */
  S.minoranza=(!PAESE.coalizione && PAESE.comeSiVince==='parlamentare') ? S.seggi[chosenPartito]<50 : false;
  S.tenuta={}; S.tenutaForza0={}; S.tenutaLiv={}; S.tenutaUltimo={}; S.mesiMinoranza=0;
  initTerritori(); initPotereLocale();   // territori (eletti assegnati per lean) + potere locale derivato; per i paesi a coalizione l'aspettativa è ri-fissata in confirmCoal
  if((S.potereLocale||0)>50) S.rp++;     // gennaio d'avvio: +1 se controlli il territorio (come il vecchio sistema)
  S.log=[{t:T('Insediamento'),x:T('Il nuovo governo ha giurato (difficoltà: %D). Si parte da gennaio: vara la legge di bilancio.').replace('%D',T(S.diff))}];
  bioFatto((bgNome()?T(bgNome())+', '+T('giura come'):T('Giura come'))+' '+T(PAESE.titoloRuolo)+'.');   // il background apre la biografia ("Sindacalista, giura come...")
  document.getElementById('appoint').style.display='none';
  document.getElementById('over').style.display='none';
  document.getElementById('game').style.display='block';
  genAgenda(true);
  generaTitolo();   // la prima pagina del primo mese
  render();
  /* paesi a coalizione: se il tuo partito da solo non ha 50 seggi, forma subito la coalizione iniziale
     (chiude l'incongruenza del piccolo partito che governa da solo). All'avvio non si fallisce: al peggio minoranza. */
  if(PAESE.coalizione && S.seggi[chosenPartito]<50) openTrattativa('avvio');
  else commitSnap();   // solo / già-maggioranza: primo confine di mese qui (i paesi a coalizione lo fanno in confirmCoal)
}

/* --- Nuova partita (all'OPPOSIZIONE) — antipasto del sistema a livelli di carriera ---
   Parti da sfidante: niente nomina ministri (si salta goAppoint); il governo va al partito più forte ≠ tuo, col suo
   blocco e il suo profilo-politiche. Compone lo stato base + lo stato d'opposizione senza passare da una sconfitta.
   Da qui il loop d'opposizione completo (carta mensile, eventi del governo AI, sondaggi a fine mandato, intermedie). */
function startOpposizione(){
  initStatoBase();
  S.seggi=(PAESE.coalizione||PAESE.comeSiVince==='parlamentare')?calcSeggi():null;   // serve a entraOpposizione e alla scheda Partiti
  const w=vincitore();                   // partito più forte ≠ tuo, dalle forze iniziali
  entraOpposizione(w);                   // governo all'avversario col suo profilo; tu sfidante (visibilità/credibilità standard)
  initTerritori(); initPotereLocale();   // territori per lean + potere locale del TUO blocco d'opposizione (bloccoIds = opp)
  S.mandate=0;                           // non hai ancora vinto un mandato: la prima vittoria sarà "Mandato 1"
  S.log=[{t:T('All\'opposizione'), x:T('Parti da sfidante: al governo c\'è %W. Costruisci consenso e riprenditi il paese alle prossime elezioni.').replace('%W',w.nome)}];
  bioFatto((bgNome()?bgNome()+', e':'E')+'sordisce da sfidante: la scalata comincia dall\'opposizione.');   // "Sindacalista, esordisce da sfidante..."
  document.getElementById('appoint').style.display='none';
  document.getElementById('over').style.display='none';
  document.getElementById('start').style.display='none';
  document.getElementById('ov').classList.remove('on');
  document.getElementById('game').style.display='block';
  genAgenda(false); render(); commitSnap();   // loop d'opposizione + primo confine di mese (mese 1)
}

/* ============================================================
   IL LIVELLO 2 — MINISTRO sotto un premier-AI (lotto ascesa). Riusa il modello del governo-AI
   dell'opposizione: il premier (leader del TUO partito) governa la nazione (S.pol = GOVERNI_PROFILI
   del suo asse) e il motore fa girare gli indicatori; tu controlli UN dicastero e costruisci
   S.capitale (la credenziale per il vertice). Quando il capitale è alto e si apre un'occasione →
   la salita → diventaPremier() = transizione FLUIDA al livello 3, ZERO reset del narrativo.
   ============================================================ */
function profByAsse(asse){ return asse>=1?'destra':(asse<=-1?'sinistra':'centro'); }
function generaPremier(){ const p=part(S.partito)||{}; return { nome:nomePersona(), partito:S.partito, asse:(p.asse||0), lealta:60 }; }
/* D3 asse-3 — era giocata (S se in partita, altrimenti lo scenario scelto nel setup: CREA vive prima di S). */
function eraGiocata(){
  if(typeof S!=='undefined' && S) return S.era||'contemporanea';
  if(typeof chosenScenario!=='undefined' && typeof SCENARI!=='undefined' && SCENARI[chosenScenario]) return SCENARI[chosenScenario].era||'contemporanea';
  return 'contemporanea';
}
/* L39-1 — I FATTI DATATI. Una carta che racconta un fatto al presente («gli studenti occupano», «il mondo
   guarda i primi passi sulla Luna») è viva solo finché quel fatto è cronaca. Due condizioni, e servono
   entrambe — con la sola prima la misura non passa:
     1. FINESTRA CHIUSA: dall'anno del fatto a `anno+durata` (di regola 2 anni: il Muro nel '62 è vivo, nel
        '71 è assurdo). Prima le sei carte avevano solo `>=anno` e restavano vive per tutto il decennio.
     2. MAI PRIMA DELL'INIZIO PARTITA: un fatto già accaduto quando la carriera comincia non è cronaca, è
        storia. È **lo stesso principio di L34-3** sui pilastri, che L36-2 aveva diagnosticato non coprire
        questo sistema (quelli sono `PILASTRI_LINEA`, queste sono normali `EVENTS`). Senza questa riga chi
        apre la porta del 1970 riceve l'autunno caldo nell'agosto 1970 — mentre il suo stesso briefing
        d'avvio lo dà per avvenuto.
   NON si applica ai FENOMENI (la migrazione verso Nord, il boom, la TV che entra nelle case): quelli sono
   processi che durano, e per loro `>=anno` senza tetto è giusto.
   IL MESE conta: misurando, «L'uomo sulla Luna» usciva nel **gennaio 1969** — sei mesi prima dello sbarco,
   perché il confronto era solo sull'anno. Chi ha una data precisa la dichiara; chi è una stagione (il '68)
   lascia il mese a 1. */
function fattoDatato(anno, durata, mese){
  if(typeof S==='undefined' || !S) return false;
  var m0=(mese==null?1:mese), da=anno*12+m0, fino=(anno+(durata==null?2:durata))*12+m0, ora=S.year*12+(S.month||1);
  if(da < ((S.annoInizio||S.year||anno)*12+1)) return false;     // già successo prima che tu cominciassi
  return ora>=da && ora<=fino;
}
/* L37-1 — ANNO giocato: il gemello di eraGiocata() per tutto ciò che ora si decide sul DECENNIO e non più
   sullo scenario (pool-ritratti, quota-genere). Serve perché la NOMINA DEL GOVERNO avviene prima che `S`
   esista: `goAppoint`/`confirmCabinet` girano nel setup, e senza questa funzione il gabinetto d'avvio di
   una partita del 1980 nasceva con le facce e la quota-genere del presente — e `rit` congelava lo sbaglio
   per tutta la carriera. Trovato a schermo, non in un walk: headless la nomina non passa da quella strada. */
function annoGiocato(){
  if(typeof S!=='undefined' && S && S.year) return S.year;
  if(typeof chosenScenario!=='undefined' && typeof SCENARI!=='undefined' && SCENARI[chosenScenario]) return SCENARI[chosenScenario].anno||0;
  return 0;
}
/* nome a schermo del dicastero `id`, era-aware (overlay '50 → PRESET §5a; presente → MINISTRIES). Ritorna la
   stringa IT: il chiamante fa T() come già fa con M.nm. */
function dicNm(id){
  if(eraGiocata()==='italia1950' && typeof MINISTRI_50!=='undefined' && MINISTRI_50[id]) return MINISTRI_50[id].nm;
  const M=(typeof MINISTRIES!=='undefined') && MINISTRIES.find(function(x){return x.id===id;});
  return (M&&M.nm)||'';
}
function ruoloDicastero(){
  const id=S.dicastero;
  if(eraGiocata()==='italia1950' && typeof MINISTRI_50!=='undefined' && MINISTRI_50[id]){
    const o=MINISTRI_50[id];
    const capo = o.capo ? gn(o.capo,o.capoF||o.capo) : gn('Ministro','Ministra');   // Salute '50 → «Alto Commissario/a», gli altri → «Ministro/a»
    return capo+' '+T(o.di);
  }
  const gen={economia:'dell\'Economia', interno:'dell\'Interno', giustizia:'della Giustizia', esteri:'degli Esteri', difesa:'della Difesa', lavoro:'del Lavoro', salute:'della Salute', istruzione:'dell\'Istruzione', sviluppo:'dello Sviluppo', infrastrutture:'delle Infrastrutture'};
  return gn('Ministro','Ministra')+' '+T(gen[S.dicastero]||'');
}
/* --- Nuova partita (da MINISTRO) --- */
function startMinistro(){
  initStatoBase();                                  // S.livello=2, S.dicastero impostati in applicaPersonaggio
  S.premier=generaPremier();
  S.pol=Object.assign({}, GOVERNI_PROFILI[profByAsse(S.premier.asse)]);   // la politica nazionale è del premier (tranne il tuo dicastero, che muovi tu)
  S.snap=Object.assign({},S.pol);
  S.capitale=30; S.visibilita=40; S.credibilita=50;
  S.prevSettore=(DICASTERO_IND[S.dicastero]?S.ind[DICASTERO_IND[S.dicastero][0]]:null);   // baseline per la crescita del capitale
  S.ministers=[];                                   // da ministro non nomini un gabinetto (lo fa il premier)
  S.coalizione=[S.partito]; S.seggi=(PAESE.coalizione||PAESE.comeSiVince==='parlamentare')?calcSeggi():null;
  S.minoranza=false; S.tenuta={}; S.tenutaForza0={}; S.tenutaLiv={}; S.tenutaUltimo={}; S.mesiMinoranza=0;
  initTerritori(); initPotereLocale();
  S.ind.consenso=computeConsenso(); S.ind.deficit=computeDeficit(); S.ind.fiducia=targetFiducia();
  S.log=[{t:T('Al governo, da ministro'), x:T('Entri nel governo di %P come %R. Costruisci il tuo capitale: il vertice si conquista.').replace('%P',S.premier.nome).replace('%R',T(ruoloDicastero()))}];
  bioFatto((bgNome()?bgNome()+', e':'E')+'ntra nel governo come '+ruoloDicastero()+'.');
  document.getElementById('appoint').style.display='none';
  document.getElementById('over').style.display='none';
  document.getElementById('start').style.display='none';
  document.getElementById('ov').classList.remove('on');
  document.getElementById('game').style.display='block';
  genAgenda(false); generaTitolo(); render(); commitSnap();
}
/* il capitale politico cresce coi RISULTATI del tuo dicastero (l'indicatore-chiave migliora) e con le correnti
   che ti notano. È la credenziale per il vertice — e la sua crescita GARANTISCE che una via su esista sempre. */
const DICASTERO_IND={ economia:['fiducia',1], lavoro:['unemp',-1], salute:['sanita',1], interno:['sicurezza',1], sviluppo:['ambiente',1], difesa:['sicurezza',1], giustizia:['reputazione',1], esteri:['reputazione',1], istruzione:['consenso',1], infrastrutture:['growth',1] };
/* helper delle CARTE DEL MINISTRO (lotto contenuto, fase 1): muovono i sistemi della salita. */
function capd(n){ if(S&&S.capitale!=null) S.capitale=clamp(S.capitale+n,0,100); }
function leald(n){ if(S&&S.premier&&S.premier.lealta!=null) S.premier.lealta=clamp(S.premier.lealta+n,0,100); }
function visd(n){ if(S&&S.visibilita!=null) S.visibilita=clamp(S.visibilita+n,0,100); }
/* ===== L26-1 — IL SOFT-CAP DELLA CREDIBILITÀ (rendimenti decrescenti) =====
   Misurato in L25-2: la condotta «sempre composta» portava la credibilità a 100 e valeva ~4 punti di voto in
   più di quella aggressiva, in OGNI pool — perché accumularla non costava mai niente e `credBonus()` vale ±5.
   Decisione di design (Cowork, L26-1): non si tocca `credBonus`, si tocca l'ACCUMULO. Sopra 70 i guadagni
   valgono metà, sopra 85 un quarto; **le perdite restano piene** (la credibilità si perde intera, come nella
   realtà). Così arrivare a 70 resta un percorso, ma da lì in su conviene SPENDERLA invece che accumularla.

   L'attenuazione è a SEGMENTI, non decisa dal punto di partenza: un guadagno grosso che parte da 68 paga
   pieno fino a 70, metà da 70 a 85 e un quarto oltre. Altrimenti un solo colpo grande scavalcherebbe il cap.
   PUNTO DI PASSAGGIO UNICO: `credd` e `applyOppEffect` passano entrambi di qui — chi muove la credibilità non
   deve conoscere la regola (stesso schema del tetto-intese di L25-1 e di `euro()`). */
const CRED_SEGMENTI = [[70,1],[85,0.5],[100,0.25]];   // [tetto del segmento, quanto vale un punto guadagnato dentro]
function credMuovi(n){
  if(!(S&&S.credibilita!=null) || !n) return;
  if(n<0){ S.credibilita=clamp(S.credibilita+n,0,100); return; }   // le PERDITE non si attutiscono mai
  let cur=S.credibilita, resto=n;
  for(let i=0;i<CRED_SEGMENTI.length && resto>0;i++){
    const tetto=CRED_SEGMENTI[i][0], f=CRED_SEGMENTI[i][1];
    if(cur>=tetto) continue;
    const costo=(tetto-cur)/f;                                     // punti GREZZI necessari ad attraversare il segmento
    if(resto>=costo){ cur=tetto; resto-=costo; } else { cur+=resto*f; resto=0; }
  }
  S.credibilita=clamp(cur,0,100);
}
/* L13-1 — gemella guardata di visd: muove la CREDIBILITÀ solo dove esiste (opposizione/ministro/locale). A L3-premier
   `S.credibilita` è undefined → no-op sicuro, e soprattutto NON crea il campo (un `(S.credibilita||0)+n` lo creerebbe). */
function credd(n){ credMuovi(n); }
function dicNome(){ const n=(typeof dicNm==='function')&&dicNm(S.dicastero); return (n&&T(n))||T('il tuo dicastero'); }
/* D4-coda (da D3) — preposizioni ARTICOLATE per-dicastero, per-era: «all'Alto Commissariato», «al Tesoro», «della Salute».
   In EN non si articola (la preposizione sta nel template) → si sostituisce il nome nudo. Copre i template grane con %DICA/%DICDI. */
function dicArt(id){
  if(typeof eraGiocata==='function' && eraGiocata()==='italia1950' && typeof MINISTRI_50!=='undefined' && MINISTRI_50[id] && MINISTRI_50[id].art) return MINISTRI_50[id].art;
  return ({economia:"l'",interno:"l'",giustizia:'la',esteri:'gli',difesa:'la',lavoro:'il',salute:'la',istruzione:"l'",sviluppo:'lo',infrastrutture:'le'})[id]||'il';
}
function prepDic(prep, id){
  var art=dicArt(id), nm=dicNm(id);
  var TAB={"il":{a:'al ',di:'del '},"lo":{a:'allo ',di:'dello '},"la":{a:'alla ',di:'della '},"l'":{a:"all'",di:"dell'"},"i":{a:'ai ',di:'dei '},"gli":{a:'agli ',di:'degli '},"le":{a:'alle ',di:'delle '}};
  var m=TAB[art]||TAB["il"];
  return (m[prep]||'')+nm;
}
function dicPrepA(){ if(typeof curLang==='function'&&curLang()==='en') return T(dicNm(S.dicastero)); return prepDic('a',S.dicastero); }    // «a %DIC» → all'/al/alla…
function dicPrepDi(){ if(typeof curLang==='function'&&curLang()==='en') return T(dicNm(S.dicastero)); return prepDic('di',S.dicastero); }  // «di %DIC» → dell'/del/della…
function dicMigliora(n){ const m=DICASTERO_IND[S.dicastero]; if(!m) return; const k=m[0]; const lo=(k==='growth')?-6:0, hi=(k==='unemp')?30:(k==='growth')?5:100; if(S.ind[k]!=null) S.ind[k]=clamp(S.ind[k]+n*m[1], lo, hi); }
function subMin(s){ return (s||'')
  .replace(/%DICDI/g, (typeof dicPrepDi==='function'?dicPrepDi():dicNome()))   // «di %DIC» articolato (D4-coda) — PRIMA di %DIC
  .replace(/%DICA/g, (typeof dicPrepA==='function'?dicPrepA():dicNome()))       // «a %DIC» articolato
  .replace(/%DIC/g, dicNome())
  .replace(/%PREMIER/g, (S.premier||{}).nome||T('il premier')); }
function capitaleCresci(){
  const cm=(dif().capitaleMult!=null)?dif().capitaleMult:1;   // la salita è più lenta a difficile, più rapida a facile
  if(S.livello===1){   // da locale: la notorietà cresce amministrando bene — LENTA: si sale vincendo, non accumulando
    const L=S.locale; if(!L) return;
    if(L.consenso>52) S.capitale=clamp(S.capitale+(L.consenso>68?0.6:0.4)*cm,0,100);
    if(S.prevSettore!=null && L.consenso-S.prevSettore>0.5) S.capitale=clamp(S.capitale+0.25*cm,0,100);
    S.prevSettore=L.consenso;
    S.mesiAltoCap=(S.capitale>=65)?(S.mesiAltoCap||0)+1:0;
    return;
  }
  if(S.livello!==2) return;
  const m=DICASTERO_IND[S.dicastero];
  if(m){ const cur=S.ind[m[0]]; if(S.prevSettore!=null){ const delta=(cur-S.prevSettore)*m[1]; if(delta>0.3) S.capitale=clamp(S.capitale+0.4*cm,0,100); } S.prevSettore=cur; }
  if(typeof umoreMedio==='function' && umoreMedio()>60) S.capitale=clamp(S.capitale+0.2*cm,0,100);   // le correnti ti notano
  S.mesiAltoCap = (S.capitale>=65) ? (S.mesiAltoCap||0)+1 : 0;
}
function premMossaDovuta(){ const mese=S.year*12+S.month; return S.premMossaUltimo==null || mese-S.premMossaUltimo>=3; }   // (legacy, non più usata: rimpiazzata da ministroDovuto)
function premierMossaCard(){ return { kind:'premier', resolved:false }; }                                                  // (legacy)
/* la CARTA DEL MINISTRO (pool dedicato vario: politica interna + grane di settore) a cadenza ~4-5 mesi —
   la binaria asseconda/distinguiti è ora UNA carta tra le ~19, non più il piatto fisso ogni 3 mesi. */
function ministroDovuto(){ const mese=S.year*12+S.month; return S.ministroUltimo==null || (mese-S.ministroUltimo)>=4; }
/* SACCHETTO-SHUFFLE (anti-ripetizione, lotto 0): estrazione-senza-rimpiazzo per-chiave. `candidati` e la lista GIA
   filtrata (tipo/cond/dicastero...) dalla pick-fn; l'helper non conosce i filtri. Ogni carta valida esce UNA volta
   prima che una qualsiasi torni; svuotato il sacchetto, si rimescola. Rispetta i filtri dinamici (chiavi separate:
   loc|citta != loc|regione) e i pool piccoli (li cicla). S.bag serializza nel salvataggio (lazy-init, retrocompat). */
function mescola(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)), t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function pescaBag(chiave, candidati){
  if(!candidati || !candidati.length) return null;
  S.bag=S.bag||{}; S.bagCoda=S.bagCoda||{};
  var validi={}; candidati.forEach(function(c){ validi[c.id]=c; });
  var K=Math.min(2, Math.floor(candidati.length/3));   // hold-back: pool<6 -> K=0 (niente sui piccolissimi)
  var sacco=S.bag[chiave];
  if(!sacco || !sacco.length){
    sacco=mescola(candidati.map(function(c){return c.id;}));
    var coda=S.bagCoda[chiave]||[];   // gli ultimi K del ciclo precedente vanno in FONDO -> niente ripetizione a cavallo di due cicli
    if(K>0 && coda.length) sacco=sacco.filter(function(id){return coda.indexOf(id)<0;}).concat(sacco.filter(function(id){return coda.indexOf(id)>=0;}));
  }
  var scelto=null;
  while(sacco.length){ var id=sacco.shift(); if(validi[id]){ scelto=id; break; } }   // salta gli id usciti dal set valido (cond cambiata)
  if(scelto===null){ sacco=mescola(candidati.map(function(c){return c.id;})); scelto=sacco.shift(); }   // sacco tutto invalido -> ricarica
  S.bag[chiave]=sacco;
  if(K>0){ var q=S.bagCoda[chiave]||[]; q.push(scelto); while(q.length>K) q.shift(); S.bagCoda[chiave]=q; }
  return validi[scelto];
}
function pickMinistro(){
  if(typeof MINISTRO_CARTE==='undefined') return null;
  let pool=MINISTRO_CARTE.filter(function(c){ return (!c.dic||c.dic===S.dicastero) && (!c.cond||c.cond()) && eraViva(c); });
  const q=pescaBag('minc|'+S.dicastero, pool); if(!q) return null;
  S.ministroUltimo=S.year*12+S.month;
  return { kind:'ministro', data:q, resolved:false };
}
/* dossier del TUO settore (filtro min===dicastero): le tue decisioni contano davvero, muovono il tuo dominio. */
function pickDossierSettore(){
  let avail=DOSSIERS.filter(function(d){ return d.min===S.dicastero && (!d.cond||d.cond()) && eraViva(d); });
  const d=pescaBag('doss|'+S.dicastero, avail); if(!d) return null;
  return { kind:'dossier', data:d, resolved:false };
}
/* L'OCCASIONE (la salita): meriti + fiuto. Successione (premier caduto + sei pronto), candidatura offerta
   (capitale molto alto — la GARANZIA che una via su arriva sempre), primaria (capitale alto + correnti).
   Né subito né mai: cooldown 6 mesi, e a capitale alto a lungo la candidatura diventa certa. */
function pickOccasione(){
  const mese=S.year*12+S.month;
  if(S.livello===5){   // C2 — la salita diplomatica: Ambasciatore→Alto rappresentante (gated sul CREDITO), poi →Segretario (consesso≥75, stesso gate del politico)
    if(!S.diplo) return null;
    if(S.occUltima!=null && mese-S.occUltima<6) return null;
    if(S.diplo.grado===1){
      if(S.diplo.credito>=70 && (Math.random()<0.12 || (S.diplo.mesiAlto||0)>=24)){ S.occUltima=mese; return { kind:'occasione', tipo:'altoRapp', resolved:false }; }
      return null;
    }
    if(S.relInt && S.relInt.consesso!=null && S.relInt.consesso>=75 && (Math.random()<0.12 || S.relInt.consesso>=88)){ S.occUltima=mese; return { kind:'occasione', tipo:'internazionale', resolved:false }; }
    return null;
  }
  if(S.livello===3){   // ATTO FINALE (fase C1a): la chiamata a guidare il Consesso — gated su standing ALTO (il payoff Fasi A/B)
    if(!(S.relInt && S.relInt.consesso!=null && S.relInt.consesso>=75)) return null;   // relInt è il gatekeeper
    if((S.mandatesWon||0) < 1) return null;                                            // un premier affermato
    if(S.occUltima!=null && mese-S.occUltima<6) return null;
    if(Math.random()<0.12 || S.relInt.consesso>=88){ S.occUltima=mese; return { kind:'occasione', tipo:'internazionale', resolved:false }; }   // garanzia a standing molto alto
    return null;
  }
  if(S.livello===1){   // da locale: la CHIAMATA a Roma. PROVA ELETTORALE OBBLIGATORIA: rieletto almeno una volta
    if(!(S.locale && S.locale.mandato>=2)) return null;                 // serve l'aver vinto e difeso il mandato locale
    if(S.occUltima!=null && mese-S.occUltima<6) return null;
    if(S.capitale>=70 && (Math.random()<0.10 || (S.mesiAltoCap||0)>=26)){ S.occUltima=mese; return { kind:'occasione', tipo:'chiamata', resolved:false }; }   // garanzia a mesiAltoCap≥26
    return null;
  }
  if(S.livello!==2) return null;
  if(S.occUltima!=null && mese-S.occUltima<6) return null;
  /* SOLO vie reali (niente più candidatura offerta a freddo): il premier cade (successione) o lo batti in primaria. */
  if(S.premCrisiMesi>=3 && S.capitale>=40){ S.occUltima=mese; return { kind:'occasione', tipo:'successione', resolved:false }; }
  if(S.capitale>=70){ S.occUltima=mese; return { kind:'occasione', tipo:'primaria', resolved:false }; }   // INNESCABILE costruendo capitale; l'umore delle correnti pesa sull'ESITO (resolveItem), non sull'innesco
  return null;
}
/* fine mandato da ministro: il premier (= il tuo partito) corre per la rielezione. Vince → continui ministro;
   perde → vai all'opposizione, da volto del partito (resti livello 2). */
function vinceIlGoverno(){ const w=vincitore(); return (S.forze[S.partito]||0) >= (S.forze[(w||{}).id]||0); }
function esitoElezioneMinistro(){
  maturaRP();
  if(vinceIlGoverno()){
    S.mandate++; S.turnInMandate=0; S.snap=Object.assign({},S.pol); S.leggiSnap=Object.assign({},S.leggi);
    if(PAESE.comeSiVince==='parlamentare'||PAESE.coalizione) S.seggi=calcSeggi();
    S.capitale=clamp(S.capitale+5,0,100); S.premCrisiMesi=0;
    bioFatto('Il governo di '+(S.premier?S.premier.nome:'partito')+' confermato alle urne.');
    S.log.unshift({t:T('Governo confermato'),x:T('%P vince le elezioni: resti ministro, il tuo capitale cresce.').replace('%P',(S.premier?S.premier.nome:T('Il premier')))});
    genAgenda(false); generaTitolo(); render(); commitSnap(); return;
  }
  S.premier=null;
  entraOpposizione(vincitore());
  S.bloccoAtteso=bloccoQuota();
  bioFatto(gn('Sconfitto','Sconfitta')+' alle urne col tuo governo: la traversata comincia da ex ministro.');
  S.log.unshift({t:'All\'opposizione',x:'Il tuo governo ha perso le elezioni: ne diventi il volto all\'opposizione.'});
  document.getElementById('ov').classList.remove('on');
  genAgenda(false); render(); commitSnap();
}
/* LA TRANSIZIONE 2→3 (l'aggancio critico): diventi capo del governo. Modellata su tornaAlGoverno → preserva
   TUTTO S (biografia, personaggio, età, famiglia, integrità, esposizione, correnti, tratti): è la promozione
   della STESSA persona, non una nuova partita. Cambiano solo: livello→3, premier→null, controllo nazionale pieno. */
function diventaPremier(viaElezione){
  const ruoloPrima=ruoloDicastero();
  S.livello=3; S.premier=null; S.dicastero=null; S.capitale=null; S.prevSettore=null; S.silAvviso=null; S.premCrisiMesi=0; S.occUltima=null; S.mesiAltoCap=0;
  S.opposizione=false; S.governoAvversario=null; S.mesiSottoCrisi=0; S.fidLivello=0; S.fidUltimo={};
  S.ministers=MINISTRIES.map(function(M){ const c=mkCand(); return { min:M.id, nm:c.nm, g:c.g, profile:c.profile, comp:c.comp, loyalty:62 }; });   // formi un governo (transizione fluida, niente schermata)
  if(typeof assegnaVoltiGruppo==='function') assegnaVoltiGruppo(S.ministers);   // L20-1: volti distinti nel gabinetto generato alla salita
  S.coalizione=[S.partito];
  S.seggi=(PAESE.coalizione||PAESE.comeSiVince==='parlamentare')?calcSeggi():null;
  S.minoranza = PAESE.coalizione ? seggiCoalizione(S.coalizione,S.seggi)<50 : (PAESE.comeSiVince==='parlamentare'?S.seggi[S.partito]<50:false);
  S.tenuta={}; S.tenutaForza0={}; S.tenutaLiv={}; S.tenutaUltimo={}; S.mesiMinoranza=0; initTenuta(); S.bloccoAtteso=bloccoQuota();
  if(viaElezione){ bioConta('elezioniVinte'); S.mandatesWon=(S.mandatesWon||0)+1; }
  S.mandate=S.mandate||1; S.turnInMandate=0; S.elezioniAnticipate=false; S.ultimoSondaggio=null; S.sondStorico=[];
  S.snap=Object.assign({},S.pol); S.leggiSnap=Object.assign({},S.leggi);
  bioFatto(T('Da %A a %B: la scalata è compiuta.').replace('%A',ruoloPrima).replace('%B',T(PAESE.titoloRuolo)));
  S.log.unshift({t:T('Al vertice'),x:T('Sei %R. Il paese è nelle tue mani.').replace('%R',T(PAESE.titoloRuolo))});
  if(typeof PROMO_FIORE!=='undefined') PROMO_FIORE=true;   // fioretto sul nuovo titolo
  document.getElementById('appoint').style.display='none';
  document.getElementById('over').style.display='none';
  document.getElementById('ov').classList.remove('on');
  document.getElementById('game').style.display='block';
  genAgenda(false); generaTitolo(); render(); commitSnap();
}

/* ============================================================
   IL LIVELLO 4 — SEGRETARIO GENERALE DEL CONSESSO (lotto internazionale, fase C1a). Oltre il vertice nazionale:
   non governi un paese, MEDI tra i blocchi (il triangolo relInt dall'alto). Due indicatori: COESIONE (l'unità
   dell'ente) e AUTOREVOLEZZA (la credibilità di mediatore — gate del compromesso). Transizione 3→4 (atto finale)
   modellata su diventaPremier: ZERO reset narrativo. ============================================================ */
function coesioneMuovi(n){ if(S.intl) S.intl.coesione=clamp(S.intl.coesione+n,0,100); }
function autorevMuovi(n){ if(S.intl) S.intl.autorevolezza=clamp(S.intl.autorevolezza+n,0,100); }
/* D4 asse-3 — apice della carriera internazionale, era+anno aware (overlay, chiave `consesso` invariata; PRESET §6a).
   Nel '50 l'Italia NON è all'ONU fino al 14/12/1955 → l'apice d'epoca è atlantico/europeo:
   ≥1955 le Nazioni Unite (il pilastro è scattato) · ≥1952 Segretario generale della NATO (carica reale dal marzo '52) ·
   prima → Segretario generale del Consiglio d'Europa (dal 1949). Presente identico. */
function ruoloIntl(){
  if(typeof eraGiocata==='function' && eraGiocata()==='italia1950'){
    var y=(typeof S!=='undefined'&&S&&S.year)||1950;
    if(y>=1955) return 'Segretario generale delle Nazioni Unite';
    if(y>=1952) return 'Segretario generale della NATO';
    return 'Segretario generale del Consiglio d\'Europa';
  }
  return 'Segretario generale delle Nazioni Unite';
}
/* etichette del nodo-multilaterale (`consesso`) per finestra: nel '50 pre-'55 sono i fori europei/atlantici. */
function consessoNome(){
  if(typeof eraGiocata==='function' && eraGiocata()==='italia1950' && (((typeof S!=='undefined'&&S&&S.year)||1950)<1955)) return 'i fori europei e atlantici';
  return 'le Nazioni Unite';
}
function consessoBreve(){
  if(typeof eraGiocata==='function' && eraGiocata()==='italia1950' && (((typeof S!=='undefined'&&S&&S.year)||1950)<1955)) return 'Fori europei';
  return 'ONU';
}
/* D4b — token %ONU nelle carte-crisi/missione (registro dell'ente che presiedi/frequenti): plurale femminile, così gli
   articoli attorno (le/delle/sulle…) restano. Presente/≥1955 = «Nazioni Unite»; '50 pre-'55 = «istituzioni comuni»
   (l'apice d'epoca è NATO/Consiglio d'Europa, non l'ONU). Lingua-aware; applicato DOPO T() nelle pick-fn. */
function onuTok(){
  var en=(typeof curLang==='function'&&curLang()==='en');
  if(typeof eraGiocata==='function' && eraGiocata()==='italia1950' && (((typeof S!=='undefined'&&S&&S.year)||1950)<1955)) return en?'common institutions':'istituzioni comuni';
  return en?'United Nations':'Nazioni Unite';
}
function entiSub(s){ return (s==null)?s:String(s).replace(/%ONU/g, onuTok()); }
function diventaInternazionale(ente){
  const ruoloPrima=PAESE.titoloRuolo;
  const consesso=(S.relInt&&S.relInt.consesso!=null)?S.relInt.consesso:60;
  S.livello=4;
  /* seeding: la coesione parte unita ma fragile; l'AUTOREVOLEZZA dallo standing col Consesso (il payoff Fasi A/B):
     arrivo marginale (consesso 75) → 55 (appena sotto il gate 57, recupera in fretta); alto (85→61, 100→70) → già sopra. */
  S.intl={ ente:ente||'consesso', coesione:58, autorevolezza:clamp(40+(consesso-50)*0.6,30,80), mandato:1, turnInMandate:0, mandatoMesi:60, recentCrisi:[], crisiUltimo:null, coesBassa:0 };
  /* azzera lo stato di ruolo NAZIONALE (non serve più); il NARRATIVO non si tocca (test cardine). */
  S.premier=null; S.dicastero=null; S.capitale=null; S.opposizione=false; S.governoAvversario=null;
  S.ministers=[]; S.coalizione=[S.partito]; S.pendingRimpasto=[]; S.minoranza=false; S.mesiSottoCrisi=0; S.occUltima=null;
  S.ministeroAperto=null; S.tab='gov';   // atterra sulla home del Segretario (niente drill-down residui)
  S.diplo=null;   // C2: se sei arrivato dal percorso diplomatico, lo chiude (ora sei Segretario)
  bioFatto('Da '+ruoloPrima+' a '+ruoloIntl()+': oltre il vertice nazionale, al servizio del mondo.');
  S.log.unshift({t:T('Al vertice del mondo'), x:T('Sei %R. Non governi un paese: medi tra le potenze.').replace('%R',T(ruoloIntl()))});
  if(typeof PROMO_FIORE!=='undefined') PROMO_FIORE=true;
  document.getElementById('appoint').style.display='none';
  document.getElementById('over').style.display='none';
  document.getElementById('ov').classList.remove('on');
  document.getElementById('start').style.display='none';
  document.getElementById('game').style.display='block';
  genAgenda(false); render(); commitSnap();
}
/* ============================================================
   C2 — PERCORSO DIPLOMATICO (livello 5): scala parallela Ambasciatore (grado 1) → Alto rappresentante (grado 2) →
   Segretario (livello 4, già fatto). Si sale per STANDING: credito alto → promozione; relInt.consesso≥75 → la chiamata.
   Nazionale dormiente; il narrativo (bio/personaggio/età/famiglia/tratti) ti segue, come le altre transizioni. */
function creditoMuovi(n){ if(S.diplo) S.diplo.credito=clamp(S.diplo.credito+n,0,100); }
function ruoloDiplo(){
  if(!(S.diplo && S.diplo.grado>=2)) return 'Ambasciatore';   // grado 1 = era-neutro
  if(typeof eraGiocata==='function' && eraGiocata()==='italia1950' && (((S&&S.year)||1950)<1955)) return 'Rappresentante permanente presso il Consiglio d\'Europa';   // D4: grado 2 d'epoca (reale)
  return 'Sottosegretario generale delle Nazioni Unite';
}
function startDiplomatico(){
  initStatoBase();                                   // S.livello=5 impostato in applicaPersonaggio (CREA.livello===5)
  S.diplo={ grado:1, credito:50, mesiAlto:0 };
  S.pol=Object.assign({}, GOVERNI_PROFILI['centro']); S.snap=Object.assign({},S.pol);   // nazionale neutro/dormiente
  S.ministers=[]; S.coalizione=[S.partito]; S.seggi=(PAESE.coalizione||PAESE.comeSiVince==='parlamentare')?calcSeggi():null;
  S.minoranza=false; S.tenuta={};
  if(S.relInt){ for(const id in S.relInt) S.relInt[id]=45; }   // il tabellone parte TIEPIDO: lo costruisci tu, missione dopo missione
  if(S.biografia) S.biografia.origine='diplomatico';
  S.log=[{t:'Nominato '+ruoloDiplo(), x:'Cominci dalla diplomazia: costruisci rapporti e credito, e il vertice del mondo potrà chiamarti — senza mai governare un paese.'}];
  bioFatto((typeof bgNome==='function'&&bgNome()?bgNome()+', n':'N')+'ominato '+ruoloDiplo()+'.');
  S.tab='gov';
  document.getElementById('appoint').style.display='none';
  document.getElementById('over').style.display='none';
  document.getElementById('start').style.display='none';
  document.getElementById('ov').classList.remove('on');
  document.getElementById('game').style.display='block';
  genAgenda(false); generaTitolo(); render(); commitSnap();
}
function diventaAltoRappresentante(){   // grado 1→2: la promozione (gated sul credito in pickOccasione)
  if(!S.diplo) return;
  S.diplo.grado=2; S.diplo.mesiAlto=0; S.occUltima=null;
  bioFatto('Da Ambasciatore a Sottosegretario generale delle Nazioni Unite: la scala diplomatica sale.');
  S.log.unshift({t:'Promosso',x:'Sei Sottosegretario generale delle Nazioni Unite: un passo dal vertice del mondo.'});
  if(typeof PROMO_FIORE!=='undefined') PROMO_FIORE=true;
  genAgenda(false); render(); commitSnap();
}
function pickDiplo(){   // il loop: una missione la maggior parte dei mesi, col volto reale dove serve
  if(typeof DIPLO_EV==='undefined') return null;
  if(Math.random()>=0.55) return null;
  let pool=DIPLO_EV.filter(function(e){return (!e.cond||e.cond())&&(typeof eraVivaT!=='function'||eraVivaT(e));});   // FIX era-gate percorso diplomatico (astratto-senza-tempo: default eraVivaT; i pochi moderni → contemporanea)
  const ev=pescaBag('diplo', pool); if(!ev) return null;
  let p=null; if(ev.volto==='rivale' && typeof rivaleNominato==='function') p=rivaleNominato();
  /* i18n: T() PRIMA di potSub — si traduce il TEMPLATE (coi %POT intatti), poi la sostituzione gira
     nella lingua corrente (ramo EN di potSub). La carta nasce nella lingua del pescaggio (pattern log). */
  const base=(p && typeof potSub==='function') ? Object.assign({}, ev, {
    t:potSub(T(ev.t),p), text:potSub(T(ev.text),p), kick:potSub(T(ev.kick||''),p)||T(ev.kick),
    ch:ev.ch.map(function(c){ return Object.assign({}, c, {l:potSub(T(c.l),p), e:potSub(T(c.e),p)}); })
  }) : Object.assign({}, ev, { t:T(ev.t), text:T(ev.text), kick:T(ev.kick||''), ch:ev.ch.map(function(c){ return Object.assign({}, c, {l:T(c.l), e:T(c.e)}); }) });
  const inst=Object.assign({}, base, { t:entiSub(base.t), text:entiSub(base.text), ch:base.ch.map(function(c){ return Object.assign({}, c, {l:entiSub(c.l), e:entiSub(c.e)}); }) });   // D4b: %ONU era-aware
  return { kind:'event', data:inst, resolved:false };
}
/* D4 — la SECONDA superficie del diplomatico: i «dossier di scrivania» (DIPLO_DOSS). Colma i mesi-vuoti a L5/L4
   (dove pickDiplo/pickCrisiInt firano di rado). Sacchetto + era-gate (eraVivaT: universali sempre, epoca '50 solo lì). */
function pickDiploDoss(){
  if(typeof DIPLO_DOSS==='undefined') return null;
  var pool=DIPLO_DOSS.filter(function(e){ return (!e.cond||e.cond()) && (typeof eraVivaT!=='function'||eraVivaT(e)); });
  var ev=pescaBag('diplodoss', pool); if(!ev) return null;
  return { kind:'event', data:ev, resolved:false };
}
/* deriva mensile: l'AUTOREVOLEZZA torna verso un'àncora guidata dalla COESIONE (ente coeso → autorità cresce: la VIA
   DI RECUPERO che salva l'arrivo marginale dalla spirale); la coesione ha una lieve entropia verso 50. */
function intDrift(){
  if(!S.intl) return;
  const ancoraAut=clamp(38+S.intl.coesione*0.42,30,90);
  S.intl.autorevolezza=clamp(S.intl.autorevolezza+(ancoraAut-S.intl.autorevolezza)*0.10,0,100);
  S.intl.coesione=clamp(S.intl.coesione+(50-S.intl.coesione)*0.03,0,100);
}
function pickCrisiInt(){
  if(typeof CRISI_INT==='undefined' || !S.intl) return null;
  const mese=S.year*12+S.month;
  if(S.intl.crisiUltimo!=null && mese-S.intl.crisiUltimo<2) return null;   // cadenza ~ogni 2-3 mesi
  if(Math.random()>=0.55) return null;
  let pool=CRISI_INT.filter(function(e){return (!e.cond||e.cond())&&(typeof eraVivaT!=='function'||eraVivaT(e));});   // FIX era-gate crisi da Segretario (astratte-senza-tempo: default eraVivaT; i moderni → contemporanea)
  const ev=pescaBag('crisiint', pool); if(!ev) return null;
  S.intl.crisiUltimo=mese;
  /* Fetta C: le crisi ANTAGONISTE (volto:'rivale') prendono un volto reale PESCATO (vario nel mandato, anti-ripetizione
     in S.recentPot) e tornano già passate in potSub; le 6 interne/sistemiche/UE restano astratte (nessun volto). */
  let base=ev;
  if(ev.volto==='rivale' && typeof rivaleNominato==='function' && typeof potSub==='function'){
    const p=rivaleNominato();
    if(p) base=Object.assign({}, ev, {   // i18n: T() prima di potSub (template coi %POT intatti → sostituzione nella lingua corrente)
      t: potSub(T(ev.t),p), text: potSub(T(ev.text),p), kick: potSub(T(ev.kick||''),p)||T(ev.kick),
      ch: ev.ch.map(function(c){ return Object.assign({}, c, {l:potSub(T(c.l),p), e:potSub(T(c.e),p), mondo:potSub(T(c.mondo||''),p)||c.mondo}); })
    });
  } else {
    base=Object.assign({}, ev, { t:T(ev.t), text:T(ev.text), kick:T(ev.kick||''), ch:ev.ch.map(function(c){ return Object.assign({}, c, {l:T(c.l), e:T(c.e), mondo:c.mondo?T(c.mondo):c.mondo}); }) });
  }
  // D4b: %ONU era-aware (Nazioni Unite nel presente, «istituzioni comuni» nel Segretario-NATO/CoE del '50)
  const data=Object.assign({}, base, { t:entiSub(base.t), text:entiSub(base.text), ch:base.ch.map(function(c){ return Object.assign({}, c, {l:entiSub(c.l), e:entiSub(c.e), mondo:entiSub(c.mondo)}); }) });
  return { kind:'crisiInt', data:data, resolved:false };
}

/* ============================================================
   IL LIVELLO 1 — POLITICO LOCALE (lotto ascesa, fase 1). Sindaco/governatore di un'area della mappa:
   indicatori e leve LOCALI propri (S.locale), motore dedicato (simulateLocale). Il nazionale (S.ind/S.pol)
   resta dormiente/neutro; riuso simulateMonth solo per le decadenze narrative (esposizione, correnti).
   Le scelte locali alimentano gli STESSI contatori tratti/esposizione → la continuità parte dalla gavetta.
   Salita: capitale alto → l'occasione (chiamata a Roma) → diventaMinistro() = transizione 1→2, ZERO reset.
   ============================================================ */
function diLuogo(nome){ if(typeof curLang==='function'&&curLang()==='en') return 'of '+terrNomeEn(nome); const m={'la ':'della ','il ':'del ','le ':'delle ',"l'":"dell'",'lo ':'dello ',"gli ":'degli '}; const low=(nome||'').toLowerCase(); for(const k in m){ if(low.indexOf(k)===0) return m[k]+nome.slice(k.length); } return 'di '+nome; }
function nomeNudo(nome){ return (nome||'').replace(/^(la |il |le |l'|lo |gli |i )/i,''); }   // "la Lombardia" → "Lombardia"
/* --- B8: nomi/cariche territorio in-lingua. In EN: esonimo consolidato (`nomeEn` sul dato) o nome
   nudo senza articolo; carica per-paese via `caricaEn` (Chief Minister) o dizionario. --- */
function terrNomeEn(nome){ const t=((typeof PAESE!=='undefined'&&PAESE.territori)||[]).find(function(x){return x.nome===nome;}); return (t&&t.nomeEn)||nomeNudo(nome); }
function nomeTerr(TE){ if(!TE) return ''; return (typeof curLang==='function'&&curLang()==='en')?(TE.nomeEn||nomeNudo(TE.nome)):TE.nome; }
function caricaTerr(TE){ if(!TE) return ''; return (typeof curLang==='function'&&curLang()==='en'&&TE.caricaEn)?TE.caricaEn:T(TE.carica||''); }
function localeNome(){ const L=S&&S.locale; if(!L) return ''; return (typeof curLang==='function'&&curLang()==='en')?terrNomeEn(L.nome):L.nome; }
function enTermine(t){ return ({Stato:'State',Provincia:'Province',Land:'Land',Prefettura:'Prefecture','Comunità':'Community',Regione:'Region'})[t]||t; }
/* il ruolo: Sindaco/a di una CITTÀ (flesso); Presidente della Regione di una REGIONE (titolo INVARIABILE,
   coerente con la regola dei titoli istituzionali — mai presidentessa). */
function ruoloLocale(){ const L=S.locale; if(!L) return T('Politico locale'); const f=(S.personaggio&&S.personaggio.genere==='f');
  if(L.tipo==='città') return T(f?'Sindaca di %L':'Sindaco di %L').replace('%L',localeNome());
  if(L.carica && L.carica!=='Presidente di regione') return ((typeof curLang==='function'&&curLang()==='en'&&L.caricaEn)?L.caricaEn:T(L.carica))+' '+diLuogo(L.nome);
  return T('Presidente della Regione %L').replace('%L',(typeof curLang==='function'&&curLang()==='en')?terrNomeEn(L.nome):nomeNudo(L.nome)); }
/* l'entità amministrata: "il Comune di Milano" / "la Regione Lombardia". */
/* il termine per la circoscrizione regionale, PER PAESE (`PAESE.terminoLocale`): Italia=Regione · Australia/India=Stato ·
   Sudafrica/Argentina=Provincia. Default «Regione». Articolo: «lo Stato», «la Regione»/«la Provincia». */
function terminoRegione(){ return (typeof PAESE!=='undefined' && PAESE.terminoLocale) || 'Regione'; }
function artTermine(t){ return (t==='Stato')?'lo':'la'; }
function entitaLocale(){ const L=S.locale; if(!L) return ''; const en=(typeof curLang==='function'&&curLang()==='en');
  if(L.tipo==='città') return T('il Comune di %L').replace('%L',localeNome());
  const term=terminoRegione(); if(term==='Regione') return T('la Regione %L').replace('%L',en?terrNomeEn(L.nome):nomeNudo(L.nome));
  return en?('the '+enTermine(term)+' '+diLuogo(L.nome)):(artTermine(term)+' '+term+' '+diLuogo(L.nome)); }
function locInd(id,n){ if(S.locale && S.locale.ind[id]!=null) S.locale.ind[id]=clamp(S.locale.ind[id]+n,0,100); }
/* --- Nuova partita (da POLITICO LOCALE) --- */
function startLocale(){
  const terrIdx=(CREA&&CREA.terrIdx!=null)?CREA.terrIdx:0;
  initStatoBase();                                   // S.livello=1 impostato in applicaPersonaggio
  const TE=(PAESE.territori||[])[terrIdx]||PAESE.territori[0], tipo=TE.tipo;
  const leve={}; LOCALE_LEVE[tipo].forEach(function(lv){ leve[lv.id]=1; });          // tutte a "medio"
  const ind={}; LOCALE_IND[tipo].forEach(function(d){ ind[d.id]=(d.id==='bilancio')?55:50; });
  S.locale={ nome:TE.nome, carica:TE.carica, caricaEn:TE.caricaEn||null, tipo:tipo, terrIdx:terrIdx, ind:ind, leve:leve, consenso:50, mandato:1,
    budget: Math.round((S.pil||2150)*(tipo==='città'?3.2:15)) };   // BILANCIO in € mln (cantiere Budget): calibrato sulle ANCORE reali — Roma ~€6,85 mld (città ~3,2× PIL€mld), Lombardia ~€32 mld (regione ~15×)
  S.pol=Object.assign({}, GOVERNI_PROFILI['centro']); S.snap=Object.assign({},S.pol);   // nazionale neutro/dormiente
  S.capitale=20; S.visibilita=30; S.credibilita=40; S.prevSettore=50;
  S.ministers=[]; S.coalizione=[S.partito]; S.seggi=(PAESE.coalizione||PAESE.comeSiVince==='parlamentare')?calcSeggi():null;
  S.minoranza=false; S.tenuta={}; S.tenutaForza0={}; S.tenutaLiv={}; S.tenutaUltimo={}; S.mesiMinoranza=0;
  initTerritori(); initPotereLocale();
  simulateLocale();                                  // consenso locale iniziale
  if(S.biografia) S.biografia.origine='locale';       // l'epilogo ricorderà la gavetta
  const ruolo=ruoloLocale();
  S.log=[{t:'Eletto '+ruolo, x:T('Cominci dal basso: amministra bene %L, costruisci la notorietà, e il partito ti chiamerà a Roma.').replace('%L',S.locale.nome)}];
  bioFatto((bgNome()?bgNome()+', e':'E')+'letto '+ruolo+'.');
  document.getElementById('appoint').style.display='none';
  document.getElementById('over').style.display='none';
  document.getElementById('start').style.display='none';
  document.getElementById('ov').classList.remove('on');
  document.getElementById('game').style.display='block';
  genAgenda(false); generaTitolo(); render(); commitSnap();
}
/* soglie di LAUREA (Build A) — single-source: la tab le mostra (gate VISIBILE, rifinitura 2a), il gate di L4 le userà.
   Il mix è obbligato: base (piazza) + reputazione media sui 6 gruppi (incl. moderati → istituzionale) + autorevolezza (istituzionale). */
const LAUREA_SOGLIE = { base:60, rep:55, autorev:50 };
/* RITMO (A.5 rework): le SOGLIE restano fisse (60/55/50, mostrate=controllate, nessun drift testo/logica). Scalo invece i GUADAGNI
   e la DERIVA di un fattore `paceMul` → la gavetta si allunga/accorcia uniformemente per centrare i mesi-bersaglio per (età×difficoltà).
   È un puro RI-SCALAMENTO DEL TEMPO: baseline/soglie/frazioni/min non dipendono da paceMul → weakest-link, coast e no-soft-lock INTATTI
   (un mono lascia il tallone al baseline → frazione 0 → mai laureato, solo più lento). Mesi ∝ 1/paceMul. */
const TARGET_MESI = { 25:{normale:36,difficile:48,facile:24}, 30:{normale:24,difficile:36,facile:18}, 35:{normale:15,difficile:24,facile:12} };
const MESI_BASELINE = 9.4;   // CALIBRATO sui dati per il FLUSSO del rework L2 (offerte occasionali + carte start/resa che consumano mesi → gavetta più lenta): baseline effettiva ~9,4. paceMul = MESI_BASELINE / TARGET_MESI[età][diff] → mesi ∝ 1/paceMul centra la tabella
function calcPaceMul(eta, diff){
  var band = TARGET_MESI[eta] || TARGET_MESI[[25,30,35].reduce(function(a,b){ return Math.abs(b-eta)<Math.abs(a-eta)?b:a; },25)];   // banda più vicina (robustezza)
  var target = band[diff] || band.normale;
  return MESI_BASELINE / target;
}
function pace(){ return (typeof S!=='undefined' && S && S.attivista && S.attivista.paceMul) || 1; }   // 1 fuori dalla gavetta o su salvataggi pre-rework
/* helper delle due valute nuove (dati puri, clamp 0-100) — scalati dal ritmo (attB/attA sono SEMPRE contesto-attivista) */
function attB(n){ if(S.attivista) S.attivista.base=clamp(S.attivista.base+n*pace(),0,100); }
function attA(n){ if(S.attivista) S.attivista.autorev=clamp(S.attivista.autorev+n*pace(),0,100); }
/* DERIVA PASSIVA (Build A, L3): il MOMENTUM è l'anello debole. Ogni valuta ha una frazione-obiettivo (quanto del cammino verso
   la sua soglia hai fatto); il momentum = il MINIMO delle tre → derivi solo se stai costruendo TUTTE e tre insieme. Il passivo
   (tutto al baseline → frazioni 0 → momentum 0) è un PUNTO FISSO, e i mono (una frazione bassa → momentum basso) restano bloccati
   PER COSTRUZIONE: la deriva accelera solo il mix, non laurea chi non gioca. Reachability del gate ~6-10 mesi col mix. */
function simulateAttivista(){
  var A=S.attivista; if(!A) return;
  var med=mediaGruppi(), S0=LAUREA_SOGLIE;
  var bB=clamp((A.base-10)/(S0.base-10), 0, 1);       // frazione dell'obiettivo BASE (baseline 10 → soglia)
  var bA=clamp((A.autorev-15)/(S0.autorev-15), 0, 1); // frazione dell'obiettivo AUTOREVOLEZZA (baseline 15 → soglia)
  var bR=clamp((med-50)/(S0.rep-50), 0, 1);           // frazione dell'obiettivo REPUTAZIONE (baseline 50 → soglia)
  var mom=Math.min(bB, bA, bR);   // l'anello debole: costruisci TUTTE e tre o non c'è momentum (la deriva non bootstrappa dal nulla → mono/passivo restano a 0)
  var p=pace();                    // A.5 ritmo: la deriva scala come i guadagni → il RAPPORTO accumulo-attivo/coast è intatto (il cuscinetto non si sfasa)
  A.base   =clamp(A.base    + mom*7.0*p, 0, 100);
  A.autorev=clamp(A.autorev + mom*7.5*p, 0, 100);
}
/* la carta-mossa del mese (Build A, L2): pesca una causa (scena RUOTA per tema, anti-wallpaper), costruisce le 3 mosse FISSE
   legate al gruppo della causa. organizza/tessi = ISTITUZIONALE (lenta, sicura, moderati); battaglia = PIAZZA (veloce, rischiosa:
   base+affini forte, i poteri forti si raffreddano di POCO e recuperabile). Il gate (base+reputazione+autorev) obbliga il MIX. */
function pickAttivista(){
  if(typeof ATTIVISTA_CTX==='undefined' || !ATTIVISTA_CTX.length || !S.attivista) return null;
  var _ctx=ATTIVISTA_CTX.filter(function(e){return (typeof eraVivaT!=='function'||eraVivaT(e));});   // FIX era-gate contesti attivista (senza-tempo: default eraVivaT)
  var c=pescaBag('attivista', _ctx.length?_ctx:ATTIVISTA_CTX); if(!c) return null;
  var G=c.grp||'lavoratori';
  var card={ id:c.id, kick:c.kick, tono:c.tono||null, t:c.t, text:c.text, grp:G, ch:[
    { l:'Organizza il gruppo', e:'Reputazione del gruppo su, base su · lenta e sicura, piace ai moderati', pleases:'tecnico',
      f:function(){ attB(3); gd(G,5); } },
    { l:'Battaglia pubblica', e:'Base su forte, il gruppo e i giovani con te · veloce e rischiosa: i poteri forti si raffreddano (recuperabile)', pleases:'populista',
      f:function(){ attB(6); gd(G,6); gd('giovani',3); gd('imprenditori',-2); gd('cetomedio',-2); attA(-1); } },
    { l:'Tessi col partito', e:'Autorevolezza su, i moderati ti prendono sul serio · lenta e sicura', pleases:'tecnico',
      f:function(){ attA(6); gd('cetomedio',2); gd('imprenditori',1); } },
  ]};
  return { kind:'attivista', data:card, resolved:false };
}
/* CAMPAGNE PLURI-MESE (A.5 REWORK, lotto 2 — INTEGRAZIONE "misto"). Non più un pannello a parte: la campagna vive NEL FLUSSO.
   - AVVIO e RESA sono CARTE del flusso (cardCampOfferta/cardCampResa, kind:'attivista' → sostituiscono la mossa come gli eventi).
   - NUTRIMENTO: uniforme per corsia-di-VALUTA (auto-detect in resolveItem: la carta che ha costruito base→'piazza', autorev→'istituzionale',
     nutre la campagna se la corsia coincide) → mosse E scelte-evento nutrono con la stessa regola (un evento in-corsia NON è incuria).
   - DECADENZA solo per INCURIA: un mese senza contributo in-corsia (`_nutrita` falso) → progresso cala; i mesi di start/resa sono esclusi.
   - Barra nel Movimento (renderAttivista). Stato PURO (id/lane/mesi/progresso + _nutrita/resaPending transitori + campUltimo/campOfferta). */
const CAMP_FEED=45, CAMP_DECAY=12, CAMP_OFFER_PROB=0.4, CAMP_OFFER_CD=3;   // nutri per feed in-corsia · decadenza per incuria · prob/cooldown dell'offerta
function avviaCampagna(id){
  if(!S.attivista || S.attivista.campagna || S.attivista.laurea) return;   // una sola per volta; non dopo la laurea
  var def=(typeof ATTIVISTA_CAMP!=='undefined') && ATTIVISTA_CAMP.find(function(d){ return d.id===id; });
  if(!def) return;
  S.attivista.campagna={ id:def.id, tipo:def.tipo, lane:def.lane, kick:def.kick||null, mesiTot:def.mesi, mesiRestanti:def.mesi, progresso:0, _nutrita:true, resaPending:false };   // _nutrita:true il mese-di-avvio (niente decadenza il mese in cui la lanci)
  S.attivista.campOfferta=false;
  S.log.unshift({ t:T(def.tipo), x:T(def.avvio||'Hai lanciato una campagna.') });
}
function nutriCampagna(mossaLane){   // corsia-di-valuta della carta appena risolta (auto-detect in resolveItem) → nutre SOLO se coincide col lane della campagna
  var C=S.attivista && S.attivista.campagna;
  if(C && C.lane===mossaLane){ C.progresso=clamp((C.progresso||0)+CAMP_FEED, 0, 100); C._nutrita=true; }   // ~2-3 contributi in-corsia → pieno; il flag esclude la decadenza di questo mese
}
function risolviCampagna(nota){
  var C=S.attivista && S.attivista.campagna; if(!C) return;
  var def=(typeof ATTIVISTA_CAMP!=='undefined') && ATTIVISTA_CAMP.find(function(d){ return d.id===C.id; });
  var q=clamp((C.progresso||0)/100, 0, 1);                                   // frazione di riuscita → scala il payoff (no exploit: chiudi presto/trascurata = payoff piccolo)
  if(def && def.resa){ try{ ACT_PACE=pace(); def.resa(q); } finally{ ACT_PACE=1; } }   // effetti SOLO in-corsia (dal pool), scalati dal ritmo; finally = reset garantito anche se resa() eccepisce
  S.log.unshift({ t:T('Campagna conclusa'), x: nota ? T(nota) : (def ? T(def.esito) : T('La campagna si chiude.')) });
  S.attivista.campStoria=S.attivista.campStoria||[];                                   // STORICO (L3): il cruscotto "Campagne" lo mostra
  S.attivista.campStoria.unshift({ tipo:C.tipo, lane:C.lane, q:Math.round(q*100) });   // dato puro (tipo/corsia/riuscita%)
  if(S.attivista.campStoria.length>8) S.attivista.campStoria.length=8;
  S.attivista.campUltimo=S.year*12+S.month;   // cooldown per la prossima offerta
  S.attivista.campagna=null;
}
/* offerta di campagna al confine: solo se nessuna attiva, off-cooldown, non subito. genAgenda ne fa una CARTA (cardCampOfferta). */
function provaOffertaCampagna(){
  if(!S.attivista || S.attivista.campagna || S.attivista.laurea) return false;
  var mese=S.year*12+S.month;
  if(S.attivista.campUltimo && (mese - S.attivista.campUltimo) < CAMP_OFFER_CD) return false;   // cooldown dopo fine/rifiuto
  if((S.attivista.mesi||0) < 2) return false;                                                    // la gavetta respira
  return Math.random() < CAMP_OFFER_PROB;
}
function cardCampOfferta(){   // CARTA-START nel flusso: lancia una campagna (sostituisce la mossa) o «non ora» col groundwork (niente mese morto)
  if(typeof ATTIVISTA_CAMP==='undefined' || !S.attivista) return null;
  var ch=ATTIVISTA_CAMP.map(function(def){ return { l:def.tipo, e:def.avvio, f:(function(id){ return function(){ avviaCampagna(id); }; })(def.id) }; });
  ch.push({ l:'Non ora', e:'Resti sul lavoro di base — un filo di base, niente mese morto', f:function(){ attB(2); S.attivista.campUltimo=S.year*12+S.month; S.attivista.campOfferta=false; } });   // GROUNDWORK: declinare è legittimo, non una perdita secca
  return { kind:'attivista', data:{ id:'camp_offerta', kick:'Società civile', campStart:true, t:'Una battaglia è matura', text:'Il momento è propizio per un impegno più lungo: le tue mosse lo alimenteranno mese dopo mese, fino alla resa. Quale lanci?', ch:ch }, resolved:false };
}
function cardCampResa(){   // CARTA-RESA nel flusso: l'esito visibile (non più risoluzione silenziosa); "incassa" applica risolviCampagna
  var C=S.attivista && S.attivista.campagna; if(!C) return null;
  var def=(typeof ATTIVISTA_CAMP!=='undefined') && ATTIVISTA_CAMP.find(function(d){ return d.id===C.id; });
  return { kind:'attivista', data:{ id:'camp_resa', kick:C.kick||'Società civile', tono:(C.lane==='piazza'?'grave':'florido'), campResa:true,
    t:'La campagna arriva al dunque', text:'Mesi di impegno convergono in un esito: quanto l\'hai nutrita, tanto rende.',
    ch:[ { l:'Incassa il risultato', e:T('Il risultato scala sul progresso: %P%').replace('%P',Math.round(C.progresso||0)), f:function(){ risolviCampagna(); } } ] }, resolved:false };
}
/* EVENTI REATTIVI (A.5, lotto 3). Il ROLL vive AL CONFINE (avanzaMese → S.attivista.evCorrente = id o null): così genAgenda si
   limita a LEGGERE evCorrente e ricostruire la carta dal pool per id → reload-stabile (niente reroll all'exploit; il roll usa
   Math.random ma è già consolidato). Freq ~3-5 a gavetta = EV_PROB + spacing ≥2 mesi + ring anti-wallpaper (evRecent) + pescaBag. */
const EV_PROB = 0.70;   // probabilità per mese ELEGGIBILE (tarata perché una gavetta tipica veda ~3-5 eventi, non ~1; col tetto ~4 su gavetta ~9 mesi + spacing≥2)
/* Build B — filtro d'epoca. Lotto 2: il DEFAULT degli untagged è flippato a 'contemporanea' (implicitamente presente):
   così nel '50 gli eventi nazionali moderni NON affiorano più. Il presente resta IDENTICO per costruzione
   (untagged→'contemporanea'===''contemporanea'→vivi come oggi). 'universale' vale ovunque; 'italia1950' solo nel '50.
   eraViva = default 'contemporanea' (pool moderni/discrezionali: gli untagged sono esclusi nel '50).
   eraVivaT = default 'universale' (RETE DI SICUREZZA per i pool strutturalmente senza-tempo: personali, giudiziario,
   scandali, conflitti, alleati, pressioni... — gli untagged SOPRAVVIVONO nel '50; i moderni palesi si tolgono
   taggandoli 'contemporanea'). Così 2a lascia un '50 magro-ma-vivo. */
/* ============================================================================
   AVANZAMENTO DEL TEMPO — Fase 1. L'era-attiva NON è più fissa: si DERIVA da S.year
   lungo una LINEA storica. S.era resta l'ORIGINE del binario (dato puro, round-trip):
   'italia1950' = linea storica italiana; assente/'contemporanea' = presente.
   Ogni linea dichiara i suoi DECENNI con una finestra { da, coda }:
     · `da`   = l'anno da cui il decennio comincia ad affiorare (confine MORBIDO: le
               ancore-anno per-carta dosano poi l'ingresso — la finestra apre il rubinetto);
     · `coda` = l'anno oltre cui le carte del decennio invecchiano fuori (la scadenza-decade
               generalizzata: il pattern Corea ≤'53 diventa un default per-tag).
   L'ULTIMA finestra della linea resta APERTA (coda:Infinity) finché non nasce la successiva
   (quando arriverà italia1970, porterà LEI la coda del '60) — degrado dichiarato (C2).
   Forward-compatible: la futura linea USA userà usa1950/usa1960 senza collisioni (C1).
   PRESENTE e 'universale': nessun decennio, nessuna coda → identici a prima, per costruzione. */
const LINEE_STORICHE = {
  [LINEA_IT]: {
    decenni: [
      { tag:'italia1950', da:-Infinity, coda:1961      },   // decade '50: coda-default 1961 (l'invecchiamento §4)
      { tag:'italia1960', da:1958,      coda:1971      },   // decade '60: apre dal '58 (miracolo, Min. Sanità); L28-1 CHIUDE la coda al '71
      { tag:'italia1970', da:1969,      coda:1981      },   // decade '70: apre dal '69 (il confine d'ingresso è dicembre '69); L31-1 CHIUDE la coda all'81
      { tag:'italia1980', da:1979,      coda:1991      },   // decade '80: apre dal '79; L40-1 CHIUDE la coda al '91 (il '90 apre dall'89, stessa sovrapposizione morbida)
      { tag:'italia1990', da:1989,      coda:2001      },   // decade '90: apre dall'89; L44-1 CHIUDE la coda al 2001
      { tag:'italia2000', da:1999,      coda:2013      },   // decade 2000: apre dal '99; è l'ULTIMO decennio della linea e la sua coda è CHIUSA — v. la saldatura qui sotto
      /* ====== LA SALDATURA (L44-1) ======================================================================
         La linea storica italiana finisce qui e **si salda col presente**: dal 2012 la finestra attiva è
         `contemporanea`, cioè esattamente il tag del contenuto che il gioco ha già per il presente. Non c'è
         un decennio 2010 e non ci sarà: chi arriva in fondo alla linea **entra nel gioco di oggi**, con lo
         stesso meccanismo di finestre che ha attraversato sei decenni.
         Perché funziona senza toccare `eraCartaViva`: quella funzione cerca il tag della carta fra i decenni
         della linea, e ora `contemporanea` è un decennio come gli altri — prima del 2012 è chiusa (`y < da`),
         dal 2012 è aperta e senza coda. La sovrapposizione 2012-2013 col decennio 2000 è la solita cerniera
         morbida: per due anni convivono, come '69-'71 e '89-'91.
         NIENTE `codaFino:Infinity` nuovo: il ponte oltre l'ultima coda non serve più, perché dopo l'ultima
         coda c'è il presente. Le 16 gemelle `ti90_st_*` lo tengono ancora — le toglierà il lotto-contenuto
         del 2000, che scriverà le sue.
         ==================================================================================================== */
      { tag:'contemporanea', da:2012,   coda:Infinity  }
    ]
  }
};
/* La carta E è viva? def = default del tag mancante ('contemporanea' per eraViva, 'universale' per eraVivaT).
   Override-coda per-carta via E.codaFino (C3 esito b: es. urss=∞ rivale di tutta la linea, supermercato=1963). */
function eraCartaViva(E, def){
  var t = (E && E.era) || def;
  if(t==='universale') return true;
  var cur = (typeof S!=='undefined' && S && S.era) || 'contemporanea';
  if(cur==='contemporanea') return t==='contemporanea';        // PRESENTE: solo contemporanea+universale (identico a prima)
  var L = LINEE_STORICHE[cur];
  if(!L) return t===cur;                                        // scenario storico non-lineare: vecchio comportamento
  var y = (S && S.year!=null) ? S.year : -Infinity;
  for(var i=0;i<L.decenni.length;i++){
    var d=L.decenni[i];
    if(d.tag!==t) continue;
    if(y < d.da) return false;                                  // decennio non ancora aperto (niente '60 nel '52)
    var tetto = (E && E.codaFino!=null) ? E.codaFino : d.coda;  // override per-carta, altrimenti coda-default del tag
    return y <= tetto;                                          // oltre la coda: la carta è invecchiata fuori
  }
  return false;                                                 // t non è un decennio di questa linea (né universale)
}
function eraCombacia(t){ return eraCartaViva({era:t}, t); }     // chiamanti a tag-nudo (ui.js: bucket-stringa / flag)
function eraViva(E){ return eraCartaViva(E, 'contemporanea'); }
function eraVivaT(E){ return eraCartaViva(E, 'universale'); }

/* AVANZAMENTO — DRIFT ECONOMICO PER-DECENNIO (Lotto 4; sostituisce il gancio inerte di Fase 1). La decade non è
   piatta (§2): la congiuntura `S.ciclo` REVERTE verso una baseline-decade invece che verso 0 (miracolo positiva,
   stretta negativa, ripresa). Passa da `S.ciclo` — NON da `S.ind.growth` — perché `computeGrowth` (model.js)
   ricalcola growth da zero ogni mese: un `growth +=` sarebbe transitorio e debole. `S.ciclo` è già dentro
   computeGrowth (e alimenta il deficit via lo stabilizzatore automatico) → il drift colora anche i conti, gratis.
   Il colore-decade è limitato a ±ampC (~0,7) → STRUTTURALMENTE più piccolo dello swing-giocatore (~2,9) →
   non-dominanza garantita per costruzione (walk: cattivo-nel-miracolo 0,42 < buono-nella-stretta 2,32).
   `cicloBase()`=0 nel presente e prima del '58 → la congiuntura è identica a oggi e il '50 resta sigillato. */
const DRIFT_ECONOMICO_ERA = {
  /* miracolo → stretta '64 → ripresa '66 (indice-gioco, §2) · L28-1: la STAGFLAZIONE del '70 (scheda §2) — la coda
     del boom fino al '72, poi lo shock petrolifero del '73 che porta la congiuntura al minimo consentito dalla
     disciplina di non-dominanza (−0,7, mai oltre), e un decennio che non torna più in positivo. */
  [LINEA_IT]: [ {da:1958, ciclo:0.6}, {da:1964, ciclo:-0.4}, {da:1966, ciclo:0.4},
                {da:1970, ciclo:0.2}, {da:1973, ciclo:-0.7}, {da:1976, ciclo:-0.4},
                {da:1980, ciclo:-0.2}, {da:1983, ciclo:0.2},  {da:1986, ciclo:0.5},
                /* L40-1 — il '90: prima metà durissima, seconda in risalita (scheda §2). Il 1993 è l'unico anno
                   della linea a toccare il minimo consentito dalla non-dominanza (−0,7) INSIEME al '73: è la
                   recessione vera, PIL reale negativo. Poi la rincorsa a Maastricht, che cresce ma non esplode. */
                {da:1990, ciclo:0.1},  {da:1992, ciclo:-0.5}, {da:1993, ciclo:-0.7},
                {da:1995, ciclo:0.2},  {da:1997, ciclo:0.4},  {da:1999, ciclo:0.3},
                /* L44-1 — il 2000: il decennio del «declino». Crescita anemica per tutto l'arco (mai sopra
                   +0,1), e **il 2009 tocca −0,7 come il '73 e il '93**: sono i tre fondi della linea, e il
                   2009 è il più duro dei tre nella realtà (PIL −5,5%). Poi un rimbalzo debole e il 2011. */
                {da:2001, ciclo:0},    {da:2003, ciclo:-0.2}, {da:2006, ciclo:0.1},
                {da:2008, ciclo:-0.5}, {da:2009, ciclo:-0.7}, {da:2010, ciclo:-0.1},
                {da:2011, ciclo:-0.4}, {da:2012, ciclo:0} ]
};
/* ===== L28-4 · IL MODIFICATORE-CLIMA DEGLI ANNI '70 (decisione G3) =====
   Dal dicembre 1969 a fine decennio il paese vive una stagione piu' cupa. Il clima e' un FENOMENO, mai un evento
   giocabile: nessuna carta, nessuna interattivita', nessun aggancio a singoli fatti di sangue.
   Due sole leve, entrambe sobrie e dichiarate:
     1) ORDINE PUBBLICO — si abbassa il BERSAGLIO di `sicurezza`, non il valore. `S.ind.sicurezza` è convergente
        (`+= (target − valore) × 0,10`, model.js): un `−=` diretto verrebbe riassorbito in pochi mesi, come per
        `potereLocale` e le correnti. Il bersaglio invece tiene, ed è la cosa giusta da muovere.
     2) TONO DEI TITOLI — la prima pagina sceglie la variante amica se `stampa >= 50`; in questo clima la soglia
        si alza, quindi a parità di rapporto con la stampa il paese legge titoli più cupi.
   NON tocca l'economia: la disciplina di non-dominanza della stagflazione resta il tetto, e il clima le sta sotto
   di un ordine di grandezza (il suo effetto sul voto passa solo da `sicurezza`, mai da crescita/deficit).
   La soglia d'ingresso è 1969,9 e NON 1969,92: dicembre 1969 vale 1969 + 11/12 = 1969,9167, quindi a 1969,92 il
   clima sarebbe partito a gennaio '70 — un mese dopo il fatto che lo apre. */
/* L33-1 - il clima NON e solo dei 70: dagli 80 DECADE, perche il terrorismo declina (pentiti 82, dissociazione
   87). Percettibile fino all 82, residuale dopo: la decade in superficie e luminosa, ed e questo il contrasto. */
const CLIMA70 = [ {da:1969.9, sicurezza:-4, titoli:4}, {da:1974, sicurezza:-7, titoli:7}, {da:1977, sicurezza:-9, titoli:8},
                  {da:1981, sicurezza:-6, titoli:6}, {da:1983, sicurezza:-3, titoli:3}, {da:1986, sicurezza:-1, titoli:1} ];
function clima70(){
  if(typeof S==='undefined' || !S || S.era!==LINEA_IT) return null;   // solo la linea storica; presente intatto
  var t=S.year+((S.month||1)-1)/12, out=null;
  for(var i=0;i<CLIMA70.length;i++){ if(t>=CLIMA70[i].da) out=CLIMA70[i]; }
  return out;
}
function climaSicurezza(){ var c=clima70(); return c?c.sicurezza:0; }   // offset sul BERSAGLIO (model.js)
function climaTitoli(){    var c=clima70(); return c?c.titoli:0;    }   // alza la soglia amico/ostile della prima pagina
function cicloBase(){
  if(typeof S==='undefined' || !S) return 0;
  var W = DRIFT_ECONOMICO_ERA[S.era || 'contemporanea'];
  if(!W || !W.length) return 0;                     // presente (mai in tabella): baseline 0 → congiuntura identica
  var y=S.year, base=0;
  for(var i=0;i<W.length;i++){ if(y>=W[i].da) base=W[i].ciclo; }   // l'ultima finestra aperta; prima del '58 → 0 (il '50 sigillato)
  return base;
}

/* AVANZAMENTO — GANCIO-TAPPA (Lotto 4). Alle elezioni-milestone della linea ('58, '63) la mappa-partiti si RIALLINEA
   una volta sola: esito politico, come lo snodo-truffa. Flag SEPARATO da S.truffaFatta (walk che attraversa '53 E '58/'63).
   Roster FISSO: sposta FORZA, non aggiunge/toglie partiti (round-trip-safe). DIVISIONE DEI RUOLI (senza doppio conteggio):
   il `govF` fa il declino-DC e gonfia il PCI come catch-all d'opposizione; il DELTA ridistribuisce (PCI giù, PSI/MSI su,
   monarchici che si dissolvono, PLI-boomerang al '63). I delta sommano a ZERO in ogni tappa (verificato sul walk:
   maggiori entro ~1,1 dallo storico). Il '63 è CONDIZIONALE sull'apertura (S.apertura): ramo storico (apertura avvenuta,
   boomerang-PLI +4) vs controfattuale (centrismo tenuto, niente boomerang, PSI fuori, DC che tiene un filo meglio). */
const RIALLINEAMENTI_ERA = {
  [LINEA_IT]: {
    1958: [ {id:'i50_dc',delta:2}, {id:'i50_pci',delta:-5}, {id:'i50_psi',delta:3}, {id:'i50_psdi',delta:-1}, {id:'i50_pnm',delta:-1.5}, {id:'i50_pri',delta:-0.5}, {id:'i50_msi',delta:3} ],   // Σ=0
    1963: {
      apertura:   [ {id:'i50_dc',delta:-2}, {id:'i50_pci',delta:-2.5}, {id:'i50_psi',delta:2}, {id:'i50_psdi',delta:1}, {id:'i50_pnm',delta:-4}, {id:'i50_pli',delta:4}, {id:'i50_pri',delta:-1}, {id:'i50_msi',delta:2.5} ],   // Σ=0 · boomerang-PLI +4 (storico 7,0)
      centrismo:  [ {id:'i50_dc',delta:1}, {id:'i50_pci',delta:-0.5}, {id:'i50_psi',delta:0.5}, {id:'i50_psdi',delta:0.5}, {id:'i50_pnm',delta:-4}, {id:'i50_pli',delta:1}, {id:'i50_pri',delta:-1}, {id:'i50_msi',delta:2.5} ]    // Σ=0 · controfattuale: niente boomerang, PSI fuori, DC tiene
    },
    /* L28-1 — LE TRE TAPPE DEGLI ANNI '70 (scheda PRESET-ITALIA-1970 §1). Stessa divisione dei ruoli del '58/'63:
       il `govF` fa il logorio dell'incumbent, il DELTA fa la REDISTRIBUZIONE storica fra i partiti. I delta non
       inseguono le percentuali assolute della scheda — inseguirle cancellerebbe il record del giocatore (dopo
       vent'anni al governo la sua DC è logora quanto se l'è meritato) — ma riproducono CHI guadagna e CHI perde
       a ogni urna, con la stessa grandezza dei delta esistenti (±1-5) e Σ=0 verificato. */
    1972: [ {id:'i50_pnm',delta:-4}, {id:'i50_msi',delta:4.5}, {id:'i50_pci',delta:1}, {id:'i50_dc',delta:0.5},
            {id:'i50_psi',delta:-0.5}, {id:'i50_psdi',delta:-0.5}, {id:'i50_pli',delta:-0.5}, {id:'i50_pri',delta:-0.5} ],   // Σ=0 · la «Destra Nazionale»: i monarchici confluiscono nel MSI, che quasi raddoppia
    1976: [ {id:'i50_pci',delta:5}, {id:'i50_dc',delta:1.5}, {id:'i50_pli',delta:-2.5}, {id:'i50_msi',delta:-2},
            {id:'i50_psdi',delta:-1.5}, {id:'i50_pri',delta:-0.5} ],                                                          // Σ=0 · la polarizzazione: DC+PCI al 73%, i laici minori schiacciati (il PLI quasi annientato)
    1979: [ {id:'i50_pci',delta:-4}, {id:'i50_psi',delta:1}, {id:'i50_psdi',delta:1}, {id:'i50_pri',delta:0.5},
            {id:'i50_pli',delta:0.5}, {id:'i50_msi',delta:0.5}, {id:'i50_dc',delta:0.5} ],                                    // Σ=0 · il riflusso: il PCI perde per la prima volta dal '48, i piccoli respirano (fisarmonica)
    /* L31-1 — LE DUE TAPPE DEGLI ANNI '80 (scheda PRESET-ITALIA-1980 §1). Stessa regola di sempre: i delta
       riproducono CHI guadagna e CHI perde, non le percentuali assolute (inseguirle cancellerebbe il record del
       giocatore). Σ=0 verificato su entrambe. */
    1983: [ {id:'i50_dc',delta:-5}, {id:'i50_pri',delta:2}, {id:'i50_psi',delta:1.5},
            {id:'i50_msi',delta:1}, {id:'i50_pli',delta:0.5} ],                                                               // Σ=0 · il minimo storico della DC (32,9) e l'onda dei laici: il PRI tocca il suo picco, il PSI diventa l'ago della bilancia
    /* L34-1 — PRIMA TAPPA CON DIRETTIVE: nel 1987 entrano i Verdi (2,5% e 13 deputati, l'onda post-Chernobyl).
       La Lega Lombarda resta fuori come da consegna: 0,48% è sotto qualunque soglia rappresentabile — entrerà
       col '90, che è il decennio in cui conta. `forza:2.5` è la sua quota d'esordio; la rinormalizzazione della
       tappa la riporta in scala col resto del roster. */
    1987: { entra:[ {id:'i80_verdi', nome:'Verdi', orientamento:'sinistra', base:{giovani:0.6, cetomedio:0.4}, forza:2.5, asse:-1, gruppoUE:'verdi'} ],
            delta:[ {id:'i50_pci',delta:-3.5}, {id:'i50_psi',delta:3}, {id:'i50_dc',delta:1.5}, {id:'i50_pri',delta:-1.5},
                    {id:'i50_msi',delta:-0.5}, {id:'i50_psdi',delta:0.5}, {id:'i50_pli',delta:0.5} ] },                       // Σ=0 · il PCI declina, il PSI tocca il massimo dal dopoguerra, la DC recupera, l'onda laica si ritira

    /* ======================================================================================================
       L40-1 · LA FRANA DEL '90. Quattro tappe in cinque anni: nessun'altra decade del gioco fa morire e
       nascere partiti — qui è il meccanismo di L34-1 che finalmente serve a quello per cui è nato.
       Le date sono quelle vere (scheda §1). I `delta` restano SPINTE, non risultati: le forze in partita
       divergono dalla storia per costruzione (è la premessa del gioco), quindi si spinge nella direzione
       giusta e si lascia che il motore faccia il resto. Attenzione al floor: `riallineamentoTappa` applica
       `Math.max(2, ...)`, nessun partito scende sotto 2 per delta — per farne morire uno serve `esce`.
       ====================================================================================================== */

    /* 1991 · RIMINI — il partito comunista si divide. Storico: XX congresso 31 gen-3 feb 1991, la mozione della
       svolta passa col 64%, nasce il PDS; una novantina di delegati esce e fonda Rifondazione.
       `se`: **solo se non è il partito del giocatore.** Se lo è, la stessa storia è lo snodo-scissione (L40-2),
       dove la scelta è sua — e questa direttiva non deve calpestarla. */
    1991: { se:function(){ return S.partito!=='i50_pci'; },
            entra:[ {id:'i90_prc', nome:'Rifondazione', orientamento:'sinistra', base:{lavoratori:0.6, giovani:0.4}, forza:5.5, asse:-2, gruppoUE:'sinistra'} ],
            rinomina:[ {id:'i50_pci', nome:'PDS'} ],
            delta:[ {id:'i50_pci',delta:-6}, {id:'i50_psi',delta:1}, {id:'i50_dc',delta:1} ] },                                 // il grosso resta, un terzo esce: insieme pesano meno di prima

    /* 1992 · L'ULTIMA FOTO DEL VECCHIO SISTEMA, già incrinata. DC sotto il 30% per la prima volta (29,7),
       il PSI al suo massimo storico (13,6) e non lo sa, la Lega dal nulla all'8,65 in cinque anni. */
    1992: { entra:[ {id:'i90_lega', nome:'Lega Nord', orientamento:'centrodestra', base:{imprenditori:0.5, cetomedio:0.5}, forza:8.5, asse:1, gruppoUE:'noniscritti'} ],
            delta:[ {id:'i50_dc',delta:-5}, {id:'i50_psi',delta:0.5}, {id:'i50_pci',delta:-1}, {id:'i90_prc',delta:0.5},
                    {id:'i50_pri',delta:-0.5}, {id:'i50_psdi',delta:-1}, {id:'i50_pli',delta:-1}, {id:'i50_msi',delta:-0.5} ] },

    /* 1994 · LA FRANA. In un solo anno: la DC si scioglie dopo 48 anni (18 gennaio) e diventa PPI, con il CCD
       in scissione verso destra; lo stesso giorno nasce il partito-azienda, che al debutto è primo partito; il
       PSI chiude a novembre dopo 102 anni; il MSI si dichiara conservatore a Fiuggi (gennaio '95, portato qui
       con la tappa). ⚠ IL PSI ESCE SENZA `confluisce_in`: la scheda non indica un erede, e non ce n'è stato uno
       — i socialisti si dispersero fra i due poli. La forza si redistribuisce alla rinormalizzazione, che è
       esattamente la dispersione storica. Se un destinatario lo vuoi, basta una parola. */
    1994: { entra:[ {id:'i90_fi',  nome:'Forza Italia', orientamento:'centrodestra', base:{imprenditori:0.5, cetomedio:0.3, pensionati:0.2}, forza:18, asse:1, gruppoUE:'popolari'},
                    {id:'i90_ccd', nome:'CCD', orientamento:'centrodestra', base:{cattolici:0.6, pensionati:0.4}, forza:3, asse:1, gruppoUE:'popolari'} ],
            rinomina:[ {id:'i50_dc', nome:'PPI'}, {id:'i50_msi', nome:'Alleanza Nazionale'} ],
            esce:[ {id:'i50_psi'} ],
            delta:[ {id:'i50_dc',delta:-8}, {id:'i50_pci',delta:2}, {id:'i50_msi',delta:4}, {id:'i90_prc',delta:0.5},
                    {id:'i50_pri',delta:-1}, {id:'i50_psdi',delta:-1}, {id:'i50_pli',delta:-1} ] },

    /* 1996 · IL BIPOLARISMO SI CONSOLIDA. L'erede del PCI è primo partito per la prima volta nella storia
       repubblicana (21,1); AN tocca il suo massimo; la Lega, in corsa solitaria, il suo (10,1). */
    1996: { delta:[ {id:'i50_pci',delta:1}, {id:'i50_msi',delta:2}, {id:'i90_lega',delta:1.5}, {id:'i90_prc',delta:2.5},
                    {id:'i90_fi',delta:-0.5}, {id:'i50_dc',delta:-4}, {id:'i90_ccd',delta:1} ] },

    /* ======================================================================================================
       L44-1 · IL DECENNIO 2000 — tre tappe, e la SECONDA FRANA. La prima ('94) aveva fatto morire i partiti
       fondatori della Repubblica; questa fonde quelli nati dalle sue macerie. Stesso meccanismo di L34-1.
       ====================================================================================================== */

    /* 2001 · L'ALTERNANZA COMPIUTA. La Casa delle Libertà vince; nel centrosinistra il PPI confluisce nel
       soggetto nuovo (la Margherita), e la Lega tocca il suo minimo storico (~3,9). */
    2001: { entra:[ {id:'i00_marg', nome:'La Margherita', orientamento:'centro', base:{cattolici:0.4, cetomedio:0.4, giovani:0.2}, forza:14.5, asse:0, gruppoUE:'liberali'} ],
            esce:[ {id:'i50_dc', confluisce_in:'i00_marg'} ],
            delta:[ {id:'i90_fi',delta:6}, {id:'i50_msi',delta:1}, {id:'i90_lega',delta:-5},
                    {id:'i50_pci',delta:-3}, {id:'i90_prc',delta:-1}, {id:'i90_ccd',delta:-0.5} ] },

    /* 2006 · IL FOTOFINISH: alla Camera decidono ventiquattromila voti. Nel gioco si traduce in una tappa
       che NON sposta quasi nulla — è il punto in cui il paese è diviso a metà, ed è giusto che si veda. */
    2006: { delta:[ {id:'i50_pci',delta:1}, {id:'i00_marg',delta:0.5}, {id:'i90_prc',delta:1},
                    {id:'i90_fi',delta:-1.5}, {id:'i50_msi',delta:-0.5}, {id:'i90_lega',delta:0.5} ] },

    /* 2008 · LA SECONDA FRANA. Le due fusioni: **PD** (l'erede del PCI + la Margherita, il partito nuovo è
       nato nell'ottobre 2007) e **PdL** (Forza Italia + Alleanza Nazionale, lista unica nel 2008). La Lega
       risorge dal minimo del 2001. E **la sinistra radicale resta fuori dall'aula** — la prima volta senza
       comunisti in Parlamento dal 1946: `esce` senza `confluisce_in`, cioè la dispersione, come il PSI nel '94.
       I minori del vecchio quadro (PSDI, PRI, PLI, Monarchici, CCD) escono anche loro: il bipolarismo del
       Porcellum non lascia spazio a nessuno sotto la soglia. */
    2008: { rinomina:[ {id:'i50_pci', nome:'PD'}, {id:'i90_fi', nome:'PdL'} ],
            esce:[ {id:'i00_marg', confluisce_in:'i50_pci'}, {id:'i50_msi', confluisce_in:'i90_fi'},
                   {id:'i90_prc'}, {id:'i90_ccd', confluisce_in:'i90_fi'},
                   {id:'i50_psdi'}, {id:'i50_pri'}, {id:'i50_pli'}, {id:'i50_pnm'} ],
            delta:[ {id:'i90_lega',delta:4}, {id:'i50_pci',delta:-2}, {id:'i90_fi',delta:-2} ] }
  }
};
/* ============================================================================================================
   L34-1 · IL CICLO DI VITA DEI PARTITI — nascite, morti, cambi di nome.
   Un roster fisso bastava fino al '70; dagli '80 non basta più (i Verdi nell'87) e nel '90 sarebbe una bugia.

   LA FORMA. Le direttive vivono **accanto ai delta, dentro la tappa** — non in `LINEE_STORICHE` come diceva la
   consegna: le tappe stanno in `RIALLINEAMENTI_ERA` e sono già indicizzate per anno, una struttura parallela
   sarebbe stata un secondo posto dove cercare la stessa cosa. Una tappa può quindi essere:
     · un ARRAY di delta (la forma di sempre, invariata)
     · un oggetto a RAMI (il '63, che sceglie su `S.apertura`)
     · un oggetto `{delta:[], entra:[], esce:[], rinomina:[]}` — la forma nuova.

   IL VINCOLO CHE DECIDE TUTTO (ricognizione L32-1): **il roster non è in `S`**. `PAESE` viene ricostruito a ogni
   `applySnap` dallo scenario, quindi una mutazione a runtime si dissolverebbe al primo caricamento. Per questo
   ogni direttiva applicata si registra in **`S.rosterDelta`** (dato puro), e `applySnap` la RIAPPLICA subito
   dopo `paeseConScenario`. Il registro è la verità; PAESE è solo la sua proiezione.
   ============================================================================================================ */
function applicaRosterDelta(){
  if(typeof S==='undefined' || !S || !S.rosterDelta || !PAESE || !PAESE.partiti) return;
  var R=S.rosterDelta;
  if(!(R.entra||[]).length && !(R.esce||[]).length && !(R.rinomina||[]).length) return;
  var lista = PAESE.partiti.map(function(p){ return Object.assign({}, p); });   // clone: `paeseConScenario` condivide l'array con SCENARI, mutarlo lo corromperebbe
  (R.esce||[]).forEach(function(e){ lista = lista.filter(function(p){ return p.id!==e.id; }); });
  (R.rinomina||[]).forEach(function(r){ var p=lista.find(function(x){ return x.id===r.id; }); if(p) p.nome=r.nome; });
  (R.entra||[]).forEach(function(n){
    if(lista.some(function(p){ return p.id===n.id; })) return;
    lista.push({ id:n.id, nome:n.nome, orientamento:n.orientamento||'centro', base:n.base||{}, forza:n.forza||1, asse:(n.asse!=null?n.asse:0), gruppoUE:n.gruppoUE||'noniscritti' });
  });
  PAESE.partiti = lista;
}
/* Applica UNA direttiva: aggiorna il registro in S e i dizionari per-id che sarebbero rimasti orfani. */
function applicaDirettive(d){
  if(!d) return;
  S.rosterDelta = S.rosterDelta || {entra:[], esce:[], rinomina:[]};
  (d.entra||[]).forEach(function(n){
    S.rosterDelta.entra.push(n);
    /* correzione #1 della ricognizione: il roster da solo non basta — un partito senza forza non esiste per il
       motore (evolvePartiti, seggi, blocco). La forza dichiarata la si prende dagli altri, rinormalizzando dopo. */
    if(S.forze && S.forze[n.id]==null)     S.forze[n.id]=n.forza||1;
    if(S.forzePrev && S.forzePrev[n.id]==null) S.forzePrev[n.id]=n.forza||1;
    if(S.seggi && S.seggi[n.id]==null)     S.seggi[n.id]=0;   // i seggi si ricalcolano alla prossima urna
  });
  (d.rinomina||[]).forEach(function(r){
    /* L40-1 — stessa medicina di `esce` (correzione #3 di L34-1): **il partito del giocatore non cambia nome
       per direttiva.** Il '91 rinomina il partito comunista, ma se è il TUO quella non è una tappa: è lo
       snodo-scissione, dove la scelta è tua (L40-2). Senza questa riga il giocatore si sarebbe trovato il
       partito ribattezzato sotto i piedi, in silenzio. */
    if(r.id===S.partito){ if(typeof console!=='undefined' && console.warn) console.warn('[roster] direttiva `rinomina` sul partito del giocatore ('+r.id+'): ignorata, serve uno snodo.'); return; }
    S.rosterDelta.rinomina.push(r);
  });
  (d.esce||[]).forEach(function(e){
    /* correzione #3: il partito DEL GIOCATORE non esce mai per direttiva — quello è uno snodo (lo scioglie il
       lotto successivo). Se capitasse, è un bug di dati: lo si fa emergere, non lo si subisce in silenzio. */
    if(e.id===S.partito){ if(typeof console!=='undefined' && console.warn) console.warn('[roster] direttiva `esce` sul partito del giocatore ('+e.id+'): ignorata, serve uno snodo.'); return; }
    S.rosterDelta.esce.push(e);
    var dest=e.confluisce_in;
    /* correzione #2: niente id orfani. Forza, intese e territori TRAVASANO nel partito d'arrivo (o si perdono
       dichiaratamente se la direttiva non ne indica uno). */
    if(S.forze && S.forze[e.id]!=null){ if(dest && S.forze[dest]!=null) S.forze[dest]+=S.forze[e.id]; delete S.forze[e.id]; }
    if(S.forzePrev && S.forzePrev[e.id]!=null){ if(dest && S.forzePrev[dest]!=null) S.forzePrev[dest]+=S.forzePrev[e.id]; delete S.forzePrev[e.id]; }
    if(S.seggi && S.seggi[e.id]!=null){ if(dest && S.seggi[dest]!=null) S.seggi[dest]+=S.seggi[e.id]; delete S.seggi[e.id]; }
    if(S.intese && S.intese[e.id]!=null){ if(dest) S.intese[dest]=Math.max(S.intese[dest]||0, S.intese[e.id]); delete S.intese[e.id]; }
    if(Array.isArray(S.coalizione)){ S.coalizione=S.coalizione.filter(function(id){ return id!==e.id; }); if(dest && S.coalizione.indexOf(dest)<0 && S.partito!==dest) S.coalizione.push(dest); }
    if(Array.isArray(S.territori)) S.territori.forEach(function(t){ if(t && t.partito===e.id) t.partito = dest || S.partito; });
    if(S.tavoloPid===e.id) S.tavoloPid = dest || null;
  });
  applicaRosterDelta();
}
/* ============================================================================================================
   L40-2 · LA SCISSIONE DEL PARTITO DEL GIOCATORE. È il primo snodo che riscrive il partito di chi gioca, e
   usa il travaso costruito in L34-1 — ma NON può passare da `applicaDirettive`, che per progetto rifiuta
   `esce` e `rinomina` sul partito del giocatore (sarebbe una tappa che decide al posto suo). Qui la decisione
   è stata sua: si scrive nel registro direttamente, e `applicaRosterDelta` proietta.
   IL GIOCATORE NON PERDE MAI NIENTE: tiene il suo id, quindi forze, seggi, intese, coalizione e territori
   restano attaccati a lui — cambia casa, non ricomincia. Chi se ne va nasce come partito NPC, con la quota
   che gli spetta sottratta alla sua.
     svolta       → tieni i ⅔, il nome cambia, esce la minoranza
     rifondazione → tieni la bandiera e ⅓, il grosso se ne va col nome nuovo
   ============================================================================================================ */
function scissioneApplica(ramo){
  if(typeof S==='undefined' || !S || !S.partito) return;
  var mio=S.partito, quota=(S.forze&&S.forze[mio]!=null)?S.forze[mio]:20;
  var svolta=(ramo==='svolta');
  var mia = svolta ? quota*0.66 : quota*0.30;                      // quello che resta a te
  var loro = Math.max(2, quota - mia);                             // quello che se ne va
  S.rosterDelta = S.rosterDelta || {entra:[], esce:[], rinomina:[]};
  S.rosterDelta.rinomina.push({ id:mio, nome: svolta ? 'PDS' : 'Rifondazione' });
  var nuovo = svolta
    ? { id:'i90_prc', nome:'Rifondazione', orientamento:'sinistra',       base:{lavoratori:0.6, giovani:0.4},  forza:loro, asse:-2, gruppoUE:'sinistra' }
    : { id:'i90_pds', nome:'PDS',          orientamento:'centrosinistra', base:{lavoratori:0.5, cetomedio:0.5}, forza:loro, asse:-1, gruppoUE:'socialisti' };
  S.rosterDelta.entra.push(nuovo);
  if(S.forze){ S.forze[mio]=mia; S.forze[nuovo.id]=loro; }
  if(S.forzePrev){ S.forzePrev[mio]=mia; S.forzePrev[nuovo.id]=loro; }
  if(S.seggi && S.seggi[nuovo.id]==null) S.seggi[nuovo.id]=0;
  applicaRosterDelta();
  /* l'asse del giocatore si sposta col nome: la svolta apre al centro, la rifondazione resta dov'era */
  if(svolta){ var mp=PAESE.partiti.filter(function(x){return x.id===mio;})[0]; if(mp){ mp.asse=-1; mp.orientamento='centrosinistra'; } }
  if(svolta){ stampad(3); gd('giovani',2); gd('cetomedio',2); gd('lavoratori',-2);
    bioFatto('La svolta: il partito ha cambiato nome, e tu c\'eri.'); }
  else { stampad(-2); gd('lavoratori',3); gd('giovani',1); gd('cetomedio',-3); gd('imprenditori',-2);
    bioFatto('Hai tenuto la bandiera quando tutti la ammainavano.'); }
}
/* ============================================================================================================
   L41-1 · I TRE SNODI GEMELLI DELLA FRANA (DC, PSI, MSI). Stesso motore della scissione-PCI, generalizzato:
   quello era cablato su nomi e quote del partito comunista, questi hanno forme diverse. Tre movimenti
   possibili, e ogni ramo dei tre snodi è uno di questi:
     A) TI DIVIDI  — resti dove sei con un nome nuovo e una quota, il resto esce come NPC       (`dividi`)
     B) CROLLI     — resti dove sei, ridotto ai minimi, e il resto si DISPERDE senza erede      (`disperdi`)
     C) CAMBI CASA — `S.partito` diventa un altro partito, e ti porti dietro tutto              (`trasloca`)
   Il giocatore non perde mai niente in nessuno dei tre: nel caso C il travaso è quello di L34-1.
   ============================================================================================================ */
/* La somma delle forze deve restare 100: la dispersione ne toglie, un partito che nasce ne aggiunge. La
   tappa rinormalizza gia da se (riallineamentoTappa); questi movimenti no, e senza questa riga il PSI-lume
   chiudeva a 92 e il PSI-nel-polo a 115. Misurato prima di accorgersene: la somma e la spia. */
function rinormalizzaForze(){
  if(typeof S==='undefined' || !S || !S.forze || !PAESE || !PAESE.partiti) return;
  var sum=0; PAESE.partiti.forEach(function(p){ sum+=(S.forze[p.id]||0); });
  if(sum>0) PAESE.partiti.forEach(function(p){ S.forze[p.id]=(S.forze[p.id]||0)/sum*100; });
  S.forzePrev=Object.assign({}, S.forze);
}
function _partitoDef(d){ return { id:d.id, nome:d.nome, orientamento:d.orientamento||'centro', base:d.base||{}, forza:d.forza||1, asse:(d.asse!=null?d.asse:0), gruppoUE:d.gruppoUE||'noniscritti' }; }

/* A · TI DIVIDI: tieni `resto` della tua forza col nome nuovo, il resto se ne va come partito NPC. */
function scissioneDividi(nomeNuovo, quotaMia, npc, asseNuovo){
  if(typeof S==='undefined' || !S || !S.partito) return;
  var mio=S.partito, tot=(S.forze&&S.forze[mio]!=null)?S.forze[mio]:20;
  var mia=Math.max(1, tot*quotaMia), loro=Math.max(1, tot-mia);
  S.rosterDelta = S.rosterDelta || {entra:[], esce:[], rinomina:[]};
  if(nomeNuovo) S.rosterDelta.rinomina.push({ id:mio, nome:nomeNuovo });
  var n=_partitoDef(Object.assign({}, npc, {forza:loro}));
  S.rosterDelta.entra.push(n);
  if(S.forze){ S.forze[mio]=mia; S.forze[n.id]=loro; }
  if(S.forzePrev){ S.forzePrev[mio]=mia; S.forzePrev[n.id]=loro; }
  if(S.seggi && S.seggi[n.id]==null) S.seggi[n.id]=0;
  applicaRosterDelta();
  if(asseNuovo!=null){ var mp=PAESE.partiti.filter(function(x){return x.id===mio;})[0]; if(mp) mp.asse=asseNuovo; }
  rinormalizzaForze();
}
/* B · CROLLI: resti, ma ridotto al minimo. Quello che perdi NON va a nessuno — si redistribuisce alla
   rinormalizzazione, che è la dispersione vera (la stessa scelta fatta per il PSI della tappa-NPC). */
function scissioneDisperdi(nomeNuovo, forzaResidua){
  if(typeof S==='undefined' || !S || !S.partito) return;
  var mio=S.partito;
  S.rosterDelta = S.rosterDelta || {entra:[], esce:[], rinomina:[]};
  if(nomeNuovo) S.rosterDelta.rinomina.push({ id:mio, nome:nomeNuovo });
  if(S.forze) S.forze[mio]=forzaResidua;
  if(S.forzePrev) S.forzePrev[mio]=forzaResidua;
  applicaRosterDelta();
  rinormalizzaForze();
}
/* C · CAMBI CASA: `S.partito` diventa un altro partito. Se non esiste ancora nel roster lo si crea (il caso
   del PSI che passa al nuovo polo nel '93, quando quel partito non è ancora nato). Il vecchio partito ESCE e
   tutto quello che aveva — forza, seggi, intese, coalizione, territori — traslocando arriva al nuovo: è il
   travaso di L34-1, usato qui per la prima volta sul partito di chi gioca. */
function scissioneTrasloca(destId, destDef){
  if(typeof S==='undefined' || !S || !S.partito || destId===S.partito) return;
  var vecchio=S.partito;
  S.rosterDelta = S.rosterDelta || {entra:[], esce:[], rinomina:[]};
  var esiste=PAESE.partiti.some(function(x){ return x.id===destId; });
  if(!esiste && destDef){ S.rosterDelta.entra.push(_partitoDef(destDef));
    if(S.forze && S.forze[destId]==null) S.forze[destId]=destDef.forza||1;
    if(S.forzePrev && S.forzePrev[destId]==null) S.forzePrev[destId]=destDef.forza||1;
    if(S.seggi && S.seggi[destId]==null) S.seggi[destId]=0;
    applicaRosterDelta();
  }
  S.partito=destId;                                        // PRIMA di far uscire il vecchio: così la guardia
  S.rosterDelta.esce.push({id:vecchio, confluisce_in:destId});   // di `applicaDirettive` non lo scambia per il tuo
  if(S.forze && S.forze[vecchio]!=null){ if(S.forze[destId]!=null) S.forze[destId]+=S.forze[vecchio]; delete S.forze[vecchio]; }
  if(S.forzePrev && S.forzePrev[vecchio]!=null){ if(S.forzePrev[destId]!=null) S.forzePrev[destId]+=S.forzePrev[vecchio]; delete S.forzePrev[vecchio]; }
  if(S.seggi && S.seggi[vecchio]!=null){ if(S.seggi[destId]!=null) S.seggi[destId]+=S.seggi[vecchio]; delete S.seggi[vecchio]; }
  if(S.intese && S.intese[vecchio]!=null) delete S.intese[vecchio];      // le intese col te stesso di prima non hanno senso
  if(S.intese && S.intese[destId]!=null) delete S.intese[destId];        // né con la casa in cui ora abiti
  if(Array.isArray(S.coalizione)) S.coalizione=S.coalizione.filter(function(id){ return id!==vecchio && id!==destId; });
  if(Array.isArray(S.territori)) S.territori.forEach(function(t){ if(t && t.partito===vecchio) t.partito=destId; });
  if(S.tavoloPid===vecchio) S.tavoloPid=destId;
  applicaRosterDelta();
  rinormalizzaForze();
}
/* ============================================================================================================
   L44-1 · IL CHANGEOVER — l'unico cambio-valuta in corsa di tutta la linea. Il 1° gennaio 2002 la lira esce
   di scena: `S.valuta` torna a `null`, che nel gioco vuol dire euro (`euro()` in ui.js legge quel campo e col
   null fa esattamente quello che ha sempre fatto nel presente). Non serve altro: il resto del bilancio è a
   rapporti, quindi cambia il modo di scrivere i numeri, non i numeri.
   È idempotente e reload-safe: `S.valuta` sta dentro S, quindi il salvataggio se lo porta dietro, e la
   funzione non fa nulla se il cambio è già avvenuto. Il beat nel log esce UNA volta sola, al mese giusto. */
function changeoverEuro(){
  if(typeof S==='undefined' || !S || S.era!==LINEA_IT) return;
  if(!S.valuta) return;                                  // già in euro (o presente): niente da fare
  if(S.year<2002) return;
  /* LA CIFRA VA CONVERTITA, non solo l etichetta. Senza questa riga il PIL passava da «L. 1.358 mld lire» a
     «€1,36 tln»: stesso numero, valuta nuova, e il paese sembrava aver raddoppiato la ricchezza in una notte.
     Il fattore è 1,93627 e non 1936,27 perché cambia anche l unità di lettura del campo (il ramo-lira di euro()
     stampa  in miliardi, il ramo-euro in milioni). Verificato: 1.358.000 -> 701.349, cioè «€0,70 tln»,
     che è il PIL italiano vero del 1990 in euro. Tutto il resto del motore è a RAPPORTI e non si tocca: debito
     e disavanzo restano percentuali, e il bilancio locale (che scala su S.pil) si converte da sé. */
  if(S.pil) S.pil = Math.round(S.pil / 1.93627);
  S.valuta = null;
  if(S.log) S.log.unshift({t:T('L\'euro'), x:T('Da oggi i prezzi si scrivono in euro: milleNovecentoTrentasei lire e ventisette centesimi ne fanno uno. Il portafoglio è lo stesso, i conti sembrano un altro paese.')});
}
/* L40-2 · IL CLIMA «QUESTIONE MORALE» (scheda §10.5): una campana, non un interruttore — sale dal '92, picco
   nel '93, scende dal '95. Come il clima-'70 tocca poche leve dichiarate, e **non somma** col resto: la decade
   ha anche il telefonino e le notti magiche. Qui muove tre soglie di `pescaInchiesta`, che già esistono. */
const MORALE90 = [ {da:1992, v:0.6}, {da:1993, v:1}, {da:1995, v:0.6}, {da:1997, v:0.3}, {da:1999, v:0} ];
function climaMorale(){
  if(typeof S==='undefined' || !S || S.era!==LINEA_IT) return 0;
  var v=0; for(var i=0;i<MORALE90.length;i++){ if(S.year>=MORALE90[i].da) v=MORALE90[i].v; }
  return v;
}
function riallineamentoTappa(){
  if(typeof S==='undefined' || !S) return;
  if(typeof changeoverEuro==='function') changeoverEuro();   // L44-1: lo scatto della valuta vive qui, dove il mese comincia
  var perAnno = S.era && RIALLINEAMENTI_ERA[S.era];
  if(!perAnno) return;                              // presente: no-op
  if(!S.riallineamenti) S.riallineamenti={};
  if(S.riallineamenti[S.year]) return;              // one-shot per tappa: già applicata
  var entry = perAnno[S.year];
  if(!entry) return;                                // quest'anno non è una tappa della linea
  var direttive=null, shifts;
  if(Array.isArray(entry)) shifts=entry;                                              // forma di sempre
  else if(entry.delta || entry.entra || entry.esce || entry.rinomina){                // forma nuova (L34-1)
    /* L40-1 — `se`: una tappa può valere solo a certe condizioni. Serve al '91: la scissione del partito
       comunista è una direttiva-NPC **solo se non è il partito del giocatore** — nel qual caso la stessa
       storia si gioca come snodo (L40-2). La tappa resta marcata come fatta: non deve ritentare ogni anno. */
    if(typeof entry.se==='function'){ var ok=false; try{ ok=entry.se(); }catch(_){ ok=false; }
      if(!ok){ S.riallineamenti[S.year]=true; return; } }
    shifts=entry.delta||[]; direttive=entry;
  } else shifts=entry[(S.apertura==='apri') ? 'apertura' : 'centrismo'];               // '63: ramo su S.apertura
  if(direttive) applicaDirettive(direttive);        // PRIMA i nuovi entrano, poi i delta li trovano nel roster
  if(!shifts || !shifts.length){ if(direttive){ S.riallineamenti[S.year]=true; } return; }
  if(S.forze && PAESE && PAESE.partiti){
    shifts.forEach(function(sh){ if(S.forze[sh.id]!=null) S.forze[sh.id]=Math.max(2, S.forze[sh.id]+sh.delta); });
    var sum=0; PAESE.partiti.forEach(function(p){ sum+=(S.forze[p.id]||0); });
    if(sum>0) PAESE.partiti.forEach(function(p){ S.forze[p.id]=(S.forze[p.id]||0)/sum*100; });   // rinormalizza a 100
    S.forzePrev=Object.assign({}, S.forze);
  }
  if(S.log){   // beat visibile della tappa (il quadro politico che si assesta)
    if(S.year===1958) S.log.unshift({t:T('Elezioni 1958'), x:T('Il quadro si assesta: il PSI cresce e si stacca, i monarchici arretrano.')});
    else if(S.year===1963) S.log.unshift({t:T('Elezioni 1963'), x:(S.apertura==='apri') ? T('Con l\'apertura a sinistra il PLI raddoppia: la reazione moderata prende forma.') : T('Il centrismo tiene: nessuna svolta, il logorio prosegue.')});
    else if(S.year===1972) S.log.unshift({t:T('Elezioni 1972'), x:T('La destra si unisce in un solo cartello e i monarchici vi confluiscono: il quadro si semplifica a destra.')});
    else if(S.year===1976) S.log.unshift({t:T('Elezioni 1976'), x:T('Il paese si divide in due grandi blocchi: i partiti laici minori vengono schiacciati.')});
    else if(S.year===1979) S.log.unshift({t:T('Elezioni 1979'), x:T('L\'onda si ritira: la sinistra arretra per la prima volta da trent\'anni e i piccoli tornano a respirare.')});
    else if(S.year===1983) S.log.unshift({t:T('Elezioni 1983'), x:T('Il partito di maggioranza relativa tocca il suo minimo: i laici crescono e i socialisti diventano l\'ago della bilancia.')});
    else if(S.year===1987) S.log.unshift({t:T('Elezioni 1987'), x:T('I socialisti toccano il massimo dal dopoguerra, la sinistra storica arretra ancora, l\'onda laica si ritira.')});
    /* L40-1 — i beat della frana. Tutte le tappe precedenti ne hanno uno: senza, il giocatore vedrebbe il
       roster cambiare sotto gli occhi senza una riga che glielo racconti — e qui non cambiano i pesi, cambiano
       le entità. Registro descrittivo come le altre tappe: cronaca, mai giudizio. */
    else if(S.year===1991) S.log.unshift({t:T('Il congresso della svolta'), x:T('Il partito comunista cambia nome e simbolo; una minoranza non segue e fonda la sua casa. La sinistra italiana si divide in due.')});
    else if(S.year===1992) S.log.unshift({t:T('Elezioni 1992'), x:T('Il partito di maggioranza relativa scende sotto una soglia mai toccata, e dal Nord entra in Parlamento una forza nuova. Il quadro non è più quello di sempre.')});
    else if(S.year===1994) S.log.unshift({t:T('La frana'), x:T('In un anno il partito che ha governato per mezzo secolo si scioglie e i socialisti chiudono; nasce un partito nuovo che al debutto è già primo, e la destra cambia nome. Il sistema dei partiti non esiste più.')});
    else if(S.year===1996) S.log.unshift({t:T('Elezioni 1996'), x:T('Due coalizioni si contendono il paese: il bipolarismo prende la forma che avrà per vent’anni.')});
    /* L44-1 — i beat dell'ultimo decennio */
    else if(S.year===2001) S.log.unshift({t:T('Elezioni 2001'), x:T('L\'alternanza è compiuta: si cambia governo con le urne, e nessuno lo trova più straordinario.')});
    else if(S.year===2006) S.log.unshift({t:T('Elezioni 2006'), x:T('Il paese si spacca a metà: alla Camera decidono poche migliaia di voti. Governare con quel margine sarà un\'altra cosa.')});
    else if(S.year===2008) S.log.unshift({t:T('Elezioni 2008'), x:T('Due partiti grandi nati da altrettante fusioni si prendono quasi tutto, e per la prima volta dal dopoguerra la sinistra radicale resta fuori dall\'aula.')});
  }
  S.riallineamenti[S.year]=true;
}
/* Build B — il clone-PAESE d'epoca: sovrappone a un PAESE base gli override dello scenario (partiti, ue, intermedie…),
   MAI mutando PAESI. Unica fonte di verità, usata da setScenario (avvio) e applySnap (load). */
function paeseConScenario(base, sc){
  if(!sc) return base;
  var ov={};
  if(sc.partiti && sc.partiti.length) ov.partiti=sc.partiti;
  if(sc.ue!==undefined) ov.ue=sc.ue;                 // (ii) es. ue:false → tutta la struttura UE inerte nel '50
  if(sc.intermedie) ov.intermedie=sc.intermedie;     // (ii) calendario elettorale d'epoca (niente europee)
  return Object.keys(ov).length ? Object.assign({}, base, ov) : base;
}

/* ============================================================================
   Build B 1b — SNODO «legge truffa» (Italia 1950 → elezione 1953). ONE-SHOT.
   La legge (premio di maggioranza reale: >50% dei voti al blocco → 64,4% dei seggi,
   L. 148/1953) è un FATTO DI SFONDO; la piega è al SEGGIO. Presentato NEUTRALE:
   scatta/manca senza posizione (la conseguenza sì, il giudizio no; nessuna morte,
   entrambi legittimi). Guardato su S.era → mai tocca il presente né altri paesi.
   Margine reale sottilissimo (~0,2%): il consenso costruito e la coalizione formata
   nei 3 anni spostano il blocco sopra o sotto la riga.
   ============================================================================ */
const TRUFFA_SOGLIA=50, TRUFFA_PREMIO=64.4;
function snodoTruffaAttivo(){ return typeof S!=='undefined' && S && S.era===LINEA_IT && !S.truffaFatta && S.year<=1953 && PAESE.comeSiVince==='parlamentare'; }   // Lotto A: la legge è del 1953 — dopo, lo snodo non fira più (il beat dice «del 1953»)
/* voto del blocco = somma forze del blocco / somma forze totali × 100 (i "voti" normalizzati del sistema).
   Cantiere B — il blocco dello snodo è l'APPARENTAMENTO (storico: la L.148/1953 premiava le liste APPARENTATE —
   DC+PSDI+PLI+PRI insieme al 49,8%): coalizione ∪ compatibili per asse (|Δ|≤1 = esattamente l'area centrista;
   Fronte −2 e Monarchici/MSI +2 restano fuori, come nella storia). Col perno-logorio la DC da sola declina verso
   il ~40 storico: senza l'apparentamento il premio sarebbe irraggiungibile per costruzione. */
function bloccoApparentato(){
  var ids=(S.coalizione||[S.partito]).slice();
  compatibili(S.partito).forEach(function(p){ if(ids.indexOf(p.id)<0) ids.push(p.id); });
  return ids;
}
function votoBloccoTruffa(){
  var ids=bloccoApparentato();
  var tot=PAESE.partiti.reduce(function(s,p){return s+((S.forze&&S.forze[p.id])||0);},0)||1;
  var bl=ids.reduce(function(s,id){return s+((S.forze&&S.forze[id])||0);},0);
  return bl/tot*100;
}
/* Applica lo snodo alla RISOLUZIONE (dopo la notte, in concludiNotte): valuta il blocco; se supera la soglia
   sovrascrive i seggi col premio (64,4% al blocco pro-quota, il resto agli altri pro-quota, resto-massimo → somma 100),
   altrimenti lascia l'esito reale. Registra truffaEsito e alza il flag one-shot. Modifica S.seggi in loco. */
/* Build B (b) — la scelta è dovuta? Solo il PREMIER nel '50, nell'anno pre-voto, se non ha ancora deciso.
   Un non-premier (attivista/sindaco/opposizione) non la vede mai → leggeTruffa resta null → esito 'norma' (degradazione graziosa). */
function snodoSceltaDovuta(){ return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && !S.opposizione && S.leggeTruffa==null && S.year<=1952 && S.turnInMandate===(PAESE.mandatoMesi/12 - 1); }   // Lotto A: falla chiusa — un premier arrivato tardi non riceve la carta nel '56+ («legge del 1953» in un anno sbagliato)
/* AVANZAMENTO Lotto 4 — gate degli snodi '60 (gemelli di snodoSceltaDovuta): premier nel '50, '62-63, one-shot per flag. */
function snodoEnelDovuta(){ return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && !S.opposizione && S.enel==null && S.year>=1962 && S.year<=1963; }
function snodoAperturaDovuta(){ return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && !S.opposizione && S.apertura==null && S.year>=1962 && S.year<=1963; }
/* L28-3 — i tre snodi degli anni '70. Stesso gate degli snodi '60 (linea storica, premier, one-shot, finestra
   d'anni), finestre disgiunte così non si contendono mai lo stesso mese: austerity '73-'74, divorzio '74-'75,
   solidarietà '76-'78. L'ordine d'iniezione rispetta la cronologia. */
function snodoAusterityDovuta(){    return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && !S.opposizione && S.austerity==null    && S.year>=1973 && S.year<=1974; }
function snodoDivorzioDovuta(){     return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && !S.opposizione && S.divorzio==null     && S.year>=1974 && S.year<=1975; }
function snodoSolidarietaDovuta(){  return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && !S.opposizione && S.solidarieta==null  && S.year>=1976 && S.year<=1978; }
/* L33-1 - i tre snodi degli anni 80. Finestre disgiunte come nel 70: divorzio-BdI 81-82, scala mobile 84-85,
   nucleare 87-88. Nessuna si sovrappone alle finestre del 70 (l ultima chiude nel 78). */
function snodoDivorzioBdiDovuta(){ return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && !S.opposizione && S.divorzioBdi==null && S.year>=1981 && S.year<=1982; }
function snodoScalaMobileDovuta(){ return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && !S.opposizione && S.scalaMobile==null && S.year>=1984 && S.year<=1985; }
/* L40-2 · i gate del '90. Stessa forma degli snodi '70/'80: premier, one-shot, dentro la finestra storica. */
function snodoMaastrichtDovuta(){   return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && !S.opposizione && S.maastricht==null  && S.year>=1992 && S.year<=1997; }
function snodoMattarellumDovuta(){  return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && !S.opposizione && S.mattarellum==null && S.year>=1993 && S.year<=1994; }
/* la questione morale non è una scelta di calendario ma la risposta a un'inchiesta che è già addosso */
function snodoMoraleDovuta(){       return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && S.questioneMorale==null && !!S.inchiesta && S.year>=1992 && S.year<=1996; }
/* L44-2 · i gate del 2000, gli ultimi della linea. Le due FUSIONI valgono solo per chi gioca quel partito
   — altrimenti la stessa storia la fa la direttiva-tappa del 2008 (L44-1), e i due non possono scattare
   insieme perché guardano la stessa condizione su `S.partito`. La finestra sta a cavallo del 2007-08, cioè
   fra l'annuncio e la lista unica: è lì che la scelta era vera. */
function snodoPorcellumDovuta(){ return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && !S.opposizione && S.porcellum==null && S.year>=2005 && S.year<=2006; }
function snodoCrisi08Dovuta(){   return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && !S.opposizione && S.crisi08==null  && S.year>=2008 && S.year<=2010; }
function snodoFusionePdDovuta(){ return typeof S!=='undefined' && S && S.era===LINEA_IT && S.partito==='i50_pci' && S.fusionePd==null  && ((S.year===2007 && S.month>=6) || S.year===2008); }
function snodoFusionePdlDovuta(){return typeof S!=='undefined' && S && S.era===LINEA_IT && S.partito==='i90_fi'  && S.fusionePdl==null && ((S.year===2007 && S.month>=11) || S.year===2008); }
function snodoFuoriAulaDovuta(){ return typeof S!=='undefined' && S && S.era===LINEA_IT && S.partito==='i90_prc' && S.fuoriAula==null  && S.year>=2007 && S.year<=2008; }
/* L41-1 · i tre gemelli. Ognuno vale SOLO per chi gioca quel partito: se non è il tuo, la stessa storia la
   racconta la direttiva-NPC della tappa (L40-1), e i due non possono scattare insieme — il `se` della tappa
   e questi gate sono mutuamente esclusivi per costruzione, sulla stessa condizione `S.partito`.
   ⚠ La finestra del PSI la scheda la dà come «'93» nel sottotitolo e «1993-94» nel titolo: l'ho aperta su
   ENTRAMBI gli anni, perché il ramo «nel nuovo polo» ha bisogno che quel partito esista o possa nascere. */
function snodoDcDovuta(){    return typeof S!=='undefined' && S && S.era===LINEA_IT && S.partito==='i50_dc'  && S.diaspora==null   && ((S.year===1993 && S.month>=12) || (S.year===1994 && S.month<=2)); }
function snodoPsiDovuta(){   return typeof S!=='undefined' && S && S.era===LINEA_IT && S.partito==='i50_psi' && S.crolloPsi==null   && S.year>=1993 && S.year<=1994; }
function snodoMsiDovuta(){   return typeof S!=='undefined' && S && S.era===LINEA_IT && S.partito==='i50_msi' && S.fiuggi==null      && ((S.year===1994 && S.month>=12) || (S.year===1995 && S.month<=2)); }
/* LA SCISSIONE: solo per chi gioca il partito comunista, e in due tempi — la scelta a fine '89, il congresso
   nel febbraio '91, come nella storia. Fra i due c'è un anno di attesa: è il tempo del dibattito. */
function snodoScissioneDovuta(){    return typeof S!=='undefined' && S && S.era===LINEA_IT && S.partito==='i50_pci' && S.scissione==null && S.year>=1989 && S.year<=1990; }
function snodoCongressoDovuto(){    return typeof S!=='undefined' && S && S.era===LINEA_IT && S.partito==='i50_pci' && !!S.scissione && !S.scissioneFatta && (S.year>1991 || (S.year===1991 && S.month>=2)); }
function snodoNucleareDovuta(){    return typeof S!=='undefined' && S && S.era===LINEA_IT && S.livello===3 && !S.opposizione && S.nucleare==null    && S.year>=1987 && S.year<=1988; }
/* CURA Lotto P3 (#9) — il richiamo delle correnti è dovuto? Premier, una corrente sotto la soglia critica-recuperabile
   (umore<40) PRIMA della sfida (<35), nessuna sfida già in corso, cooldown 8 mesi. Ogni valuta-silenziosa che degrada
   deve chiamare in tempo per rimediare (mai imboscata a freddo). */
/* ===== G4 — LO SCHEDULER DELLA LEGGEREZZA. ~1 beat ogni 2 mesi, ADDITIVO (non sostituisce il contenuto del mese:
   è respiro, non razione). Col CEDIMENTO: il paese che parla d'altro non parla d'altro il giorno sbagliato.
   Effetti zero nei beat → nessun farming possibile per costruzione. ===== */
function graveInCorso(){
  if(typeof S==='undefined' || !S) return true;
  if(S.inchiesta) return true;                                                     // l'inchiesta al vertice
  if(typeof periodoSondaggi==='function' && periodoSondaggi()) return true;        // la settimana elettorale
  if(S.campNaz) return true;                                                       // campagna nazionale in corso
  /* L29-1 — IL CRITERIO-FIDUCIA È USCITO DA QUI, ed è una regola di design, non una taratura.
     `fiducia<40` non è un evento: è una CONDIZIONE CRONICA. Misurato in L28-6: la fiducia scende sotto 40 dal
     1965 e non risale più (76 nel '50 → 38 nel '65 → 29-36 in tutti gli anni '70), quindi il cedimento
     dichiarava «giorno sbagliato» ogni mese per quindici anni e spegneva la leggerezza per sempre.
     Il cedimento legge gli STATI ACUTI, non la condizione cronica: un paese in difficoltà ha comunque le sue
     feste e il suo campionato — l'Italia degli anni di piombo è esattamente il paese della settimana bianca.
     Stessa logica del fuori-verbale, che questo gate non l'ha mai avuto (L14-1): gli eventi bloccano, gli stati no. */
  if(S.minoranza && (S.mesiMinoranza||0)>0) return true;                           // sfiducia incombente
  if(S.convalescenza && (S.year*12+S.month)<S.convalescenza) return true;          // convalescenza: il lutto/la malattia
  if(S.agenda && S.agenda.some(function(a){ return a && a.data && a.data.tono==='grave'; })) return true;   // un grave già sul tavolo
  return false;
}
function leggeroDovuto(){
  if(typeof S==='undefined' || !S || typeof BEAT_LEGGERI==='undefined') return false;
  if(S.livello===0) return false;                     // la gavetta ha il suo flusso (A.5): niente iniezioni qui
  var mese=S.year*12+S.month;
  if(S.leggeroUltimo!=null && mese-S.leggeroUltimo<2) return false;   // ~1 ogni 2 mesi
  return !graveInCorso();
}
/* L14-1 — IL TESSUTO DEL FUORI-VERBALE: innesco dei beat-retroscena. Gemello di `leggeroDovuto`, con tre differenze:
   (1) solo dove le stanze del potere esistono — **livello 3 o opposizione** (i testi parlano di nomine, commissioni,
   controparti: da attivista/sindaco non avrebbero senso); (2) cadenza **4 mesi** — frequente ma sotto i beat leggeri
   (2), perché il retroscena è tessuto; (3) **NIENTE gate `graveInCorso`** — qui mi ero sbagliato per analogia: il
   cedimento-G4 esiste perché la LEGGEREZZA stona nei mesi neri, ma il fuori-verbale non è leggero, è cupo di suo
   (un sussurro in corridoio durante una crisi è esattamente il suo posto). MISURATO: col gate, `graveInCorso`
   bloccava il **76% dei mesi** e i beat uscivano 1 ogni 20 — più rari degli archi, l'opposto dell'obiettivo.
   Gli ARCHI restano gli snodi (prob 0.14 / cooldown 24); i beat sono il tessuto. */
function retroDovuto(){
  if(typeof S==='undefined' || !S || typeof RETRO_BEAT==='undefined') return false;
  if(!(S.livello===3 || S.opposizione)) return false;
  var mese=S.year*12+S.month;
  if(S.retroUltimo!=null && mese-S.retroUltimo<4) return false;
  return true;
}
function pescaRetro(){
  var pool=RETRO_BEAT.filter(function(b){ try{ return (!b.cond||b.cond()); }catch(e){ return false; } });
  if(!pool.length) return null;
  return (typeof pescaBag==='function') ? pescaBag('retro', pool) : pool[0];
}
function pescaLeggero(){
  var pool=BEAT_LEGGERI.filter(function(b){ return (typeof eraViva!=='function'||eraViva(b)) && (!b.cond||b.cond()); });
  if(!pool.length) return null;
  return (typeof pescaBag==='function') ? pescaBag('leggeri|'+((S&&S.era)||'p'), pool) : pool[0];
}
/* L27-1 — il gate vale ora anche all'OPPOSIZIONE (`S.livello` è 3 anche da sfidante, verificato a terra): la
   sfida alla leadership scatta a 35 e l'avviso a 40, quindi da qualunque parte del campo il guaio bussa prima.
   `S.sfida` resta nella guardia: a rivolta aperta l'avviso non ha più senso, e garantisce che avviso e sfida
   non cadano mai nello stesso mese. Chi sceglie la carta la ottiene diversa (RICHIAMO_CORRENTI_OPP_EV). */
function richiamoCorrentiDovuto(){
  if(typeof S==='undefined' || !S || S.livello!==3 || !S.correnti || S.sfida) return false;
  var mese=S.year*12+S.month;
  if(S.richiamoCorrUltimo!=null && mese-S.richiamoCorrUltimo<8) return false;
  var c=S.correnti.slice().sort(function(a,b){return a.umore-b.umore;})[0];
  return !!(c && c.umore<40);
}
function cartaRichiamoCorrenti(){   // la gemella giusta per il ruolo: al governo si paga in consenso, all'opposizione in visibilità
  return (S && S.opposizione && typeof RICHIAMO_CORRENTI_OPP_EV!=='undefined') ? RICHIAMO_CORRENTI_OPP_EV : RICHIAMO_CORRENTI_EV;
}
/* Tre branche alla risoluzione (concludiNotte), su S.leggeTruffa × voto del blocco:
   approvata+≥50 → 'scatta' (premio) · approvata+<50 → 'boomerang' (niente premio + contraccolo dichiarato,
   recuperabile) · respinta/mai-decisa → 'norma' (elezione proporzionale normale, nessun premio né contraccolo). */
function applicaSnodoTruffa(){
  S.truffaFatta=true;
  if(S.leggeTruffa!=='approvata'){ S.truffaEsito='norma'; return; }   // respinta o mai decisa (non-premier) → elezione normale
  if(votoBloccoTruffa() < TRUFFA_SOGLIA){                             // approvata ma sotto soglia → BOOMERANG
    S.truffaEsito='boomerang';
    allG(-5); repd(-6); applicaSlancio(bloccoApparentato(), -4);     // consenso (via gruppi, durevole) + reputazione (rientra all'ancora) + 4 punti di forza all'opposizione (ricostruibile): morde, non affonda. Il contraccolo colpisce le liste APPARENTATE (come nella storia)
    return;
  }
  S.truffaEsito='scatta';
  var ids=bloccoApparentato();   // il premio va alle liste APPARENTATE (L.148/1953)
  var blF=ids.reduce(function(s,id){return s+((S.forze&&S.forze[id])||0);},0)||1;
  var altri=PAESE.partiti.filter(function(p){return ids.indexOf(p.id)<0;});
  var alF=altri.reduce(function(s,p){return s+((S.forze&&S.forze[p.id])||0);},0)||1;
  var pesi={};
  ids.forEach(function(id){ pesi[id]=TRUFFA_PREMIO*((S.forze[id]||0)/blF); });
  altri.forEach(function(p){ pesi[p.id]=(100-TRUFFA_PREMIO)*((S.forze[p.id]||0)/alF); });
  var q=PAESE.partiti.map(function(p){ var e=pesi[p.id]||0; return {id:p.id, f:Math.floor(e), r:e-Math.floor(e)}; });
  var used=q.reduce(function(s,x){return s+x.f;},0);
  q.slice().sort(function(a,b){return b.r-a.r;}).forEach(function(x){ if(used<100){ x.f++; used++; } });
  var seggi={}; q.forEach(function(x){ seggi[x.id]=x.f; }); S.seggi=seggi;
}
function provaAttivistaEvento(){
  if(typeof ATTIVISTA_EV==='undefined' || !ATTIVISTA_EV.length || !S.attivista) return null;
  var mese=S.year*12+S.month;
  if((S.attivista.mesi||0) < 1) return null;                                   // non al mese 0: la gavetta respira
  if(S.attivista.evUltimo && (mese - S.attivista.evUltimo) < 2) return null;   // spacing ≥2 mesi: niente eventi a raffica
  if(Math.random() >= EV_PROB) return null;
  var recent = S.attivista.evRecent || [];
  var cand = ATTIVISTA_EV.filter(function(E){ return eraViva(E) && recent.indexOf(E.id)<0 && (!E.cond || E.cond()); });
  if(!cand.length) return null;
  var c = pescaBag('attEv', cand); if(!c) return null;                         // anti-ripetizione sacchetto (S.bag serializza)
  S.attivista.evUltimo = mese;
  recent.push(c.id); if(recent.length>2) recent.shift(); S.attivista.evRecent = recent;
  return c.id;
}
function cardAttivistaEvento(id){   // ricostruisce la carta-evento dal pool statico (per id) → kind:'attivista' = resolveItem catch-all + agScene kick→bucket, come una mossa
  var E=(typeof ATTIVISTA_EV!=='undefined') && ATTIVISTA_EV.find(function(x){ return x.id===id; });
  if(!E) return null;
  return { kind:'attivista', data:{ id:E.id, kick:E.kick, tono:E.tono||null, t:E.t, text:E.text, ev:true, ch:E.ch }, resolved:false };
}
/* --- Nuova partita (da ATTIVISTA, Build A) — il gradino sotto il locale: 25 anni, nessuna carica, nessun bilancio.
   Le valute sono i 6 gruppi (reputazione, riuso) + la base militante + l'autorevolezza di campo, tutte dati puri in
   S.attivista. NON monta S.locale/budget/capitale. Alla laurea (L4) una transizione diventaLocale() monterà S.locale
   preservando S. L0 = entri e vedi la fase (vuota); mosse/motore/gate nei lotti successivi. --- */
function startAttivista(){
  initStatoBase();                                    // S.livello=0 impostato in applicaPersonaggio (CREA.livello===0); S.eta=25 dal form
  S.attivista={ base:10, autorev:15, mesi:0, paceMul:calcPaceMul(S.eta, S.diff||'normale'), campagna:null, campUltimo:0, campOfferta:false, campStoria:[], evUltimo:0, evRecent:[], evCorrente:null };   // valute + paceMul + stato campagna (L2 cooldown/offerta, L3 storico) + eventi
  S.pol=Object.assign({}, GOVERNI_PROFILI['centro']); S.snap=Object.assign({},S.pol);   // nazionale neutro/dormiente (come startLocale)
  S.capitale=null; S.visibilita=null; S.credibilita=null; S.prevSettore=null;           // niente notorietà amministrativa: la standing è l'autorev di campo
  S.ministers=[]; S.coalizione=[S.partito]; S.seggi=(PAESE.coalizione||PAESE.comeSiVince==='parlamentare')?calcSeggi():null;
  S.minoranza=false; S.tenuta={}; S.tenutaForza0={}; S.tenutaLiv={}; S.tenutaUltimo={}; S.mesiMinoranza=0;
  initTerritori(); initPotereLocale();
  if(S.biografia) S.biografia.origine='attivista';    // l'epilogo ricorderà la militanza (diverso da 'locale')
  S.tab='gov';
  S.log=[{t:'Attivista', x:'Cominci dal basso, senza carica: costruisci una base militante e la fiducia dei gruppi, fino alla prima candidatura.'}];
  bioFatto((bgNome()?bgNome()+', ':'')+'comincia come attivista, dal basso.');
  document.getElementById('appoint').style.display='none';
  document.getElementById('over').style.display='none';
  document.getElementById('start').style.display='none';
  document.getElementById('ov').classList.remove('on');
  document.getElementById('game').style.display='block';
  genAgenda(false); render(); commitSnap();
}
/* IL GATE della laurea (Build A, L4): legge LAUREA_SOGLIE (5ª e unica occorrenza — stessa costante di tab e deriva, ZERO numeri
   cablati). Serve il MIX: base (piazza) + reputazione media sui 6 gruppi (incl. i moderati → istituzionale) + autorevolezza. */
function attLaureabile(){
  if(!S.attivista) return false;
  return S.attivista.base>=LAUREA_SOGLIE.base && mediaGruppi()>=LAUREA_SOGLIE.rep && S.attivista.autorev>=LAUREA_SOGLIE.autorev;
}
/* LA LAUREA — LA TRANSIZIONE 0→1 (Build A, L4): dall'attivista alla prima carica locale. Modellata su diventaPremier/
   diventaInternazionale (modifica S IN LOCO, ZERO reset narrativo) + monta S.locale come startLocale. RIFINITURA C: preserva
   età, famiglia, biografia e i GRUPPI COSTRUITI — NIENTE secondo initStatoBase (che azzererebbe l'età). RIFINITURA premio: i
   gruppi restano su (valore differito, contano al nazionale) + un piccolo bonus di notorietà tarato sull'autorevolezza raggiunta,
   MODESTO e non-dominante (paghi ~10 mesi di gavetta per +0..+8 di capitale → partire attivista non è strettamente meglio). */
function diventaLocale(terrIdx){
  if(S.livello!==0 || !S.attivista || !S.attivista.laurea) return;   // gate difensivo (L5): solo DALLA laurea — il picker esiste solo con laurea=true, ma la funzione fa da guardia da sola
  const autor=(S.attivista.autorev!=null)?S.attivista.autorev:0;
  const idx=((PAESE.territori||[])[terrIdx])?terrIdx:0;
  const TE=(PAESE.territori||[])[idx]||PAESE.territori[0], tipo=TE.tipo;
  const leve={}; LOCALE_LEVE[tipo].forEach(function(lv){ leve[lv.id]=1; });          // tutte a "medio"
  const ind={}; LOCALE_IND[tipo].forEach(function(d){ ind[d.id]=(d.id==='bilancio')?55:50; });
  S.locale={ nome:TE.nome, carica:TE.carica, caricaEn:TE.caricaEn||null, tipo:tipo, terrIdx:idx, ind:ind, leve:leve, consenso:50, mandato:1,
    budget: Math.round((S.pil||2150)*(tipo==='città'?3.2:15)) };
  S.livello=1;                                       // l'invariante torna: livello 1 ⟹ S.locale montato
  if(S.attivista.campagna) risolviCampagna('Una campagna era in corso: candidandoti ora la chiudi sul risultato raggiunto.');   // A.5 L2: la candidatura chiude la campagna sul progresso attuale (payoff parziale scalato → no exploit); il bonus ai gruppi si porta al locale
  S.attivista=null;                                  // fase conclusa: il dato puro esce dal salvataggio
  S.turnInMandate=0;                                 // L5-FIX (HIGH): il clock del MANDATO riparte da zero come un'elezione fresca — la gavetta può aver scavalcato dei gennaio (turnInMandate++ a game.js:1970) e un sindaco laureato leggerebbe "anno 2/5" e affronterebbe la rielezione in anticipo. S.year/età NON si toccano: il tempo è passato davvero.
  S.capitale=20 + Math.round(clamp(autor-40,0,60)*0.13);   // premio MODESTO: 20 (come l'avvio diretto) + autorev 50→+1, 100→+8
  S.visibilita=30; S.credibilita=40; S.prevSettore=50;
  S.ministers=[]; S.coalizione=[S.partito]; S.seggi=(PAESE.coalizione||PAESE.comeSiVince==='parlamentare')?calcSeggi():null;
  S.minoranza=false; S.tenuta={}; S.tenutaForza0={}; S.tenutaLiv={}; S.tenutaUltimo={}; S.mesiMinoranza=0;
  initTerritori(); initPotereLocale();
  simulateLocale();                                  // consenso locale iniziale
  /* la biografia RESTA 'attivista' (l'epilogo distingue la militanza da chi è partito già sindaco); aggiungo il fatto della carica */
  const ruolo=ruoloLocale();
  bioFatto(T('Dalla militanza alla prima carica: %R.').replace('%R',ruolo));
  S.log.unshift({t:T('Prima carica'), x:T('Dalla gavetta da attivista alla prima carica: %L. Da qui in su, la scala.').replace('%L',localeNome())});
  if(typeof PROMO_FIORE!=='undefined') PROMO_FIORE=true;
  S.tab='gov';
  genAgenda(false); generaTitolo(); render(); commitSnap();
}
/* il consenso locale: media dei servizi − impopolarità delle tasse, col bilancio come vincolo (rosso = malus).
   Mirror su S.ind.consenso così i sistemi generici (correnti) vedono un valore sensato. */
function calcConsensoLocale(){
  const L=S.locale; if(!L) return;
  const leveDefs=LOCALE_LEVE[L.tipo]; let trib=0;
  for(const lv of leveDefs){ if(lv.id==='tributi'||lv.id==='tributiL') trib=L.leve[lv.id]||0; }
  const servKeys=LOCALE_IND[L.tipo].map(function(d){return d.id;}).filter(function(k){return k!=='bilancio';});
  let s=0; for(const k of servKeys) s+=L.ind[k];
  let cons=s/servKeys.length - [0,3,8][trib];
  if(L.ind.bilancio<25) cons -= (25-L.ind.bilancio)*0.3;
  L.consenso=clamp(cons,0,100); S.ind.consenso=L.consenso;
}
/* motore locale: ogni indicatore di servizio converge verso il target della sua leva (0,12/mese); il bilancio
   verso (60 − spesa + bonus tributi); poi ricalcola il consenso. */
function simulateLocale(){
  const L=S.locale; if(!L) return;
  const leveDefs=LOCALE_LEVE[L.tipo]; let spesa=0, trib=0;
  for(const lv of leveDefs){ const liv=L.leve[lv.id]||0; if(lv.ind) spesa+=lv.costo[liv]; if(lv.id==='tributi'||lv.id==='tributiL') trib=liv; }
  const bilTarget=clamp(60 - spesa + [0,12,24][trib], 0, 100);
  for(const lv of leveDefs){ if(!lv.ind) continue; const tgt=[30,55,80][L.leve[lv.id]||0]; L.ind[lv.ind]+=(tgt-L.ind[lv.ind])*0.12; L.ind[lv.ind]=clamp(L.ind[lv.ind],0,100); }
  L.ind.bilancio+=(bilTarget-L.ind.bilancio)*0.12; L.ind.bilancio=clamp(L.ind.bilancio,0,100);
  calcConsensoLocale();
}
/* eventi locali del mese (filtro tipo città/regione) */
function pickLocale(){
  if(!S.locale) return null;
  function tipoOk(e){ return e.tipo===S.locale.tipo||e.tipo==='entrambi'; }
  function condOk(e){ return !e.cond||e.cond(); }   // carte stagionali/condizionate (es. il concerto di Capodanno)
  let pool=LOCALE_EV.filter(function(e){ return tipoOk(e)&&condOk(e)&&(typeof eraVivaT!=='function'||eraVivaT(e)); });   // FIX era-gate percorso locale (default eraVivaT: la governance locale è senza-tempo; i moderni → contemporanea, con equivalenti '50)
  const ev=pescaBag('loc|'+S.locale.tipo, pool); if(!ev) return null;   // sacchetto per-tipo (citta/regione separati)
  return { kind:'locale', data:ev, resolved:false };
}
/* fine mandato locale: rielezione CLEMENTE (consenso ≥ 40 → rieletto; sotto → sconfitta). La via maestra è salire. */
function esitoElezioneLocale(){
  if(S.locale.consenso>=40){
    S.mandate++; S.turnInMandate=0; S.locale.mandato++; S.capitale=clamp(S.capitale+5,0,100);
    bioFatto('Rieletto '+ruoloLocale()+': mandato '+S.locale.mandato+'.');
    S.log.unshift({t:T('Rieletto'),x:T('Le urne locali ti confermano: comincia il mandato %N.').replace('%N',S.locale.mandato)});
    genAgenda(false); generaTitolo(); render(); commitSnap(); return;
  }
  bioFatto(gn('Sconfitto','Sconfitta')+' alle comunali: la carriera si ferma alla guida '+diLuogo(S.locale.nome)+'.');
  return gameOver('sconfittaLocale');
}
/* LA TRANSIZIONE 1→2 (il test cardine, di nuovo): il partito ti chiama a Roma → diventi MINISTRO. Modellata su
   diventaPremier/startMinistro → preserva TUTTO S (biografia, personaggio, età, famiglia, integrità, esposizione,
   correnti, tratti). Cambiano solo: livello→2, S.locale→null, lo stato da ministro montato. */
function diventaMinistro(){
  const ruoloPrima=ruoloLocale();
  S.livello=2; S.locale=null; S.occUltima=null; S.mesiAltoCap=0;
  S.dicastero=dicasteroDefault(S.personaggio&&S.personaggio.background);
  S.premier=generaPremier();
  S.pol=Object.assign({}, GOVERNI_PROFILI[profByAsse(S.premier.asse)]); S.snap=Object.assign({},S.pol);
  S.capitale=40; S.silAvviso=null; S.premCrisiMesi=0; S.premMossaUltimo=null;
  S.prevSettore=(DICASTERO_IND[S.dicastero]?S.ind[DICASTERO_IND[S.dicastero][0]]:null);
  S.ministers=[]; S.coalizione=[S.partito]; S.seggi=(PAESE.coalizione||PAESE.comeSiVince==='parlamentare')?calcSeggi():null;
  S.ind.consenso=computeConsenso(); S.ind.deficit=computeDeficit(); S.ind.fiducia=targetFiducia();
  bioFatto('Da '+ruoloPrima+' a '+ruoloDicastero()+': la chiamata a Roma.');
  S.log.unshift({t:T('A Roma'),x:T('Il partito ti porta nel governo come %R. La scalata continua.').replace('%R',T(ruoloDicastero()))});
  if(typeof PROMO_FIORE!=='undefined') PROMO_FIORE=true;
  S.turnInMandate=0; S.mandate=S.mandate||1;
  document.getElementById('appoint').style.display='none';
  document.getElementById('over').style.display='none';
  document.getElementById('ov').classList.remove('on');
  document.getElementById('game').style.display='block';
  genAgenda(false); generaTitolo(); render(); commitSnap();
}

/* --- Fiducia dei mercati: ritorna l'evento di soglia quando si SCENDE a un livello nuovo. {data, kind} o null.
   Escalation verso l'alto immediata. Due freni anti-ripetizione: ISTERESI (un livello si riarma solo quando la
   fiducia risale sopra la sua soglia + MARG) e RAFFREDDAMENTO (lo stesso evento non rispara entro RAFFR mesi). --- */
function pickFiduciaEvent(){
  const D=dif(), f=S.ind.fiducia, MARG=6, RAFFR=6;    // margine d'isteresi (punti) e raffreddamento (mesi)
  const mese=S.year*12+S.month;                        // contatore mese assoluto, per il raffreddamento
  const sogliaDi=L=> L===3?D.sogliaCrisiFid : L===2?D.sogliaDeclass : D.sogliaMercati;
  const cur = f<D.sogliaCrisiFid?3 : f<D.sogliaDeclass?2 : f<D.sogliaMercati?1 : 0;
  const prev=S.fidLivello||0;
  if(cur>prev){                                        // i conti peggiorano: escalation immediata
    S.fidLivello=cur;                                  // segna il livello anche se l'evento è in raffreddamento
    S.fidUltimo=S.fidUltimo||{};
    if(S.fidUltimo[cur]!=null && mese-S.fidUltimo[cur]<RAFFR) return null;   // stesso evento troppo recente: niente carta
    S.fidUltimo[cur]=mese;
    const ev = cur===3?FIDUCIA_EV.crisi : cur===2?FIDUCIA_EV.declass : FIDUCIA_EV.warn;
    return { data:ev, kind: cur===1?'dossier':'event' };   // avviso non rosso; declassamento/crisi rossi
  }
  // riarmo con isteresi: si scende di livello solo quando la fiducia supera la soglia di quel livello + margine
  while(S.fidLivello>0 && f>=sogliaDi(S.fidLivello)+MARG) S.fidLivello--;
  return null;
}

/* --- Grande evento internazionale (lotto Esteri+Difesa): ~ogni 6-9 mesi (probabilità ~0,13/mese), con guardia
   anti-ripetizione sull'ultimo. Esclusivo come gli altri grandi eventi: entra nella catena hadEvent di genAgenda. --- */
/* RELAZIONI INTERNAZIONALI (fase A): seed degli standing per-ente dallo standing iniziale (= reputazione corrente),
   solo per gli enti validi nel paese (Unione solo ue:true). Idempotente: non sovrascrive ciò che c'è (sopravvive
   all'opposizione e al ritorno al governo — la statura del paese non si azzera). */
function initRelInt(){
  if(typeof ENTI_INT==='undefined' || !S) return;
  const base=(S.ind&&S.ind.reputazione!=null)?Math.round(S.ind.reputazione):50;
  S.relInt=S.relInt||{};
  ENTI_INT.forEach(function(E){ if(!E.cond||E.cond()){ if(S.relInt[E.id]==null) S.relInt[E.id]=base; } });
  for(const id in S.relInt){ const E=ENTI_INT.find(function(x){return x.id===id;}); if(!E||(E.cond&&!E.cond())) delete S.relInt[id]; }   // pulizia enti non validi
}
/* CONFLITTI internazionali (cantiere paesi reali, Fetta B): i flashpoint coi VOLTI nominati. Pesca l'evento + la potenza
   (FISSA `pot`, dal `potPool`, o nessuna) e restituisce un'ISTANZA già risolta col templating `potSub` — così il renderer
   generico (kind:'event') la mostra senza sapere nulla dei volti. Prob un filo più alta della routine diplomatica (i
   conflitti DEVONO sentirsi come presenza ricorrente); finestra anti-ripetizione in S.recentConflInt. */
function pickConflittoInt(){
  if(typeof CONFLITTI_INT==='undefined' || typeof potSub!=='function') return null;
  if(Math.random()>=0.20) return null;   // i flashpoint sono PRESENZA RICORRENTE: ~1 ogni 5-6 mesi (Giacomo: «un filo più caldi»)
  /* Fetta B — sedia-swing: il non allineato salta i conflitti `occ:true` (specifici dell'Occidente: difesa comune, ecc.)
     e prende invece il pool CONFLITTI_SWING (corteggiato dai due poli); l'occidentale prende tutti i CONFLITTI_INT. */
  const na=(typeof nonAllineato==='function' && nonAllineato());
  const src=na ? CONFLITTI_INT.filter(function(e){return !e.occ;}).concat(typeof CONFLITTI_SWING!=='undefined'?CONFLITTI_SWING:[]) : CONFLITTI_INT;
  let pool=src.filter(function(e){return (!e.cond||e.cond()) && eraViva(e);});
  const ev=pescaBag('confint|'+(na?'swing':'occ'), pool); if(!ev) return null;
  let p=null;
  if(ev.pot) p=potDi(ev.pot);
  else if(ev.potPool && ev.potPool.length) p=potDi(rnd(ev.potPool));
  const inst = p ? Object.assign({}, ev, {   // i18n: T() prima di potSub (template coi %POT intatti → sostituzione nella lingua corrente)
    t: potSub(T(ev.t),p), text: potSub(T(ev.text),p), kick: potSub(T(ev.kick||''),p)||T(ev.kick),
    ch: ev.ch.map(function(c){ return Object.assign({}, c, {l:potSub(T(c.l),p), e:potSub(T(c.e),p)}); })
  }) : ev;
  return inst;
}
function pickInternazionale(){
  if(typeof INTERNAZIONALI==='undefined') return null;
  if(Math.random()>=0.13) return null;
  const pool=INTERNAZIONALI.filter(e=>(!e.cond||e.cond()) && eraViva(e));
  const ev=pescaBag('int', pool); if(!ev) return null;
  return ev;
}
/* evento ONG (fase B): la società civile come attore. ~ogni 8-10 mesi; pesca il PRIMO con cond vera (gli eventi
   tematici leggono la policy specifica → la spaccatura verde/diritti). Entra nel giro degli eventi internazionali. */
function pickONG(){
  if(typeof ONG_EV==='undefined' || !S.relInt || S.relInt.ong==null) return null;
  if(Math.random()>=0.11) return null;
  const pool=ONG_EV.filter(e=>(!e.cond||e.cond()) && eraViva(e));
  const ev=pescaBag('ong', pool); if(!ev) return null;
  return ev;
}

/* --- Conferenza stampa reattiva (lotto comunicazione): ~ogni 5 mesi (p=0,30, raffreddamento 2 mesi),
   mai con un evento grosso (entra nella catena di genAgenda come iniziativa, nel tetto ≤2).
   Pesca la PRIMA domanda di CONFERENZE (data.js, ordinate per specificità) con cond vera,
   saltando l'ultima fatta se c'è alternativa. t/text possono essere funzioni (contenuto dinamico). --- */
/* La conferenza stampa è l'APPUNTAMENTO INELUDIBILE del capo del governo (lotto ribilanciamento): arriva
   ogni ~3 mesi, non a caso. Gestirla bene tiene la stampa amica; evasivamente la raffredda — e l'amplificatore
   fa il resto. Sempre due carte di rito disponibili (cf_bilancio/cf_priorita), così l'appuntamento non salta. */
/* D1a — LA SFIDA (quiz diegetico): la domanda-conoscenza costruita come carta-conferenza (stesso kind 'stampa',
   zero UI nuova). Le opzioni NON mostrano anteprime (e:'' — non si svela la risposta); l'esito va nel log:
   giusta → reputazione+stampa (premia), sbagliata → gaffe piccola (stampa −3, recuperabile) e SEMPRE la
   risposta giusta + il perché (si impara l'epoca facendosi interrogare). i18n al pescaggio (pattern-log). */
/* D5 — il PREMIO per-cornice della Sfida (delta nominato, visibile), estratto per il riuso F5. Le valute-fn guardano
   da sé lo stato del livello (attA/attB→attivista, consenso→locale, repd/stampad→governo/ministro, autorev/credito→
   intl): chiamarle fuori contesto è no-op sicuro. */
function premiaSfida(cornice, ok){
  var d=[];
  if(cornice==='piazza'){ if(ok){ attA(4); attB(1); d.push(T('Base')+' +4'); d.push(T('Autorevolezza')+' +1'); } else { attA(-1); d.push(T('Base')+' −1'); } }
  else if(cornice==='aula'){ if(S.locale){ S.locale.consenso=clamp((S.locale.consenso||0)+(ok?2:-1),0,100); d.push(T('Consenso locale')+' '+(ok?'+2':'−1')); } }
  else if(cornice==='vertice'){ if(ok){ autorevMuovi(3); creditoMuovi(3); d.push(T('Autorevolezza')+' +3'); d.push(T('Credito diplomatico')+' +3'); } else { autorevMuovi(-1); creditoMuovi(-1); d.push(T('Autorevolezza')+' −1'); d.push(T('Credito diplomatico')+' −1'); } }
  /* L23-1 — la cornice `stampa` è l'unica servita da DUE ruoli: premier e sfidante. La reputazione internazionale è
     la valuta di chi rappresenta il paese; lo sfidante che risponde bene guadagna VISIBILITÀ e CREDIBILITÀ. Taratura
     conservata in grandezza: nessuna mossa supera il +2 dell'originale (`repd`), e `stampad` resta identica in
     entrambi i rami — il rapporto con la stampa esiste da sfidante quanto da premier.
     IL MALUS NON SI BIFORCA: la gaffe muove solo `stampad(-3)`, che vale in tutte e due le modalità (verificato). */
  else if(S.opposizione){ if(ok){ visd(2); credd(1); stampad(3); d.push(T('Visibilità')+' +2'); d.push(T('Credibilità')+' +1'); d.push(T('Rapporto con la stampa')+' +3'); } else { stampad(-3); d.push(T('Rapporto con la stampa')+' −3'); } }
  else { if(ok){ repd(2); stampad(3); d.push(T('Reputazione')+' +2'); d.push(T('Rapporto con la stampa')+' +3'); } else { stampad(-3); d.push(T('Rapporto con la stampa')+' −3'); } }
  return d.join(' · ');
}
function cartaSfida(q, cornice){
  cornice = cornice || 'stampa';
  /* D1b — cornice diegetica PER-RUOLO + premio PER-RUOLO (premia-non-punisce). Le valute-fn guardano da sé lo
     stato del livello (attA/attB→attivista, consenso→locale, repd/stampad→governo/ministro, autorev/credito→intl):
     chiamarle fuori contesto è no-op sicuro. */
  var CORN = {
    piazza:      { kick:'Società civile',    t:'Ti mettono alla prova',     intro:'In piazza qualcuno ti sfida a viso aperto:' },
    aula:        { kick:'Palazzo',           t:'L\'interrogazione in aula', intro:'In consiglio un avversario ti incalza:' },
    commissione: { kick:'Question time',     t:'Il question time',          intro:'In commissione un parlamentare ti mette alla prova:' },
    stampa:      { kick:'Ufficio stampa',    t:'Il giornalista ti incalza', intro:'Un cronista alza la mano e va dritto al punto:' },
    vertice:     { kick:'Foro multilaterale',t:'La prova al vertice',       intro:'Un delegato ti mette alla prova davanti a tutti:' }
  };
  var C = CORN[cornice] || CORN.stampa;
  /* D5 — PREMIO VISIBILE: premia() ritorna il delta nominato (valuta + segno), mostrato nel log come le altre carte.
     Vale per giusto E sbagliato → la gaffe piccola si VEDE piccola (la cura resa leggibile).
     F5 — estratto in premiaSfida(cornice,ok) top-level: stessa logica, riusata anche dall'intervista incalzante. */
  function premia(ok){ return premiaSfida(cornice, ok); }
  const opts=q.op.map(function(o,i){
    var opt={ l:T(o), e:'' };
    opt.f=(function(idx){ return function(){
      var ok=(idx===q.giusta); var dd=premia(ok);
      if(ok){ S.log.unshift({t:T('Risposta esatta'), x:T('Fai buona figura.')+(dd?' <b>'+dd+'</b>.':'')+' '+T(q.perche)}); }
      else { S.log.unshift({t:T('La gaffe'), x:T('La risposta giusta era «%R».').replace('%R',T(q.op[q.giusta]))+(dd?' <b>'+dd+'</b>.':'')+' '+T(q.perche)}); }
      /* P1 #7b — il verdetto a schermo (it.outcome): esatto/sbagliato + risposta giusta evidenziata + perché + delta nominato. */
      opt._esito=(ok ? '<b style="color:var(--pos)">'+T('Risposta esatta')+'</b>'
                     : '<b style="color:var(--neg)">'+T('Sbagliato')+'</b> — '+T('la risposta giusta era:')+' <b>«'+T(q.op[q.giusta])+'»</b>')
                 +'. '+T(q.perche)+(dd?' <span style="color:var(--mut2)">'+dd+'.</span>':'');
    };})(i);
    return opt;
  });
  return { id:'sfida_'+q.id, kick:C.kick, t:T(C.t), text:T(C.intro)+' «'+T(q.q)+'»', ch:opts };
}
/* D1b — l'UNICO picker gated delle Sfide (guardrail: ogni gancio-ruolo passa da qui → da `eraViva`, zero nuovi
   punti-pesca non gatati). `ruoli` = insieme accettato per il percorso; `ruolo` mancante = 'governo' (il seed nella
   conferenza). Cadenza ~5 mesi (occasionale, come gli eventi). `cond` = ancora-anno. */
/* Q-fix #6 — TABELLA-PESI [difficoltà-partita × fascia-livello] → quante volte una BANDA entra nel sacchetto (0 = esclusa).
   Fasce-livello: basso = L0-L1 (piazza/aula) · medio = L2 (commissione) · alto = L3-L5 (conferenza/vertice).
   facile → solo facile/media · normale → perno sul medio · difficile → predominanza difficile, mai facile (invariato da P1).
   Tarata su .claude/audit-sfide.js (walk 36 mesi × 4 config): difficoltà-servita facile≈1.5-1.7 · normale≈2.1-2.4 · difficile≈2.9. */
const PESI_SFIDA={
  //           L0-L1 (piazza/aula)  L2 (commissione)     L3-L5 (conferenza/vertice)
  facile:   { basso:{f:3,m:1,d:0}, medio:{f:2,m:2,d:0}, alto:{f:1,m:3,d:0} },
  normale:  { basso:{f:2,m:3,d:0}, medio:{f:1,m:3,d:1}, alto:{f:0,m:3,d:1} },
  difficile:{ basso:{f:0,m:2,d:3}, medio:{f:0,m:1,d:3}, alto:{f:0,m:1,d:4} },
};
function livTierSfida(liv){ return (liv<=1)?'basso':(liv===2?'medio':'alto'); }
/* Applica i pesi: concatena ogni banda × il suo peso (campionamento pesato via replica, come il boost di P1). Il tetto
   di replica scala con quante voci ha la banda (Q-fix #3 generalizzato): fasce piccole non martellate a raffica.
   Fallback grazioso: se la combinazione svuota il mix, ripiega sulle bande a peso>0 (a `difficile` resta senza facile). */
function mixSfida(pool, dgame, liv){
  var w=(PESI_SFIDA[dgame]||PESI_SFIDA.normale)[livTierSfida(liv)];
  var bande=[['facile',w.f],['media',w.m],['difficile',w.d]], mix=[], vietate={};
  bande.forEach(function(bw){
    var arr=pool.filter(function(q){return (q.diff||'media')===bw[0];});
    if(bw[1]<=0){ vietate[bw[0]]=1; return; }
    if(!arr.length) return;
    var kMax=arr.length>=5?bw[1]:(arr.length>=3?Math.min(bw[1],3):1);
    for(var r=0;r<kMax;r++) mix=mix.concat(arr);
  });
  if(mix.length) return mix;
  var ripiego=pool.filter(function(q){ return !vietate[(q.diff||'media')]; });
  return ripiego.length?ripiego:pool;
}
function pescaSfida(ruoli, cornice){
  if(typeof SFIDE==='undefined' || !S) return null;   // D4: rimossa la guardia !opposizione — la Sfida arriva anche allo sfidante (gancio in genAgenda, cornice stampa)
  var mese=S.year*12+S.month;
  if(S.sfideUltimo==null){ S.sfideUltimo=mese; return null; }        // arma il timer al primo giro (niente sfida troppo presto)
  if(mese-S.sfideUltimo<5) return null;
  var pool=SFIDE.filter(function(q){
    if(typeof eraViva==='function' && !eraViva(q)) return false;                       // GATE ERA
    if(q.paese && q.paese!=='universale' && q.paese!==S.paese) return false;           // D5 GATE PAESE — le istituzioni italiane non escono giocando USA (legge S.paese)
    if(q.cond && !q.cond()) return false;                                             // ANCORA-ANNO
    return ruoli.indexOf(q.ruolo||'governo')>=0;                                      // GATE RUOLO
  });
  if(!pool.length) return null;
  /* Q-fix #2 — MEMORIA CONDIVISA con F5: escludi le domande viste di recente (S.recentSfide, aggiornata da ENTRAMBE le
     sorgenti: Sfida singola + intervista). Rilassa se svuoterebbe il pool (< 3 restanti → degrado grazioso). */
  var _rs=S.recentSfide||[]; if(_rs.length){ var _ex=pool.filter(function(q){ return _rs.indexOf(q.id)<0; }); if(_ex.length>=3) pool=_ex; }
  /* Q-fix #6 — MIX-DIFFICOLTÀ table-driven (v. PESI_SFIDA/mixSfida sopra): UNA regola leggibile [difficoltà-partita ×
     fascia-livello] al posto delle condizioni sparse. La difficoltà-partita è lo skew primario, la scala-livello la
     modula. facile → facile/media (la #6: la servita SCENDE); normale → perno sul medio; difficile → predominanza
     difficile, MAI facile (invariato da P1). Fallback in mixSfida: non affama mai la cadenza. */
  var liv=S.livello, dgame=(typeof S.diff!=='undefined'&&S.diff)||'normale';
  pool=mixSfida(pool, dgame, liv);
  /* D5 — sacchetto PER-CONTESTO (paese+livello): l'anti-ripetizione regge anche coi pool piccoli dei paesi senza banca
     (hold-back K = min(2, floor(len/3)) → mai la stessa domanda a raffica; degrado grazioso, misurato). */
  var q=pescaBag('sfide|'+(S.paese||'')+'|'+(liv||0), pool);
  if(!q) return null;
  S.sfideUltimo=mese;
  markSfida(q.id);                                          // Q-fix #2 — registra nella memoria condivisa
  return cartaSfida(q, cornice);
}
/* Q-fix #2 — la finestra «viste di recente» condivisa fra Sfida singola e intervista F5 (dato puro, round-trip). W=8
   > del burst-catena (2-3) → una catena non collide con sé stessa né ripesca ciò che la Sfida singola ha appena posto. */
function markSfida(id){ if(!id || typeof S==='undefined' || !S) return; S.recentSfide=S.recentSfide||[]; S.recentSfide.push(id); while(S.recentSfide.length>8) S.recentSfide.shift(); }

/* ============================================================
   F5 — L'INTERVISTA INCALZANTE. La Sfida che sembra un dialogo: 2-3 battute concatenate, difficoltà crescente, stessa
   cornice/ruolo (Path A: pura orchestrazione, NIENTE contenuto nuovo — riusa la banca SFIDE + premiaSfida + il verdetto).
   La contro-domanda è PRESSIONE, non trabocchetto: reggere l'incalzare → premio pieno; sbagliare a metà → la catena
   chiude prima con premio RIDOTTO, mai una figuraccia (cura-P1). Innesco DEDICATO (~9 mesi, più raro della Sfida singola
   a 5), MAI nello stesso mese di una Sfida singola. Vive nel transitorio INTERVISTA (reload = abbandono pulito, S intatto).
   ============================================================ */
function intervistaCornice(){ return S.livello===2?'commissione':(S.livello>=4?'vertice':'stampa'); }
function intervistaRuoli(){ return S.livello===2?['governo','ministro']:(S.livello>=4?['intl']:['governo']); }
function intervistaDovuta(){
  /* L22-1 — TOLTO `|| S.opposizione` (diagnosi L21-1): il gate escludeva l'intervista allo sfidante, cioè il grosso
     del volume-quiz E la parte dove la difficoltà sale (catene media→difficile→difficile). Misurato: 0/200 contro
     148/200 al governo. I testi di cornice sono neutri («L'intervista incalzante», «Il cronista va dritto al punto»):
     un leader d'opposizione incalzato da un cronista è la scena più naturale che ci sia, nessuna biforcazione serve. */
  if(typeof S==='undefined' || !S) return false;
  if([2,3,4,5].indexOf(S.livello)<0) return false;               // solo i ruoli con una cornice-intervista
  if(typeof SFIDE==='undefined') return false;
  var mese=S.year*12+S.month;
  if(S.sfideUltimo==null) return false;                          // il timer-Sfide non è ancora armato
  if(S.intervistaUltimo!=null && mese-S.intervistaUltimo<9) return false;   // cooldown 9 mesi (più raro della Sfida singola)
  return Math.random()<0.75;   // ~entro 1 mese dal cooldown → cadenza ~1/9-10 mesi (misurata; gli skip modale/Sfida-mese la alzano un filo)
}
function poolSfideInt(ruoli){
  if(typeof SFIDE==='undefined') return [];
  return SFIDE.filter(function(q){
    if(typeof eraViva==='function' && !eraViva(q)) return false;                     // GATE ERA (riuso)
    if(q.paese && q.paese!=='universale' && q.paese!==S.paese) return false;         // GATE PAESE
    if(q.cond && !q.cond()) return false;                                            // ANCORA-ANNO
    return ruoli.indexOf(q.ruolo||'governo')>=0;                                     // GATE RUOLO
  });
}
function rankDiffInt(d){ return d==='facile'?0:(d==='difficile'?2:1); }
function buildIntervista(){
  var ruoli=intervistaRuoli(), pool=poolSfideInt(ruoli);
  /* Q-fix #6 — F5 rispetta la STESSA tabella difficoltà-partita×livello della Sfida singola (PESI_SFIDA): filtra alle
     BANDE AMMESSE (peso>0), non un drop-facile hardcoded. Così a facile-partita l'intervista NON serve difficile (F5
     è il grosso del volume → senza questo, la #6 non scenderebbe); sussume la vecchia #5 (a difficile: solo la banda d). */
  var _w=(typeof PESI_SFIDA!=='undefined')?(PESI_SFIDA[S.diff]||PESI_SFIDA.normale)[livTierSfida(S.livello)]:null;
  if(_w){ var _amm={facile:_w.f>0, media:_w.m>0, difficile:_w.d>0}; var _f=pool.filter(function(q){ return _amm[q.diff||'media']; }); if(_f.length>=2) pool=_f; }
  /* Q-fix #2 — memoria condivisa: escludi le viste di recente (S.recentSfide); rilassa se restano < 2. */
  var _rs=S.recentSfide||[]; if(_rs.length){ var _ex=pool.filter(function(q){ return _rs.indexOf(q.id)<0; }); if(_ex.length>=2) pool=_ex; }
  if(pool.length<2) return null;                                 // serve almeno una catena di 2
  // pesco fino a 3 domande DISTINTE, poi le ordino per difficoltà CRESCENTE → la pressione sale, mai scende
  var avail=pool.slice(), picks=[];
  for(var n=0;n<3 && avail.length;n++){ var j=Math.floor(Math.random()*avail.length); picks.push(avail[j]); avail.splice(j,1); }
  if(picks.length<2) return null;
  picks.sort(function(a,b){ return rankDiffInt(a.diff||'media')-rankDiffInt(b.diff||'media'); });
  picks.forEach(function(q){ markSfida(q.id); });                // Q-fix #2 — registra il burst nella memoria condivisa
  return { cornice:intervistaCornice(), ruoli:ruoli, qs:picks, step:0, correct:0, done:[], esito:null };
}
function forseIntervista(){
  if(!intervistaDovuta()) return;
  try{ if(document.getElementById('ov').classList.contains('on')) return; }catch(e){}   // non stackare su un altro modale (telefonata/bilancio/notte)
  try{ var over=document.getElementById('over'); if(over && over.style.display!=='none') return; }catch(e){}   // niente sopra il gameOver
  if(S.agenda && S.agenda.some(function(a){ return a && a.data && /^sfida_/.test(String(a.data.id||'')); })) return;   // MAI intervista + Sfida singola nello stesso mese
  var setup=buildIntervista(); if(!setup) return;
  INTERVISTA=setup; S.intervistaUltimo=S.year*12+S.month;
  renderIntervista(); commitSnap();
}
function renderIntervista(){
  if(!INTERVISTA) return;
  var I=INTERVISTA;
  var CORN={ commissione:{kick:'Question time', t:'Il question time'}, stampa:{kick:'Intervista', t:'L\'intervista incalzante'}, vertice:{kick:'Foro multilaterale', t:'Il confronto al vertice'} };
  var C=CORN[I.cornice]||CORN.stampa;
  var scI=(typeof scenaIntervista==='function')?scenaIntervista(I.cornice):null;   // L9-1: scena per cornice (aula univ. / studio era-aware / vertice)
  var scImg=scI?`<img class="mscene" src="${scI}" alt="">`:'';
  var m=document.getElementById('modal');
  if(I.esito){
    m.innerHTML=`${scImg}<div class="mt"><div class="kicker">${T(C.kick)}</div><h2>${T(C.t)}</h2></div>
      <div class="mtext">${I.esito.testo}${I.esito.deltas?(' <span style="color:var(--mut2)">'+I.esito.deltas+'.</span>'):''}</div>
      <div class="choices"><button class="opt" onclick="chiudiIntervista()"><span class="ol">${T('Chiudi')}</span></button></div>`;
  } else {
    var q=I.qs[I.step];
    var intro=(I.step===0)?T('Il cronista va dritto al punto:'):T('Non ti molla — e rilancia:');
    var prog=T('Battuta %N di %T').replace('%N',I.step+1).replace('%T',I.qs.length);
    var opts=q.op.map(function(o,i){ return `<button class="opt" onclick="rispondiIntervista(${i})"><span class="ol">${T(o)}</span></button>`; }).join('');
    m.innerHTML=`<div class="mt"><div class="kicker">${T(C.kick)} · ${prog}</div><h2>${T(C.t)}</h2></div>
      <div class="mtext">${T(intro)} «${T(q.q)}»</div>
      <div class="choices">${opts}</div>`;
  }
  document.getElementById('ov').classList.add('on');
}
function rispondiIntervista(ci){
  if(!INTERVISTA || INTERVISTA.esito) return;
  var I=INTERVISTA, q=I.qs[I.step], ok=(ci===q.giusta);
  I.done.push({ok:ok, giusta:q.op[q.giusta], perche:q.perche}); if(ok) I.correct++;
  if(ok && I.step < I.qs.length-1){ I.step++; renderIntervista(); }   // giusto e c'è ancora → il cronista incalza
  else concludiIntervista();                                          // sbagliato, o ultima battuta → si chiude
}
/* la chiusura: il premio si applica SOLO ora (mai a metà → reload a metà = abbandono pulito). premiaSfida per battuta
   risposta + bonus-tenuta piccolo e PIATTO se tutta la catena è giusta (vale un po' più di 3 Sfide, non un exploit). */
function concludiIntervista(){
  if(!INTERVISTA) return;
  var I=INTERVISTA, deltas=[];
  I.done.forEach(function(d){ var s=premiaSfida(I.cornice, d.ok); if(s) deltas.push(s); });
  var perfetto=(I.correct===I.done.length && I.done.length===I.qs.length && I.qs.length>=2);
  if(perfetto){ if(I.cornice==='vertice') autorevMuovi(1); else if(I.cornice==='piazza') attA(1); else repd(1); deltas.push(T('tenuta')+' +1'); }   // bonus-tenuta piatto
  var testo = perfetto ? T('Hai retto l\'incalzare fino in fondo: prova piena.')
            : (I.correct>0 ? T('Hai retto le prime, poi il cronista ti ha messo in difficoltà: una cavata onorevole.')
                           : T('Il cronista ti ha spiazzato subito: capita, si rimonta.'));
  // l'ultima risposta sbagliata: la risposta giusta, come nel verdetto-P1 (esplicito, mai una figuraccia muta)
  var ultima=I.done[I.done.length-1];
  if(ultima && !ultima.ok) testo += ' '+T('La risposta giusta era «%R».').replace('%R', T(ultima.giusta));
  I.esito={ testo:testo, deltas:deltas.join(' · ') };
  S.log.unshift({ t:T('L\'intervista incalzante'), x:testo });
  S.ind.consenso=computeConsenso();
  renderIntervista(); commitSnap();
}
function chiudiIntervista(){
  INTERVISTA=null;
  try{ document.getElementById('ov').classList.remove('on'); }catch(e){}
  render(); commitSnap();
}
function pickConferenza(){
  if(typeof CONFERENZE==='undefined' || S.opposizione) return null;
  const mese=S.year*12+S.month;
  if(S.confUltimo!=null && mese-S.confUltimo<3) return null;   // cadenza fissa: ~ogni 3 mesi
  /* D1a — ogni ~5+ mesi l'appuntamento-stampa diventa la SFIDA (≈2/anno, alternata alle conferenze normali).
     Era-gated (eraViva: le domande d'epoca vivono solo nel loro scenario) + rotazione a sacchetto. */
  if(typeof pescaSfida==='function'){ var sfC=pescaSfida(['governo','ministro'], S.livello===2?'commissione':'stampa'); if(sfC){ S.confUltimo=mese; return sfC; } }
  let pool=CONFERENZE.filter(c=>(!c.cond||c.cond()) && eraVivaT(c));
  if(!pool.length) return null;
  /* Lotto A (fix playtest): dal first-match+memoria-1 (ping-pong tra 2 testi per anni — il collo di ripetizione peggiore)
     al SACCHETTO (pescaBag: estrazione senza rimpiazzo, come il punto-partito) → tutte le domande cond-vere ruotano. */
  const q=(typeof pescaBag==='function' ? pescaBag('conf', pool) : pool[0]) || pool[0];
  S.confUltimo=mese; S.lastConfQ=q.id;
  /* i18n: le FUNZIONI t/text traducono da sé i componenti (T(template).replace dentro data.js); le stringhe piatte
     si traducono qui al pescaggio (pattern-log: la domanda nasce nella lingua corrente). */
  return { id:q.id, t:(typeof q.t==='function'?q.t():T(q.t)), text:(typeof q.text==='function'?q.text():T(q.text)), ch:q.ch };
}
/* Il PUNTO COL PARTITO (lotto ribilanciamento): l'appuntamento periodico con le correnti, ogni ~4 mesi.
   Ineludibile come la conferenza: rispondere male le inasprisce (la sfida monta — ma sei avvisato). */
function pickPuntoPartito(){
  if(typeof PUNTO_PARTITO==='undefined' || S.opposizione || !S.correnti) return null;
  const mese=S.year*12+S.month;
  if(S.puntoUltimo!=null && mese-S.puntoUltimo<3) return null;   // cadenza ~ogni 3 mesi (loop attivo: un filo più di presenza del partito, senza dominare — pari alla conferenza)
  let pool=PUNTO_PARTITO.filter(eraVivaT);
  const q=pescaBag('punto', pool); if(!q) return null; S.puntoUltimo=mese;
  return { kind:'puntopartito', data:q, resolved:false };
}

/* --- Il TITOLO DEL MESE (lotto comunicazione 2): la prima pagina che commenta lo stato del gioco.
   Generato al confine di mese DOPO genAgenda (può reagire alle carte di oggi, es. lo scandalo).
   Pesca il PRIMO di TITOLI con cond vera (anti-ripetizione), variante amica/ostile dal rapporto stampa.
   Cornice pura: niente effetti, niente tetto. Vive in S.titoloMese (dato puro → si salva). --- */
function generaTitolo(){
  if(typeof TITOLI==='undefined' || !S || S.opposizione) return;
  if(S.livello===1){ generaTitoloLocale(); return; }   // rifinitura locale: a livello 1 la prima pagina parla LOCALE
  let pool=TITOLI.filter(t=>(!t.cond||t.cond()) && eraVivaT(t));
  if(!pool.length) return;
  /* D2 (fix meccanico ACCANTO al contenuto — scoperto in build): il vecchio primo-match+finestra-3 ruotava AL
     MASSIMO 4 titoli anche con un pool grande (il primo-fresco in ordine di lista cicla su sé stesso). Ora: TIER
     di priorità — pri 1 = EVENTO del mese (inchiesta, legge, manovra, voto: la specificità resta sovrana) ·
     pri 2 = STATO del paese (default) · pri 3 = ordinario (fallback). Vince il tier più alto con candidati
     freschi; DENTRO il tier si pesca col sacchetto (rotazione piena). Finestra-recenti 3→6 (il pool è cresciuto). */
  S.recentTit=S.recentTit||[];
  const freschi=pool.filter(t=>S.recentTit.indexOf(t.id)<0);
  const cand=(freschi.length?freschi:pool);
  let q=null;
  for(let p=1;p<=3 && !q;p++){
    const tier0=cand.filter(t=>(t.pri||2)===p);
    /* P5-bis — LA PRIMA PAGINA D'EPOCA: a parità di `pri` la gemella era-taggata VINCE sulla generica. `eraVivaT`
       ha già tolto le voci di altre ere, quindi qui basta preferire le era-taggate rimaste. Nel presente non ce ne
       sono → il tier resta identico (prima pagina del presente intatta); dove la gemella non esiste per quel
       trigger, il tier ricade sul generico (fallback). Skin pura: stesso fatto, stesso momento, altra voce. */
    /* L29-3 — QUESTA RIGA ERA UNA LISTA CABLATA A DUE VOCI (`'italia1950'||'italia1960'`): le gemelle del '70
       non prendevano la preferenza, e anzi venivano ESCLUSE ogni volta che una gemella-'60 era in tier. Misurato
       prima del fix: nel decennio '70 la prima pagina parlava al 73% con la voce del '60. Ora la regola è quella
       che il commento qui sopra già descriveva — si preferisce QUALUNQUE voce d'epoca, perché `eraVivaT` ha già
       tolto le ere sbagliate. Così ogni decennio futuro entra senza toccare questa riga. */
    const tierE=tier0.filter(t=>t.era && t.era!=='universale');
    const tier=(tierE.length?tierE:tier0);
    if(tier.length) q=(typeof pescaBag==='function'?pescaBag('titoli',tier):tier[0])||tier[0];
  }
  if(!q) q=cand[0];
  const amica=(S.ind.stampa!=null?S.ind.stampa:50) >= (50 + ((typeof climaTitoli==='function')?climaTitoli():0));   // L28-4: nel clima-'70 la soglia si alza -> a parita' di stampa, titoli piu' cupi
  S.lastTitolo=q.id;
  // micro-lotto meccanico: finestra ERA-AWARE — 8 nel presente (min pool-vivo 17 → 8<<17, mai affamato; i 2 ordinari pri:3 fanno rete),
  // 6 nel '50/'60 così la prima-pagina d'epoca resta BYTE-IDENTICA (recentTit è globale: allargarla toccherebbe anche le ere sigillate).
  var _wTit=(S.era===LINEA_IT)?6:8;   // L30-1: la seconda condizione (S.era==='italia1960') era MORTA — S.era e la LINEA, non il decennio
  S.recentTit.push(q.id); if(S.recentTit.length>_wTit) S.recentTit.shift();
  S.titoloMese={ id:q.id, testo:T(amica?q.amico:q.ostile), tono:(amica?'amica':'ostile') };   // i18n: tradotto allo store (pattern-log)
}
/* La prima pagina a LIVELLO 1: pesca da TITOLI_LOCALI (tipo gata città/regione + cond su S.locale), tono dal
   CONSENSO locale, %LUOGO=nome dell'area (soggetto). Stessa anti-ripetizione lastTitolo. Mai temi nazionali. */
function generaTitoloLocale(){
  if(typeof TITOLI_LOCALI==='undefined' || !S.locale) return;
  const tipo=S.locale.tipo;
  let pool=TITOLI_LOCALI.filter(t=>(!t.tipo||t.tipo===tipo)&&(!t.cond||t.cond())&&(typeof eraVivaT!=='function'||eraVivaT(t)));   // FIX era-gate titoli locali (tutti senza-tempo: eraVivaT li tiene)
  if(!pool.length) return;
  S.recentTit=S.recentTit||[];
  let fresh=pool.filter(t=>S.recentTit.indexOf(t.id)<0);
  const q=rnd(fresh.length?fresh:pool);   // CASUALE (i titoli locali sono flavor, non ordinati per gravità) + finestra anti-ripetizione
  S.recentTit.push(q.id); if(S.recentTit.length>5) S.recentTit.shift();
  const amica=(S.locale.consenso!=null?S.locale.consenso:50)>=50;
  S.lastTitolo=q.id;
  const luogo=localeNome()||'', ente=(tipo==='regione')?T('Regione'):T('Comune');
  const sub=(s)=>String(s).replace(/%LUOGO/g,luogo).replace(/%ENTE/g,ente);
  S.titoloMese={ id:q.id, testo:sub(T(amica?q.amico:q.ostile)), tono:(amica?'amica':'ostile') };   // i18n: T sul template, PRIMA di sub (%LUOGO/%ENTE intatti)
}

/* ============================================================
   UFFICIO STAMPA — le azioni proattive di comunicazione (tab Stampa). Iniziative del GIOCATORE,
   non carte: fuori dal tetto ≤2. Freno: UNA mossa AL MESE (S.mossaUltima, contatore-mese) —
   gli effetti in DICHIARAZIONI (data.js) sono tarati per la cadenza mensile.
   Ogni azione rilascia un COMUNICATO vero (tono a scelta, bersaglio nominato) che finisce nel log.
   Solo al governo: da sfidante c'è già il loop visibilità/credibilità (mondi separati).
   ============================================================ */
/* I cooldown delle mosse proattive seguono l'ETÀ (curva biografica, lotto 2): un punto di verità
   anche per i contatori a schermo. Neutro (49-63) = i numeri di sempre: stampa 1, partito 2. */
function cdStampa(){ const f=etaFase(); return ((f==='anziano'||f==='vecchio')?2:1) + (convalescente()?1:0); }   // +1 in convalescenza (lotto 5): deleghi
function cdPartito(){ const f=etaFase(); return (f==='giovane'?1:(f==='vecchio'?3:2)) + (convalescente()?1:0); }
function mossaDisponibile(){ const m=S.year*12+S.month; return S.mossaUltima==null || m-S.mossaUltima>=cdStampa(); }
function spendiMossa(){ S.mossaUltima=S.year*12+S.month; SALA_SUB=null; }
function nomeGruppo(g){ const gr=GROUPS.find(x=>x.id===g); return gr?T(gr.nm):g; }
function dichiara(testo){ S.log.unshift({t:'Dichiarazione', x:'«'+testo+'»'}); }
/* Intervista: scegli il tema (un gruppo) e il tono. Bonus subito, ma PROMETTI: se entro 3 mesi colpisci
   quel gruppo con le tue scelte (colpi cumulati ≥3 via gd), la stampa te la rinfaccia. La deriva naturale
   non conta mai (non passa da gd): il ritorno di fiamma è meritato, non sfortuna statistica. */
function azioneIntervista(grp, tono){
  if(S.opposizione || !mossaDisponibile()) return;
  const D=(DICHIARAZIONI.intervista||[]).find(x=>x.id===tono); if(!D) return;
  spendiMossa();
  gd(grp, D.grp); stampad(D.stampa);
  S.promessa={ grp:grp, mese:S.year*12+S.month, colpi:0 };
  dichiara(T(D.testo).replace(/%G/g, nomeGruppo(grp)));
  render();
}
/* Annuncio: rivendichi un risultato col tono scelto e i FATTI giudicano (li vedi prima: lettura, non dado). */
function azioneAnnuncio(tono){
  if(S.opposizione || !mossaDisponibile()) return;
  const D=(DICHIARAZIONI.annuncio||[]).find(x=>x.id===tono); if(!D) return;
  spendiMossa();
  const regge=(S.ind.growth>=1)||(S.ind.unemp<=7)||(S.ind.fiducia>=70);
  const e=regge?D.regge:D.gonfiato;
  gd('cetomedio', e.cm); stampad(e.stampa);
  dichiara(D.testo);
  S.log.unshift({t:'Annuncio', x: regge?'I numeri reggono: i media riprendono.':'Numeri gonfiati: i media smontano la narrazione.'});
  if(!regge && tono==='trionfale') spregiudicata(4);   // il trionfalismo smentito si ricorda (e alza l'esposizione)
  render();
}
/* Segnale a un alleato: apertura pubblica col tono scelto, tenuta su senza concedere nulla (leva del passo 4). */
function azioneSegnale(id, tono){
  if(S.opposizione || !mossaDisponibile() || !S.tenuta || S.tenuta[id]==null) return;
  const D=(DICHIARAZIONI.segnale||[]).find(x=>x.id===tono); if(!D) return;
  spendiMossa();
  S.tenuta[id]=clamp(S.tenuta[id]+D.tenuta,0,100);
  if(D.stampa) stampad(D.stampa);
  dichiara(T(D.testo).replace(/%A/g, T((part(id)||{}).nome||'')));
  render();
}
/* Attacco a un avversario col tono scelto: ne erodi la forza, ma la stampa giudica — se sei in difficoltà
   (consenso<45) è un diversivo "sotto la cintura": effetti dimezzati e stampa −3 extra, per ogni tono. */
function azioneAttacco(id, tono){
  if(S.opposizione || !mossaDisponibile()) return;
  const D=(DICHIARAZIONI.attacco||[]).find(x=>x.id===tono); if(!D) return;
  spendiMossa();
  const basso=S.ind.consenso<45, k=basso?0.5:1;
  applicaSlancio([id], D.forzaLui*k); applicaSlancio([S.partito], D.forzaMia*k);
  stampad(D.stampa + (basso?-3:0));
  if(tono==='frontale'||basso) spregiudicata(4);   // l'attacco duro (o il diversivo) resta nella memoria (e alza l'esposizione)
  dichiara(T(D.testo).replace(/%P/g, T((part(id)||{}).nome||'')));
  if(basso) S.log.unshift({t:'Attacco politico', x:'Per i media è un diversivo: colpo sotto la cintura.'});
  render();
}

/* ============================================================
   ELEZIONI INTERMEDIE — tra una nazionale e l'altra si vota nei territori.
   Mese relativo all'inizio mandato = turnInMandate*12 + (month-1); calendario in PAESI.intermedie.
   TUTTO l'esito passa da esitoIntermedia(ris): la FASE B (territori coi volti) estenderà SOLO quella
   funzione e il campo ris.aree, senza rifare il flusso.  Mai election()/gameOver() diretti: il danno
   passa solo da potere locale / forze / tenuta (e da lì, semmai, ultimatum→crisi).
   ============================================================ */
function meseMandato(){ return (S.turnInMandate||0)*12 + (S.month-1); }
function initPotereLocale(){ const share=quotaTerritori(); S.potereLocale=(share!=null)?share:bloccoQuota(); S.bloccoAtteso=bloccoQuota(); }
/* ===== Territori simbolo (FASE B) — eletti persistenti che cambiano col voto (nessuna meccanica sui personaggi). ===== */
function nomePersona(){ return rnd(PAESE.nomi)+' '+rnd(PAESE.cognomi); }
function compatibile(partitoId, asse){ const p=part(partitoId); return p ? Math.abs(p.asse-asse)<=1 : false; }
/* L34-1 - LE OTTO GUARDIE. Fino a oggi sette punti facevano mioPartito().campo dando per scontato che il
   partito del giocatore fosse sempre nel roster: con le nascite/morti non e piu vero, e il caso peggiore (il tuo
   partito che si scioglie) crasherebbe il gioco. Degrado ESPLICITO: si torna un partito-ombra neutro e si urla in
   console, perche se succede e un bug di dati da correggere, non una condizione da assorbire in silenzio. */
function mioPartito(){
  var p=(typeof part==='function') ? part(S.partito) : null;
  if(p) return p;
  if(typeof console!=='undefined' && console.warn) console.warn('[roster] il partito del giocatore ('+S.partito+') non e nel roster: nessuno snodo lo ha gestito. Partito-ombra neutro.');
  return { id:S.partito, nome:'—', asse:0, base:{}, forza:1, orientamento:'centro' };
}
function asseBlocco(){ const ids=bloccoIds(); let s=0,w=0; for(const id of ids){ const p=part(id); if(!p) continue; const f=(S.forze&&S.forze[id])||0; s+=p.asse*f; w+=f; } return w>0?s/w:(mioPartito().asse||0); }   // media PESATA e CONTINUA dell'asse del blocco
function partitoVicinoLean(lean){ let best=PAESE.partiti[0], bd=Infinity; for(const p of PAESE.partiti){ const d=Math.abs(p.asse-lean); if(d<bd){ bd=d; best=p; } } return best.id; }
function scegliPartito(tuoLato, lean, asseTuo){ const cand=PAESE.partiti.filter(function(p){ return tuoLato ? Math.abs(p.asse-asseTuo)<=1 : Math.abs(p.asse-asseTuo)>1; }); const pool=cand.length?cand:PAESE.partiti; let best=pool[0], bd=Infinity; for(const p of pool){ const d=Math.abs(p.asse-lean); if(d<bd){ bd=d; best=p; } } return best.id; }
function initTerritori(){ S.territori=(PAESE.territori||[]).map(function(TE){ return { titolare:nomePersona(), partito:partitoVicinoLean(TE.lean) }; }); }
function quotaTerritori(){ if(!S.territori || !S.territori.length) return null; const a=mioPartito().asse; return S.territori.filter(function(t){ return compatibile(t.partito,a); }).length / S.territori.length * 100; }
/* ============================================================
   F2 — LA MAPPA CHE CHIAMA. Un territorio pulsa (marcatore S.territorioChiama, dato puro) → il pallino sul tab Partiti
   e il pulse sulla mappa invitano → tap sull'area → mini-scheda con 2 opzioni. Ignorare = zero imboscata: il marcatore
   scade da sé dopo 3 mesi. Cadenza dedicata (~1/4-6 mesi), MAI lo stesso mese della telefonata. Effetti solo su valute
   vere (gd + indicatori nazionali): il territorio è il palcoscenico, non una valuta (potereLocale è derivato).
   ============================================================ */
function territorioChiamaDovuto(){
  if(typeof S==='undefined' || !S || S.livello!==3) return false;   // L25-1: F2 riaperta allo sfidante (pannello-mappa verificato: mostra titolare/partito/potereLocale, nessuna assunzione di governo)
  if(!PAESE || !PAESE.mappa) return false;                 // serve la mappa nazionale (Italia pilota; gli altri quando l'SVG c'è)
  if(!S.territori || !S.territori.length) return false;
  if(S.territorioChiama) return false;                      // uno alla volta
  if(S.telPendente) return false;                          // mai lo stesso mese della telefonata (i due formati-interruzione non si accavallano)
  /* L25-1 — ANZIANITÀ NEUTRA. La soglia serve solo a non far partire F2 nel primissimo mese, ma `mesiAlGoverno`
     cresce **solo mentre governi** (model.js:183, per il logorio) → da sfidante resta 0 e F2 non sarebbe MAI
     partita, anche dopo aver tolto il gate-opposizione: la riapertura sarebbe stata finta. All'opposizione si
     contano quindi i mesi giocati dall'inizio partita. Al governo il comportamento è identico a prima. */
  var _anz = S.opposizione ? ((S.year*12+S.month)-(((S.annoInizio||S.year)*12)+1)) : (S.mesiAlGoverno||0);
  if(_anz<4) return false;
  var mese=S.year*12+S.month;
  if(S.territorioUltimo!=null && mese-S.territorioUltimo<4) return false;   // cooldown 4
  return Math.random()<0.4;                                 // eleggibile → ~entro 2-3 mesi → ~1/5-6
}
/* sceglie un'area che CHIAMA: favorisce quelle NON del tuo blocco (la periferia/opposizione che ti invita a guardarla),
   evita la più recente. Ritorna un indice o null. */
function pickTerritorioChiama(){
  var a=mioPartito().asse;
  var idxs=S.territori.map(function(_,i){return i;});
  var avv=idxs.filter(function(i){ return !compatibile(S.territori[i].partito,a) && i!==S.territorioRecente; });
  var pool=avv.length?avv:idxs.filter(function(i){return i!==S.territorioRecente;});
  if(!pool.length) pool=idxs;
  return pool[Math.floor(Math.random()*pool.length)];
}
function pickProblemaTerr(){
  if(typeof TERRITORIO_PROB==='undefined') return null;
  var pool=TERRITORIO_PROB.filter(function(p){ return (typeof eraVivaT!=='function' || eraVivaT(p)); });
  if(!pool.length) return null;
  return pool[Math.floor(Math.random()*pool.length)].id;
}
function forseTerritorio(){
  if(!territorioChiamaDovuto()) return;
  var idx=pickTerritorioChiama(); if(idx==null) return;
  var prob=pickProblemaTerr(); if(!prob) return;
  var mese=S.year*12+S.month;
  S.territorioChiama={idx:idx, prob:prob, nato:mese};
  S.territorioUltimo=mese; S.territorioRecente=idx;
  try{ render(); commitSnap(); }catch(e){}   // il pallino sul tab Partiti + il pulse appaiono ora
}
/* la mappa invita, non ricatta: dopo 3 mesi senza risposta il marcatore scade da sé, il pulse muore, nessuna penalità. */
function scadiTerritorio(){
  if(S && S.territorioChiama && (S.year*12+S.month)-S.territorioChiama.nato>=3){ S.territorioChiama=null; try{ render(); commitSnap(); }catch(e){} }
}
function defProblemaTerr(id){ return (typeof TERRITORIO_PROB!=='undefined') ? TERRITORIO_PROB.filter(function(p){return p.id===id;})[0] : null; }
/* la risoluzione della mini-scheda (map-native): applica gli effetti, azzera il marcatore (S puro), richiude sull'invito. */
function resolveTerritorio(ci){
  if(!S || !S.territorioChiama) return;
  var def=defProblemaTerr(S.territorioChiama.prob); if(!def){ S.territorioChiama=null; render(); return; }
  var opt=def.ch[ci]; if(!opt) return;
  if(opt.f){ try{ opt.f(); }catch(e){} }
  var TE=(PAESE.territori||[])[S.territorioChiama.idx];
  var nome=(typeof nomeTerr==='function' && TE)?nomeTerr(TE):T('il territorio');
  S.log.unshift({ t:arcoTerrSub(T(def.t), TE), x:T('Sul territorio:')+' '+T(opt.l) });
  S.territorioChiama=null;
  S.ind.consenso=computeConsenso();   // gli effetti su gruppi/indicatori si riflettono sul consenso derivato
  render(); commitSnap();
}
/* %TERR → il nome dell'area, risolto a render (come %FILO per gli archi) */
function arcoTerrSub(str, TE){ if(str==null) return str; var nome=(typeof nomeTerr==='function' && TE)?nomeTerr(TE):T('il territorio'); return String(str).replace(/%TERR/g, nome); }
/* Decompone il risultato nazionale nei territori interessati: quota locale = 50 + onda (margine) + lean×asseBlocco×4 + rumore.
   >50 = controllato dal tuo blocco. Cambio lato → nuovo titolare (partito vincente più vicino al lean). Popola ris.aree + ris.territoriDopo. */
function decidiTerritori(ris){
  ris.aree=[]; if(!PAESE.territori || !S.territori) return;
  const asseTuo=mioPartito().asse, aB=asseBlocco(), wave=ris.margine;
  const dopo=S.territori.map(function(t){ return Object.assign({},t); });
  PAESE.territori.forEach(function(TE,i){
    if(!(ris.tocca==='tutti' || TE.tipo===ris.tocca)) return;
    const localShare=50 + wave + (TE.lean*aB*4) + (Math.random()*6-3);
    const nuovoTuo=localShare>50, eraTuo=compatibile(dopo[i].partito, asseTuo);
    if(nuovoTuo!==eraTuo){
      const partito=scegliPartito(nuovoTuo, TE.lean, asseTuo), nome=nomePersona();
      dopo[i]={ titolare:nome, partito:partito };
      ris.aree.push({ nome:TE.nome, nomeEn:TE.nomeEn, carica:TE.carica, caricaEn:TE.caricaEn, titolare:nome, partito:partito, tuo:nuovoTuo });   // FIX: era T.nome/T.carica (T = funzione traduzione → undefined); porta i campi grezzi, risolti in-lingua dal render
    }
  });
  ris.territoriDopo=dopo;
}
function intermediaA(m){ return (PAESE.intermedie||[]).find(x=>x.mese===m && (!x.ue||PAESE.ue)) || null; }
function pickIntermedia(){
  const m=meseMandato();
  const voto=intermediaA(m);   if(voto) return cartaRisultato(voto);     // si vota questo mese → risultato
  const camp=intermediaA(m+1); if(camp) return cartaCampagna(camp);      // si vota il mese prossimo → campagna
  return null;
}
/* ============================================================
   BIOGRAFIA (sistema narrativo, lotto 1 — la memoria). S.biografia registra le scelte che contano:
   contatori tematici (classificati dal campo `pleases` già presente sulle carte: rigore←tecnico,
   ordine←conservatore, sociale←progressista, pancia←populista, +identità se coincide col profilo
   del partito) + fatti notevoli datati (cap 40) + le leggi firmate. OSSERVA, non altera: in questo
   lotto i tratti sono etichette + il gancio haTratto() (due assaggi testuali). L'epilogo generato
   (generaEpilogo) trasforma la memoria in racconto a fine carriera — sobrio, mai retorico.
   ============================================================ */
function bioVuota(){ return { c:{rigore:0,ordine:0,sociale:0,pancia:0,identita:0,spregiudicatezza:0,leggi:0,crisi:0,emergenze:0,scaricati:0,difesi:0,elezioniVinte:0,intermedieVinte:0,intermediePerse:0,inchieste:0,assoluzioni:0,condanne:0,patteggiamenti:0,archi:0,affetti:0,affettiSacrificati:0,trionfi:0,sconfitteNette:0}, fatti:[], leggiFirmate:[], archiEpi:[] }; }
/* L'IMBUTO UNICO delle scelte spregiudicate (lotto 3): traccia cumulativa (il tratto) + rischio attuale
   (l'esposizione) in un punto solo. Tutto ciò che è sporco passa da qui: l'inchiesta, quando arriva,
   è SEMPRE l'esito delle tue scelte — mai un dado a freddo. */
function spregiudicata(n){ bioConta('spregiudicatezza'); espoSale(n||4); }
function espoSale(n){ if(S&&S.esposizione!=null) S.esposizione=clamp(S.esposizione+n,0,100); }
/* L'INTEGRITÀ si muove SOLO sull'asse politico (lotto 5): l'asse della scelta (da `pleases`) contro la tua
   coscienza (orientamento). La FEDE è slegata dalla meccanica (decisione di Giacomo: la religiosità dichiarata
   non determina le posizioni politiche — l'incoerenza umana è reale; resta colore, non penalizza nulla). Per
   l'ALLINEATO/centrista il conflitto è ~0 → integrità immobile: la dissonanza è una scelta di creazione. */
function integritaMuovi(choice){
  if(!S || S.integrita==null || !S.personaggio || !choice) return;
  const ori=S.personaggio.orientamento||0;
  const axis=({conservatore:1, progressista:-1})[choice.pleases]||0;   // populista/tecnico: neutri sull'asse coscienza
  if(axis!==0 && ori!==0) S.integrita=clamp(S.integrita+((axis*ori<0)?-2.5:1.0),0,100);   // contro coscienza vs fedele
}
function bioFatto(testo){ if(!S||!S.biografia) return; S.biografia.fatti.push({anno:S.year, testo:testo}); if(S.biografia.fatti.length>40) S.biografia.fatti.shift(); }
function bioConta(k,n){ if(S&&S.biografia&&S.biografia.c[k]!=null) S.biografia.c[k]+=(n||1); }
function bioPleases(p){ const map={tecnico:'rigore',conservatore:'ordine',progressista:'sociale',populista:'pancia'};
  if(map[p]) bioConta(map[p]); if(p===profiloPartito()) bioConta('identita'); }
/* L'epilogo: paragrafi generati dalla biografia. Le due cure di Giacomo: (1) carriera breve coi gruppi
   ancora neutri → niente rimpianti finti; (2) carriera vuota → comunque una storia da leggere. */
function generaEpilogo(reason){
  const B=S.biografia||bioVuota(), c=B.c, anni=Math.max(1,S.year-(S.annoInizio||2025)), par=[];
  par.push(T(anni===1?'Un solo anno sulla scena politica':'%A anni sulla scena politica').replace('%A',anni)+(PAESE.nomeArt?((typeof curLang==='function'&&curLang()==='en')?' of '+T(PAESE.nome):(' del'+(PAESE.nomeArt.slice(0,2)==='l\''?'l\''+PAESE.nomeArt.slice(2):' paese'))):'')+(S.mandatesWon>0?': '+S.mandatesWon+' '+T(S.mandatesWon===1?'mandato vinto':'mandati vinti'):'')+'.'
    +(S.eta!=null?' '+T('Esci di scena a %E anni.').replace('%E',S.eta):''));   // l'orologio biografico chiude l'arco
  if(B.leggiFirmate.length) par.push(T('Portano la tua firma: ')+B.leggiFirmate.slice(0,5).map(function(n){return T(n);}).join(', ')+(B.leggiFirmate.length>5?' '+T('e altre'):'')+'.');
  const t2=[];
  if(c.crisi) t2.push(c.crisi===1?T('una crisi del debito affrontata a viso aperto'):c.crisi+' '+T('crisi del debito affrontate'));
  if(c.emergenze) t2.push(c.emergenze===1?T('un\'emergenza nazionale attraversata'):c.emergenze+' '+T('emergenze nazionali attraversate'));
  if(c.scaricati) t2.push(c.scaricati===1?T('un ministro scaricato'):c.scaricati+' '+T('ministri scaricati'));
  if(t2.length) par.push(T('Sul cammino: ')+t2.join(', ')+'.');
  /* la statura internazionale (lotto internazionale fase A): la media delle relazioni coi grandi enti */
  if(typeof relIntMean==='function' && S.relInt && Object.keys(S.relInt).length){
    const ri=relIntMean();
    if(ri>=68) par.push(T('Sulla scena internazionale, una statura da statista: il mondo lo ascoltava.'));
    else if(ri<=34) par.push(T('Sulla scena internazionale restò isolato: troppe porte chiuse.'));
  }
  /* il rapporto con la società civile (lotto internazionale fase B): le ONG amiche o nemiche */
  if(S.relInt && S.relInt.ong!=null){
    if(S.relInt.ong>=66) par.push(T('La società civile lo ebbe amico: ONG e movimenti dalla sua parte.'));
    else if(S.relInt.ong<=34) par.push(T('Con la società civile fu rottura: le organizzazioni lo combatterono.'));
  }
  /* la CORONA internazionale (lotto internazionale fase C1a): se hai guidato il Consesso, l'apice oltre il vertice
     nazionale. Tono guidato dall'ESITO (robusto): estromissione/non-rinnovo (`mandatoInt`) → caduta; uscita
     VOLONTARIA (ritiro all'apice, congedo d'età) → corona, a prescindere dalla coesione del momento. */
  if(S.intl){
    if(reason==='mandatoInt') par.push(T('Arrivò al vertice del mondo, ma le Nazioni Unite si sfaldarono tra le sue mani.'));
    else par.push(T('Coronò la carriera al vertice del mondo: da %RUOLO, tenne coese le Nazioni Unite.').replace('%RUOLO',T(ruoloIntl())));
    /* Fetta 2: il congedo legge lo STATO FINALE DEL TABELLONE — il mondo che le tue mediazioni hanno plasmato
       (la tensione Alleanza–rivale: ricucita → mondo unito; spaccata → mondo diviso). */
    const ri=S.relInt||{}; const gap=Math.abs((ri.alleanza||50)-(ri.rivale||50));
    if(gap<=18) par.push(T('Lasciò un mondo più unito: i blocchi, un tempo nemici, restavano allo stesso tavolo.'));
    else if(gap>=34) par.push(T('Lasciò un mondo spaccato in due: l\'Alleanza e la potenza rivale ai ferri corti.'));
    else par.push(T('Lasciò un mondo in equilibrio precario: né pacificato, né del tutto in rotta.'));
  }
  /* la memoria giudiziaria (lotto 3): l'epilogo ricorda i fascicoli */
  if(c.assoluzioni>0 && !c.condanne && !c.patteggiamenti) par.push(T('Hai schivato l\'inchiesta che doveva travolgerti: assoluzione con formula piena.'));
  else if(c.condanne>0) par.push(T('Una condanna resta sul tuo nome, e gli archivi non dimenticano.'));
  else if(c.patteggiamenti>0) par.push(T('Hai patteggiato per sopravvivere%X: la macchia resta negli archivi.').replace('%X',c.patteggiamenti>1?T(', più di una volta'):''));
  /* la gavetta (lotto ascesa): l'arco dalla provincia al vertice è il cuore del gioco */
  if(B.origine==='locale' && S.mandatesWon>0) par.push(T('Dalla guida di un territorio alla guida del paese: una scalata cominciata dal basso.'));
  else if(B.origine==='locale' && S.livello>1) par.push(T('Dalla gavetta locale fino ai palazzi di Roma: la strada è stata lunga.'));
  /* il MODO delle urne (lotto payoff fase B): il margine ricordato come tratto di carriera (il trionfatore,
     quello delle vittorie sul filo, il bersagliato dalle disfatte) — derivato dai due contatori-estremo + le vittorie */
  if(c.trionfi>0 && !c.sconfitteNette) par.push(T(c.trionfi>=2?'Le sue vittorie elettorali furono trionfi.':'Conobbe il sapore di un trionfo alle urne.'));
  else if(c.sconfitteNette>0 && !c.trionfi) par.push(T('Le urne, alla fine, furono impietose.'));
  else if(c.trionfi>0 && c.sconfitteNette>0) par.push(T('Conobbe i trionfi e le disfatte: una parabola che non risparmiò nulla.'));
  else if(c.elezioniVinte>0 && !c.trionfi) par.push(T('Vinse le sue elezioni, ma sempre per un soffio: mai un trionfo.'));
  /* gli archi memorabili (lotto 4): l'epilogo ricorda le ultime due storie chiuse */
  if(B.archiEpi && B.archiEpi.length) par.push(B.archiEpi.slice(-2).join(' '));
  /* la vita privata e la coscienza (lotto 5): l'integrità tenuta o tradita (solo se eri dissonante), e la famiglia */
  const pp=S.personaggio||{}, dDiss=Math.abs((pp.orientamento||0)-((part(S.partito)||{}).asse||0));
  if(dDiss>=2 && S.integrita!=null){
    if(S.integrita>=65) par.push(gn('Restò fedele a se stesso: il potere non gli fece tradire le sue convinzioni.','Restò fedele a se stessa: il potere non le fece tradire le sue convinzioni.'));
    else if(S.integrita<40) par.push(T('Sacrificò le sue convinzioni al potere, un compromesso alla volta.'));
  }
  const fam=S.famiglia;
  if(fam){
    const nf=(fam.figli&&fam.figli.length)||0;
    /* l'asse-vita nell'epilogo (lotto VITA PERSONALE): cosa hai SACRIFICATO e cosa TENUTO — sia per chi cura, sia
       per chi sacrifica (prima solo il sacrificio aveva voce). L'arco genitore arriva via archiEpi; il tratto via «Ti hanno chiamato». */
    if(c.affettiSacrificati>=5 && c.affettiSacrificati>c.affetti) par.push(gn('La corsa al potere gli costò gli affetti: troppe assenze, troppe occasioni perse in famiglia.','La corsa al potere le costò gli affetti: troppe assenze, troppe occasioni perse in famiglia.'));
    else if(c.affetti>=5 && c.affetti>c.affettiSacrificati) par.push(gn('Trovò il tempo per chi amava: gli affetti gli restarono, accanto al potere.','Trovò il tempo per chi amava: gli affetti le restarono, accanto al potere.'));
    else if(c.affettiSacrificati>c.affetti && (fam.coniuge||nf)) par.push(T('Qualche assenza di troppo: la vita privata pagò un piccolo prezzo alla carriera.'));
    if(fam.coniuge||nf){
      const pezzi=[]; if(fam.coniuge) pezzi.push(T('un coniuge')); if(nf) pezzi.push(nf===1?T('un figlio'):nf+' '+T('figli'));
      par.push(gn('Lascia %X, la parte di vita che il potere non gli ha tolto.','Lascia %X, la parte di vita che il potere non le ha tolto.').replace('%X',pezzi.join(' '+T('e')+' ')));
    }
  }
  const tr=tratti();
  if(tr.length) par.push(T('Ti hanno chiamato ')+tr.map(function(id){return '«'+((TRATTI_DEF.find(function(d){return d.id===id;})||{}).nome||id)+'»';}).join(', ')+'.');
  if(!B.leggiFirmate.length && !t2.length && !tr.length && !(B.archiEpi&&B.archiEpi.length))   // cura 2: anche il vuoto ha la sua storia
    par.push(T(anni<=2?'Un passaggio breve, una promessa non mantenuta.':'Anni di ordinaria amministrazione: la storia volta pagina in fretta.'));
  const gs=GROUPS.map(function(g){return {id:g.id, nm:g.nm, v:S.groups[g.id]};}).sort(function(a,b){return b.v-a.v;});
  const spread=gs[0].v-gs[gs.length-1].v;
  if(anni<=2 && spread<12) par.push(T('Troppo poco tempo per lasciare un segno nella memoria del paese.'));   // cura 1: niente rimpianti finti
  else if(spread<8) par.push(T('Il paese ti saluta senza amore né rancore.'));
  else {
    const sing={cetomedio:1,cattolici:1};   // nomi di gruppo grammaticalmente singolari ("Ceto medio"); gli altri sono plurali
    const top=gs.filter(function(g){return g.v>=55;}).slice(0,2), bot=gs[gs.length-1];
    let r='';
    if(top.length) r+=top.map(function(g){return T(g.nm);}).join(' '+T('e')+' ')+' '+T((top.length===1&&sing[top[0].id])?'ti rimpiange':'ti rimpiangono');
    if(bot.v<45) r+=(r?'; ':'')+T(bot.nm)+' '+T(sing[bot.id]?'non ti perdona':'non ti perdonano');
    par.push(r?(r+'.'):T('Il paese ti guarda andare via, diviso.'));
  }
  return par;
}

/* ============================================================
   CORRENTI E PRIMARIE — la vita interna del partito (lotto 2026-06-12).
   Tre correnti universali (CORRENTI_DEF, data.js) con umori gemelli della tenuta (evolveCorrenti,
   model.js). Quando una corrente scende sotto 35 la SFIDA monta: il volto viene SOPRATTUTTO dalla
   mappa (un titolare del tuo blocco, meglio se area-simbolo), in mancanza dal leader della corrente
   più arrabbiata. Isteresi: rientra se tutte risalgono sopra 45. Dopo 3 mesi maturi (media umori <45)
   → primaria anticipata; se la sfida è viva alla vigilia delle nazionali → primaria PRIMA del voto.
   Esito: umori 50% + consenso 30% + potere locale 20% ± rumore, soglia 50 (+4 se sfidante da
   area-simbolo). Vinta: +10 a tutti, raffreddamento 12 mesi. Persa: gameOver('primaria').
   PRIM è transitorio (pattern NOTTE): mai in S, azzerato in applySnap.
   ============================================================ */
function initCorrenti(){
  const u=(S.personaggio&&S.personaggio.famiglia==='dinastia')?64:60;   // dinastia politica: il partito ti accoglie meglio (contatti di famiglia)
  S.correnti=CORRENTI_DEF.map(function(d){ return { id:d.id, leader:nomePersona(), umore:u }; });
}
function sfidaAttiva(){ return !!S.sfida; }
/* Il volto della sfida: prima i territori del tuo blocco (punteggio: simbolo 8 / 4 + forza del suo
   partito ×0,2 + regione +2), poi il leader della corrente più arrabbiata. È il payoff della mappa. */
function trovaVolto(){
  let best=null, bs=-1;
  if(S.territori && PAESE.territori && part(S.partito)){
    const a=mioPartito().asse;
    PAESE.territori.forEach(function(TE,i){
      const t=S.territori[i]; if(!t || !compatibile(t.partito,a)) return;
      const score=(TE.simbolo?8:4) + ((S.forze[t.partito]||0)*0.2) + (TE.tipo==='regione'?2:0);
      if(score>bs){ bs=score; best={ volto:t.titolare, carica:caricaTerr(TE), area:nomeTerr(TE), fonte:'territorio', simbolo:!!TE.simbolo }; }
    });
  }
  if(best) return best;
  const arr=(S.correnti||[]).slice().sort(function(a,b){return a.umore-b.umore;})[0];
  if(!arr) return null;
  const D=CORRENTI_DEF.find(function(d){return d.id===arr.id;})||{};
  return { volto:arr.leader, carica:T('leader')+' '+T(D.du||'di corrente'), area:null, fonte:'corrente', simbolo:false };
}
function aggiornaSfida(){
  if(!S.correnti) return;
  const mese=S.year*12+S.month;
  if(S.sfida){
    if(S.correnti.every(function(c){return c.umore>45;})){   // isteresi: la pace ritrovata fa rientrare la sfida
      S.log.unshift({t:T('La sfida rientra'), x:S.sfida.volto+' '+T('fa un passo indietro: le correnti si placano.')});
      S.sfida=null; return;
    }
    if(umoreMedio()<45) S.sfida.maturazione=(S.sfida.maturazione||0)+1;
    return;
  }
  if(S.primariaUltima!=null && mese-S.primariaUltima<12) return;   // raffreddamento dopo una primaria vinta
  const arr=S.correnti.find(function(c){return c.umore<35;});
  if(!arr) return;
  const v=trovaVolto(); if(!v) return;
  const D=CORRENTI_DEF.find(function(d){return d.id===arr.id;})||{};
  S.sfida=Object.assign({ corrente:arr.id, mese:mese, maturazione:0 }, v);
  S.log.unshift({t:'La sfida monta', x:v.volto+(v.area?(', '+v.carica+' — '+v.area):' ('+v.carica+')')+' si muove: '+(D.nome||'una corrente')+' in rivolta.'});
}
function sfidaMatura(){ return !!(S.sfida && (S.sfida.maturazione||0)>=3); }
/* La primaria: punteggio congelato all'apertura (pattern NOTTE), numeri mostrati onestamente. */
function apriPrimaria(tipo){
  const pl=(S.potereLocale!=null)?S.potereLocale:bloccoQuota();
  /* rumore ±3 e bonus-simbolo +2 (tarati col test della cura: governo solido + UNA corrente arrabbiata
     deve sopravvivere con margine; si perde solo deboli su più fronti insieme — mai a sorpresa) */
  const punteggio=umoreMedio()*0.5 + S.ind.consenso*0.3 + pl*0.2 + (Math.random()*6-3);
  const soglia=50 + (S.sfida && S.sfida.fonte==='territorio' && S.sfida.simbolo ? 2 : 0);
  PRIM={ tipo:tipo, punteggio:punteggio, soglia:soglia, win:punteggio>=soglia };
  const v=S.sfida||{};
  document.getElementById('modal').innerHTML=`<div class="mt"><div class="kicker">${T((part(S.partito)||{}).nome)} · ${T(tipo==='vigilia'?'Verso le elezioni':'Congresso anticipato')}</div><h2>${T('Primarie di partito')}</h2></div>
    <div class="mtext">${T('Ti sfida <b>%V</b>%X.').replace('%V',v.volto||'—').replace('%X',v.area?`, ${v.carica} — <b>${v.area}</b>`:(v.carica?` (${v.carica})`:''))} ${T(tipo==='vigilia'?'Prima di guidare il partito alle urne, devi vincere in casa.':'Il malcontento è maturo: il partito vota sulla tua leadership.')}</div>
    <div style="padding:0 18px 6px">${(S.correnti||[]).map(function(c){ const D=CORRENTI_DEF.find(function(d){return d.id===c.id;})||{};
      return `<div style="padding:5px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${T(D.nome)} <small style="color:var(--mut2)">· ${c.leader}</small></span><span class="mono">${Math.round(c.umore)}</span></div><div class="bar"><i style="width:${clamp(c.umore,2,100)}%;background:${c.umore<35?'var(--neg)':c.umore<50?'var(--warn)':'var(--pos)'}"></i></div></div>`; }).join('')}
      <div style="font-size:12px;color:var(--mut);margin-top:6px">${T("Pesano: l'umore delle correnti (50%), il consenso (%A · 30%), il potere locale (%B · 20%)%X.").replace('%A',Math.round(S.ind.consenso)).replace('%B',Math.round(pl)).replace('%X',PRIM.soglia>50?T(" — lo sfidante parte forte: guida un'area simbolo"):'')}</div></div>
    <div class="choices"><button class="opt" style="border-color:var(--brand)" onclick="esitoPrimaria()"><span class="ol">${T('Vai al voto dei militanti →')}</span></button></div>`;
  document.getElementById('ov').classList.add('on');
}
function esitoPrimaria(){
  if(!PRIM) return;
  if(PRIM.win){
    const marg=Math.round(PRIM.punteggio-PRIM.soglia);
    document.getElementById('modal').innerHTML=`<div class="mt"><div class="kicker">Primarie · esito</div><h2>I militanti ti confermano</h2></div>
      <div class="mtext">La sfida di <b>${(S.sfida||{}).volto||'—'}</b> rientra: il partito si ricompatta attorno alla tua leadership${marg>=8?' con un margine netto':marg<=2?', per un soffio':''}.</div>
      <div class="choices"><button class="opt" style="border-color:var(--acc)" onclick="vinciPrimaria()"><span class="ol" style="color:var(--acc-ink)">${PRIM.tipo==='vigilia'?'Guida il partito alle urne →':'Torna a governare →'}</span></button></div>`;
  } else {
    gameOver('primaria');   // PRIM e S.sfida ancora vivi: l'epilogo nomina il volto
    PRIM=null;
  }
}
function vinciPrimaria(){
  const tipo=PRIM?PRIM.tipo:'anticipata'; PRIM=null;
  if(S.sfida) bioFatto('Primarie vinte: la sfida di '+S.sfida.volto+' respinta.');
  tutteCorrenti(10);   // sollievo: il partito si ricompatta
  S.sfida=null; S.primariaUltima=S.year*12+S.month;
  S.log.unshift({t:'Primarie vinte', x:'Il partito si ricompatta: la leadership è confermata.'});
  document.getElementById('ov').classList.remove('on');
  if(tipo==='vigilia'){ election(); } else { render(); commitSnap(); }
}
/* --- Gestione attiva: UNA mossa di partito ogni cdPartito() mesi (2 al neutro; cooldown separato dalla mossa-stampa). --- */
function mossaPartitoDisponibile(){ const m=S.year*12+S.month; return S.mossaPartito==null || m-S.mossaPartito>=cdPartito(); }
function azioneIncarico(id){
  if(!S.correnti || !mossaPartitoDisponibile()) return;
  S.mossaPartito=S.year*12+S.month;
  const tgt=S.correnti.find(function(c){return c.id===id;});
  const eraCalda=!!(tgt && tgt.umore<47);   // curare una corrente DAVVERO calda premia la lungimiranza (loop attivo Lotto 2)
  S.correnti.forEach(function(c){ c.umore=clamp(c.umore+(c.id===id?8:-2),0,100); });   // +8/−2 (era +7/−3): la mossa ora si SENTE su umore medio
  if(eraCalda && S.tenuta){ for(var k in S.tenuta) S.tenuta[k]=clamp(S.tenuta[k]+2,0,100); }   // un partito compatto rassicura gli alleati → coalizione più salda
  const D=CORRENTI_DEF.find(function(d){return d.id===id;})||{};
  S.log.unshift({t:T('Incarico di partito'), x:T(eraCalda?'Un incarico di peso %C: la corrente si rinsalda, e il partito compatto rassicura gli alleati.':'Un incarico di peso %C: la corrente si rinsalda, le altre mugugnano.').replace('%C',T(D.a||'a una corrente'))});
  render();
}
function azioneMediazione(){
  if(!S.correnti || !mossaPartitoDisponibile()) return;
  const sotto=S.correnti.filter(function(c){return c.umore<50;}).sort(function(a,b){return a.umore-b.umore;});
  if(sotto.length<2) return;
  S.mossaPartito=S.year*12+S.month;
  corrented(sotto[0].id,7); corrented(sotto[1].id,7); corrented('fedelissimi',-2);   // +7/+7 (era +5): ricucire davvero pesa
  if(S.tenuta){ for(var k in S.tenuta) S.tenuta[k]=clamp(S.tenuta[k]+2,0,100); }   // ricucire il partito rassicura la coalizione
  S.log.unshift({t:'Mediazione interna', x:'Un tavolo riservato ricuce le correnti più scontente: il partito ritrova compattezza.'});
  render();
}

/* ===== PRESSIONI SULLE POLITICHE (loop attivo — Lotto 3) =====
   Una politica lasciata a un estremo, quando la condizione economica/sociale matura, genera una PRESSIONE che ti richiama a
   rivederla: è il pezzo che CHIUDE il loop economico (costo ricorrente → deficit → una pressione ti riporta sulla politica
   generosa, via il gancio conti→fiducia già modellato). LA CURA: rivedere = risolvere un problema reale (sollievo: il deficit
   rientra subito); tenere = scelta legittima con un altro trade-off (mercati/conti vs gruppi); entrambe valide, recuperabile. */
function groupLow(id,n){ return !!(S.groups && S.groups[id]!=null && S.groups[id]<n); }
function spostaPolitica(id, verso){   // mossa "sotto pressione": NON costa RP (lo snapshot segue), ma ricalcola i conti → sollievo immediato e visibile
  if(!S.pol || S.pol[id]==null) return; S.pol[id]=verso; if(S.snap) S.snap[id]=verso;
  if(typeof computeDeficit==='function') S.ind.deficit=computeDeficit();
}
function pressAckAttiva(pol){ return !!(S.pressAck && S.pressAck[pol]!=null && (S.year*12+S.month - S.pressAck[pol]) < 6); }   // dopo aver DECISO su una politica, il richiamo tace ~6 mesi: tenere è una scelta legittima, non un problema aperto che ti si rinfaccia ogni mese
function politicaSottoPressione(){   // la pressione da EVIDENZIARE: se c'è una carta-pressione APERTA in agenda punta a QUELLA (scheda↔carta sempre coerenti); altrimenti la prima attiva non ancora "messa a tacere"
  if(typeof POL_PRESSIONI==='undefined' || !S || S.opposizione || S.livello!==3 || !S.pol) return null;
  if(S.agenda){ for(var a=0;a<S.agenda.length;a++){ var it=S.agenda[a]; if(it && !it.resolved && it.kind==='dossier' && it.data && /^pp_/.test(it.data.id||'')) return it.data; } }   // coerenza scheda↔carta: l'evidenziazione segue la carta aperta, non il primo-match
  for(var i=0;i<POL_PRESSIONI.length;i++){ var p=POL_PRESSIONI[i]; if(pressAckAttiva(p.pol)) continue; try{ if(p.cond && p.cond() && eraVivaT(p)) return p; }catch(e){} }
  return null;
}
function pickPolPressione(){   // la carta-pressione: contingentata (~1 ogni 3 mesi) e dal sacchetto anti-ripetizione — non deve schiacciare l'imbuto da 2 carte
  if(typeof POL_PRESSIONI==='undefined' || !S || S.opposizione || S.livello!==3 || !S.pol) return null;
  var mese=S.year*12+S.month;
  if(S.pressUltimo!=null && mese-S.pressUltimo<3) return null;
  var attive=POL_PRESSIONI.filter(function(p){ if(pressAckAttiva(p.pol)) return false; try{ return p.cond && p.cond() && eraVivaT(p); }catch(e){ return false; } });   // salta le politiche su cui hai appena deciso (rispetta la scelta: niente carta doppione subito dopo)
  if(!attive.length) return null;
  var p=(typeof pescaBag==='function') ? pescaBag('press', attive) : attive[0];
  if(!p) return null;
  S.pressUltimo=mese;
  return { kind:'dossier', data:p, resolved:false };
}

/* ===== PARLAMENTO EUROPEO (solo ue:true) — il peso del tuo gruppo a Bruxelles. =====
   pesoUEBase = quota-base del gruppo del TUO partito; calcolaPE proietta il risultato nazionale
   delle europee sul riparto: quotaTuo = clamp(base + (quotaBlocco − 45)·0,25, 3, 40) — 45 è il
   risultato "tipico" stilizzato. Gli altri gruppi si riscalano e si arrotondano col metodo dei
   resti a somma 100 (lo stesso dei seggi). S.pesoUE = la quota del tuo gruppo (dato puro). */
function pesoUEBase(){
  if(!PAESE.ue || typeof GRUPPI_UE==='undefined') return null;
  const g=(part(S.partito)||{}).gruppoUE; const G=GRUPPI_UE.find(x=>x.id===g);
  return G?G.base:null;
}
function calcolaPE(quotaBlocco){
  if(!PAESE.ue || typeof GRUPPI_UE==='undefined') return null;
  const mio=(part(S.partito)||{}).gruppoUE; const G0=GRUPPI_UE.find(x=>x.id===mio);
  if(!G0) return null;
  const mia=clamp(G0.base + (quotaBlocco-45)*0.25, 3, 40);
  const resto=100-mia, restoBase=100-G0.base;
  const raw=GRUPPI_UE.map(g=> g.id===mio ? {id:g.id, nome:g.nome, v:mia} : {id:g.id, nome:g.nome, v:g.base*resto/restoBase});
  const q=raw.map(x=>({id:x.id, nome:x.nome, f:Math.floor(x.v), r:x.v-Math.floor(x.v)}));
  let used=q.reduce((s,x)=>s+x.f,0);
  q.slice().sort((a,b)=>b.r-a.r).forEach(x=>{ if(used<100){ x.f++; used++; } });
  const gruppi=q.map(x=>({id:x.id, nome:x.nome, quota:x.f, tuo:x.id===mio})).sort((a,b)=>b.quota-a.quota);
  const rank=gruppi.findIndex(g=>g.tuo)+1;
  return { gruppi, rank, quota:gruppi[rank-1].quota };
}

function cartaCampagna(ev){
  const oppo=S.opposizione;
  return { kind:'event', data:{ kick:T(ev.tipo), t:T('Campagna')+' · '+T(ev.tipo),
    text:T('Tra un mese si vota%X. Come la giochi?').replace('%X',oppo?T(' — per te all\'opposizione è una tappa della rimonta'):''), ch:[
      { l:'Metterci la faccia', e:'Spinta al risultato, ma il colpo è doppio se perdi', f:()=>{ S.campagnaMod=3; S.campagnaFaccia=true; } },
      { l:'Lasciare ai candidati locali', e:'Nessun rischio, nessuna spinta', f:()=>{ S.campagnaMod=0; S.campagnaFaccia=false; } },
      { l:'Promettere risorse al territorio', e:oppo?'Spinta, ma intacca la credibilità':'Spinta, ma debito su', f:()=>{ S.campagnaMod=2; S.campagnaFaccia=false; if(oppo) S.credibilita=clamp((S.credibilita||50)-5,0,100); else S.ind.debt+=0.4; } },
    ] } };
}
function cartaRisultato(ev){
  const quota=clamp(bloccoQuota()+(S.campagnaMod||0)+(Math.random()*4-2), 0, 100);
  const attesa=(S.bloccoAtteso!=null)?S.bloccoAtteso:quota;
  const ris={ tipo:ev.tipo, tocca:ev.tocca||'tutti', quota, attesa, margine:Math.round((quota-attesa)*10)/10, win:quota>=attesa, faccia:!!S.campagnaFaccia, aree:[] };
  decidiTerritori(ris);   // FASE B: decompone il risultato nei territori (ris.aree + ris.territoriDopo)
  if(ev.ue) ris.pe=calcolaPE(ris.quota);   // EUROPEE: la composizione del Parlamento europeo (solo qui, mai per regionali/municipali)
  return { kind:'intermedia', ev, ris, resolved:false };
}
/* UNICO punto d'esito (FASE B: estendere qui + ris.aree). Potere locale, slancio, tenuta, aspettativa. */
function esitoIntermedia(ris){
  if(ris.territoriDopo) S.territori=ris.territoriDopo;                   // FASE B: commit dei territori decisi alla generazione
  const share=quotaTerritori();                                          // potere locale = quota dei territori controllati dal tuo blocco
  const cur=(S.potereLocale!=null)?S.potereLocale:(share!=null?share:ris.quota);
  S.potereLocale=clamp(cur+((share!=null?share:ris.quota)-cur)*0.5, 0, 100);   // converge come prima
  applicaSlancio(bloccoIds(), (ris.win?1:-1)*1.5);                       // slancio forze: blocco su/giù (in opp. il governo AI è nel "resto")
  if(!S.opposizione && S.tenuta){                                        // tenuta alleati (mai caduta diretta: solo questo canale)
    for(const id in S.tenuta){ let d=ris.win?5:-8; if(!ris.win && ris.faccia) d*=2; S.tenuta[id]=clamp(S.tenuta[id]+d,0,100); }
  }
  S.bloccoAtteso=ris.quota; S.campagnaMod=0; S.campagnaFaccia=false;
  if(S.correnti){   // correnti: il voto locale pesa dentro il partito (vinta: tutti su; persa: i Militanti per primi)
    if(ris.win) tutteCorrenti(4);
    else { corrented('militanti',-6); corrented('fedelissimi',-3); corrented('pontieri',-3); }
  }
  bioConta(ris.win?'intermedieVinte':'intermediePerse');   // biografia: il conto dei voti locali
  if(ris.pe){   // EUROPEE: commit del peso a Bruxelles + spinta/freno di reputazione (si riassorbe con l'àncora a 0,06/mese)
    S.pesoUE=ris.pe.quota;
    repd(ris.win?3:-3);
    const mioNome=(ris.pe.gruppi.find(g=>g.tuo)||{}).nome||'';
    /* L16-1 — frase intera con segnaposto: l'ordinale «º» vive DENTRO il template italiano (in inglese la forma è
       un'altra), così la traduzione può risistemarlo senza frammenti appesi. */
    S.log.unshift({t:T('Parlamento europeo'), x:T('Il tuo gruppo (%G) è %R° per peso, con il %Q%.').replace('%G',mioNome).replace('%R',ris.pe.rank).replace('%Q',ris.pe.quota)});
  }
  /* L16-1 — FRASE INTERA con segnaposto, tradotta come unità (mai frammenti: l'ordine delle parti cambia da lingua
     a lingua). Due frasi separate per avanzata/arretramento; la coda-territori è una frase a sé, con la variante
     singolare (un «1 territori» sarebbe rotto in entrambe le lingue). */
  var _qz=Math.round(ris.quota), _az=Math.round(ris.attesa), _nz=(ris.aree&&ris.aree.length)||0;
  var _xz=T(ris.win?'Il tuo blocco è al %Q% (atteso %A%): avanzi.':'Il tuo blocco è al %Q% (atteso %A%): arretri.').replace('%Q',_qz).replace('%A',_az);
  if(_nz) _xz+=' '+(_nz===1?T('Un territorio cambia colore.'):T('%N territori cambiano colore.').replace('%N',_nz));
  S.log.unshift({t:T(ris.tipo), x:_xz});
}

/* --- Agenda mensile --- */
/* ============================================================
   L'INCHIESTA (sistema narrativo, lotto 3) — l'esposizione che diventa storia.
   GUIDATA, MAI DADO A FREDDO (vincolo di Giacomo): sotto esposizione 55 la probabilità NON ESISTE;
   sopra, p = (esposizione−55)/200 al mese (75→10%, 95→20%), raffreddamento 12 mesi dopo ogni arco.
   Anti-ricarica: il tiro e l'avanzamento di fase sono stampigliati sul mese (S.inchiestaRoll /
   S.inchiesta.mese, dentro S) — ricaricare il salvataggio NON ritira il dado e NON salta fasi.
   ============================================================ */
function aggiornaInchiesta(){
  const mese=S.year*12+S.month;
  /* arco in corso: avanza di una fase al mese (anche se temporeggi) e ripresenta la carta */
  if(S.inchiesta){
    if(S.inchiesta.mese!==mese){ S.inchiesta.fase=Math.min(4,S.inchiesta.fase+1); S.inchiesta.mese=mese; }
    S.agenda.push({kind:'inchiesta', fase:S.inchiesta.fase, resolved:false});
    return 'arco';
  }
  /* nuovo avviso? tetto archi (un'inchiesta NON si apre se 2 archi grandi sono già in corso) + cancello
     duro sull'esposizione + raffreddamento + un solo tiro al mese */
  if((S.archi?S.archi.length:0) >= 2) return null;   // slotsArchi pieno di archi: niente nuova inchiesta
  /* L40-2 — la «questione morale» degli anni '90 non è una meccanica nuova: è questa che morde di più.
     Al picco ('93) il cancello sull'esposizione scende di 10, il raffreddamento da 12 mesi passa a 8 e la
     probabilità sale di metà. Fuori dalla campana i tre numeri sono quelli di sempre, bit per bit. */
  var _m=(typeof climaMorale==='function')?climaMorale():0;
  if((S.esposizione||0) < (55-10*_m)) return null;
  if(S.inchiestaUltima!=null && mese-S.inchiestaUltima < (12-4*_m)) return null;
  if(S.inchiestaRoll===mese) return null;
  S.inchiestaRoll=mese;
  if(Math.random()>=(S.esposizione-(55-10*_m))/(200-70*_m)) return null;
  /* bersaglio: al governo 60% tu / 40% un ministro a rischio; all'opposizione sempre tu */
  if(!S.opposizione && Math.random()<0.4 && S.ministers && S.ministers.length){
    const pool=SCANDALI.filter(function(s){return s.giudiziario && eraVivaT(s);});
    if(pool.length){
      const cands=S.ministers.filter(function(m){return !m.resigning;});
      if(cands.length){
        const m=cands.map(function(x){return {m:x,r:ministerRisk(x)};}).sort(function(a,b){return b.r-a.r;})[0].m;
        S.agenda.push({kind:'scandalo', min:m.min, scn:rnd(pool), resolved:false});
        S.inchiestaUltima=mese;   // anche l'inchiesta al ministro raffredda il fronte giudiziario
        return 'ministro';
      }
    }
  }
  S.inchiesta={fase:1, mese:mese, difesa:0, pm:nomePersona(), scelte:[]};
  bioConta('inchieste'); bioFatto('L\'avviso di garanzia: l\'inchiesta ti raggiunge.');
  S.agenda.push({kind:'inchiesta', fase:1, resolved:false});
  return 'arco';
}
/* chiusura dell'arco (qualunque esito): parte il raffreddamento di 12 mesi */
function chiudiInchiesta(){ S.inchiesta=null; S.inchiestaUltima=S.year*12+S.month; }
/* La SENTENZA: esposizione al giudizio + difese accumulate + rapporto stampa (l'assicurazione del
   buon governo) ± rumore. <40 assoluzione · 40-64 lieve · ≥65 grave. */
function esitoSentenza(){
  const st=(S.ind.stampa!=null)?S.ind.stampa:50;
  const p=50+(S.esposizione-55)*0.8-(S.inchiesta?S.inchiesta.difesa:0)*4-(st-50)*0.4+(Math.random()*8-4);
  return p<40?'assoluzione':p<65?'lieve':'grave';
}

/* ============================================================
   GLI ARCHI NARRATIVI (sistema narrativo, lotto 4) — storie multi-mese a GRAFO (ARCHI_DEF, data.js).
   Stato puro in S.archi: ogni arco {id, nodo, scelte[], nato, prossimo}. La carta dipende SOLO dal
   nodo (idempotente → atomicità: ricaricare ripresenta la stessa carta, non salta né ritira); il tiro
   d'attivazione è stampigliato sul mese (S.archiRoll). TETTO: max 2 archi grandi concorrenti, INCHIESTA
   INCLUSA (slotsArchi). CADENZA: al massimo UNA carta-arco al mese, e solo nei mesi tranquilli (niente
   evento né inchiesta); coda FIFO (chi aspetta da più tempo). Solo al GOVERNO in questo lotto.
   ============================================================ */
function slotsArchi(){ return (S.archi?S.archi.length:0) + (S.inchiesta?1:0); }
function arcoInCorso(id){ return !!(S.archi && S.archi.find(function(a){return a.id===id;})); }
function arcoInCooldown(A){ const mese=S.year*12+S.month; const t=S.archiCooldown&&S.archiCooldown[A.id]; return t!=null && mese-t<(A.cooldown||30); }
function pushArco(a){
  /* scena per-costruzione (audit E): il kick vive sul NODO corrente (ARCHI_DEF[id].nodi[nodo].kick) → lo passo in
     data.kick e la catena scenaId (kick→min) risolve per tema. Fallback: nessun kick → data.kick null → nessuna scena
     (nessuna rottura). Il ramo render/resolve arco ricostruisce da ARCHI_DEF, non da data → aggiungere data è sicuro. */
  var _def=(typeof ARCHI_DEF!=='undefined')?ARCHI_DEF.find(function(x){return x.id===a.id;}):null;
  var _k=(_def && _def.nodi && _def.nodi[a.nodo] && _def.nodi[a.nodo].kick) || null;
  S.agenda.push({kind:'arco', arco:a.id, nodo:a.nodo, data:{kick:_k}, resolved:false});
}
/* sostituzione testi-arco (lotto PAYOFF NARRATIVO, fase A — «archi che si sentono»): il FILO ricorrente
   (%FILO=nome della figura fittizia, %RUOLO=il suo ruolo), l'ECO-callback (%ECO=la clausola lasciata dalla
   scelta precedente, «Dopo lo sgombero, …») e %FIGLIO. Fallback MORBIDO per i vecchi salvataggi (arco senza
   filo/eco → termine generico / stringa vuota): nessun placeholder orfano a schermo. */
function arcoSub(str, a){
  if(str==null) return str;
  const f=(a&&a.filo)||null;
  let out=String(str)
    .replace(/%ECO/g, (a&&a.eco) || '')                  // PRIMA l'eco: può contenere %FILO (es. «Dopo l'attacco a %FILO»), risolto dal passaggio successivo
    .replace(/%FUGA/g, (function(){ if(str.indexOf('%FUGA')<0) return ''; var D=(typeof ARCHI_DEF!=='undefined'&&a)?ARCHI_DEF.find(function(x){return x.id===a.id;}):null; if(!D||!D.fuga) return ''; var storica=(typeof S!=='undefined'&&S&&S.era&&S.era!=='contemporanea'); return T(storica?D.fuga.e50:D.fuga.p); })())   // G3 — la voce d'epoca della fuga di notizia (arco-scandalo): «lettera anonima al ministero» ('50) / «dossier in redazione» (oggi)
    .replace(/%FILO/g, (f&&f.nome) || T('la vicenda'))
    .replace(/%RUOLO/g, (f&&f.ruolo) || '')
    .replace(/%FIGLIO/g, (typeof figlioNome==='function'?figlioNome(16,32):T('tuo figlio')));
  if(f && f.pot && typeof potSub==='function' && typeof potDi==='function'){ const p=potDi(f.pot); if(p) out=potSub(out,p); }   // cantiere paesi reali (Fetta B): l'arco con un VOLTO fissato (es. l'aggressione) risolve %POTdet/%POTdi… dalla potenza del filo
  return out;
}
/* aggiornaArchi: (1) prova ad accendere un nuovo arco "in sottofondo" (se c'è uno slot libero); (2) presenta
   UNA SOLA carta-arco — la coda FIFO sceglie chi aspetta da più tempo, gli altri restano in attesa. L'attivazione
   è separata dalla presentazione: così due archi possono coesistere e ALTERNARSI di mese in mese (l'intreccio),
   senza mai due carte-arco nello stesso mese. bloccato = c'è già un'altra carta narrativa (evento/inchiesta). */
/* dove un arco può vivere nel ruolo corrente: i politici solo al governo, i personali (vita/coscienza/salute)
   ovunque (lotto 5). Vale sia per l'avvio sia per la presentazione di un arco in corso. */
function arcoQui(dove){ const d=dove||'governo';
  if(d==='entrambi') return true;                       // gli archi personali ti seguono sempre
  if(S.livello===2||S.livello===5) return false;        // da ministro/diplomatico: niente archi POLITICI nazionali (solo i personali, dove:'entrambi')
  return d===(S.opposizione?'opposizione':'governo'); }
function aggiornaArchi(bloccato){
  if(!S.archi) return false;
  if(bloccato) return false;
  const mese=S.year*12+S.month;
  provaAvviaArco(mese);                                  // può aggiungere un arco a S.archi (senza carta qui)
  const pronti=S.archi.filter(function(a){ const A=ARCHI_DEF.find(function(d){return d.id===a.id;}); return mese>=a.prossimo && A && arcoQui(A.dove); })
    .sort(function(x,y){ return (x.prossimo-y.prossimo) || (x.nato-y.nato); });   // FIFO: chi aspetta da più tempo
  if(pronti.length){ pushArco(pronti[0]); return true; }
  return false;
}
/* G3 — la famiglia SCANDALI ha un INNESCO DEDICATO, non compete nel pool generico (dove prob 0.08 la faceva
   sistematicamente sovrastare da vertenza/ondata a 0.12-0.13 → non partiva mai). Cadenza controllata: cooldown-
   famiglia 36m + prob mensile 0.5 → parte entro ~2 mesi da quando è eleggibile ≈ 1 ogni ~3 anni. */
function scandaloArcoDovuto(){
  if(typeof S==='undefined' || !S || S.livello!==3 || S.opposizione) return false;
  if(S.inchiesta) return false;                                    // anti-doppio-processo: mai un arco-scandalo mentre un'inchiesta è aperta
  if(slotsArchi()>=2) return false;
  if((S.mesiAlGoverno||0)<6) return false;
  var mese=S.year*12+S.month;
  if(S.scandaloUltimo!=null && mese-S.scandaloUltimo<36) return false;   // cooldown-famiglia ~3 anni
  return Math.random()<0.5;
}
function seedScandaloArco(mese){
  if(typeof ARCHI_DEF==='undefined') return;
  var recent=S.recentArchi||[];
  var cand=ARCHI_DEF.filter(function(A){ return A.famiglia==='Scandali' && !arcoInCorso(A.id) && recent.indexOf(A.id)<0; });
  if(!cand.length) cand=ARCHI_DEF.filter(function(A){ return A.famiglia==='Scandali' && !arcoInCorso(A.id); });
  if(!cand.length) return;
  var A=cand[Math.floor(Math.random()*cand.length)];
  var f=(A.filo?A.filo():null); if(f&&f.ruolo)f.ruolo=T(f.ruolo);   // filo() stampa S.scandaloUltimo alla nascita
  S.archi.push({id:A.id, nodo:A.start||'start', scelte:[], nato:mese, prossimo:mese, filo:f, eco:'', peso:0});
  S.recentArchi=recent; S.recentArchi.push(A.id); if(S.recentArchi.length>2) S.recentArchi.shift();
}
function provaAvviaArco(mese){
  if(slotsArchi()>=2) return;                                                  // tetto (inchiesta inclusa): mai più di 2 archi grandi
  if(S.archiRoll===mese) return;                                               // un solo tiro al mese (anti-ricarica)
  S.archiRoll=mese;
  if(scandaloArcoDovuto()){ seedScandaloArco(mese); return; }                  // G3 — priorità all'innesco-scandalo dedicato (occupa il tiro-arco del mese)
  const recent=S.recentArchi||[];
  const cand=ARCHI_DEF.filter(function(A){
    return A.famiglia!=='Scandali' && arcoQui(A.dove) && !arcoInCorso(A.id) && !arcoInCooldown(A) && recent.indexOf(A.id)<0 && (!A.cond||A.cond()) && eraViva(A);   // G3: gli scandali NON passano dal pool (innesco dedicato sopra); eraViva (flip): gli archi moderni non affiorano nel '50
  });
  if(!cand.length) return;
  const ord=cand.slice().sort(function(){ return Math.random()-0.5; });        // ordine casuale: nessun arco ha la precedenza fissa
  for(const A of ord){
    if(Math.random() < (A.prob!=null?A.prob:0.12)){
      S.archi.push({id:A.id, nodo:A.start||'start', scelte:[], nato:mese, prossimo:mese, filo:(function(){const f=(A.filo?A.filo():null); if(f&&f.ruolo)f.ruolo=T(f.ruolo); return f;})(), eco:'', peso:0});   // nasce col suo FILO (fase A); i18n: il RUOLO (testo display) tradotto alla creazione, il nome generato resta
      S.archiUltimoStart=mese;
      S.recentArchi=recent; S.recentArchi.push(A.id); if(S.recentArchi.length>2) S.recentArchi.shift();
      return;
    }
  }
}
/* chiusura dell'arco: fatto datato in biografia + clausola per l'epilogo (ring di 2) + cooldown. */
function chiudiArco(a, fatto, epi){
  if(fatto) bioFatto(fatto);
  if(epi && S.biografia){ S.biografia.archiEpi=S.biografia.archiEpi||[]; S.biografia.archiEpi.push(epi); if(S.biografia.archiEpi.length>2) S.biografia.archiEpi.shift(); }
  bioConta('archi');
  S.archiCooldown=S.archiCooldown||{}; S.archiCooldown[a.id]=S.year*12+S.month;
  S.archi=S.archi.filter(function(x){return x!==a;});
}

/* EVENTI PERSONALI singoli (lotto 5) — leggeri, dentro il tetto di 2 carte (NON occupano slot-arco).
   Gerarchia: coscienza (solo a integrità bassa e personaggio dissonante) > carriera/affetti > momenti lieti.
   Raffreddamento di 4 mesi fra eventi personali; un solo tiro/mese. dove:'entrambi' (anche da sfidante). */
/* la VITA PERSONALE (lotto VITA PERSONALE): DATO-GUIDATA da EVENTI_PERSONALI (cond/p/tipo/ripetibile). Cooldown 3
   (era 4) + più dilemmi → la vita personale è una PRESENZA ricorrente, non un evento raro. Priorità: i drammatici
   (crisi/coscienza) prima, poi affetti/dubbio, poi i lieti; `ripetibile:true` può tornare, gli altri rispettano
   recentPers. La cura: i dilemmi sono BIVI (costo nominabile su un asse), mai sfortuna a freddo. */
/* G1 — LA FAMIGLIA VIVA: i giorni buoni + le scelte di tempo. Innesco DEDICATO (cadenza propria ~1-2/anno), priorità
   sul beat personale del mese: quando è dovuto occupa lo slot-personale (niente carta in più, niente competizione nel
   pool dei dilemmi). Once-in-vita in S.famigliaVivaFatti; i ripetibili con finestra recentFamigliaViva. */
function famigliaVivaCard(){
  if(typeof S==='undefined' || !S || typeof FAMIGLIA_VIVA==='undefined' || !famigliaPresente()) return null;
  var mese=S.year*12+S.month;
  if(S.famigliaVivaUltimo!=null && mese-S.famigliaVivaUltimo<6) return null;   // cooldown-famiglia ~6 mesi → cadenza rara (~1-1,5/anno, misurata)
  var fatti=S.famigliaVivaFatti||[], recent=S.recentFamigliaViva||[];
  var pool=FAMIGLIA_VIVA.filter(function(b){
    if(b.once && fatti.indexOf(b.id)>=0) return false;        // già vissuto una volta nella vita (nascita/matrimonio…)
    if(!b.once && recent.indexOf(b.id)>=0) return false;      // ripetibili: finestra anti-ripetizione
    if(b.cond && !b.cond()) return false;                     // coerenza-età (haFiglioInEta) / famiglia presente
    return (typeof eraVivaT!=='function' || eraVivaT(b));     // era-split (compleanno '50 vs presente)
  });
  if(!pool.length) return null;
  if(Math.random()>=0.85) return null;                        // eleggibile → parte quasi subito dopo il cooldown (il collo di bottiglia è raggiungere lo slot-personale nei mesi tranquilli)
  var b=(typeof pescaBag==='function') ? pescaBag('famviva|'+((S&&S.era)||'p'), pool) : pool[Math.floor(Math.random()*pool.length)];
  S.famigliaVivaUltimo=mese;
  if(b.once){ S.famigliaVivaFatti=fatti; S.famigliaVivaFatti.push(b.id); }
  else { S.recentFamigliaViva=recent; S.recentFamigliaViva.push(b.id); if(S.recentFamigliaViva.length>3) S.recentFamigliaViva.shift(); }
  return {kind:'personale', data:b, resolved:false};
}
function pickPersonale(){
  if(!S.personaggio || typeof EVENTI_PERSONALI==='undefined') return null;
  const mese=S.year*12+S.month;
  var fv=famigliaVivaCard(); if(fv){ S.persUltimo=mese; return fv; }   // G1 — la famiglia viva ha priorità sullo slot-personale del mese (cadenza propria)
  const cd=(S.livello===1)?2:3;   // a livello 1 la vita personale è più presente (è il «secondo flusso» del locale, e il giovane sindaco ha una vita)
  if(S.persUltimo!=null && mese-S.persUltimo<cd) return null;
  const recent=S.recentPers||[];
  const ord={crisi:0, coscienza:1, affetti:2, dubbio:2, lieto:3};
  const cands=EVENTI_PERSONALI.filter(function(e){
    if(e.cond && !e.cond()) return false;
    if(!e.ripetibile && recent.indexOf(e.id)>-1) return false;   // i non-ripetibili (affetti/lieti) non tornano a breve; crisi/coscienza sì
    return eraVivaT(e);   // vita privata = senza-tempo (default universale): sopravvive nel '50; i pochi a cornice moderna si taggano 'contemporanea'
  }).sort(function(a,b){ return (ord[a.tipo]==null?2:ord[a.tipo])-(ord[b.tipo]==null?2:ord[b.tipo]); });   // i drammatici hanno la precedenza
  for(const e of cands){
    if(Math.random() < (e.p!=null?e.p:0.12)){
      S.persUltimo=mese; S.recentPers=recent; S.recentPers.push(e.id); if(S.recentPers.length>4) S.recentPers.shift();
      return {kind:'personale', data:e, resolved:false};
    }
  }
  return null;
}

function genAgendaRamo(first){
  S.agenda=[];
  // D4 — il PILASTRO datato: l'Italia entra alle Nazioni Unite (14 dic 1955). One-shot per l'era '50 (qualsiasi livello):
  // da lì l'orizzonte ONU si apre (ruoloIntl/nodo passano all'ONU con l'orologio). S.onuFatto: campo nuovo, migrazione undefined→false.
  if(!first && S.era===LINEA_IT && !S.onuFatto && typeof PILASTRO_ONU_EV!=='undefined' && (S.year>1955 || (S.year===1955 && S.month>=12)) && !S.opposizione){
    S.onuFatto=true; S.agenda.push({kind:'event', data:PILASTRO_ONU_EV, resolved:false}); agendaSolo(); return;
  }
  /* L28-4 — i PILASTRI del '70: cronaca all'orologio, one-shot, per QUALUNQUE ruolo (sono fatti del paese).
     Iniettati qui, prima dei rami: in fondo a genAgendaRamo non li vedrebbe nessuno tranne il premier (lezione L17-1).
     Ordine cronologico = ordine dell'array; se due sono scaduti insieme escono in due mesi consecutivi. */
  if(!first && S.era===LINEA_IT && typeof PILASTRI_LINEA!=='undefined'){
    S.pilastri70=S.pilastri70||{};
    for(var _pi=0;_pi<PILASTRI_LINEA.length;_pi++){
      var _P=PILASTRI_LINEA[_pi];
      if(S.pilastri70[_P.id]) continue;
      /* L34-3 - UN PILASTRO GIA ACCADUTO PRIMA CHE LA PARTITA COMINCI NON E CRONACA, E STORIA: chi parte nel
         1980 non deve ricevere piazza Fontana e il caso Moro come se succedessero ora. Trovato grazie allo
         scenario nuovo: prima dell 80 il caso non poteva darsi (si partiva sempre dal 50). Si marcano come
         gia visti, cosi non tornano nemmeno dopo. */
      if((_P.anno*12+_P.mese) < ((S.annoInizio||S.year)*12+1)){ S.pilastri70[_P.id]=true; continue; }
      if((S.year*12+S.month) < (_P.anno*12+_P.mese)) continue;
      S.pilastri70[_P.id]=true;
      S.agenda.push({kind:'event', data:_P, resolved:false}); agendaSolo(); return;
    }
  }
  if(S.livello===0){ if(S.attivista && !S.attivista.laurea){                     // ATTIVISTA: UNA carta al mese, scelta per priorità (rework L2: campagne come carte di flusso)
      var ac=null;
      if(S.attivista.campagna && S.attivista.campagna.resaPending) ac=cardCampResa();        // 1) la RESA della campagna
      else if(S.attivista.evCorrente) ac=cardAttivistaEvento(S.attivista.evCorrente);        // 2) l'EVENTO (L3)
      // P1 (Sfide v3, #7c): la Sfida SOPRA l'offerta-campagna — prima era in fondo e le campagne pluri-mese la affamavano
      //   (asimmetria cross-ruolo: il premier la riceve via la conferenza sempre-presente). Ora ~1/5 come gli altri ruoli.
      if(!ac && typeof pescaSfida==='function'){ var sfA=pescaSfida(['attivista'],'piazza'); if(sfA) ac={kind:'attivista', data:sfA, resolved:false}; }   // D1b: la sfida-conoscenza in piazza (occasionale, gated)
      if(!ac && S.attivista.campOfferta) ac=cardCampOfferta();                               // 3) l'OFFERTA di campagna (start nel flusso)
      if(!ac) ac=pickAttivista();                                                            // 4) la mossa del mese
      if(ac) S.agenda.push(ac);
    } return; }   // alla laurea (L4) la candidatura
  if(!first){ const px=intermediaA(meseMandato()+2); if(px) S.log.unshift({t:T('In arrivo'),x:T('%V tra 2 mesi.').replace('%V',T(px.tipo))}); }   // avviso prossimo voto
  if(S.livello===4){   // SEGRETARIO GENERALE (fase C1a): crisi di mediazione + archi personali (ti seguono, dove:'entrambi')
    const inq=aggiornaInchiesta();      // l'esposizione del passato ti segue anche al vertice del mondo
    const inqA=aggiornaArchi(!!inq);
    if(!inq && !inqA){
      var sf4=(typeof pescaSfida==='function')?pescaSfida(['intl'],'vertice'):null;   // D1b: la sfida al vertice (gated)
      if(sf4){ S.agenda.push({kind:'event', data:sf4, resolved:false}); }
      else { const cr=pickCrisiInt(); if(cr){ S.agenda.push(cr); } else { const dd=pickDiploDoss(); if(dd) S.agenda.push(dd); } }   // D4: il fascicolo colma il mese-vuoto del Segretario
      if(S.agenda.length<2){ const pe=pickPersonale(); if(pe) S.agenda.push(pe); }
    }
    return;
  }
  if(S.livello===5){   // DIPLOMATICO (C2): la salita > inchiesta/archi personali > missione diplomatica + personale
    const occ=pickOccasione();
    if(occ){ S.agenda.push(occ); agendaSolo(); return; }            // la salita (Alto rappresentante / Segretario) è LA carta del mese
    const inq=aggiornaInchiesta();
    const inqA=aggiornaArchi(!!inq);
    if(!inq && !inqA){
      var sf5=(typeof pescaSfida==='function')?pescaSfida(['intl'],'vertice'):null;   // D1b: la sfida al vertice (gated)
      if(sf5){ S.agenda.push({kind:'event', data:sf5, resolved:false}); }
      else { const dp=pickDiplo(); if(dp){ S.agenda.push(dp); } else { const dd=pickDiploDoss(); if(dd) S.agenda.push(dd); } }   // D4: il fascicolo di scrivania colma il mese-vuoto (seconda superficie)
      if(S.agenda.length<2){ const pe=pickPersonale(); if(pe) S.agenda.push(pe); }
    }
    return;
  }
  if(S.livello===1){   // POLITICO LOCALE: occasione (salita) > inchiesta/archi personali > evento locale + personale
    const occ=pickOccasione();
    if(occ){ S.agenda.push(occ); agendaSolo(); return; }
    const inq=aggiornaInchiesta();      // l'esposizione ti segue anche da locale (bersaglio sempre tu)
    const inqA=aggiornaArchi(!!inq);    // archi personali (vita/coscienza/salute)
    if(!inq && !inqA){
      /* rifinitura locale — il RESPIRO: la vita personale è il SECONDO FLUSSO che si alterna al locale. Quando un
         evento personale c'è, il pool locale RIPOSA (respiro riempito da CONTENUTO); se non c'è, esce una carta
         locale — MAI una tregua nuda (zero dead air). Così la ricorrenza locale cala senza vuoti. */
      var sf1=(typeof pescaSfida==='function')?pescaSfida(['locale'],'aula'):null;   // D1b: la sfida in consiglio (gated)
      if(sf1){ S.agenda.push({kind:'event', data:sf1, resolved:false}); }
      else { const pe=pickPersonale(); if(pe){ S.agenda.push(pe); } else { const le=pickLocale(); if(le) S.agenda.push(le); } }
    }
    return;
  }
  if(S.opposizione){   // all'opposizione: intermedia (se c'è) oppure la tua carta + (a volte) un evento del governo AI
    /* L27-1 — LA CARTA-RICHIAMO DELLE CORRENTI ANCHE QUI. Togliere il gate non bastava: l'iniezione del richiamo
       sta in fondo a genAgendaRamo, DOPO il `return` di questo ramo (misurato: gate aperto → 0 carte uscite in
       216 mesi). Stessa precedenza che ha al governo (prima della stagione elettorale), stesso `agendaSolo()`. */
    if(!first && typeof richiamoCorrentiDovuto==='function' && richiamoCorrentiDovuto()){ S.richiamoCorrUltimo=S.year*12+S.month; S.agenda.push({kind:'event', data:cartaRichiamoCorrenti(), resolved:false}); agendaSolo(); return; }
    // Cantiere C: la stagione elettorale vale anche da SFIDANTE (bloccoIds = il tuo blocco d'opposizione)
    if(typeof pickCampagnaNazionale==='function'){ const cnbO=pickCampagnaNazionale(); if(cnbO){ S.agenda.push(cnbO); agendaSolo(); return; } }
    const inq=aggiornaInchiesta();   // anche da sfidante l'esposizione conta: bersaglio sempre tu (niente ministri qui)
    const inqA=aggiornaArchi(!!inq);   // archi PERSONALI (vita/coscienza/salute) anche da sfidante (dove:'entrambi')
    const inter=pickIntermedia();
    if(inter){ S.agenda.push(inter); }
    else if(!inq && !inqA){
      /* D4 — la Sfida arriva anche allo SFIDANTE (regola: le Sfide in tutte le modalità). Cornice naturale: il
         giornalista che incalza l'alternativa al governo (cornice 'stampa'); riusa le domande `governo`, auto-gata a ~1/5 mesi. */
      var sfO=(typeof pescaSfida==='function')?pescaSfida(['governo'],'stampa'):null;
      if(sfO){ S.agenda.push({kind:'stampa', data:sfO, resolved:false}); }
      else {
        let op = famigliaOppDovuta() ? pickFamigliaOpp() : null;   // L25-2/L25-3: le famiglie si prendono lo slot della carta d'opposizione, a turno fra loro (stesso kind: la forma del mese non cambia)
        if(!op) op = pickOpposizione();
        if(op) S.agenda.push({kind:'dossier', data:op, resolved:false});
        if(S.agenda.length<2){ const pe=pickPersonale(); if(pe) S.agenda.push(pe); }
        else if(Math.random()<0.35){ const gv=pickGovernoEvent(); if(gv) S.agenda.push({kind:'event', data:gv, resolved:false}); }
      }
    }
    return;
  }
  if(S.livello===2){   // MINISTRO: agenda di SETTORE + politica interna + l'occasione (la salita). Tetto 2 carte.
    const occ=pickOccasione();
    if(occ){ S.agenda.push(occ); agendaSolo(); return; }          // l'occasione è LA carta del mese
    const inq=aggiornaInchiesta();                  // ti bersaglia sempre (a livello 2 non hai ministri da scaricare)
    const inqA=aggiornaArchi(!!inq);                // archi personali (vita/coscienza/salute)
    if(!inq && !inqA){
      /* D3 — il QUESTION TIME in commissione (Sfida): l'appuntamento del ministro, ~1/5 mesi (pescaSfida si auto-gata
         sul suo timer da 5 mesi). Rianima il ramo che a L2 non veniva mai raggiunto (pickConferenza è dopo il return).
         Solo la Sfida, non la conferenza piena: il mese del ministro resta più raccolto del L3. Wrap identico al L3. */
      let sfC=null;
      if(typeof pescaSfida==='function') sfC=pescaSfida(['governo','ministro'],'commissione');
      if(sfC){ S.confUltimo=S.year*12+S.month; S.agenda.push({kind:'stampa', data:sfC, resolved:false}); }
      else if(ministroDovuto()){ const mc=pickMinistro(); if(mc){ S.agenda.push(mc); } else { const ds=pickDossierSettore(); if(ds) S.agenda.push(ds); } }
      else {
        const ds=pickDossierSettore(); if(ds) S.agenda.push(ds);
        if(S.agenda.length<2){ const pe=pickPersonale(); if(pe) S.agenda.push(pe); }
      }
    }
    return;
  }
  // Build B (b): lo snodo «legge truffa» come SCELTA di governo — carta prioritaria one-shot nell'anno pre-voto (1952), solo per il premier nel '50
  if(!first && typeof snodoSceltaDovuta==='function' && snodoSceltaDovuta()){ S.agenda.push({kind:'event', data:LEGGE_TRUFFA_EV, resolved:false}); agendaSolo(); return; }
  // AVANZAMENTO Lotto 4: gli snodi '60 come SCELTA (Enel poi apertura) — carte one-shot nel '62-63, solo per il premier nel '50
  if(!first && typeof snodoEnelDovuta==='function' && snodoEnelDovuta()){ S.agenda.push({kind:'event', data:ENEL_EV, resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoAperturaDovuta==='function' && snodoAperturaDovuta()){ S.agenda.push({kind:'event', data:APERTURA_EV, resolved:false}); agendaSolo(); return; }
  // L28-3: gli snodi degli anni '70, in ordine di calendario (finestre disgiunte: mai due nello stesso mese)
  if(!first && typeof snodoAusterityDovuta==='function' && snodoAusterityDovuta()){ S.agenda.push({kind:'event', data:AUSTERITY_EV, resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoDivorzioDovuta==='function' && snodoDivorzioDovuta()){ S.agenda.push({kind:'event', data:DIVORZIO_EV, resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoSolidarietaDovuta==='function' && snodoSolidarietaDovuta()){ S.agenda.push({kind:'event', data:SOLIDARIETA_EV, resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoDivorzioBdiDovuta==='function' && snodoDivorzioBdiDovuta()){ S.agenda.push({kind:'event', data:DIVORZIO_BDI_EV, resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoScalaMobileDovuta==='function' && snodoScalaMobileDovuta()){ S.agenda.push({kind:'event', data:SCALAMOBILE_EV, resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoNucleareDovuta==='function' && snodoNucleareDovuta()){ S.agenda.push({kind:'event', data:NUCLEARE_EV, resolved:false}); agendaSolo(); return; }
  /* L40-2 · gli snodi del '90. La SCISSIONE per prima: è la più identitaria e non può farsi scavalcare. */
  if(!first && typeof snodoScissioneDovuta==='function' && snodoScissioneDovuta()){ S.agenda.push({kind:'event', data:SCISSIONE_EV, resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoDcDovuta==='function'  && snodoDcDovuta()){  S.agenda.push({kind:'event', data:DIASPORA_DC_EV, resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoFusionePdDovuta==='function'  && snodoFusionePdDovuta()){  S.agenda.push({kind:'event', data:FUSIONE_PD_EV,  resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoFusionePdlDovuta==='function' && snodoFusionePdlDovuta()){ S.agenda.push({kind:'event', data:FUSIONE_PDL_EV, resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoFuoriAulaDovuta==='function'  && snodoFuoriAulaDovuta()){  S.agenda.push({kind:'event', data:FUORI_AULA_EV,  resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoCrisi08Dovuta==='function'    && snodoCrisi08Dovuta()){    S.agenda.push({kind:'event', data:CRISI08_EV,     resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoPorcellumDovuta==='function'  && snodoPorcellumDovuta()){  S.agenda.push({kind:'event', data:PORCELLUM_EV,   resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoPsiDovuta==='function' && snodoPsiDovuta()){ S.agenda.push({kind:'event', data:CROLLO_PSI_EV,  resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoMsiDovuta==='function' && snodoMsiDovuta()){ S.agenda.push({kind:'event', data:FIUGGI_EV,      resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoCongressoDovuto==='function' && snodoCongressoDovuto()){ S.scissioneFatta=true;
    S.agenda.push({kind:'event', data:(S.scissione==='svolta'?SCISSIONE_CONGRESSO_SVOLTA:SCISSIONE_CONGRESSO_RIFONDAZIONE), resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoMoraleDovuta==='function' && snodoMoraleDovuta()){ S.agenda.push({kind:'event', data:QUESTIONE_MORALE_EV, resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoMattarellumDovuta==='function' && snodoMattarellumDovuta()){ S.agenda.push({kind:'event', data:MATTARELLUM_EV, resolved:false}); agendaSolo(); return; }
  if(!first && typeof snodoMaastrichtDovuta==='function' && snodoMaastrichtDovuta()){ S.agenda.push({kind:'event', data:MAASTRICHT_EV, resolved:false}); agendaSolo(); return; }
  // CURA Lotto P3 (#9): la CARTA-RICHIAMO delle correnti — chiama alla scheda PRIMA che sia tardi (mai l'imboscata a 30)
  if(!first && typeof richiamoCorrentiDovuto==='function' && richiamoCorrentiDovuto()){ S.richiamoCorrUltimo=S.year*12+S.month; S.agenda.push({kind:'event', data:cartaRichiamoCorrenti(), resolved:false}); agendaSolo(); return; }
  // Cantiere C: la STAGIONE ELETTORALE (ultimi 6 mesi) — il beat-campagna è LA carta del mese (setpiece: la campagna assorbe l'agenda)
  if(!first && typeof pickCampagnaNazionale==='function'){ const cnb=pickCampagnaNazionale(); if(cnb){ S.agenda.push(cnb); agendaSolo(); return; } }
  // ATTO FINALE (fase C1a): la chiamata a guidare il Consesso (gated su relInt alto) — quando arriva, è LA carta del mese
  if(!first){ const occI=pickOccasione(); if(occI){ S.agenda.push(occI); agendaSolo(); return; } }
  // rimpasti in sospeso (carte obbligatorie post-scandalo: storicamente esenti dal tetto)
  const hadRimpasto=S.pendingRimpasto.length>0;
  for(const mid of S.pendingRimpasto){
    const cs=[]; let g=0;
    while(cs.length<3 && g++<40){ const c=mkCand(); if(!cs.some(x=>x.profile===c.profile)) cs.push(c); }
    while(cs.length<3) cs.push(mkCand());
    S.agenda.push({kind:'rimpasto', min:mid, cands:cs, resolved:false});
  }
  S.pendingRimpasto=[];
  if(first){
    S.agenda.push({kind:'dossier', data:DOSSIERS.find(d=>d.id==='spazio'), resolved:false});
    return;
  }
  // elezioni intermedie: priorità alta (campagna a −1 mese, risultato il mese del voto); esclusiva, conta come carta
  let hadEvent=false;
  const inter=pickIntermedia();
  if(inter){ S.agenda.push(inter); hadEvent=true; }
  // evento di soglia sui mercati (fiducia): l'evento del mese (solo se non c'è già un'intermedia)
  // PRESSIONE SU UNA POLITICA (loop attivo — Lotto 3): una politica lasciata a un estremo ti richiama a rivederla — il pezzo che CHIUDE
  // il loop economico (costo ricorrente → deficit → pressione). Va PRIMA dell'evento-mercati generico: se la causa è una politica
  // precisa, il richiamo mirato (rivedi QUELLA) è più utile del panico generico. Contingentata (~1 ogni 3 mesi), esclusiva.
  if(!hadEvent){ const pp=pickPolPressione(); if(pp){ S.agenda.push(pp); hadEvent=true; } }
  if(!hadEvent){ const fidEv=pickFiduciaEvent(); if(fidEv){ S.agenda.push({kind:fidEv.kind, data:fidEv.data, resolved:false}); hadEvent=true; } }
  // evento grave raro (solo se non c'è già l'evento mercati)
  if(!hadEvent && Math.random()<0.10*dif().freqEventi){
    S.recentEvent=S.recentEvent||[];   // finestra anti-ripetizione (5): prima escludevamo solo l'ULTIMO evento
    const pool=EVENTS.filter(e=>(!e.cond||e.cond())&&eraViva(e)&&!S.recentEvent.includes(e.id));   // Build B: eraViva ADDITIVO — gli eventi senza tag passano sempre (nessuna regressione); abilita i pilastri d'epoca taggati
    if(pool.length){ const ev=rnd(pool); S.recentEvent.push(ev.id); if(S.recentEvent.length>5) S.recentEvent.shift(); S.agenda.push({kind:'event', data:ev, resolved:false}); hadEvent=true; }
  }
  // CONFLITTI internazionali (cantiere paesi reali, Fetta B): i flashpoint coi volti nominati, PRIMA della routine diplomatica (presenza ricorrente)
  if(!hadEvent){ const cv=pickConflittoInt(); if(cv){ S.agenda.push({kind:'event', data:cv, resolved:false}); hadEvent=true; } }
  // grande evento internazionale (lotto Esteri+Difesa): esclusivo, ~ogni 6-9 mesi
  if(!hadEvent){ const iv=pickInternazionale(); if(iv){ S.agenda.push({kind:'event', data:iv, resolved:false}); hadEvent=true; } }
  if(!hadEvent){ const og=pickONG(); if(og){ S.agenda.push({kind:'event', data:og, resolved:false}); hadEvent=true; } }   // fase B: la società civile come attore (stesso slot-evento internazionale)
  // crisi di coalizione (passo 4): ultimatum o rottura di un alleato; è l'evento del mese, mai con un altro evento
  if(!hadEvent){
    const al=pickAlleato();
    if(al){ S.agenda.push({kind:al.kind, ally:al.ally, data:al.data, resolved:false}); hadEvent=true; }
  }
  // L'INCHIESTA (lotto 3): l'arco avanza di una fase al mese, o un nuovo avviso se l'esposizione lo merita.
  // Entra nel tetto delle 2 carte; se il bersaglio è un ministro, occupa lo slot-scandalo del mese.
  const inq=aggiornaInchiesta();
  const hadInchiesta=!!inq;
  // GLI ARCHI (lotto 4): una carta-arco solo nei mesi tranquilli (niente evento, inchiesta o rimpasto), max 1/mese.
  const hadArco=aggiornaArchi(hadEvent || hadInchiesta || hadRimpasto);
  // proposta attiva di un ministro: mai insieme a un evento grave, al massimo una al mese
  let hadProposta=false;
  if(!hadEvent && !hadArco && Math.random()<0.30){
    const pr=pickProposta();
    if(pr){
      S.agenda.push({kind:'proposta', min:pr.min, prop:pr.prop, resolved:false});
      S.recentProp.push(pr.prop.id); if(S.recentProp.length>6) S.recentProp.shift();
      hadProposta=true;
    }
  }
  // richiesta di budget di un ministro: mai con un evento grave, frequenza bassa
  let hadBudget=false;
  if(!hadEvent && !hadArco && (hadProposta?1:0)+(hadInchiesta?1:0) < 2 && Math.random()<0.15){
    const br=pickBudget();
    if(br){
      S.agenda.push({kind:'budget', min:br.min, req:br.req, resolved:false});
      S.recentBudget.push(br.req.id); if(S.recentBudget.length>5) S.recentBudget.shift();
      hadBudget=true;
    }
  }
  // scandalo di un ministro: mai con un evento grave; modulato per competenza/lealtà;
  // scatta solo se c'è ancora spazio sotto le 2 carte (e mai un secondo scandalo nel mese dell'inchiesta-ministro)
  let hadScandalo=false;
  if(!hadEvent && !hadArco && inq!=='ministro' && (hadProposta?1:0)+(hadBudget?1:0)+(hadInchiesta?1:0) < 2){
    const sc=pickScandalo();
    if(sc){
      S.agenda.push({kind:'scandalo', min:sc.min, scn:sc.scn, resolved:false});
      S.recentScandalo.push(sc.scn.id); if(S.recentScandalo.length>5) S.recentScandalo.shift();
      hadScandalo=true;
    }
  }
  // conflitto tra due ministri: mai con un evento grave; solo se c'è spazio sotto le 2 carte
  let hadConflitto=false;
  if(!hadEvent && !hadArco && (hadProposta?1:0)+(hadBudget?1:0)+(hadScandalo?1:0)+(hadInchiesta?1:0) < 2 && Math.random()<0.07){
    const cf=pickConflitto();
    if(cf){
      S.agenda.push({kind:'conflitto', confl:cf.confl, minA:cf.minA, minB:cf.minB, resolved:false});
      S.recentConflitto.push(cf.confl.id); if(S.recentConflitto.length>5) S.recentConflitto.shift();
      hadConflitto=true;
    }
  }
  // evento personale singolo (lotto VITA PERSONALE): la vita privata/coscienza ha PRIORITÀ PARI agli appuntamenti
  // (prima era l'ULTIMA ruota → spiazzata di continuo). Ora è una presenza RICORRENTE. Dentro il tetto, mai con un evento o un arco.
  let hadPers=false;
  if(!hadEvent && !hadArco && (hadProposta?1:0)+(hadBudget?1:0)+(hadScandalo?1:0)+(hadConflitto?1:0)+(hadInchiesta?1:0) < 2){
    const pe=pickPersonale();
    if(pe){ S.agenda.push(pe); hadPers=true; }
  }
  // conferenza stampa: l'APPUNTAMENTO del capo del governo, ~ogni 3 mesi; entra nel tetto delle 2 carte
  let hadConf=false;
  if(!hadEvent && !hadArco && (hadProposta?1:0)+(hadBudget?1:0)+(hadScandalo?1:0)+(hadConflitto?1:0)+(hadPers?1:0)+(hadInchiesta?1:0) < 2){
    const cf=pickConferenza();
    if(cf){ S.agenda.push({kind:'stampa', data:cf, resolved:false}); hadConf=true; }
  }
  // punto col partito: l'APPUNTAMENTO con le correnti, ~ogni 4 mesi; mai insieme alla conferenza (≤1 appuntamento/mese)
  let hadPunto=false;
  if(!hadEvent && !hadArco && !hadConf && (hadProposta?1:0)+(hadBudget?1:0)+(hadScandalo?1:0)+(hadConflitto?1:0)+(hadPers?1:0)+(hadInchiesta?1:0) < 2){
    const pp=pickPuntoPartito();
    if(pp){ S.agenda.push(pp); hadPunto=true; }
  }
  // dossier: il totale di carte/mese resta <= 2 (eventi, iniziative dei ministri, inchiesta, archi, appuntamenti e vita privata riducono i dossier)
  let n; const r=Math.random();
  if(hadEvent) n=(r<0.5?0:1);
  else n=(r<0.16?0:r<0.64?1:2);
  const iniz=(hadProposta?1:0)+(hadBudget?1:0)+(hadScandalo?1:0)+(hadConflitto?1:0)+(hadConf?1:0)+(hadPunto?1:0)+(hadInchiesta?1:0)+(hadArco?1:0)+(hadPers?1:0);
  n=Math.max(0, Math.min(n, 2-iniz-(hadEvent?1:0)));   // il tetto vero: evento + iniziative + inchiesta + arco + dossier ≤ 2

  let avail=DOSSIERS.filter(d=>!S.recentDoss.includes(d.id) && (!d.cond||d.cond()) && eraViva(d));   // i dossier possono avere cond (es. liste solo con sanità bassa); eraViva (flip) esclude i moderni nel '50
  for(let i=0;i<n && avail.length;i++){
    const d=rnd(avail); avail=avail.filter(x=>x.id!==d.id);
    S.agenda.push({kind:'dossier', data:d, resolved:false});
    S.recentDoss.push(d.id); if(S.recentDoss.length>22) S.recentDoss.shift();   // finestra 22 ≈ 20 mesi senza rivedere la stessa carta (pool ~92)
  }

}
/* ============================================================ L18-1 · LA CODA COMUNE DELL'AGENDA.
   Il difetto (diagnosi L17-1): il RESPIRO (beat leggeri G2/G4) e il RETROSCENA (L14-1) stavano in fondo al corpo di
   genAgenda, ma **ogni ramo-modalità esce con un `return` prima di arrivarci** → al governo funzionavano, in
   opposizione/ministro/locale/segretario/diplomatico **non uscivano MAI**. Non era il gate né la probabilità: era il
   punto d'iniezione. (Difetto più vecchio del fuori-verbale: i leggeri lo avevano da G2/G4.)

   LA FORMA, decisa leggendo il codice — wrapper **+ flag esplicito**, non wrapper cieco. Enumerati i `return` di
   `genAgendaRamo`, sono di DUE specie:
     · chiudono un RAMO-modalità (attivista/locale/ministro/segretario/diplomatico/opposizione) → **devono** avere la coda;
     · sono SETPIECE — «è LA carta del mese»: pilastro ONU, snodi d'epoca (truffa/Enel/apertura), richiamo-correnti,
       beat di campagna elettorale, occasione/salita → **NON devono**: infilare un beat lì dentro diluirebbe il
       momento che il design vuole solo. Un wrapper cieco l'avrebbe fatto.
   Perciò `agendaSolo()` marca il mese come esclusivo e la coda si astiene. `AG_SOLO` è TRANSITORIO (come NOTTE/TEL):
   vive un solo giro di generazione, mai dentro S.
   L'ORDINE È PRESERVATO: la coda gira DOPO il ramo → l'agenda è completa e `graveInCorso` vede le carte gravi appena
   pescate, che è il motivo per cui l'iniezione stava in fondo. ============================================ */
let AG_SOLO=false;
function agendaSolo(){ AG_SOLO=true; }
function genAgenda(first){
  AG_SOLO=false;
  genAgendaRamo(first);
  if(first || AG_SOLO) return;      // primo mese e mesi-setpiece: nessuna coda
  codaAgenda();
}
function codaAgenda(){
  /* G4 — il RESPIRO del mese. Additivo (niente `return`): il paese parla d'altro SENZA rubare il posto alla politica. */
  if(typeof leggeroDovuto==='function' && leggeroDovuto()){
    var _bl=pescaLeggero();
    if(_bl){ S.leggeroUltimo=S.year*12+S.month; S.agenda.push({kind:'event', data:_bl, resolved:false}); }
  }
  /* L14-1 — il beat-retroscena: MAI nello stesso mese di un beat leggero (due registri diversi, insieme stonerebbero). */
  if(typeof retroDovuto==='function' && retroDovuto() && S.leggeroUltimo!==(S.year*12+S.month)){
    var _br=pescaRetro();
    if(_br){ S.retroUltimo=S.year*12+S.month; S.agenda.push({kind:'event', data:_br, resolved:false}); }
  }
}
function agendaPending(){return S.agenda.some(a=>!a.resolved);}

function resolveItem(idx,ci){
  const it=S.agenda[idx]; if(it.resolved) return;
  STAMPA_FX=0;   // bandierina dell'amplificatore: pulita prima degli effetti della scelta
  if(it.kind==='rimpasto'){
    const c=it.cands[ci]; const m=getMin(it.min);
    m.nm=c.nm; m.g=c.g; m.profile=c.profile; m.comp=c.comp; m.loyalty=58; m.resigning=false;
    /* L20-1 — SOLO il nuovo arrivato risolve il suo volto, evitando quelli dei colleghi IN CARICA (escluso il
       posto che sta prendendo). Nessun altro `rit` viene toccato: un rimpasto non sposta le facce di chi resta. */
    m.rit=null;
    if(typeof assegnaVolto==='function') assegnaVolto(m, volteOccupati(it.min), c.ritRosa);   // `ritRosa` = la faccia mostrata nella rosa: se libera si tiene
    it.resolved=true; it.outcome=T('Nuovo ministro: <b>%M</b> (%P).').replace('%M',c.nm).replace('%P',T(PROF[c.profile]));
    S.log.unshift({t:T('Rimpasto'),x:T('%M guida ora %D.').replace('%M',c.nm).replace('%D',T(MINISTRIES.find(x=>x.id===it.min).nm))});   // L20-1: trovata qui, era concatenata (la guardia non la vedeva: nessuna parola-spia nel frammento)
    if(S.correnti){ const pp=profiloPartito(); corrented(c.profile==='tecnico'?'pontieri':(c.profile===pp?'militanti':'fedelissimi'), 5); }   // una nomina è anche politica interna
  } else if(it.kind==='proposta'){
    const m=getMin(it.min);
    if(ci===0){ // Approva
      it.prop.f();
      if(it.prop.rischio) spregiudicata(it.prop.rischio);   // il condono approvato lascia traccia (lotto 3)
      if(m) m.loyalty=clamp(m.loyalty+6,0,100);
      it.outcome=T('Approvata: %P.').replace('%P','<b>'+T(it.prop.t)+'</b>')+(m?' '+T('Lealtà di %M in aumento.').replace('%M',m.nm):'');
      S.log.unshift({t:T('Proposta approvata'),x:(m?m.nm+': ':'')+T(it.prop.t)});
    } else { // Respingi
      if(m) m.loyalty=clamp(m.loyalty-4,0,100);
      it.outcome=T('Respinta: %P.').replace('%P','<b>'+T(it.prop.t)+'</b>')+(m?' '+T('Lealtà di %M in calo.').replace('%M',m.nm):'');
      S.log.unshift({t:T('Proposta respinta'),x:(m?m.nm+': ':'')+T(it.prop.t)});
    }
    S.ind.consenso=computeConsenso();
    it.resolved=true;
  } else if(it.kind==='budget'){
    const m=getMin(it.min);
    if(ci===0){ // Concedi
      it.req.f();
      if(m) m.loyalty=clamp(m.loyalty+6,0,100);
      it.outcome=T('Concessa: %P.').replace('%P','<b>'+T(it.req.t)+'</b>')+(m?' '+T('Lealtà di %M in aumento.').replace('%M',m.nm):'');
      S.log.unshift({t:T('Bilancio concesso'),x:(m?m.nm+': ':'')+T(it.req.t)});
    } else { // Nega
      if(m) m.loyalty=clamp(m.loyalty-5,0,100);
      it.outcome=T('Negata: %P.').replace('%P','<b>'+T(it.req.t)+'</b>')+(m?' '+T('Lealtà di %M in calo.').replace('%M',m.nm):'');
      S.log.unshift({t:'Bilancio negato',x:(m?m.nm+': ':'')+it.req.t});
    }
    S.ind.consenso=computeConsenso();
    it.resolved=true;
  } else if(it.kind==='premier'){
    /* la mossa interna (lotto ascesa): assecondare il premier (lealtà, ascesa lenta) o distinguersi (capitale, ma sospetto) */
    if(ci===0){
      if(S.premier) S.premier.lealta=clamp(S.premier.lealta+6,0,100);
      S.capitale=clamp((S.capitale||0)+1,0,100);
      it.outcome='Hai sostenuto la linea del premier: la sua fiducia cresce, la tua ascesa è lenta ma sicura.';
      S.log.unshift({t:T('Lealtà al premier'),x:T('Hai assecondato %P.').replace('%P',((S.premier||{}).nome||T('il premier')))});
    } else {
      S.capitale=clamp((S.capitale||0)+2,0,100); S.visibilita=clamp((S.visibilita||40)+5,0,100);
      if(S.premier) S.premier.lealta=clamp(S.premier.lealta-8,0,100);
      it.outcome='Ti sei smarcato dal premier: visibilità e capitale su, ma lui ti guarda con sospetto.';
      S.log.unshift({t:T('Ambizione'),x:T('Ti sei distinto dalla linea di %P.').replace('%P',((S.premier||{}).nome||T('partito')))});
    }
    S.premMossaUltimo=S.year*12+S.month;
    it.resolved=true;
  } else if(it.kind==='ministro'){
    /* le carte del ministro (lotto contenuto fase 1): politica interna + grane di settore. Muovono i sistemi
       della salita (capitale/lealtà/visibilità/correnti/indicatore di settore) + tratti (pleases) ed esposizione. */
    const d=it.data; const choice=(d.ch||[])[ci]; if(!choice) return;
    if(choice.f) choice.f();
    if(choice.pleases) bioPleases(choice.pleases);
    if(choice.rischio) spregiudicata(choice.rischio);
    if(choice.trasparenza && S.esposizione!=null) S.esposizione=clamp(S.esposizione-choice.trasparenza,0,100);
    S.ind.consenso=computeConsenso();
    it.resolved=true; it.outcome=T('Scelta:')+' <b>'+subMin(T(choice.l))+'</b>.';
    S.log.unshift({t:subMin(T(d.t)), x:T('Decisione:')+' '+subMin(T(choice.l))});
  } else if(it.kind==='occasione'){
    /* la salita (lotto ascesa): cogli il salto o lascia. Se cogli e riesci → diventaPremier (livello 3, continuità) */
    if(ci===1){
      it.resolved=true; it.outcome=T('Lasci passare l\'occasione: resti %R, per ora.').replace('%R',S.livello===5?T(ruoloDiplo()):it.tipo==='internazionale'?T(PAESE.titoloRuolo):S.livello===1?ruoloLocale():ruoloDicastero());
      S.log.unshift({t:T('Occasione mancata'),x:T('Hai scelto di non salire, stavolta.')});
    } else {
      if(it.tipo==='altoRapp'){ it.resolved=true; return diventaAltoRappresentante(); }   // C2: Ambasciatore → Alto rappresentante (grado 1→2)
      if(it.tipo==='internazionale'){ it.resolved=true; return diventaInternazionale('consesso'); }   // livello 3→4 (o diplomatico→4): l'ATTO FINALE, il vertice del mondo
      if(it.tipo==='chiamata'){ it.resolved=true; return diventaMinistro(); }   // livello 1→2: la chiamata a Roma
      let ok=false;
      if(it.tipo==='successione') ok=true;
      else { const score=(S.capitale||0)*0.8+umoreMedio()*0.2+(Math.random()*16-8); ok=score>=50; }   // primaria: pesata sul CAPITALE (che controlli) → costruirlo a 70 garantisce il salto; le correnti aiutano
      if(ok){ it.resolved=true; return diventaPremier(it.tipo!=='successione'); }   // successione = subentro (no elezione); primaria = mandato vinto
      S.capitale=clamp((S.capitale||0)-12,0,100);   // sconfitta ammorbidita: puoi ritentare
      it.resolved=true; it.outcome='Hai tentato il salto e fallito: resti ministro, ridimensionato.';
      S.log.unshift({t:'Salto fallito',x:'La scalata si ferma qui: il capitale ne risente.'});
    }
    S.ind.consenso=computeConsenso();
  } else if(it.kind==='crisiInt'){
    /* crisi di mediazione (fase C1a): trilemma. Il COMPROMESSO è gated sull'autorevolezza (`gateAut`) — un
       mediatore debole non ricuce sempre. Le scelte muovono coesione/autorevolezza + alimentano i tratti. */
    const d=it.data; const choice=d.ch[ci]; if(!choice) return;
    if(choice.gateAut!=null && (!S.intl || S.intl.autorevolezza < choice.gateAut)) return;   // non abbastanza autorevole: opzione non disponibile
    if(choice.f) choice.f();
    if(choice.pleases) bioPleases(choice.pleases);
    if(choice.rischio) spregiudicata(choice.rischio);
    it.resolved=true; it.outcome=T('Scelta:')+' <b>'+T(choice.l)+'</b>.'+(choice.mondo?' <i style="color:var(--mut)">'+T(choice.mondo)+'</i>':'');   // la riga «mondo»: il riassesto del tabellone IN PAROLE (fase C1b)
    S.log.unshift({t:d.t, x:'Da Segretario: '+choice.l});
  } else if(it.kind==='rinnovoInt'){
    /* fine mandato internazionale (fase C1a): rinnovo o ritiro all'apice */
    if(ci===0){   // continui
      S.intl.mandato++; S.intl.mesiInCarica=0; S.intl.coesBassa=0;
      bioFatto('Riconfermato '+ruoloIntl()+' per un nuovo mandato.');
      S.log.unshift({t:'Riconfermato',x:'Un nuovo mandato al vertice del mondo.'});
      it.resolved=true; genAgenda(false); render(); commitSnap();
    } else {   // ti ritiri all'apice
      it.resolved=true; return gameOver('ritiro');
    }
  } else if(it.kind==='locale'){
    /* eventi locali (livello 1): muovono gli indicatori locali + alimentano tratti (pleases) ed esposizione (rischio) */
    const d=it.data; const choice=d.ch[ci]; if(!choice) return;
    if(choice.f) choice.f();
    if(choice.costo && choice.costo.pct!=null && S.locale && S.locale.budget!=null)
      S.locale.budget=Math.max(0, Math.round((S.locale.budget - choice.costo.pct/100*S.locale.budget)*10)/10);   // COSTO = % del bilancio → € dedotti (cantiere Budget); pct<0 = entrata → il bilancio sale
    if(choice.pleases) bioPleases(choice.pleases);
    if(choice.rischio) spregiudicata(choice.rischio);
    if(choice.trasparenza && S.esposizione!=null) S.esposizione=clamp(S.esposizione-choice.trasparenza,0,100);
    calcConsensoLocale();
    it.resolved=true; it.outcome=T('Scelta:')+' <b>'+T(choice.l)+'</b>.';
    S.log.unshift({t:T(d.t), x:T('Decisione:')+' '+T(choice.l)});
  } else if(it.kind==='personale'){
    /* eventi personali singoli (lotto 5): coscienza, carriera/affetti, momenti lieti */
    const d=it.data; const choice=d.ch[ci]; if(!choice) return;
    if(choice.f) choice.f();
    if(choice.fatto) bioFatto(T(choice.fatto));
    S.ind.consenso=computeConsenso();
    it.resolved=true; it.outcome=T('Scelta:')+' <b>'+T(choice.l)+'</b>.';
    S.log.unshift({t:T(d.t), x:T('Decisione:')+' '+T(choice.l)});
  } else if(it.kind==='arco'){
    /* gli archi narrativi (lotto 4): la scelta esegue gli effetti e determina il nodo successivo (o chiude) */
    const a=S.archi && S.archi.find(function(x){return x.id===it.arco;});
    const A=ARCHI_DEF.find(function(d){return d.id===it.arco;});
    if(!a || !A){ it.resolved=true; render(); return; }   // guardia: arco già chiuso (non dovrebbe accadere)
    const node=A.nodi[a.nodo]; if(!node){ chiudiArco(a,null,null); it.resolved=true; render(); return; }   // migrazione fase A: nodo rinominato/sparito → chiudi senza crash
    const choice=node.ch[ci]; if(!choice) return;
    if(choice.f) choice.f();
    a.scelte.push(choice.l);
    if(choice.peso) a.peso=(a.peso||0)+choice.peso;   // il CUMULATO (fase A): la memoria di come hai giocato l'arco → instrada il climax
    a.eco=T(choice.eco||'');                           // la clausola-callback per il nodo successivo (%ECO) — i18n: tradotta allo store (i %FILO restano, li risolve arcoSub)
    S.log.unshift({t:arcoSub(T(node.t),a), x:T('Decisione:')+' '+arcoSub(T(choice.l),a)});
    if(choice.cura){ S.convalescenza=(S.year*12+S.month)+choice.cura; S.log.unshift({t:T('Convalescenza'),x:T('Per qualche mese rallenti e deleghi: la salute viene prima.')}); }   // la cura (lotto 5): riguardo temporaneo, sopravvivi
    if(choice.gameover){ S.esitoSalute=choice.tono; chiudiArco(a, arcoSub(T(choice.fatto),a), arcoSub(T(choice.epi),a)); it.resolved=true; return gameOver(choice.gameover); }   // finale di salute (ritiro dignitoso o fatale)
    const dest=(typeof choice.goto==='function')?choice.goto(a):choice.goto;   // goto ADATTIVO (fase A): può leggere a.peso/a.scelte → climax diverso secondo come hai giocato
    if(dest){ a.nodo=dest; a.prossimo=(S.year*12+S.month)+2; it.outcome=T('Scelta:')+' <b>'+arcoSub(T(choice.l),a)+'</b>. '+T('La storia continua.'); }   // passo +2: l'arco respira su più mesi e lascia spazio all'intreccio
    else { chiudiArco(a, arcoSub(T(choice.fatto),a), arcoSub(T(choice.epi),a)); it.outcome='<b>'+arcoSub(T(choice.l),a)+'</b>.'+(choice.fatto?' '+arcoSub(T(choice.fatto),a):''); }
    S.ind.consenso=computeConsenso();
    it.resolved=true;
  } else if(it.kind==='inchiesta'){
    /* l'arco giudiziario (lotto 3): la difesa scelta si accumula e pesa sulla sentenza */
    const FD=INCHIESTA_FASI[it.fase-1]; const I=S.inchiesta;
    if(!I){ it.resolved=true; render(); return; }   // guardia: arco già chiuso (non dovrebbe accadere)
    const dId=FD.difese[ci]; if(!dId) return;
    if(dId==='avvocato'){ I.difesa+=3; gd('cetomedio',-2); espoSale(2);
      it.outcome='Il collegio di grido prende il fascicolo: la difesa si irrobustisce, le parcelle d\'oro fanno discutere.'; }
    else if(dId==='collabora'){ I.difesa+=2; S.esposizione=clamp(S.esposizione-6,0,100); stampad(3); allG(-2);
      it.outcome='Consegni le carte e rispondi a ogni domanda: l\'ombra si accorcia, la base mugugna.'; }
    else if(dId==='attacca'){ stampad(-6); espoSale(3);
      if(S.ind.consenso>=55){ I.difesa+=2; gd('lavoratori',2); gd('pensionati',2);
        it.outcome='«Toghe politicizzate»: la piazza è con te e il fascicolo perde slancio. La stampa prende nota.'; }
      else { I.difesa-=2; it.outcome='Attacchi i giudici, ma il paese non ti segue: la mossa si ritorce. La stampa prende nota.'; } }
    else if(dId==='vittima'){
      if(S.ind.stampa>=55){ allG(4); I.difesa+=1; it.outcome='Il racconto del complotto regge: i media ti danno spazio, il paese si stringe.'; }
      else { allG(-3); stampad(-3); it.outcome='La versione del complotto non regge: i media la smontano riga per riga.'; } }
    else if(dId==='tempo'){ it.outcome='Nessuna mossa: lasci lavorare gli avvocati. Il calendario non aspetta.'; }
    else if(dId==='patteggia'){
      /* la via di mezzo: chiude subito, macchia certa, prezzo CRESCENTE a ogni ricorso (niente scappatoia) */
      const n=(S.biografia&&S.biografia.c.patteggiamenti||0)+1;
      bioConta('patteggiamenti');
      allG(-Math.min(16,8+4*(n-1)));
      S.esposizione=Math.min(45,25+8*(n-1));
      bioFatto('Patteggia'+(n>1?' di nuovo':'')+': la carriera continua, segnata.');
      S.log.unshift({t:'Patteggiamento',x:'Il processo si chiude prima della sentenza: una macchia certa, la carriera continua.'});
      chiudiInchiesta();
      it.outcome='Patteggi: niente sentenza, una macchia negli archivi. Il paese prende nota del prezzo.';
    }
    else if(dId==='sentenza'){
      const esito=esitoSentenza();
      if(esito==='assoluzione'){
        S.esposizione=10; allG(6); stampad(4);
        bioConta('assoluzioni'); bioFatto(gn('Assolto','Assolta')+' con formula piena: l\'inchiesta si sgonfia.');
        S.log.unshift({t:'Assoluzione',x:'Formula piena: ne esci più forte. Il paese volta pagina con te.'});
        chiudiInchiesta();
        it.outcome=T('%A con formula piena: l\'aula applaude, l\'esposizione crolla. Il rilancio.').replace('%A',gn('Assolto','Assolta'));
      } else if(esito==='lieve'){
        bioConta('condanne'); bioFatto(gn('Condannato','Condannata')+' in primo grado: la macchia resta.');
        chiudiInchiesta(); S.esposizione=60;   // segnato: la risalita è possibile ma in salita (−1/mese + raffreddamento 12)
        if(!S.opposizione){
          it.resolved=true;
          S.log.unshift({t:'Condanna',x:'Condanna lieve: ti dimetti. La traversata comincia, col marchio addosso.'});
          condannaLieve();   // dimissioni forzate → opposizione (rigenera l'agenda)
          return;
        }
        S.credibilita=clamp((S.credibilita||0)-15,0,100);
        it.outcome='Condanna lieve: da sfidante non hai incarichi da lasciare, ma il marchio pesa sulla credibilità.';
        S.log.unshift({t:'Condanna',x:'Condanna lieve: la traversata continua, col marchio addosso.'});
      } else {
        bioConta('condanne'); bioFatto(gn('Condannato','Condannata')+': la carriera politica finisce in tribunale.');
        chiudiInchiesta();
        it.resolved=true;
        return gameOver('condanna');
      }
    }
    S.ind.consenso=computeConsenso();
    it.resolved=true;
  } else if(it.kind==='scandalo'){
    const m=getMin(it.min); const role=MINISTRIES.find(x=>x.id===it.min).nm;
    if(ci===0){ // Difendi il ministro
      if(m) m.loyalty=clamp(m.loyalty+12,0,100);
      gd('cattolici',-5); gd('giovani',-3); gd('cetomedio',-3); gd('lavoratori',-2);
      it.outcome=T('Hai difeso <b>%M</b>. Lealtà su, ma consenso giù.').replace('%M',m?m.nm:T('il ministro'));
      S.log.unshift({t:T('Scandalo'),x:T('Difeso')+' '+(m?m.nm:'')+': '+T(it.scn.t)});
      bioConta('difesi'); spregiudicata(it.scn.giudiziario?8:6);   // difendere l'indifendibile si paga; se l'inchiesta è giudiziaria il fango ti schizza (+8)
    } else { // Chiedi le dimissioni
      if(m && !m.resigning){ m.resigning=true; S.pendingRimpasto.push(it.min);
        S.log.unshift({t:T('Dimissioni'),x:T('Il Ministro %M (%D) si è dimesso dopo lo scandalo.').replace('%M',m.nm).replace('%D',T(role))}); }
      gd('cattolici',3); gd('giovani',2); gd('cetomedio',2);
      it.outcome=T('Dimissioni accolte: <b>%M</b> lascia. Sostituto il mese prossimo.').replace('%M',m?m.nm:T('il ministro'));
      bioConta('scaricati'); if(m) bioFatto(T('Il ministro %M scaricato dopo lo scandalo.').replace('%M',m.nm));
    }
    S.ind.consenso=computeConsenso();
    it.resolved=true;
  } else if(it.kind==='conflitto'){
    const c=it.confl; const mA=getMin(it.minA), mB=getMin(it.minB);
    if(ci===0){ // schierati con A
      c.a.f();
      if(mA) mA.loyalty=clamp(mA.loyalty+8,0,100);
      if(mB) mB.loyalty=clamp(mB.loyalty-8,0,100);
      it.outcome=T('Hai dato ragione a <b>%N</b>.').replace('%N',(mA?mA.nm:''));
      S.log.unshift({t:T('Scontro nel governo'),x:(mA?mA.nm:'')+' '+T('(linea sostenuta)')+' · '+T(c.tema)});
    } else { // schierati con B
      c.b.f();
      if(mB) mB.loyalty=clamp(mB.loyalty+8,0,100);
      if(mA) mA.loyalty=clamp(mA.loyalty-8,0,100);
      it.outcome=T('Hai dato ragione a <b>%N</b>.').replace('%N',(mB?mB.nm:''));
      S.log.unshift({t:T('Scontro nel governo'),x:(mB?mB.nm:'')+' '+T('(linea sostenuta)')+' · '+T(c.tema)});
    }
    S.ind.consenso=computeConsenso();
    it.resolved=true;
  } else if(it.kind==='stampa'){
    const d=it.data; const choice=d.ch[ci];
    choice.f();
    S.ind.consenso=computeConsenso();
    it.resolved=true; it.outcome=T('Risposta:')+' <b>'+T(choice.l)+'</b>.';
    S.log.unshift({t:T('Conferenza stampa'), x:T('Risposta:')+' '+T(choice.l)});
  } else if(it.kind==='puntopartito'){
    /* l'appuntamento col partito (lotto ribilanciamento): la scelta tiene buone o inasprisce le correnti */
    const d=it.data; const choice=d.ch[ci]; if(!choice) return;
    choice.f();
    it.resolved=true; it.outcome=T('Scelta:')+' <b>'+T(choice.l)+'</b>.';
    S.log.unshift({t:T('Il partito'), x:T('Punto con le correnti:')+' '+T(choice.l)});
  } else if(it.kind==='intermedia'){
    esitoIntermedia(it.ris);
    it.resolved=true; it.outcome=T(it.ris.win?'Risultato incassato: avanzi nel territorio.':'Risultato incassato: arretri.');   // L16-1: due frasi intere, non un interruttore in mezzo
  } else {
    const d=it.data; const choice=d.ch[ci];
    if(choice.need!=null && (S.ind.reputazione==null || S.ind.reputazione<choice.need)) return;   // opzione a soglia di reputazione: non disponibile
    if(choice.pesoUE!=null && (S.pesoUE==null || S.pesoUE<choice.pesoUE)) return;                 // opzione a soglia di peso europeo (gemella di need:)
    if(choice.ente!=null && (!S.relInt || (S.relInt[choice.ente]||0) < (choice.enteMin!=null?choice.enteMin:60))) return;   // opzione a soglia di STANDING con un ente (fase A): serve un rapporto già buono
    var _b0=(S.attivista?S.attivista.base:0), _a0=(S.attivista?S.attivista.autorev:0);   // A.5 L2: snapshot per l'auto-detect del feeding campagna (la corsia = la valuta costruita)
    try{ ACT_PACE=pace(); choice.f(); } finally{ ACT_PACE=1; }   // A.5 ritmo: durante una carta ATTIVISTA i gd() scalano; il finally GARANTISCE il reset anche se f() eccepisce → mai ACT_PACE≠1 nel gioco nazionale (raggio d'esplosione: tutti i gruppi)
    if(S.attivista && S.attivista.campagna && !S.attivista.campagna.resaPending){ var _dB=S.attivista.base-_b0, _dA=S.attivista.autorev-_a0; if(_dB>0||_dA>0) nutriCampagna(_dB>=_dA?'piazza':'istituzionale'); }   // la carta ha costruito base→piazza / autorev→istituzionale → nutre la campagna (mossa O evento) se la corsia coincide; un mese-evento in-corsia NON è incuria
    // lealtà del ministro collegato
    if(d.min){ const m=getMin(d.min); if(m && choice.pleases){ m.loyalty=clamp(m.loyalty+(m.profile===choice.pleases?7:-3),0,100); } }
    // biografia: il classificatore tematico (pleases) + le tempeste memorabili
    if(choice.pleases) bioPleases(choice.pleases);
    // il rischio giudiziario (lotto 3): la scelta sporca alza l'esposizione, quella di trasparenza la abbassa
    if(choice.rischio) spregiudicata(choice.rischio);
    if(choice.trasparenza && S.esposizione!=null) S.esposizione=clamp(S.esposizione-choice.trasparenza,0,100);
    // la coscienza (lotto 5): la scelta contro l'orientamento/fede logora l'integrità, quella fedele la nutre
    integritaMuovi(choice);
    if(typeof FIDUCIA_EV!=='undefined' && d===FIDUCIA_EV.crisi){ bioConta('crisi'); bioFatto('La crisi del debito affrontata a viso aperto.'); }
    if(it.kind==='event' && d.id && ['sisma','pandemia','energia','crollo'].indexOf(d.id)>-1){
      bioConta('emergenze');
      bioFatto(T({sisma:'Il terremoto: il paese colpito si rialza.', pandemia:'L\'emergenza sanitaria, attraversata.', energia:'La crisi energetica, gestita.', crollo:'Il crollo: il conto della manutenzione rinviata.'}[d.id]));
    }
    S.ind.consenso=computeConsenso();
    /* L28-4: una CRONACA non e' una scelta. I pilastri-'70 scrivono il fatto nel registro, non «Decisione: Prosegui». */
    it.resolved=true; it.outcome = d.cronaca ? '' : T('Scelta:')+' <b>'+T(choice.l)+'</b>.';
    S.log.unshift({t:T(d.t), x: d.cronaca ? T(d.logx||d.t) : T('Decisione:')+' '+T(choice.l)});
    if(it.kind==='dossier' && d && /^pp_/.test(d.id||'')){ S.pressAck=S.pressAck||{}; S.pressAck[d.pol]=S.year*12+S.month; }   // loop attivo Lotto 3: aver DECISO (rivedi o tieni) mette a tacere il richiamo su quella politica per qualche mese — tenere non resta un problema aperto
  }
  /* visibilità dell'amplificatore: se la stampa ha gonfiato o attutito il colpo, dillo dove il giocatore guarda */
  if(STAMPA_FX!==0 && it.outcome){
    it.outcome+=' <span style="color:'+(STAMPA_FX>0?'var(--neg)':'var(--pos)')+'">'+(STAMPA_FX>0?'La stampa ostile gonfia il caso.':'La stampa amica attutisce il colpo.')+'</span>';
    STAMPA_FX=0;
  }
  /* P1 (Sfide v3, #7b) — VERDETTO INEQUIVOCABILE: se la carta è una Sfida, la scelta ha costruito `_esito` in f()
     (esatto/sbagliato + risposta giusta evidenziata + perché + delta) → sovrascrive l'esito a schermo. Vale per
     ogni kind (event/attivista/stampa/locale) senza toccare i singoli gestori: niente frame ambiguo sul quiz. */
  if(it.data && it.data.ch && ci!=null){ var _sfch=it.data.ch[ci]; if(_sfch && _sfch._esito){ it.outcome=_sfch._esito; } }
  render();
}

/* ============================================================
   SONDAGGI — l'avvicinamento al voto nazionale (NON le intermedie).
   Compaiono una volta al mese negli ULTIMI 6 MESI del mandato, oppure mentre governi in
   MINORANZA (voto anticipato sempre incombente). In opposizione vale il mandato del governo AI
   (turnInMandate avanza uguale). Valore "vero" dal momento attuale + rumore uniforme ±2/±3,
   margine dichiarato, sempre clampato [0,100]. Solo presentazione: nessun effetto sullo stato.
   ============================================================ */
function periodoSondaggi(){
  if(!S) return false;
  const fine=PAESE.mandatoMesi||60, mm=meseMandato();
  const ultimi6 = mm>=fine-6 && mm<fine;          // ultimi 6 mesi del mandato (vale anche da sfidante)
  const minoranza = !S.opposizione && S.minoranza; // minoranza: sfiducia possibile ogni mese
  return ultimi6 || minoranza;
}
/* ===== CAMPAGNA NAZIONALE (Cantiere C) — l'arco dei 6 mesi: un beat al mese (esclusivo, pattern legge-truffa),
   le scelte muovono le forze PRIMA del congelamento della vigilia (il «vero» resta congelato in avviaAttesa:
   niente dado all'ultimo — ci arrivi costruito). Vale anche da sfidante. Stato PURO (round-trip):
   S.campNaz {piazza,promMantenuta,n} per-stagione · S.campNazUltimo (cadenza) · S.promesseCampagna [{grp,mese,colpi}]
   che ATTRAVERSANO il mandato: la resa dei conti apre la stagione successiva. ===== */
function campPiazza(){ if(S.campNaz) S.campNaz.piazza=(S.campNaz.piazza||0)+1; }
/* Il BLOCCO ELETTORALE — «il blocco che il voto legge», risolto PER-CONTESTO (mai cablato su un'epoca):
   dove il voto usa l'apparentamento elettorale (la legge truffa: snodo attivo) sono le LISTE APPARENTATE — è la
   misura di votoBloccoTruffa; altrove (presente, o '50 post-'53) è il blocco/coalizione del giocatore che
   calcMargineEsito legge (bloccoIds). Stessa funzione, il contesto decide — come valuta/debtAncora/bloccoApparentato. */
function bloccoElettorale(){
  return (typeof snodoTruffaAttivo==='function' && snodoTruffaAttivo() && typeof bloccoApparentato==='function') ? bloccoApparentato() : bloccoIds();
}
/* Lo slancio di campagna: punta al blocco elettorale del contesto e amplifica ×2 la spinta autorata, perché
   evolvePartiti RIASSORBE gli scossoni (~10%/mese verso l'equilibrio): senza compensazione, 6 mesi varrebbero ~1 punto. */
function campSlancio(x){ applicaSlancio(bloccoElettorale(), x*2); }
function campPromessa(grp){ S.promesseCampagna=S.promesseCampagna||[]; S.promesseCampagna.push({grp:grp, mese:S.year*12+S.month, colpi:0}); }
/* La resa dei conti: le promesse della SCORSA campagna si pesano all'apertura della nuova — tradita (colpi≥6 nel
   mandato, contati da gd come per l'intervista) → il gruppo e la stampa te la rinfacciano; mantenuta → sostegno
   e la chiusura «L'uomo di parola» si sblocca. Mai gameover-feeding: morde, non affonda. */
function resaPromesseCampagna(){
  if(!S.promesseCampagna || !S.promesseCampagna.length) return;
  var mese=S.year*12+S.month, vecchie=S.promesseCampagna.filter(function(p){return mese-p.mese>12;});
  if(!vecchie.length) return;
  vecchie.forEach(function(p){
    var nome=nomeGruppo(p.grp);
    if((p.colpi||0)>=6){ gd(p.grp,-5); stampad(-4); S.log.unshift({t:T('La promessa tradita'), x:T('In campagna avevi promesso attenzione a %G, poi i fatti: ora te la rinfacciano.').replace('%G',nome)}); }
    else { if(S.campNaz) S.campNaz.promMantenuta=true; gd(p.grp,4); S.log.unshift({t:T('La promessa mantenuta'), x:T('%G ricorda la parola data — e mantenuta.').replace('%G',nome)}); }
  });
  S.promesseCampagna=S.promesseCampagna.filter(function(p){return mese-p.mese<=12;});
}
function pickCampagnaNazionale(){
  if(typeof CAMPAGNA_EV==='undefined' || !S || S.livello!==3) return null;   // il voto nazionale: premier o sfidante (livello resta 3)
  var fine=(PAESE.mandatoMesi||60), mm=meseMandato();
  if(!(mm>=fine-6 && mm<fine)) return null;            // SOLO la stagione (ultimi 6 mesi) — la minoranza non basta
  var mese=S.year*12+S.month;
  if(S.campNazUltimo!=null && mese-S.campNazUltimo<1) return null;
  if(!S.campNaz) S.campNaz={piazza:0,promMantenuta:false,n:0};
  if(S.campNaz.n===0) resaPromesseCampagna();          // la resa apre la stagione (le forze si muovono, i sondaggi la prezzano)
  var pool=CAMPAGNA_EV.filter(function(e){return eraViva(e) && (!e.cond||e.cond());});
  var q=pool.length?pescaBag('campnaz',pool):null; if(!q) return null;
  S.campNazUltimo=mese; S.campNaz.n++;
  return {kind:'event', data:q, resolved:false};
}
/* Il numero che deciderà il voto, calcolato dalle forze correnti (si muove di mese in mese). */
function sondaggioVero(){
  if(PAESE.comeSiVince==='parlamentare'){
    return { tipo:'parlamentare', val:seggiCoalizione(bloccoIds(), calcSeggi()) };   // seggi del tuo blocco (cred. a parte, come all'esito)
  }
  const tt=testaATesta();
  return { tipo:'candidato', val:tt.myPct, opp:tt.opp };                             // percentuale testa a testa (cred. già inclusa in testaATesta)
}
/* F3 — LA DEMOSCOPIA HA UN'ETÀ (correzione storica: i sondaggi in Italia esistono già negli anni '50 — la Doxa è
   del 1946 e fece rilevazioni elettorali). Quindi non «niente sondaggi» nel '50, ma demoscopia NASCENTE: rilevazioni
   rade e artigianali, banda larga. Dal '58 matura; nel presente il ritmo è serrato. Stessa infrastruttura, tre voci. */
function sondaggioEra(){
  if(typeof S==='undefined' || !S) return {ogni:1, base:3, floor:2, voce:'Il sondaggio della settimana dà'};
  if(S.era===LINEA_IT){
    if(S.year>=1958) return {ogni:1, base:4, floor:2, voce:'L\'istituto demoscopico rileva'};
    return {ogni:2, base:5, floor:3, voce:'Un istituto di ricerche stima'};   // rilevazioni ogni 2 mesi, banda più larga
  }
  return {ogni:1, base:3, floor:2, voce:'Il sondaggio della settimana dà'};
}
/* Genera (se è il periodo) il sondaggio del mese: riga nel log + S.ultimoSondaggio + la SERIE per il grafico-trend.
   F3 — il sondaggio mente il giusto: scarto plausibile dal vero, che si STRINGE avvicinandosi al voto (l'ultimo cade
   entro ~2-3 punti, più largo nel '50) — mai la rivelazione esatta: la notte F4 conserva la sua suspense.
   Idempotente per costruzione: generato UNA VOLTA al confine di mese e persistito (il grafico è puro render). */
function forseSondaggio(){
  if(!periodoSondaggi()) return;
  const E=sondaggioEra(), mm=meseMandato();
  if(E.ogni>1 && (mm % E.ogni)!==0) return;                        // '50: la demoscopia nascente non rileva ogni mese
  const fine=PAESE.mandatoMesi||60, alVoto=Math.max(0, Math.min(6, fine-mm));
  const m=Math.round(clamp(E.base-(6-alVoto)*0.6, E.floor, E.base));   // margine che si stringe verso il voto
  const v=sondaggioVero();
  const valR=Math.round(clamp(v.val + (Math.random()*2-1)*m, 0, 100));   // rumore uniforme ±m, clampato
  const testo = v.tipo==='parlamentare'
    ? T('%V il tuo blocco al %N% dei seggi (±%M).').replace('%V',T(E.voce)).replace('%N',valR).replace('%M',m)
    : T('%V il tuo %N% nel testa a testa con %O (±%M).').replace('%V',T(E.voce)).replace('%N',valR).replace('%O',T(v.opp.nome)).replace('%M',m);
  S.ultimoSondaggio={ tipo:v.tipo, val:valR, margine:m, testo:testo, mese:mm };
  S.sondStorico=(S.sondStorico||[]).concat([{ mm:mm, val:valR, margine:m }]).slice(-8);   // la serie del grafico (dato puro, round-trip)
  S.log.unshift({ t:T('Sondaggio'), x:testo });
}

/* --- Punti riforma: maturazione dello STOCK al confine di mese ---
   Va chiamata PRIMA del reset degli snapshot (S.snap/S.leggiSnap): rpUsed() dev'essere ancora
   significativo — è il punto critico del sistema. Formula: min(tetto, stock − spesi + iniezione).
   Mese normale: +1, tetto 3. Gennaio (S.month è GIÀ il mese nuovo): iniezione +3, tetto 5,
   +1 territorio FUORI tetto (max 6). L'addebito vive SOLO qui: a metà mese S.rp non si muove
   (si muove rpUsed), quindi la foto di confine (lastSnap) non può mai separare effetti e punti. */
function maturaRP(){
  const spesi=rpUsed();
  S.rp = (S.month===1)
    ? Math.min(5, (S.rp||0) - spesi + 3) + ((!S.opposizione && (S.potereLocale||0)>50) ? 1 : 0)
    : Math.min(3, (S.rp||0) - spesi + 1);
}

/* --- Avanzamento del mese --- */
/* avanzamento mese: il CORE è avanzaMese(); il wrapper advanceMonth() aggiunge il BILANCIO di fine anno DOPO il render
   (così se avanzaMese ha aperto un modale/gameOver, forseBilancio lo salta). Lo snapshot baseline si crea alla prima
   chiamata (così il primo gennaio ha già un confronto). advanceMonth resta il nome pubblico (onclick, ecc.). */
function advanceMonth(){
  if(S && S.snapAnnuale===undefined && S.month!=null){ try{ S.snapAnnuale=snapAnnuale(); }catch(e){} }   // baseline (dato puro, migrato)
  avanzaMese();
  try{ forseBilancio(); }catch(e){}
  try{ forseTelefonata(); }catch(e){}   // F1 — la telefonata DOPO il bilancio: se il bilancio (o un altro modale) è aperto, lo squillo salta e ritenta il mese dopo (cooldown non consumato)
  try{ scadiTerritorio(); forseTerritorio(); }catch(e){}   // F2 — la mappa che chiama: scade il vecchio invito, poi ne prova uno nuovo (mai lo stesso mese della telefonata: la gate controlla !S.telPendente)
  try{ forseIntervista(); }catch(e){}   // F5 — l'intervista incalzante: dopo tutto il resto (skip se un modale è aperto o se c'è già una Sfida singola nel mese)
}
function avanzaMese(){
  if(agendaPending()) return;
  if(S.livello===0){   // ATTIVISTA (Build A): avanzamento MINIMO — nessun motore nazionale/locale (L0); il motore-base arriva a L3
    S.month++;
    if(S.month>12){ S.month=1; S.year++; S.turnInMandate++; }
    if(S.month===1 && S.eta!=null){ S.eta++; if(S.famiglia&&S.famiglia.figli) S.famiglia.figli.forEach(function(f){ f.eta++; });
      if(S.eta>=80) return gameOver('ritiro');       // L5-FIX (MEDIUM): l'orologio biografico vale anche a livello 0 — chi fa coasting non è immortale (il congedo a 80 esiste a ogni altro livello)
      S.log.unshift({t:T('Compleanno'),x:T('Compi %E anni.').replace('%E',S.eta)}); }
    if(famigliaPresente() && S.famiglia.serenita!=null){ const dm=(dif().degradoMult!=null)?dif().degradoMult:1; serenitaMuovi(-0.3*dm); }
    if(S.attivista){ simulateAttivista(); S.attivista.mesi=(S.attivista.mesi||0)+1;      // L3: deriva passiva (verso ciò che hai costruito) + conteggio mesi
      var C2=S.attivista.campagna;
      if(C2){                                                                             // A.5 REWORK L2: la campagna vive nel flusso
        if(!C2._nutrita && !C2.resaPending){ C2.progresso=clamp(C2.progresso - CAMP_DECAY, 0, 100); C2._calato=true; }   // DECADENZA solo per INCURIA (mese senza contributo in-corsia); start/resa esclusi → mai punizione da circostanza. _calato = pallino "sta calando" (L3)
        else C2._calato=false;                                                            // nutrita/resa → nessun avviso di calo
        C2._nutrita=false;                                                                // reset del flag per il mese nuovo
        if(!C2.resaPending){ C2.mesiRestanti=(C2.mesiRestanti||0)-1; if(C2.mesiRestanti<=0) C2.resaPending=true; }   // TICK verso la resa; a 0 → CARTA di resa (non auto-risolve più)
      }
      if(!S.attivista.laurea && attLaureabile()){ S.attivista.laurea=true;               // L4: raggiunto il gate → si apre la prima candidatura (flag persistito nel salvataggio)
        S.log.unshift({t:T('Pronto per la candidatura'), x:T('Hai base, fiducia dei gruppi e autorevolezza: il partito è pronto a candidarti. Scegli dove scendere in campo.')}); }
      // ROLL del mese AL CONFINE (reload-stabile): priorità resa > evento > offerta-campagna; la carta la sceglie genAgenda
      if(S.attivista.laurea){ S.attivista.evCorrente=null; S.attivista.campOfferta=false; }
      else if(C2 && C2.resaPending){ S.attivista.evCorrente=null; S.attivista.campOfferta=false; }   // la resa ha la precedenza sul mese
      else { S.attivista.evCorrente=provaAttivistaEvento(); S.attivista.campOfferta=(!S.attivista.evCorrente && !S.attivista.campagna) ? provaOffertaCampagna() : false; } }
    genAgenda(false); render(); commitSnap();
    return;
  }
  simulateMonth();       // AVANZAMENTO — il drift-economia vive DENTRO simulateMonth: S.ciclo reverte verso cicloBase()
  S.month++;
  if(S.month>12){ S.month=1; S.year++; S.turnInMandate++; }
  riallineamentoTappa();  // AVANZAMENTO — riallineamento-partiti alle tappe '58/'63 (Fase 1: inerte, tabella vuota → no-op)
  /* l'orologio biografico (lotto 2): a gennaio l'età avanza; verso gli 80 il CONGEDO — la fine
     naturale dell'arco (§2 del design), prima di qualunque urna. Le avvisaglie a 77/79 preparano
     il commiato, che non deve arrivare a sorpresa. */
  if(S.month===1 && S.eta!=null){
    S.eta++;
    if(S.famiglia && S.famiglia.figli) S.famiglia.figli.forEach(function(f){ f.eta++; });   // i figli crescono con te (lotto 5)
    if(S.eta>=80) return gameOver('ritiro');
    if(S.eta===77)      S.log.unshift({t:'Compleanno',x:'Compi 77 anni. Nei corridoi si comincia a parlare del tuo ritiro.'});
    else if(S.eta===79) S.log.unshift({t:'Compleanno',x:'Compi 79 anni. L\'ultima stagione: il congedo si avvicina.'});
    else                S.log.unshift({t:T('Compleanno'),x:T('Compi %E anni.').replace('%E',S.eta)});
  }
  /* la serenità familiare cala ogni mese (la carriera che divora) — scalata da degradoMult; vale a ogni livello.
     Curare gli affetti (eventi) la rialza; sotto 35 arriva la crisi familiare (popup in pickPersonale). */
  if(famigliaPresente() && S.famiglia.serenita!=null){ const dm=(dif().degradoMult!=null)?dif().degradoMult:1; serenitaMuovi(-0.3*dm); }   // la carriera divora: chi cura gli affetti (sceglie famiglia sugli eventi) la tiene su; chi no, scivola alla crisi
  if(S.livello===5){   // DIPLOMATICO (C2): si sale per STANDING (credito + relInt); nessuna sconfitta nazionale, nessun mandato a scadenza
    if(S.diplo){ S.diplo.mesiAlto=(S.diplo.credito>=70)?(S.diplo.mesiAlto||0)+1:0; }   // mesi a credito alto → garantiscono la promozione
    genAgenda(false); render(); commitSnap();
    return;
  }
  if(S.livello===4){   // SEGRETARIO GENERALE (fase C1a): medi tra i blocchi; NON perdi a crisi/insolvenza nazionali
    intDrift();
    S.intl.coesBassa = (S.intl.coesione<25) ? (S.intl.coesBassa||0)+1 : 0;
    if(S.intl.coesBassa>=3){ return gameOver('mandatoInt'); }   // coesione crollata a lungo → estromesso (conseguenza delle TUE scelte)
    S.intl.mesiInCarica=(S.intl.mesiInCarica||0)+1;
    if(S.intl.mesiInCarica>=S.intl.mandatoMesi){               // fine mandato (5 anni): rinnovo se coeso/autorevole, altrimenti non riconfermato
      if(S.intl.coesione>=45 && S.intl.autorevolezza>=50){ S.agenda=[{kind:'rinnovoInt', resolved:false}]; render(); commitSnap(); return; }
      return gameOver('mandatoInt');
    }
    genAgenda(false); render(); commitSnap();
    return;
  }
  if(S.livello===1){   // POLITICO LOCALE: il motore è quello locale; non perdi a crisi/insolvenza nazionali
    simulateLocale();
    capitaleCresci();
    if(S.month===1 && S.turnInMandate>=PAESE.mandatoMesi/12){ return esitoElezioneLocale(); }
    S.snap=Object.assign({},S.pol);
    aggiornaSfida();
    genAgenda(false); generaTitolo(); render(); commitSnap();
    return;
  }
  if(S.opposizione){                                              // all'opposizione: niente crisi/insolvenza/sfiducia tue
    const f0=mioPartito().forza;
    if(S.forze[S.partito] < Math.max(f0*0.5, 5)){ return gameOver('congresso'); }   // forza crollata: il partito ti scarica
    if(S.month===1 && S.turnInMandate>=PAESE.mandatoMesi/12){ if(sfidaAttiva()) return apriPrimaria('vigilia'); return election(); }   // a fine mandato: prima la primaria (se la sfida è viva), poi sfidi
    S.visibilita=clamp((S.visibilita||0)-4,0,100);                                   // il silenzio ti spegne (decadimento mensile)
    aggiornaSfida();                                                                 // la vita interna del partito non dorme nemmeno da sfidante
    genAgenda(false); forseSondaggio(); render(); commitSnap();
    if(sfidaMatura()) apriPrimaria('anticipata');                                    // congresso anticipato: il malcontento è maturo
    return;
  }
  if(S.livello===2){   // MINISTRO sotto premier-AI (lotto ascesa): NON perdi tu a crisi/insolvenza — è il governo del premier
    capitaleCresci();
    if(S.premier && S.premier.lealta<20){   // lealtà ai minimi → rischio di essere silurato (isteresi + preavviso, mai a freddo)
      if(S.silAvviso==null){ S.silAvviso=S.year*12+S.month; S.log.unshift({t:T('Tensione col premier'),x:T('%P non si fida più di te: un altro strappo e sei fuori dal governo.').replace('%P',S.premier.nome)}); }
      else if((S.year*12+S.month)-S.silAvviso>=2){ return gameOver('silurato'); }
    } else { S.silAvviso=null; }
    S.premCrisiMesi = (S.ind.consenso<33) ? (S.premCrisiMesi||0)+1 : 0;   // premier in crisi (consenso nazionale basso a lungo)
    if(S.premCrisiMesi>=3 && S.capitale<50){ S.premier=generaPremier(); S.premCrisiMesi=0; S.log.unshift({t:T('Cambio al vertice'),x:T('Il partito sostituisce il premier con %P. Tu, ancora acerbo, resti ministro.').replace('%P',S.premier.nome)}); }   // se non sei pronto, un nuovo premier; se lo sei, scatta l'occasione (pickOccasione)
    if(S.month===1 && S.turnInMandate>=PAESE.mandatoMesi/12){ return esitoElezioneMinistro(); }
    maturaRP();
    S.snap=Object.assign({},S.pol); S.leggiSnap=Object.assign({},S.leggi);
    aggiornaSfida();
    genAgenda(false); generaTitolo(); forseSondaggio(); render(); commitSnap();
    return;
  }
  if(S.ind.consenso<dif().sogliaCrisi){ return gameOver('crisi'); }
  if(S.mesiSottoCrisi>=dif().mesiInsolvenza){ return gameOver('insolvenza'); }
  if(S.month===1 && S.turnInMandate>=PAESE.mandatoMesi/12){ if(sfidaAttiva()) return apriPrimaria('vigilia'); return election(); }   // vigilia: prima la primaria, poi le urne
  if(PAESE.cadutaGoverno && S.minoranza && Math.random()<probSfiducia()){      // elezioni anticipate da sfiducia (passo 4)
    S.elezioniAnticipate=true;
    S.log.unshift({t:'Sfiducia',x:'Mozione di sfiducia approvata: si va a elezioni anticipate.'});
    return election();
  }
  maturaRP();   // PRIMA del reset degli snapshot: rpUsed() è ancora significativo
  S.snap=Object.assign({},S.pol); S.leggiSnap=Object.assign({},S.leggi);
  if(S.month===1){ S.log.unshift({t:T('Nuovo anno'),x:T(((S.potereLocale||0)>50)?'Legge di bilancio: manovra +3 punti riforma (+1 dal territorio) — in cassa ne hai %N.':'Legge di bilancio: manovra +3 punti riforma — in cassa ne hai %N.').replace('%N',curRpMax())}); }
  /* il conto della promessa (intervista) si chiude al confine: colpi deliberati ≥3 → ritorno di fiamma; 3 mesi senza → scade in silenzio */
  if(S.promessa){
    if((S.promessa.colpi||0)>=3){ const g=S.promessa.grp; S.promessa=null; gd(g,-4); stampad(-6);
      S.log.unshift({t:'La stampa ti rinfaccia l\'intervista', x:T('Avevi promesso attenzione a %G, poi i fatti: i media non perdonano.').replace('%G',T(nomeGruppo(g)))}); }
    else if((S.year*12+S.month)-S.promessa.mese>=3){ S.promessa=null; }
  }
  aggiornaSfida();   // la vita interna del partito: la sfida monta, matura o rientra
  monthlyMinisters();
  genAgenda(false);
  generaTitolo();   // la prima pagina del mese (dopo genAgenda: può commentare le carte di oggi)
  if(S.ind.consenso<30) S.log.unshift({t:'Allarme',x:'Il consenso è basso: si parla di sfiducia.'});
  if(S.mesiSottoCrisi>0) S.log.unshift({t:T('Allarme debito'),x:T('Fiducia ai minimi: rischio insolvenza (%A/%B mesi).').replace('%A',S.mesiSottoCrisi).replace('%B',dif().mesiInsolvenza)});
  forseSondaggio();
  render(); commitSnap();
  if(sfidaMatura()) apriPrimaria('anticipata');   // congresso anticipato: 3 mesi di sfida matura (modale sopra il mese nuovo)
}

/* --- Elezioni / fine partita --- */
/* Elezioni passo 3: decise dalle FORZE dei partiti, non più dal consenso.
   Parlamentare (Italia, UK) → seggi, serve 50 (da solo o in coalizione). Candidato (USA, Francia) → testa a testa.

   ELECTION DAY — lo spoglio a tappe. Il risultato VERO si calcola UNA VOLTA SOLA e si congela in NOTTE
   (variabile globale, come COAL: mai serializzata → la notte è atomica). Le tappe sono SOLO rivelazione
   con rumore decrescente che converge: exit poll ±3 → proiezioni ±1,5 → quasi definitivi ±0,5 → proclamazione 0.
   La proclamazione coincide sempre con l'esito a valle (trattativa/esitoSeggi/esitoCandidato, invariati). */
/* ============================================================================
   F4 — LA NOTTE A SPOGLIO PROGRESSIVO. Cinque ondate, ~7s l'una (~35s), skippabili sempre.
   LA REGOLA D'ORO: la messa in scena NON altera i numeri. Il VERO è congelato prima (calcSeggi/testaATesta,
   deterministici); le ondate si PRE-GENERANO tutte in una volta a ritroso dal vero e vivono nel TRANSITORIO
   `NOTTE.onde[]` — l'ultima ondata È il vero, esatta. Il rumore si calcola UNA VOLTA per ondata (non a ogni
   render): il re-render è idempotente (corregge il difetto per cui `notteSeggi` ricampionava a ogni disegno).
   Nessuna casualità persistita in `S`; nessun commitSnap durante la notte → `S` non può contenere una mezza-notte.
   RELOAD (comportamento dichiarato, decisione (a)): il transitorio muore col caricamento, si riparte dal confine
   di mese e l'elezione si RIGIOCA con lo stesso identico VERO (deterministico da S.forze). Atomico, incorruttibile. */
const SD_NOTTE=[4, 2.5, 1.2, 0.5, 0];
const LAB_NOTTE=['Urne chiuse · Exit poll','Prime proiezioni','Le sezioni dai territori','Dati quasi definitivi','Proclamazione'];
const NOTTE_MS=7000;          // ritmo per ondata (~35s in totale); «Avanti» accelera, «Salta» chiude
const NOTTE_DICH=3;           // l'ondata della dichiarazione a caldo (la penultima)
function rumore(v, sd){ return clamp(v + (Math.random()*2-1)*sd, 0, 100); }   // rumore uniforme ±sd, clampato [0,100]
/* Sposta `target` seggi verso/da il blocco mantenendo la somma 100 (usato dal SORPASSO nel filo). */
function spostaBlocco(shown, blocIds, target){
  var out=Object.assign({}, shown);
  var cur=blocIds.reduce(function(s,id){ return s+(out[id]||0); },0);
  var d=Math.round(target-cur); if(!d) return out;
  var inB=PAESE.partiti.filter(function(p){ return blocIds.indexOf(p.id)>=0; });
  var outB=PAESE.partiti.filter(function(p){ return blocIds.indexOf(p.id)<0; });
  var give=(d>0?outB:inB).slice().sort(function(a,b){ return (out[b.id]||0)-(out[a.id]||0); });
  var take=(d>0?inB:outB).slice().sort(function(a,b){ return (out[b.id]||0)-(out[a.id]||0); });
  var n=Math.abs(d), gi=0, ti=0, guardia=0;
  while(n>0 && give.length && take.length && guardia++<500){
    var g=give[gi%give.length], t=take[ti%take.length];
    if((out[g.id]||0)>1){ out[g.id]--; out[t.id]=(out[t.id]||0)+1; n--; }
    gi++; ti++;
  }
  return out;
}
/* Pre-genera le 5 ondate. Cammino CONVERGENTE (ogni ondata parte dalla precedente e si avvicina al vero):
   il testa-a-testa si DECIDE, non salta a caso. Nel filo (scarto ≤2 dalla riga) concede un SORPASSO a metà
   spoglio — deterministico, pre-generato come il resto: è la notte del '53. */
function generaOnde(sistema, vero){
  var N=SD_NOTTE.length, onde=[], k;
  if(sistema==='parlamentare'){
    var ids=PAESE.partiti.map(function(p){ return p.id; });
    /* Il blocco mostrato è quello che DECIDE (nel '53 l'apparentamento): l'offset si applica al TOTALE-BLOCCO,
       non ai singoli partiti — così la barra che conta OSCILLA davvero (col rumore per-partito la
       normalizzazione a 100 lo cancellava, e la notte restava piatta). Il jitter per-partito resta, piccolo. */
    var bloc=(typeof bloccoElettorale==='function')?bloccoElettorale():bloccoIds();
    var vB=bloc.reduce(function(s,id){ return s+(vero.seggi[id]||0); },0);
    var offB=(Math.random()*2-1)*SD_NOTTE[0];
    for(k=0;k<N;k++){
      var sd=SD_NOTTE[k];
      if(sd===0){ onde.push(Object.assign({}, vero.seggi)); continue; }   // l'ULTIMA è il vero, esatto
      if(k>0){ var scala=sd/(SD_NOTTE[k-1]||1); offB = 0.6*offB*scala + 0.4*(Math.random()*2-1)*sd; }
      var raw=ids.map(function(id){ return {id:id, v:Math.max(0, (vero.seggi[id]||0)+(Math.random()*2-1)*sd*0.5)}; });
      var tot=raw.reduce(function(s,x){ return s+x.v; },0)||1;
      var q=raw.map(function(x){ var e=x.v/tot*100; return {id:x.id, f:Math.floor(e), r:e-Math.floor(e)}; });
      var used=q.reduce(function(s,x){ return s+x.f; },0);
      q.slice().sort(function(a,b){ return b.r-a.r; }).forEach(function(x){ if(used<100){ x.f++; used++; } });
      var shown={}; q.forEach(function(x){ shown[x.id]=x.f; });
      onde.push(spostaBlocco(shown, bloc, clamp(Math.round(vB+offB),0,100)));   // il TOTALE-blocco segue il cammino convergente
    }
    if(Math.abs(vB-50)<=2) onde[2]=spostaBlocco(onde[2], bloc, (vB>=50)?48:52);   // SORPASSO all'ondata territoriale (la notte del '53)
  } else {
    var offC=(Math.random()*2-1)*SD_NOTTE[0];
    for(k=0;k<N;k++){
      var sd2=SD_NOTTE[k];
      if(k>0){ var sc2=sd2/(SD_NOTTE[k-1]||1); offC = sd2===0 ? 0 : (0.6*offC*sc2 + 0.4*(Math.random()*2-1)*sd2); }
      onde.push({ myPct: sd2===0 ? vero.myPct : clamp(vero.myPct+offC,0,100) });
    }
    if(Math.abs(vero.myPct-50)<=2) onde[2]={ myPct:(vero.myPct>=50)?48.5:51.5 };   // SORPASSO
  }
  return onde;
}
function tacca50(){ return '<span style="position:absolute;left:50%;top:-2px;bottom:-2px;width:2px;background:var(--neg);opacity:.55"></span>'; }
/* L'EXIT POLL SALE DA ZERO: semina UIVALS a 0 per le barre della notte, così il primo stadio anima dal vuoto
   (gli stadi successivi partono già dal valore precedente, via playAnims). Solo transform → 60fps, GPU.
   Chiamata in avviaNotte prima del primo renderNotte. Sotto reduced-motion playAnims salta comunque (tutto istantaneo). */
function seedNotteAnim(){
  if(typeof UIVALS==='undefined' || !NOTTE) return;
  UIVALS['bar:notte:bloc']=0;   // chiave = il data-anim completo: `fillI` antepone 'bar:' (come legge playAnims)
  if(NOTTE.sistema==='parlamentare'){ (PAESE.partiti||[]).forEach(function(p){ UIVALS['bar:notte:seg:'+p.id]=0; }); }
  else { UIVALS['bar:notte:me']=0; UIVALS['bar:notte:opp']=0; }
}

/* GIORNATA ELETTORALE (fase B): attesa → notte a tappe → esito. Il VERO si congela QUI, nell'attesa, prima
   della mossa di chiusura — così la mossa esprime carattere ma NON sposta il verdetto (vincolo di Giacomo). */
function election(){ avviaAttesa(); }
function avviaAttesa(){
  let sistema, vero;
  if(PAESE.comeSiVince==='parlamentare'){
    S.seggi=calcSeggi();                                       // VERO: seggi, calcolati una volta (qui, prima della chiusura)
    sistema='parlamentare'; vero={ seggi:Object.assign({},S.seggi) };
  } else {
    if(PAESE.coalizione||PAESE.comeSiVince==='parlamentare') S.seggi=calcSeggi();
    sistema='candidato'; vero=testaATesta();                  // VERO: testa a testa, deterministico
  }
  ATTESA={ sistema:sistema, vero:vero };
  renderAttesa();
}
/* La chiusura della campagna: clima della vigilia + posta personale + una MOSSA di chiusura (carattere/tratti,
   effetto minimo: il vero è già congelato, quindi non può cambiare la notte). */
function renderAttesa(){
  if(!ATTESA) return;
  const mg=calcMargineEsito(ATTESA.sistema, ATTESA.vero);
  const clima = T(mg.m>=8 ? 'I sondaggi della vigilia ti danno in vantaggio.'
              : (mg.m<=-8 ? 'I sondaggi della vigilia ti danno a rincorrere.'
                          : 'I sondaggi della vigilia danno un testa a testa: tutto aperto.'));
  const opts=(typeof MOSSE_CHIUSURA!=='undefined'?MOSSE_CHIUSURA:[]).map(function(m,i){
    if(m.cond && !m.cond()) return '';   // Cantiere C: le chiusure SBLOCCABILI compaiono solo se la condotta le ha guadagnate (indici originali preservati per chiudiCampagna(i))
    return `<button class="opt" onclick="chiudiCampagna(${i})"><span class="ol">${T(m.l)}</span><span class="oe">${T(m.e)}</span></button>`; }).join('');
  /* Build B 1b — la POSTA leggibile prima del voto: la regola del premio, così lo snodo è bendabile perché è visibile. */
  const truffaNota = (snodoTruffaAttivo() && S.leggeTruffa==='approvata')
    ? `<div class="mtext" style="color:var(--acc-ink);border-left:2px solid var(--acc);padding-left:10px">${T('Hai approvato il premio di maggioranza: se il tuo blocco supera il 50% dei voti, ottiene il 64,4% dei seggi — se manchi, la legge ti si ritorce contro.')}</div>`
    : '';
  document.getElementById('modal').innerHTML=`<div class="mt"><div class="kicker">${T(PAESE.nome)} · ${T(S.elezioniAnticipate?'Elezioni anticipate':'Elezioni')} ${S.year}</div><h2>${T('La chiusura della campagna')}</h2></div>
    <div class="mtext">${clima} ${T(stakesPersonali())}</div>
    ${truffaNota}
    <div class="mtext" style="color:var(--mut2)">${T('L\'ultima parola è tua. Domani si vota.')}</div>
    <div class="choices">${opts}</div>`;
  document.getElementById('ov').classList.add('on');
}
function chiudiCampagna(i){ const m=(typeof MOSSE_CHIUSURA!=='undefined')&&MOSSE_CHIUSURA[i]; if(m){ if(m.f)m.f(); if(m.pleases)bioPleases(m.pleases); } avviaNotte(); }
/* la posta personale, da biografia/personaggio (sobria, 1 riga) */
function stakesPersonali(){
  const mw=S.mandatesWon||0, anni=Math.max(1,S.year-(S.annoInizio||2025));
  if(S.opposizione) return T('Dopo la traversata all\'opposizione, torni a giocarti tutto.');
  if(mw>=3) return T('Dopo %N mandati, rimetti in palio la tua storia.').replace('%N',mw);
  if(mw>=1) return T('Il paese giudica i tuoi anni al governo.');
  return T('La tua prima vera prova davanti alle urne.');
}
function avviaNotte(){
  let sistema, vero;
  if(ATTESA){ sistema=ATTESA.sistema; vero=ATTESA.vero; ATTESA=null; }   // usa il VERO congelato nell'attesa (non ricalcola: la chiusura non lo tocca)
  else {                                                                 // fallback (chiamata diretta): congela ora
    if(PAESE.comeSiVince==='parlamentare'){ S.seggi=calcSeggi(); sistema='parlamentare'; vero={ seggi:Object.assign({},S.seggi) }; }
    else { if(PAESE.coalizione||PAESE.comeSiVince==='parlamentare') S.seggi=calcSeggi(); sistema='candidato'; vero=testaATesta(); }
  }
  NOTTE={ sistema:sistema, vero:vero, stadio:0, onde:generaOnde(sistema, vero), dich:null, saltata:false, timer:null };
  try{ seedNotteAnim(); }catch(e){}   // l'exit poll sale da zero; le tappe successive partono dalla precedente
  renderNotte(); armaTimerNotte();
}
/* Il timer vive SOLO nel transitorio: skip/avanti lo cancellano, il reload lo uccide col resto. */
function stopTimerNotte(){ if(NOTTE && NOTTE.timer){ clearTimeout(NOTTE.timer); NOTTE.timer=null; } }
function armaTimerNotte(){
  if(!NOTTE) return; stopTimerNotte();
  if(NOTTE.stadio===NOTTE_DICH && !NOTTE.dich) return;      // la DICHIARAZIONE aspetta il giocatore: nessun auto-avanzamento
  if(NOTTE.stadio>=SD_NOTTE.length-1) return;               // l'ultima ondata resta ferma: il risultato lo apre lui
  NOTTE.timer=setTimeout(function(){ if(NOTTE) avanzaNotte(); }, NOTTE_MS);
}
function avanzaNotte(){
  if(!NOTTE) return;
  stopTimerNotte();
  NOTTE.stadio++;
  if(NOTTE.stadio>=SD_NOTTE.length) return concludiNotte();   // oltre la proclamazione → esito a valle
  renderNotte(); armaTimerNotte();
}
/* «Salta allo spoglio finale»: va all'ULTIMA ondata (i numeri esatti). Chi salta rinuncia al palcoscenico →
   nessuna dichiarazione, nessun effetto (decisione Giacomo: mai un effetto che il giocatore non ha scelto). */
function saltaNotte(){ if(!NOTTE) return; stopTimerNotte(); NOTTE.saltata=true; NOTTE.stadio=SD_NOTTE.length-1; renderNotte(); }
function dichiaraNotte(i){ if(!NOTTE) return; NOTTE.dich=i; stopTimerNotte(); avanzaNotte(); }
function concludiNotte(){
  stopTimerNotte();
  const sistema=NOTTE.sistema, vero=NOTTE.vero, dich=NOTTE.dich; NOTTE=null;   // svuota il transitorio PRIMA del flusso a valle
  const mg=calcMargineEsito(sistema, vero); S.margineEsito=mg; // il MARGINE (fase B): caratterizza l'esito (tono + biografia + epilogo)
  applicaMargineBio(mg);                                       // fatto datato + contatori trionfi/sconfitteNette (solo gli estremi memorabili)
  /* F4 — LA DICHIARAZIONE A CALDO, applicata QUI: dopo il risultato, mai prima. I seggi sono già congelati nel VERO
     → la parola della notte non può spostarne uno. Muove solo il DOPO (stampa, morale delle correnti). Effetti
     piccoli, tutte le opzioni legittime. Chi ha saltato la notte non ha dichiarato → nessun effetto. */
  if(dich!=null && typeof DICH_NOTTE!=='undefined' && DICH_NOTTE[dich]){
    const D=DICH_NOTTE[dich];
    if(typeof stampad==='function' && D.stampa) stampad(D.stampa);
    if(typeof tutteCorrenti==='function' && D.correnti) tutteCorrenti(D.correnti);
    S.log.unshift({ t:T('La dichiarazione della notte'), x:T(D.beat) });
  }
  if(sistema==='parlamentare'){
    if(snodoTruffaAttivo()){                                    // Build B (b): lo snodo «legge truffa» come scelta — 3 esiti, beat NEUTRALE (conseguenza sì, giudizio no)
      applicaSnodoTruffa();
      if(S.truffaEsito==='scatta'){
        S.log.unshift({ t:T('Legge truffa'), x:T('Il premio di maggioranza è scattato: il tuo blocco supera il 50% e ottiene il 64,4% dei seggi.') });
        try{ bioFatto(T('Il premio di maggioranza del 1953 scatta a suo favore.')); }catch(e){}
      } else if(S.truffaEsito==='boomerang'){                   // la gravità storica (fine dell'era degasperiana) vive nel BEAT, non in un colpo meccanico più duro (la meccanica resta recuperabile)
        S.log.unshift({ t:T('Legge truffa'), x:T('Il premio non è scattato: la legge approvata resta senza maggioranza e la tua stagione al governo vacilla.') });
        try{ bioFatto(T('Il premio di maggioranza del 1953 si ritorce contro il suo governo.')); }catch(e){}
      }
      // 'norma' (respinta o mai decisa): nessun beat — l'elezione proporzionale parla da sé
    }
    if(PAESE.coalizione){ openTrattativa('voto'); }            // Italia: riformi la maggioranza alla luce dei nuovi seggi
    else { const s=S.seggi[S.partito]; S.coalizione=[S.partito]; S.minoranza=false; esitoSeggi((s+credBonus())>=50, s); }  // UK: ≥50 da solo (+ credibilità in opposizione)
  } else {
    esitoCandidato(vero);                                      // USA/Francia: stesso oggetto testaATesta() della proclamazione
  }
}
/* Il MARGINE come spettro (fase B): segno = vittoria/sconfitta, |entità| = quanto netta. Parlamentare: il TUO blocco
   vs 50. Candidato: la tua percentuale vs 50. Solo lettura del `vero` congelato — nessuna casualità nuova. */
function calcMargineEsito(sistema, vero){
  let m, win;
  if(sistema==='parlamentare'){ const bloc=bloccoIds().reduce(function(s,id){return s+(vero.seggi[id]||0);},0); m=bloc-50; win=bloc>=50; }
  else { m=(vero.myPct||0)-50; win=!!vero.win; }
  const a=Math.abs(m); let tag;
  if(win) tag = a>=10?'trionfo':(a>=4?'netta':'misura');
  else    tag = a>=10?'valanga':(a>=4?'sconfittaNetta':'sconfittaMisura');
  return { m:Math.round(m), win:win, tag:tag, sistema:sistema };
}
/* Solo gli ESTREMI memorabili lasciano traccia (niente flood): trionfo e disfatta → fatto datato + UN contatore. */
function applicaMargineBio(mg){
  if(mg.tag==='trionfo'){ bioConta('trionfi'); bioFatto(T('Un trionfo alle urne')+(mg.sistema==='parlamentare'?' ('+(mg.m>=0?'+':'')+mg.m+' '+T('sul 50')+')':'')+'.'); }
  else if(mg.tag==='sconfittaNetta'){ bioConta('sconfitteNette'); bioFatto(T('Una sconfitta netta alle urne.')); }
  else if(mg.tag==='valanga'){ bioConta('sconfitteNette'); bioFatto(T('Una valanga contraria alle urne.')); }
}
/* La narrazione della notte (fase B): una riga per tappa, legata all'andamento (serrato = tensione, chiaro = corsa
   già scritta), che converge sul verdetto. Calcolata dal `vero` congelato → onesta, mai una sorpresa contraddittoria. */
function notteNarr(stadio){
  if(!NOTTE) return '';
  const mg=calcMargineEsito(NOTTE.sistema, NOTTE.vero), serrato=Math.abs(mg.m)<4;
  if(stadio===0) return serrato?T('Le urne si chiudono. I primi exit poll danno un equilibrio perfetto: nulla è deciso.')
    : (mg.win?T('Le urne si chiudono. I primi exit poll ti danno in vantaggio.'):T('Le urne si chiudono. I primi exit poll ti danno indietro.'));
  if(stadio===1) return serrato?T('Le proiezioni si consolidano, ma il distacco resta dentro i margini d\'errore.')
    : (mg.win?T('Le proiezioni confermano: il vantaggio prende forma.'):T('Le proiezioni confermano: il distacco non si colma.'));
  if(stadio===2) return serrato?T('Dai territori arrivano le sezioni: la mappa del voto si colora, e il quadro oscilla.')
    : (mg.win?T('Dai territori arrivano le sezioni: la mappa conferma il vantaggio.'):T('Dai territori arrivano le sezioni: la mappa non aiuta la rimonta.'));
  if(stadio===3) return serrato?T('A scrutinio quasi completo, si decide sezione per sezione.')
    : (mg.win?T('A scrutinio quasi completo, è praticamente fatta.'):T('A scrutinio quasi completo, la rimonta non basta.'));
  const fin={trionfo:'È un trionfo.', netta:'Una vittoria netta.', misura:'Ce l\'hai fatta, per un soffio.',
    sconfittaMisura:'Sconfitta per un soffio: mancano pochi voti.', sconfittaNetta:'Una sconfitta netta.', valanga:'Una valanga contraria.'};
  return T(fin[mg.tag]||'');
}
/* Disegno di una tappa — riusa l'overlay #ov/#modal (come gli esiti). Rumore fresco attorno al VERO congelato. */
/* F4 — il lancio di stampa fra le ondate: voce d'epoca col meccanismo P5-bis (gemella era-taggata preferita,
   generico come fallback E come presente). Deterministico: nessun dado nella messa in scena. */
function lancioNotte(fase){
  if(typeof NOTTE_LANCI==='undefined') return '';
  var pool=NOTTE_LANCI.filter(function(l){ return l.fase===fase && (typeof eraVivaT!=='function'||eraVivaT(l)); });
  if(!pool.length) return '';
  var era=pool.filter(function(l){ return l.era==='italia1950'||l.era==='italia1960'; });
  var s=(era.length?era:pool)[0];
  return s ? `<div class="mtext" style="font-style:italic;color:var(--mut);border-left:2px solid var(--mut2);padding-left:10px">${T(s.testo)}</div>` : '';
}
function renderNotte(){
  if(!NOTTE) return;
  const ultima=NOTTE.stadio>=SD_NOTTE.length-1;
  const onda=NOTTE.onde[NOTTE.stadio];
  const kicker=`${T(PAESE.nome)} · ${T(S.elezioniAnticipate?'Elezioni anticipate':'Elezioni')} ${S.year}`;
  const body = NOTTE.sistema==='parlamentare' ? notteSeggi(onda, ultima) : notteCandidato(onda);
  const narr = notteNarr(NOTTE.stadio);   // la riga di narrazione (fase B): tensione/respiro secondo l'andamento
  const lancio = lancioNotte(NOTTE.stadio);
  /* la DICHIARAZIONE A CALDO (penultima ondata): 2-3 opzioni. NON tocca i seggi — muove il dopo (concludiNotte). */
  let azioni;
  if(NOTTE.stadio===NOTTE_DICH && !NOTTE.dich && typeof DICH_NOTTE!=='undefined'){
    azioni = `<div class="mtext" style="font-weight:600">${T('I cronisti ti cercano: una parola, adesso.')}</div><div class="choices">`+
      DICH_NOTTE.map(function(d,i){ return `<button class="opt" onclick="dichiaraNotte(${i})"><span class="ol">${T(d.l)}</span><span class="oe">${T(d.e)}</span></button>`; }).join('')+`</div>`;
  } else {
    const btnTxt = T(ultima ? 'Risultato ufficiale →' : 'Avanti →');
    azioni = `<div class="choices"><button class="opt" style="border-color:${ultima?'var(--acc)':'var(--brand)'}" onclick="avanzaNotte()"><span class="ol"${ultima?' style="color:var(--acc-ink)"':''}>${btnTxt}</span></button>`+
      (ultima?'':`<button class="opt" style="border-color:var(--mut2)" onclick="saltaNotte()"><span class="ol" style="color:var(--mut)">${T('Salta allo spoglio finale')}</span></button>`)+`</div>`;
  }
  /* L9-1 — lo SFONDO della notte: attesa (stadio 0) / spoglio (in corso) / vittoria|sconfitta (proclamazione). Vinta =
     il blocco tocca 50 (parlamentare) o la mia % supera 50 (candidato); solo lettura del VERO congelato, non lo decide. */
  var vinta=false;
  if(ultima){ if(NOTTE.sistema==='parlamentare'){ var _bl=(typeof bloccoElettorale==='function')?bloccoElettorale():bloccoIds(); vinta=_bl.reduce(function(s,id){return s+(onda[id]||0);},0)>=50; } else { vinta=(onda.myPct>50); } }
  var scN=(typeof scenaNotte==='function')?scenaNotte(NOTTE.stadio, ultima, vinta):null;
  var mbg=scN?`<div class="mbg-img" style="background-image:url('${scN}')"></div>`:'';
  /* 375px senza salti: altezza minima riservata → le ondate non fanno ballare il modale. Sfondo su WRAPPER (no leak di classe). */
  document.getElementById('modal').innerHTML=`<div class="notte-wrap">${mbg}<div class="mt"><div class="kicker">${kicker}</div><h2>${T(LAB_NOTTE[NOTTE.stadio])}</h2></div>
    <div style="min-height:268px">
      <div class="mtext"${ultima?' style="font-weight:600"':''}>${narr}</div>
      ${lancio}
      <div class="notte-panel">${body}</div>
    </div>
    ${azioni}</div>`;
  document.getElementById('ov').classList.add('on');
  try{ playAnims(); }catch(e){}   // vetrina: le barre dello spoglio scorrono tappa dopo tappa
}
/* Parlamentare: barre per-partito col rumore, RI-NORMALIZZATE a 100 coi resti (lo spoglio rispetta la somma 100);
   riga grossa "Il tuo blocco: N seggi" con la tacca del 50. Alla proclamazione (sd 0) i seggi sono esatti. */
function notteSeggi(shown, ultima){
  const ps=PAESE.partiti;
  const sd=ultima?0:1;   // solo per l'emiciclo finale (compat: la vecchia firma usava sd)
  /* F4 — il blocco mostrato è quello che DECIDE: nel '53 con la legge approvata è l'APPARENTAMENTO (bloccoElettorale),
     non la sola coalizione. Guardi salire la riga che vale davvero: la soglia si vive, non si legge dopo. */
  const bloc=(typeof bloccoElettorale==='function')?bloccoElettorale():bloccoIds();
  const blocTot=bloc.reduce((s,id)=>s+(shown[id]||0),0), reached=blocTot>=50;
  const sorted=[...ps].sort((a,b)=>shown[b.id]-shown[a.id]);
  const rows=sorted.map(p=>{ const inBloc=bloc.includes(p.id), me=p.id===S.partito;
    return `<div style="padding:5px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="font-weight:${me?700:500}">${T(p.nome)}${me?(' <span class="chip" style="background:var(--acc-bg);color:var(--acc-ink)">'+T('tu')+'</span>'):''}</span><span class="mono">${shown[p.id]}</span></div>
      <div class="bar">${fillI('notte:seg:'+p.id, clamp(shown[p.id],2,100), inBloc?'var(--acc)':'var(--mut2)')}</div></div>`; }).join('');
  /* alla PROCLAMAZIONE: l'aula come emiciclo (grafica lotto 2) — i puntini a ventaglio */
  const emi=(ultima && typeof emiciclo==='function') ? `<div style="padding:6px 18px 0">${emiciclo(shown,{key:'notte',coal:bloc})}</div>` : '';
  /* F4 — LA SOGLIA IN SCENA (il '53 e ogni snodo-soglia futuro): la posta dichiarata ondata per ondata.
     Il VERO non cambia: la soglia resta valutata a valle in applicaSnodoTruffa. Qui si VIVE, non si decide. */
  const soglia=(typeof snodoTruffaAttivo==='function' && snodoTruffaAttivo() && S.leggeTruffa==='approvata')
    ? `<div class="mtext" style="color:var(--acc-ink);border-left:2px solid var(--acc);padding-left:10px">${T('Il premio di maggioranza: al blocco apparentato serve il 50%.')} <b class="mono">${blocTot}</b> ${T('in questo momento')}.</div>` : '';
  return `<div class="mtext">${T('Il tuo blocco:')} <b class="mono" style="color:${reached?'var(--pos)':'var(--acc)'};font-size:17px">${blocTot}</b> ${T('seggi su 100')} <small style="color:var(--mut2)">${T('(servono 50)')}</small>.
      <div class="bar" style="position:relative;margin-top:8px">${fillI('notte:bloc', clamp(blocTot,2,100), reached?'var(--pos)':'var(--acc)')}${tacca50()}</div></div>
    ${soglia}
    ${emi}
    <div style="padding:0 18px 6px">${rows}</div>`;
}
/* Candidato: le due percentuali oscillano attorno al 50 e convergono (ondata PRE-GENERATA, nessun dado qui). */
function notteCandidato(onda){
  const r=NOTTE.vero, me=part(S.partito);
  const myP=onda.myPct, oppP=clamp(100-myP,0,100);
  return `<div class="mtext">${T('Testa a testa con %O.').replace('%O','<b>'+T(r.opp.nome)+'</b>')}</div>
    <div style="padding:0 18px 6px">
      <div style="padding:6px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="font-weight:700">${T(me.nome)} <span class="chip" style="background:var(--acc-bg);color:var(--acc-ink)">${T('tu')}</span></span><span class="mono">${fmt(myP,1)}%</span></div>
        <div class="bar" style="position:relative">${fillI('notte:me', clamp(myP,2,100), 'var(--acc)')}${tacca50()}</div></div>
      <div style="padding:6px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="font-weight:600">${T(r.opp.nome)}</span><span class="mono">${fmt(oppP,1)}%</span></div>
        <div class="bar">${fillI('notte:opp', clamp(oppP,2,100), 'var(--mut2)')}</div></div></div>`;
}

/* ============================================================
   F1 — LA TELEFONATA. Un'interruzione a squillo (overlay #ov con veste .tel), due opzioni secche, decisione a
   caldo. Timer ~13s in TEL (transitorio, mai in S) → allo scadere «Hai lasciato squillare» + raffreddamento
   minimo e recuperabile. Reload-safe: in S vive solo telPendente (l'id), così il telefono richiama da capo.
   ============================================================ */
function telDef(id){ return (typeof F1_TELEFONATE!=='undefined') ? F1_TELEFONATE.filter(function(t){return t.id===id;})[0] : null; }
/* il gate: SOLO il premier al governo, cadenza rara (pavimento 4 mesi), mai due in sospeso, mai nella stagione
   elettorale. NON soggetta al cedimento-G4: la telefonata è trasversale (grave o leggera). */
function telefonataDovuta(){
  if(typeof S==='undefined' || !S) return false;
  if(S.livello!==3) return false;                     // L25-1: riaperta allo SFIDANTE (era `|| S.opposizione`) — la telefonata
                                                      // è la superficie naturale del tavolo-alleanze: un segretario che ti chiama.
  if(S.telPendente) return false;                     // già una chiamata senza risposta
  if(S.campNaz) return false;                         // niente durante la stagione elettorale (il setpiece assorbe il mese)
  var mese=S.year*12+S.month;
  if(S.telUltimo!=null && mese-S.telUltimo<4) return false;   // pavimento 4 mesi → mai due nello stesso mese, cadenza rara
  return true;
}
function pescaTelefonata(){
  if(typeof F1_TELEFONATE==='undefined') return null;
  var pool=F1_TELEFONATE.filter(function(t){
    return (typeof eraVivaT!=='function' || eraVivaT(t)) && (!t.paese || S.paese===t.paese) && (!t.cond || t.cond());
  });
  if(!pool.length) return null;
  return (typeof pescaBag==='function') ? pescaBag('tel|'+((S&&S.era)||'p'), pool) : pool[0];
}
/* forseTelefonata: al confine di mese (fine di avanzaMese, ramo premier), dopo che il mese è già reso sotto.
   ~35% oltre il pavimento → cadenza attesa ~1/4-6 mesi. Non squilla se un modale è già aperto (primaria/bilancio…). */
function forseTelefonata(){
  if(!telefonataDovuta()) return;
  try{ var over=document.getElementById('over'); if(over && over.style.display!=='none') return; }catch(e){}   // gameOver/congedo in corso → niente squillo
  try{ if(document.getElementById('ov').classList.contains('on')) return; }catch(e){}   // mai sopra un altro modale (notte/primaria/bilancio)
  if(Math.random()>=0.35) return;
  var def=pescaTelefonata(); if(!def) return;
  S.telPendente=def.id;
  apriTelefonata(); commitSnap();
}
/* resumeTelefonata: al reload, se una chiamata era in sospeso, il telefono squilla di nuovo (timer fresco). */
function resumeTelefonata(){ if(S && S.telPendente && telDef(S.telPendente)) apriTelefonata(); }
function voceTel(def){
  if(def && def.voce==='centralino') return T('Il centralino ti passa una comunicazione');
  if(S && S.era && S.era!=='contemporanea' && PAESE && PAESE.id==='italia') return T('Il centralino ti passa una comunicazione');
  return T('Il telefono squilla');
}
function stopTimerTel(){ if(TEL && TEL.timer){ clearTimeout(TEL.timer); TEL.timer=null; } }
function armaTimerTel(){
  if(!TEL) return; stopTimerTel();
  if(typeof F1_TIMER==='undefined' || !F1_TIMER) return;   // timer in prova: spento → la chiamata aspetta, nessuno scadere
  if(TEL.missed) return;                                    // la schermata «hai lasciato squillare» non riparte
  TEL.timer=setTimeout(function(){ if(TEL && !TEL.missed) scadeTel(); }, (typeof F1_TIMER_MS!=='undefined'?F1_TIMER_MS:13000));
}
function apriTelefonata(){
  var def=telDef(S.telPendente); if(!def){ S.telPendente=null; return; }
  TEL={ id:def.id, def:def, missed:false, timer:null };
  renderTelefonata(); armaTimerTel();
}
function renderTelefonata(){
  if(!TEL) return; var def=TEL.def;
  var dur=(typeof F1_TIMER_MS!=='undefined'?F1_TIMER_MS:13000);
  var barra=(typeof F1_TIMER!=='undefined' && F1_TIMER)
    ? `<div class="telbar" aria-hidden="true"><i style="--teldur:${dur}ms"></i></div>` : '';
  var scT=(typeof scenaTelefono==='function')?scenaTelefono(TEL.missed):null;   // L9-1: oggi (presente) / storico ('50-'60) / corridoio (chiamata chiusa)
  var scImgT=scT?`<img class="mscene" src="${scT}" alt="">`:'';
  if(TEL.missed){
    document.getElementById('modal').innerHTML=`${scImgT}<div class="mt"><div class="kicker">${T('Squillo perso')}</div><h2>${T('Hai lasciato squillare')}</h2></div>
      <div class="mtext">${T(def.squilloTxt||'La chiamata è caduta: richiamerà un\'altra volta.')}</div>
      <div class="choices"><button class="opt" onclick="chiudiTel()"><span class="ol">${T('Torna al mese')}</span></button></div>`;
  } else {
    var opts=def.ch.map(function(c,i){ return `<button class="opt" onclick="rispondiTel(${i})"><span class="ol">${T(c.l)}</span><span class="oe">${T(c.e)}</span></button>`; }).join('');
    document.getElementById('modal').innerHTML=`${scImgT}<div class="mt"><div class="kicker">☎ ${voceTel(def)}</div><h2>${T(def.t)}</h2></div>
      <div class="mtext">${T(def.text)}</div>
      ${barra}
      <div class="choices">${opts}</div>`;
  }
  var m=document.getElementById('modal'); if(m){ m.classList.add('tel'); m.classList.toggle('ring', !TEL.missed); }   // lo squillo (shake) solo mentre squilla, non sulla schermata «hai lasciato squillare»
  document.getElementById('ov').classList.add('on');
}
function rispondiTel(ci){
  if(!TEL) return; stopTimerTel();
  var def=TEL.def, opt=def.ch[ci];
  if(opt && opt.f){ try{ opt.f(); }catch(e){} }
  if(opt && opt.pleases && typeof bioPleases==='function') bioPleases(opt.pleases);
  S.log.unshift({ t:T(def.t), x:T(opt.l)+' — '+T(opt.e) });
  S.telUltimo=S.year*12+S.month; S.telPendente=null;
  chiudiTel();
}
/* scadeTel: lo squillo perso. La chiamata è RISOLTA (telPendente azzerato subito, malus applicato una volta) →
   un reload durante la schermata-miss non ri-squilla né raddoppia il costo. Il raffreddamento è minimo e recuperabile. */
function scadeTel(){
  if(!TEL || TEL.missed) return; stopTimerTel();
  var def=TEL.def; TEL.missed=true;
  if(def && def.raffredda){ try{ def.raffredda(); }catch(e){} }
  S.log.unshift({ t:T(def.t), x:T('Hai lasciato squillare.')+(def.squilloTxt?(' '+T(def.squilloTxt)):'') });
  S.telUltimo=S.year*12+S.month; S.telPendente=null;
  renderTelefonata(); commitSnap();
}
function chiudiTel(){
  stopTimerTel(); TEL=null;
  var m=document.getElementById('modal'); if(m){ m.classList.remove('tel'); m.classList.remove('ring'); }
  document.getElementById('ov').classList.remove('on');
  render(); commitSnap();
}

/* ============================================================
   BILANCIO DI FINE ANNO (§7). A gennaio: una LETTURA DI TENDENZA (3-4 dimensioni consapevoli del livello),
   ogni dimensione con direzione anno-su-anno (↑ in salita / → solida / ↓ in calo), e un verdetto d'insieme
   onesto. Overlay dismissibile, animato (barre che salgono da 0, verdetto che si rivela). Lo snapshot annuale
   (`S.snapAnnuale`) è dato PURO migrato. NON compare se scatta gameOver/congedo o se un modale è già aperto. */
function economiaIndice(){ const i=S.ind||{}; let e=50;
  if(i.growth!=null) e+=(i.growth-1)*12; if(i.unemp!=null) e-=(i.unemp-7)*4;
  if(i.fiducia!=null) e=(e+i.fiducia)/2; return clamp(e,0,100); }
/* le dimensioni del livello corrente, coi VALORI attuali (0-100). Usato sia per lo snapshot sia per il render. */
function bilancioDims(){
  const d=[]; const add=(key,nm,val)=>{ if(val!=null && !isNaN(val)) d.push({key:key, nm:T(nm), val:clamp(Math.round(val),0,100)}); };
  if(S.livello===1 && S.locale){
    add('cons','Consenso', S.locale.consenso);
    const ind=S.locale.ind||{}; const ks=Object.keys(ind).filter(k=>k!=='bilancio');
    add('serv','Servizi e territorio', ks.length?ks.reduce((s,k)=>s+ind[k],0)/ks.length:null);
    add('conti','Conti', ind.bilancio);
  } else if(S.livello===5 && S.diplo){
    add('cred','Credito diplomatico', S.diplo.credito);
    add('rel','Relazioni internazionali', relIntMean());
  } else if(S.livello===4 && S.intl){
    add('coes','Coesione', S.intl.coesione);
    add('aut','Autorevolezza', S.intl.autorevolezza);
    add('mondo','Stato del mondo', relIntMean());
  } else if(S.opposizione){
    add('vis','Visibilità', S.visibilita);
    add('cred','Credibilità', S.credibilita);
  } else if(S.livello===2){
    add('cap','Capitale politico', S.capitale);
    if(S.premier) add('gov','Fiducia del premier', S.premier.lealta);
    add('cons','Consenso del governo', S.ind&&S.ind.consenso);
  } else {   // livello 3: capo del governo
    add('cons','Consenso', S.ind&&S.ind.consenso);
    add('eco','Economia', economiaIndice());
    add('intl','Statura internazionale', relIntMean());
    if(famigliaPresente() && S.famiglia.serenita!=null) add('vita','Vita personale', S.famiglia.serenita);
  }
  return d;
}
function snapAnnuale(){ const dims={}; bilancioDims().forEach(x=>dims[x.key]=x.val); return { anno:S.year, livello:S.livello, dims:dims }; }
function dirBilancio(delta){ if(delta==null) return {s:T('nuovo'), a:'·', c:'var(--mut2)'}; if(delta>=3) return {s:T('in salita'), a:'↑', c:'var(--pos)'}; if(delta<=-3) return {s:T('in calo'), a:'↓', c:'var(--neg)'}; return {s:T('solida'), a:'→', c:'var(--mut)'}; }
/* verdetto d'insieme: onesto (anche "Un anno difficile"), mai punitivo. Tendenza media + livello medio. */
function verdettoBilancio(prev, dims){
  let nUp=0,nDown=0,sumDelta=0,nDelta=0,sumLev=0;
  dims.forEach(x=>{ sumLev+=x.val; const p=prev.dims[x.key]; if(p!=null){ const dl=x.val-p; sumDelta+=dl; nDelta++; if(dl>=3)nUp++; else if(dl<=-3)nDown++; } });
  const avgLev=dims.length?sumLev/dims.length:50, avgDelta=nDelta?sumDelta/nDelta:0;
  if(!nDelta) return {t:T('Un nuovo capitolo'), c:'var(--acc-ink)'};   // cambio di ruolo: nessun confronto omogeneo
  if(avgDelta>=2.5 || (nUp>nDown && avgLev>=58)) return {t:T('Un buon anno'), c:'var(--pos)'};
  if(avgDelta<=-3 || avgLev<38 || nDown>nUp+1) return {t:T('Un anno difficile'), c:'var(--neg)'};
  return {t:T('Luci e ombre'), c:'var(--warn-ink)'};
}
/* hook di gennaio (chiamato dal wrapper advanceMonth DOPO il render del mese). Idempotente per anno. */
function forseBilancio(){
  if(!S || S.month!==1) return;
  const over=document.getElementById('over'), ov=document.getElementById('ov');
  if(over && over.style.display!=='none') return;            // gameOver/congedo in corso → niente bilancio
  if(ov && ov.classList.contains('on')) return;             // un modale è aperto (election/primaria/trattativa) → non sovrapporre
  const cur=snapAnnuale(), prev=S.snapAnnuale;
  if(prev && prev.anno===cur.anno) return;                  // già fatto quest'anno
  S.snapAnnuale=cur;
  if(prev && prev.anno<cur.anno) mostraBilancio(prev, cur); // dal 2° gennaio in poi: confronto anno-su-anno
}
function mostraBilancio(prev, cur){
  const dims=bilancioDims(), verd=verdettoBilancio(prev, dims);
  if(typeof UIVALS!=='undefined') dims.forEach(x=>UIVALS['bar:bilancio:'+x.key]=0);   // le barre SALGONO da zero
  const rows=dims.map(function(x){
    const p=prev.dims[x.key], delta=(p!=null)?(x.val-p):null, dir=dirBilancio(delta);
    const col=x.val<33?'var(--neg)':x.val<60?'var(--warn)':'var(--pos)';
    return `<div class="bil-row"><div style="display:flex;justify-content:space-between;align-items:baseline;font-size:13px"><span>${x.nm}</span><span style="color:${dir.c};font-size:12px">${x.a||''}<b style="font-family:inherit">${dir.a}</b> ${dir.s}</span></div><div class="bar">${fillI('bilancio:'+x.key, clamp(x.val,2,100), col)}</div></div>`;
  }).join('');
  const pim=(typeof avatarImg==='function')?avatarImg(S.personaggio&&S.personaggio.avatar):null;
  const pav=pim?`<div class="hdr-avatar" style="width:46px;height:46px"><img src="${pim}" alt=""></div>`:'';
  document.getElementById('modal').innerHTML=`<div class="mt" style="display:flex;align-items:center;gap:11px">${pav}<div><div class="kicker">${T("Bilancio dell'anno")} · ${cur.anno-1}</div><h2>${T("L'anno che si chiude")}</h2></div></div>
    <div class="mtext" style="color:var(--mut2)">${T("Come è andato l'anno, in tendenza.")}</div>
    <div class="bil-rows" style="padding:2px 18px 4px">${rows}</div>
    <div class="bil-verdetto" style="padding:6px 18px 8px;font-family:'Fraunces',serif;font-style:italic;font-size:18px;color:${verd.c}">${verd.t}.</div>
    <div class="choices"><button class="opt" style="border-color:var(--brand)" onclick="chiudiBilancio()"><span class="ol">${T('Continua →')}</span></button></div>`;
  document.getElementById('ov').classList.add('on');
  try{ playAnims(); }catch(e){}   // vetrina: le barre salgono da 0 al valore (transform scaleX, 60fps)
}
function chiudiBilancio(){ document.getElementById('ov').classList.remove('on'); }   // presentazione: il mese è già reso sotto

/* --- Trattativa di coalizione (avvio e rielezione). Riusa l'overlay #ov/#modal. --- */
function openTrattativa(ctx){
  if(!S.seggi) S.seggi=calcSeggi();
  COAL={ctx, membri:[S.partito]};
  renderTrattativa();
}
function addAlly(id){ if(COAL && !COAL.membri.includes(id)) COAL.membri.push(id); renderTrattativa(); }
function removeAlly(id){ if(COAL && id!==S.partito) COAL.membri=COAL.membri.filter(x=>x!==id); renderTrattativa(); }
function renderTrattativa(){
  const seggi=S.seggi, mine=S.partito, ctx=COAL.ctx, voto=ctx==='voto';
  const confirmFn = voto?'finalizeVoto(true)' : ctx==='rinnovo'?'confirmRinnovo()' : 'confirmCoal()';
  const total=seggiCoalizione(COAL.membri, seggi);
  const cb=(ctx==='voto')?Math.round(credBonus()*10)/10:0;   // bonus credibilità: solo al voto vero (non avvio/rinnovo)
  const eff=total+cb;
  const comp=compatibili(mine, seggi).filter(p=>!COAL.membri.includes(p.id));
  const reached=eff>=50;
  const memberRows=COAL.membri.map(id=>{ const p=part(id), you=id===mine;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-top:1px solid var(--line)">
      <span style="font-weight:600;font-size:13.5px">${T(p.nome)} <small style="color:var(--mut2);font-weight:400">${you?T('· il tuo partito'):T(p.orientamento)}</small></span>
      <span class="mono" style="font-size:13px">${seggi[id]}${you?'':` <span onclick="removeAlly('${id}')" style="cursor:pointer;color:var(--neg);font-weight:700;padding:0 5px">×</span>`}</span></div>`; }).join('');
  const addRows=comp.map(p=>`<button class="opt" onclick="addAlly('${p.id}')"><span class="ol">+ ${T(p.nome)} <small style="color:var(--mut2);font-weight:400">${T(p.orientamento)}</small></span><span class="oe">${seggi[p.id]} ${T('seggi')}</span></button>`).join('');
  let action='';
  if(reached) action=`<button class="opt" style="border-color:var(--acc);background:var(--acc-bg)" onclick="${confirmFn}"><span class="ol" style="color:var(--acc-ink)">${T(voto?'Conferma la maggioranza':'Forma il governo')} →</span><span class="oe">${total} ${T('seggi')}${cb?` +${cb} ${T('credibilità')} → ${Math.round(eff)}`:' '+T('su 100')}</span></button>`;
  else if(comp.length===0) action= voto
      ? `<button class="opt" style="border-color:var(--neg)" onclick="finalizeVoto(false)"><span class="ol">${T('Nessuna maggioranza possibile')}</span><span class="oe">${T("Vedi l'esito del voto")}</span></button>`
      : `<button class="opt" style="border-color:var(--acc)" onclick="${confirmFn}"><span class="ol">${T('Governo di minoranza')} →</span><span class="oe">${T('solo %N seggi · sarà fragile').replace('%N',total)}</span></button>`;
  const kicker = voto?`${T(S.elezioniAnticipate?'Elezioni anticipate':'Elezioni')} ${S.year}` : T(ctx==='rinnovo'?'Nuovo mandato':'Formazione del governo');
  const titolo = T(voto?'Trattativa per il nuovo governo' : ctx==='rinnovo'?'Ricostruisci la maggioranza' : 'Forma la tua maggioranza');
  const mgFrase = (voto && S.margineEsito) ? `<b>${margineFraseTrattativa(S.margineEsito)}</b> ` : '';   // fase B: il verdetto delle urne prima della trattativa
  document.getElementById('modal').innerHTML=`<div class="mt"><div class="kicker">${T(PAESE.nome)} · ${kicker}</div><h2>${titolo}</h2></div>
    <div class="mtext">${mgFrase}${T('Servono <b>50 seggi</b> su 100. La tua coalizione ha')} <b class="mono" style="color:${reached?'var(--pos)':'var(--acc)'}">${total}</b> ${T('seggi')}${cb?` <b class="mono" style="color:${cb>=0?'var(--pos)':'var(--neg)'}">${cb>=0?'+':''}${cb}</b> ${T('dalla credibilità')} → <b class="mono">${Math.round(eff)}</b>`:''}.
      <div class="bar" style="margin-top:8px"><i style="width:${clamp(eff,2,100)}%;background:${reached?'var(--pos)':'var(--acc)'}"></i></div></div>
    <div style="padding:0 18px">${memberRows}</div>
    ${comp.length?`<div class="mtext" style="padding-bottom:4px">${T('Partiti compatibili da imbarcare (|asse|≤1):')}</div>`:''}
    <div class="choices">${addRows}${action}</div>`;
  document.getElementById('ov').classList.add('on');
}
function confirmCoal(){   // solo avvio: chiude e avvia la partita
  S.coalizione=COAL.membri.slice(); S.minoranza=seggiCoalizione(S.coalizione,S.seggi)<50; COAL=null;
  initTenuta(); initPotereLocale();   // ora il blocco (coalizione) è noto: fissa potere locale e aspettativa
  document.getElementById('ov').classList.remove('on'); render(); commitSnap();   // primo confine di mese (coalizione formata)
}
function finalizeVoto(win){   // rielezione parlamentare: porta alla schermata esito
  S.coalizione=COAL.membri.slice(); S.minoranza=false; const total=seggiCoalizione(S.coalizione,S.seggi); COAL=null;
  esitoSeggi(win, total);
}

/* ===== Passo 4 — fragilità della coalizione ===== */
/* Re-inizializza la tenuta degli alleati (luna di miele a 65, forza d'ingresso memorizzata). */
function initTenuta(){
  S.tenuta={}; S.tenutaForza0={}; S.tenutaLiv={}; S.tenutaUltimo={};
  if(!PAESE.coalizione) return;
  for(const id of (S.coalizione||[])) if(id!==S.partito){ S.tenuta[id]=65; S.tenutaForza0[id]=S.forze[id]; }
}
/* Rinnovo (candidato+coalizione, es. Francia): dopo il ballottaggio vinto si RICOSTRUISCE la maggioranza
   parlamentare sui seggi correnti. Qui non si perde: al peggio si riparte in minoranza nel nuovo mandato. */
function confirmRinnovo(){
  S.coalizione=COAL.membri.slice(); COAL=null;
  vinciElezione();   // governando → nextMandate; dall'opposizione → goAppoint → tornaAlGoverno
}
/* Probabilità mensile di mozione di sfiducia in minoranza: cresce coi mesi in minoranza e col consenso basso. */
function probSfiducia(){
  const D=dif(), m=S.mesiMinoranza||0, c=S.ind.consenso;
  return clamp(0.03*m*(1+Math.max(0,45-c)/45)*D.rischioSfiducia, 0, 0.40);
}
/* Carta di crisi di coalizione del mese (ultimatum o rottura), o null. Stesso pattern isteresi+raffreddamento
   degli eventi-fiducia, ma PER alleato. La rottura rimuove subito l'alleato (stato sempre coerente). */
function pickAlleato(){
  if(S.opposizione || !PAESE.coalizione || !S.tenuta) return null;
  const allies=S.coalizione.filter(id=>id!==S.partito);
  if(!allies.length) return null;
  const mese=S.year*12+S.month, MARG=8, RAFFR=6, sUlt=35, sRot=20;
  S.tenutaLiv=S.tenutaLiv||{}; S.tenutaUltimo=S.tenutaUltimo||{};
  // 1) rottura: un alleato sotto la soglia, non ancora annunciata
  for(const id of allies){
    if((S.tenuta[id]||0)<sRot && (S.tenutaLiv[id]||0)<2){
      S.tenutaLiv[id]=2;
      S.coalizione=S.coalizione.filter(x=>x!==id);
      delete S.tenuta[id]; delete S.tenutaForza0[id]; delete S.tenutaUltimo[id];
      S.minoranza=seggiCoalizione(S.coalizione,S.seggi)<50;
      const nome=part(id).nome, AE=ALLEATI_EV.rottura;   // (rinominata da T: oscurava la funzione i18n T())
      return { kind:'event', ally:id, data:{ kick:T(AE.kick), t:T(AE.t).replace(/%A/g,nome), text:T(AE.text).replace(/%A/g,nome),
        ch:[ {l:T(AE.ok.l), e:T(AE.ok.e), f:()=>{}} ] } };
    }
  }
  // 2) ultimatum: alleato in zona 20..35, con isteresi (riarmo sopra 35+MARG) e raffreddamento per alleato
  let cand=null;
  for(const id of allies){
    const t=S.tenuta[id]; if(t==null) continue;
    if((S.tenutaLiv[id]||0)>=1 && t>=sUlt+MARG) S.tenutaLiv[id]=0;              // riarmo con isteresi
    if(t<sUlt && t>=sRot && (S.tenutaLiv[id]||0)<1){
      if(S.tenutaUltimo[id]!=null && mese-S.tenutaUltimo[id]<RAFFR) continue;   // raffreddamento
      if(!cand || t<cand.t) cand={id, t};
    }
  }
  if(cand){
    const id=cand.id, p=part(id), nome=p.nome, base=p.base, AE=ALLEATI_EV.ultimatum;   // (rinominata da T: oscurava la funzione i18n T())
    S.tenutaLiv[id]=1; S.tenutaUltimo[id]=mese;
    return { kind:'event', ally:id, data:{ kick:T(AE.kick), t:T(AE.t).replace(/%A/g,nome), text:T(AE.text).replace(/%A/g,nome), ch:[
      { l:T(AE.concedi.l), e:T(AE.concedi.e), f:()=>{ for(const g in base) gd(g,4); S.ind.debt+=0.5; S.tenuta[id]=clamp((S.tenuta[id]||0)+18,0,100); } },
      { l:T(AE.rifiuta.l), e:T(AE.rifiuta.e), f:()=>{ const mb=mioPartito().base; for(const g in mb) gd(g,2); S.tenuta[id]=clamp((S.tenuta[id]||0)-18,0,100); } },
    ] } };
  }
  return null;
}

/* --- Schermate esito --- */
/* titolo del modale d'esito (fase B): DIREZIONE dal win reale (coerente coi bottoni), ENTITÀ dal margine. */
function titoloEsito(win){
  const a=Math.abs((S.margineEsito||{}).m||0);
  if(win) return T(a>=10?'Un trionfo':(a>=4?'Vittoria netta':'Vittoria di misura'));
  return T(a>=10?'Una valanga contraria':(a>=4?'Sconfitta netta':'Sconfitta di misura'));
}
/* riga-margine per la trattativa (Italia/Francia, contesto 'voto'): il verdetto delle urne prima della trattativa. */
function margineFraseTrattativa(mg){
  const F={trionfo:'Le urne ti premiano: un trionfo.', netta:'Le urne ti danno una vittoria netta.',
    misura:'Le urne ti lasciano un margine risicato.', sconfittaMisura:'Le urne ti puniscono di misura.',
    sconfittaNetta:'Le urne ti voltano le spalle: una sconfitta netta.', valanga:'Le urne ti travolgono.'};
  return T((mg&&F[mg.tag])||'');
}
function esitoSeggi(win, total){
  const seggi=S.seggi, ps=[...PAESE.partiti].sort((a,b)=>seggi[b.id]-seggi[a.id]);
  const rows=ps.map(p=>{ const gov=S.coalizione.includes(p.id);
    return `<div style="padding:6px 0">
      <div style="display:flex;justify-content:space-between;font-size:13px"><span style="font-weight:${gov?700:500}">${T(p.nome)} ${gov?'<span class="chip" style="background:var(--acc-bg);color:var(--acc-ink)">'+T('Governo')+'</span>':''}</span><span class="mono">${seggi[p.id]}</span></div>
      <div class="bar"><i style="width:${clamp(seggi[p.id],2,100)}%;background:${gov?'var(--acc)':'var(--mut2)'}"></i></div></div>`; }).join('');
  const cb=Math.round(credBonus()*10)/10;
  const cbTxt=(S.opposizione&&cb)?` (${cb>=0?'+':''}${cb} ${T('dalla credibilità')} → <b>${Math.round(total+cb)}</b>)`:'';
  const sub= win?T('La tua coalizione ottiene <b>%N seggi</b>%X su 100 e forma il governo.').replace('%N',total).replace('%X',cbTxt)
               :(S.opposizione?T('La tua coalizione si ferma a <b>%N seggi</b>%X: non basta a tornare al governo.').replace('%N',total).replace('%X',cbTxt)
                             :T("La tua coalizione si ferma a <b>%N seggi</b>: senza maggioranza, passi all'opposizione.").replace('%N',total));
  document.getElementById('modal').innerHTML=`<div class="mt"><div class="kicker">${T(S.elezioniAnticipate?'Elezioni anticipate':'Elezioni')} · ${S.year}</div><h2>${titoloEsito(win)}</h2></div>
    <div class="mtext">${sub}</div>
    <div style="padding:0 18px 6px">${rows}</div>
    <div class="choices"><button class="opt" style="border-color:${win?'var(--acc)':'var(--neg)'}" onclick="${win?'vinciElezione()':'perdiElezione()'}"><span class="ol">${T(win?(S.opposizione?'Torna al governo →':'Forma il nuovo governo →'):(S.opposizione?'Vedi il bilancio finale':'Vai all\'opposizione →'))}</span>${win&&!S.opposizione?`<span class="oe">${T('Mandato')} ${S.mandate+1}</span>`:''}</button></div>`;
  document.getElementById('ov').classList.add('on');
}
function esitoCandidato(r){
  const me=part(S.partito), myP=r.myPct, oppP=100-myP;
  document.getElementById('modal').innerHTML=`<div class="mt"><div class="kicker">${T(S.elezioniAnticipate?'Elezioni anticipate':'Elezioni')} · ${S.year}</div><h2>${titoloEsito(r.win)}</h2></div>
    <div class="mtext">${T('Testa a testa con <b>%O</b>: gli altri partiti si schierano per vicinanza politica.').replace('%O',T(r.opp.nome))}${(S.opposizione&&r.cb)?` ${T('Credibilità:')} <b style="color:${r.cb>=0?'var(--pos)':'var(--neg)'}">${r.cb>=0?'+':''}${Math.round(r.cb*10)/10}</b> ${T('punti')}.`:''}</div>
    <div style="padding:0 18px 6px">
      <div style="padding:6px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="font-weight:700">${T(me.nome)} <span class="chip" style="background:var(--acc-bg);color:var(--acc-ink)">${T('tu')}</span></span><span class="mono">${fmt(myP,1)}%</span></div>
        <div class="bar"><i style="width:${clamp(myP,2,100)}%;background:var(--acc)"></i></div></div>
      <div style="padding:6px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="font-weight:600">${T(r.opp.nome)}</span><span class="mono">${fmt(oppP,1)}%</span></div>
        <div class="bar"><i style="width:${clamp(oppP,2,100)}%;background:var(--mut2)"></i></div></div></div>
    <div class="choices"><button class="opt" style="border-color:${r.win?'var(--acc)':'var(--neg)'}" onclick="${r.win?(PAESE.coalizione?"openTrattativa('rinnovo')":'vinciElezione()'):'perdiElezione()'}"><span class="ol">${T(r.win?(PAESE.coalizione?'Ricostruisci la maggioranza →':(S.opposizione?'Torna al governo →':'Resta in carica →')):(S.opposizione?'Vedi il bilancio finale':'Vai all\'opposizione →'))}</span>${r.win&&!PAESE.coalizione&&!S.opposizione?`<span class="oe">${T('Mandato')} ${S.mandate+1}</span>`:''}</button></div>`;
  document.getElementById('ov').classList.add('on');
}
function nextMandate(){
  maturaRP();   // qui passa il confine di mese quando si vota: formula del mese in cui cade (gennaio→iniezione, anticipate a metà anno→+1). PRIMA del reset snapshot.
  S.mandatesWon++; S.mandate++; S.turnInMandate=0; S.snap=Object.assign({},S.pol); S.leggiSnap=Object.assign({},S.leggi);
  if(PAESE.comeSiVince==='parlamentare'||PAESE.coalizione) S.seggi=calcSeggi();
  S.minoranza = PAESE.coalizione ? seggiCoalizione(S.coalizione,S.seggi)<50
              : (PAESE.comeSiVince==='parlamentare' ? S.seggi[S.partito]<50 : false);
  S.mesiMinoranza=0; S.elezioniAnticipate=false; S.mesiAlGoverno=Math.round((S.mesiAlGoverno||0)/2); initTenuta(); S.bloccoAtteso=bloccoQuota(); S.ultimoSondaggio=null; S.sondStorico=[];   // vittoria: logorio dimezzato; aspettativa ri-allineata al nuovo blocco (potere locale persiste)
  S.campNaz=null; S.campNazUltimo=null;   // Cantiere C: la stagione si chiude col voto (le promesseCampagna PERSISTONO: resa dei conti alla prossima)
  tutteCorrenti(8);   // la vittoria ricompatta il partito
  bioConta('elezioniVinte'); bioFatto(gn('Rieletto','Rieletta')+': comincia il mandato '+S.mandate+'.');
  S.log.unshift({t:gn('Rieletto','Rieletta'),x:T(S.minoranza?'Inizia il mandato %N — governo di minoranza.':'Inizia il mandato %N.').replace('%N',S.mandate)});
  document.getElementById('ov').classList.remove('on');
  genAgenda(false); generaTitolo(); render(); commitSnap();
}

/* ===== Opposizione: perdere le elezioni non è più game over ===== */
function vincitore(){ return PAESE.partiti.filter(p=>p.id!==S.partito).sort((a,b)=>(S.forze[b.id]||0)-(S.forze[a.id]||0))[0]; }
function vinciElezione(){ if(S.opposizione) goAppoint(); else nextMandate(); }   // dall'opposizione si ri-nominano i ministri
function perdiElezione(){ if(S.opposizione) gameOver('congresso'); else goOpposizione(); }
/* Stato d'opposizione: governa il vincitore w (col suo profilo-politiche), tu passi a sfidante. Solo stato:
   nessun log/genAgenda/commit (li fa il chiamante) né potere locale (persiste alla sconfitta, si ri-fissa all'avvio).
   Condiviso da goOpposizione (sconfitta) e startOpposizione (avvio da sfidante). */
function entraOpposizione(w){
  S.opposizione=true; S.governoAvversario=w.id; S.ministers=[];
  S.coalizione=[w.id].concat(PAESE.coalizione?compatibili(w.id,S.seggi).filter(p=>p.id!==S.partito).map(p=>p.id):[]);
  S.tenuta={}; S.tenutaForza0={}; S.tenutaLiv={}; S.tenutaUltimo={}; S.minoranza=false; S.mesiMinoranza=0;
  S.visibilita=40; S.credibilita=50; S.recentGov=[]; S.mesiAlGoverno=0;   // variabili d'opposizione; la traversata del deserto azzera il logorio
  S.lineaMedia=S.lineaMedia||'documentata';   // la linea coi media (dato puro; i salvataggi senza campo migrano al default)
  if(S.archi) S.archi=S.archi.filter(function(a){ const A=ARCHI_DEF.find(function(d){return d.id===a.id;}); return A && (A.dove||'governo')==='entrambi'; });   // gli archi di GOVERNO non sopravvivono alla caduta; i personali sì (lotto 5)
  const prof = w.asse>=1?'destra' : w.asse<=-1?'sinistra' : 'centro';
  S.pol=Object.assign({},GOVERNI_PROFILI[prof]); S.snap=Object.assign({},S.pol); S.leggiSnap=Object.assign({},S.leggi);   // eredita le politiche dell'avversario, contabilità RP pulita
  S.turnInMandate=0; S.elezioniAnticipate=false; S.ultimoSondaggio=null; S.sondStorico=[];
}
/* Vai all'opposizione DOPO una sconfitta: governa il vincitore; il motore fa il resto. */
function goOpposizione(){
  const w=vincitore();
  entraOpposizione(w);
  S.campNaz=null; S.campNazUltimo=null;   // Cantiere C: stagione chiusa anche in sconfitta (le promesse restano: da sfidante non le puoi tradire — la resa le premierà)
  S.bloccoAtteso=bloccoQuota();   // aspettativa = quota del tuo blocco d'opposizione (potere locale persiste)
  bioFatto(gn('Sconfitto','Sconfitta')+' alle urne: comincia la traversata del deserto.');
  S.log.unshift({t:T('All\'opposizione'),x:T('Hai perso le elezioni: ora governa %P. Prepara la rivincita.').replace('%P',T(w.nome))});
  document.getElementById('ov').classList.remove('on');
  genAgenda(false); render(); commitSnap();
}
/* Condanna LIEVE al governo (lotto 3): dimissioni forzate → opposizione, ma segnato — l'esposizione
   resta a 60 e cala solo col tempo (−1/mese): la finestra per ripulirsi esiste (sotto 55 in 6 mesi,
   ben dentro il raffreddamento di 12), ma la rimonta è più dura. Il bioFatto lo scrive il chiamante. */
function condannaLieve(){
  const w=vincitore();
  entraOpposizione(w);
  S.bloccoAtteso=bloccoQuota();
  S.log.unshift({t:T('All\'opposizione'),x:T('Dimissioni dopo la condanna: governa %W. La rimonta parte da qui, col marchio addosso.').replace('%W',w.nome)});
  document.getElementById('ov').classList.remove('on');
  genAgenda(false); render(); commitSnap();
}
/* Torna al governo (dopo la nomina dei ministri dall'opposizione): nessuno strascico dall'era avversaria. */
function tornaAlGoverno(mins){
  S.ministers=mins; S.opposizione=false; S.governoAvversario=null;
  S.mesiSottoCrisi=0; S.fidLivello=0; S.fidUltimo={};        // azzera i contatori del governo precedente
  S.snap=Object.assign({},S.pol);                             // contabilità RP pulita: erediti le politiche e le cambi coi tuoi punti
  bioConta('elezioniVinte'); bioFatto('La rimonta è completa: di nuovo al governo.');
  S.log.unshift({t:'Al governo',x:'Hai vinto le elezioni: torni a guidare il paese.'});
  document.getElementById('appoint').style.display='none';
  document.getElementById('game').style.display='block';
  nextMandate();   // mandato pieno: ricalcola seggi/minoranza/tenuta, ri-snap S.snap, agenda, render
}
/* --- Opposizione viva: visibilità/credibilità, carte differenziate, eventi del governo avversario --- */
/* Applica uno spec d'azione {vis,cred,gov,base,centro}. L'erosione dei gruppi del GOVERNO scala da visibilità E
   credibilità (un'opposizione screditata non sposta nessuno → anti-spam); tua base e centro dalla sola visibilità. */
/* LA LINEA COI MEDIA (lotto stampa-opposizione): come la STESSA mossa si traduce in visibilità/credibilità —
   cambia la resa, non la scarsità (nessuna seconda mossa). Default 'documentata' = ×1 su tutto → il comportamento
   di oggi, e i salvataggi senza campo migrano da sé (lineaMedia() cade sul default). Cambiabile ogni mese, gratis. */
function lineaMedia(){ return (S && S.lineaMedia) || 'documentata'; }
function lineaMediaMod(){
  const l=lineaMedia();
  if(l==='attacco')       return {vp:1.5, vm:1, cp:0.25, cm:1.25};   // visibilità forte; la credibilità quasi non cresce e si espone di più
  if(l==='istituzionale') return {vp:0.5, vm:1, cp:1.4,  cm:0.75};   // credibilità su e protetta; visibilità dimezzata
  return {vp:1, vm:1, cp:1, cm:1};                                    // documentata = oggi (baseline)
}
function applyOppEffect(spec){
  const me=S.partito, base=part(me).base;
  const govBase={}; (S.coalizione||[]).forEach(function(id){ const pb=(part(id)||{}).base||{}; for(const g in pb) govBase[g]=(govBase[g]||0)+pb[g]; });
  const aV=0.5+(S.visibilita||0)/100, aC=0.4+(S.credibilita||0)/100;   // amplificazioni (lette PRIMA dei delta)
  if(spec.gov)    for(const g in govBase) gd(g, spec.gov*aV*aC);
  if(spec.base)   for(const g in base)    gd(g, spec.base*aV);
  if(spec.centro) gd('cetomedio', spec.centro*aV);
  const LM=lineaMediaMod();   // la linea modula SOLO la resa vis/cred della mossa (gov/base/centro restano: la linea li tocca nel tempo, via aV/aC)
  if(spec.vis)  S.visibilita=clamp((S.visibilita||0)+spec.vis*(spec.vis>0?LM.vp:LM.vm),0,100);
  if(spec.cred) credMuovi(spec.cred*(spec.cred>0?LM.cp:LM.cm));   // L26-1: la linea-media modula PRIMA, il soft-cap attenua DOPO (un solo punto di passaggio)
}
/* Carta d'opposizione del mese: cornice + le 3 azioni SPECIFICHE della carta (spec→closure). */
function pickOpposizione(){
  S.recentOpp=S.recentOpp||[];
  const ok=i=>(!OPPOSIZIONE_EV[i].cond || OPPOSIZIONE_EV[i].cond()) && (typeof eraVivaT!=='function'||eraVivaT(OPPOSIZIONE_EV[i]));   // FIX: era-gate anche il percorso opposizione (default eraVivaT: l'opposizione è senza-tempo; i moderni TV → contemporanea). Prima nel '50 usciva «il duello in TV»
  let pool=OPPOSIZIONE_EV.map((e,i)=>i).filter(i=>ok(i)&&!S.recentOpp.includes(i));
  if(!pool.length) pool=OPPOSIZIONE_EV.map((e,i)=>i).filter(ok);   // tutte recenti → ignora la finestra (ma rispetta la cond)
  if(!pool.length) return null;
  const idx=rnd(pool); S.recentOpp.push(idx); if(S.recentOpp.length>17) S.recentOpp.shift();   // D2: finestra 5→17 (pool 28+): una carta non torna prima di 18 pescate ⇒ max 2× in 36 mesi, garantito
  const ev=OPPOSIZIONE_EV[idx];
  /* porta pleases/rischio/trasparenza attraverso la map → il ramo `dossier` di resolveItem alimenta
     biografia/tratti/integrità/esposizione come per gli altri livelli (prima l'opposizione era muta). */
  return { kick:ev.kick, t:ev.t, text:ev.text, ch: ev.ch.map(function(c){ return { l:c.l, e:c.e, pleases:c.pleases, rischio:c.rischio, trasparenza:c.trasparenza, f:function(){ applyOppEffect(c); } }; }) };
}
/* ===== L25-2 + L25-3 — LE FAMIGLIE D'OPPOSIZIONE E IL LORO ARBITRO =====
   Due famiglie (α2 «ai fianchi sui media», α3 «allargare la base») con un innesco DEDICATO: dentro
   OPPOSIZIONE_EV (35 voci) sarebbero uscite ~3 volte in 36 mesi, cioè una all'anno. Si prendono lo STESSO
   slot della carta d'opposizione (stesso `kind:'dossier'`, stesso posto in agenda) → la FORMA del mese non
   cambia di una riga, cambia cosa ci trovi dentro.

   PERCHÉ UN ARBITRO E NON DUE INNESCHI (L25-3): lo slot esiste in ~56 mesi su 100, e due famiglie con
   cadenza propria ne chiederebbero più di quanti ne esistano — il pool storico resterebbe a secco. Quindi
   UN solo gate (pavimento + tiro) e poi un sacchetto che ALTERNA le famiglie: la quota complessiva è sotto
   controllo in un punto solo, e il pool storico conserva la sua fetta. Le cadenze delle singole famiglie
   sono una CONSEGUENZA di questa divisione, non due manopole indipendenti. */
const FAM_OPP = [{id:'media'},{id:'base'}];
function famigliaOppDovuta(){
  if(!S.opposizione) return false;
  const mese=S.year*12+S.month;
  if(S.famOppUltimo!=null && (mese-S.famOppUltimo)<2) return false;   // pavimento: mai due mesi di fila
  return Math.random()<0.85;                                          // tarato sulla misura (vedi CODA-LAVORI L25-3)
}
function pickFamigliaOpp(){
  const f=pescaBag('oppfam', FAM_OPP); if(!f) return null;
  const c=(f.id==='base') ? pickBase() : pickMedia();
  if(c) S.famOppUltimo=S.year*12+S.month;
  return c;
}
/* Applica una scelta di famiglia: lo spec (applyOppEffect) + gli effetti locali (extra) + l'ESITO
   CONDIZIONATO di α2. `regge` legge la CREDIBILITÀ (pattern-snodo: stato dentro f(), niente caso): sotto la
   soglia il governo risponde bene e metà del colpo torna indietro — restituito PER LA STESSA STRADA
   (applyOppEffect), così l'amplificazione vis/cred è la medesima dell'andata e «metà» resta metà davvero.
   Le carte-base non hanno `regge`: il loro prezzo sono le correnti, e sta tutto in `extra`. */
function oppFamApplica(c){
  applyOppEffect(c);
  if(c.extra) c.extra();
  if(c.regge){
    if((S.credibilita||0)>=MEDIA_REGGE){
      credd(1);
      S.log.unshift({t:T('L\'attacco regge'), x:T('Il governo prova a smontarlo e non ci riesce: la denuncia resta in piedi.')});
    } else {
      applyOppEffect({gov: -(c.gov||0)/2});
      credd(-c.regge);
      S.log.unshift({t:T('Il colpo torna indietro'), x:T('Il governo risponde bene e la tua parola non basta a reggerlo: metà del colpo ti torna indietro.')});
    }
  }
}
function pickFamCarta(pool, chiave){
  if(!pool) return null;
  const cand=pool.filter(function(e){ return (!e.cond||e.cond()) && (typeof eraVivaT!=='function'||eraVivaT(e)); });
  const ev=pescaBag(chiave, cand); if(!ev) return null;
  return { id:ev.id, kick:ev.kick, t:ev.t, text:ev.text, ch: ev.ch.map(function(c){ return { l:c.l, e:c.e, pleases:c.pleases, rischio:c.rischio, trasparenza:c.trasparenza, f:function(){ oppFamApplica(c); } }; }) };
}
function pickMedia(){ return pickFamCarta(typeof OPPOSIZIONE_MEDIA!=='undefined'?OPPOSIZIONE_MEDIA:null, 'oppmedia'); }
function pickBase(){  return pickFamCarta(typeof OPPOSIZIONE_BASE !=='undefined'?OPPOSIZIONE_BASE :null, 'oppbase'); }
/* Evento del governo avversario: pesca una variante (rispettando cond e recentGov); scandalo con ministro fittizio. */
function pickGovernoEvent(){
  S.recentGov=S.recentGov||[];
  const ok=i=>(!GOVERNO_EV[i].cond || GOVERNO_EV[i].cond()) && (typeof eraVivaT!=='function'||eraVivaT(GOVERNO_EV[i]));   // FIX: era-gate anche gli eventi del governo-AI
  let pool=GOVERNO_EV.map((e,i)=>i).filter(i=>ok(i)&&!S.recentGov.includes(i));
  if(!pool.length) pool=GOVERNO_EV.map((e,i)=>i).filter(ok);
  if(!pool.length) return null;
  const idx=rnd(pool); S.recentGov.push(idx); if(S.recentGov.length>8) S.recentGov.shift();   // D2: finestra 3→8 (pool 12): niente terzo passaggio ravvicinato
  const ev=GOVERNO_EV[idx], govNm=(part(S.governoAvversario)||{}).nome||T('il governo');
  let t=T(ev.t||'').replace(/%G/g,govNm), text=T(ev.text||'').replace(/%G/g,govNm);   // i18n: T() sul template, PRIMA dei replace (%G/%M intatti)
  if(ev.scandalo){ const m=rnd(PAESE.nomi)+' '+rnd(PAESE.cognomi), sc=rnd(SCANDALI); t=t.replace(/%M/g,m); text=m+' ('+T('ministro di %G').replace('%G',govNm)+') '+T(sc.text); }
  return { kick:ev.kick, t:t, text:text, ch: ev.reactions.map(function(c){ return { l:c.l, e:c.e, f:function(){ applyOppEffect(c); } }; }) };
}
/* Bonus/malus della credibilità al voto (solo in opposizione): (credibilità−50)×0,1 punti percentuali. */
function credBonus(){ return S.opposizione ? (S.credibilita-50)*0.1 : 0; }

/* ===== Leggi (riforme on/off, distinte dalle politiche a cursore) ===== */
function leggiDelPaese(){ return (typeof LEGGI==='undefined')?[]:LEGGI.filter(L=> (!L.paesi || L.paesi.indexOf(S.paese)>-1) && (typeof eraVivaT!=='function' || eraVivaT(L))); }   // Build B: eraVivaT (default universale) — le leggi moderne (matrimonio/droghe/reddito_citt…) non compaiono nel '50
/* Approva/abroga una legge: paga gli RP, applica gli effetti, fa reagire la coalizione. */
function setLegge(id){
  if(S.opposizione) return;                                            // all'opposizione non si legifera
  const L=LEGGI.find(x=>x.id===id); if(!L) return;
  if(S.livello===2 && L.min!==S.dicastero) return;                     // da ministro: solo le leggi del TUO dicastero
  const cur=!!S.leggi[id];
  S.leggi[id]=!cur; const over=rpUsed()>curRpMax(); S.leggi[id]=cur;   // prova il costo RP del toggle
  if(over) return;                                                     // punti riforma insufficienti
  applicaLegge(L, !cur);
  S.ultimaLegge={id:L.id, mese:S.year*12+S.month};                     // traccia per la conferenza stampa ("la legge contestata")
  /* biografia: le leggi col tuo nome */
  if(!cur){ bioConta('leggi'); if(S.biografia && S.biografia.leggiFirmate.indexOf(L.nome)<0) S.biografia.leggiFirmate.push(L.nome);
    bioFatto('Vara la legge: '+L.nome+'.');
    const p=part(S.partito); if(p && p.asse!==0 && L.asse!==0 && (L.asse>0)===(p.asse>0)) bioConta('identita');   // legge coerente con l'anima del partito
  } else { bioFatto('Abroga la legge: '+L.nome+'.'); }
  render();
}
function applicaLegge(L, approva){
  const seg=approva?1:-1;
  if(L.unaTantum && L.unaTantum.grp) for(const g in L.unaTantum.grp) gd(g, seg*L.unaTantum.grp[g]);   // scossone una tantum (invertito in abrogazione)
  S.leggi[L.id]=approva;
  if(S.coalizione && S.tenuta) for(const id of S.coalizione){ if(id===S.partito) continue;
    const align=1-Math.abs(part(id).asse - L.asse);                    // vicino gratifica, lontano infuria (cresce con la distanza)
    if(S.tenuta[id]!=null) S.tenuta[id]=clamp(S.tenuta[id]+seg*6*align, 0, 100);
  }
  S.ind.consenso=computeConsenso();
  S.log.unshift({t:(approva?'Legge approvata':'Legge abrogata'), x:L.nome+'.'});
}
function gameOver(reason){
  try{ aggiungiCarriera(reason); }catch(e){} chiudiAutosave();   // carriera chiusa: aggiorna lo storico e cancella l'autosave (niente "Continua")
  document.getElementById('ov').classList.remove('on');
  const years=S.year-(S.annoInizio||2025);
  const title= T(reason==='crisi'?'Crisi di governo' : reason==='insolvenza'?'Il paese è insolvente' : reason==='congresso'?'Il partito sceglie un nuovo leader' : reason==='primaria'?'Il partito sceglie lo sfidante' : reason==='ritiro'?'Il congedo' : reason==='condanna'?'La condanna' : reason==='salute'?(S.esitoSalute==='fatale'?'L\'ultimo giorno':'Le ragioni della salute') : reason==='silurato'?'Fuori dal governo' : reason==='sconfittaLocale'?'Sconfitta alle urne locali' : reason==='mandatoInt'?'Fine del mandato internazionale' : 'Fine del percorso');
  const desc= reason==='crisi'?T('Una mozione di sfiducia ha fatto cadere il governo: il consenso era crollato.')
    : reason==='insolvenza'?T('I conti pubblici sono fuori controllo: nessuno finanzia più il debito. Il governo cade travolto dalla crisi finanziaria.')
    : reason==='congresso'?T('Troppe sconfitte e una forza ridotta all\'osso: il tuo partito ti sostituisce alla guida. La tua carriera politica finisce qui.')
    : reason==='primaria'?T('I militanti scelgono <b>%V</b>%X. Il partito volta pagina: la tua carriera politica finisce qui.').replace('%V',(S.sfida||{}).volto||T('lo sfidante')).replace('%X',(S.sfida&&S.sfida.area)?(', '+S.sfida.carica+' — '+S.sfida.area):'')
    : reason==='ritiro'?T('A %E anni annunci il ritiro a vita privata. Nessuna caduta: un congedo, e la parola passa alla storia.').replace('%E',S.eta)
    : reason==='condanna'?T('Il collegio legge il dispositivo: condanna. Le scelte che l\'hanno resa possibile portano la tua firma. La carriera politica finisce in tribunale.')
    : reason==='salute'?(S.esitoSalute==='fatale'
        ? T('Avevi ignorato ogni avvertimento. Il corpo ha presentato il conto, e stavolta non c\'è stato ritorno. La corsa finisce qui, a %E anni.').replace('%E',S.eta)
        : T('A %E anni scegli la vita prima della carica: ti ritiri per ragioni di salute. Nessuna sconfitta — una resa serena a ciò che conta davvero.').replace('%E',S.eta))
    : reason==='silurato'?T('Ti sei distinto una volta di troppo: il premier ti estromette dal governo in un rimpasto. L\'ambizione, senza la pazienza, ti è costata il posto. La carriera finisce qui.')
    : reason==='sconfittaLocale'?T('Gli elettori %DL non ti riconfermano: un mandato amministrato male si paga alle urne. La carriera politica si ferma sul primo gradino.').replace('%DL',S.locale?diLuogo(S.locale.nome):T('locali'))
    : reason==='mandatoInt'?T('I membri delle Nazioni Unite non ti riconfermano: la coesione si era logorata sotto la tua guida. Il mandato al vertice del mondo finisce qui — ma resta nella storia chi ci è arrivato.')
    : T('Hai perso le elezioni e passi all\'opposizione.');
  const epilogo=generaEpilogo(reason).map(function(p){return '<p style="margin:7px 0">'+p+'</p>';}).join('');
  const scF=(typeof scenaFinale==='function')?scenaFinale(reason):null;   // L9-1: scena d'esito (trionfo/dignità/caduta/oblio) sopra la bandiera
  const scFimg=scF?`<img class="mscene" src="${scF}" alt="" style="max-width:440px;max-height:200px;margin:6px auto 2px;border-radius:14px">`:'';
  document.getElementById('over').innerHTML=`${scFimg}<div style="text-align:center;padding-top:14px"><span class="flag" style="width:54px;height:36px;display:inline-block">${PAESE.flag||''}</span></div>
   <div class="screen center"><div class="em">${T('Fine partita')}</div><h2>${title}</h2><p>${desc}</p>
   <div style="text-align:left;max-width:430px;margin:12px auto 4px;font-size:13.5px;line-height:1.5;color:var(--txt2);border-top:1px solid var(--line);padding-top:12px">
     <div style="font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--mut);margin-bottom:6px">${T('La tua storia')}</div>${epilogo}</div>
   <div class="statgrid">
     <div class="s"><div class="l">${T('Anni al governo')}</div><div class="v">${years}</div></div>
     <div class="s"><div class="l">${T('Mandati vinti')}</div><div class="v">${S.mandatesWon}</div></div>
     <div class="s"><div class="l">${T('Debito / PIL')}</div><div class="v">${fmt(S.ind.debt,0)}%</div></div>
     <div class="s"><div class="l">${T('Consenso finale')}</div><div class="v">${fmt(S.ind.consenso,0)}%</div></div>
     <div class="s"><div class="l">${T('Crescita PIL')}</div><div class="v">${sign(S.ind.growth,1)}%</div></div>
     <div class="s"><div class="l">${T('Disoccupazione')}</div><div class="v">${fmt(S.ind.unemp,1)}%</div></div>
     <div class="s"><div class="l">${T('Fiducia mercati')}</div><div class="v">${fmt(S.ind.fiducia,0)}</div></div>
   </div>
   <button class="btn" onclick="resetAll()">${T('Gioca di nuovo')}</button></div>`;
  document.getElementById('game').style.display='none';
  document.getElementById('over').style.display='block';
}
function resetAll(){
  document.getElementById('over').style.display='none';
  document.getElementById('start').style.display='block';
}

/* ============================================================
   PERSISTENZA — carriere lunghe (localStorage). TUTTI i salvataggi sono la fotografia dell'ULTIMO confine
   di mese (lastSnap): l'agenda (closure) non si serializza mai, si RIGENERA al caricamento. Anti-exploit:
   anche il salvataggio manuale scrive lastSnap, mai lo stato a metà mese → ricaricare rigioca il mese da capo.
   Formato {v:VERSIONE, s:<S senza agenda>}. Ogni accesso a localStorage è protetto: degrada con grazia.
   ============================================================ */
const SAVE_VERSION = 1;
let lastSnap = null;
function storageOK(){ try{ localStorage.setItem('__hos_t','1'); localStorage.removeItem('__hos_t'); return true; }catch(e){ return false; } }
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } }
function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
function snapshot(){ const c=Object.assign({},S); c.agenda=[]; c.ministeroAperto=null; c.mappaAperta=null; c.partitoAperto=null; return JSON.parse(JSON.stringify({v:SAVE_VERSION, s:c})); }   // deep, indipendente, senza funzioni
function commitSnap(){ if(!S) return; lastSnap=snapshot(); lsSet('hos_autosave', JSON.stringify(lastSnap)); }   // confine di mese: aggiorna fotografia + autosave
function aMetaMese(){ return !!(S && S.agenda && S.agenda.some(function(a){return a.resolved;})); }   // ci sono carte già risolte questo mese?
function parseSave(text){
  let o; try{ o=JSON.parse(text); }catch(e){ return {err:'Testo non leggibile (JSON non valido).'}; }
  if(!o || typeof o!=='object' || !o.s || typeof o.s!=='object') return {err:'Non è un salvataggio di Head of State.'};
  const s=o.s;
  if(!s.paese || !PAESI[s.paese] || !s.partito || !s.forze || !s.ind || s.year==null) return {err:'Salvataggio incompleto o corrotto.'};
  if(o.v!==SAVE_VERSION) return {ok:true, save:o, warn:'Salvataggio di una versione diversa (v'+(o.v||'?')+' ≠ v'+SAVE_VERSION+'): provo a caricarlo.'};
  return {ok:true, save:o};
}
function applySnap(snap){
  S = snap.s;
  chosenCountry=S.paese; PAESE=PAESI[S.paese]; chosenPartito=S.partito; chosenDiff=S.diff||'normale';
  /* Build B — era: dato puro (migrazione: i vecchi salvataggi non ce l'hanno → presente). Se è attivo uno
     scenario d'epoca, ri-sovrapponi la sua lista-partiti al PAESE base (S.forze è già nello snapshot). */
  if(S.era===undefined) S.era=null;
  /* L30-1 - MIGRAZIONE DEL NOME DELLA LINEA: prima si chiamava come il suo primo decennio. */
  if(S.era==='italia1950') S.era=LINEA_IT;
  /* L30-1 - MIGRAZIONE dello scenario: i salvataggi vecchi non hanno S.scenario. Sulla linea storica lo si
     inferisce dall ANNO (un salvataggio con anno <1970 e per forza partito dal '50); fuori linea, presente. */
  if(S.scenario===undefined) S.scenario = S.era ? ((S.year!=null && S.year>=1970) ? 'italia1970' : 'italia1950') : 'presente';
  chosenScenario='presente';
  /* Si cerca per SCENARIO, non piu per era: due scenari possono condividere la linea, e il primo che combaciava
     vinceva in silenzio (un salvataggio del '70 tornava su come partita del '50, col roster del 1948). */
  if(S.era && typeof SCENARI!=='undefined'){
    var _sc = SCENARI[S.scenario];
    if(!_sc || _sc.era!==S.era){ _sc=null; for(var _sk in SCENARI){ if(SCENARI[_sk].era===S.era){ _sc=SCENARI[_sk]; S.scenario=_sk; break; } } }   // ripiego: scenario ignoto o incoerente
    if(_sc){ chosenScenario=S.scenario; PAESE=paeseConScenario(PAESE, _sc); }
  }
  /* L34-1 - IL PUNTO CHE DECIDE TUTTO: PAESE e appena stato ricostruito dallo scenario, quindi senza questa
     riga ogni nascita/morte/rinomina si dissolverebbe al caricamento. Il registro vive in S, si riapplica qui. */
  if(!S.rosterDelta || typeof S.rosterDelta!=='object') S.rosterDelta={entra:[], esce:[], rinomina:[]};   // migrazione salvataggi pre-L34-1
  S.rosterDelta.entra=S.rosterDelta.entra||[]; S.rosterDelta.esce=S.rosterDelta.esce||[]; S.rosterDelta.rinomina=S.rosterDelta.rinomina||[];
  if(typeof applicaRosterDelta==='function') applicaRosterDelta();
  if(true){
  }
  if(S.truffaFatta===undefined){ S.truffaFatta=false; S.truffaEsito=null; }   // Build B 1b — snodo one-shot: default per i salvataggi pre-1b
  if(S.riallineamenti===undefined) S.riallineamenti={};   // AVANZAMENTO — migrazione: i salvataggi pre-lotto ricevono il registro-tappe vuoto
  if(S.apertura===undefined){ S.apertura=null; S.aperturaEsito=null; S.enel=null; }   // AVANZAMENTO Lotto 4 — migrazione snodi '60
  if(S.austerity===undefined){ S.austerity=null; S.divorzio=null; S.solidarieta=null; }   // L28-3 — migrazione snodi '70
  if(S.divorzioBdi===undefined){ S.divorzioBdi=null; S.scalaMobile=null; S.nucleare=null; }   // L33-1 — migrazione snodi '80
  if(!S.pilastri70 || typeof S.pilastri70!=='object') S.pilastri70={};   // L28-4 — migrazione pilastri '70
  /* L40-2 — i nuovi flag del '90: dato puro, migrazione per i salvataggi anteriori al lotto */
  if(S.maastricht===undefined) S.maastricht=null;
  if(S.maastrichtEsito===undefined) S.maastrichtEsito=null;
  if(S.mattarellum===undefined) S.mattarellum=null;
  if(S.questioneMorale===undefined) S.questioneMorale=null;
  if(S.scissione===undefined) S.scissione=null;
  if(S.scissioneFatta===undefined) S.scissioneFatta=false;
  if(S.diaspora===undefined) S.diaspora=null;       // L41-1 — i tre gemelli della frana
  if(S.crolloPsi===undefined) S.crolloPsi=null;
  if(S.fiuggi===undefined) S.fiuggi=null;
  if(S.porcellum===undefined) S.porcellum=null;         // L44-2 — gli ultimi snodi della linea
  if(S.porcellumEsito===undefined) S.porcellumEsito=null;
  if(S.crisi08===undefined) S.crisi08=null;
  if(S.fusionePd===undefined) S.fusionePd=null;
  if(S.fusionePdl===undefined) S.fusionePdl=null;
  if(S.fuoriAula===undefined) S.fuoriAula=null;
  if(S.fuoriAulaEsito===undefined) S.fuoriAulaEsito=null;
  if(S.richiamoCorrUltimo===undefined) S.richiamoCorrUltimo=null;   // CURA Lotto P3 — migrazione cooldown richiamo correnti
  if(S.sondStorico===undefined) S.sondStorico=[];   // F3 — migrazione: i salvataggi pre-lotto ricevono la serie-sondaggi vuota
  if(S.leggeroUltimo===undefined) S.leggeroUltimo=null;   // G4 — migrazione: cooldown del beat leggero
  if(S.retroUltimo===undefined) S.retroUltimo=null;       // L14-1 — migrazione: cooldown del beat-retroscena
  if(!S.intese || typeof S.intese!=='object') S.intese={};   // L25-1 — migrazione: nessuna intesa nei salvataggi vecchi
  if(S.tavoloPid===undefined) S.tavoloPid=null;              // L25-1 — migrazione
  /* L25-3 — migrazione: il cooldown della sola famiglia-media diventa quello CONDIVISO da tutte le famiglie.
     Un salvataggio L25-2 porta con sé `mediaUltimo`: lo si eredita (non si riparte da zero) e lo si toglie. */
  if(S.famOppUltimo===undefined) S.famOppUltimo=(S.mediaUltimo!=null?S.mediaUltimo:null);
  if('mediaUltimo' in S) delete S.mediaUltimo;
  /* L20-1 — migrazione dei volti: un gabinetto salvato prima di oggi non ha `rit`. Si assegna UNA volta in blocco
     (ognuno dal suo hash, cedendo il passo) e da lì è congelato: il giocatore vede il de-dup senza che i volti
     ballino a ogni caricamento. Chi ha già `rit` non viene toccato. */
  if(S.ministers && S.ministers.length && typeof assegnaVoltiGruppo==='function' && S.ministers.some(function(m){ return !m.rit; })){
    var _occ={}; S.ministers.forEach(function(m){ if(m.rit) _occ[m.rit]=1; });
    assegnaVoltiGruppo(S.ministers.filter(function(m){ return !m.rit; }), _occ);
  }
  if(S.telUltimo===undefined) S.telUltimo=null;           // F1 — migrazione: cooldown della telefonata
  if(S.telPendente===undefined) S.telPendente=null;       // F1 — migrazione: nessuna chiamata in sospeso nei vecchi salvataggi
  if(S.scandaloUltimo===undefined) S.scandaloUltimo=null; // G3 — migrazione: cooldown-famiglia archi-scandalo
  if(S.famigliaVivaUltimo===undefined) S.famigliaVivaUltimo=null;   // G1 — migrazione: cooldown giorni buoni/scelte
  if(S.famigliaVivaFatti===undefined) S.famigliaVivaFatti=[];       // G1 — migrazione: once-in-vita vissuti
  if(S.recentFamigliaViva===undefined) S.recentFamigliaViva=[];     // G1 — migrazione: finestra ripetibili
  if(S.territorioChiama===undefined) S.territorioChiama=null;       // F2 — migrazione: nessun territorio in chiamata
  if(S.territorioUltimo===undefined) S.territorioUltimo=null;       // F2 — migrazione: cooldown territorio
  if(S.territorioRecente===undefined) S.territorioRecente=null;     // F2 — migrazione: anti-ripetizione area
  if(S.intervistaUltimo===undefined) S.intervistaUltimo=null;      // F5 — migrazione: cooldown intervista incalzante
  if(S.recentSfide===undefined) S.recentSfide=[];                  // Q-fix #2 — migrazione: finestra viste-di-recente condivisa
  /* AVANZAMENTO Fase 2 — migrazione split Fronte→PCI+PSI: i vecchi salvataggi-'50 hanno `i50_fronte` nel roster.
     Ripartisco la sua forza 22:9 (come il seed) su pci/psi e tolgo l'orfano; idem forzePrev/seggi; partito/coalizione rimappati sul PCI (il maggiore). Senza, la sinistra sparirebbe dal caricato. */
  if(S.era===LINEA_IT && S.forze && S.forze.i50_fronte!=null && S.forze.i50_pci==null){
    var _f=S.forze.i50_fronte; S.forze.i50_pci=_f*22/31; S.forze.i50_psi=_f*9/31; delete S.forze.i50_fronte;
    if(S.forzePrev && S.forzePrev.i50_fronte!=null){ var _fp=S.forzePrev.i50_fronte; S.forzePrev.i50_pci=_fp*22/31; S.forzePrev.i50_psi=_fp*9/31; delete S.forzePrev.i50_fronte; }
    if(S.seggi && S.seggi.i50_fronte!=null){ delete S.seggi.i50_fronte; }   // i seggi si ricalcolano alla prossima urna
    if(S.partito==='i50_fronte') S.partito='i50_pci';
    if(Array.isArray(S.coalizione)){ S.coalizione=S.coalizione.map(function(id){return id==='i50_fronte'?'i50_pci':id;}); }
  }
  if(S.leggeTruffa===undefined) S.leggeTruffa=null;                            // Build B (b) — scelta legge truffa: default per i salvataggi pre-(b)
  if(S.debtAncora===undefined) S.debtAncora=((SCENARI && S.scenario && SCENARI[S.scenario] && SCENARI[S.scenario].debtAncora!=null) ? SCENARI[S.scenario].debtAncora : 135);   // L30-1: dallo SCENARIO salvato, non dal primo che combacia con l era   // Cantiere B — migrazione: vecchi salvataggi → àncora dal loro scenario (o 135)
  if(S.logorioEra===undefined) S.logorioEra=((SCENARI && S.scenario && SCENARI[S.scenario] && SCENARI[S.scenario].logorioEra!=null) ? SCENARI[S.scenario].logorioEra : null);   // L30-1: dallo SCENARIO salvato, non dal primo che combacia con l era
  if(S.sfideUltimo===undefined) S.sfideUltimo=S.year*12+S.month;   // D1a — migrazione: i vecchi salvataggi non ricevono la sfida all'istante
  if(S.campNaz===undefined) S.campNaz=null;                        // Cantiere C — migrazione campagna nazionale
  if(S.campNazUltimo===undefined) S.campNazUltimo=null;
  if(S.promesseCampagna===undefined) S.promesseCampagna=[];
  if(S.territori==null && PAESE.territori){ try{ initTerritori(); }catch(e){} }   // retro-compatibilità: salvataggi pre-territori
  else if(S.territori && PAESE.territori && S.territori.length<PAESE.territori.length){   // espansione aree (4→12): conserva gli eletti esistenti (i primi 4, stesso ordine), inizializza solo le nuove
    try{ S.territori=PAESE.territori.map(function(TE,i){ return S.territori[i] || { titolare:nomePersona(), partito:partitoVicinoLean(TE.lean) }; }); }catch(e){}
  }
  if(S.rp==null){ S.rp = ((S.month===1)?3:1) + ((S.month===1 && !S.opposizione && (S.potereLocale||0)>50)?1:0); }   // migrazione vecchi salvataggi (pre-stock): mai meno del vecchio massimale del mese caricato
  if(S.ind && S.ind.stampa==null) S.ind.stampa=55;   // migrazione vecchi salvataggi (pre-stampa): rapporto neutro-positivo iniziale
  if(S.tab==='ind'||S.tab==='con') S.tab='paese';    // migrazione tab: Indicatori+Consenso sono fuse in "Paese" (2026-06-11)
  if(PAESE.ue && S.pesoUE==null){ try{ S.pesoUE=pesoUEBase(); }catch(e){} }   // migrazione vecchi salvataggi (pre-Parlamento europeo)
  S.recentEvent=S.recentEvent||[]; S.recentInt=S.recentInt||[];               // migrazione: finestre anti-ripetizione eventi (i vecchi lastEvent/lastInt restano inerti)
  if(!S.correnti){ try{ initCorrenti(); }catch(e){} }                          // migrazione vecchi salvataggi (pre-correnti): umori a 60, leader nuovi
  if(S.mossaPartito===undefined) S.mossaPartito=null;
  if(!S.biografia) S.biografia=bioVuota();                                     // migrazione vecchi salvataggi (pre-biografia): memoria vuota, i tratti maturano da qui
  else { const c0=bioVuota().c; for(const k in c0){ if(S.biografia.c[k]==null) S.biografia.c[k]=0; } }   // contatori nuovi (inchieste, condanne...) sui salvataggi vecchi
  if(!S.personaggio) S.personaggio=defaultPersonaggio();                       // migrazione pre-personaggio: neutro (lotto 2)
  if(S.annoInizio==null) S.annoInizio=2025;   // i vecchi salvataggi sono nati nel 2025: mantengono il loro ancoraggio per gli "anni trascorsi"
  if(S.eta==null) S.eta=(S.personaggio.etaIniziale||52)+Math.max(0,(S.year||2025)-(S.annoInizio||2025));   // età coerente con gli anni già giocati
  /* migrazione pre-giudiziario (lotto 3): esposizione iniziale dal personaggio, nessuna inchiesta in corso */
  if(S.esposizione==null) S.esposizione=(S.personaggio.background==='magistrato'?6:12)+(S.personaggio.famiglia==='dinastia'?6:0);
  if(S.inchiesta===undefined) S.inchiesta=null;
  if(S.inchiestaUltima===undefined) S.inchiestaUltima=null;
  if(S.inchiestaRoll===undefined) S.inchiestaRoll=null;
  /* migrazione pre-archi (lotto 4): nessun arco in corso, contatori/cooldown vuoti */
  if(!S.archi) S.archi=[];
  /* payoff narrativo fase A: i 4 archi politici sono stati riscritti (nuovi nodi). Un salvataggio con un arco
     a un nodo non più esistente va chiuso, non lasciato a crashare; e gli archi vecchi non hanno filo/eco/peso. */
  S.archi=S.archi.filter(function(a){ const A=(typeof ARCHI_DEF!=='undefined')&&ARCHI_DEF.find(function(d){return d.id===a.id;}); return A && A.nodi[a.nodo]; });
  S.archi.forEach(function(a){ if(a.peso==null)a.peso=0; if(a.eco==null)a.eco=''; if(a.filo===undefined)a.filo=null; });
  /* L11-2 — i 5 avatar-giocatore fotorealistici (av1..av5) sono stati sostituiti da 10 illustrati (pg-*): un
     salvataggio vecchio punta a un id che non esiste più. Lo azzeriamo → «nessun volto» (l'iniziale), mai un
     riferimento morto o un'immagine rotta. La foto CARICATA dall'utente (data URL) non è toccata. */
  if(S.personaggio && typeof S.personaggio.avatar==='string' && S.personaggio.avatar.slice(0,5)!=='data:'
     && typeof AVATARS!=='undefined' && !AVATARS.some(function(x){ return x.id===S.personaggio.avatar; })) S.personaggio.avatar=null;
  if(S.archiRoll===undefined) S.archiRoll=null;
  if(S.archiUltimoStart===undefined) S.archiUltimoStart=null;
  if(!S.recentArchi) S.recentArchi=[];
  if(!S.archiCooldown) S.archiCooldown={};
  if(S.biografia && !S.biografia.archiEpi) S.biografia.archiEpi=[];
  /* payoff fase B: contatori-margine elettorale (estremi memorabili) + il margine dell'ultimo esito */
  if(S.biografia && S.biografia.c){ if(S.biografia.c.trionfi==null) S.biografia.c.trionfi=0; if(S.biografia.c.sconfitteNette==null) S.biografia.c.sconfitteNette=0; }
  if(S.margineEsito===undefined) S.margineEsito=null;
  /* migrazione pre-vita-personale (lotto 5): integrità dalla distanza coscienza↔partito (NON ricalcola il
     passato — i vecchi salvataggi avevano orientamento/religiosità inerti; da qui in poi contano), famiglia
     generata dall'età attuale, nessun evento personale in corso. */
  if(S.integrita==null){ try{ S.integrita=integritaIniziale(); }catch(e){ S.integrita=90; } }
  if(S.famiglia===undefined || S.famiglia===null){ try{ S.famiglia=generaFamiglia(); }catch(e){ S.famiglia={coniuge:null,figli:[]}; } }
  if(S.convalescenza===undefined) S.convalescenza=null;
  if(!S.recentPers) S.recentPers=[];
  if(S.persUltimo===undefined) S.persUltimo=null;
  /* migrazione pre-ascesa (lotto livello 2): i vecchi salvataggi sono capo del governo (livello 3), nessun premier */
  if(S.livello==null) S.livello=3;
  if(S.premier===undefined) S.premier=null;
  if(S.dicastero===undefined) S.dicastero=null;
  if(S.capitale===undefined) S.capitale=(S.livello===2?30:0);
  if(S.premMossaUltimo===undefined) S.premMossaUltimo=null;
  if(S.ministroUltimo===undefined) S.ministroUltimo=null;   // lotto contenuto fase 1: carte del ministro
  if(!S.recentMinistro) S.recentMinistro=[];
  if(S.silAvviso===undefined) S.silAvviso=null;
  if(S.premCrisiMesi===undefined) S.premCrisiMesi=0;
  if(S.occUltima===undefined) S.occUltima=null;
  if(S.mesiAltoCap===undefined) S.mesiAltoCap=0;
  if(S.locale===undefined) S.locale=null;        // migrazione pre-livello-1: nessuno stato locale
  if(S.attivista){ if(S.attivista.campagna===undefined) S.attivista.campagna=null; if(S.attivista.evUltimo===undefined) S.attivista.evUltimo=0; if(!S.attivista.evRecent) S.attivista.evRecent=[]; if(S.attivista.evCorrente===undefined) S.attivista.evCorrente=null; if(S.attivista.paceMul===undefined) S.attivista.paceMul=1;
    if(S.attivista.campUltimo===undefined) S.attivista.campUltimo=0; if(S.attivista.campOfferta===undefined) S.attivista.campOfferta=false;   // A.5 REWORK L2: cooldown+offerta campagna
    if(!S.attivista.campStoria) S.attivista.campStoria=[];   // L3: storico campagne
    if(S.attivista.campagna){ if(S.attivista.campagna._nutrita===undefined) S.attivista.campagna._nutrita=false; if(S.attivista.campagna.resaPending===undefined) S.attivista.campagna.resaPending=false; if(S.attivista.campagna._calato===undefined) S.attivista.campagna._calato=false; } }   // + flag transitori sulla campagna in corso
  if(!S.recentLoc) S.recentLoc=[];
  if(!S.recentTit) S.recentTit=[];   // rifinitura locale: finestra anti-ripetizione dei titoli locali
  if(!S.relInt) S.relInt={};
  try{ initRelInt(); }catch(e){}     // relazioni internazionali (fase A): vecchi salvataggi → seed dallo standing corrente (ora include `ong`, fase B)
  if(!S.recentOng) S.recentOng=[];   // fase B: finestra anti-ripetizione eventi ONG
  if(!S.recentPot) S.recentPot=[];   // cantiere paesi reali (Fetta A): finestra anti-ripetizione dei volti nominati
  if(!S.recentConflInt) S.recentConflInt=[];   // cantiere paesi reali (Fetta B): finestra anti-ripetizione dei conflitti da premier
  if(S.intl===undefined) S.intl=null;   // fase C1a: i salvataggi non-internazionali restano tali (S.intl dato puro)
  if(S.diplo===undefined) S.diplo=null;   // C2: percorso diplomatico (dato puro migrato)
  if(!S.recentDiplo) S.recentDiplo=[];   // C2: finestra anti-ripetizione missioni diplomatiche
  /* migrazione pre-ribilanciamento: serenità familiare a 70, contatori appuntamenti azzerati */
  if(S.famiglia && S.famiglia.serenita==null) S.famiglia.serenita=70;
  if(S.puntoUltimo===undefined) S.puntoUltimo=null;
  if(!S.recentPunto) S.recentPunto=[];
  S.partitoAperto=null;
  COAL=null; try{ stopTimerNotte(); }catch(e){} NOTTE=null; ATTESA=null; PRIM=null; try{ stopTimerTel(); }catch(e){} TEL=null; INTERVISTA=null;   // F4: il timer della notte muore col transitorio; F1/F5: telefonata e intervista sono transitorie → il reload le abbandona (S intatto), la telefonata richiama da S.telPendente try{ resetUIAnim(); }catch(e){} try{ document.getElementById('ov').classList.remove('on'); }catch(e){}   // nessun residuo di trattativa/attesa/notte/primaria/animazioni dopo un caricamento
  document.getElementById('start').style.display='none';
  document.getElementById('over').style.display='none';
  document.getElementById('appoint').style.display='none';
  document.getElementById('game').style.display='block';
  applyPaese();
  genAgenda(false);   // agenda fresca: il mese riparte pulito
  if(!S.titoloMese){ try{ generaTitolo(); }catch(e){} }   // vecchi salvataggi senza titolo: la striscia c'è sempre
  if(!S.tab) S.tab='gov';
  render();
  commitSnap();   // ri-baseline: lo stato caricato è il nuovo confine
  try{ resumeTelefonata(); }catch(e){}   // F1 — se al reload c'era una chiamata senza risposta, il telefono squilla di nuovo (timer fresco)
}
function caricaSalvataggio(text){ const p=parseSave(text); if(p.err) return p; try{ applySnap(p.save); }catch(e){ return {err:'Caricamento fallito: '+(e&&e.message||e)}; } return {ok:true, warn:p.warn}; }
function continuaCarriera(){ const t=lsGet('hos_autosave'); if(t){ const r=caricaSalvataggio(t); if(r.err) alert(r.err); } }
function chiudiAutosave(){ lsDel('hos_autosave'); lastSnap=null; }   // fine carriera: via l'autosave
/* Slot manuali (3): scrivono SEMPRE lastSnap (la fotografia del confine), mai lo stato a metà mese. */
function slotKey(i){ return 'hos_slot_'+i; }
function slotInfo(i){ const t=lsGet(slotKey(i)); if(!t) return null; const p=parseSave(t); if(!p.save) return {corrotto:true}; const s=p.save.s; return {nome:p.save.nome||('Slot '+(i+1)), paese:(PAESI[s.paese]||{}).nome||'?', partito:((PAESI[s.paese]||{partiti:[]}).partiti.find(function(x){return x.id===s.partito;})||{}).nome||'', anno:s.year, mandato:s.mandate, opp:!!s.opposizione}; }
function salvaSlot(i, nome){ if(!lastSnap) commitSnap(); if(!lastSnap) return false; return lsSet(slotKey(i), JSON.stringify(Object.assign({}, lastSnap, {nome:(nome||'').slice(0,24)||('Slot '+(i+1))}))); }
function caricaSlot(i){ const t=lsGet(slotKey(i)); if(!t) return {err:'Slot vuoto.'}; return caricaSalvataggio(t); }
function eliminaSlot(i){ lsDel(slotKey(i)); }
function exportText(){ if(!lastSnap && S) commitSnap(); return lastSnap ? JSON.stringify(lastSnap) : ''; }
/* Profilo (separato dai salvataggi): nome + storico carriere concluse. */
function getProfilo(){ const t=lsGet('hos_profile'); if(t){ try{ const o=JSON.parse(t); if(o&&typeof o==='object') return {name:o.name||'', carriere:Array.isArray(o.carriere)?o.carriere:[]}; }catch(e){} } return {name:'', carriere:[]}; }
function setProfiloNome(n){ const p=getProfilo(); p.name=(n||'').slice(0,24); lsSet('hos_profile', JSON.stringify(p)); }
function aggiungiCarriera(reason){ if(!S) return; const p=getProfilo();
  let trNomi=[], racconto='';
  try{ trNomi=tratti().map(function(id){return ((TRATTI_DEF.find(function(d){return d.id===id;})||{}).nome)||id;});
       racconto=generaEpilogo(reason).slice(0,3).join(' ').slice(0,600); }catch(e){}
  let esT=''; try{ esT=esitoLabel(reason); }catch(e){}   // etichetta congelata QUI, col genere del personaggio di QUESTA carriera
  p.carriere.unshift({ paese:(PAESE&&PAESE.nome)||S.paese, partito:((part(S.partito)||{}).nome)||S.partito, anni:S.year-(S.annoInizio||2025), mandati:S.mandatesWon||0, esito:reason, esitoTesto:esT, nome:((S.personaggio||{}).nome)||'', tratti:trNomi, racconto:racconto });
  if(p.carriere.length>50) p.carriere.length=50; lsSet('hos_profile', JSON.stringify(p)); }

/* inizializza la schermata iniziale: paese di default (Italia), cornice e lista partiti */
setCountry('italia');
decorateCountrySelector();   // bandiere nei bottoni del selettore paese
if(typeof initI18n==='function'){ initI18n(); applyStaticI18n(); }   // i18n: cattura le sorgenti italiane [data-i18n] e applica la lingua corrente (it di default → nessun cambiamento)
try{ const _he=document.getElementById('home-emblema'); if(_he && typeof EMBLEMA_IMG!=='undefined') _he.src=EMBLEMA_IMG; }catch(e){}   // identità home: emblema raster inline (lotto 3)
renderStartPersistence();    // "Continua la carriera" (se c'è autosave), nome giocatore, "Le tue carriere"
/* menu schede sempre visibile: le tab stanno nell'header sticky; allo scroll i 4 indicatori .keys si ritirano */
window.addEventListener('scroll', function(){ const y=window.scrollY||window.pageYOffset||0; document.body.classList.toggle('scrolled', y>40); const tb=document.getElementById('topbtn'); if(tb) tb.classList.toggle('vis', y>400); }, {passive:true});   // ombra header + bottone torna-su (soglia ~400px)
window.addEventListener('resize', function(){ try{ document.documentElement.style.setProperty('--hdrH', document.querySelector('header').offsetHeight+'px'); }catch(e){} }, {passive:true});   // la testata sticky segue l'header anche al cambio di viewport
