(() => {
  'use strict';
  const lists = [
    window.LIB_V2_POP,
    window.LIB_V2_ROCK,
    window.LIB_V2_NEDERLANDS,
    window.LIB_V2_GUILTY,
    window.LIB_V2_YACHTROCK,
    window.LIB_V2_SOUL,
    window.LIB_V2_FUNKDISCO,
    window.LIB_V2_COUNTRY,
    window.LIB_V2_GITAAR,
    window.LIB_V2_BLUES_JAZZ_SWING
  ];
  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const trackKey = (artist, title) => `${normalize(artist)}\u0000${normalize(title)}`;

  // Deze tracks blijven volledig beschikbaar binnen hun eigen genre(s), maar
  // worden uit "Alles" gehouden om de jaardistributie gelijkmatiger te maken.
  // De selectie is bewust gecureerd: in piekjaren blijven bekende hits én
  // vertegenwoordigers van uiteenlopende muziekstijlen behouden.
  const allExcluded = new Set([
    ['Corry Brokken', 'Net als toen'],
    ['Eddie Cochran', "C'mon Everybody"],
    ['Duane Eddy', "Rebel-'Rouser"],
    ['Jimmy Frey', 'Rozen voor Sandra'],
    ['Engelbert Humperdinck', 'Release Me'],
    ['Aretha Franklin', 'Chain of Fools'],
    ['Tammy Wynette', 'D-I-V-O-R-C-E'],
    ['Todd Rundgren', "Hello It's Me"],

    ['Corry Konings', 'Ik krijg een heel apart gevoel van binnen'],
    ['Brotherhood of Man', 'Save Your Kisses for Me'],
    ['Boz Scaggs', 'Lido Shuffle'],
    ['Firefall', 'You Are the Woman'],
    ['Orleans', 'Still the One'],
    ['Al Stewart', 'On the Border'],
    ['England Dan & John Ford Coley', "I'd Really Love to See You Tonight"],
    ['England Dan & John Ford Coley', 'Nights Are Forever Without You'],
    ['Climax Blues Band', "Couldn't Get It Right"],
    ['Andrew Gold', 'Lonely Boy'],
    ['Leo Sayer', 'You Make Me Feel Like Dancing'],
    ['Stephen Bishop', 'On and On'],
    ['The Trammps', 'Disco Inferno'],

    ['Steely Dan', 'Deacon Blues'],
    ['Player', "This Time I'm in It for Love"],
    ['Fleetwood Mac', 'You Make Loving Fun'],
    ['Pablo Cruise', "Whatcha Gonna Do?"],
    ['Firefall', 'Just Remember I Love You'],
    ['Johnny Paycheck', 'Take This Job and Shove It'],
    ['Vader Abraham', "'t Smurfenlied"],
    ['Baccara', 'Yes Sir, I Can Boogie'],
    ['Chuck Mangione', 'Feels So Good'],

    ['Chris Norman & Suzi Quatro', "Stumblin' In"],
    ['Kenny Loggins', 'Whenever I Call You "Friend"'],
    ['Ambrosia', 'How Much I Feel'],
    ['Little River Band', 'Reminiscing'],
    ['Gerry Rafferty', 'Right Down the Line'],
    ['10cc', 'Dreadlock Holiday'],
    ['Billy Joel', 'My Life'],
    ['Pablo Cruise', 'Love Will Find a Way'],
    ['Dr. Hook', 'Sharing the Night Together'],
    ['Dr. Hook', "When You're in Love with a Beautiful Woman"],
    ['Andrew Gold', 'Never Let Her Slip Away'],
    ['Robert Palmer', 'Every Kinda People'],
    ['Sylvester', 'You Make Me Feel (Mighty Real)'],
    ['A Taste of Honey', 'Boogie Oogie Oogie'],
    ['Peaches & Herb', 'Shake Your Groove Thing'],
    ['Cheryl Lynn', 'Got to Be Real'],
    ['Waylon Jennings & Willie Nelson', "Mammas Don't Let Your Babies Grow Up to Be Cowboys"],
    ['Don Williams', 'Tulsa Time'],
    ['Racey', 'Some Girls'],
    ['Little River Band', 'Lonesome Loser'],
    ['Rupert Holmes', 'Him'],
    ['Sister Sledge', 'Lost in Music'],
    ['The Whispers', 'And the Beat Goes On'],

    ['Stephen Bishop', 'It Might Be You'],
    ['Roxy Music', 'Avalon'],
    ['Steve Winwood', 'Valerie'],
    ['The Gap Band', 'You Dropped a Bomb on Me'],
    ['Evelyn King', 'Love Come Down'],
    ['Alabama', 'Mountain Music'],

    ['Jonny Lang', 'Lie to Me'],
    ['Squirrel Nut Zippers', 'Hell'],
    ['Lauryn Hill', 'Ex-Factor'],
    ['Fastball', 'The Way'],
    ['Big Bad Voodoo Daddy', 'You & Me & the Bottle Makes 3 Tonight (Baby)'],
    ['B*Witched', "C'est la Vie"],
    ['The Chicks', 'Wide Open Spaces'],

    ['Josh Turner', 'Your Man'],
    ['Robin Thicke', 'Lost Without U'],
    ['Little Big Town', 'Pontoon'],
    ['Foals', 'My Number'],
    ['Noah Kahan', 'Northern Attitude'],
    ['Lainey Wilson', 'Heart Like a Truck']
  ].map(([artist, title]) => trackKey(artist, title)));

  const merged = new Map();
  for (const list of lists) {
    for (const track of (Array.isArray(list) ? list : [])) {
      if (!track?.title || !track?.artist) continue;
      const key = trackKey(track.artist, track.title);
      if (!merged.has(key)) {
        merged.set(key, { ...track, genres: [...new Set(track.genres || [])] });
        continue;
      }
      const existing = merged.get(key);
      existing.genres = [...new Set([...(existing.genres || []), ...(track.genres || [])])];
      if (!existing.spotifyUri && track.spotifyUri) existing.spotifyUri = track.spotifyUri;
      if ((!existing.year || Number(track.year) < Number(existing.year)) && track.year) existing.year = track.year;
    }
  }

  window.TRACKS = [...merged.entries()].map(([key, track]) => ({
    ...track,
    includeInAll: !allExcluded.has(key)
  }));
})();
