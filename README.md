# ⛳ arccos-export

Fetch and save detailed round data from the Arccos Golf API for advanced analysis, stats modeling, and game improvement tracking.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)
![Arccos](https://img.shields.io/badge/Arccos-API-green)
![Status](https://img.shields.io/badge/status-active-brightgreen)

---

## 📦 What It Does

This tool pulls **all your Arccos rounds** from the official API, including full **shot-level detail**, and saves each round locally as a JSON file:

-   ✅ Pulls all rounds (paginated)
-   ✅ Fetches full shot-by-shot round detail
-   ✅ Saves to `data/rounds.json` (summary) and `data/round_<id>.json` (detail)
-   ✅ Fully written in TypeScript

Use this data to power your own **strokes gained analysis**, **short game benchmarking**, or **stat visualization dashboards**.

---

## 🚀 Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/skhavari/arccos-export.git
cd arccos-export
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up your `.env`

Create a `.env` file in the root. The exporter obtains a **fresh short-lived JWT** from Arccos for each run, so there's no bearer token to copy by hand.

**First-time setup: email and password**

```env
ARCCOS_USERNAME=you@example.com
ARCCOS_PASSWORD=your_password_here
```

On a password login the exporter asks Arccos for a new access key and prints it as `ARCCOS_USER_ID`, `ARCCOS_ACCESS_KEY` and `ARCCOS_SECRET` lines. `ARCCOS_EMAIL` is also accepted as an alias for `ARCCOS_USERNAME`.

**Preferred: reusable access credentials**

Paste the printed lines into `.env` (and remove the password) so later runs reuse that key instead of creating a new one:

```env
ARCCOS_USER_ID=your_user_id_here
ARCCOS_ACCESS_KEY=your_access_key_here
ARCCOS_SECRET=your_secret_here
```

These are exchanged with `https://authentication.arccosgolf.com/tokens` for a new JWT whenever the exporter runs. If Arccos rejects a token with HTTP 401 during a long export, the exporter renews it and retries once. Keep `.env` local and never commit it.

### 4. Run the fetcher

```bash
npm run fetch-rounds
```

This will:

-   Save a summary of all rounds to `data/rounds.json`
-   Save detailed shot data per round to `data/round_<roundId>.json`

---

## 📂 Output Structure

```bash
data/
├── rounds.json              # Summary of all rounds
├── round_16860745.json      # Detailed shot data for a single round
├── round_17062735.json
└── ...
```

Each detailed file includes full hole and shot breakdowns, with coordinates, timestamps, clubs, and distances.

---

## 🛠️ Requirements

-   Node.js 18+
-   Arccos account with active data
-   An Arccos username/password, or a saved user ID/access key/secret

---

## 🙌 Credits

Built by [@skhavari](https://github.com/skhavari) to help players get better faster—one shot at a time.

---

## 📃 License

MIT — free to use and modify.
