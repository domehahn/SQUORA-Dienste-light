# Dienste – Turnier-Dienstplan

Kleine Verwaltungs-App für die Organisation von Diensten bei Heimturnieren
(Grillen, Bonkasse, Kuchenverkauf, Pommes, Getränke, …) und für die
Trikotwäsche bei Heim- und Auswärtsturnieren. Die Zuteilung erfolgt fair
rotierend unter den Eltern: kein Elternteil wird bei einem Turnier mehrfach
eingeteilt, und über die Zeit gesehen werden Dienste möglichst gleichmäßig
verteilt (wer bisher am wenigsten dran war, kommt zuerst dran).

Aufbau analog zu [SQUORA-Turnen-light](../SQUORA-Turnen-light): React 19 +
Vite + Tailwind v4 Frontend, Cloudflare Worker (Hono) + D1 als Backend mit
JWT-Login für die Verwaltung, als zwei Cloudflare Workers deploybar
(`dienste-web` für Assets/SPA, `dienste-api` für die API). Zusätzlich gibt es
eine **öffentliche, nicht angemeldete Ansicht** (Startseite `/`), auf der jeder
sehen kann, wer bei welchem Turnier welchen Dienst übernimmt.

## Fachliche Regeln

- **Dienste** (Grillen, Bonkasse, Kuchenverkauf, Pommes, Getränke, Trikotwäsche,
  …) sind frei konfigurierbar und jeweils als "nur Heimturnier", "nur
  Auswärtsturnier" oder "beides" markiert (Trikotwäsche z.B. "beides").
- Pro **Turnier** (Heim- oder Auswärtsturnier) legt man die benötigten
  Dienst-Slots an (z.B. 2× Grillen, 1× Bonkasse, 1× Trikotwäsche).
- Ein Elternteil kann pro Turnier **maximal einem** Slot zugeteilt werden –
  das erzwingt die Datenbank per `UNIQUE(tournament_id, parent_id)`, so ist es
  ausgeschlossen, dass eine Familie an einem Turnier gleichzeitig grillt,
  Kuchen verkauft und die Bonkasse macht.
- Die Funktion **"Automatisch zuteilen"** füllt offene Slots eines Turniers,
  indem sie je Slot das noch nicht an diesem Turnier eingeteilte Elternteil
  mit der geringsten bisherigen Dienst-Last wählt (zuerst nach Anzahl bei
  diesem Dienst-Typ, dann nach Gesamtanzahl aller Dienste, mit zufälligem
  Losentscheid bei Gleichstand). Zuteilungen lassen sich danach jederzeit
  manuell per Dropdown ändern.
- Die **Übersicht** zeigt pro Elternteil, wie oft es bereits welchen Dienst
  übernommen hat – Grundlage, um Fairness auch von Hand nachzuvollziehen.

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

Ersten Login-Nutzer anlegen:

```sh
node scripts/create-admin.mjs admin@example.com "MeinSicheresPasswort" "Vorname Nachname"
```

Das Skript gibt ein fertiges `wrangler d1 execute ... --local`-Kommando aus,
das einmalig ausgeführt wird.

### 2. Frontend

In einem zweiten Terminal:

```sh
cd dienste
npm install
npm run dev                       # Vite-Dev-Server auf Port 5173, proxy't /api zu :8787
```

Danach unter `http://localhost:5173` die öffentliche Übersicht ansehen oder
unter `/login` mit dem angelegten Nutzer anmelden (Verwaltung unter `/admin`).

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
