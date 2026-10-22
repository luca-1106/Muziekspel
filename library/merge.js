// Combineer genres en ontdubbel nummers op artiest + titel.
// Een nummer mag bij meerdere genres horen.
(() => {
  const lists = [window.REFRESH_YACHTROCK, window.REFRESH_ROCK, window.REFRESH_DISCO, window.REFRESH_GITAAR, window.REFRESH_NEDERLANDS, window.EXTRA_HIPHOP, window.EXTRA_COUNTRY, window.EXTRA_DANCE, window.EXTRA_POP, window.EXTRA_SOUL];
  const merged = new Map();
  const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl').replace(/[^a-z0-9]+/g, ' ').trim();
  for (const list of lists) {
    for (const track of (Array.isArray(list) ? list : [])) {
      if (!track.title || !track.artist) continue;
      const key = normalize(track.artist) + '\0' + normalize(track.title);
      if (!merged.has(key)) merged.set(key, { ...track, genres: [...new Set(track.genres || [])] });
      else {
        const existing = merged.get(key);
        existing.genres = [...new Set([...existing.genres, ...(track.genres || [])])];
        if (!existing.spotifyUri && track.spotifyUri) existing.spotifyUri = track.spotifyUri;
      }
    }
  }
  window.TRACKS = [...merged.values()];
})();
