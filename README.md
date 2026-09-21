# Arbeitszeitrechner

Ein schlanker, vollständig clientseitiger Arbeitszeitrechner für Deutschland. Er berechnet auf Basis einer Startzeit einen Tagesablauf mit Ruhepausen, dem Ende einer 8-Stunden-Nettoarbeitszeit, dem gesetzlichen 10-Stunden-Höchstmaß und der anschließenden 11-stündigen Ruhezeit.

Die Anwendung besteht nur aus HTML, CSS und JavaScript. Es gibt kein Backend und keine externen JavaScript-Abhängigkeiten.

## Funktionen

- Startzeit frei eingeben
- Vorschlag für die erste Ruhepause
- Ruhepausen frei verschieben und verlängern
- automatische Neuberechnung der Zeitpunkte
- zweite Pause nur dann als erforderlich behandeln, wenn sie aufgrund der 6-Stunden-Kontinuitätsgrenze oder der insgesamt erforderlichen Pausenzeit tatsächlich notwendig wird
- 8 Stunden Nettoarbeitszeit berechnen
- 10 Stunden Nettoarbeitszeit als gesetzliches Tageshöchstmaß darstellen
- frühesten Arbeitsbeginn nach 11 Stunden Ruhezeit berechnen
- Tageswechsel mit `+1T`, `+2T` usw. anzeigen
- Live-Hinweise bei nicht regelkonformen Pausenzeiten
- responsive Oberfläche ohne externe Fonts, Tracker oder Bibliotheken

## Rechtliches Modell

Der Rechner orientiert sich insbesondere an:

- **§ 3 ArbZG:** grundsätzlich 8 Stunden werktägliche Arbeitszeit; Verlängerung auf bis zu 10 Stunden unter den dort genannten Ausgleichsvoraussetzungen.
- **§ 4 ArbZG:** mindestens 30 Minuten Ruhepause bei mehr als 6 bis zu 9 Stunden Arbeitszeit und insgesamt 45 Minuten bei mehr als 9 Stunden; Aufteilung in Abschnitte von jeweils mindestens 15 Minuten möglich; keine Beschäftigung länger als 6 Stunden hintereinander ohne Ruhepause.
- **§ 5 ArbZG:** grundsätzlich mindestens 11 Stunden ununterbrochene Ruhezeit nach Beendigung der täglichen Arbeitszeit.

Wichtig: Es gibt nach diesem Modell **keine eigenständige gesetzliche Regel „eine zweite Pause ist immer Pflicht“**. Eine einzelne 45-minütige Ruhepause kann bei geeigneter Lage beide Anforderungen erfüllen. Entscheidend sind die gesamte Pausenzeit und die maximale ununterbrochene Arbeitsdauer.

### Betrieblicher 20:00-Hinweis

Die im aktuellen UI vorhandene Markierung **„Beantragung für Bezahlung“** bei einem Tagesende ab 20:00 Uhr ist **keine allgemeine Vorgabe des Arbeitszeitgesetzes**. Sie ist eine betriebliche Zusatzregel und muss bei einer allgemeinen Weiterverwendung angepasst oder entfernt werden.

## Dateien

```text
index.html   Oberfläche und Struktur
style.css    Layout und Responsive Design
script.js    Berechnungs-, Simulations- und Compliance-Logik
```

## Lokal starten

Für die reine Funktion genügt ein statischer Webserver. Zum Beispiel:

```bash
python3 -m http.server 8080
```

Danach im Browser `http://localhost:8080` öffnen.

Die Dateien können grundsätzlich auch direkt von nginx, Apache, Caddy, GitHub Pages oder einem anderen Static-Hosting-Dienst ausgeliefert werden.

## Docker

Eine Docker-/nginx-Konfiguration ist bewusst noch nicht Bestandteil dieses Stands. Sie soll separat ergänzt werden.

## Datenschutz und Impressum bei öffentlichem Hosting

Die Anwendung selbst überträgt derzeit keine eingegebenen Arbeitszeiten an einen Server und nutzt keine externen Skripte, Webfonts, Cookies oder Analytics. Beim öffentlichen Hosting können jedoch trotzdem personenbezogene Daten verarbeitet werden, insbesondere durch Server- und Access-Logs (zum Beispiel IP-Adressen). Der tatsächliche Betreiber muss deshalb seine konkrete Hosting-Konfiguration bewerten und die erforderlichen Datenschutzinformationen bereitstellen.

Im Repository liegen dafür Vorlagen:

- `DATENSCHUTZ.md`
- `IMPRESSUM.md`

Diese Dateien sind **keine fertigen Rechtstexte für jede Installation**. Betreiber müssen insbesondere Verantwortlichen, Kontaktdaten, Hostinganbieter, Log-Verarbeitung, Speicherdauer und gegebenenfalls weitere eingesetzte Dienste anpassen.

Ob eine Impressumspflicht besteht, hängt von der konkreten Nutzung ab. § 5 DDG nennt Informationspflichten für geschäftsmäßige, in der Regel gegen Entgelt angebotene digitale Dienste.

## Haftungs- und Nutzungshinweis

**Für die Richtigkeit, Vollständigkeit und Aktualität der Berechnungen wird keine Gewähr übernommen. Der Rechner wurde nach bestem Wissen und Gewissen auf Grundlage der genannten gesetzlichen Vorschriften erstellt. Er dient ausschließlich der Orientierung und ersetzt keine arbeitsrechtliche Beratung.**

Tarifverträge, Betriebsvereinbarungen, arbeitsvertragliche Regelungen, branchenspezifische Ausnahmen und Sonderregelungen des ArbZG können zu abweichenden Ergebnissen führen.

## Stand

Rechtsmodell geprüft gegen §§ 3, 4 und 5 ArbZG im September 2026.

## Lizenz

Noch keine Lizenz festgelegt. Ohne ausdrückliche Lizenz gelten die gesetzlichen Urheberrechtsbestimmungen. Vor einer gewünschten freien Weiterverwendung sollte eine passende Open-Source-Lizenz ergänzt werden.
