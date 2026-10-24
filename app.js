(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const tracks = Array.isArray(window.TRACKS) ? window.TRACKS.filter(track => track?.title && track?.artist) : [];
  const genreNames = { alles: 'Alle genres', pop: 'Pop', rock: 'Rock', nederlands: 'Nederlandstalig', guilty: 'Guilty Pleasures', yachterock: 'Yachtrock', soul: 'Soul & R&B', funkdisco: 'Funk & Disco', country: 'Country & Folk', gitaarmuziek: 'Gitaarmuziek', bluesjazzswing: 'Blues, Jazz & Swing' };
  let selectedGenres = ['alles'];

  const setError = message => { $('#errorMessage').textContent = message || ''; $('#errorMessage').hidden = !message; };
  const setStatus = (title, detail, active = false) => { $('#statusText').textContent = title; $('#instruction').textContent = detail; $('#statusDot').classList.toggle('active', active); };
  const selectedLabel = () => {
    if (selectedGenres.includes('alles')) return genreNames.alles;
    if (selectedGenres.length === 1) return genreNames[selectedGenres[0]];
    if (selectedGenres.length === 2) return selectedGenres.map(value => genreNames[value]).join(' + ');
    return `${selectedGenres.length} genres geselecteerd`;
  };
  const pool = () => {
    const all = selectedGenres.includes('alles');
    const matching = all ? tracks.filter(track => track.includeInAll !== false) : tracks.filter(track => {
      const genres = Array.isArray(track.genres) ? track.genres : [track.genre].filter(Boolean);
      return genres.some(genre => selectedGenres.includes(genre));
    });
    return [...new Map(matching.map(track => [`${track.title}\u0000${track.artist}`.toLowerCase(), track])).values()];
  };

  function renderGenres() {
    const count = pool().length;
    $('#genreCount').textContent = `${count} nummers`;
    $('#genreSelectionText').textContent = selectedLabel();
    document.querySelectorAll('#genreMenu input[type="checkbox"]').forEach(input => {
      input.checked = selectedGenres.includes(input.value);
    });
  }

  function closeGenreMenu() {
    $('#genreMenu').hidden = true;
    $('#genreToggle').setAttribute('aria-expanded', 'false');
  }

  function renderConnection(profile) {
    const connected = Boolean(profile);
    $('#connectionIcon').classList.toggle('connected', connected);
    $('#spotifyConnection').textContent = connected ? `Gekoppeld als ${profile.display_name || 'Spotify-gebruiker'}` : (window.SpotifyApp.configured() ? 'Spotify niet gekoppeld' : 'Spotify instellen vereist');
    $('#connectionDetail').textContent = connected ? 'Klaar om een sessie te starten.' : (window.SpotifyApp.configured() ? 'Koppel je eigen account om af te spelen.' : 'De eigenaar moet eerst de Client ID instellen.');
    $('#connectSpotify').hidden = connected;
    $('#disconnectSpotify').hidden = !connected;
    $('#connectSpotify').disabled = !connected && !window.SpotifyApp.configured();
  }

  async function refreshConnection() {
    if (!window.SpotifyApp.hasSession()) return renderConnection(null);
    try { renderConnection(await window.SpotifyApp.profile()); }
    catch (_) { window.SpotifyApp.clear(); renderConnection(null); }
  }

  async function guarded(action) {
    try { setError(); await action(); }
    catch (error) { setError(error.message || 'Er ging iets mis.'); setStatus('Actie niet gelukt', 'Controleer de Spotify-koppeling en probeer opnieuw.'); }
  }

  $('#genreToggle').addEventListener('click', () => {
    const menu = $('#genreMenu');
    menu.hidden = !menu.hidden;
    $('#genreToggle').setAttribute('aria-expanded', String(!menu.hidden));
  });

  $('#genreMenu').addEventListener('change', event => {
    const input = event.target.closest('input[type="checkbox"]');
    if (!input) return;

    if (input.value === 'alles') {
      selectedGenres = input.checked ? ['alles'] : [];
    } else {
      selectedGenres = selectedGenres.filter(value => value !== 'alles');
      if (input.checked && !selectedGenres.includes(input.value)) selectedGenres.push(input.value);
      if (!input.checked) selectedGenres = selectedGenres.filter(value => value !== input.value);
    }

    if (!selectedGenres.length) selectedGenres = ['alles'];
    renderGenres();
    setStatus(`${selectedLabel()} geselecteerd`, 'Druk op Start sessie om door te gaan.');
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.genre-multi')) closeGenreMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeGenreMenu();
  });

  $('#connectSpotify').addEventListener('click', () => guarded(() => window.SpotifyApp.login()));
  $('#disconnectSpotify').addEventListener('click', () => { window.SpotifyApp.clear(); renderConnection(null); setStatus('Spotify ontkoppeld', 'Koppel een account om een sessie te starten.'); });
  $('#startSession').addEventListener('click', () => guarded(async () => {
    if (!window.SpotifyApp.hasSession()) { await window.SpotifyApp.login(); return; }
    await window.SpotifyApp.token();
    sessionStorage.setItem('muziekmix.session.genres', JSON.stringify(selectedGenres));
    sessionStorage.removeItem('muziekmix.session.genre');
    window.location.assign('session.html?v=multi-genre-1');
  }));

  (async () => {
    renderGenres();
    renderConnection(null);
    try { await window.SpotifyApp.handleCallback(); } catch (error) { setError(error.message); }
    await refreshConnection();
  })();
})();
