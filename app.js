(() => {
  'use strict';

  const CLIENT_ID = (window.APP_CONFIG?.spotifyClientId || '').trim();
  const PLACEHOLDER_CLIENT_ID = 'PASTE_YOUR_SPOTIFY_CLIENT_ID_HERE';
  const KEYS = { access: 'muziekmix.spotify.access', expiry: 'muziekmix.spotify.expiry', refresh: 'muziekmix.spotify.refresh', verifier: 'muziekmix.spotify.verifier', state: 'muziekmix.spotify.state' };
  const tracks = Array.isArray(window.TRACKS) ? window.TRACKS.filter(track => track?.title && track?.artist && track?.year) : [];
  const genreNames = { alles: 'Alles', yachterock: 'Yachtrock', rock: 'Rock', disco: 'Disco', gitaarmuziek: 'Gitaarmuziek', nederlands: 'Nederlands' };

  const $ = selector => document.querySelector(selector);
  const elements = {
    status: $('#statusText'), instruction: $('#instruction'), dot: $('#statusDot'), connection: $('#spotifyConnection'), connectionDetail: $('#connectionDetail'), connectionIcon: $('#connectionIcon'),
    connect: $('#connectSpotify'), settingsConnect: $('#settingsConnect'), disconnect: $('#disconnectSpotify'), settingsConnection: $('#settingsConnection'), dialog: $('#settingsDialog'),
    session: $('#sessionButton'), pause: $('#pauseButton'), next: $('#nextButton'), title: $('#trackTitle'), artist: $('#trackArtist'), link: $('#trackLink'), art: $('#albumArt'), fallback: $('#albumFallback'),
    playState: $('#playState'), time: $('#timeLabel'), progress: $('#progressBar'), error: $('#errorMessage'), count: $('#trackCount'), genreCount: $('#genreCount')
  };

  let selectedGenre = 'alles';
  let sessionTracks = [];
  let usedTrackKeys = new Set();
  let currentTrack = null;
  let currentSpotifyTrack = null;
  let isPlaying = false;
  let elapsedBeforePause = 0;
  let startedAt = 0;
  let progressTimer = null;
  let accessToken = localStorage.getItem(KEYS.access) || '';
  let tokenExpiry = Number(localStorage.getItem(KEYS.expiry) || 0);
  let refreshToken = localStorage.getItem(KEYS.refresh) || '';
  const redirectUri = `${window.location.origin}${window.location.pathname}`;

  const formatTime = seconds => {
    const value = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  };
  const trackKey = track => `${track.title}\u0000${track.artist}`.toLocaleLowerCase('nl');
  const normalise = value => String(value || '').toLocaleLowerCase('nl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const poolForGenre = () => {
    const matching = selectedGenre === 'alles' ? tracks : tracks.filter(track => Array.isArray(track.genres) ? track.genres.includes(selectedGenre) : track.genre === selectedGenre);
    return [...new Map(matching.map(track => [trackKey(track), track])).values()];
  };
  const setError = message => { elements.error.textContent = message || ''; elements.error.hidden = !message; };
  const setStatus = (text, detail, active = false) => {
    elements.status.textContent = text; elements.instruction.textContent = detail;
    elements.dot.style.background = active ? '#d6fb65' : '#a3a99b';
    elements.dot.style.boxShadow = active ? '0 0 12px #d6fb6580' : 'none';
  };
  const setButton = (button, icon, label) => { button.innerHTML = `<span class="button-icon">${icon}</span><span>${label}</span>`; };

  function updateGenreUI() {
    const count = poolForGenre().length;
    elements.count.textContent = `${count} nummers beschikbaar`;
    elements.genreCount.textContent = `${count} nummers`;
    document.querySelectorAll('.genre-button').forEach(button => {
      const active = button.dataset.genre === selectedGenre;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function clearAuth() {
    Object.values(KEYS).forEach(key => localStorage.removeItem(key));
    accessToken = ''; tokenExpiry = 0; refreshToken = '';
  }

  function saveTokens(data) {
    accessToken = data.access_token;
    tokenExpiry = Date.now() + Number(data.expires_in || 3600) * 1000;
    localStorage.setItem(KEYS.access, accessToken);
    localStorage.setItem(KEYS.expiry, String(tokenExpiry));
    if (data.refresh_token) { refreshToken = data.refresh_token; localStorage.setItem(KEYS.refresh, refreshToken); }
  }

  function updateConnection(connected, label = '', detail = '') {
    const configured = CLIENT_ID && CLIENT_ID !== PLACEHOLDER_CLIENT_ID;
    elements.connection.textContent = connected ? (label || 'Spotify gekoppeld') : (configured ? 'Spotify niet gekoppeld' : 'Spotify instellen vereist');
    elements.connectionDetail.textContent = connected ? (detail || 'Klaar om muziek af te spelen.') : (configured ? 'Koppel je eigen account om af te spelen.' : 'De eigenaar moet eerst de Client ID instellen.');
    elements.connectionIcon.classList.toggle('connected', connected);
    elements.connect.hidden = connected;
    elements.connect.disabled = !connected && !configured;
    elements.connect.title = configured ? '' : 'De eigenaar moet eerst de Spotify Client ID instellen.';
    elements.settingsConnect.hidden = connected;
    elements.settingsConnect.disabled = !connected && !configured;
    elements.disconnect.hidden = !connected;
    elements.settingsConnection.textContent = connected ? `${elements.connection.textContent}. ${elements.connectionDetail.textContent}` : elements.connectionDetail.textContent;
  }

  function base64url(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
  async function digest(value) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); }
  function randomValue(length = 32) { return base64url(crypto.getRandomValues(new Uint8Array(length))); }

  async function login() {
    if (!CLIENT_ID || CLIENT_ID === PLACEHOLDER_CLIENT_ID) throw new Error('De eigenaar moet eerst de Spotify Client ID invullen in config.js en de website opnieuw publiceren.');
    const verifier = randomValue(64);
    const state = randomValue(24);
    localStorage.setItem(KEYS.verifier, verifier);
    localStorage.setItem(KEYS.state, state);
    const challenge = base64url(await digest(verifier));
    const params = new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: redirectUri, code_challenge_method: 'S256', code_challenge: challenge, state, scope: 'user-modify-playback-state user-read-playback-state' });
    window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
  }

  async function tokenRequest(params) {
    const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error_description || 'Spotify-aanmelding is mislukt.');
    return data;
  }

  async function exchangeCode(code) {
    const verifier = localStorage.getItem(KEYS.verifier);
    if (!verifier) throw new Error('De inlogsessie is verlopen. Probeer Spotify opnieuw te koppelen.');
    const data = await tokenRequest({ client_id: CLIENT_ID, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier });
    saveTokens(data);
    localStorage.removeItem(KEYS.verifier); localStorage.removeItem(KEYS.state);
  }

  async function getToken() {
    if (accessToken && Date.now() < tokenExpiry - 60_000) return accessToken;
    if (!refreshToken) throw new Error('Koppel eerst je Spotify-account.');
    try { saveTokens(await tokenRequest({ client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: refreshToken })); return accessToken; }
    catch (_) { clearAuth(); updateConnection(false); throw new Error('Je Spotify-sessie is verlopen. Koppel je account opnieuw.'); }
  }

  async function spotifyRequest(path, method = 'GET', body, retry = true) {
    const token = await getToken();
    const response = await fetch(`https://api.spotify.com/v1${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && retry) { tokenExpiry = 0; return spotifyRequest(path, method, body, false); }
    if (!response.ok) {
      if (response.status === 404) throw new Error('Geen actief Spotify-apparaat gevonden. Open Spotify op je telefoon of speaker, speel daar kort iets af en probeer opnieuw.');
      if (response.status === 403) throw new Error('Spotify weigert afspelen. Hiervoor zijn Spotify Premium en toegang tot deze Developer-app nodig.');
      if (response.status === 429) throw new Error('Spotify ontvangt te veel verzoeken. Wacht even en probeer opnieuw.');
      throw new Error(data.error?.message || `Spotify-fout (${response.status}).`);
    }
    return data;
  }

  async function loadProfile() {
    const profile = await spotifyRequest('/me');
    updateConnection(true, profile.display_name ? `Gekoppeld als ${profile.display_name}` : 'Spotify gekoppeld', 'Klaar om muziek af te spelen.');
  }

  function scoreMatch(item, source) {
    const title = normalise(source.title), artist = normalise(source.artist);
    const itemTitle = normalise(item.name), itemArtists = item.artists?.map(artistItem => normalise(artistItem.name)) || [];
    if (itemTitle !== title || !itemArtists.includes(artist)) return -Infinity;
    const version = normalise(`${item.name} ${item.album?.name || ''}`);
    return 100 - (/(live|karaoke|tribute|cover|instrumental)/.test(version) ? 80 : 0) - (/(remaster|remastered)/.test(version) ? 5 : 0);
  }

  async function resolveSpotifyTrack(source) {
    if (source.spotifyUri?.startsWith('spotify:track:')) {
      const id = source.spotifyUri.slice('spotify:track:'.length);
      return spotifyRequest(`/tracks/${encodeURIComponent(id)}`);
    }
    const query = `track:${source.title} artist:${source.artist}`;
    const result = await spotifyRequest(`/search?q=${encodeURIComponent(query)}&type=track&limit=20`);
    const match = (result.tracks?.items || []).map(item => ({ item, score: scoreMatch(item, source) })).filter(candidate => candidate.score > 0).sort((a, b) => b.score - a.score)[0]?.item;
    if (!match) throw new Error(`Geen betrouwbare Spotify-versie gevonden voor ${source.title} van ${source.artist}.`);
    return match;
  }

  function renderTrack(track) {
    currentSpotifyTrack = track;
    elements.title.textContent = track.name;
    elements.artist.textContent = track.artists.map(artist => artist.name).join(', ');
    elements.link.href = track.external_urls?.spotify || 'https://open.spotify.com';
    elements.link.hidden = false;
    const image = track.album?.images?.[0]?.url;
    elements.art.hidden = !image; elements.fallback.hidden = Boolean(image);
    if (image) { elements.art.src = image; elements.art.alt = `Albumhoes: ${track.album.name}`; }
  }

  function stopProgress() { clearInterval(progressTimer); progressTimer = null; }
  function updateProgress() {
    const duration = Math.max(1, Number(currentSpotifyTrack?.duration_ms || 0) / 1000);
    const elapsed = elapsedBeforePause + (isPlaying ? (Date.now() - startedAt) / 1000 : 0);
    elements.time.textContent = `${formatTime(elapsed)} / ${formatTime(duration)}`;
    elements.progress.style.width = `${Math.min(100, elapsed / duration * 100)}%`;
  }
  function startProgress() { stopProgress(); progressTimer = setInterval(updateProgress, 500); updateProgress(); }

  async function startOrNext() {
    setError();
    let candidates = sessionTracks.filter(track => !usedTrackKeys.has(trackKey(track)));
    if (!candidates.length) {
      setStatus('Sessie afgerond', `Alle ${sessionTracks.length} nummers uit ${genreNames[selectedGenre]} zijn gespeeld.`);
      elements.next.disabled = true; elements.pause.disabled = true;
      throw new Error('Alle nummers in deze sessie zijn afgespeeld. Start een nieuwe sessie om opnieuw te beginnen.');
    }
    while (candidates.length) {
      const index = Math.floor(Math.random() * candidates.length);
      const source = candidates.splice(index, 1)[0];
      try {
        const spotifyTrack = await resolveSpotifyTrack(source);
        await spotifyRequest('/me/player/play', 'PUT', { uris: [spotifyTrack.uri] });
        currentTrack = source; usedTrackKeys.add(trackKey(source)); renderTrack(spotifyTrack);
        elapsedBeforePause = 0; startedAt = Date.now(); isPlaying = true; startProgress();
        elements.pause.disabled = false; elements.next.disabled = false;
        setButton(elements.pause, 'Ⅱ', 'Pauzeer');
        setStatus('Sessie actief', `${usedTrackKeys.size} van ${sessionTracks.length} nummers afgespeeld.`, true);
        elements.playState.textContent = 'NU AAN HET SPELEN';
        return;
      } catch (error) {
        // Een ontbrekende catalogusmatch mag worden overgeslagen; fouten van de
        // speler zelf (zoals een ontbrekend apparaat) moeten zichtbaar blijven.
        if (!/Geen betrouwbare Spotify-versie/.test(error.message || '') || !candidates.length) throw error;
      }
    }
  }

  async function startSession() {
    if (!accessToken && !refreshToken) { await login(); return; }
    await loadProfile();
    const pool = poolForGenre();
    if (!pool.length) throw new Error(`Er zijn geen nummers ingesteld voor ${genreNames[selectedGenre]}.`);
    const devices = await spotifyRequest('/me/player/devices');
    if (!devices?.devices?.some(device => device.is_active)) {
      throw new Error('Geen actief Spotify-apparaat gevonden. Open Spotify op je telefoon of speaker, speel daar kort iets af en probeer opnieuw.');
    }
    sessionTracks = pool; usedTrackKeys = new Set(); currentTrack = null;
    setButton(elements.session, '↻', 'Nieuwe sessie');
    await startOrNext();
  }

  async function togglePause() {
    if (!currentSpotifyTrack) return;
    if (isPlaying) {
      await spotifyRequest('/me/player/pause', 'PUT');
      elapsedBeforePause += (Date.now() - startedAt) / 1000; isPlaying = false; stopProgress(); updateProgress();
      setButton(elements.pause, '▶', 'Verder luisteren'); elements.playState.textContent = 'GEPAUZEERD'; setStatus('Gepauzeerd', 'Druk op Verder luisteren om deze track te hervatten.');
    } else {
      await spotifyRequest('/me/player/play', 'PUT');
      startedAt = Date.now(); isPlaying = true; startProgress();
      setButton(elements.pause, 'Ⅱ', 'Pauzeer'); elements.playState.textContent = 'NU AAN HET SPELEN'; setStatus('Sessie actief', `${usedTrackKeys.size} van ${sessionTracks.length} nummers afgespeeld.`, true);
    }
  }

  async function guarded(action) {
    try { setError(); await action(); }
    catch (error) { setError(error.message || 'Er ging iets mis.'); setStatus('Actie niet gelukt', 'Controleer je Spotify-koppeling en actieve apparaat.'); }
  }

  async function changeGenre(genre) {
    selectedGenre = genre;
    if (isPlaying) { try { await spotifyRequest('/me/player/pause', 'PUT'); } catch (_) {} }
    stopProgress(); isPlaying = false; sessionTracks = []; usedTrackKeys = new Set(); currentTrack = null; currentSpotifyTrack = null;
    elements.pause.disabled = true; elements.next.disabled = true; elements.playState.textContent = 'KLAAR'; elements.progress.style.width = '0%'; elements.time.textContent = '0:00';
    elements.title.textContent = 'Nog geen sessie gestart'; elements.artist.textContent = 'Kies Start sessie om het nieuwe genre te gebruiken.'; elements.link.hidden = true; elements.art.hidden = true; elements.fallback.hidden = false;
    setButton(elements.session, '▶', 'Start sessie'); updateGenreUI();
    setStatus('Genre gewijzigd', `Start een nieuwe sessie voor ${genreNames[selectedGenre]}.`);
  }

  document.querySelectorAll('.genre-button').forEach(button => button.addEventListener('click', () => guarded(() => changeGenre(button.dataset.genre))));
  elements.connect.addEventListener('click', () => guarded(login));
  elements.settingsConnect.addEventListener('click', () => guarded(login));
  elements.disconnect.addEventListener('click', () => { clearAuth(); updateConnection(false); elements.dialog.close(); setStatus('Spotify ontkoppeld', 'Koppel een account om weer af te spelen.'); });
  elements.session.addEventListener('click', () => guarded(startSession));
  elements.next.addEventListener('click', () => guarded(startOrNext));
  elements.pause.addEventListener('click', () => guarded(togglePause));
  $('#settingsToggle').addEventListener('click', () => elements.dialog.showModal());
  $('#closeSettings').addEventListener('click', () => elements.dialog.close());

  (async () => {
    updateGenreUI(); updateConnection(false);
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code'), error = params.get('error'), state = params.get('state');
    if (code || error) history.replaceState({}, document.title, redirectUri);
    if (error) { localStorage.removeItem(KEYS.verifier); localStorage.removeItem(KEYS.state); setError(error === 'access_denied' ? 'Spotify-koppeling is geannuleerd.' : `Spotify-koppeling mislukt: ${error}.`); return; }
    if (code) {
      if (!state || state !== localStorage.getItem(KEYS.state)) { setError('De Spotify-aanmelding kon niet veilig worden gecontroleerd. Probeer opnieuw.'); return; }
      await guarded(async () => { await exchangeCode(code); await loadProfile(); elements.dialog.showModal(); });
    } else if (accessToken || refreshToken) await guarded(loadProfile);
  })();
})();
