# Category JSON Mutations Plan

## Goal

Move game-category mutations from SvelteKit form actions that refresh route data to JSON endpoints that return the changed data. The game detail page should keep category tab state client-side and patch only affected categories after a mutation.

## Non-Goals

- Do not redesign the JSON file storage format.
- Do not remove progressive page rendering for initial game load.
- Do not change the visible tab layout beyond removing reload-driven reset behavior.
- Do not migrate to a database.
- Do not rewrite the home page unless a small summary helper is needed.

## Locked Decisions

- Use Option 3: API-style JSON mutation endpoints and client-owned game page state.
- A category mutation endpoint returns all categories changed by that mutation.
- Trophy sync remains part of the same mutation flow.
- If trophy sync changes `trophies.json`, the response includes both the submitted category and the trophies category.
- The game detail page patches local state from mutation responses and does not call SvelteKit `update()` for checkbox/add-item mutations.

## Current State

- [src/routes/[gameId]/+page.server.ts](/home/david/dev/leisure/astryx/src/routes/[gameId]/+page.server.ts) loads a single game by calling `readLibrary()`, which reads every game and every category.
- [src/lib/server/data.ts](/home/david/dev/leisure/astryx/src/lib/server/data.ts) already writes a single category for many mutations via `writeCategory()`.
- Trophy sync may write `trophies.json` after a checklist/calendar toggle.
- [src/routes/[gameId]/+page.svelte](/home/david/dev/leisure/astryx/src/routes/[gameId]/+page.svelte) currently depends on SvelteKit form actions and local `activeCategoryId`, which is why action-driven refreshes can reset the selected tab.

## Risks

- Trophy sync currently reads all categories in the current game to evaluate aggregate rules. That is acceptable because it is scoped to one game, not the entire library.
- Concurrent writes to the same category can still race because JSON files are written without locking. This plan does not solve file locking.
- Progressive enhancement will be reduced for category item mutations unless fallback form actions are kept. This is acceptable under Option 3 but should be acknowledged.

## Stop Conditions

Stop implementation if:

- Endpoint mutation responses cannot represent trophy side effects without reloading the game.
- Client patching requires changing the persisted JSON shape.
- Svelte state updates become ambiguous for calendar entries or nested detail checklist items.
- Validation shows SvelteKit route endpoints conflicting with existing `[gameId]` page routing.

## Target Contracts

### Game Read Contract

Add:

```ts
export type GameSummary = {
	completed: number;
	total: number;
	status: GameStatus;
};

export type GameDetail = Game & GameSummary & {
	categories: Category[];
};

export async function readGame(gameId: string): Promise<GameDetail>;
export async function readGameCategory(gameId: string, categoryId: string): Promise<{ game: Game; category: Category }>;
```

`readGame(gameId)` reads:

- `data/games.json`
- only the selected game folder's categories

It must not call `readLibrary()`.

### Mutation Result Contract

Add:

```ts
export type CategoryMutationResult = {
	game: GameSummary;
	categories: Category[];
	deletedCategoryId?: string;
};
```

For update/add/toggle operations, `categories` contains the changed category plus any side-effect categories.

For delete category, `deletedCategoryId` is set and `categories` is empty unless another category was changed.

### Endpoint Response Contract

All category mutation endpoints return JSON:

```ts
type CategoryMutationResponse =
	| { ok: true; result: CategoryMutationResult }
	| { ok: false; message: string };
```

## Implementation Steps

### 1. Refactor Server Data Reads

Modify [src/lib/server/data.ts](/home/david/dev/leisure/astryx/src/lib/server/data.ts).

- Add `readGame(gameId)`.
- Add `readGameCategory(gameId, categoryId)`.
- Keep `readLibrary()` for the home page.
- Change the `[gameId]` page load later to call `readGame()`.

Implementation notes:

- Reuse `readGamesFile()`, `readCategories()`, `summarizeCategories()`, and `deriveGameStatus()`.
- `readGameCategory()` should replace or wrap the existing private `findCategory()`.
- Preserve slug validation and `dataPath()` safety.

### 2. Make Mutations Return Changed Categories

Modify mutation functions in [src/lib/server/data.ts](/home/david/dev/leisure/astryx/src/lib/server/data.ts).

Affected functions:

- `addChecklistItem`
- `addDetailChecklistItem`
- `addCalendarPeriod`
- `addCalendarItem`
- `toggleChecklistItem`
- `toggleDetailChecklistItem`
- `toggleCalendarItem`
- `deleteCategory`

Each should return `CategoryMutationResult`.

Implementation notes:

