"use strict";
/* ============================================================
   MODEL — motore economico e del consenso.
   Trasforma le scelte del giocatore (politiche, ministri) in
   numeri: crescita, debito, disoccupazione, deficit, servizi,
   consenso dei gruppi. Qui c'è la "matematica" del gioco.
   Usa ministerMods() definito in ministers.js (chiamata a
   runtime, quindi l'ordine di caricamento non è un problema).
   ============================================================ */

/* --- Punti riforma e lettura politiche --- */
/* Massimale del mese = STOCK accumulabile S.rp (matura al confine di mese in maturaRP, game.js:
   +1/mese tetto 3; gennaio iniezione +3 tetto 5, +1 territorio fuori tetto). Fallback legacy per stati non migrati. */
function curRpMax(){ return (S && S.rp!=null) ? S.rp : (((S.month===1)?3:1) + ((S.month===1 && !S.opposizione && (S.potereLocale||0)>50)?1:0)); }
function rpUsed(){let u=0; for(const p of POLICIES) u+=Math.abs(S.pol[p.id]-S.snap[p.id]);
  if(S.leggi&&S.leggiSnap){ for(const L of LEGGI){ if(!!S.leggi[L.id]!==!!S.leggiSnap[L.id]) u+=L.costo; } }   // anche le leggi cambiate stamane costano RP
  return u;}
/* Effetti PERMANENTI delle leggi in vigore (come ministerMods): {grp, growth, deficit, sicurezza, ambiente, unemp}. */
function leggiMods(){
  const m={grp:{}, growth:0, deficit:0, sicurezza:0, ambiente:0, unemp:0};
  if(!S.leggi||typeof LEGGI==='undefined') return m;
  for(const L of LEGGI){ if(S.leggi[L.id] && L.permanenti){ const p=L.permanenti;
    if(p.growth)m.growth+=p.growth; if(p.deficit)m.deficit+=p.deficit; if(p.sicurezza)m.sicurezza+=p.sicurezza; if(p.ambiente)m.ambiente+=p.ambiente; if(p.unemp)m.unemp+=p.unemp;
    if(p.grp) for(const g in p.grp) m.grp[g]=(m.grp[g]||0)+p.grp[g];
  }}
  return m;
}
function rpLeft(){return curRpMax()-rpUsed();}
function lv(id){return S.pol[id];}

/* --- Difficoltà: profilo di moltiplicatori del livello corrente (default normale) --- */
function dif(){ return DIFFICOLTA[(S&&S.diff)||'normale']; }

/* --- Calcoli macro --- */
function computeDeficit(){
  const D=dif();
  let d=(S.deficitBase!=null)?S.deficitBase:3.0; for(const p of POLICIES){ const c=FISCAL[p.id][S.pol[p.id]]; d+= c>0 ? c*D.costoSpese : c; }   // base-disavanzo per-paese (cantiere Budget), storicamente 3,0
  const fid=(S.ind.fiducia!=null)?S.ind.fiducia:100;
  /* Cantiere B — àncora RELATIVA al seed d'epoca (S.debtAncora, default 135=presente identico): nel '50 col debito a 31
     l'àncora assoluta regalava −2,6 di deficit (interessi negativi) e spegneva l'asse fiscale. Ora gli interessi partono
     ~0 al seed e CRESCONO se ti indebiti — a ogni epoca sulla sua scala. */
  const interesse=(S.ind.debt-(S.debtAncora!=null?S.debtAncora:135))*0.025*D.interessi;
  d+= interesse>0 ? interesse*(1+(100-fid)/100*D.spreadMult) : interesse;   // lo spread morde SOLO gli interessi positivi (debito>135)
  d+=ministerMods().deficit;
  d-=(S.ciclo||0)*0.7;   // stabilizzatore automatico: recessione (ciclo<0) → meno gettito → deficit su da solo
  d+=leggiMods().deficit;   // leggi di spesa (+) o di entrata/risparmio (−)
  return d;
}
/* fiducia dei mercati: target 0..100 da debito e deficit, ancorato allo stato iniziale (78), scalato da DIFFICOLTA.
   Debito alto e deficit alto la abbassano; debito in rientro la fa risalire. */
function targetFiducia(){
  const D=dif();
  /* Cantiere B — àncora relativa (S.debtAncora): la fiducia parte ~78 a OGNI epoca e si muove col debito rispetto
     al suo seed. Prima, col debito '50 a 31, il target era 156→clamp 100: inchiodata, l'intero asse crisi spento. */
  return clamp(78 - (S.ind.debt-(S.debtAncora!=null?S.debtAncora:135))*0.5*D.sfiduciaMult - Math.max(S.ind.deficit-3,0)*2*D.sfiduciaMult, 0, 100);
}
/* reputazione internazionale: NON ha conti sottostanti. È l'àncora verso cui rientra lentamente, fissata dalle
   POLITICHE estere (linea diplomatica multilaterale↑/assertiva↓; industria della difesa promossa↓). Gli eventi
   internazionali la spostano di colpo (repd), poi rientra. */
