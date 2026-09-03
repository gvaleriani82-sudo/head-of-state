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
  u+=(typeof disoccupazioneEra==='function')?disoccupazioneEra():0;   // L60-2: la disoccupazione d'epoca (tabella per linea, 0 fuori tabella)
  u+=S.uMod+ministerMods().unemp+leggiMods().unemp; return clamp(u,3,20);
}
function targetService(id){
  const mm=ministerMods(), lm=leggiMods();
  const base={ sanita:[45,60,72][lv('sanita')]+[-4,0,4][lv('territorio')]+[-4,0,4][lv('personale_san')]+mm.sanita,
    sicurezza:((typeof climaSicurezza==='function')?climaSicurezza():0)+[45,58,70][lv('sicurezza')]+[4,0,-4][lv('immigrazione')]+[-3,0,4][lv('difesa')]+[-3,0,3][lv('manutenzione')]+mm.sicurezza+lm.sicurezza,
    ambiente:[38,52,70][lv('ambiente')]+[-2,0,4][lv('trasporti')]+mm.ambiente+lm.ambiente };
  return clamp(base[id],0,100);
}
/* L72-4 (2-3 set 2026) — I MINIMI RAGGIUNGIBILI DEI SEI GRUPPI STANNO IN UNA BANDA COMUNE (15-24, cioe' sotto il 46% del
   target neutro: il pavimento di L72-1 e' al 60%, e i ministri aggiungono ~5 punti a entrambi, quindi un minimo a 30 non
   bucherebbe mai il pavimento — la prima banda, 15-30, era troppo alta e la misura di L72-1 l'ha stretta).
   Prima: con ogni leva contro gli imprenditori scendevano a 4-11 e i cattolici non scendevano sotto 47-50
   (rispondevano in negativo a due leve sole, -1 ciascuna): «sei cose da non perdere» era falso per costruzione.
   Cura: si ritoccano SOLO i lati ostili delle leve — l'indice 1 (neutro) resta 0 ovunque, quindi i target a leve
   neutre e il gioco normale non si muovono di un decimale. Imprenditori: fisco alta -12→-7, lavoro rigido -8→-5,
   imprese nessuno -5→-4, ambiente -5→-4, welfare esteso -4→-3, protezionismo -2→-1 (il traino della crescita
   (g-0,8)*4 resta: e' anche il loro lato buono). Cattolici: welfare ridotto -6, sanita' tagli -4, scuola tagli -4,
   pensioni riforma -4, sicurezza ridotta -2, diritto allo studio minimo -2, cooperazione minima -3, linea assertiva
   -3 (dottrina sociale, scuola e famiglia, missioni, pace) → minimo 22 (19 nel presente con la migratoria).
   Lavoratori: flessibile -10→-8 (nel '50 inglese il freno del debito li portava a 13,5). Pensionati: riforma -12→-16,
   sanita' tagli -7→-9, territoriale -3→-4 (30→23). Giovani: scuola tagli -6→-9, universita' -2→-4, diritto allo
   studio -2→-3 (26→20). La misura e'
   .claude/misura-minimi-gruppi.js: ministri e leggi tolti, disoccupazione all'equilibrio, discesa per coordinate. */
