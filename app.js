(() => {
  // Public Spotify Client ID goes here. Never put a Client Secret in this file.
  const SPOTIFY_CLIENT_ID = 'PASTE_YOUR_SPOTIFY_CLIENT_ID_HERE';

  const playButton = document.querySelector('#playButton');
  const revealButton = document.querySelector('#revealButton');
  const answerCard = document.querySelector('#answerCard');
  const statusText = document.querySelector('#statusText');
  const instruction = document.querySelector('#instruction');
  const statusDot = document.querySelector('#statusDot');
  const playState = document.querySelector('#playState');
  const timeLabel = document.querySelector('#timeLabel');
  const progressBar = document.querySelector('#progressBar');
  const vinyl = document.querySelector('.vinyl');
  const errorMessage = document.querySelector('#errorMessage');
  const settingsDialog = document.querySelector('#settingsDialog');
  const clipLength = document.querySelector('#clipLength');
  const clipLengthValue = document.querySelector('#clipLengthValue');
  const autoStop = document.querySelector('#autoStop');
  const connectButton = document.querySelector('#connectSpotify');
  const connectionText = document.querySelector('#spotifyConnection');

  const tracks = Array.isArray(window.TRACKS) ? window.TRACKS.filter(t => t && t.year && t.title && t.artist) : [];
  let selectedGenre = 'alles';
  const genreNames = { alles: 'Alles', yachterock: 'Yachtrock', rock: 'Rock', disco: 'Disco', gitaarmuziek: 'Gitaarmuziek', nederlands: 'Nederlands' };
  const genreButtons = [...document.querySelectorAll('.genre-button')];
  function filteredTracks() { return selectedGenre === 'alles' ? tracks : tracks.filter(t => Array.isArray(t.genres) ? t.genres.includes(selectedGenre) : t.genre === selectedGenre); }
  function updateGenreUI() { const pool = filteredTracks(); document.querySelector('#trackCount').textContent = `${pool.length} nummers beschikbaar`; document.querySelector('#genreCount').textContent = `${pool.length} nummers`; genreButtons.forEach(b => { const active = b.dataset.genre === selectedGenre; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); }); }
  genreButtons.forEach(button => button.addEventListener('click', () => { selectedGenre = button.dataset.genre; playedTracks = []; if (currentTrack && !revealed) { stopPlayback(); currentTrack = null; revealed = false; answerCard.hidden = true; revealButton.disabled = true; playButton.innerHTML = '<span class="button-icon">▶</span><span>Play</span>'; setStatus('Genre gewijzigd', `Je speelt nu uit: ${genreNames[selectedGenre]}. Druk op play om te beginnen.`); } updateGenreUI(); }));
  updateGenreUI();
  let currentTrack = null, playedTracks = [], revealed = false, clipTimer = null, progressTimer = null;
  let clipSeconds = Number(clipLength.value), startedAt = 0, elapsedBeforePause = 0, isPlaying = false;
  let accessToken = localStorage.getItem('spotify_access_token') || '';
  let tokenExpiry = Number(localStorage.getItem('spotify_token_expiry') || 0);
  let refreshToken = localStorage.getItem('spotify_refresh_token') || '';
  let clientId = SPOTIFY_CLIENT_ID;
  const redirectUri = window.location.origin + window.location.pathname;

  function setStatus(text, instructionText, playing = false) {
    statusText.textContent = text; instruction.textContent = instructionText;
    statusDot.style.background = playing ? '#d6fb65' : '#a3a99b';
    statusDot.style.boxShadow = playing ? '0 0 12px #d6fb6580' : 'none';
  }
  function formatTime(seconds) { const s = Math.max(0, Math.floor(seconds || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  function stopTimers() { if (clipTimer) clearTimeout(clipTimer); if (progressTimer) clearInterval(progressTimer); clipTimer = null; progressTimer = null; }
  function setConnection(text, ok = false) { connectionText.textContent = text; connectionText.classList.toggle('ok', ok); }
  function base64url(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  async function sha256(value) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); }

  async function spotifyLogin() {
    clientId = SPOTIFY_CLIENT_ID;
    if (!clientId || clientId === 'PASTE_YOUR_SPOTIFY_CLIENT_ID_HERE') { setConnection('De Spotify Client ID is nog niet ingesteld in app.js.'); return; }
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
    localStorage.setItem('spotify_code_verifier', verifier);
    const challenge = base64url(await sha256(verifier));
    const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri, code_challenge_method: 'S256', code_challenge: challenge, scope: 'user-modify-playback-state user-read-playback-state' });
    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }
  async function exchangeCode(code) {
    const verifier = localStorage.getItem('spotify_code_verifier');
    const body = new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier || '' });
    const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || data.error || 'Spotify-aanmelding mislukt.');
    saveTokens(data); history.replaceState({}, document.title, redirectUri); setConnection('Spotify is gekoppeld.', true);
  }
  function saveTokens(data) {
    accessToken = data.access_token; tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    localStorage.setItem('spotify_access_token', accessToken); localStorage.setItem('spotify_token_expiry', String(tokenExpiry));
    if (data.refresh_token) { refreshToken = data.refresh_token; localStorage.setItem('spotify_refresh_token', refreshToken); }
  }
  async function getToken() {
    if (accessToken && Date.now() < tokenExpiry - 60000) return accessToken;
    if (!refreshToken) throw new Error('Koppel eerst je Spotify-account via Instellingen.');
    const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken }) });
    const data = await response.json();
    if (!response.ok) { localStorage.removeItem('spotify_refresh_token'); throw new Error('Spotify-sessie verlopen. Koppel Spotify opnieuw via Instellingen.'); }
    saveTokens(data); return accessToken;
  }
  async function spotifyRequest(path, method = 'GET', body = null) {
    const token = await getToken();
    const response = await fetch(`https://api.spotify.com/v1${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) throw new Error('Geen actief Spotify-apparaat gevonden. Open Spotify op je telefoon of speaker en probeer opnieuw.');
      if (response.status === 403) throw new Error('Spotify heeft het afspelen geweigerd. Controleer je Premium-account en de instellingen van je Developer-app.');
      throw new Error(data.error?.message || `Spotify-fout (${response.status}).`);
    }
    return data;
  }
  async function stopPlayback() {
    stopTimers();
    try { if (isPlaying && accessToken) await spotifyRequest('/me/player/pause', 'PUT'); } catch (_) {}
    isPlaying = false; vinyl.classList.remove('playing'); playState.textContent = 'TRACK GESTOPT';
  }
  function chooseTrack() {
    const pool = filteredTracks();
    let candidates = pool.filter(t => !playedTracks.includes(t));
    if (!candidates.length) { playedTracks = []; candidates = pool.slice(); }
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    if (selected) playedTracks.push(selected);
    return selected || null;
  }
  function showAnswer() {
    if (!currentTrack || revealed) return;
    revealed = true;
    document.querySelector('#answerYear').textContent = currentTrack.year;
    document.querySelector('#answerTitle').textContent = currentTrack.title;
    document.querySelector('#answerArtist').textContent = currentTrack.artist;
    answerCard.hidden = false; revealButton.disabled = true;
    playButton.innerHTML = '<span class="button-icon">↻</span><span>Volgende track</span>';
    setStatus('Antwoord onthuld', 'Schrijf het jaartal op een sticky note en bepaal of de fiche goed lag.');
    playState.textContent = 'ANTWOORD ONTHULD';
  }
  async function findSpotifyUri(track) {
    if (track.spotifyUri && track.spotifyUri.startsWith('spotify:track:')) return track.spotifyUri;
    const query = `track:${track.title} artist:${track.artist}`;
    const result = await spotifyRequest(`/search?q=${encodeURIComponent(query)}&type=track&limit=8`);
    const items = result?.tracks?.items || [];
    const norm = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const title = norm(track.title), artist = norm(track.artist);
    const exact = items.find(item => norm(item.name) === title && item.artists?.some(a => norm(a.name) === artist));
    const close = items.find(item => item.artists?.some(a => norm(a.name) === artist) && (norm(item.name).includes(title) || title.includes(norm(item.name))));
    const found = exact || close;
    if (!found) throw new Error(`Spotify kon geen betrouwbare match vinden voor “${track.title}” van ${track.artist}. Probeer een andere track of controleer de Spotify-catalogus.`);
    track.spotifyUri = found.uri;
    return found.uri;
  }

  async function playNext() {
    errorMessage.hidden = true;
    try {
      await stopPlayback();
      answerCard.hidden = true; revealed = false; currentTrack = chooseTrack();
      if (!currentTrack) throw new Error(`Er zijn geen nummers beschikbaar in genre ${genreNames[selectedGenre]}.`);
      const spotifyUri = await findSpotifyUri(currentTrack);
      await spotifyRequest('/me/player/play', 'PUT', { uris: [spotifyUri] });
      startedAt = Date.now(); elapsedBeforePause = 0; isPlaying = true;
      playState.textContent = 'NU AAN HET SPELEN'; playButton.innerHTML = '<span class="button-icon">Ⅱ</span><span>Pauzeer</span>';
      revealButton.disabled = false; setStatus('Er speelt een nummer…', 'Luister goed. Titel, artiest en jaartal blijven geheim.', true); vinyl.classList.add('playing');
      progressBar.style.width = '0%'; timeLabel.textContent = '0:00';
      progressTimer = setInterval(() => { const elapsed = elapsedBeforePause + (isPlaying ? (Date.now() - startedAt) / 1000 : 0); timeLabel.textContent = formatTime(elapsed); progressBar.style.width = `${Math.min(100, elapsed / clipSeconds * 100)}%`; }, 250);
      if (autoStop.checked) clipTimer = setTimeout(async () => { await stopPlayback(); setStatus('Track gestopt', 'Plaats je fiche in de tijdlijn en onthul daarna het antwoord.'); }, clipSeconds * 1000);
    } catch (err) { errorMessage.textContent = err.message || 'Kon Spotify niet starten.'; errorMessage.hidden = false; revealButton.disabled = true; vinyl.classList.remove('playing'); setStatus('Spotify niet gestart', 'Controleer je Spotify-koppeling en of Spotify actief is op een apparaat.'); }
  }
  playButton.addEventListener('click', async () => {
    if (!currentTrack || revealed) { await playNext(); return; }
    if (isPlaying) {
      try { await spotifyRequest('/me/player/pause', 'PUT'); elapsedBeforePause += (Date.now() - startedAt) / 1000; isPlaying = false; stopTimers(); vinyl.classList.remove('playing'); playButton.innerHTML = '<span class="button-icon">▶</span><span>Verder luisteren</span>'; playState.textContent = 'GEPAUZEERD'; setStatus('Track gepauzeerd', 'Druk op verder luisteren of onthul het antwoord.'); }
      catch (err) { errorMessage.textContent = err.message; errorMessage.hidden = false; }
    } else {
      try { await spotifyRequest('/me/player/play', 'PUT'); startedAt = Date.now(); isPlaying = true; vinyl.classList.add('playing'); playButton.innerHTML = '<span class="button-icon">Ⅱ</span><span>Pauzeer</span>'; setStatus('Er speelt een nummer…', 'Luister goed. Titel, artiest en jaartal blijven geheim.', true); progressTimer = setInterval(() => { const elapsed = elapsedBeforePause + (Date.now() - startedAt) / 1000; timeLabel.textContent = formatTime(elapsed); progressBar.style.width = `${Math.min(100, elapsed / clipSeconds * 100)}%`; }, 250); if (autoStop.checked) clipTimer = setTimeout(async () => { await stopPlayback(); setStatus('Track gestopt', 'Plaats je fiche in de tijdlijn en onthul daarna het antwoord.'); }, Math.max(0, clipSeconds - elapsedBeforePause) * 1000); }
      catch (err) { errorMessage.textContent = err.message; errorMessage.hidden = false; }
    }
  });
  revealButton.addEventListener('click', showAnswer);
  document.querySelector('#settingsToggle').addEventListener('click', () => settingsDialog.showModal());
  document.querySelector('#closeSettings').addEventListener('click', () => settingsDialog.close());
  clipLength.addEventListener('input', () => { clipSeconds = Number(clipLength.value); clipLengthValue.textContent = clipSeconds; });
  connectButton.addEventListener('click', spotifyLogin);

  (async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (params.get('error')) setConnection(`Spotify-koppeling geannuleerd: ${params.get('error')}`);
    else if (code) {
      try { await exchangeCode(code); settingsDialog.showModal(); }
      catch (err) { setConnection(err.message); settingsDialog.showModal(); }
    } else if (accessToken && tokenExpiry > Date.now()) setConnection('Spotify is gekoppeld.', true);
    else if (refreshToken && clientId) setConnection('Spotify-koppeling opgeslagen; sessie wordt vernieuwd.', true);
    else setConnection('Spotify is nog niet gekoppeld.');
  })();
})();