function targetReputazione(){
  /* àncora storica (politiche) + COPPIA MORBIDA (fase A): le relazioni coi singoli enti spingono la statura
     generale verso l'alto/basso, ma la reputazione NON è la media (resta robusta e indipendente). */
  const rel=(typeof relIntMean==='function' && S.relInt)?(relIntMean()-50)*0.3:0;
  return clamp(50 + [8,0,-8][lv('linea_estera')] + [0,0,-6][lv('industria_difesa')] + rel, 0, 100);
}
function computeGrowth(){
  let g=0.8;
  g+=[-0.3,0,0.45][lv('investimenti')]+[-0.2,0,0.40][lv('imprese')]+[-0.3,0,0.50][lv('lavoro')]
    +[-0.05,0,0.15][lv('istruzione')]+[0.30,0,-0.50][lv('fisco')]+[0,0,-0.15][lv('ambiente')]
    +[-0.10,0,0.20][lv('commercio')]+[0,0,0.15][lv('industria_difesa')]+[-0.05,0,0.20][lv('universita')];   // commercio + export difesa + ricerca universitaria
  if(S.ind.debt>120) g-=(S.ind.debt-120)*0.02*dif().dragDebito;
  g+=((S.ind.reputazione!=null?S.ind.reputazione:50)-50)/50*0.2;   // commercio: reputazione alta = piccolo traino, bassa = freno
  g+=S.gMod+ministerMods().growth+(S.ciclo||0)+leggiMods().growth; return clamp(g,-6,5);   // + congiuntura + leggi permanenti
}
function targetUnemp(){
  let u=8.0; u-=(computeGrowth()-0.8)*0.8;
  u+=[0.4,0,-0.6][lv('lavoro')]+[0,0,-0.3][lv('imprese')]+[0,0,-0.3][lv('investimenti')]+[0.1,0,-0.2][lv('personale_san')];   // assunzioni nella sanità
  u+=S.uMod+ministerMods().unemp+leggiMods().unemp; return clamp(u,3,20);
}
function targetService(id){
  const mm=ministerMods(), lm=leggiMods();
  const base={ sanita:[45,60,72][lv('sanita')]+[-4,0,4][lv('territorio')]+[-4,0,4][lv('personale_san')]+mm.sanita,
    sicurezza:[45,58,70][lv('sicurezza')]+[4,0,-4][lv('immigrazione')]+[-3,0,4][lv('difesa')]+[-3,0,3][lv('manutenzione')]+mm.sicurezza+lm.sicurezza,
    ambiente:[38,52,70][lv('ambiente')]+[-2,0,4][lv('trasporti')]+mm.ambiente+lm.ambiente };
  return clamp(base[id],0,100);
}
function targetGroup(id){
  const g=computeGrowth(), un=S.ind.unemp; const mm=ministerMods().grp, lm=leggiMods().grp; let t=50;
  const fid=(S.ind.fiducia!=null)?S.ind.fiducia:100; const sfidMalus=Math.min(fid-65,0);   // malus continuo quando la fiducia scende sotto 65
  if(id==='lavoratori') t=50+[-8,0,8][lv('welfare')]+[-5,0,4][lv('sanita')]+[6,0,-10][lv('lavoro')]+[-4,0,3][lv('pensioni')]+[0,0,4][lv('investimenti')]+(un-8)*-1.5;
  if(id==='pensionati') t=52+[-12,0,12][lv('pensioni')]+[-7,0,6][lv('sanita')]+[0,0,3][lv('sicurezza')];
  if(id==='cetomedio') t=50+[8,0,-10][lv('fisco')]+[-6,0,6][lv('sicurezza')]+[-4,0,3][lv('sanita')]+(g-0.8)*3+sfidMalus*0.07;
  if(id==='imprenditori') t=48+[-5,0,12][lv('imprese')]+[8,0,-12][lv('fisco')]+[-8,0,10][lv('lavoro')]+[0,0,-5][lv('ambiente')]+[0,0,-4][lv('welfare')]+(g-0.8)*4+sfidMalus*0.15;
  if(id==='giovani') t=45+[-6,0,8][lv('istruzione')]+[-5,0,8][lv('ambiente')]+[0,0,5][lv('welfare')]+[0,0,3][lv('immigrazione')]+(un-8)*-1.2;
  if(id==='cattolici') t=52+[-3,0,6][lv('immigrazione')]+[0,0,4][lv('welfare')]+[0,0,3][lv('sicurezza')]+[0,0,2][lv('pensioni')];
  // politiche estere/difesa (lotto Esteri+Difesa)
  if(id==='lavoratori')  t+=[3,0,-5][lv('commercio')];
  if(id==='cetomedio')   t+=[-1,0,3][lv('linea_estera')];
  if(id==='imprenditori')t+=[0,0,3][lv('difesa')]+[-2,0,3][lv('commercio')]+[0,0,3][lv('industria_difesa')];
  if(id==='giovani')     t+=[3,0,-2][lv('linea_estera')]+[-2,0,3][lv('cooperazione')]+[0,0,-3][lv('industria_difesa')];
  if(id==='cattolici')   t+=[2,0,-1][lv('linea_estera')]+[-1,0,3][lv('cooperazione')];
  // servizi alla persona e infrastrutture (lotto Salute+Istruzione+Infrastrutture)
  if(id==='pensionati')  t+=[-3,0,5][lv('territorio')];
  if(id==='lavoratori')  t+=[-2,0,4][lv('personale_san')]+[-1,0,3][lv('trasporti')]+[0,0,2][lv('diritto_studio')];
  if(id==='giovani')     t+=[-2,0,4][lv('universita')]+[-2,0,4][lv('diritto_studio')]+[0,0,2][lv('trasporti')];
  if(id==='cetomedio')   t+=[-2,0,3][lv('trasporti')]+[-2,0,3][lv('manutenzione')];
  t+=(mm[id]||0)+(lm[id]||0);
  return clamp(t,0,100);
}
function computeConsenso(){let s=0,w=0; for(const gr of GROUPS){s+=S.groups[gr.id]*gr.w; w+=gr.w;} return s/w;}

