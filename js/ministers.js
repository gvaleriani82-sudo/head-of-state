"use strict";
/* ============================================================
   MINISTERS — i ministri.
   Competenza e lealtà, effetti del loro profilo sulle politiche,
   riepiloghi, dimissioni quando la lealtà crolla e rimpasti.
   È qui che si lavorerà per i "ministri più profondi" della roadmap.
   ============================================================ */

function getMin(mid){return S.ministers.find(m=>m.min===mid);}
function effPct(m){return Math.round(clamp(m.loyalty/60,0.4,1.2)*100);}
function ministerSummary(m){
  const e=(MEFFECT[m.min]||{})[m.profile]||{}; const out=[];
  if(e.growth>0) out.push(T('crescita'));
  if(e.deficit<0) out.push(T('conti in ordine')); if(e.deficit>0) out.push(T('più spesa'));
  if(e.unemp<0) out.push(T('occupazione'));
  if(e.sanita>0) out.push(T('sanità')); if(e.sicurezza>0) out.push(T('sicurezza')); if(e.ambiente>0) out.push(T('ambiente'));
  if(e.grp) for(const g in e.grp){ if(e.grp[g]>0){const gr=GROUPS.find(x=>x.id===g); if(gr) out.push(T(gr.nm).toLowerCase());} }
  return out.length? T('Favorisce: ')+out.slice(0,3).join(', ') : T('Profilo equilibrato');
}
function askReplace(mid){
  if(!S){return;}
  S.ministeroAperto=null;   // la sostituzione è una decisione: chiudi la pagina-ministero e mostra l'agenda col rimpasto
  if(S.agenda.some(a=>a.kind==='rimpasto'&&a.min===mid&&!a.resolved)) { S.tab='gov'; render(); return; }
  const cs=[]; let g=0;
  while(cs.length<3&&g++<40){const c=mkCand(); if(!cs.some(x=>x.profile===c.profile)) cs.push(c);}
  while(cs.length<3) cs.push(mkCand());
  /* L20-1 — la rosa del rimpasto evita sia i colleghi fra loro sia i ministri IN CARICA (escluso il posto che si
     libera): così il volto che il giocatore vede scegliendo è già libero e alla nomina non si sposta. */
  if(typeof assegnaVoltiGruppo==='function'){ assegnaVoltiGruppo(cs, (typeof volteOccupati==='function'?volteOccupati(mid):{})); cs.forEach(c=>{ c.ritRosa=c.rit; }); }
  S.agenda.push({kind:'rimpasto', min:mid, cands:cs, resolved:false});
  S.tab='gov'; render();
}
function ministerMods(){
  const agg={growth:0,deficit:0,unemp:0,sanita:0,sicurezza:0,ambiente:0,grp:{}};
  for(const m of S.ministers){
    const e=(MEFFECT[m.min]||{})[m.profile]; if(!e) continue;
    const cf=[0.6,1.0,1.4][m.comp-1] * clamp(m.loyalty/60,0.4,1.2);
    for(const k of ['growth','deficit','unemp','sanita','sicurezza','ambiente']) if(e[k]) agg[k]+=e[k]*cf;
    if(e.grp) for(const g in e.grp) agg.grp[g]=(agg.grp[g]||0)+e.grp[g]*cf;
  }
  return agg;
}
function ministerAlignment(m){
  const p=m.profile; let a=0;
  if(p==='conservatore') a=[1,0,-1][lv('fisco')]+[-1,0,1][lv('imprese')]+[-1,0,1][lv('lavoro')]+[1,0,-1][lv('welfare')];
  if(p==='progressista') a=[-1,0,1][lv('welfare')]+[-1,0,1][lv('sanita')]+[-1,0,1][lv('ambiente')]+[1,0,-1][lv('lavoro')];
  if(p==='tecnico') a=(S.ind.deficit<3.2?1.5:-1.5)+[-1,0,1][lv('investimenti')]+[-1,0,1][lv('istruzione')];
  if(p==='populista') a=[-1,0,1][lv('welfare')]+[-1,0,1][lv('pensioni')]+[-1,0,1][lv('sicurezza')];
  return clamp(a,-2.5,2.5);
}
function monthlyMinisters(){
  for(const m of S.ministers){ let d=ministerAlignment(m)*0.6; if(d<0) d*=dif().driftLealtaGiu; m.loyalty=clamp(m.loyalty+d,0,100); }
  for(const m of S.ministers){
    if(!m.resigning && m.loyalty<18){ S.pendingRimpasto.push(m.min);
      S.log.unshift({t:T('Dimissioni'),x:T('Il Ministro %M (%D) si è dimesso.').replace('%M',m.nm).replace('%D',T(MINISTRIES.find(x=>x.id===m.min).nm))});
      m.loyalty=40; m.resigning=true;
    }
  }
}