function targetGroup(id){
  const g=computeGrowth(), un=S.ind.unemp; const mm=ministerMods().grp, lm=leggiMods().grp; let t=50;
  const fid=(S.ind.fiducia!=null)?S.ind.fiducia:100; const sfidMalus=Math.min(fid-65,0);   // malus continuo quando la fiducia scende sotto 65
  if(id==='lavoratori') t=50+[-8,0,8][lv('welfare')]+[-5,0,4][lv('sanita')]+[6,0,-8][lv('lavoro')]+[-4,0,3][lv('pensioni')]+[0,0,4][lv('investimenti')]+(un-8)*-1.5;
  if(id==='pensionati') t=52+[-16,0,12][lv('pensioni')]+[-9,0,6][lv('sanita')]+[0,0,3][lv('sicurezza')];
  if(id==='cetomedio') t=50+[8,0,-10][lv('fisco')]+[-6,0,6][lv('sicurezza')]+[-4,0,3][lv('sanita')]+(g-0.8)*3+sfidMalus*0.07;
  if(id==='imprenditori') t=48+[-4,0,12][lv('imprese')]+[8,0,-7][lv('fisco')]+[-5,0,10][lv('lavoro')]+[0,0,-4][lv('ambiente')]+[0,0,-3][lv('welfare')]+(g-0.8)*4+sfidMalus*0.15;
  if(id==='giovani') t=45+[-9,0,8][lv('istruzione')]+[-5,0,8][lv('ambiente')]+[0,0,5][lv('welfare')]+[0,0,3][lv('immigrazione')]+(un-8)*-1.2;
  if(id==='cattolici') t=52+[-3,0,6][lv('immigrazione')]+[-8,0,4][lv('welfare')]+[-2,0,3][lv('sicurezza')]+[-4,0,2][lv('pensioni')]+[-4,0,0][lv('sanita')]+[-4,0,0][lv('istruzione')];
  // politiche estere/difesa (lotto Esteri+Difesa)
  if(id==='lavoratori')  t+=[3,0,-5][lv('commercio')];
  if(id==='cetomedio')   t+=[-1,0,3][lv('linea_estera')];
  if(id==='imprenditori')t+=[0,0,3][lv('difesa')]+[-1,0,3][lv('commercio')]+[0,0,3][lv('industria_difesa')];
  if(id==='giovani')     t+=[3,0,-2][lv('linea_estera')]+[-2,0,3][lv('cooperazione')]+[0,0,-3][lv('industria_difesa')];
  if(id==='cattolici')   t+=[2,0,-3][lv('linea_estera')]+[-3,0,3][lv('cooperazione')];
  // servizi alla persona e infrastrutture (lotto Salute+Istruzione+Infrastrutture)
  if(id==='pensionati')  t+=[-4,0,5][lv('territorio')];
  if(id==='lavoratori')  t+=[-2,0,4][lv('personale_san')]+[-1,0,3][lv('trasporti')]+[0,0,2][lv('diritto_studio')];
  if(id==='giovani')     t+=[-4,0,4][lv('universita')]+[-3,0,4][lv('diritto_studio')]+[0,0,2][lv('trasporti')];
  if(id==='cetomedio')   t+=[-2,0,3][lv('trasporti')]+[-2,0,3][lv('manutenzione')];
  if(id==='cattolici')   t+=[-2,0,0][lv('diritto_studio')];
  t+=(mm[id]||0)+(lm[id]||0);
  return clamp(t,0,100);
}
/* L72-1 (3 set 2026) — IL PAVIMENTO RELATIVO. Un gruppo «ti ha voltato le spalle» quando sta sotto il 60% del target
   che AVREBBE A LEVE NEUTRE, con l'economia e i ministri di adesso: e' relativo alla tua linea di bilancio, non a un
   numero fisso, cosi' una recessione o un ministro debole non lo fanno scattare da soli — solo una politica ostile
   tenuta a lungo (i gruppi hanno una molla del 12%/mese verso il target: le carte sono colpi, le leve sono la linea).
   Dispersione misurata prima della soglia (.claude/misura-pavimento.js): 50 carriere normali, 0 mesi sotto, rapporto
   minimo 0,67. Il conto alla rovescia vive in S.rivolta = {gruppo: mesi consecutivi sotto}; alla scadenza
   (dif().mesiRivolta: 8/6/4) game.js chiude la carriera con gameOver('rivolta'). Si conta solo da premier al governo. */
const PAVIMENTO_QUOTA=0.6;
function pavimentoGruppo(id){ const save=S.pol; const neu={}; for(const p of POLICIES) neu[p.id]=1; S.pol=neu; let t; try{ t=targetGroup(id); } finally{ S.pol=save; } return PAVIMENTO_QUOTA*t; }
function aggiornaRivolta(){
  if(S.opposizione || (S.livello||3)!==3 || !S.groups){ S.rivolta=null; return; }
  const R=S.rivolta||{};
  for(const gr of GROUPS){ if(S.groups[gr.id]<pavimentoGruppo(gr.id)) R[gr.id]=(R[gr.id]||0)+1; else delete R[gr.id]; }
  S.rivolta=Object.keys(R).length?R:null;
}
function rivoltaMatura(){ if(!S.rivolta) return null; const N=dif().mesiRivolta||6; for(const g of GROUPS){ if((S.rivolta[g.id]||0)>=N) return g.id; } return null; }
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
/* L25-3 · α3 — BERSAGLI DINAMICI dei gruppi. Le carte-base non nominano mai un gruppo nel testo: dicono
   «dove sei più debole», «il tuo gruppo storico», «quello che non ti ha mai votato». Qui si traducono a
   runtime, così la stessa carta è giusta per qualunque partito in qualunque era. */
