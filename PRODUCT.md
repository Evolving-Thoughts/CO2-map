# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primär: interessierte Laien aus der allgemeinen Öffentlichkeit, die meist über einen geteilten Link kommen und ohne Vorwissen verstehen wollen, welche Länder über oder unter ihrem fairen Anteil am CO₂-Budget liegen. Smartphone und Desktop sind gleich wichtig.

## Product Purpose
Interaktive Weltkarte (Leaflet) und 3D-Globus (globe.gl), die Länder nach ihren CO₂-Emissionen relativ zu einem gleich verteilten Pro-Kopf-Budget einfärben und skalieren. Ziel ist, Klimagerechtigkeit anschaulich zu machen. Veröffentlicht unter https://evolving-thoughts.github.io/CO2-map/.

Erfolg heißt, gleichrangig:
- **Aha-Moment:** In Sekunden ist erkennbar, wer über bzw. unter seinem fairen Anteil liegt.
- **Teilen:** Die Karte oder Screenshots davon werden weitergegeben.
- **Vertiefen:** Besucher*innen erkunden einzelne Länder, Metriken und die Methodik.
- **Glaubwürdigkeit:** Fachleute halten Zahlen und Darstellung für seriös.

## Positioning
Länder wachsen oder schrumpfen visuell danach, wie weit sie über oder unter ihrem fairen Anteil am verbleibenden Paris-Budget (1,5 °C / 2,0 °C, IPCC AR6) liegen, statt nur absolute Emissionen zu zeigen. Die Haltung ist bildend und erklärend: Zusammenhänge werden geduldig erklärt, ohne zu belehren oder zuzuspitzen.

## Operating Context
Statische Seite, gehostet auf GitHub Pages. Daten werden offline per `generate_data.py` aus `owid-co2-data.csv` nach `js/co2data.js` erzeugt. Territorien-Zuordnung und Paris-Budget-Annahmen werden manuell in `js/config.js` gepflegt.

## Capabilities and Constraints
- Metriken: Paris 1,5 °C, Paris 2,0 °C, Territorial, Konsumbasiert, Historisch kumulativ.
- Länder-Skalierungsmodus, Info-Panel pro Land, Rangliste mit Suche, Farbenblind-Modus, Karten- und Globus-Ansicht, Methodik-Dialog, 241 Territorien mit Name und Datenquelle.
- Die Ansicht (Metrik, Land, Skalierung, Globus) steht im URL-Hash und ist damit teilbar.
- Konsumbasierte Daten (120 Länder) mit Fallback auf territoriale Daten.
- Paris-Budgets nach IPCC AR6, Tabelle SPM.2: 1,5 °C mit 50 % (500 Gt ab 2020), 2 °C mit 67 % (1.150 Gt ab 2020), abzüglich der Emissionen seit 2020 bis zum Datenjahr (aus den Daten, 2020–2025 rund 225 Gt), verteilt auf die Jahre nach dem Datenjahr bis 2050.
- Kein Kachel-Kartenhintergrund: Die Länder liegen auf einer einfarbigen Fläche, es gibt keinen externen Kacheldienst.
- Aktueller Stack: Vanilla HTML/CSS/JS, Leaflet 1.9.4, TopoJSON, globe.gl und earcut (werden im Hintergrund geladen, der Globus öffnet ohne Wartezeit), kein Framework, kein Build. Alle Fremddateien (Bibliotheken, Ländergrenzen, Schrift) liegen in `vendor/` und kommen von der Seite selbst; kein Aufruf fremder Server. Der Verzicht auf einen Build-Schritt ist keine feste Vorgabe.
- Sprachen: Deutsch und Englisch (`js/i18n.js`). Weitere Sprachen sind nicht geplant.
- Tracking: nichts, was Cookies oder ein Consent-Banner braucht. Seitenaufrufe zählt GoatCounter cookiefrei (`co2-map.goatcounter.com`); der Methodik-Dialog erklärt das unter „Datenschutz“.

## Brand Commitments
Das Branding „Evolving Thoughts“ bleibt erhalten. Es steht als Absenderzeile unter dem Titel im Header und im Methodik-Dialog, jeweils mit Link zur GitHub-Organisation.

## Evidence on Hand
Our World in Data / Global Carbon Project (CC BY 4.0), Bevölkerung nach UN via OWID; das Datenjahr steht in `js/co2data.js` und wird wöchentlich automatisch geprüft und aktualisiert. Paris-Budgets nach IPCC AR6, mit Hinweis auf die strengere Schätzung von Forster et al. (2026). Keine Nutzerzahlen, Testimonials oder Referenzprojekte vorhanden; nicht erfinden.

## Product Principles
- Verständlich ohne Vorwissen: Die Kernaussage muss auf den ersten Blick ankommen, auch auf dem Smartphone.
- Erklären statt belehren: Fairness (gleiches Pro-Kopf-Budget) ist die Rahmung, die Methodik begründet sie, der Ton bleibt ruhig.
- Nachvollziehbar und seriös: Quellen und Methodik sind leicht zu finden, damit auch Fachleute der Darstellung trauen.
- Teilbar: Jede Ansicht soll für sich stehen können, als Link oder Screenshot.
- Tiefe auf Wunsch: Wer mehr will, findet Länderdetails, Metriken und Methodik, ohne dass die Einstiegsansicht überladen wird.

## Accessibility & Inclusion
Farbenblind-Modus ist vorhanden und muss erhalten bleiben. Deutsch und Englisch erhalten. Smartphone und Desktop gleichwertig bedienbar.
