/* ================================================================================================================
   L248-2 — IL PERSONAGGIO ANIMATO (stile B, «illustrato editoriale», D-A1 di Giacomo del 16/10)
   Il personaggio del giocatore disegnato dal codice a pezzi (SVG) e animato da UN SOLO requestAnimationFrame per
   tutto il modulo. Viene dal prototipo `prove/personaggio/prototipo.html` (L248-1): stesso corpo, stesse pose, stessa
   cinematica inversa `ik()`, solo lo stile B; gli stili A e C restano nella prova.
   ⚑ SPENTO: `PERSONAGGIO_ANIMATO=false`. Oggi nessuno lo chiama dal gioco; l'aggancio ai momenti è L248-4.
   ⚑ NIENTE IN `S`: legge `S.personaggio` (genere, carnagione o ripiego), `S.eta`, `S.year`; scrive solo nel DOM.
     L'unico campo nuovo di `S` è `S.personaggio.carnagione` (D-A4, 'chiara'|'media'|'scura'), facoltativo: senza,
     vale il ripiego dalla macro-area dell'avatar (`personaggioCarnagione()`), quindi nessun salvataggio cambia.
   ⚑ IL CICLO: un rAF solo per tutte le istanze (`PERS_VIVE`); un'istanza esce quando chi l'ha chiesta chiama
     `stop()` o quando il suo elemento non è più nel documento (un modale chiuso in `#ov`, regola L95-1); senza
     istanze il ciclo non chiede il fotogramma dopo.
   ⚑ IL MOVIMENTO segue l'interruttore del gioco (`movimentoModo()`, ui.js): «ridotto» = la posa chiave dell'azione
     ferma (niente respiro, ciglia, scosse), la bocca socchiusa mentre parla; «spento» = in più nessun passaggio
     da una posa all'altra.
   API: personaggioSVG(opz) · personaggioAnima(el, azione, opz) → {stop} · personaggioOpzioniDaS()
   opz = {genere:'m'|'f', carnagione:'chiara'|'media'|'scura', eta:<anni>, anno:<anno>, posa:<azione>}
   azioni: respiro · vittoria · sconfitta · firma · stretta · comizio · giuramento · parla (opz.durataMs, opz.testo)
   ================================================================================================================ */
let PERSONAGGIO_ANIMATO = false;   // L248-4 lo accende

const PERS_CARNAGIONI = ['chiara','media','scura'];
const PERS_PELLI = { chiara:{p:'#f0c8a6', o:'#d6a07c'}, media:{p:'#c78c5e', o:'#a46c40'}, scura:{p:'#7a4a2d', o:'#5c351f'} };
/* il ripiego (D-A4): la macro-area del ritratto illustrato `pg-<area>-<g>` (avatars.js); con la foto caricata o
   senza avatar, l'area del paese (`RITRATTI_AREA`, ui.js). La tabella è di Code: occidentale e asiatica orientale
   chiara, latinoamericana e sudasiatica media, africana scura. */
const PERS_AREA_CARNAGIONE = { occ:'chiara', asi:'chiara', lat:'media', sud:'media', afr:'scura' };
const PERS_SPALLA = { sx:[62,112], dx:[138,112] }, PERS_L1=54, PERS_L2=50;
const PERS_AZIONI = ['respiro','vittoria','sconfitta','firma','stretta','comizio','giuramento','parla'];
/* l'istante della posa chiave (s) per il movimento ridotto */
const PERS_POSE_CHIAVE = { respiro:0, vittoria:0.52, sconfitta:0, firma:1.2, stretta:0, comizio:0.65, giuramento:1.5, parla:0 };
/* le battute del personaggio (D-A3), per la voce nuova: non ancora usate. Testi e file in DESIGN-PERSONAGGIO.md
   («Battute per il giro suoni (L248-2)»); l'inglese in lang-en.js. File: voce-pers-<momento>-<it|en>-<m|f>.mp3 */
