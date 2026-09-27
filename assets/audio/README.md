# Suoni e musica del gioco — cartella dei file (L95-3, L114-1/2)
Effetti: i quattordici nomi di AUDIO_MANIFEST in js/audio.js. Dal L114-2 tredici sono MP3 di ElevenLabs; `tocco.wav` resta il sintetico di .claude/genera-audio.js.
Musica: gli undici brani di MUSICA_MANIFEST (mus-*.mp3, 192 kbps), stessa cartella.
Un file che manca è silenzio, non un errore: dopo aver cambiato un file aggiorna il manifesto e AUDIO_PRESENTI / MUSICA_PRESENTI, e lancia node .claude/verifica-asset.js.
