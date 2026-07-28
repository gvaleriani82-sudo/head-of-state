"use strict";
/* ============================================================
   TOUCH — ponte "tocco → click" per iPhone/iPad (Safari).
   Carica per ultimo. Su alcuni iPhone il tap su un pulsante non
   si trasforma in "click" (i pulsanti sembrano morti). Qui
   intercettiamo noi il tocco e lanciamo il click giusto, così i
   pulsanti rispondono sempre. Su computer (mouse) non fa nulla:
   gli eventi "touch" non esistono, quindi il codice resta inerte.
   ============================================================ */
(function(){
  // Solo su dispositivi col tocco: altrove non serve e non si installa.
  var hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if(!hasTouch) return;

  // Elementi "toccabili": tutti i comandi del gioco.
  var SEL = 'button, .tab, .opt, .cand, .mini-btn, .seg button, [onclick]';

  var startX = 0, startY = 0, moved = false, lastTap = 0;

  document.addEventListener('touchstart', function(e){
    if(e.touches.length !== 1){ moved = true; return; }   // due dita = gesto, non un tap
    moved = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, {passive:true});

  document.addEventListener('touchmove', function(e){
    if(!e.touches.length) return;
    // se il dito si sposta troppo è uno scorrimento, non un tap: non interveniamo
    if(Math.abs(e.touches[0].clientX - startX) > 10 ||
       Math.abs(e.touches[0].clientY - startY) > 10) moved = true;
  }, {passive:true});

  document.addEventListener('touchend', function(e){
    if(moved) return;                                      // era uno scorrimento
    var t = e.target;
    var el = (t && t.closest) ? t.closest(SEL) : null;
    if(!el || el.disabled) return;                         // non è un comando, o è disattivato
    // I fondali dei modali (.ov) si chiudono solo toccando il fondale stesso,
    // non il contenuto della finestra: così un tap dentro al modale non lo chiude.
    if(el.classList && el.classList.contains('ov') && t !== el) return;

    e.preventDefault();   // blocca il "click fantasma" che Safari genererebbe dopo: niente doppio invio
    lastTap = Date.now();
    if(typeof el.click === 'function') el.click();   // lanciamo noi il click: esegue l'onclick del pulsante
    else el.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));   // elementi SVG (la mappa): alcuni Safari non hanno .click() lì
  }, {passive:false});

  // Cintura di sicurezza: se un iPhone genera comunque il suo click "vero" subito dopo
  // il nostro, lo scartiamo (il nostro el.click() non è "fidato", quello di Safari sì).
  document.addEventListener('click', function(e){
    if(e.isTrusted && (Date.now() - lastTap) < 700){
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
})();
