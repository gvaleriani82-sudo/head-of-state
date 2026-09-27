# Suoni e musica del gioco — cartella dei file (L95-3, L114-1/2)
Effetti: i nomi di AUDIO_MANIFEST in js/audio.js (46 dal L118-1: i venti del terzo giro sono una lista-promessa, entrano in AUDIO_PRESENTI quando arriva il file; `scheda.mp3` è uscito). Dal L114-2 tredici sono MP3 di ElevenLabs; `tocco.wav` resta il sintetico di .claude/genera-audio.js.
Musica: i brani di MUSICA_MANIFEST (mus-*.mp3), stessa cartella; dal L118-1 anche le varianti `-b` dei temi (mus-1970-b, 128 kbps) e il tema della home `mus-tema` (atteso).
Un file che manca è silenzio, non un errore: dopo aver cambiato un file aggiorna il manifesto e AUDIO_PRESENTI / MUSICA_PRESENTI, e lancia node .claude/verifica-asset.js.