/* --- Mutazioni dirette sul consenso dei gruppi (usate dai dossier/eventi) --- */
/* RAPPORTO CON LA STAMPA come AMPLIFICATORE: i soli MALUS (n<0) da carte/eventi/scelte sono modulati —
   stampa alta li attenua (ti perdonano), bassa li amplifica. Neutro ESATTO a 50 (gioco invariato lì),
   ±28% agli estremi. Solo al governo: all'opposizione i colpi via gd vanno ai gruppi del governo
   avversario e la TUA stampa non c'entra. Bonus (n>0), indicatori economici e deriva strutturale
   mensile (targetGroup) NON passano di qui — il blast-radius è: tutto il danno politico da carte. */
let STAMPA_FX=0;   // bandierina TRANSITORIA (mai in S): l'ultimo malus è stato gonfiato (+1) o attutito (−1) in modo percepibile; la legge resolveItem per dichiararlo nell'esito
function stampaMul(){ const st=(S.ind&&S.ind.stampa!=null)?S.ind.stampa:50; return 1-(st-50)/50*0.28; }
let ACT_PACE=1;   // A.5 rework (ritmo): fattore-paceMul attivista applicato ai gd() durante la risoluzione delle carte attiviste (settato/azzerato al confine); 1 = neutro fuori dalla gavetta
function gd(id,n){
  if(ACT_PACE!==1) n*=ACT_PACE;   // A.5: il ritmo scala i gruppi come i guadagni → ri-scalamento uniforme del tempo (weakest-link intatto: cambia la velocità, non le posizioni)
  if(n<0 && !S.opposizione){
    const m=stampaMul(); n*=m;
    if(m>1.08) STAMPA_FX=1; else if(m<0.92) STAMPA_FX=-1;   // percepibile solo oltre ~±8% (stampa sotto ~36 / sopra ~64): mai rumore vicino al neutro
    if(S.promessa && S.promessa.grp===id) S.promessa.colpi=(S.promessa.colpi||0)+(-n);   // intervista: il ritorno di fiamma conta SOLO le tue scelte contro il gruppo promesso (mai la deriva naturale, che non passa da gd)
    if(S.promesseCampagna && S.promesseCampagna.length){ for(const pp of S.promesseCampagna){ if(pp.grp===id) pp.colpi=(pp.colpi||0)+(-n); } }   // Cantiere C: le promesse ELETTORALI contano allo stesso modo (la resa dei conti alla campagna dopo)
  }
  S.groups[id]=clamp(S.groups[id]+n,0,100);
}
function allG(n){for(const gr of GROUPS) gd(gr.id,n);}
function repd(n){ if(S.ind && S.ind.reputazione!=null) S.ind.reputazione=clamp(S.ind.reputazione+n,0,100); }   // sposta la REPUTAZIONE internazionale (usata dagli eventi INTERNAZIONALI)
/* RELAZIONI INTERNAZIONALI (fase A): standing per-ente in S.relInt. relIntMuovi sposta uno standing; relIntMean
   è la media (per la coppia morbida con la reputazione e per l'epilogo); targetEnte legge l'àncora dai dati. */
function relIntMuovi(id,n){ if(S.relInt && S.relInt[id]!=null) S.relInt[id]=clamp(S.relInt[id]+n,0,100); }
/* relAvvicina(a,b,n): muove DUE standing verso il loro punto medio di n (n>0 de-polarizza: il compromesso; n<0 allarga:
   cavalcare la frattura). Direzione calcolata sullo stato → un solo dato in carta serve a "riavvicinare i blocchi". (fase C1b) */
