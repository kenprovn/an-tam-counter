audio-fixtures.js embeds two locally generated, synthetic FFmpeg test signals:
440 Hz sine tone and silence, mono 24 kHz. They contain no speech and are never
copied into public/audio/sonia or the production build. They are decoder test
fixtures, not Sonia samples. No Microsoft service was used to create them.
The encoded test bytes live in JavaScript; no MP3 binary is committed here.
