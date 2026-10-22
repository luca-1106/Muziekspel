(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const genre = sessionStorage.getItem('muziekmix.session.genre');
  const genreNames = { alles: 'Alle genres', yachterock: 'Yachtrock', rock: 'Rock', disco: 'Disco', gitaarmuziek: 'Gitaarmuziek', nederlands: 'Nederlands', pop: 'Pop', soul: 'Soul & R&B', hiphop: 'Hiphop', dance: 'Dance & Electronic', country: 'Country & Folk' };
  const sourceTracks = Array.isArray(window.TRACKS) ? window.TRACKS.filter(track => track?.title && track?.artist) : [];
  const key = track => `${track.title}\u0000${track.artist}`.toLowerCase();
  const normalise = value => String(value || '').toLocaleLowerCase('nl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const normaliseTitle = value => normalise(value)
    .replace(/\b\d{4}\s+remaster(?:ed)?\b/g, '')
    .replace(/\bremaster(?:ed)?(?:\s+\d{4})?\b/g, '')
    .replace(/\b(?:radio|single|album)\s+(?:edit|version|mix)\b/g, '')
    .replace(/\boriginal\s+(?:version|mix|recording)\b/g, '')
    .replace(/\s+/g, ' ').trim();
  const normaliseArtist = value => normalise(value).replace(/^the\s+/, '').replace(/\s+(feat|featuring|ft)\s+.*$/, '').trim();
  const overlap = (left, right) => { const wanted = new Set(left.split(' ').filter(Boolean)); const found = new Set(right.split(' ').filter(Boolean)); return wanted.size ? [...wanted].filter(word => found.has(word)).length / wanted.size : 0; };
    const fallbackGenre = { yachterock: 'pop', rock: 'gitaarmuziek', disco: 'dance', gitaarmuziek: 'rock', nederlands: 'pop', pop: 'soul', soul: 'pop', hiphop: 'soul', dance: 'disco', country: 'yachterock' };
  let activeGenre = genre;
  const tracksForGenre = selected => [...new Map(sourceTracks.filter(track => selected === 'alles' || (Array.isArray(track.genres) ? track.genres.includes(selected) : track.genre === selected)).map(track => [key(track), track])).values()];
  let tracks = tracksForGenre(activeGenre);
  let player, browserDeviceId = '', pendingTrack, currentTrack, playerState, stateUpdatedAt = 0, used = new Set(), unavailable = new Set(), isPlaying = false, progressTimer;

  const setError = message => { $('#errorMessage').textContent = message || ''; $('#errorMessage').hidden = !message; };
  const setStatus = (title, detail, active = false) => { $('#statusText').textContent = title; $('#instruction').textContent = detail; $('#statusDot').classList.toggle('active', active); };
  const buttonIcons = {
    play: '<svg viewBox="0 0 24 24" focusable="false"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" focusable="false"><path d="M7 5h4v14H7zm6 0h4v14h-4z"/></svg>'
  };
  const setPauseButton = (icon, label) => { $('#pauseButton').innerHTML = `<span class="button-icon" aria-hidden="true">${buttonIcons[icon]}</span><span>${label}</span>`; };
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const updateCount = () => { $('#sessionCount').textContent = `${used.size} / ${tracks.length}`; };
  function updateProgress() { if (!playerState) return; const duration = Math.max(1, (playerState.duration || currentTrack?.duration_ms || 0) / 1000); const elapsed = (playerState.position || 0) / 1000 + (isPlaying ? (Date.now() - stateUpdatedAt) / 1000 : 0); const percentage = Math.min(100, elapsed / duration * 100); $('#progressBar').style.width = `${percentage}%`; $('.progress-track').setAttribute('aria-valuenow', String(Math.round(percentage))); }
  function startTimer() { clearInterval(progressTimer); updateProgress(); progressTimer = setInterval(updateProgress, 500); }
  function score(item, source) {
    const wantedTitle = normaliseTitle(source.title), foundTitle = normaliseTitle(item.name);
    const wantedArtist = normaliseArtist(source.artist);
    const artistNames = item.artists?.map(person => normaliseArtist(person.name)) || [];
    const combinedArtists = normaliseArtist(item.artists?.map(person => person.name).join(' ') || '');
    const titleMatch = wantedTitle === foundTitle ? 100 : (overlap(wantedTitle, foundTitle) >= 0.8 && overlap(foundTitle, wantedTitle) >= 0.6 ? 70 : 0);
    const artistMatch = artistNames.includes(wantedArtist) || combinedArtists === wantedArtist ? 50 : (overlap(wantedArtist, combinedArtists) >= 0.8 && overlap(combinedArtists, wantedArtist) >= 0.6 ? 35 : 0);
    const unwantedVersion = /(live|karaoke|tribute|cover|instrumental|re recorded)/.test(normalise(`${item.name} ${item.album?.name || ''}`)) && !/(live|karaoke|tribute|cover|instrumental|re recorded)/.test(wantedTitle);
    return titleMatch && artistMatch && !unwantedVersion ? titleMatch + artistMatch : -Infinity;
  }
  async function resolve(source) {
    if (source.spotifyUri?.startsWith('spotify:track:')) return window.SpotifyApp.request(`/tracks/${encodeURIComponent(source.spotifyUri.slice(14))}`);
    const queries = [`track:${source.title} artist:${source.artist}`, `${source.title} ${source.artist}`];
    for (const query of queries) {
      const result = await window.SpotifyApp.request(`/search?q=${encodeURIComponent(query)}&type=track&limit=10`);
      const found = (result.tracks?.items || []).map(item => ({ item, score: score(item, source) })).filter(candidate => candidate.score > 0).sort((a, b) => b.score - a.score)[0]?.item;
      if (found) return found;
    }
    const error = new Error(`Geen betrouwbare Spotify-versie gevonden voor ${source.title} van ${source.artist}.`);
    error.code = 'TRACK_NOT_FOUND';
    throw error;
  }
  function renderTrack(spotifyTrack, sourceTrack, revealArtwork = false) { const spotifyLink = $('#spotifyTrackLink'); const albumId = spotifyTrack.album?.id || spotifyTrack.album?.uri?.match(/^spotify:album:([A-Za-z0-9]+)$/)?.[1]; spotifyLink.href = albumId ? `https://open.spotify.com/album/${encodeURIComponent(albumId)}` : '#'; spotifyLink.hidden = true; spotifyLink.dataset.available = String(Boolean(albumId));  $('#trackTitle').textContent = sourceTrack.title; const artistElement = $('#trackArtist'); const creditedArtists = (spotifyTrack.artists || []).map(artist => artist?.name).filter(Boolean); const hasMultipleArtists = creditedArtists.length > 1; artistElement.textContent = hasMultipleArtists ? creditedArtists.join(', ') : sourceTrack.artist; artistElement.classList.toggle('multiple-artists', hasMultipleArtists); const year = String(sourceTrack.year || spotifyTrack.album?.release_date || '').match(/\d{4}/)?.[0] || ''; $('#trackYear').textContent = year; $('#trackYear').hidden = !year; const image = spotifyTrack.album?.images?.[0]?.url; $('#albumArt').hidden = !revealArtwork || !image; $('#albumFallback').hidden = revealArtwork && Boolean(image); if (image) { $('#albumArt').src = image; $('#albumArt').alt = `Albumhoes: ${spotifyTrack.album.name}`; } }
  async function prepareTrack() {
    const candidates = tracks.filter(track => !used.has(key(track)) && !unavailable.has(key(track)));
    // Fisher-Yates: elke nog niet afgespeelde track heeft gelijke kans.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    if (!candidates.length) {
      const nextGenre = fallbackGenre[activeGenre];
      if (nextGenre && nextGenre !== activeGenre) {
        const nextTracks = tracksForGenre(nextGenre);
        if (nextTracks.some(track => !used.has(key(track)) && !unavailable.has(key(track)))) {
          activeGenre = nextGenre;
          tracks = nextTracks;
          $('#sessionTitle').innerHTML = `${genreNames[activeGenre]}<span>.</span>`;
          updateCount();
          setStatus('Genre gewisseld', `Alle nummers van ${genreNames[genre]} zijn op. We gaan verder met ${genreNames[activeGenre]}.`);
          return prepareTrack();
        }
      }
      throw new Error('Alle beschikbare nummers van dit genre zijn afgespeeld. Ook het meest vergelijkbare genre heeft geen nieuwe nummers meer.');
    }
    for (const source of candidates) {
      try { const spotify = await resolve(source); pendingTrack = { source, spotify }; return; }
      catch (error) { if (error.code !== 'TRACK_NOT_FOUND') throw error; unavailable.add(key(source)); }
    }
    throw new Error('Geen van de resterende nummers kon betrouwbaar op Spotify worden gevonden.');
  }
  async function waitForTrack(uri) { for (let attempt = 0; attempt < 30; attempt += 1) { if (playerState?.track_window?.current_track?.uri === uri && !playerState.paused) return; await wait(150); } throw new Error('Safari kon de Spotify-audio niet starten. Koppel Spotify opnieuw en probeer daarna nogmaals.'); }
  async function playPending() { if (!pendingTrack) await prepareTrack(); await player.activateElement(); await window.SpotifyApp.request(`/me/player/play?device_id=${encodeURIComponent(browserDeviceId)}`, 'PUT', { uris: [pendingTrack.spotify.uri] }); await player.resume(); await waitForTrack(pendingTrack.spotify.uri); renderTrack(pendingTrack.spotify, pendingTrack.source, false); $('.player-card').classList.add('track-concealed'); $('#revealButton').hidden = false; currentTrack = pendingTrack.spotify; used.add(key(pendingTrack.source)); pendingTrack = null; isPlaying = true; updateCount(); startTimer(); $('#startPlayback').hidden = true; $('.player-card').classList.remove('awaiting-playback'); $('#pauseButton').disabled = false; $('#nextButton').disabled = false; setPauseButton('pause', 'Pauzeer'); setStatus('Sessie actief', `${used.size} van ${tracks.length} nummers afgespeeld.`, true); }
  async function nextTrack() { await prepareTrack(); await playPending(); }
  async function togglePause() { if (isPlaying) { await player.pause(); updateProgress(); isPlaying = false; setPauseButton('play', 'Verder luisteren'); setStatus('Gepauzeerd', 'Druk op Verder luisteren om deze track te hervatten.'); } else { await player.resume(); isPlaying = true; stateUpdatedAt = Date.now(); setPauseButton('pause', 'Pauzeer'); setStatus('Sessie actief', `${used.size} van ${tracks.length} nummers afgespeeld.`, true); } }
  async function guarded(action) { try { setError(); await action(); } catch (error) { setError(error.message || 'Er ging iets mis.'); setStatus('Actie niet gelukt', 'Controleer je Spotify-koppeling en probeer opnieuw.'); } }
  async function waitForSdk() { if (window.Spotify) return; await new Promise((resolve, reject) => { window.onSpotifyWebPlaybackSDKReady = resolve; setTimeout(() => reject(new Error('De Spotify-browserplayer kon niet worden geladen. Controleer je internetverbinding.')), 10_000); }); }
  async function initialisePlayer() { await waitForSdk(); await new Promise((resolve, reject) => { player = new window.Spotify.Player({ name: 'Muziekmix in Safari', getOAuthToken: async callback => { try { callback(await window.SpotifyApp.token()); } catch (error) { reject(error); callback(''); } }, volume: 0.8 }); player.addListener('ready', ({ device_id }) => { browserDeviceId = device_id; resolve(); }); player.addListener('not_ready', () => { browserDeviceId = ''; }); player.addListener('initialization_error', ({ message } = {}) => reject(new Error(`De browser kan de Spotify-player niet starten${message ? `: ${message}` : '.'}`))); player.addListener('authentication_error', ({ message } = {}) => reject(new Error(`Spotify heeft het afspeeltoken geweigerd${message ? `: ${message}` : '. Koppel Spotify opnieuw.'}`))); player.addListener('account_error', ({ message } = {}) => reject(new Error(`De Spotify-browserplayer vereist een geldig Premium-account${message ? `: ${message}` : '.'}`))); player.addListener('playback_error', ({ message } = {}) => setError(`Spotify kon het nummer niet afspelen${message ? `: ${message}` : '.'}`)); player.addListener('autoplay_failed', () => setError('Safari blokkeerde automatisch afspelen. Tik nogmaals op Start afspelen.')); player.addListener('player_state_changed', state => { if (!state) return; playerState = state; stateUpdatedAt = Date.now(); if (currentTrack && state.track_window.current_track.uri === currentTrack.uri) { isPlaying = !state.paused; updateProgress(); } }); player.connect().then(connected => { if (!connected) reject(new Error('Spotify-browserplayer kon niet verbinden.')); }); }); await window.SpotifyApp.request('/me/player', 'PUT', { device_ids: [browserDeviceId], play: false }); }
  function leaveSession() { clearInterval(progressTimer); player?.disconnect(); sessionStorage.removeItem('muziekmix.session.genre'); window.location.assign('index.html'); }
  function requestSessionExit() { if (!used.size) { leaveSession(); return; } const dialog = $('#exitDialog'); if (typeof dialog.showModal === 'function') dialog.showModal(); else if (window.confirm('Weet je zeker dat je deze sessie wilt verlaten?')) leaveSession(); }
  $('#revealButton').addEventListener('click', () => { if (!currentTrack) return; $('#albumArt').hidden = !$('#albumArt').src; $('#albumFallback').hidden = Boolean($('#albumArt').src); $('.player-card').classList.remove('track-concealed'); $('#revealButton').hidden = true; $('#spotifyTrackLink').hidden = $('#spotifyTrackLink').dataset.available !== 'true'; }); $('#startPlayback').addEventListener('click', () => guarded(playPending)); $('#pauseButton').addEventListener('click', () => guarded(togglePause)); $('#nextButton').addEventListener('click', () => guarded(nextTrack)); $('.back-button').addEventListener('click', event => { event.preventDefault(); requestSessionExit(); }); $('#endSession').addEventListener('click', requestSessionExit); $('#cancelExit').addEventListener('click', () => $('#exitDialog').close()); $('#confirmExit').addEventListener('click', leaveSession);
  (async () => { if (!genre || !genreNames[genre] || !window.SpotifyApp.hasSession()) { window.location.replace('index.html'); return; } $('#sessionTitle').innerHTML = `${genreNames[genre]}<span>.</span>`; updateCount(); await guarded(async () => { await prepareTrack(); await initialisePlayer(); $('#trackTitle').textContent = 'Klaar om af te spelen'; $('#trackArtist').textContent = 'Tik op de playknop'; $('#trackYear').hidden = true; $('#startPlayback').disabled = false; setStatus('Klaar om af te spelen', 'Tik op de playknop om het eerste nummer te starten.'); }); })();
})();
