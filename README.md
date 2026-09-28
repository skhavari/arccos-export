# ⛳ arccos-export

Fetch and save detailed round data from the Arccos Golf API for advanced analysis, stats modeling, and game improvement tracking.

![Node.js](https://img.shields.io/badge/Node.js-22.18%2B-green)
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

Create a `.env` file in the root with your Arccos sign-in:

```env
ARCCOS_USERNAME=you@example.com
ARCCOS_PASSWORD=your_password_here
```

The first run signs in and saves the resulting Arccos access key and short-lived token to `.arccos-session.json`, so later runs skip signing in. Expired tokens are renewed automatically. Both files are git-ignored; delete `.arccos-session.json` to force a fresh sign-in.

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

-   Node.js 22.18+ (runs the TypeScript directly, no build step)
-   Arccos account with active data
-   Your Arccos username and password

---

## 🙌 Credits

Built by [@skhavari](https://github.com/skhavari) to help players get better faster—one shot at a time.

Thanks to [@mikeypotter](https://github.com/mikeypotter) for adding email/password login with automatic token refresh ([#1](https://github.com/skhavari/arccos-export/pull/1)), so there's no more copying bearer tokens out of dev tools.

---

## 📃 License

MIT — free to use and modify.