function gruppiTuoi(){ const p=(typeof part==='function')?part(S.partito):null; return p&&p.base?Object.keys(p.base):[]; }
function gruppiFreddi(n, soloNonTuoi){   // gli n gruppi con l'umore più basso (opz. escludendo la tua base)
  const miei=gruppiTuoi();
  let ids=Object.keys(S.groups||{});
  if(soloNonTuoi){ const f=ids.filter(g=>miei.indexOf(g)<0); if(f.length) ids=f; }   // se la tua base è TUTTO, non restare a mani vuote
  return ids.sort((a,b)=>S.groups[a]-S.groups[b]).slice(0, n||1);
}
function gruppoStorico(){   // il tuo zoccolo: il gruppo-base più caldo (se non hai base, il più caldo in assoluto)
  const miei=gruppiTuoi(), ids=(miei.length?miei:Object.keys(S.groups||{}));
  return ids.slice().sort((a,b)=>S.groups[b]-S.groups[a])[0]||null;
}
function gruppoNuovo(){ return gruppiFreddi(1,true)[0]||null; }   // «quelli che non ti hanno mai votato»
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
  if(!S.groups0 && S.groups) S.groups0=Object.assign({},S.groups);   // L73-2: la fotografia iniziale dei gruppi (primo confine di mese, dopo ogni setup)
  if(!S.ind0) S.ind0={debt:S.ind.debt, unemp:S.ind.unemp, growth:S.ind.growth};   // L73-2: il paese che avevi trovato
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
  aggiornaRivolta();   // L72-1: il conto alla rovescia della rivolta (dopo la molla, prima della morte in game.js)
  S.gMod*=0.8; S.uMod*=0.8;
  if(S.ind.fiducia!=null){
    S.ind.fiducia += (targetFiducia()-S.ind.fiducia)*0.10;   // convergenza lenta come gli altri indicatori
    /* L74-1 — il contatore dell'insolvenza corre SOLO da premier al governo (sono i tuoi conti) e si azzera
       all'opposizione: prima correva ovunque, ma il controllo gameOver('insolvenza') sta solo nel ramo di governo
       e il rientro lo azzerava — sulle porte italiane storiche 112 mesi sotto soglia senza mai un esito (L72-3). */
    const alGoverno = !S.opposizione && (S.livello||3)===3;
    S.mesiSottoCrisi = (alGoverno && S.ind.fiducia < dif().sogliaCrisiFid) ? (S.mesiSottoCrisi||0)+1 : 0;
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
  if(!S.tenuta) return;
  if(!(PAESE.coalizione || (typeof coalizionePossibile==='function' && coalizionePossibile()))) return;   // L61-5 - nell appeso gli alleati britannici sono veri alleati
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

/* L64-4 — le liste pesano sul TARGET delle correnti finché dura il gruppo: fedeli → +4 a tutte (stabilità), correnti → +6
   alla corrente favorita (il seme). Convergente e lieve, come l'età: niente gradini sui valori vivi. */
function gruppoCorrente(id){ const G=(typeof S!=='undefined'&&S)?S.gruppo:null; if(!G) return 0; let b=0; if(G.fedeli>=50) b+=4; if(G.correnti>=50 && S.sfidaSeme && S.sfidaSeme.corrente===id) b+=6; return b; }
function targetCorrente(id){ return clamp(targetCorrenteBase(id)+etaAutorev()+gruppoCorrente(id),0,100); }   // l'autorevolezza dell'età sposta il TARGET: convergenza morbida, niente gradini
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
/* ============================================================================================================
   L47-1 · IL SISTEMA A COLLEGI (first-past-the-post). Affiancato a `calcSeggi`, non al posto suo: chi non
   dichiara `sistemaSeggi:'collegi'` passa dal ramo proporzionale di sempre, byte per byte.

   PERCHÉ SERVIVA. `calcSeggi` ripartisce una torta con un esponente (`PAESE.distorsione`): amplifica il primo
   ma **non può invertire**, perché `Math.pow` è monotona — chi ha più voti avrà sempre più seggi. Il 1951
   britannico (Labour più voti, Conservatives più Camera) era quindi impossibile per costruzione.

   COME FUNZIONA. Non si ripartisce niente: si simulano N **collegi**, e in ognuno vince chi ha la quota locale
   più alta. La quota locale di un partito in un collegio è la sua forza nazionale più uno **scarto
   territoriale**, perché i voti non sono spalmati uniformi: la sinistra è concentrata nelle città, la destra
   diffusa nelle contee. Il collegio ha un carattere `x` (da −1 urbano a +1 rurale) e l'affinità del partito
   si legge dal suo `asse` — dato che il roster ha già:

       quotaLocale(p, x) = forza[p] + AMPIEZZA · asse[p] · x

   Un partito di sinistra (asse −1) prende il massimo dove x = −1: vince le città con margini enormi, e quei
   voti in eccesso **sono sprecati** perché il collegio vale uno comunque. È il meccanismo vero dell'inversione.

   I DUE PARAMETRI, e cosa comprano (tarati sulle misure di L47-1, non a occhio):
     · `ampiezza` — quanto i voti sono concentrati. Alta ⇒ più voti sprecati nelle roccaforti, terzi partiti
       annientati. È la leva della «crudeltà» del sistema verso chi ha voti diffusi.
     · `skew` — di quanto la mappa dei collegi pende. Storicamente le contee erano sovrarappresentate: con
       skew > 0 il collegio mediano è più rurale del paese, e la sinistra deve prendere PIÙ voti per avere
       gli stessi seggi. È la leva dell'inversione.
   `S.seggi` resta in percentuale (somma 100) come nel ramo proporzionale: il resto del motore non sa niente.
   ============================================================================================================ */
/* L47-2 · COME UN PARTITO SPALMA I SUOI VOTI SUI COLLEGI — e perché non è una somma.
   Primo tentativo (scartato, e la misura l'ha bocciato subito): affinità ADDITIVA, `forza + A·aff`. Non
   poteva funzionare: il bonus massimo vale A/2, cioè ~11 punti, e i Liberal del 1950 avevano il 9,1% contro
   il 46,1% del Labour — **37 punti da colmare**. Nessun valore di A li faceva vincere un solo collegio senza
   distruggere tutto il resto. Il difetto non era il numero, era la forma.
   La forma giusta: la forza nazionale **si distribuisce** sui collegi con una densità, invece di essere una
   base uguale ovunque più un premio.

       peso(p, x) = e^(−½·((x − terreno_p)/σ_p)²) / media   (densità a media 1 sui collegi)
       quotaLocale(p, x) = forza[p] · peso(p, x)

   Un partito col 9% concentrato in un decimo dei collegi lì ne ha il 90: **vince**, e altrove sparisce. È la
   specie dei Liberal del '50 e, domani, dei nazionalisti scozzesi — pochi punti nazionali, seggi veri perché
   tutti in un posto. Un partito diffuso ha peso ≈ 1 ovunque e resta col suo dato nazionale.
   · **`terreno`** (−1 città ↔ +1 contee) è indipendente dall'asse: il moderato di destra può essere forte
     nelle contee senza che l'estremo lo scavalchi per costruzione.
   · **`concentrazione`** stringe la campana; `ampiezza` è il guadagno globale che decide quanto, nel paese,
     la geografia conta rispetto al dato nazionale.
   Chi non dichiara `terreno` resta **uniforme** (peso 1 ovunque): il suo risultato è quello nazionale. */
function pesoCollegio(p, x, A){
  var t = (p.terreno!=null) ? p.terreno : null;
  if(t===null) return 1;                                    // partito senza terreno: spalmato uniforme
  var c = (p.concentrazione!=null) ? p.concentrazione : 0.5;
  var g = Math.max(0.05, (A||20)/20);                       // `ampiezza` = quanto la geografia conta
  var sig = 1/(0.5 + Math.max(0, c)*g);
  var d = (x - t)/sig;
  return Math.exp(-0.5*d*d);
}
/* la densità va normalizzata a media 1 sull'insieme dei collegi, altrimenti un partito concentrato
   perderebbe voti solo per essere concentrato. Si calcola una volta per elezione, non per collegio. */
function normalizzaPesi(ps, xs, A){
  var norm={};
  ps.forEach(function(p){
    var s2=0; for(var i=0;i<xs.length;i++) s2+=pesoCollegio(p, xs[i], A);
    norm[p.id] = s2>0 ? xs.length/s2 : 1;
  });
  return norm;
}
function calcSeggiCollegi(){
  var cfg = (PAESE.sistemaSeggi==='collegi' && PAESE.collegi) ? PAESE.collegi : {};
  var N = cfg.n || 650, A = (cfg.ampiezza!=null?cfg.ampiezza:26), SK = (cfg.skew!=null?cfg.skew:0.22);
  var ps = PAESE.partiti, vinti = {}, xs = [];
  ps.forEach(function(p){ vinti[p.id]=0; });
  for(var i=0;i<N;i++){
    var u = (N>1) ? (i/(N-1))*2 - 1 : 0;        // il collegio i sull'asse urbano↔rurale
    xs.push(Math.max(-1, Math.min(1, u + SK)));  // …spostato di `skew`: la mappa pende
  }
  var norm = normalizzaPesi(ps, xs, A);
  for(var i2=0;i2<xs.length;i2++){
    var x = xs[i2], best=null, bv=-Infinity;
    for(var k=0;k<ps.length;k++){
      var p=ps[k], f=(S.forze&&S.forze[p.id])||0;
      var q = f * pesoCollegio(p, x, A) * (norm[p.id]||1);
      if(q>bv){ bv=q; best=p.id; }
    }
    if(best) vinti[best]++;
  }
  /* in percentuale, col metodo dei resti più alti — stessa forma d'uscita di calcSeggi */
  var q2 = ps.map(function(p){ var e=vinti[p.id]/N*100; return {id:p.id, f:Math.floor(e), r:e-Math.floor(e)}; });
  var used = q2.reduce(function(s2,x2){ return s2+x2.f; }, 0);
  q2.slice().sort(function(a,b){ return b.r-a.r; }).forEach(function(x2){ if(used<100){ x2.f++; used++; } });
  var out={}; q2.forEach(function(x2){ out[x2.id]=x2.f; }); return out;
}
function calcSeggi(){
  /* L47-1 — il bivio: chi dichiara i collegi passa di là, tutti gli altri proseguono nel ramo di sempre. */
  if(PAESE.sistemaSeggi==='collegi' && typeof calcSeggiCollegi==='function') return calcSeggiCollegi();
  const d=PAESE.distorsione||1, ps=PAESE.partiti;
  const raw=ps.map(p=>({id:p.id, v:Math.pow(Math.max((S.forze&&S.forze[p.id])||0,0), d)}));
  const tot=raw.reduce((s,x)=>s+x.v,0)||1;
  const q=raw.map(x=>{ const e=x.v/tot*100; return {id:x.id, f:Math.floor(e), r:e-Math.floor(e)}; });
  let used=q.reduce((s,x)=>s+x.f,0);
  q.slice().sort((a,b)=>b.r-a.r).forEach(x=>{ if(used<100){ x.f++; used++; } });
  const out={}; for(const x of q) out[x.id]=x.f;
  return (typeof applicaPremio==='function') ? applicaPremio(out) : out;
}
/* ================================================================================================================
   L52-1 · IL PREMIO DI MAGGIORANZA — parametro per-scenario, sullo schema di `sistemaSeggi`.
   PERCHÉ SERVE: senza premio, `italia2000` è un decennio in cui la maggioranza è irraggiungibile *per
   costruzione* — misurato in L51-1. Il Porcellum (legge 270/2005) dava alla coalizione più votata **340 seggi
   su 630 = 54%** alla Camera, e quello è il meccanismo storico che rendeva governabile quel decennio.

   FORMA: `SCENARI.<porta>.premio = { da:<anno>, quota:<%>, spentoSe:{campo,valore} }`.
   · `da` — il primo anno in cui la legge vale (2006 per il Porcellum: il voto del 2001 è ancora Mattarellum).
   · `quota` — la percentuale di seggi garantita al blocco vincente.
   · `spentoSe` — se il giocatore ha rifiutato la legge allo snodo, il premio non c'è. Così **lo snodo Porcellum,
     che finora spostava solo capitale e stampa, diventa una scelta con una conseguenza vera**: chi lascia le
     regole com'erano corre davvero con un sistema che non lo aiuta, come dice il testo della carta.

   CHI VINCE IL PREMIO: si confrontano due blocchi — quello del giocatore (`S.coalizione`) e quello del partito
   più grande che ne sta fuori, coi suoi compatibili. Chi ha più seggi sale alla quota, gli altri si riducono in
   proporzione sui seggi che restano. Non è il conteggio dei voti di coalizione (il gioco non lo tiene), ma è la
   sua approssimazione più vicina con le strutture che ci sono.

   ⚠ IL MATTARELLUM NON È MODELLATO, ED È UNA VALUTAZIONE, NON UNA DIMENTICANZA (la consegna chiedeva di
   verificare se `distorsione` lo approssima). Misurato sulle urne 2001: a `distorsione 1,3` i totali di
   coalizione escono **CdL 58 / Ulivo 42** contro i veri 58,4 / 38,4 — quasi esatti. **Ma ci arriva col
   meccanismo sbagliato**: `distorsione` amplifica i PARTITI uno per uno, quindi sposta seggi dai piccoli ai
   grandi *dentro la stessa coalizione* — a 1,6 Forza Italia passa da 35 a 47 e la Lega da 4 a 2; a 2,5 la Lega
   arriva a ZERO. La Lega è parte della CdL: il totale giusto lo si otterrebbe annientando gli alleati piccoli,
   cioè proprio quelli che rendono possibile una coalizione. **Quindi no**: il Mattarellum va semmai fatto con
   questa stessa macchina (che è di blocco, non di partito) ma con forma ad amplificazione invece che a soglia
   — ed è una decisione di design, non una taratura da infilare qui.
   ================================================================================================================ */
function applicaPremio(out){
  if(typeof S==='undefined' || !S) return out;
  const sc=(typeof SCENARI!=='undefined' && typeof chosenScenario!=='undefined') ? SCENARI[chosenScenario] : null;
  const pr=sc && sc.premio;
  if(!pr || !pr.quota) return out;
  if(pr.da!=null && S.year<pr.da) return out;
  if(pr.spentoSe && S[pr.spentoSe.campo]===pr.spentoSe.valore) return out;   // il giocatore ha rifiutato la legge
  const mio=(S.coalizione&&S.coalizione.length)?S.coalizione.slice():[S.partito];
  const somma=ids=>ids.reduce((s,id)=>s+(out[id]||0),0);
  /* il blocco rivale: il partito più grosso fuori dalla mia coalizione, coi suoi compatibili (anch'essi fuori) */
  const fuori=PAESE.partiti.filter(p=>mio.indexOf(p.id)<0);
  if(!fuori.length) return out;
  const capo=fuori.slice().sort((a,b)=>(out[b.id]||0)-(out[a.id]||0))[0];
  const rivale=[capo.id].concat(((typeof compatibili==='function')?compatibili(capo.id,out):[])
    .filter(p=>mio.indexOf(p.id)<0 && p.id!==capo.id).map(p=>p.id));
  const vincente = (somma(mio)>=somma(rivale)) ? mio : rivale;
  const base=somma(vincente);
  if(base>=pr.quota) return out;                       // ha già più della quota: il premio non toglie niente
  const resto=100-pr.quota, baseResto=100-base;
  if(baseResto<=0) return out;
  const fin={};
  PAESE.partiti.forEach(p=>{
    const v=out[p.id]||0;
    fin[p.id] = (vincente.indexOf(p.id)>=0) ? (base>0 ? v*pr.quota/base : pr.quota/vincente.length)
                                            : v*resto/baseResto;
  });
  /* arrotondamento a interi che somma esattamente 100 (stesso metodo del ramo proporzionale) */
  const q=PAESE.partiti.map(p=>({id:p.id, f:Math.floor(fin[p.id]), r:fin[p.id]-Math.floor(fin[p.id])}));
  let used=q.reduce((s,x)=>s+x.f,0);
  q.slice().sort((a,b)=>b.r-a.r).forEach(x=>{ if(used<100){ x.f++; used++; } });
  const res={}; for(const x of q) res[x.id]=x.f; return res;
}

/* AVANZAMENTO (Lotto 4) — l'apertura a sinistra: DOPO lo snodo (S.apertura==='apri') il PSI (asse −2) diventa
   compatibile con l'area di centro SENZA mutarne l'asse (round-trip-safe: la compatibilità si legge dal flag). */
function aperturaAmmette(idTuo, idAltro){
  return typeof S!=='undefined' && S && S.apertura==='apri' && idAltro==='i50_psi'
      && (idTuo==='i50_dc'||idTuo==='i50_psdi'||idTuo==='i50_pri'||idTuo==='i50_pli');
}
/* Partiti compatibili per coalizione: |asse − asse del tuo partito| ≤ 1 (escluso te), ordinati per seggi. */
/* ============================================================ L25-1 · `S.intese` — IL TAVOLO DELLE ALLEANZE.
   `S.intese = {idPartito: 0-100}`: il rapporto costruito con ciascun potenziale alleato (dato puro, piatto,
   migrazione `{}`). È la sola meccanica nuova del cantiere-opposizione.
   IL TETTO STA NELLA SCRITTURA, non nella lettura (indicazione di design): così nessuna somma di bonus può
   scavalcarlo, e chi legge non deve conoscere la regola. Distanza d'asse → tetto:
     |Δasse| ≤1 → 100 (già compatibili: l'intesa è colore che si vede)
     |Δasse| = 2 → 70  (ce la puoi fare, a fatica: sopra 60 → entra nel blocco)
     |Δasse| ≥3 → 40  (**non ammette MAI**: niente alleanze fra opposti via simpatia personale)
   ============================================================ */
function intesaCap(idAltro){
  if(typeof S==='undefined' || !S || !S.partito) return 0;
  var a=part(S.partito), b=part(idAltro); if(!a||!b) return 0;
  var d=Math.abs(b.asse-a.asse);
  return d<=1 ? 100 : (d===2 ? 70 : 40);
}
function intesaDi(idAltro){ return (typeof S!=='undefined' && S && S.intese && S.intese[idAltro]!=null) ? S.intese[idAltro] : 0; }
/* I partiti con cui ha senso aprire un tavolo: non il tuo, e a distanza 1-2. Sotto 1 sono già compatibili per
   asse (l'intesa non aggiunge nulla al blocco), sopra 2 il tetto non ammette mai — trattare sarebbe finto. */
/* Il bersaglio delle telefonate-alleanza: se un tavolo-arco è aperto usa QUEL partito (coerenza: è lo stesso
   segretario che ti chiama), altrimenti il più vicino fra i papabili. Null se non ce n'è → la `cond` le esclude. */
function unTavolo(){
  var l=partitiTavolo(); if(!l.length) return null;
  if(typeof S!=='undefined' && S && S.tavoloPid && l.some(function(p){ return p.id===S.tavoloPid; })) return S.tavoloPid;
  var a=part(S.partito);
  return l.slice().sort(function(x,y){ return Math.abs(x.asse-a.asse)-Math.abs(y.asse-a.asse); })[0].id;
}
function partitiTavolo(){
  if(typeof S==='undefined' || !S || !S.partito || !PAESE || !PAESE.partiti) return [];
  var a=part(S.partito); if(!a) return [];
  return PAESE.partiti.filter(function(p){ var d=Math.abs(p.asse-a.asse); return p.id!==S.partito && d>=1 && d<=2; });
}
function intesaMuovi(idAltro, n){
  if(typeof S==='undefined' || !S || !idAltro) return;
  S.intese=S.intese||{};
  S.intese[idAltro]=clamp((S.intese[idAltro]||0)+n, 0, intesaCap(idAltro));
}
/* Partiti compatibili per coalizione: |asse − asse del tuo partito| ≤ 1 (escluso te), ordinati per seggi.
   L25-1 — TERZA VIA: entra anche chi ha un'INTESA ≥60. Si SOMMA agli override storici (`aperturaAmmette`,
   apparentamento '53), non li sostituisce: l'apertura a sinistra resta uno snodo, l'intesa è il lavorio quotidiano
   che può prepararla o supplirvi. Col tetto-per-distanza, |Δasse|≥3 non arriva mai a 60 → mai ammesso. */
function compatibili(idTuo, seggi){
  const a=part(idTuo).asse;
  const list=PAESE.partiti.filter(p=>p.id!==idTuo && (Math.abs(p.asse-a)<=1 || aperturaAmmette(idTuo,p.id) || (typeof intesaDi==='function' && intesaDi(p.id)>=60)));
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