const BATTUTE_PERSONAGGIO = {
  'vittoria':           'Avete scelto la fiducia. Ora tocca a noi meritarla.',
  'sconfitta':          'Gli elettori hanno deciso. Rispetto il loro voto.',
  'bilancio-buono':     'Un anno buono. Il prossimo dovrà essere migliore.',
  'bilancio-difficile': 'È stato un anno duro. Lo dico senza giri di parole.',
  'insediamento':       'Giuro di servire il paese, tutto il paese.',
  'legge':              'Ecco la firma. Da oggi questa legge è di tutti.',
  'comizio':            'Sono qui per ascoltarvi, e per chiedervi il voto.',
  'alleanza':           'Non la pensiamo uguale su tutto. Ma su questo sì.'
};

function personaggioCarnagione(p){
  p = p || ((typeof S!=='undefined' && S && S.personaggio) || {});
  if(PERS_CARNAGIONI.indexOf(p.carnagione)>=0) return p.carnagione;
  let area=null;
  const m=(typeof p.avatar==='string') ? /^pg-([a-z]+)-[mf]$/.exec(p.avatar) : null;
  if(m) area=m[1];
  if(!area && typeof RITRATTI_AREA!=='undefined') area=RITRATTI_AREA[(typeof S!=='undefined' && S && S.paese) || 'italia'];
  return PERS_AREA_CARNAGIONE[area] || 'chiara';
}
function personaggioOpzioniDaS(){
  const s=(typeof S!=='undefined' && S) ? S : null, p=(s && s.personaggio) || {};
  return { genere:(p.genere==='f'?'f':'m'), carnagione:personaggioCarnagione(p),
           eta:(s && s.eta!=null) ? s.eta : (p.etaIniziale||52), anno:(s && s.year) || 2026 };
}
/* l'epoca del guardaroba: oggi ce ne sono due (il prototipo), il guardaroba per decennio è L248-3.
   Ripiego: fino al 1974 il doppiopetto e il tailleur con la gonna, dal 1975 il completo di oggi. */
function persEpoca(anno){ return (anno||2026) < 1975 ? '50' : 'oggi'; }
function persNorm(opz){ opz=opz||{};
  return { f:opz.genere==='f', pelle:PERS_PELLI[PERS_CARNAGIONI.indexOf(opz.carnagione)>=0 ? opz.carnagione : 'chiara'],
           scura:opz.carnagione==='scura', chiara:opz.carnagione!=='media' && opz.carnagione!=='scura',
           v:(opz.eta||52)>=60, c:persEpoca(opz.anno)==='50' }; }

/* ---------- le forme (dal prototipo) ---------- */
function persCapelliCol(n){ if(n.scura) return n.v ? '#c9c6c0' : '#17120f'; return n.v ? '#bdbab4' : (n.chiara ? '#5b3b22' : '#2a1b12'); }
function persVestito(n){
  if(!n.f) return n.c ? {g:'#5d5248', cam:'#f2efe6', cr:'#7a2f2f'} : {g:'#22304d', cam:'#f4f6f8', cr:null};
  return n.c ? {g:'#3f5270', cam:'#f2ece0', cr:null} : {g:'#6b2a3a', cam:'#ede6e0', cr:null}; }
/* la bocca: angoli più alti col sorriso (k>0), più bassi col broncio (k<0), aperta di a (0..1) */
function persBocca(a, k){
  const w=13+Math.max(0,k)*0.9, cy=78, ang=cy-k, top=cy+k*0.45-a*2.2;
  let bot=cy+k*1.1+1.6+a*11; if(bot<top+1.6) bot=top+1.6;
  return 'M'+(100-w/2).toFixed(1)+','+ang.toFixed(1)+' Q100,'+top.toFixed(1)+' '+(100+w/2).toFixed(1)+','+ang.toFixed(1)
        +' Q100,'+bot.toFixed(1)+' '+(100-w/2).toFixed(1)+','+ang.toFixed(1)+'Z'; }
