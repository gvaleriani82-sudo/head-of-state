/* ============================================================================
   SISTEMA ICONE v2 (lotto 1b — salto di qualità). Pittogrammi SVG inline, griglia 24×24 con
   LIVE-AREA 20×20 (padding ottico 2), stroke UNICO 2px (in CSS .ico), cap/join round su tutto il set,
   geometria pulita (raggi costanti, niente tratto a mano libera), una metafora essenziale per icona,
   correzione ottica del baricentro. Standard di famiglia: giustizia/consenso (costruzione Lucide).
   Famiglia-persone (lavoratori/giovani/pensionati): stessa costruzione testa/busto + attributo.
   stroke=currentColor (mai colori-brand di partito), fill=none. Degrado: chiave mancante → ''.
   ============================================================================ */
const ICONS = {
  /* --- 6 gruppi sociali --- */
  lavoratori:  '<path d="M6 15.5a6 6 0 0 1 12 0"/><path d="M4.5 15.5h15"/><path d="M10.4 10.3V8.1a1.6 1.6 0 0 1 3.2 0v2.2"/>',                                        // elmetto da cantiere (cupola + falda + banda)
  pensionati:  '<circle cx="9.5" cy="7.5" r="3.6"/><path d="M3.5 21a6 6 0 0 1 12 0"/><path d="M18 9.5a2 2 0 0 0-2 2v9"/>',                                            // busto + bastone pulito (approvata B)
  cetomedio:   '<path d="M3.5 10.6 12 3.8l8.5 6.8"/><path d="M5.8 9.2V19a1.6 1.6 0 0 0 1.6 1.6h9.2A1.6 1.6 0 0 0 18.2 19V9.2"/><path d="M10 20.6v-5.2h4v5.2"/>',      // casa con porta
  imprenditori:'<path d="M3.5 20.5h17"/><path d="M3.5 20.5V5.5a1 1 0 0 1 1-1h2.6a1 1 0 0 1 1 1v7.1l5.2-3.8v3.8l5.2-3.8v11.7"/>',                                       // fabbrica (torre + denti)
  giovani:     '<path d="M12 4.8 3.5 8l8.5 3.2L20.5 8z"/><path d="M8 12.4v2.6c0 1.7 8 1.7 8 0v-2.6"/><path d="M20.5 8v4.2"/>',                                        // tocco di laurea (tavola + calotta + nappa)
  cattolici:   '<circle cx="17" cy="6.6" r="1.4"/><path d="M18.5 6.9l2 .8-2.1.6"/><path d="M16.2 9.2c-.7 4-3.4 6.3-8 7H3.6l3.6-2.6c-1.7-.9-2.4-2.5-2-4.8 2.2 1.4 4.4 1.8 6.7 1.1"/><path d="M12.6 9.5c.1-2.9 1.7-4.7 4.6-5.4"/>',   // colomba geometrica rifinita (testa+becco fine+corpo+ala; civile, niente simboli religiosi)

  /* --- 10 ministeri / settori --- */
  economia:    '<ellipse cx="12" cy="6.5" rx="7.5" ry="3"/><path d="M4.5 6.5v4.6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6.5"/><path d="M4.5 11.1v4.6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-4.6"/>',   // pila di monete (approvata B)
  interno:     '<path d="M12 3.4 5.4 5.9v4.8c0 4.6 2.7 7.4 6.6 8.9 3.9-1.5 6.6-4.3 6.6-8.9V5.9z"/>',                                                                   // scudo
  giustizia:   '<path d="M12 3v18"/><path d="M7 21h10"/><path d="M4.5 7h3c1.8 0 4.5-1 6-1.8 1.5.8 4.2 1.8 6 1.8h-1"/><path d="m2.5 15 3-7.5 3 7.5c-1.8 1.4-4.2 1.4-6 0"/><path d="m15.5 15 3-7.5 3 7.5c-1.8 1.4-4.2 1.4-6 0"/>',   // bilancia (standard famiglia)
  esteri:      '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2"/><path d="M12 3.4a13.2 13.2 0 0 1 0 17.2 13.2 13.2 0 0 1 0-17.2z"/>',                          // globo
  difesa:      '<path d="m6 9.8 6-3.6 6 3.6"/><path d="m6 14 6-3.6 6 3.6"/><path d="m6 18.2 6-3.6 6 3.6"/>',                                                          // gradi (chevron, passo costante)
  lavoro:      '<path d="M12 3v2"/><path d="M3.2 12.5a8.8 5 0 0 1 17.6 0Z"/><path d="M3.2 12.5c1.4 0 1.4 1.3 2.8 1.3s1.4-1.3 2.8-1.3 1.4 1.3 2.8 1.3 1.4-1.3 2.8-1.3 1.4 1.3 2.8 1.3 1.4-1.3 2.8-1.3"/><path d="M12 12.5v7a2.3 2.3 0 0 1-4.6 0"/>',   // ombrello = protezione sociale (approvata)
  salute:      '<circle cx="12" cy="12" r="8.6"/><path d="M12 8v8M8 12h8"/>',                                                                                          // croce medica in tondo
  istruzione:  '<path d="M12 6.8c-2.1-1.5-4.9-2-8.3-1.6a.9.9 0 0 0-.8.9v11.6a.9.9 0 0 0 1 .9c3-.3 5.7.2 8.1 1.6 2.4-1.4 5.1-1.9 8.1-1.6a.9.9 0 0 0 1-.9V6.1a.9.9 0 0 0-.8-.9c-3.4-.4-6.2.1-8.3 1.6z"/><path d="M12 6.8v13"/>',   // libro aperto
  sviluppo:    '<path d="M12 21.2v-8.7"/><path d="M12 12.5c0-4.1 3-6.9 7.7-6.9 0 4.1-3 6.9-7.7 6.9z"/><path d="M12 14.8c0-3-2.2-5-5.6-5 0 3 2.2 5 5.6 5z"/>',          // germoglio
  infrastrutture:'<path d="M2 16.5h20"/><path d="M6.5 16.5V7M17.5 16.5V7"/><path d="M6.5 7c2.2 6 8.8 6 11 0"/><path d="M2 16.5C3.4 11 4.8 7.6 6.5 7M17.5 7c1.7.6 3.1 4 4.5 9.5"/>',   // ponte sospeso (torri + catenarie, profilo completo)

  /* --- indicatori --- */
  consenso:    '<path d="M7 11v10"/><path d="M11 6.5 10 11h6.5a2 2 0 0 1 2 2.4l-1.4 6A2 2 0 0 1 15.2 21H7V11l3.2-6.4A2.5 2.5 0 0 1 11 6.5Z"/>',                        // pollice su (standard famiglia)
  crescita:    '<path d="m2.8 17.2 7-7 4.4 4.4 7-7"/><path d="M15.4 7.6h5.8v5.8"/>',                                                                                   // trend in salita
  debito:      '<path d="m2.8 6.8 7 7 4.4-4.4 7 7"/><path d="M15.4 16.4h5.8v-5.8"/>',                                                                                  // trend in discesa
  reputazione: '<path d="m12 3.4 2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.4l-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',                                                                   // stella
  stampa:      '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M18 6h-8M18 10h-8"/>',   // giornale (Lucide)
  esposizione: '<path d="M2.06 12.35a1 1 0 0 1 0-.7C3.42 8.1 7.4 5 12 5s8.58 3.1 9.94 6.65a1 1 0 0 1 0 .7C20.58 15.9 16.6 19 12 19s-8.58-3.1-9.94-6.65Z"/><circle cx="12" cy="12" r="3"/>',   // occhio (Lucide)
  mercati:     '<path d="M3.5 3.5v15a2 2 0 0 0 2 2h15"/><path d="M8.5 16v-4.5M13 16V8M17.5 16v-6"/>',                                                                  // grafico a barre con assi
};
/* alias: alcuni indicatori-servizio riusano l'icona di settore */
ICONS.sanita = ICONS.salute;
ICONS.sicurezza = ICONS.interno;
ICONS.ambiente = ICONS.sviluppo;

/* helper: SVG accessibile. label = significato (gruppo/indicatore/ministero). Chiave mancante → '' (l'etichetta resta). */
function icon(key, label){
  const p = ICONS[key];
  if(!p) return '';
  const lab = (label==null ? '' : String(label)).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  return `<svg class="ico" viewBox="0 0 24 24" role="img"${lab?` aria-label="${lab}"`:' aria-hidden="true"'}>${lab?`<title>${lab}</title>`:''}${p}</svg>`;
}
