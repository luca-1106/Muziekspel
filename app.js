(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const tracks = Array.isArray(window.TRACKS) ? window.TRACKS.filter(track => track?.title && track?.artist) : [];
  const genreNames = { alles: 'Alle genres', yachterock: 'Yachtrock', rock: 'Rock', disco: 'Disco', gitaarmuziek: 'Gitaarmuziek', nederlands: 'Nederlands' };
  let selectedGenre = 'alles';
  const setError = message => { $('#errorMessage').textContent = message || ''; $('#errorMessage').hidden = !message; };
  const setStatus = (title, detail, active = false) => { $('#statusText').textContent = title; $('#instruction').textContent = detail; $('#statusDot').classList.toggle('active', active); };
  const pool = () => {
    const matching = selectedGenre === 'alles' ? tracks : tracks.filter(track => Array.isArray(track.genres) ? track.genres.includes(selectedGenre) : track.genre === selectedGenre);
    return [...new Map(matching.map(track => [`${track.title}\u0000${track.artist}`.toLowerCase(), track])).values()];
  };
  function renderGenres() {
    const count = pool().length;
    $('#genreCount').textContent = `${count} nummers`;
    document.querySelectorAll('.genre-button').forEach(button => { const active = button.dataset.genre === selectedGenre; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  }
  function renderConnection(profile) {
    const connected = Boolean(profile);
    $('#connectionIcon').classList.toggle('connected', connected);
    $('#spotifyConnection').textContent = connected ? `Gekoppeld als ${profile.display_name || 'Spotify-gebruiker'}` : (window.SpotifyApp.configured() ? 'Spotify niet gekoppeld' : 'Spotify instellen vereist');
    $('#connectionDetail').textContent = connected ? 'Klaar om een sessie te starten.' : (window.SpotifyApp.configured() ? 'Koppel je eigen account om af te spelen.' : 'De eigenaar moet eerst de Client ID instellen.');
    $('#connectSpotify').hidden = connected; $('#disconnectSpotify').hidden = !connected; $('#connectSpotify').disabled = !connected && !window.SpotifyApp.configured();
  }
  async function refreshConnection() { if (!window.SpotifyApp.hasSession()) return renderConnection(null); try { renderConnection(await window.SpotifyApp.profile()); } catch (_) { window.SpotifyApp.clear(); renderConnection(null); } }
  async function guarded(action) { try { setError(); await action(); } catch (error) { setError(error.message || 'Er ging iets mis.'); setStatus('Actie niet gelukt', 'Controleer de Spotify-koppeling en probeer opnieuw.'); } }

  document.querySelectorAll('.genre-button').forEach(button => button.addEventListener('click', () => { selectedGenre = button.dataset.genre; renderGenres(); setStatus(`${genreNames[selectedGenre]} geselecteerd`, 'Druk op Start sessie om door te gaan.'); }));
  $('#connectSpotify').addEventListener('click', () => guarded(() => window.SpotifyApp.login()));
  $('#disconnectSpotify').addEventListener('click', () => { window.SpotifyApp.clear(); renderConnection(null); setStatus('Spotify ontkoppeld', 'Koppel een account om een sessie te starten.'); });
  $('#startSession').addEventListener('click', () => guarded(async () => {
    if (!window.SpotifyApp.hasSession()) { await window.SpotifyApp.login(); return; }
    await window.SpotifyApp.token();
    sessionStorage.setItem('muziekmix.session.genre', selectedGenre);
    window.location.assign('session.html?v=progress-only-1');
  }));
  (async () => { renderGenres(); renderConnection(null); try { await window.SpotifyApp.handleCallback(); } catch (error) { setError(error.message); } await refreshConnection(); })();
})();
