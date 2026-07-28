/* AVATAR-GIOCATORE (L11-2, 26/7) — 10 ritratti ILLUSTRATI (256px WebP, file in assets/ui/), uno per
   macro-area × genere. Sostituiscono i 5 fotorealistici `av1..av5` (cancellati: gli originali restano in
   arte-sorgente/). Registro coerente coi 50 ritratti-ministro, ma con un tratto marcato (occhiali, barba,
   capelli lunghi, età fuori dalla scala 40/52/62) così il giocatore non ritrova la propria faccia su un ministro.
   Vecchi salvataggi con `S.avatar='av1'..'av5'`: `avatarImg` non trova l'id → null → nessun volto (l'iniziale),
   e `applySnap` azzera il riferimento morto. Nessun errore, nessun caricamento rotto. */
const AVATARS = [
  {"id": "pg-occ-m", "img": "assets/ui/pg-occ-m.webp"},
  {"id": "pg-occ-f", "img": "assets/ui/pg-occ-f.webp"},
  {"id": "pg-lat-m", "img": "assets/ui/pg-lat-m.webp"},
  {"id": "pg-lat-f", "img": "assets/ui/pg-lat-f.webp"},
  {"id": "pg-asi-m", "img": "assets/ui/pg-asi-m.webp"},
  {"id": "pg-asi-f", "img": "assets/ui/pg-asi-f.webp"},
  {"id": "pg-sud-m", "img": "assets/ui/pg-sud-m.webp"},
  {"id": "pg-sud-f", "img": "assets/ui/pg-sud-f.webp"},
  {"id": "pg-afr-m", "img": "assets/ui/pg-afr-m.webp"},
  {"id": "pg-afr-f", "img": "assets/ui/pg-afr-f.webp"}
];