function relAvvicina(id1,id2,n){ if(!S.relInt) return; const a=S.relInt[id1], b=S.relInt[id2]; if(a==null||b==null) return; if(a>=b){ relIntMuovi(id1,-n); relIntMuovi(id2,n); } else { relIntMuovi(id1,n); relIntMuovi(id2,-n); } }
function relIntMean(){ if(!S.relInt||typeof ENTI_INT==='undefined') return 50; const geo=ENTI_INT.filter(function(E){return !E.societa && S.relInt[E.id]!=null;}); if(!geo.length) return 50; let s=0; geo.forEach(function(E){s+=S.relInt[E.id];}); return s/geo.length; }   // SOLO gli enti geopolitici: le ONG (col flag `societa`) NON contano nella statura/reputazione
function targetEnte(id){ if(typeof ENTI_INT==='undefined') return 50; const E=ENTI_INT.find(function(x){return x.id===id;}); return E&&E.ancora?clamp(E.ancora(),0,100):50; }
/* SEDIA-SWING (Fetta B): un paese `allineamento:'nonallineato'` (India/Sudafrica/Argentina) NON è nel polo occidentale —
   è la media potenza corteggiata dai due poli. nonAllineato() = lo è; naLabel() = le etichette/policy "sedia-swing" valgono
   al livello NAZIONALE (da Segretario, liv 4, il board torna NEUTRO: sei l'arbitro sopra i blocchi). */
function nonAllineato(){ return typeof PAESE!=='undefined' && PAESE.allineamento==='nonallineato'; }
function naLabel(){ return nonAllineato() && (typeof S==='undefined' || !S || S.livello!==4); }
/* POTENZE REALI (cantiere paesi reali e conflitti, Fetta A) — i VOLTI nominati dei blocchi. Lo standing resta sul
   BLOCCO astratto (`relInt`); questi helper danno un NOME reale agli eventi/conflitti delle Fette B/C. potDi/potenzeDi
   = lookup; rivaleNominato = pesca un volto del polo rivale (anti-ripetizione finestra 2); potSub = templating del
   testo, deriva TUTTE le forme dall'articolo `art` (%POT=Russia · %POTdet=la Russia/l'Iran · %POTdi=della/dell' ·
   %POTa=alla/all' · %POTda=dalla/dall' · %POTsu=sulla/sull' · %POTin=nella/nell' · %POTcar=carattere). Per B/C. */
function potDi(id){ return (typeof POTENZE!=='undefined') ? POTENZE.find(function(p){return p.id===id;}) : null; }
function potenzeDi(blocco){ const self=(typeof PAESE!=='undefined')&&PAESE.potenzaId; return (typeof POTENZE!=='undefined') ? POTENZE.filter(function(p){return p.blocco===blocco && p.id!==self && (typeof eraViva!=='function'||eraViva(p));}) : []; }   // AUTO-ESCLUSIONE (Fetta B): il paese giocato (es. l'India) non è mai tra le potenze — sei tu. FIX era: in '50 il rivale è l'URSS, non Cina/Iran/Corea (moderni untagged→contemporanea, esclusi)
function rivaleNominato(){
  const pool0=potenzeDi('rivale'); if(!pool0.length) return null;
  S.recentPot=S.recentPot||[];
  let pool=pool0.filter(function(p){return S.recentPot.indexOf(p.id)<0;});
  if(!pool.length) pool=pool0;
  const p=rnd(pool); S.recentPot.push(p.id); if(S.recentPot.length>2) S.recentPot.shift();
  return p;
}
function potSub(txt,p){ if(!txt||!p) return txt||'';
  const car=(typeof curLang==='function'&&curLang()==='en')?(p.carattereEn||p.carattere||''):(p.carattere||'');
  if(typeof curLang==='function' && curLang()==='en'){
    /* INGLESE: grammatica semplice. `artEn` = prende "the" (the United States) o no (Russia/China/Iran).
       nomeEn = esonimo inglese (ripiego al nome italiano finché B7 non lo riempie). */
    const nm=p.nomeEn||p.nome, the=p.artEn?'the ':'', det=the+nm, Det=p.artEn?('The '+nm):nm;
    return txt.replace(/%POTDet/g,Det).replace(/%POTdet/g,det).replace(/%POTdi/g,'of '+det).replace(/%POTa/g,'to '+det).replace(/%POTda/g,'from '+det).replace(/%POTsu/g,'on '+det).replace(/%POTin/g,'in '+det).replace(/%POTcar/g,car).replace(/%POT/g,nm);
  }
  const el=(p.art||'la').indexOf("'")>=0; const j=function(b){ return el?b+p.nome:b+' '+p.nome; }; const C=function(s){ return s.charAt(0).toUpperCase()+s.slice(1); };   // elisione (l') → forma attaccata (all'Iran); C = maiuscola a inizio frase (La Russia/L'Iran)
  return txt.replace(/%POTDet/g,C(j(p.art||'la'))).replace(/%POTdet/g,j(p.art||'la')).replace(/%POTdi/g,j(el?"dell'":'della')).replace(/%POTa/g,j(el?"all'":'alla')).replace(/%POTda/g,j(el?"dall'":'dalla')).replace(/%POTsu/g,j(el?"sull'":'sulla')).replace(/%POTin/g,j(el?"nell'":'nella')).replace(/%POTcar/g,car).replace(/%POT/g,p.nome); }
