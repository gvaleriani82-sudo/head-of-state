"use strict";
/* ============================================================
   CORE — basi condivise da tutti gli altri file.
   Caricato per primo. Contiene: piccoli helper di formato,
   costanti del gioco e lo STATO globale della partita.
   ============================================================ */

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=(n,d=1)=>{ const s=Number(n).toFixed(d); return (typeof curLang==='function'&&curLang()==='en')?s:s.replace('.',','); };   // i18n: punto decimale in EN, virgola in IT
const sign=(n,d=1)=>(n>0?'+':'')+fmt(n,d);
const MONTHS=["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const PROF={tecnico:"Tecnico",progressista:"Progressista",conservatore:"Conservatore",populista:"Populista"};
/* Colori profilo (chip/avatar): HEX, così la tinta inline `${PROFCOL[p]}22` (8 cifre = ~13% alpha) è CSS valido.
   Tema scuro archiviato: tecnico #6f93d6, progressista #3fae74, conservatore #8f86d8, populista #e3b04b. */
const PROFCOL={tecnico:"#2f6fbf",progressista:"#1a7d44",conservatore:"#6a4fb0",populista:"#946112"};

/* Stato globale del gioco.
   S   = partita in corso (null finché non si inizia).
   APT = stato temporaneo della schermata di nomina dei ministri. */
let S=null, APT=null;
/* livello di difficoltà scelto nella schermata iniziale (transitorio finché non parte la partita;
   poi salvato in S.diff e non più modificabile). */
let chosenDiff='normale';
/* paese e partito scelti nella schermata iniziale (transitori; il partito finisce in S.partito).
   chosenPartito viene impostato da setCountry() sul partito più forte del paese scelto. */
let chosenCountry='italia', chosenPartito=null;
/* Build B — scenario d'epoca scelto nel setup: 'presente' (default, com'era) o un id di SCENARI (es. 'italia1950'). */
let chosenScenario='presente';
/* ruolo d'avvio scelto nella schermata iniziale: 'governo' (default, com'era) o 'opposizione' (parti da sfidante). */
let chosenMode='governo';
/* schermata "Chi sei" (sistema narrativo, lotto 2): raccolta transitoria come APT — initStatoBase la copia
   in S.personaggio/S.eta e applica i crediti d'esordio. null = saltata → personaggio neutro. */
let CREA=null;
