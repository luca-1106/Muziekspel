(() => {
  'use strict';
  const clientId = (window.APP_CONFIG?.spotifyClientId || '').trim();
  const placeholder = 'PASTE_YOUR_SPOTIFY_CLIENT_ID_HERE';
  const keys = { access: 'muziekmix.spotify.access', expiry: 'muziekmix.spotify.expiry', refresh: 'muziekmix.spotify.refresh', verifier: 'muziekmix.spotify.verifier', state: 'muziekmix.spotify.state' };
  let accessToken = localStorage.getItem(keys.access) || '';
  let tokenExpiry = Number(localStorage.getItem(keys.expiry) || 0);
  let refreshToken = localStorage.getItem(keys.refresh) || '';
  const redirectUri = `${window.location.origin}${window.location.pathname}`;
  const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const random = length => base64url(crypto.getRandomValues(new Uint8Array(length)));
  const digest = value => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));

  function clear() { Object.values(keys).forEach(key => localStorage.removeItem(key)); accessToken = ''; tokenExpiry = 0; refreshToken = ''; }
  function save(data) { accessToken = data.access_token; tokenExpiry = Date.now() + Number(data.expires_in || 3600) * 1000; localStorage.setItem(keys.access, accessToken); localStorage.setItem(keys.expiry, String(tokenExpiry)); if (data.refresh_token) { refreshToken = data.refresh_token; localStorage.setItem(keys.refresh, refreshToken); } }
  async function tokenRequest(values) {
    const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error_description || 'Spotify-aanmelding is mislukt.');
    return data;
  }
  async function token() {
    if (accessToken && Date.now() < tokenExpiry - 60_000) return accessToken;
    if (!refreshToken) throw new Error('Koppel eerst je Spotify-account.');
    try { save(await tokenRequest({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken })); return accessToken; }
    catch (_) { clear(); throw new Error('Je Spotify-sessie is verlopen. Koppel je account opnieuw.'); }
  }
  async function request(path, method = 'GET', body, retry = true) {
    const response = await fetch(`https://api.spotify.com/v1${path}`, { method, headers: { Authorization: `Bearer ${await token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && retry) { tokenExpiry = 0; return request(path, method, body, false); }
    if (!response.ok) {
      if (response.status === 404) throw new Error('Geen actief Spotify-apparaat gevonden. Open Spotify op je telefoon of speaker en speel daar kort iets af.');
      if (response.status === 403) throw new Error('Spotify weigert afspelen. Hiervoor zijn Spotify Premium en toegang tot deze Developer-app nodig.');
      if (response.status === 429) throw new Error('Spotify ontvangt te veel verzoeken. Wacht even en probeer opnieuw.');
      throw new Error(data.error?.message || `Spotify-fout (${response.status}).`);
    }
    return data;
  }
  async function login() {
    if (!clientId || clientId === placeholder) throw new Error('De eigenaar moet eerst de Spotify Client ID invullen in config.js en opnieuw publiceren.');
    const verifier = random(64), state = random(24), challenge = base64url(await digest(verifier));
    localStorage.setItem(keys.verifier, verifier); localStorage.setItem(keys.state, state);
    const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri, code_challenge_method: 'S256', code_challenge: challenge, state, scope: 'user-modify-playback-state user-read-playback-state' });
    window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
  }
  async function handleCallback() {
    const params = new URLSearchParams(window.location.search), code = params.get('code'), error = params.get('error');
    if (!code && !error) return null;
    history.replaceState({}, document.title, redirectUri);
    if (error) { localStorage.removeItem(keys.verifier); localStorage.removeItem(keys.state); throw new Error(error === 'access_denied' ? 'Spotify-koppeling is geannuleerd.' : `Spotify-koppeling mislukt: ${error}.`); }
    if (!params.get('state') || params.get('state') !== localStorage.getItem(keys.state)) throw new Error('De Spotify-aanmelding kon niet veilig worden gecontroleerd. Probeer opnieuw.');
    const verifier = localStorage.getItem(keys.verifier);
    if (!verifier) throw new Error('De inlogsessie is verlopen. Probeer Spotify opnieuw te koppelen.');
    save(await tokenRequest({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier }));
    localStorage.removeItem(keys.verifier); localStorage.removeItem(keys.state);
    return true;
  }
  window.SpotifyApp = { configured: () => Boolean(clientId && clientId !== placeholder), hasSession: () => Boolean(accessToken || refreshToken), clear, login, token, request, handleCallback, profile: () => request('/me') };
})();
