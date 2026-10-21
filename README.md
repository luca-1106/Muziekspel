# Muziekmix

Een mobiele Spotify-randomizer. Kies een genre, koppel je eigen Spotify-account en start een sessie. De app speelt uitsluitend nummers uit het gekozen genre en herhaalt binnen die sessie geen nummer.

Titel, artiest, albumhoes en een link naar Spotify zijn zichtbaar tijdens het afspelen. Dat is nodig voor een Spotify-streamingintegratie.

## Voor je publiceert

1. Maak of open een app in het [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Kopieer de **Client ID** naar `config.js`, bij `spotifyClientId`.
3. Voeg de precieze publieke URL van de app toe als Redirect URI in het Spotify Developer Dashboard. Voor GitHub Pages is dat bijvoorbeeld `https://jouw-gebruikersnaam.github.io/Muziekspel/`.
4. Publiceer alle bestanden naar GitHub Pages via **Settings → Pages → Deploy from a branch → main → /(root)**.

De Client ID is openbaar en kan veilig in `config.js` staan. Zet **nooit** een Client Secret, Spotify-wachtwoord, access token of refresh token in de repository.

## Gebruik

1. Kies een genre.
2. Druk op **Koppelen** en log in met je eigen Spotify-account.
3. Open Spotify op de telefoon, computer of speaker waarop je wilt luisteren en maak dat apparaat actief.
4. Druk op **Start sessie**. De app kiest en speelt een willekeurig nummer uit het geselecteerde genre.
5. Gebruik **Pauzeer**, **Verder luisteren** en **Volgend nummer**. Na de laatste track toont de app dat de sessie is afgerond; **Nieuwe sessie** start weer met een lege sessielijst.

## Spotify-vereisten en privacy

- Afspeelbediening via de Spotify Web API vereist Spotify Premium.
- In de huidige Development Mode gelden Spotify’s gebruikers- en endpointbeperkingen. Voeg vrienden zo nodig als geautoriseerde gebruiker toe in het Developer Dashboard.
- De app vraagt alleen `user-modify-playback-state` en `user-read-playback-state` aan.
- OAuth gebruikt Authorization Code met PKCE. Tokens worden uitsluitend in de lokale browseropslag van de ingelogde gebruiker bewaard; verschillende browsers delen geen sessie.
- Met **Spotify ontkoppelen** verwijder je de lokale tokens.

## Catalogus beheren

De nummers staan in `tracks.js`. Een item heeft minstens `title`, `artist`, `year` en `genres`. Voeg wanneer mogelijk een vaste Spotify URI toe om de exacte opname te gebruiken:

```js
{ title: 'Peg', artist: 'Steely Dan', year: 1978, genres: ['yachterock'], spotifyUri: 'spotify:track:TRACK_ID' }
```

Zonder URI zoekt de app naar een exacte titel- en artiestmatch en weigert zij duidelijke live-, cover-, karaoke- en tributeversies. Controleer toegevoegde nummers altijd zelf; een vooraf ingevulde URI is betrouwbaarder.

## Problemen oplossen

- **Spotify instellen vereist**: vul de Client ID in `config.js` in en publiceer opnieuw.
- **Redirect URI-mismatch**: de URL in Spotify moet exact gelijk zijn aan de gepubliceerde URL, inclusief eventuele repositorymap en afsluitende slash.
- **Geen actief apparaat**: open Spotify op het gewenste apparaat en speel daar kort muziek af.
- **403 / afspelen geweigerd**: controleer Premium en of het account is toegestaan voor je Developer-app.
- **Geen betrouwbare versie**: voeg een gecontroleerde `spotifyUri` toe aan dat catalogusitem.

## Controle

De code is statisch gecontroleerd op OAuth-PKCE met state-validatie, tokenverversing, sessiereset, genrefiltering, non-repeat selectie, zichtbare verbindingsstatus en foutmeldingen. Live OAuth en Spotify-afspelen moeten na het instellen van jouw Client ID, Redirect URI en Premium-account nog in de gepubliceerde app worden getest.