function stampad(n){ if(S.ind && S.ind.stampa!=null) S.ind.stampa=clamp(S.ind.stampa+n,0,100); }   // sposta il RAPPORTO CON LA STAMPA (usato dalle conferenze stampa)
function minFragile(){ return (S.ministers||[]).find(m=>m && !m.resigning && m.loyalty<35) || null; }   // ministro in difficoltà (per la domanda di conferenza)

/* --- Simulazione di un mese --- */
function simulateMonth(){
  S.prev={growth:S.ind.growth,debt:S.ind.debt,unemp:S.ind.unemp,consenso:S.ind.consenso};
  const ampC=(dif().cicloAmp!=null)?dif().cicloAmp:0.7;
  /* congiuntura: passeggiata aleatoria smorzata. AVANZAMENTO (Lotto 4) — reverte verso cicloBase() (la baseline-decade:
     miracolo positiva, stretta negativa) invece che verso 0; la fascia ±ampC accompagna la baseline. Presente e pre-'58:
     cicloBase()=0 → identico a prima (il '50 sigillato, il presente alla virgola). */
  const cicB=(typeof cicloBase==='function')?cicloBase():0;
  S.ciclo=clamp(cicB + ((S.ciclo||0)-cicB)*0.93 + (Math.random()*2-1)*ampC*0.30, cicB-ampC, cicB+ampC);
  if(!S.opposizione) S.mesiAlGoverno=(S.mesiAlGoverno||0)+1;                        // logorio del potere (solo mentre governi)
  S.ind.growth=computeGrowth();
  S.ind.deficit=computeDeficit();
  S.ind.unemp+= (targetUnemp()-S.ind.unemp)*0.12;
  S.ind.debt=clamp(S.ind.debt + S.ind.deficit/12 - S.ind.debt*S.ind.growth/100/12, 40,260);
  S.ind.sanita+= (targetService('sanita')-S.ind.sanita)*0.10;
  S.ind.sicurezza+= (targetService('sicurezza')-S.ind.sicurezza)*0.10;
  S.ind.ambiente+= (targetService('ambiente')-S.ind.ambiente)*0.10;
  const D=dif();
  for(const gr of GROUPS){ const cur=S.groups[gr.id], t=targetGroup(gr.id); const k=0.12*(t>=cur?D.salitaConsenso:D.discesaConsenso); S.groups[gr.id]=clamp(cur+(t-cur)*k,0,100); }
  S.ind.consenso=computeConsenso();
  S.gMod*=0.8; S.uMod*=0.8;
  if(S.ind.fiducia!=null){
    S.ind.fiducia += (targetFiducia()-S.ind.fiducia)*0.10;   // convergenza lenta come gli altri indicatori
    S.mesiSottoCrisi = (S.ind.fiducia < dif().sogliaCrisiFid) ? (S.mesiSottoCrisi||0)+1 : 0;
  }
  /* relazioni internazionali (fase A): ogni ente torna lento verso la sua àncora (guidata dalle tue politiche) —
     stesso ritmo della reputazione. Le tue SCELTE (eventi) le spostano di colpo; nel silenzio derivano alla linea. */
  if(S.relInt && typeof ENTI_INT!=='undefined'){ const rit=(S.livello===4||S.livello===5)?0.03:0.06; for(const id in S.relInt){ S.relInt[id] += (targetEnte(id)-S.relInt[id])*rit; S.relInt[id]=clamp(S.relInt[id],0,100); } }   // liv 4 (Segretario) e 5 (diplomatico): ritorno dimezzato, lo standing costruito PERSISTE   // a livello 4 (Segretario) il ritorno è dimezzato: le mediazioni PERSISTONO, il mondo non torna com'era (fase C1b)
  if(S.ind.reputazione!=null) S.ind.reputazione += (targetReputazione()-S.ind.reputazione)*0.06;   // reputazione: ritorno lento verso l'àncora (ora include la coppia morbida con relInt)
  if(S.ind.stampa!=null) S.ind.stampa += ((50+etaAutorev())-S.ind.stampa)*0.06;   // stampa: nel silenzio torna all'àncora (50 ± autorevolezza dell'età; le conferenze la spostano di colpo)
  if(S.esposizione!=null) S.esposizione=clamp(S.esposizione-1,0,100);   // esposizione giudiziaria: il passato si dimentica, lentamente (lotto 3)
  evolvePartiti();
  evolveTenuta();                                                       // passo 4: tenuta degli alleati di coalizione
  evolveCorrenti();                                                     // primarie: l'umore delle correnti interne (gemello della tenuta)
  S.mesiMinoranza = S.minoranza ? (S.mesiMinoranza||0)+1 : 0;           // conto alla rovescia della minoranza (per la sfiducia)
}

/* --- Tenuta degli alleati (passo 4): ogni alleato di coalizione converge lentamente verso un target dato dalla
   SODDISFAZIONE della sua base (come evolvePartiti) e dall'ANDAMENTO della sua forza dall'ingresso al governo
   (se si logora, si innervosisce). In discesa riusa driftLealtaGiu (come la lealtà dei ministri). --- */