function persFormaCapelli(n){
  if(!n.f){
    if(n.v) return ['', 'M74,62 Q72,44 80,36 Q84,44 84,52 Z M126,62 Q128,44 120,36 Q116,44 116,52 Z M86,34 Q100,29 114,34 Q100,32 86,36 Z'];
    if(n.c) return ['', 'M74,56 Q72,26 100,24 Q129,25 126,56 Q123,40 112,35 Q94,32 84,38 Q77,44 74,56 Z'];
    return ['', 'M74,54 Q71,24 98,22 Q106,18 114,24 Q129,28 126,54 Q122,38 114,33 Q100,36 86,33 Q78,40 74,54 Z'];
  }
  if(n.c){ if(n.v) return ['M72,66 Q66,30 100,24 Q134,30 128,66 Z', 'M72,60 Q70,28 100,24 Q130,28 128,60 Q124,44 114,38 Q100,42 86,38 Q76,44 72,60 Z M90,22 a10,8 0 1,1 20,0 a10,8 0 1,1 -20,0'];
           return ['M70,80 Q62,28 100,22 Q138,28 130,80 Q126,88 118,84 L82,84 Q74,88 70,80 Z', 'M70,72 Q66,26 100,22 Q134,26 130,72 Q127,52 118,42 Q104,36 88,42 Q78,50 76,70 Z']; }
  if(n.v) return ['M72,82 Q64,28 100,22 Q136,28 128,82 Z', 'M72,74 Q68,26 100,22 Q132,26 128,74 Q126,50 116,40 Q100,44 84,40 Q76,50 74,74 Z'];
  return ['M68,92 Q60,26 100,20 Q140,26 132,92 L122,92 L78,92 Z', 'M70,78 Q66,24 100,20 Q134,24 130,78 Q128,50 118,38 Q100,46 82,36 Q74,48 72,78 Z'];
}
function persFormaBusto(n){
  if(!n.f) return n.v ? 'M56,120 Q58,104 80,100 L120,100 Q142,104 144,120 L141,186 Q143,204 136,214 L64,214 Q57,204 59,186 Z'
                      : 'M56,120 Q58,104 80,100 L120,100 Q142,104 144,120 L136,214 L64,214 Z';
  const peplo=n.c ? ' L134,176 Q144,196 138,214 L62,214 Q56,196 66,176' : ' L132,190 L134,214 L66,214 L68,190';
  return 'M60,120 Q62,104 82,101 L118,101 Q138,104 140,120 L132,166 Q128,174 132,176'+peplo+' Q72,174 68,166 Z'; }
function persFormaGambe(n){
  if(n.f && n.c) return { gonna:'M64,200 L136,200 L142,266 L58,266 Z', calze:['M77,262 L90,262 L89,306 L79,306 Z','M110,262 L123,262 L121,306 L111,306 Z'],
                          scarpe:['M76,304 L92,304 L93,312 L72,312 Z','M108,304 L124,304 L128,312 L107,312 Z'] };
  if(n.f) return { pant:['M70,200 L99,200 L96,310 L76,310 Z','M101,200 L130,200 L124,310 L104,310 Z'], scarpe:['M73,307 L97,307 L98,315 L70,315 Z','M103,307 L127,307 L130,315 L102,315 Z'] };
  return { pant: n.c ? ['M68,200 L99,200 L98,310 L70,310 Z','M101,200 L132,200 L130,310 L102,310 Z'] : ['M71,200 L99,200 L96,310 L75,310 Z','M101,200 L129,200 L125,310 L104,310 Z'],
           scarpe:['M68,307 L99,307 L99,316 L64,316 Z','M101,307 L132,307 L136,316 L101,316 Z'] }; }

