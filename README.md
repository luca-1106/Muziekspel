# Tijdlijn — Muziekspel met Spotify

Mobiele webapp voor een muziek-tijdlijnspel. De Play-knop start een willekeurige track via de Spotify Web API; titel, artiest en jaartal worden in de app pas zichtbaar na **Onthul antwoord**.

## Benodigd
- Een Spotify Premium-account.
- Een gratis Spotify Developer-app en de Client ID daarvan.
- Een actief Spotify-apparaat (bijvoorbeeld de Spotify-app op je telefoon of een Spotify Connect-speaker).
- GitHub Pages of een andere HTTPS-hosting voor de website.

> Let op: Spotify's Developer Policy verbiedt integratie in games/triviaquizzen. Deze technische demo is niet officieel goedgekeurd door Spotify; gebruik is op eigen verantwoordelijkheid. API-toegang kan door Spotify worden beperkt.

## Publiceren op GitHub Pages
1. Upload alle bestanden in deze map naar de hoofdmap van een GitHub-repository.
2. Open **Settings → Pages** en kies `Deploy from a branch`, branch `main`, map `/ (root)`.
3. Wacht tot GitHub de website publiceert. Kopieer de volledige website-URL, inclusief eventuele repository-submap.

## Spotify instellen voor een klein groepje vrienden
1. Open https://developer.spotify.com/dashboard en open je Spotify Developer-app (of maak er een aan).
2. Kopieer de **Client ID** en open `app.js` in GitHub.
3. Vervang `PASTE_YOUR_SPOTIFY_CLIENT_ID_HERE` in `const SPOTIFY_CLIENT_ID = '...'` door je Client ID. Zet **nooit** de Client Secret in de code.
4. Open de Spotify Developer-app-instellingen en voeg de exacte GitHub Pages-URL toe als **Redirect URI**. Gebruik HTTPS en neem het volledige pad van de website over.
5. Open in de Developer Dashboard de gebruikers-/allowlist-instellingen en voeg de Spotify-accounts van je vrienden toe (meestal het e-mailadres dat aan hun Spotify-account is gekoppeld). Development Mode staat momenteel maximaal vijf geautoriseerde gebruikers toe, inclusief de eigenaar.
6. Wacht tot GitHub Pages de wijziging heeft gepubliceerd.
7. Jij en je vrienden openen de website, gaan naar ⚙ Instellingen en drukken op **Koppel Spotify**. Iedereen logt in met het eigen Spotify-account en geeft toestemming.
8. Start de Spotify-app op de telefoon of speaker die je wilt gebruiken en druk daarna op Play in het muziekspel.

De website gebruikt OAuth Authorization Code met PKCE; er staat geen Client Secret in de code. Tokens worden per gebruiker in diens eigen browser opgeslagen. De Client ID is geen geheim. Deel nooit access tokens, refresh tokens of je Spotify-wachtwoord.

**Belangrijk:** Spotify's huidige Developer Policy verbiedt apps die games of triviaquizzen maken. Dit muziekspel valt daar waarschijnlijk onder; Spotify kan toegang weigeren of intrekken. Controleer de actuele beleidsregels voordat je het met vrienden gebruikt.

## Nummers toevoegen
Bewerk `tracks.js`. Gebruik per nummer:

```js
{ spotifyUri: "spotify:track:TRACK_ID", year: 1999, title: "Titel", artist: "Artiest" }
```

Zo vind je de URI: open een nummer in Spotify → **Delen → Link naar nummer**. Een link als `https://open.spotify.com/track/ABC123...` wordt `spotify:track:ABC123...`.

Gebruik het oorspronkelijke uitgavejaar van de opname zoals je dat in het spel wilt hanteren. De voorbeeldtrack is alleen een placeholder; vervang titel, artiest, jaar en URI door gegevens die bij elkaar horen. Zorg dat er minimaal één geldige track is.

## Gebruik
- **Play**: start een willekeurige track via Spotify.
- **Pauzeer / Verder luisteren**: bedient de huidige track.
- **Onthul antwoord**: toont artiest, titel en jaar in de webapp.
- **Volgende track**: verschijnt na onthullen.
- In Instellingen kun je de afspeelduur instellen.

## Problemen oplossen
- **Geen actief Spotify-apparaat**: open de Spotify-app op je telefoon of een speaker en start daar eventueel kort muziek af om het apparaat actief te maken.
- **INVALID_CLIENT / redirect_uri mismatch**: controleer de Client ID en voeg exact dezelfde URL toe als Redirect URI in het Developer Dashboard.
- **403 / afspelen geweigerd**: controleer Premium, de scopes en de status/toegang van je Spotify Developer-app.
- **Geen tracks ingesteld**: controleer dat elke track een `spotify:track:` URI, jaar, titel en artiest heeft.

## Technische notitie
Deze app is statisch en kan op GitHub Pages draaien. Spotify-authenticatie en afspeelbediening gebeuren vanuit de browser; er is geen extra server of betaald hostingabonnement nodig. Beschikbaarheid van Spotify API-functies en toegang tot de Developer-app zijn afhankelijk van Spotify's actuele voorwaarden en accountinstellingen.


## Genres en muziekbibliotheek

De app heeft zes keuzes: **Alles**, **Yachtrock**, **Rock**, **Disco**, **Gitaarmuziek** en **Nederlands**. De catalogus is ingebouwd in `tracks.js` en bevat 100 nummers per genre. De keuze Alles mixt de volledige catalogus zonder dubbele titel/artiest-combinaties.

De catalogus bevat titel, artiest en jaar. Bij het starten zoekt de app via de Spotify Web API een passende track op basis van titel en artiest, slaat de gevonden Spotify-URI lokaal in het geheugen van de pagina op en start die track op het actieve Spotify-apparaat. De app vereist een gekoppeld Spotify-account en een actief Spotify-apparaat. Controleer na het publiceren de Developer Dashboard-instellingen en test een aantal nummers per genre; Spotify kan soms een andere versie of live-opname als eerste zoekresultaat geven.


## Genres en muziekbibliotheek

De app heeft zes keuzes: **Alles**, **Yachtrock**, **Rock**, **Disco**, **Gitaarmuziek** en **Nederlands**. De catalogus is ingebouwd in `tracks.js` en bevat 100 nummers per genre. De keuze Alles mixt de volledige catalogus zonder dubbele titel/artiest-combinaties.

De catalogus bevat titel, artiest en jaar. Bij het starten zoekt de app via de Spotify Web API een passende track op basis van titel en artiest, slaat de gevonden Spotify-URI lokaal in het geheugen van de pagina op en start die track op het actieve Spotify-apparaat. De app vereist een gekoppeld Spotify-account en een actief Spotify-apparaat. Controleer na het publiceren de Developer Dashboard-instellingen en test een aantal nummers per genre; Spotify kan soms een andere versie of live-opname als eerste zoekresultaat geven.
