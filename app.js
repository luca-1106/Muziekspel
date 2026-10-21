(() => {
  // Public Client ID only. Never put a Spotify Client Secret in this file.
  const SPOTIFY_CLIENT_ID = 'PASTE_YOUR_SPOTIFY_CLIENT_ID_HERE';
  const $ = (selector) => document.querySelector(selector);
  const playButton = $('#playButton');
  const nextButton = $('#nextButton');
  const statusText = $('#statusText');
  const instruction = $('#instruction');
  const statusDot = $('#statusDot');
  const playState = $('#playState');
  const vinyl = $('.vinyl');
  const errorMessage = $('#errorMessage');
  const settingsDialog = $('#settingsDialog');
  const connectButton = $('#connectSpotify');
  const disconnectButton = $('#disconnectSpotify');
  const connectionText = $('#spotifyConnection');
  const currentTrackTitle = $('#currentTrackTitle');
  const currentTrackArtist = $('#currentTrackArtist');
  const currentTrackGenre = $('#currentTrackGenre');

  const tracks = Array.isArray(window.TRACKS) ? window.TRACKS.filter(t => t && t.year && t.title && t.artist) : [];
  const genreNames = { alles: 'Alle genres', yachterock: 'Yachtrock', rock: 'Rock', disco: 'Disco', gitaarmuziek: 'Gitaarmuziek', nederlands: 'Nederlands' };
  let selectedGenre = 'alles';
  let playedTrackKeys = [];
  let currentTrack = null;
  let isPlaying = false;
  let accessToken = localStorage.getItem('spotify_access_token') || '';
  let tokenExpiry = Number(localStorage.getItem('spotify_token_expiry') || 0);
  let refreshToken = localStorage.getItem('spotify_refresh_token') || '';
  const clientId = SPOTIFY_CLIENT_ID.trim();
  const redirectUri = window.location.origin + window.location.pathname;
  const genreButtons = [...document.querySelectorAll('.genre-button')];

  function setStatus(title, detail, playing = false) {
    statusText.textContent = title;
    instruction.textContent = detail;
    statusDot.style.background = playing ? '#d6fb65' : '#a3a99b';
    statusDot.style.boxShadow = playing ? '0 0 12px #d6fb6580' : 'none';
  }
  function setConnection(message, connected = false) {
    connectionText.textContent = message;
    connectionText.classList.toggle('ok', connected);
    disconnectButton.hidden = !connected;
  }
  function setPlayingUI(playing) {
    isPlaying = playing;
    vinyl.classList.toggle('playing', playing);
    playState.textContent = playing ? 'NU AAN HET SPELEN' : (currentTrack ? 'GEPAUZEERD' : 'KLAAR OM TE SPELEN');
    playButton.innerHTML = playing
      ? '<span class="button-icon">Ⅱ</span><span>Pauzeer</span>'
      : '<span class="button-icon">▶</span><span>' + (currentTrack ? 'Verder luisteren' : 'Play') + '</span>';
  }
  function getFilteredTracks() {
    return selectedGenre === 'alles' ? tracks : tracks.filter(t => Array.isArray(t.genres) ? t.genres.includes(selectedGenre) : t.genre === selectedGenre);
  }
  function updateGenreUI() {
    const pool = getFilteredTracks();
    $('#trackCount').textContent = pool.length + ' nummers beschikbaar';
    $('#genreCount').textContent = pool.length + ' nummers';
    genreButtons.forEach(button => {
      const active = button.dataset.genre === selectedGenre;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  function trackKey(track) { return track.title.toLowerCase() + '::' + track.artist.toLowerCase(); }
  function chooseTrack() {
    const pool = getFilteredTracks();
    let candidates = pool.filter(track => !playedTrackKeys.includes(trackKey(track)));
    if (!candidates.length) { playedTrackKeys = []; candidates = pool.slice(); }
    if (!candidates.length) return null;
    const track = candidates[Math.floor(Math.random() * candidates.length)];
    playedTrackKeys.push(trackKey(track));
    return track;
  }
  function base64url(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function sha256(value) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); }
  async function spotifyLogin() {
    if (!clientId || clientId === 'PASTE_YOUR_SPOTIFY_CLIENT_ID_HERE') {
      setConnection('De eigenaar moet eerst de Spotify Client ID instellen in app.js.');
      return;
    }
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
    localStorage.setItem('spotify_code_verifier', verifier);
    const challenge = base64url(await sha256(verifier));
    const params = new URLSearchParams({
      client_id: clientId, response_type: 'code', redirect_uri: redirectUri,
      code_challenge_method: 'S256', code_challenge: challenge,
      scope: 'user-modify-playback-state user-read-playback-state'
    });
    window.location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
  }
  function saveTokens(data) {
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    localStorage.setItem('spotify_access_token', accessToken);
    localStorage.setItem('spotify_token_expiry', String(tokenExpiry));
    if (data.refresh_token) {
      refreshToken = data.refresh_token;
      localStorage.setItem('spotify_refresh_token', refreshToken);
    }
  }
  async function exchangeCode(code) {
    const verifier = localStorage.getItem('spotify_code_verifier');
    const body = new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier || '' });
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || data.error || 'Spotify-aanmelding mislukt.');
    saveTokens(data);
    localStorage.removeItem('spotify_code_verifier');
    history.replaceState({}, document.title, redirectUri);
    setConnection('Spotify is gekoppeld.', true);
  }
  async function getToken() {
    if (accessToken && Date.now() < tokenExpiry - 60000) return accessToken;
    if (!refreshToken) throw new Error('Koppel eerst Spotify via Instellingen.');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken })
    });
    const data = await response.json();
    if (!response.ok) {
      ['spotify_access_token', 'spotify_refresh_token', 'spotify_token_expiry'].forEach(key => localStorage.removeItem(key));
      accessToken = ''; refreshToken = ''; tokenExpiry = 0;
      throw new Error('Spotify-sessie verlopen. Koppel Spotify opnieuw via Instellingen.');
    }
    saveTokens(data);
    return accessToken;
  }
  async function spotifyRequest(path, method = 'GET', body = null) {
    const token = await getToken();
    const response = await fetch('https://api.spotify.com/v1' + path, {
      method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) throw new Error('Geen actief Spotify-apparaat gevonden. Open Spotify op je telefoon of speaker en probeer opnieuw.');
      if (response.status === 403) throw new Error('Spotify heeft het afspelen geweigerd. Controleer je account en de toegang van je Developer-app.');
      throw new Error(data.error?.message || 'Spotify-fout (' + response.status + ').');
    }
    return data;
  }
  function showCurrentTrack(track) {
    currentTrackTitle.textContent = track ? track.title : 'Nog geen nummer gekozen';
    currentTrackArtist.textContent = track ? track.artist : 'Druk op Play om willekeurig muziek te starten';
    currentTrackGenre.textContent = track
      ? (track.genres || [track.genre || '']).filter(Boolean).map(genre => genreNames[genre] || genre).join(' · ')
      : genreNames[selectedGenre];
  }
  async function findSpotifyUri(track) {
    if (track.spotifyUri && track.spotifyUri.startsWith('spotify:track:')) return track.spotifyUri;
    const query = 'track:' + track.title + ' artist:' + track.artist;
    const result = await spotifyRequest('/search?q=' + encodeURIComponent(query) + '&type=track&limit=8');
    const items = result && result.tracks && result.tracks.items || [];
    const norm = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const title = norm(track.title), artist = norm(track.artist);
    const exact = items.find(item => norm(item.name) === title && item.artists && item.artists.some(a => norm(a.name) === artist));
    const close = items.find(item => item.artists && item.artists.some(a => norm(a.name) === artist) && (norm(item.name).includes(title) || title.includes(norm(item.name))));
    const found = exact || close;
    if (!found) throw new Error('Spotify kon "' + track.title + '" van ' + track.artist + ' niet vinden. Kies Volgend nummer om door te gaan.');
    track.spotifyUri = found.uri;
    return found.uri;
  }
  async function playNext() {
    errorMessage.hidden = true;
    nextButton.disabled = true;
    try {
      currentTrack = chooseTrack();
      if (!currentTrack) throw new Error('Er zijn geen nummers beschikbaar in dit genre.');
      showCurrentTrack(currentTrack);
      setStatus('Nummer zoeken…', 'De app zoekt het gekozen nummer op Spotify.');
      const uri = await findSpotifyUri(currentTrack);
      await spotifyRequest('/me/player/play', 'PUT', { uris: [uri] });
      setPlayingUI(true);
      setStatus('Muziek speelt', 'Geniet van het nummer of kies Volgend nummer.', true);
    } catch (error) {
      setPlayingUI(false);
      errorMessage.textContent = error.message || 'Kon Spotify niet starten.';
      errorMessage.hidden = false;
      setStatus('Muziek niet gestart', 'Controleer je Spotify-koppeling en of Spotify actief is op een apparaat.');
    } finally {
      nextButton.disabled = false;
    }
  }
  async function pausePlayback() {
    await spotifyRequest('/me/player/pause', 'PUT');
    setPlayingUI(false);
    setStatus('Muziek gepauzeerd', 'Druk op Verder luisteren of kies een volgend nummer.');
  }
  async function resumePlayback() {
    await spotifyRequest('/me/player/play', 'PUT');
    setPlayingUI(true);
    setStatus('Muziek speelt', 'Geniet van het nummer of kies Volgend nummer.', true);
  }

  genreButtons.forEach(button => button.addEventListener('click', async () => {
    const wasPlaying = isPlaying;
    selectedGenre = button.dataset.genre;
    playedTrackKeys = [];
    updateGenreUI();
    currentTrack = null;
    showCurrentTrack(null);
    setPlayingUI(false);
    errorMessage.hidden = true;
    try { if (wasPlaying) await spotifyRequest('/me/player/pause', 'PUT'); } catch (_) {}
    setStatus('Genre gewijzigd', 'Je muziekkeuze staat nu op: ' + genreNames[selectedGenre] + '. Druk op Play om een willekeurig nummer te starten.');
  }));
  playButton.addEventListener('click', async () => {
    errorMessage.hidden = true;
    try {
      if (!currentTrack) return await playNext();
      if (isPlaying) await pausePlayback();
      else await resumePlayback();
    } catch (error) {
      errorMessage.textContent = error.message || 'De Spotify-bediening is mislukt.';
      errorMessage.hidden = false;
    }
  });
  nextButton.addEventListener('click', playNext);
  $('#settingsToggle').addEventListener('click', () => settingsDialog.showModal());
  $('#closeSettings').addEventListener('click', () => settingsDialog.close());
  connectButton.addEventListener('click', spotifyLogin);
  disconnectButton.addEventListener('click', async () => {
    try { if (isPlaying) await spotifyRequest('/me/player/pause', 'PUT'); } catch (_) {}
    ['spotify_access_token', 'spotify_refresh_token', 'spotify_token_expiry', 'spotify_code_verifier'].forEach(key => localStorage.removeItem(key));
    accessToken = ''; refreshToken = ''; tokenExpiry = 0; currentTrack = null;
    showCurrentTrack(null); setPlayingUI(false); setConnection('Spotify is ontkoppeld.');
    setStatus('Spotify ontkoppeld', 'Koppel Spotify opnieuw om muziek af te spelen.');
  });
  (async () => {
    updateGenreUI();
    showCurrentTrack(null);
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (params.get('error')) setConnection('Spotify-koppeling geannuleerd: ' + params.get('error'));
    else if (code) {
      try { await exchangeCode(code); settingsDialog.showModal(); }
      catch (error) { setConnection(error.message); settingsDialog.showModal(); }
    } else if (accessToken && tokenExpiry > Date.now()) setConnection('Spotify is gekoppeld.', true);
    else if (refreshToken && clientId) setConnection('Spotify-koppeling opgeslagen; sessie wordt vernieuwd.', true);
    else setConnection('Spotify is nog niet gekoppeld.');
  })();
})();