/* ---------- il disegno: una posa ferma, senza id (più personaggi nella stessa pagina non collidono) ---------- */
const PERS_TRATTO=' stroke="#211d1b" stroke-width="2.2" stroke-linejoin="round"';
function personaggioSVG(opz){
  opz=opz||{}; const n=persNorm(opz), t=PERS_TRATTO, P=n.pelle, V=persVestito(n), H=persCapelliCol(n), cap=persFormaCapelli(n), gam=persFormaGambe(n);
  const azione=PERS_AZIONI.indexOf(opz.posa)>=0 ? opz.posa : 'respiro';
  let gambe='';
  if(gam.gonna) gambe+='<path d="'+gam.gonna+'" fill="'+V.g+'"'+t+'/>'+gam.calze.map(function(p){ return '<path d="'+p+'" fill="'+P.o+'"'+t+'/>'; }).join('');
  if(gam.pant) gambe+=gam.pant.map(function(p){ return '<path d="'+p+'" fill="'+V.g+'"'+t+'/>'; }).join('');
  gambe+=gam.scarpe.map(function(p){ return '<path d="'+p+'" fill="'+(n.c?'#16110e':'#3b2618')+'"'+t+'/>'; }).join('');
  let busto='<path d="M90,80 L110,80 L111,104 L89,104 Z" fill="'+P.p+'"'+t+'/>'
    +'<path d="'+persFormaBusto(n)+'" fill="'+V.g+'"'+t+'/>'
    +'<path d="M118,102 Q140,104 144,120 L136,214 L112,214 Q126,170 118,102 Z" fill="#000" opacity=".22"/>'
    +'<path d="M86,100 L100,'+(n.f?120:134)+' L114,100 Z" fill="'+V.cam+'"'+t+'/>';
  if(V.cr) busto+='<path d="M97,104 L103,104 L106,140 L100,149 L94,140 Z" fill="'+V.cr+'"'+t+'/><circle cx="99" cy="118" r=".9" fill="#d9c08a"/><circle cx="101.5" cy="128" r=".9" fill="#d9c08a"/>';
  busto+= n.c ? '<path d="M80,101 L97,146 L86,116 Z M120,101 L103,146 L114,116 Z" fill="#000" opacity=".22"/>' : '<path d="M83,101 L98,138 L90,114 Z M117,101 L102,138 L110,114 Z" fill="#000" opacity=".2"/>';
  if(n.c && !n.f) busto+=[[92,160],[108,160],[92,180],[108,180]].map(function(b){ return '<circle cx="'+b[0]+'" cy="'+b[1]+'" r="2" fill="#000" opacity=".35"/>'; }).join('')+'<path d="M118,128 L130,126 L130,131 L118,132 Z" fill="#f4f1e8"/>';
  if(!n.c && !n.f) busto+='<circle cx="100" cy="176" r="1.8" fill="#000" opacity=".35"/>';
  if(n.f && n.c) busto+=[93,96.5,100,103.5,107].map(function(x,i){ return '<circle cx="'+x+'" cy="'+(102+Math.abs(i-2)*-0.8+2)+'" r="1.6" fill="#f3ead6" stroke="#b6a98c" stroke-width=".4"/>'; }).join('');
  const occhio=function(cx){ return '<ellipse cx="'+cx+'" cy="58" rx="2.6" ry="3.2" fill="#1b1614"/>'; };
  let testa='<g data-p="testa">'+(cap[0]?'<path d="'+cap[0]+'" fill="'+H+'"'+t+'/>':'')
    +'<circle cx="75" cy="63" r="5" fill="'+P.p+'"'+t+'/><circle cx="125" cy="63" r="5" fill="'+P.p+'"'+t+'/>'
    +'<ellipse cx="100" cy="62" rx="25" ry="30" fill="'+P.p+'"'+t+'/>'
    +'<path d="M104,34 Q126,40 125,64 Q124,84 104,92 Q116,80 116,62 Q116,44 104,34 Z" fill="#000" opacity=".2"/>'
    +'<path d="M100,61 L97,71 L102,71" fill="none" stroke="#211d1b" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>';
  if(n.v) testa+='<path d="M88,40 Q100,37 112,40 M90,44 Q100,42 110,44" stroke="'+P.o+'" stroke-width="1" fill="none" opacity=".8"/><path d="M88,70 Q86,76 89,81 M112,70 Q114,76 111,81" stroke="'+P.o+'" stroke-width="1.1" fill="none" opacity=".75"/>';
  testa+='<g data-p="occhioSx">'+occhio(89)+'</g><g data-p="occhioDx">'+occhio(111)+'</g>'
    +'<path d="M83,50 L95,49" stroke="#211d1b" stroke-width="3.4" stroke-linecap="round"/><path d="M105,49 L117,50" stroke="#211d1b" stroke-width="3.4" stroke-linecap="round"/>';
  if(n.f) testa+='<circle cx="75" cy="70" r="1.6" fill="#e2c271"/><circle cx="125" cy="70" r="1.6" fill="#e2c271"/>';
  if(n.v) testa+= n.c ? '<circle cx="89" cy="58" r="7.2" fill="none" stroke="#2a221c" stroke-width="2"/><circle cx="111" cy="58" r="7.2" fill="none" stroke="#2a221c" stroke-width="2"/><path d="M96,57 L104,57" stroke="#2a221c" stroke-width="1.6"/>'
                      : '<rect x="81.5" y="53.5" width="15" height="9" rx="2.5" fill="none" stroke="#4a4e58" stroke-width="1.2"/><rect x="103.5" y="53.5" width="15" height="9" rx="2.5" fill="none" stroke="#4a4e58" stroke-width="1.2"/><path d="M96.5,57 L103.5,57" stroke="#4a4e58" stroke-width="1.1"/>';
  const P0=persPosa(azione, PERS_POSE_CHIAVE[azione]);
  testa+='<path data-p="bocca" d="'+persBocca(0,P0.umore)+'" fill="#3b1715" stroke="#2a201c" stroke-width="1.8" stroke-linejoin="round"/>'
    +'<path d="'+cap[1]+'" fill="'+H+'"'+t+'/></g>';
  /* gli oggetti dell'azione che servono a leggerla: il foglio della firma, la mano dell'altro nella stretta
     (la scena intorno — podio, folla, sala — la dà lo sfondo del momento, L248-4) */
  let dietro='', sopra='';
  if(azione==='firma') dietro='<g data-p="foglio"><path d="M96,222 L166,222 L172,236 L90,236 Z" fill="#f4efe2" stroke="#b9ae96" stroke-width=".8"/>'
    +'<path d="M100,226 L156,226 M98,229 L150,229" stroke="#9c937f" stroke-width=".7"/>'
    +'<path data-p="inchiostro" d="M128,232 q3,-4 6,0 t6,0 t6,0" fill="none" stroke="#1f2a55" stroke-width="1.2" stroke-dasharray="40" stroke-dashoffset="40"/></g>';
  if(azione==='stretta') sopra='<g data-p="altro"><path d="M232,150 L190,174 L192,194 L234,172 Z" fill="#3a3d45"'+t+'/>'
    +'<ellipse cx="180" cy="186" rx="11" ry="8.5" fill="'+(n.scura?'#d7a77f':'#8d5b36')+'"'+t+'/></g>';
  const braccio=function(lato){ const x=PERS_SPALLA[lato][0], dx=lato==='dx';
    const penna=(dx && azione==='firma') ? '<path d="M'+(x-3)+',214 L'+(x+9)+',232" stroke="#1b1b22" stroke-width="2.4" stroke-linecap="round"/><path d="M'+(x+8)+',230 L'+(x+10)+',234" stroke="#d6b25e" stroke-width="2"/>' : '';
    return '<g data-p="br'+lato+'" transform="rotate('+P0[lato][0].toFixed(2)+' '+x+' 112)"><rect x="'+(x-10)+'" y="104" width="20" height="66" rx="9.5" fill="'+V.g+'"'+t+'/>'
      +'<g data-p="av'+lato+'" transform="rotate('+P0[lato][1].toFixed(2)+' '+x+' 166)"><rect x="'+(x-9)+'" y="160" width="18" height="50" rx="8.5" fill="'+V.g+'"'+t+'/>'
      +'<rect x="'+(x-8)+'" y="203" width="16" height="5" fill="'+V.cam+'"'+t+'/>'
      +'<circle cx="'+x+'" cy="216" r="9" fill="'+P.p+'"'+t+'/><ellipse cx="'+(dx?x-7:x+7)+'" cy="212" rx="3" ry="5" fill="'+P.p+'"'+t+' transform="rotate('+(dx?30:-30)+' '+(dx?x-7:x+7)+' 212)"/>'+penna+'</g></g>'; };
  return '<svg class="personaggio" viewBox="-20 0 240 320" role="img" aria-hidden="true" data-azione="'+azione+'">'
    +dietro
    +'<g data-p="corpo"><g data-p="gambe">'+gambe+'</g><g data-p="busto">'+busto+testa+'</g></g>'
    +'<g data-p="braccia">'+braccio('sx')+braccio('dx')+'</g>'+sopra+'</svg>';
}