function evolveTenuta(){
  if(!S.tenuta || !PAESE.coalizione) return;
  const D=dif();
  for(const id in S.tenuta){
    const p=part(id); if(!p) continue;
    let s=0,w=0; for(const g in p.base){ s+=S.groups[g]*p.base[g]; w+=p.base[g]; }
    const baseSodd = w>0 ? s/w : 50;
    const f0 = (S.tenutaForza0 && S.tenutaForza0[id]!=null) ? S.tenutaForza0[id] : S.forze[id];
    const target = clamp(baseSodd + (S.forze[id]-f0)*2, 0, 100);
    let step = (target - S.tenuta[id])*0.10;
    if(step<0) step *= D.driftLealtaGiu;
    S.tenuta[id] = clamp(S.tenuta[id]+step, 0, 100);
  }
}

/* ===== CORRENTI DI PARTITO (lotto primarie) — gemelle della tenuta alleati: ogni corrente converge
   0,10/mese verso un TARGET misurabile (discesa scalata da driftLealtaGiu), i colpi secchi arrivano
   dai punti d'esito (elezioni, intermedie, nomine, azioni). Al governo i target leggono ministri e
   indicatori; all'opposizione visibilità/credibilità (il partito vive anche da sfidante). ===== */
function profiloPartito(){ const p=part(S.partito); if(!p) return 'tecnico';
  if((p.orientamento||'').indexOf('populista')>-1) return 'populista';
  return p.asse>=1?'conservatore':p.asse<=-1?'progressista':'tecnico'; }
function baseSoddPartito(){ const p=part(S.partito); if(!p||!p.base) return 50;
  let s=0,w=0; for(const g in p.base){ s+=S.groups[g]*p.base[g]; w+=p.base[g]; } return w>0?s/w:50; }
/* ===== L'ETÀ come curva biografica (sistema narrativo, lotto 2). Tre zone, NEUTRA al centro:
   giovane (≤48) più energia ma meno autorevolezza; anziano (64+) il contrario; vecchio leone (72+)
   anche il logorio morde un filo prima. Effetti LIEVI e dichiarati: ±3 sui TARGET (mai sui valori
   vivi — la convergenza esistente li porta a regime in 6-12 mesi, nessun gradino); logorio ×1,25
   solo a 72+. L'energia (i cooldown delle mosse) vive in cdStampa()/cdPartito() (game.js). ===== */
function etaFase(){ const e=(S&&S.eta!=null)?S.eta:52; return e<=48?'giovane':(e<64?'neutro':(e<72?'anziano':'vecchio')); }
function etaAutorev(){ const f=etaFase(); return f==='giovane'?-3:(f==='neutro'?0:3); }
function etaLogorio(){ return etaFase()==='vecchio'?1.25:1; }

function targetCorrente(id){ return clamp(targetCorrenteBase(id)+etaAutorev(),0,100); }   // l'autorevolezza dell'età sposta il TARGET: convergenza morbida, niente gradini
function targetCorrenteBase(id){
  /* l'autenticità incrinata (lotto 5): a integrità < 35 l'ala identitaria (i Militanti) sente il tradimento.
     Gentile e convergente — vale solo per i Militanti, non tocca consenso/conti. */
  const autent=(id==='militanti' && S.integrita!=null && S.integrita<35)?6:0;
  if(S.opposizione){
    if(id==='fedelissimi') return clamp(20+(S.visibilita||0)*0.6,0,100);
    if(id==='pontieri')    return clamp(20+(S.credibilita||0)*0.6,0,100);
    return clamp(baseSoddPartito()-autent,0,100);
  }
  if(id==='fedelissimi') return clamp(20+S.ind.consenso*0.6,0,100);
  if(id==='pontieri'){ const nT=(S.ministers||[]).filter(m=>m&&m.profile==='tecnico').length;
    return clamp(30+nT*4+((S.ind.fiducia!=null?S.ind.fiducia:50))*0.2,0,100); }
  const prof=profiloPartito(); const nC=(S.ministers||[]).filter(m=>m&&m.profile===prof).length;
  return clamp(baseSoddPartito()+nC*4-autent,0,100);
}
function evolveCorrenti(){
  if(!S.correnti) return;
  const D=dif();
  for(const c of S.correnti){
    let step=(targetCorrente(c.id)-c.umore)*0.10;
    if(step<0) step*=D.driftLealtaGiu;
    c.umore=clamp(c.umore+step,0,100);
  }
}
function umoreMedio(){ return S.correnti&&S.correnti.length ? S.correnti.reduce((s,c)=>s+c.umore,0)/S.correnti.length : 60; }
function corrented(id,n){ if(!S.correnti) return; const c=S.correnti.find(x=>x.id===id); if(c) c.umore=clamp(c.umore+n,0,100); }
function tutteCorrenti(n){ if(S.correnti) S.correnti.forEach(c=>{ c.umore=clamp(c.umore+n,0,100); }); }
/* degrado delle correnti per inazione (appuntamento col partito gestito male): scalato da degradoMult. */
function tutteDegrado(n){ const m=(dif().degradoMult!=null)?dif().degradoMult:1; if(S.correnti) S.correnti.forEach(c=>{ c.umore=clamp(c.umore-n*m,0,100); }); }