/* --- Proposte attive: sceglie una coppia (ministro, proposta) ammissibile, o null.
   Una proposta è ammissibile se il profilo combacia, il dicastero combacia (se la
   proposta ha `min`), il ministro non è dimissionario e non è uscita di recente. --- */
function pickProposta(){
  const pool=[];
  for(const m of S.ministers){
    if(m.resigning) continue;
    for(const p of PROPOSTE){
      if(p.profile!==m.profile) continue;
      if(p.min && p.min!==m.min) continue;
      if(S.recentProp.includes(p.id)) continue;
      if(typeof eraViva==='function' && !eraViva(p)) continue;   // proposte = contenuto-policy discrezionale (flip): escluse nel '50 (audit fine in 2b)
      pool.push({min:m.min, prop:p});
    }
  }
  return pool.length ? rnd(pool) : null;
}

/* --- Richieste di budget: sceglie una coppia (ministro, richiesta) per DICASTERO, o null.
   Ammissibile se il dicastero combacia, il ministro non è dimissionario e non è uscita di recente. --- */
function pickBudget(){
  const pool=[];
  for(const m of S.ministers){
    if(m.resigning) continue;
    for(const b of BUDGETS){
      if(b.min!==m.min) continue;
      if(S.recentBudget.includes(b.id)) continue;
      if(typeof eraVivaT==='function' && !eraVivaT(b)) continue;   // richieste di budget = meccanica strutturale senza-tempo (default universale)
      pool.push({min:m.min, req:b});
    }
  }
  return pool.length ? rnd(pool) : null;
}

/* --- Scandali: rischio di un ministro = inverso della sua efficacia (STESSA formula di
   ministerMods: [0.6,1.0,1.4][comp-1] * clamp(loyalty/60,0.4,1.2)). Bassa competenza O bassa
   lealtà => efficacia bassa => rischio alto. --- */
function ministerRisk(m){
  const eff=[0.6,1.0,1.4][m.comp-1]*clamp(m.loyalty/60,0.4,1.2);
  return clamp(1/eff, 0.5, 3);
}
/* Probabilità del mese ~6% per un governo medio, modulata dalla qualità del gabinetto;
   il ministro coinvolto è scelto pesato per rischio (i peggiori più probabili). Ritorna {min,scn} o null. */
function pickScandalo(){
  const cands=S.ministers.filter(m=>!m.resigning);
  if(!cands.length) return null;
  const w=cands.map(ministerRisk);
  const tot=w.reduce((a,b)=>a+b,0);
  const monthChance=clamp(0.06*(tot/cands.length)*dif().freqScandali, 0, 0.15);
  if(Math.random()>=monthChance) return null;
  // scelta del ministro pesata per rischio
  let r=Math.random()*tot, m=cands[0];
  for(let i=0;i<cands.length;i++){ r-=w[i]; if(r<=0){ m=cands[i]; break; } }
  // scandalo coerente col dicastero, non recente; fallback ai generici. I GIUDIZIARI sono esclusi:
  // arrivano solo dall'escalation dell'esposizione (lotto 3), mai dal giro normale.
  let pool=SCANDALI.filter(s=>!s.giudiziario&&eraVivaT(s)&&(!s.min||s.min===m.min)&&!S.recentScandalo.includes(s.id));
  if(!pool.length) pool=SCANDALI.filter(s=>!s.giudiziario&&eraVivaT(s)&&!s.min&&!S.recentScandalo.includes(s.id));
  if(!pool.length) pool=SCANDALI.filter(s=>!s.giudiziario&&eraVivaT(s)&&!s.min);
  return {min:m.min, scn:rnd(pool)};
}

/* --- Conflitti tra ministri: cerca, per ogni conflitto non recente, due ministri DISTINTI che
   combacino coi due lati (profilo + dicastero se indicato, non dimissionari). Solo se entrambi
   esistono lo scontro è ammissibile. Ritorna {confl, minA, minB} o null. --- */
function pickConflitto(){
  const pool=[];
  for(const c of CONFLITTI){
    if(S.recentConflitto.includes(c.id)) continue;
    if(typeof eraVivaT==='function' && !eraVivaT(c)) continue;   // conflitti tra ministri = rivalità senza-tempo (default universale)
    const mA=S.ministers.find(m=>!m.resigning && m.profile===c.a.profile && (!c.a.min||c.a.min===m.min));
    const mB=S.ministers.find(m=>!m.resigning && m.profile===c.b.profile && (!c.b.min||c.b.min===m.min) && m!==mA);
    if(mA && mB){ pool.push({confl:c, minA:mA.min, minB:mB.min}); }
  }
  return pool.length ? rnd(pool) : null;
}