/* ---------- le pose: angoli delle braccia (gradi, 0 = giù) o un bersaglio per la mano (cinematica inversa) ---------- */
function persIk(lato, tx, ty){
  const Sp=PERS_SPALLA[lato], L1=PERS_L1, L2=PERS_L2, dx=tx-Sp[0], dy=ty-Sp[1];
  let d=Math.hypot(dx,dy); d=Math.min(d, L1+L2-0.5); d=Math.max(d, Math.abs(L1-L2)+0.5);
  const a=Math.atan2(dy,dx), b=Math.acos((L1*L1+d*d-L2*L2)/(2*L1*d));
  let best=null;
  [a-b, a+b].forEach(function(u){ const ex=Sp[0]+L1*Math.cos(u), ey=Sp[1]+L1*Math.sin(u), fa=Math.atan2(Sp[1]+d*Math.sin(a)-ey, Sp[0]+d*Math.cos(a)-ex);
    if(!best || ey>best.ey) best={ey:ey, u:u, fa:fa}; });
  return [best.u*180/Math.PI-90, (best.fa-best.u)*180/Math.PI];
}
const PERS_UMORE = { respiro:1, vittoria:3.5, sconfitta:-2.5, firma:1, stretta:2.5, comizio:1.5, giuramento:0.6, parla:1 };
/* t in secondi dall'inizio dell'azione → la posa di quell'istante */
function persPosa(a, t){
  const s=Math.sin, P={sx:[6,-4], dx:[-6,4], testaR:0, testaY:0, corpoY:0, salto:0, umore:PERS_UMORE[a]!=null?PERS_UMORE[a]:1, palpebra:1};
  if(a==='comizio'){ P.dx=[-150+9*s(t*2.4), -14+10*s(t*2.4+1)]; P.sx=[14, -40]; P.testaR=-3+2*s(t*.9); }
  if(a==='firma'){ const ciclo=t%5, scrive=ciclo<3;
    P.dx=persIk('dx', 116+(scrive?(ciclo*6%18)+3*s(t*11):10), 218+(scrive?1.6*s(t*22):-10)); P.sx=persIk('sx', 84, 222);
    P.testaR=scrive?7:-1; P.testaY=scrive?3:0; P.umore=scrive?0.4:2.2; P.inchiostro=Math.min(1, ciclo/3); }
  if(a==='stretta'){ const scuoti=4.5*s(t*7)*(t%3<1.6?1:0.15); P.dx=persIk('dx', 174, 184+scuoti); P.scuoti=scuoti; P.sx=[3,-2]; P.testaR=-2; }
  if(a==='vittoria'){ const w=6*s(t*3); P.dx=[-146+w, -12]; P.sx=[146-w, 12]; P.salto=-Math.abs(s(t*3))*5; P.testaR=-4; }
  if(a==='sconfitta'){ P.dx=[2, 6]; P.sx=[-2,-6]; P.corpoY=4; P.testaY=6; P.testaR=8+1.5*s(t*.7); P.palpebra=0.55; }
  /* il giuramento (nuovo): la mano destra si alza accanto alla testa, palmo avanti; la sinistra sul petto */
  if(a==='giuramento'){ const k=Math.min(1, t/1.2), e=k*k*(3-2*k);
    const su=persIk('dx', 150, 70+1.2*s(t*1.3)), giu=[-6,4];
    P.dx=[giu[0]+(su[0]-giu[0])*e, giu[1]+(su[1]-giu[1])*e]; P.sx=persIk('sx', 96, 150); P.testaR=-1; P.testaY=-1; }
  return P;
}
function persLerp(a,b,k){ return a+(b-a)*k; }
function persMescola(A, B, k){ if(k>=1) return B; const R=Object.assign({}, B);
  ['sx','dx'].forEach(function(l){ R[l]=[persLerp(A[l][0],B[l][0],k), persLerp(A[l][1],B[l][1],k)]; });
  ['testaR','testaY','corpoY','salto','umore','palpebra'].forEach(function(n){ R[n]=persLerp(A[n]||0,B[n]||0,k); }); return R; }
