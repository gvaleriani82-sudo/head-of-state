# Suoni del gioco — cartella dei file (L95-3)
I quattordici file sono quelli di AUDIO_MANIFEST in js/audio.js, generati da .claude/genera-audio.js: WAV mono 22,05 kHz, picco -3 dBFS. Un campione CC0 li può sostituire (.wav o .mp3).
Un file che manca è silenzio, non un errore: dopo aver cambiato un file aggiorna AUDIO_MANIFEST e AUDIO_PRESENTI, e lancia node .claude/verifica-asset.js.
