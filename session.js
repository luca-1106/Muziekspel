(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const genre = sessionStorage.getItem('muziekmix.session.genre');
  const genreNames = { alles: 'Alle genres', yachterock: 'Yachtrock', rock: 'Rock', disco: 'Disco', gitaarmuziek: 'Gitaarmuziek', nederlands: 'Nederlands' };
  const allTracks = Array.isArray(window.TRACKS) ? window.TRACKS.filter(track => track?.title && track?.artist) : [];
  const key = track => `${track.title}\u0000${track.artist}`.toLowerCase();
  const normalise = value => String(value || '').toLocaleLowerCase('nl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const matching = allTracks.filter(track => genre === 'alles' || (Array.isArray(track.genres) ? track.genres.includes(genre) : track.genre === genre));
  const tracks = [...new Map(matching.map(track => [key(track), track])).values()];
  let used = new Set(), spotifyTrack = null, isPlaying = false, elapsedBeforePause = 0, startedAt = 0, timer = null;
  const setError = message => { $('#errorMessage').textContent = message || ''; $('#errorMessage').hidden = !message; };
  const setStatus = (title, detail, active = false) => { $('#statusText').textContent = title; $('#instruction').textContent = detail; $('#statusDot').classList.toggle('active', active); };
  const setPauseButton = (icon, text) => { $('#pauseButton').innerHTML = `<span class="button-icon">${icon}</span><span>${text}</span>`; };
  const formatTime = value => `${Math.floor(Math.max(0, value) / 60)}:${String(Math.floor(Math.max(0, value) % 60)).padStart(2, '0')}`;
  function updateCount() { $('#sessionCount').textContent = `${used.size} / ${tracks.length}`; }
  function stopTimer() { clearInterval(timer); timer = null; }
  function updateProgress() { const duration = Math.max(1, Number(spotifyTrack?.duration_ms || 0) / 1000), elapsed = elapsedBeforePause + (isPlaying ? (Date.now() - startedAt) / 1000 : 0); $('#timeLabel').textContent = `${formatTime(elapsed)} / ${formatTime(duration)}`; $('#progressBar').style.width = `${Math.min(100, elapsed / duration * 100)}%`; }
  function startTimer() { stopTimer(); updateProgress(); timer = setInterval(updateProgress, 500); }
  function score(item, source) { const title = normalise(source.title), artist = normalise(source.artist), itemArtists = item.artists?.map(person => normalise(person.name)) || []; if (normalise(item.name) !== title || !itemArtists.includes(artist)) return -Infinity; const version = normalise(`${item.name} ${item.album?.name || ''}`); return 100 - (/(live|karaoke|tribute|cover|instrumental)/.test(version) ? 80 : 0) - (/(remaster|remastered)/.test(version) ? 5 : 0); }
  async function resolve(source) {
    if (source.spotifyUri?.startsWith('spotify:track:')) return window.SpotifyApp.request(`/tracks/${encodeURIComponent(source.spotifyUri.slice(14))}`);
    // Spotify Development Mode accepteert sinds 2026 maximaal 10 resultaten per zoekopdracht.
    const result = await window.SpotifyApp.request(`/search?q=${encodeURIComponent(`track:${source.title} artist:${source.artist}`)}&type=track&limit=10`);
    const found = (result.tracks?.items || []).map(item => ({ item, score: score(item, source) })).filter(candidate => candidate.score > 0).sort((a, b) => b.score - a.score)[0]?.item;
    if (!found) throw new Error(`Geen betrouwbare Spotify-versie gevonden voor ${source.title} van ${source.artist}.`);
    return found;
  }
  function renderTrack(track) { spotifyTrack = track; $('#trackTitle').textContent = track.name; $('#trackArtist').textContent = track.artists.map(person => person.name).join(', '); $('#trackLink').href = track.external_urls?.spotify || 'https://open.spotify.com'; $('#trackLink').hidden = false; const image = track.album?.images?.[0]?.url; $('#albumArt').hidden = !image; $('#albumFallback').hidden = Boolean(image); if (image) { $('#albumArt').src = image; $('#albumArt').alt = `Albumhoes: ${track.album.name}`; } }
  async function nextTrack() {
    const candidates = tracks.filter(track => !used.has(key(track)));
    if (!candidates.length) { isPlaying = false; stopTimer(); $('#pauseButton').disabled = true; $('#nextButton').disabled = true; $('#playState').textContent = 'AFGEROND'; setStatus('Sessie afgerond', `Alle ${tracks.length} nummers uit ${genreNames[genre]} zijn gespeeld.`); throw new Error('Alle nummers in deze sessie zijn afgespeeld.'); }
    while (candidates.length) {
      const source = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
      try {
        const found = await resolve(source);
        await window.SpotifyApp.request('/me/player/play', 'PUT', { uris: [found.uri] });
        used.add(key(source)); renderTrack(found); elapsedBeforePause = 0; startedAt = Date.now(); isPlaying = true; startTimer(); $('#pauseButton').disabled = false; $('#nextButton').disabled = false; setPauseButton('Ⅱ', 'Pauzeer'); $('#playState').textContent = 'NU AAN HET SPELEN'; updateCount(); setStatus('Sessie actief', `${used.size} van ${tracks.length} nummers afgespeeld.`, true); return;
      } catch (error) { if (!/Geen betrouwbare Spotify-versie/.test(error.message || '') || !candidates.length) throw error; }
    }
  }
  async function togglePause() { if (isPlaying) { await window.SpotifyApp.request('/me/player/pause', 'PUT'); elapsedBeforePause += (Date.now() - startedAt) / 1000; isPlaying = false; stopTimer(); updateProgress(); setPauseButton('▶', 'Verder luisteren'); $('#playState').textContent = 'GEPAUZEERD'; setStatus('Gepauzeerd', 'Druk op Verder luisteren om deze track te hervatten.'); } else { await window.SpotifyApp.request('/me/player/play', 'PUT'); startedAt = Date.now(); isPlaying = true; startTimer(); setPauseButton('Ⅱ', 'Pauzeer'); $('#playState').textContent = 'NU AAN HET SPELEN'; setStatus('Sessie actief', `${used.size} van ${tracks.length} nummers afgespeeld.`, true); } }
  async function guarded(action) { try { setError(); await action(); } catch (error) { setError(error.message || 'Er ging iets mis.'); setStatus('Actie niet gelukt', 'Controleer Spotify en je actieve apparaat.'); } }
  $('#pauseButton').addEventListener('click', () => guarded(togglePause)); $('#nextButton').addEventListener('click', () => guarded(nextTrack)); $('#endSession').addEventListener('click', () => { sessionStorage.removeItem('muziekmix.session.genre'); window.location.assign('index.html'); });
  (async () => {
    if (!genre || !genreNames[genre]) { window.location.replace('index.html'); return; }
    $('#sessionTitle').innerHTML = `${genreNames[genre]}<span>.</span>`; updateCount();
    if (!window.SpotifyApp.hasSession()) { window.location.replace('index.html'); return; }
    await guarded(async () => { const devices = await window.SpotifyApp.request('/me/player/devices'); if (!devices?.devices?.some(device => device.is_active)) throw new Error('Geen actief Spotify-apparaat gevonden. Open Spotify op je telefoon of speaker en speel daar kort iets af.'); await nextTrack(); });
  })();
})();
