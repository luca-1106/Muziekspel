// Controle voor de geplande muziekbibliotheek van Muziekmix.
// Uitvoeren met: node scripts/check-library.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('tracks.js', 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const tracks = context.window.TRACKS || [];
const genres = ['yachterock','rock','disco','gitaarmuziek','nederlands','pop','soul','hiphop','dance','country'];
let errors = [];
for (const genre of genres) {
  const entries = tracks.filter(t => t.genres?.includes(genre));
  const unique = new Set();
  const artistCounts = new Map();
  const decades = new Map();
  for (const t of entries) {
    const key = (t.artist + '\0' + t.title).toLocaleLowerCase();
    if (unique.has(key)) errors.push(genre + ': dubbel nummer ' + t.artist + ' - ' + t.title);
    unique.add(key);
    const artist = t.artist.toLocaleLowerCase().trim();
    artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
    if (!Number.isInteger(t.year) || t.year < 1930 || t.year > 2026) errors.push(genre + ': onwaarschijnlijk jaartal ' + t.title);
    decades.set(Math.floor(t.year / 10) * 10, (decades.get(Math.floor(t.year / 10) * 10) || 0) + 1);
  }
  if (unique.size < 100) errors.push(genre + ': ' + unique.size + ' nummers, minimaal 100 vereist');
  for (const [artist, count] of artistCounts) if (count > 3) errors.push(genre + ': ' + artist + ' heeft ' + count + ' nummers');
  console.log(genre + ': ' + unique.size + ' nummers, ' + artistCounts.size + ' artiesten, decennia ' + JSON.stringify(Object.fromEntries([...decades].sort((a,b)=>a[0]-b[0]))));
}
if (errors.length) { console.error('\n' + errors.join('\n')); process.exitCode = 1; }
else console.log('Alle automatische controles geslaagd. Bekendheid en genre-fit blijven handmatige controles.');
