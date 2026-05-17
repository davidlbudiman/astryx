# Astryx

Astryx is a local-first video game progress tracker. It stores game data as formatted JSON files so progress changes are easy to inspect, edit, and back up with Git.

## Features

- Personal game library in `data/games.json`
- Per-game category files under `data/<game-id>/`
- Checklist categories for story, bosses, quests, collectibles, and similar progress
- Grid calendar categories for game-only calendars such as Persona months or farming seasons
- UI edits write directly back to the JSON files

## Development

Requires Node.js 24 LTS and npm.

```sh
npm install
npm run dev
```

Open the local server URL printed by Vite.

## Validation

```sh
npm run check
npm run build
```
