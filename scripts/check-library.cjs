// Controleer de werkelijk actieve bibliotheek, inclusief overlap.
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: {} };
const files = [
  'tracks.js',
  'library/hiphop.js', 'library/country.js', 'library/dance.js',
  'library/pop.js', 'library/soul.js',
  'library/nederlands-refresh.js', 'library/rock-refresh.js',
  'library/gitaarmuziek-refresh.js', 'library/yachterock-refresh.js',
  'library/disco-refresh.js', 'library/merge.js'
];
for (const file of files) vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
const genres = ['yachterock','rock','disco','gitaarmuziek','nederlands','pop','soul','hiphop','dance','country'];
const tracks = context.window.TRACKS;
const errors = [];
for (const genre of genres) {
  const entries = tracks.filter(t => t.genres.includes(genre));
  const artists = new Map();
  const unique = new Set();
  const decades = {};
  for (const t of entries) {
    const artist = t.artist.toLocaleLowerCase().trim();
    const key = artist + '\\0' + t.title.toLocaleLowerCase().trim();
    if (unique.has(key)) errors.push(genre + ': dubbel nummer ' + key);
    unique.add(key);
    artists.set(artist, (artists.get(artist) || 0) + 1);
    if (!Number.isInteger(t.year) || t.year < 1930 || t.year > 2026) errors.push(genre + ': onjuist jaar ' + t.title);
    const decade = Math.floor(t.year / 10) * 10;
    decades[decade] = (decades[decade] || 0) + 1;
  }
  if (unique.size < 100) errors.push(genre + ': minder dan 100 nummers');
  if (artists.size < 75) errors.push(genre + ': minder dan 75 artiesten');
  for (const [artist, count] of artists) if (count > 3) errors.push(genre + ': meer dan 3 van ' + artist);
  console.log(genre + ': ' + entries.length + ' nummers, ' + artists.size + ' artiesten, decennia: ' + JSON.stringify(decades));
}
console.log('Alles: ' + tracks.length + ' unieke nummers');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('Alle kwantitatieve controles geslaagd. Spotify-zoekresultaten, oorspronkelijke releasedata en genre-fit zijn niet extern geverifieerd.');