/* la bocca «a tempi fissi» (l'ampiezza vera con l'AnalyserNode è L248-5): dal testo spalmato sulla durata, o da un
   ritmo di sillabe se il testo non c'è */
function persApertaDaLettera(ch){ if(!ch) return 0; if(/[aeiouàèéìòù]/i.test(ch)) return 0.85; if(/[,.;:!?]/.test(ch)) return 0; if(ch===' ') return 0.08; if(/[mbp]/i.test(ch)) return 0.05; return 0.35; }
function persApertura(I, t){
  if(I.azione!=='parla') return 0;
  const dur=Math.max(0.2, (I.opz.durataMs||2000)/1000);
  if(t>=dur) return 0;
  if(I.mov!=='pieno') return 0.3;
  const tx=I.opz.testo;
  if(tx) return persApertaDaLettera(tx[Math.floor(t/dur*tx.length)])*(0.75+0.25*Math.sin(t*31));
  const sill=(t*5.2)%1; return sill<0.6 ? 0.25+0.6*Math.sin(sill/0.6*Math.PI) : 0;
}

/* ---------- il ciclo: UNO per tutto il modulo ---------- */
const PERS_VIVE = [];
let PERS_RAF = 0;
function persMov(){ try{ if(typeof movimentoModo==='function') return movimentoModo(); }catch(e){} return 'pieno'; }
function persAvvia(){ if(!PERS_RAF && PERS_VIVE.length) PERS_RAF=requestAnimationFrame(persFotogramma); }
function persFotogramma(ms){
  PERS_RAF=0;
  const now=ms/1000;
  for(let i=PERS_VIVE.length-1;i>=0;i--){
    const I=PERS_VIVE[i];
    if(!I.el.isConnected || !I.svg.isConnected){ I.vivo=false; PERS_VIVE.splice(i,1); continue; }   // l'elemento è uscito dal documento: l'istanza esce da sola
    try{ persDisegna(I, now); }catch(e){ I.vivo=false; PERS_VIVE.splice(i,1); }
  }
  persAvvia();   // senza istanze non chiede il fotogramma dopo
}
function persDisegna(I, now){
  if(I.t0==null){ I.t0=now; I.blink=now+2+Math.random()*3; }
  const piena=I.mov==='pieno', ta=now-I.t0;
  let P=persPosa(I.azione==='parla'?'respiro':I.azione, piena ? ta : PERS_POSE_CHIAVE[I.azione]);
  if(I.azione==='parla') P.umore=PERS_UMORE.parla;
  const k=I.mov==='spento' ? 1 : Math.min(1, ta/0.45);
  if(I.da && k<1) P=persMescola(I.da, P, k*k*(3-2*k));
  I.ora=P;
  const resp=piena ? Math.sin(now*1.7)*0.9 : 0, y=(P.corpoY||0)+(P.salto||0), R=I.ref;
  R.corpo.setAttribute('transform','translate(0,'+(y+resp*0.3).toFixed(2)+')');
  R.braccia.setAttribute('transform','translate(0,'+(y+resp*0.8).toFixed(2)+')');
  R.busto.setAttribute('transform','translate(0,'+(resp*0.5).toFixed(2)+')');
  R.gambe.setAttribute('transform','translate(0,'+(-(y)+(P.salto||0)).toFixed(2)+')');
  R.testa.setAttribute('transform','translate(0,'+(P.testaY+resp*0.25).toFixed(2)+') rotate('+P.testaR.toFixed(2)+' 100 92)');
  R.brsx.setAttribute('transform','rotate('+P.sx[0].toFixed(2)+' 62 112)'); R.avsx.setAttribute('transform','rotate('+P.sx[1].toFixed(2)+' 62 166)');
  R.brdx.setAttribute('transform','rotate('+P.dx[0].toFixed(2)+' 138 112)'); R.avdx.setAttribute('transform','rotate('+P.dx[1].toFixed(2)+' 138 166)');
  let pal=P.palpebra;
  if(piena){ if(now>I.blink+0.14) I.blink=now+2+Math.random()*3; if(now>I.blink) pal=Math.min(pal, 0.08); }
  const sc=function(cx){ return 'translate('+cx+',58) scale(1,'+pal.toFixed(2)+') translate('+(-cx)+',-58)'; };
  R.occhioSx.setAttribute('transform', sc(89)); R.occhioDx.setAttribute('transform', sc(111));
  const ap=persApertura(I, ta); I.apertura=persLerp(I.apertura||0, ap, piena?0.45:1);
  const festa=(I.azione==='vittoria' && piena) ? 0.35+0.25*Math.sin(now*6) : 0;
  R.bocca.setAttribute('d', persBocca(Math.max(I.apertura, festa), P.umore));
  if(R.altro) R.altro.setAttribute('transform','translate(0,'+((P.scuoti||0)).toFixed(2)+')');
  if(R.inchiostro) R.inchiostro.setAttribute('stroke-dashoffset', (40*(1-(P.inchiostro==null?1:P.inchiostro))).toFixed(1));
}
/* anima il personaggio dentro `el`: se `el` non ha già il disegno di questa azione lo scrive; un'animazione già
   viva sullo stesso elemento passa la mano (la posa nuova parte da quella di prima, tranne con il movimento spento) */
function personaggioAnima(el, azione, opz){
  if(!el) return { stop:function(){} };
  azione=PERS_AZIONI.indexOf(azione)>=0 ? azione : 'respiro';
  opz=Object.assign({}, opz||{}, {posa:azione});
  let da=null;
  if(el.__pers){ da=el.__pers.ora||null; el.__pers.stop(); }
  el.innerHTML=personaggioSVG(opz);
  const svg=el.querySelector('svg.personaggio'), ref={};
  svg.querySelectorAll('[data-p]').forEach(function(n){ ref[n.getAttribute('data-p')]=n; });
  const I={ el:el, svg:svg, ref:ref, azione:azione, opz:opz, mov:persMov(), da:da, ora:null, t0:null, apertura:0, vivo:true };
  I.stop=function(){ if(!I.vivo) return; I.vivo=false; const j=PERS_VIVE.indexOf(I); if(j>=0) PERS_VIVE.splice(j,1); if(el.__pers===I) el.__pers=null;
    if(!PERS_VIVE.length && PERS_RAF){ cancelAnimationFrame(PERS_RAF); PERS_RAF=0; } };
  el.__pers=I; PERS_VIVE.push(I); persAvvia();
  return { stop:I.stop };
}
