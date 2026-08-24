# Dienste – Turnier-Dienstplan

Verwaltungs-App für die Organisation von Diensten bei Heimturnieren (Grillen,
Bonkasse, Kuchenverkauf, Pommes, Getränke, …) und für die Trikotwäsche bei
Heim- und Auswärtsturnieren. Die Zuteilung erfolgt fair rotierend unter den
Eltern: kein Elternteil wird bei einem Turnier mehrfach eingeteilt, und über
die Zeit gesehen werden Dienste möglichst gleichmäßig verteilt (wer bisher am
wenigsten dran war, kommt zuerst dran).

Aufbau analog zu [SQUORA-Turnen-light](../SQUORA-Turnen-light): React 19 +
Vite + Tailwind v4 Frontend, Cloudflare Worker (Hono) + D1 als Backend mit
JWT-Login, als zwei Cloudflare Workers deploybar (`dienste-web` für
Assets/SPA, `dienste-api` für die API). SQUORA-Branding (Logo, Favicon,
Farbschema) ist von dort übernommen. Die gesamte App ist login-pflichtig – es
gibt keine öffentliche, nicht angemeldete Ansicht.

## Funktionsumfang

### Rollen: Admin und Trainer

- **Admin**: voller Zugriff auf alle Jugenden, Turniere, Eltern, Spieler,
  Dienst-Arten und Nutzer-Verwaltung.
- **Trainer**: wird unter „Nutzer" (nur für Admins sichtbar) angelegt und
  einer oder mehreren **Jugenden** zugeordnet. Trainer sehen und verwalten
  ausschließlich Daten ihrer eigenen Jugend(en) – Jugenden-Liste, Spieler,
  Eltern, Turniere, Übersicht – vollständige Datentrennung, serverseitig
  erzwungen.

### Stammdaten

- **Jugenden**: Mannschaften/Altersklassen (z.B. D-Jugend, F-Jugend). Legen
  fest, welche Spieler/Eltern/Turniere zusammengehören.
- **Spieler**: gehören verpflichtend zu einer Jugend. Eltern werden **nicht**
  mit eigenem Namen erfasst, sondern über den Spieler identifiziert und
  angezeigt als „Eltern von Max Mustermann"; ein optionales Rollenfeld (z.B.
  „Mutter"/„Vater") unterscheidet mehrere Elternteile desselben Spielers.
  Spieler- und Eltern-Listen sind nach Jugend gruppiert dargestellt.
- **Dienst-Arten** (Grillen, Bonkasse, Kuchenverkauf, Pommes, Getränke,
  Trikotwäsche, …): frei konfigurierbar, jeweils als „nur Heimturnier", „nur
  Auswärtsturnier" oder „beides" markiert (Trikotwäsche z.B. „beides").
  Katalog ist geteilt/global, Pflege bleibt Admins vorbehalten.

### Turniere & Dienst-Slots

- Pro **Turnier** (Heim- oder Auswärtsturnier, mit Datum, optionaler
  Uhrzeit, Ort, optionaler Jugend-Zuordnung) legt man die benötigten
  Dienst-Slots an (z.B. 2× Grillen, 1× Bonkasse, 1× Trikotwäsche), jeweils
  mit optionaler Bezeichnung (z.B. „Frühschicht") und optionaler eigener
  Uhrzeit.
- **Verfügbare Kinder**: pro Turnier lassen sich die tatsächlich
  teilnehmenden Spieler als Badges auswählen. Ist eine Auswahl getroffen,
  kommen für die Dienst-Zuteilung ausschließlich deren Eltern infrage (ohne
  Auswahl: alle aktiven Eltern der Jugend).
- Ein Elternteil kann pro Turnier **maximal einem** Slot zugeteilt werden –
  das erzwingt die Datenbank per `UNIQUE(tournament_id, parent_id)`.

### Faire Zuteilung

- **„Automatisch zuteilen"** füllt offene Slots eines Turniers, indem sie je
  Slot das noch nicht an diesem Turnier eingeteilte, berechtigte Elternteil
  mit der geringsten bisherigen Dienst-Last wählt (zuerst nach Anzahl bei
  diesem Dienst-Typ, dann nach Gesamtanzahl aller Dienste, mit zufälligem
  Losentscheid bei Gleichstand).
- **Manuelle Zuteilung** per Dropdown zeigt die berechtigten Eltern sortiert
  nach Fairness (wer diesen Dienst am wenigsten gemacht hat, zuerst) inkl.
  Zähler „insgesamt Nx gemacht"/„noch nicht gemacht"; bei einer unfairen
  Auswahl erscheint eine Warnung mit faireren Alternativen.
- Ein Dienst zählt fairness-seitig erst als „gemacht", wenn seit dem
  Turnierdatum mindestens ein Tag vergangen ist – direkt nach der Zuteilung
  (Turnier steht noch bevor, ggf. noch Tausch nötig) wird nichts vorzeitig
  gezählt.
- Die **Übersicht** zeigt pro Elternteil, wie oft es bereits welchen Dienst
  übernommen hat – Grundlage, um Fairness auch von Hand nachzuvollziehen,
  filterbar nach Jugend.

### Sonstiges

- **Druckbare Dienstliste**: im Turnier-Detail erzeugt „🖨️ Dienstliste
  drucken" eine schlanke Liste (Uhrzeit, Dienst, zugeteiltes Elternteil) ohne
  Formulare/Steuerelemente – zum Aushängen am Turnier.

## Lokale Entwicklung

Voraussetzung: Node.js, `npm`.

### 1. API-Worker

```sh
cd dienste/worker
npm install
cp .dev.vars.example .dev.vars   # JWT_SECRET lokal setzen
npm run db:migrate:local          # legt das lokale D1-Schema an
npm run dev                       # startet wrangler dev auf Port 8787
```

Ersten Login-Nutzer (Admin) anlegen:

```sh
node scripts/create-admin.mjs admin@example.com "MeinSicheresPasswort" "Vorname Nachname"
```

Das Skript gibt ein fertiges `wrangler d1 execute ... --local`-Kommando aus,
das einmalig ausgeführt wird. Weitere Nutzer (Admins oder Trainer mit
Jugend-Zuordnung) danach bequem über „Nutzer" in der Verwaltung anlegen.

### 2. Frontend

In einem zweiten Terminal:

```sh
cd dienste
npm install
npm run dev                       # Vite-Dev-Server auf Port 5173, proxy't /api zu :8787
```

Danach unter `http://localhost:5173/login` mit dem angelegten Nutzer
anmelden (Verwaltung unter `/admin`).

## Deployment (Cloudflare)

Beide Worker werden unabhängig deployed:

```sh
# API-Worker (besitzt die D1-Datenbank)
cd dienste/worker
wrangler d1 create dienste          # einmalig, database_id in wrangler.toml eintragen
npm run db:migrate:remote
wrangler secret put JWT_SECRET
npm run deploy

# Web-Worker (Assets + SPA + Proxy zum API-Worker)
cd dienste
npm run build
npm run web:deploy
```

`dienste/worker/wrangler.toml` und `dienste/wrangler.toml` sind so
vorbereitet, dass bei Bedarf ein `[[routes]]`-Eintrag mit einer eigenen Domain
ergänzt werden kann (analog zum Referenzprojekt).