/* ===== TRATTI (sistema narrativo, lotto 1) — derivazione PURA dai contatori della biografia:
   niente stato salvato, retro-compatibile per costruzione (un salvataggio migrato matura da lì in poi).
   Soglie tarate per emergere in una carriera vera (~12 scelte ≈ un anno di gioco). ===== */
function tratti(){
  if(!S || !S.biografia) return [];
  const c=S.biografia.c, out=[];
  if(c.leggi>=4) out.push('riformatore');
  if(c.rigore>=12) out.push('falco');
  if(c.ordine>=12) out.push('pugnoduro');
  if(c.sociale>=12) out.push('progressista');
  if(c.pancia>=12) out.push('tribuno');
  if(c.identita>=14) out.push('bandiera');
  const tot=c.rigore+c.ordine+c.sociale+c.pancia;
  if(tot>=24 && [c.rigore,c.ordine,c.sociale,c.pancia].every(function(x){return x/tot<=0.35;})) out.push('equilibrista');
  if(c.spregiudicatezza>=6) out.push('spregiudicato');
  /* asse-vita (lotto VITA PERSONALE): il MODO in cui hai vissuto la vita accanto alla carriera — chi cura gli
     affetti vs chi li sacrifica. Estremi memorabili (soglia 5 + dominanza netta), come gli altri tratti. */
  if(c.affetti>=5 && c.affetti>c.affettiSacrificati+1) out.push('difamiglia');
  else if(c.affettiSacrificati>=5 && c.affettiSacrificati>c.affetti+1) out.push('sacrificio');
  return out;
}
function haTratto(id){ return tratti().indexOf(id)>-1; }

/* --- Forze dei partiti: ogni mese seguono l'umore della loro base (gruppi), restando ancorate alla
   forza INIZIALE (p.forza da PAESI, mai mutato). Somma ≈100, pavimento ~2. Scrive solo S.forze/S.forzePrev,
   non tocca economia/consenso/elezioni. La guardia protegge i test che non impostano S.forze. --- */
function evolvePartiti(){
  if(!S.forze || !PAESE.partiti) return;
  const parts=PAESE.partiti; const score={}; let tot=0;
  /* Cantiere B — IL PERNO (logorio da incumbency, approvato da Giacomo): il potere è una DISCESA che freni, non una
     salita. Base = 1−logorio (decadimento di default); governare bene RALLENTA la china (bonus cappato al 70% del
     logorio → govF max = 1−logorio·0,3 < 1: il blocco erode SEMPRE, come la DC storica 48,5→40,1); governare male
     ACCELERA. Rate per-scenario (S.logorioEra; presente resta 0.002) × difficoltà (logorioMult) × età.
     Nel presente il delta è il solo cap-del-bonus: niente più incumbent che cresce all'infinito (documentato). */
  const cons=(S.ind&&S.ind.consenso!=null)?S.ind.consenso:50;
  const logorio=(S.mesiAlGoverno||0)*((S.logorioEra!=null)?S.logorioEra:0.002)*(dif().logorioMult!=null?dif().logorioMult:1)*etaLogorio();
  const swing=(dif().swingGoverno!=null?dif().swingGoverno:1);
  const bonus=Math.min(Math.max(cons-50,0)/100*swing, logorio*0.7);
  const malus=Math.max(50-cons,0)/100*swing;
  const govF=clamp(1-logorio+bonus-malus, 0.4, 1.2);
  for(const p of parts){
    let s=0,w=0; for(const g in p.base){ s+=S.groups[g]*p.base[g]; w+=p.base[g]; }
    const sodd=w>0?s/w:50;                 // soddisfazione della base 0..100
    let sc=p.forza*(0.5+sodd/100);
    if(S.coalizione && S.coalizione.includes(p.id)) sc*=govF;   // governare bene cresce, male cede voti all'opposizione
    score[p.id]=sc; tot+=sc;
  }
  S.forzePrev=Object.assign({},S.forze);
  const k=0.10;
  for(const p of parts){ const target=tot>0?score[p.id]/tot*100:S.forze[p.id]; S.forze[p.id]+=(target-S.forze[p.id])*k; }
  // pavimento ~2 + ribilancio a 100 (rete di sicurezza, in genere già 100)
  for(const p of parts) S.forze[p.id]=Math.max(2,S.forze[p.id]);
  let sum=0; for(const p of parts) sum+=S.forze[p.id];
  for(const p of parts) S.forze[p.id]=S.forze[p.id]/sum*100;
}

/* Slancio post-intermedia: sposta `amount` punti di forza VERSO il blocco (su `ids`) e via dal resto, poi
   rinormalizza a 100. Scossone transitorio (evolvePartiti lo riassorbe). Aggiorna forzePrev per non mostrare frecce spurie. */
