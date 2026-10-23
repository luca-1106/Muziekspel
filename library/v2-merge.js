(() => {
  'use strict';
  const lists = [
    window.LIB_V2_POP,
    window.LIB_V2_ROCK,
    window.LIB_V2_NEDERLANDS,
    window.LIB_V2_GUILTY,
    window.LIB_V2_YACHTROCK,
    window.LIB_V2_SOUL,
    window.LIB_V2_FUNKDISCO,
    window.LIB_V2_COUNTRY,
    window.LIB_V2_GITAAR,
    window.LIB_V2_BLUES_JAZZ_SWING
  ];
  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const merged = new Map();
  for (const list of lists) {
    for (const track of (Array.isArray(list) ? list : [])) {
      if (!track?.title || !track?.artist) continue;
      const key = `${normalize(track.artist)}\u0000${normalize(track.title)}`;
      if (!merged.has(key)) {
        merged.set(key, { ...track, genres: [...new Set(track.genres || [])] });
        continue;
      }
      const existing = merged.get(key);
      existing.genres = [...new Set([...(existing.genres || []), ...(track.genres || [])])];
      if (!existing.spotifyUri && track.spotifyUri) existing.spotifyUri = track.spotifyUri;
      if ((!existing.year || Number(track.year) < Number(existing.year)) && track.year) existing.year = track.year;
    }
  }
  window.TRACKS = [...merged.values()];
})();
