# Astryx Agent Guide

Astryx is a SvelteKit/Svelte 5 app for tracking game completion data from JSON files. The app reads game metadata from `data/games.json` and category files from `data/<game-folder>/*.json`.

## Commands

- Install dependencies with `npm install`.
- Run the dev server with `npm run dev`.
- Stop the fixed-port dev server with `npm run stop`.
- Validate Svelte and TypeScript with `npm run check`.
- Validate the production build with `npm run build`.

## Project Structure

- `src/routes/` contains SvelteKit pages and JSON mutation endpoints.
- `src/lib/server/data.ts` owns the JSON schemas, reads, writes, mutation behavior, summary calculation, and trophy sync rules.
- `data/games.json` is the game index.
- `data/<game-folder>/*.json` are per-game category files. One file equals one category.
- `docs/game-data.md` documents how to add or update game JSON data.
- `plans/` contains implementation plans and design notes.

## Data Authoring Rules

When asked to add new game data, read [docs/game-data.md](docs/game-data.md) first and follow it as the source of truth.

Key rules:

- Use lowercase kebab-case ids for games, folders, categories, periods, entries, items, trophies, and detail checklist items.
- Add the game to `data/games.json`, then create `data/<game-id>/`.
- Create one category file per tab. The filename must match the category id, for example `hunts.json` for category id `hunts`.
- Every checklist/calendar item needs `id`, `title`, and `done`.
- Keep `done` values as real booleans, not strings.
- Use `trophyIds` on checklist items or detail checklist items when checking that item should immediately claim or unclaim a trophy.
- Use `trophyRule` on trophies for aggregate achievements such as "complete any 10 hunts" or "complete an entire category."
- Keep JSON valid and formatted with two-space indentation.

## Svelte/SvelteKit Notes

- Category tick/add/delete behavior uses JSON endpoints under `src/routes/[gameId]/categories/[categoryId]/`.
- Avoid reintroducing category mutation form actions for per-item ticks; they can cause navigation/remount behavior.
- Client-owned game detail state lives in `src/routes/[gameId]/+page.svelte` and is updated from mutation responses.
- The selected category tab is derived from `activeCategoryId` and the current category id list. Keep derived values pure.
- `vite.config.ts` ignores `data/**` in dev-server watching so writing JSON data does not trigger a full page reload while testing.

## Validation

After data or app changes, run:

```sh
npm run check
npm run build
```

For JSON-only edits, also make sure every touched JSON file parses cleanly.