- After writing the submitted category, include that category in the result.
- Refactor `syncLinkedTrophies()` and `syncTrophyRules()` so they return changed categories instead of only writing silently.
- De-duplicate returned categories by `category.id`.
- Recompute the game summary after side effects. This can read only categories for the current game folder, not all games.

### 3. Add JSON Mutation Endpoints

Create endpoints under:

- `src/routes/[gameId]/categories/[categoryId]/checklist-items/+server.ts`
- `src/routes/[gameId]/categories/[categoryId]/detail-checklist-items/+server.ts`
- `src/routes/[gameId]/categories/[categoryId]/calendar-items/+server.ts`
- `src/routes/[gameId]/categories/[categoryId]/calendar-periods/+server.ts`
- `src/routes/[gameId]/categories/[categoryId]/+server.ts`

Recommended method mapping:

- `POST /[gameId]/categories/[categoryId]/checklist-items` adds a checklist item.
- `PATCH /[gameId]/categories/[categoryId]/checklist-items` toggles a checklist item.
- `POST /[gameId]/categories/[categoryId]/detail-checklist-items` adds a detail checklist item.
- `PATCH /[gameId]/categories/[categoryId]/detail-checklist-items` toggles a detail checklist item.
- `POST /[gameId]/categories/[categoryId]/calendar-items` adds a calendar item.
- `PATCH /[gameId]/categories/[categoryId]/calendar-items` toggles a calendar item.
- `POST /[gameId]/categories/[categoryId]/calendar-periods` adds a calendar period.
- `DELETE /[gameId]/categories/[categoryId]` deletes a category.

Each endpoint should:

- Parse JSON request bodies.
- Validate required string/boolean/number fields.
- Call the corresponding data-layer mutation.
- Return `{ ok: true, result }`.
- On error, return `{ ok: false, message }` with status `400`.

### 4. Keep or Reduce SvelteKit Actions

Modify [src/routes/[gameId]/+page.server.ts](/home/david/dev/leisure/astryx/src/routes/[gameId]/+page.server.ts).

- Change `load()` to call `readGame(params.gameId)`.
- Keep `addCategory`, `deleteGame`, and maybe `deleteCategory` as form actions only if they still need normal navigation semantics.
- Remove the temporary `categoryId` action-result workaround from the previous attempted fix if JSON endpoints make it unnecessary.

### 5. Convert Game Page To Client-Owned State

Modify [src/routes/[gameId]/+page.svelte](/home/david/dev/leisure/astryx/src/routes/[gameId]/+page.svelte).

- Initialize a mutable local `game` state from `data.game`.
- Keep `activeCategoryId` purely client-side.
- Remove `use:enhance` from category item mutation forms.
- Replace checkbox/add-item form behavior with client handlers that call `fetch()`.
- On successful JSON mutation response:
  - Replace matching categories in local `game.categories`.
  - Remove `deletedCategoryId` if present.
  - Update `game.completed`, `game.total`, and `game.status` from `result.game`.
  - Preserve `activeCategoryId`.
- On failed response:
  - Show the error message in the existing error display area.

Implementation notes:

- Use existing HTML controls and styling.
- Buttons should remain accessible with useful `aria-label` text.
- Keep forms only if useful for layout; intercept `onsubmit` and prevent default.
- Do not call SvelteKit `update()` for these JSON mutations.

### 6. Error And Loading States

Add local UI state in [src/routes/[gameId]/+page.svelte](/home/david/dev/leisure/astryx/src/routes/[gameId]/+page.svelte):

- `message` for mutation errors.
- Optional `pendingItemKey` or `pendingFormKey` to prevent double-submit on the same control.

Behavior:

- A failed mutation must not change local category data.
- A successful mutation clears the error message.
- Pending controls should be disabled while their request is in flight.

### 7. Validation

Run:

```bash
npm run check
npm run build
```

Run endpoint smoke tests with `curl` against a local dev server:

```bash
curl -s -X PATCH http://127.0.0.1:5173/final-fantasy-xvi/categories/hunts/checklist-items \
  -H 'Content-Type: application/json' \
  --data '{"itemId":"ahriman","done":true}'
```

Expected:

- JSON response has `ok: true`.
- `result.categories` includes `hunts`.
- If a trophy rule changes, `result.categories` also includes `trophies`.
- The browser remains on the same selected tab after toggling an item.

## Tests

There are currently no test files in the repo. Add targeted tests only if the project already gains a test runner. Otherwise use local command validation and endpoint smoke tests.

If adding tests later, prefer data-layer tests around:

- `readGame()` reads only one game's categories.
- toggling a linked checklist item returns both the submitted category and `trophies`.
- toggling an unrelated checklist item returns only the submitted category.