function applicaSlancio(ids, amount){
  if(!S.forze || !PAESE.partiti) return;
  const parts=PAESE.partiti, inBloc=new Set(ids);
  const nB=parts.filter(p=>inBloc.has(p.id)).length, nR=parts.length-nB;
  if(nB<1 || nR<1) return;
  for(const p of parts) S.forze[p.id]=Math.max(2, S.forze[p.id] + (inBloc.has(p.id)?amount/nB:-amount/nR));
  let sum=0; for(const p of parts) sum+=S.forze[p.id];
  for(const p of parts) S.forze[p.id]=S.forze[p.id]/sum*100;
  S.forzePrev=Object.assign({},S.forze);
}

/* ====== Elezioni passo 3: forze → seggi e confronti. Funzioni pure: leggono S.forze/PAESE, non mutano stato. ====== */
function part(id){ return PAESE.partiti.find(p=>p.id===id); }

/* Seggi 0..100 dalle forze correnti: proporzionale ∝ forza^distorsione (premia i grandi), normalizzato.
   Arrotondamento col metodo dei resti più grandi → la somma fa ESATTAMENTE 100 (niente seggi persi/aggiunti). */
function calcSeggi(){
  const d=PAESE.distorsione||1, ps=PAESE.partiti;
  const raw=ps.map(p=>({id:p.id, v:Math.pow(Math.max((S.forze&&S.forze[p.id])||0,0), d)}));
  const tot=raw.reduce((s,x)=>s+x.v,0)||1;
  const q=raw.map(x=>{ const e=x.v/tot*100; return {id:x.id, f:Math.floor(e), r:e-Math.floor(e)}; });
  let used=q.reduce((s,x)=>s+x.f,0);
  q.slice().sort((a,b)=>b.r-a.r).forEach(x=>{ if(used<100){ x.f++; used++; } });
  const out={}; for(const x of q) out[x.id]=x.f; return out;
}

/* AVANZAMENTO (Lotto 4) — l'apertura a sinistra: DOPO lo snodo (S.apertura==='apri') il PSI (asse −2) diventa
   compatibile con l'area di centro SENZA mutarne l'asse (round-trip-safe: la compatibilità si legge dal flag). */
function aperturaAmmette(idTuo, idAltro){
  return typeof S!=='undefined' && S && S.apertura==='apri' && idAltro==='i50_psi'
      && (idTuo==='i50_dc'||idTuo==='i50_psdi'||idTuo==='i50_pri'||idTuo==='i50_pli');
}
/* Partiti compatibili per coalizione: |asse − asse del tuo partito| ≤ 1 (escluso te), ordinati per seggi. */
function compatibili(idTuo, seggi){
  const a=part(idTuo).asse;
  const list=PAESE.partiti.filter(p=>p.id!==idTuo && (Math.abs(p.asse-a)<=1 || aperturaAmmette(idTuo,p.id)));
  return seggi ? list.sort((x,y)=>(seggi[y.id]||0)-(seggi[x.id]||0)) : list;
}
function seggiCoalizione(ids, seggi){ return ids.reduce((s,id)=>s+(seggi[id]||0),0); }

/* "Il tuo blocco" per le elezioni intermedie: governando = la tua coalizione; in opposizione = tuo partito +
   compatibili per asse (la coalizione che raduneresti). bloccoQuota() = somma delle forze correnti del blocco. */
function bloccoIds(){
  if(!S.opposizione) return (S.coalizione||[S.partito]).slice();
  return [S.partito].concat(compatibili(S.partito).map(p=>p.id));
}
function bloccoQuota(){ return bloccoIds().reduce((s,id)=>s+((S.forze&&S.forze[id])||0),0); }

/* Testa a testa (sistemi a candidato): tu vs l'avversario più forte; gli altri travasano la forza al lato
   più vicino per asse (equidistanti: metà e metà). Vinci se superi il 50%. Ritorna {opp, mine, his, myPct, win}. */
function testaATesta(){
  const me=S.partito, meA=part(me).asse;
  const altri=PAESE.partiti.filter(p=>p.id!==me).sort((a,b)=>(S.forze[b.id]||0)-(S.forze[a.id]||0));
  const opp=altri[0], oppA=opp.asse;
  let mine=S.forze[me]||0, his=S.forze[opp.id]||0;
  for(const p of altri.slice(1)){
    const dMe=Math.abs(p.asse-meA), dOp=Math.abs(p.asse-oppA), f=S.forze[p.id]||0;
    if(dMe<dOp) mine+=f; else if(dOp<dMe) his+=f; else { mine+=f/2; his+=f/2; }
  }
  const tot=(mine+his)||1;
  const cb=S.opposizione?(S.credibilita-50)*0.1:0;              // bonus/malus credibilità al voto (solo in opposizione)
  const myPct=clamp(mine/tot*100+cb, 0, 100);
  return { opp, mine, his, myPct, cb, win:myPct>50 };
}
