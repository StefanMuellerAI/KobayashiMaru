# Kobayashi Maru

Eine Kommandoprüfung im Stil eines Raumschiff-Bordcomputers. Als Kadett führen Sie ein Schiff an der Grenze zur Neutralen Zone, ein Frachter sendet einen Notruf, und Sie entscheiden Minute für Minute. Die Prüfung ist nicht zu gewinnen. Bewertet wird, wie Sie führen.

Läuft komplett im Browser, ohne Server, ohne Build-Schritt und ohne Abrufe bei Dritten.

## Was drin ist

- **Zufallsszenario bei jedem Versuch:** vier Lagen (Hinterhalt, Patrouille, Minenfeld, Köder), drei gegnerische Kommandanten, wechselnde Entfernung, Zahl der Menschen an Bord, Restzeit der Lebenserhaltung und Ereignisse wie Ionensturm oder Transporterausfall.
- **Taktische Anzeige, Instrumente und Brückenmeldungen**, Befehle per Klick oder Zifferntaste.
- **Bewertung durch die Akademie** in sechs Kategorien: Lagebild, Entschlusskraft, Verantwortung für die Besatzung, Rettungsauftrag, Verhältnismäßigkeit, Haltung im Scheitern. Ab 56 von 100 Punkten bestanden, ab 78 mit Auszeichnung.
- **Musik, die der Lage folgt:** im Browser erzeugt (Web Audio), von ruhig an der Grenze bis treibend im Gefecht, mit eigenen Stimmungen für jeden Ausgang. Musik und Effekte lassen sich getrennt abschalten.
- **Akte** mit allen abgeschlossenen Versuchen, gespeichert im Browser.
- **Deutsch und Englisch:** Die Sprache folgt der Browser-Einstellung (deutschsprachige Browser bekommen Deutsch, alle anderen Englisch) und lässt sich in der Seitenleiste umschalten. Beim Umschalten wechselt alles sofort, auch laufende Meldungen, Protokoll, Akte und Auswertung.
- Ein versteckter Weg, die Simulation umzuprogrammieren. Wie beim Vorbild.

## Lokal starten

Voraussetzung: Node.js ab Version 18. Es gibt keine Abhängigkeiten, `npm install` ist nicht nötig.

```bash
npm start
```

Danach läuft die Seite auf http://localhost:3000. Der lokale Server wendet dieselben Header an wie Vercel (aus `vercel.json`).

Alternativ geht jeder statische Server, der den Ordner `public/` ausliefert.

## Tests

```bash
npm test
```

Die Tests spielen die Spiellogik tausendfach mit verschiedenen Spielweisen durch und prüfen unter anderem:

- dass ohne Eingriff in den Simulationskern kein Sieg möglich ist,
- dass die Bilanz aus Geretteten, Toten und Besatzung in jedem Durchlauf aufgeht,
- dass gleicher Startwert und gleiche Befehle denselben Verlauf ergeben,
- dass mit verändertem Kern ein Sieg möglich ist,
- dass Deutsch und Englisch dieselben Texte haben und die englische Fassung kein Deutsch und keine Lücken enthält.

## Auf Vercel veröffentlichen

1. In Vercel auf **Add New → Project** gehen und dieses Repository importieren.
2. Die Einstellungen kommen aus `vercel.json`: Framework „Other“, kein Install- und kein Build-Schritt, ausgeliefert wird der Ordner `public/`. Im Import-Dialog muss nichts geändert werden, Umgebungsvariablen braucht es keine.
3. **Deploy** klicken.

Danach erzeugt jeder Push auf `main` ein neues Produktions-Deployment, jeder andere Branch eine Vorschau-URL.

Per Kommandozeile geht es auch: `npx vercel` für eine Vorschau, `npx vercel --prod` für die Produktion.

## Aufbau

```
public/
  index.html        Seitengerüst
  impressum.html    Impressum (im Footer verlinkt)
  datenschutz.html  Datenschutzerklärung (im Footer verlinkt)
  imprint.html      Impressum, englische Übersetzung
  privacy.html      Datenschutzerklärung, englische Übersetzung
  css/style.css     Gestaltung, Schrift-Einbindung
  js/i18n.js        Alle Texte auf Deutsch und Englisch, Spracherkennung
  js/engine.js      Spiellogik: Szenario, Befehle, Gegner, Bewertung (ohne Browser lauffähig)
  js/music.js       Musik-Engine: Stimmungen, Akkordfolgen, Instrumente
  js/app.js         Oberfläche: Anzeige, Taktikkarte, Ton, Akte, Wartung
  fonts/            Schrift Antonio (SIL Open Font License, siehe fonts/OFL.txt)
  favicon.svg
tests/              Simulationstests (node:test)
scripts/serve.mjs   Lokaler Server ohne Abhängigkeiten
vercel.json         Ausgabeordner und Sicherheits-Header für Vercel
```

## Datenschutz

Die Seite lädt nichts von fremden Servern, auch die Schrift wird selbst ausgeliefert. Es gibt keine Cookies und kein Tracking. Akte und Einstellungen liegen nur im `localStorage` des jeweiligen Browsers.

Impressum und Datenschutzerklärung stehen in `public/impressum.html` und `public/datenschutz.html`, die englischen Übersetzungen in `public/imprint.html` und `public/privacy.html`. Verbindlich ist die deutsche Fassung. Wer Hosting, Speicherung im Browser oder eingebundene Dienste ändert, muss beide Datenschutzerklärungen mit anpassen.

## Texte und Übersetzungen

Alle Texte stehen in `public/js/i18n.js`, je ein Abschnitt für Deutsch und Englisch. Spiellogik und Oberfläche speichern nur Schlüssel mit Werten, der Satz entsteht erst beim Anzeigen. Ein neuer Text braucht deshalb immer einen Eintrag in beiden Sprachen; `npm test` schlägt fehl, wenn einer fehlt.

Feste Texte im HTML tragen `data-i18n="schlüssel"` (Textinhalt) oder `data-i18n-attr="attribut:schlüssel"` (z. B. `aria-label`). Die Sprachwahl wird nur gespeichert (`km.lang` im `localStorage`), wenn jemand selbst umschaltet.

## Hinweis

Fan-Projekt ohne Verbindung zu den Rechteinhabern. „Star Trek“ und zugehörige Begriffe sind Marken von CBS Studios Inc. Code, Texte, Grafik und Musik dieses Projekts sind eigene Arbeiten.
