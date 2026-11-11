# Product

<!-- impeccable:product-schema 1 -->

> Hinweis: Init lief ohne Interview-Runde (Nutzer wollte direkt fortfahren). Mit "(abgeleitet)" markierte Angaben stammen aus README und Code und sind nicht vom Nutzer bestätigt.

## Platform

web

## Users
(abgeleitet) Allgemeine Öffentlichkeit und Bildungskontext: Laien, die verstehen wollen, wie CO₂-Emissionen von Ländern im Verhältnis zu einem fairen Pro-Kopf-Budget stehen. Die UI ist mehrsprachig (`js/i18n.js`).

## Product Purpose
Interaktive Weltkarte (Leaflet) und 3D-Globus (globe.gl), die Länder nach ihren CO₂-Emissionen relativ zu einem gleich verteilten Pro-Kopf-Budget einfärben und skalieren. Ziel ist, Klimagerechtigkeit anschaulich zu machen. Veröffentlicht unter https://evolving-thoughts.github.io/CO2-map/.

## Positioning
Länder wachsen oder schrumpfen visuell danach, wie weit sie über oder unter ihrem fairen Anteil am verbleibenden Paris-Budget (1,5 °C / 2,0 °C, IPCC AR6) liegen, statt nur absolute Emissionen zu zeigen.

## Operating Context
Statische Seite ohne Build-Schritt, gehostet auf GitHub Pages. Daten werden offline per `generate_data.py` aus `owid-co2-data.csv` nach `js/co2data.js` erzeugt. Territorien-Zuordnung und Paris-Budget-Konstanten werden manuell gepflegt.

## Capabilities and Constraints
- Metriken: Paris 1,5 °C, Paris 2,0 °C, Territorial, Konsumbasiert, Historisch kumulativ.
- Länder-Skalierungsmodus, Info-Panel pro Land, Farbenblind-Modus, Karten- und Globus-Ansicht, 241 Territorien mit Name und Datenquelle.
- Konsumbasierte Daten (~80 Länder) mit Fallback auf territoriale Daten.
- Stack (feststehend): Vanilla HTML/CSS/JS, Leaflet 1.9.4, TopoJSON, globe.gl, kein Framework, kein Build.

## Evidence on Hand
Our World in Data / Global Carbon Project 2024 (CC BY 4.0), Bevölkerung 2023 (UN via OWID), Paris-Budgets nach IPCC AR6. Keine Nutzerzahlen, Testimonials oder Referenzprojekte vorhanden; nicht erfinden.

## Product Principles
(abgeleitet)
- Datenquelle und Methodik sind sichtbar und nachvollziehbar.
- Fairness (gleiches Pro-Kopf-Budget) ist die zentrale Rahmung.
- Jede Ansicht muss ohne Vorwissen verständlich sein.
- Einfach zu hosten und zu pflegen: statisch, ohne Build.

## Accessibility & Inclusion
Farbenblind-Modus ist vorhanden und muss erhalten bleiben. Mehrsprachigkeit (`js/i18n.js`) erhalten.
