(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const genre = sessionStorage.getItem('muziekmix.session.genre');
  const genreNames = { alles: 'Alle genres', yachterock: 'Yachtrock', rock: 'Rock', disco: 'Disco', gitaarmuziek: 'Gitaarmuziek', nederlands: 'Nederlands' };
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
  const matchesGenre = track => genre === 'alles' || (Array.isArray(track.genres) ? track.genres.includes(genre) : track.genre === genre);
  const tracks = [...new Map(sourceTracks.filter(matchesGenre).map(track => [key(track), track])).values()];
  let player, browserDeviceId = '', pendingTrack, currentTrack, playerState, stateUpdatedAt = 0, used = new Set(), unavailable = new Set(), isPlaying = false, progressTimer;

  const setError = message => { $('#errorMessage').textContent = message || ''; $('#errorMessage').hidden = !message; };
  const setStatus = (title, detail, active = false) => { $('#statusText').textContent = title; $('#instruction').textContent = detail; $('#statusDot').classList.toggle('active', active); };
  const setPauseButton = (icon, label) => { $('#pauseButton').innerHTML = `<span class="button-icon">${icon}</span><span>${label}</span>`; };
  const formatTime = seconds => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const updateCount = () => { $('#sessionCount').textContent = `${used.size} / ${tracks.length}`; };
  function updateProgress() { if (!playerState) return; const duration = Math.max(1, (playerState.duration || currentTrack?.duration_ms || 0) / 1000); const elapsed = (playerState.position || 0) / 1000 + (isPlaying ? (Date.now() - stateUpdatedAt) / 1000 : 0); $('#timeLabel').textContent = `${formatTime(elapsed)} / ${formatTime(duration)}`; $('#progressBar').style.width = `${Math.min(100, elapsed / duration * 100)}%`; }
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
  function renderTrack(track) { $('#trackTitle').textContent = track.name; $('#trackArtist').textContent = track.artists.map(person => person.name).join(', '); $('#trackLink').href = track.external_urls?.spotify || 'https://open.spotify.com'; $('#trackLink').hidden = false; const image = track.album?.images?.[0]?.url; $('#albumArt').hidden = !image; $('#albumFallback').hidden = Boolean(image); if (image) { $('#albumArt').src = image; $('#albumArt').alt = `Albumhoes: ${track.album.name}`; } }
  async function prepareTrack() {
    const candidates = tracks.filter(track => !used.has(key(track)) && !unavailable.has(key(track))).sort(() => Math.random() - 0.5);
    if (!candidates.length) throw new Error('Alle beschikbare nummers in deze sessie zijn afgespeeld.');
    for (const source of candidates.slice(0, 10)) {
      try { const spotify = await resolve(source); pendingTrack = { source, spotify }; renderTrack(spotify); return; }
      catch (error) { if (error.code !== 'TRACK_NOT_FOUND') throw error; unavailable.add(key(source)); }
    }
    throw new Error('Spotify kon meerdere nummers niet betrouwbaar koppelen. Probeer Volgend nummer opnieuw.');
  }
  async function waitForTrack(uri) { for (let attempt = 0; attempt < 30; attempt += 1) { if (playerState?.track_window?.current_track?.uri === uri && !playerState.paused) return; await wait(150); } throw new Error('Safari kon de Spotify-audio niet starten. Koppel Spotify opnieuw en probeer daarna nogmaals.'); }
  async function playPending() { if (!pendingTrack) await prepareTrack(); await player.activateElement(); await window.SpotifyApp.request(`/me/player/play?device_id=${encodeURIComponent(browserDeviceId)}`, 'PUT', { uris: [pendingTrack.spotify.uri] }); await player.resume(); await waitForTrack(pendingTrack.spotify.uri); currentTrack = pendingTrack.spotify; used.add(key(pendingTrack.source)); pendingTrack = null; isPlaying = true; updateCount(); startTimer(); $('#startPlayback').hidden = true; $('#pauseButton').disabled = false; $('#nextButton').disabled = false; setPauseButton('Ⅱ', 'Pauzeer'); $('#playState').textContent = 'NU AAN HET SPELEN'; setStatus('Sessie actief', `${used.size} van ${tracks.length} nummers afgespeeld.`, true); }
  async function nextTrack() { await prepareTrack(); await playPending(); }
  async function togglePause() { if (isPlaying) { await player.pause(); updateProgress(); isPlaying = false; setPauseButton('▶', 'Verder luisteren'); $('#playState').textContent = 'GEPAUZEERD'; setStatus('Gepauzeerd', 'Druk op Verder luisteren om deze track te hervatten.'); } else { await player.resume(); isPlaying = true; stateUpdatedAt = Date.now(); setPauseButton('Ⅱ', 'Pauzeer'); $('#playState').textContent = 'NU AAN HET SPELEN'; setStatus('Sessie actief', `${used.size} van ${tracks.length} nummers afgespeeld.`, true); } }
  async function guarded(action) { try { setError(); await action(); } catch (error) { setError(error.message || 'Er ging iets mis.'); setStatus('Actie niet gelukt', 'Controleer je Spotify-koppeling en probeer opnieuw.'); } }
  async function waitForSdk() { if (window.Spotify) return; await new Promise((resolve, reject) => { window.onSpotifyWebPlaybackSDKReady = resolve; setTimeout(() => reject(new Error('De Spotify-browserplayer kon niet worden geladen. Controleer je internetverbinding.')), 10_000); }); }
  async function initialisePlayer() { await waitForSdk(); await new Promise((resolve, reject) => { player = new window.Spotify.Player({ name: 'Muziekmix in Safari', getOAuthToken: async callback => { try { callback(await window.SpotifyApp.token()); } catch (error) { reject(error); callback(''); } }, volume: 0.8 }); player.addListener('ready', ({ device_id }) => { browserDeviceId = device_id; resolve(); }); player.addListener('not_ready', () => { browserDeviceId = ''; }); player.addListener('initialization_error', ({ message } = {}) => reject(new Error(`De browser kan de Spotify-player niet starten${message ? `: ${message}` : '.'}`))); player.addListener('authentication_error', ({ message } = {}) => reject(new Error(`Spotify heeft het afspeeltoken geweigerd${message ? `: ${message}` : '. Koppel Spotify opnieuw.'}`))); player.addListener('account_error', ({ message } = {}) => reject(new Error(`De Spotify-browserplayer vereist een geldig Premium-account${message ? `: ${message}` : '.'}`))); player.addListener('playback_error', ({ message } = {}) => setError(`Spotify kon het nummer niet afspelen${message ? `: ${message}` : '.'}`)); player.addListener('autoplay_failed', () => setError('Safari blokkeerde automatisch afspelen. Tik nogmaals op Start afspelen.')); player.addListener('player_state_changed', state => { if (!state) return; playerState = state; stateUpdatedAt = Date.now(); if (currentTrack && state.track_window.current_track.uri === currentTrack.uri) { isPlaying = !state.paused; updateProgress(); } }); player.connect().then(connected => { if (!connected) reject(new Error('Spotify-browserplayer kon niet verbinden.')); }); }); await window.SpotifyApp.request('/me/player', 'PUT', { device_ids: [browserDeviceId], play: false }); }
  $('#startPlayback').addEventListener('click', () => guarded(playPending)); $('#pauseButton').addEventListener('click', () => guarded(togglePause)); $('#nextButton').addEventListener('click', () => guarded(nextTrack)); $('#endSession').addEventListener('click', () => { clearInterval(progressTimer); player?.disconnect(); sessionStorage.removeItem('muziekmix.session.genre'); window.location.assign('index.html'); });
  (async () => { if (!genre || !genreNames[genre] || !window.SpotifyApp.hasSession()) { window.location.replace('index.html'); return; } $('#sessionTitle').innerHTML = `${genreNames[genre]}<span>.</span>`; updateCount(); await guarded(async () => { await prepareTrack(); await initialisePlayer(); $('#startPlayback').disabled = false; $('#playState').textContent = 'KLAAR'; setStatus('Klaar om af te spelen', 'Tik op Start afspelen in deze browser. Spotify hoeft niet geopend te zijn.'); }); })();
})();
