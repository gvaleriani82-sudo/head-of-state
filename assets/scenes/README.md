# assets/scenes — le scene servite come file

Qui vivono le immagini di scena servite come **file**. I base64 dentro `js/scenes.js` sono stati
rimossi (B2, 26 lug 2026): il set vecchio è stato **sostituito**, non estratto.

**95 file** — assegnazioni da [`CATALOGO-SCENE.md`](../../CATALOGO-SCENE.md). I nomi qui
sono le *destinazioni* del catalogo; i sorgenti restano in `assets/nuove` e `assets/lotto2..5`.
Include le **scene dei momenti** (L9-1): intervista/notte/telefono/finale/soglia + `sanita-anni50`/`ordinepubblico-anni50`.
Le scene-momento NON stanno nel selettore-carta (`SCENES`) ma in `SCENA_MOMENTO` (js/scenes.js), cablate nei render.

## Come si aggancia un'immagine

Un solo passaggio: in `js/scenes.js` il valore del bucket diventa il path, relativo alla root del sito.

```js
const SCENES = {
  economia: 'assets/scenes/economia-base.webp',
  sanita:   { grave:'assets/scenes/sanita-grave.webp',
              base: 'assets/scenes/sanita-base.webp',
              florido:'assets/scenes/sanita-florido.webp' },
  // array = rotazione per-carta (hash stabile sull'id): stessa carta → stessa immagine
  infrastrutture: { grave:['assets/scenes/infra-grave-1.webp','assets/scenes/infra-grave-2.webp'] },
};
```

Nessun altro cablaggio. `scenaSrc` (in `js/ui.js`) riconosce la forma della stringa: data-URL
`data:…` oppure path/URL d'asset. Le due forme convivono, quindi la migrazione può essere
bucket per bucket.

## Vincoli

- **WebP**, 16/9 (gli slot `#home-hero` e `.ag-scene` hanno `aspect-ratio:16/9` + `object-fit:cover`).
- Path **relativi senza slash iniziale** (`assets/scenes/…`): funzionano sia in locale sia su
  GitHub Pages servito da sottocartella.
- Il MIME `.webp` è servito da `.claude/static-server.js`; su Pages ci pensa `.nojekyll` a non
  far filtrare nulla.
- Uno slot assente o un file mancante **non rompe niente**: la carta esce senza scena (graceful).

## Nomi e varianti

`<bucket>[-<variante>][-<era>].webp`. Le varianti tonali sono `-grave` / `-florido` (senza suffisso
= `base`); le epoche sono `-anni50` / `-anni60`.

⚠️ **Nel file il suffisso è `-anni50`, nel codice la chiave è `italia1950`**: il nome viene dal
catalogo, la chiave è il tag-era del motore (`LINEE_STORICHE`, `eraCombacia`). Non è una svista.

## I 5 buchi dichiarati — TAPPATI (L8-1, 26/7)

`sanita-base` · `scuola-base` · `ordinepubblico-base` · `giustizia-grave` · `stampa-base` — colmati
con un lotto ChatGPT ad hoc, ora cablati in `js/scenes.js`. In più `crisi-anni50` copre lo scenario '50.
⚠️ Le 5 nuove `base` non sono era-flaggate (default universale): se qualcuna è moderna si vedrebbe nel
'50 — da guardare a occhio giocando l'Italia-'50.
