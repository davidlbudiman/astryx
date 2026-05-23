# Game Data Authoring

This document explains how to add or update game JSON data for Astryx.

Astryx stores game content as JSON. The server validates the files in `src/lib/server/data.ts` with Zod, so the JSON shape here must match that code.

## File Layout

The root game index is:

```text
data/games.json
```

Each game has its own folder:

```text
data/<game-id>/
```

Each category is one JSON file in that folder:

```text
data/<game-id>/<category-id>.json
```

Example:

```text
data/final-fantasy-xvi/hunts.json
data/final-fantasy-xvi/trophies.json
```

The category file name must match the category `id`.

## Id Rules

All ids must be lowercase kebab-case:

```text
final-fantasy-xvi
chronolith-trials
the-pack
april-18
```

Valid ids contain lowercase letters, numbers, and hyphens. Do not use spaces, underscores, apostrophes, punctuation, or uppercase letters in ids.

## Adding A New Game

1. Add an entry to `data/games.json`.
2. Create a folder under `data/` using the same id as the game folder.
3. Add one JSON file per category.
4. Prefer categories that map cleanly to tabs in the UI, such as `story`, `hunts`, `trophies`, `weapons`, `accessories`, or `calendar`.
5. Validate the app with `npm run check` and `npm run build`.

Example `data/games.json` entry:

```json
{
  "id": "example-game",
  "title": "Example Game",
  "platform": "PC",
  "folder": "example-game"
}
```

## Checklist Categories

Checklist categories are the default for tasks, bosses, collectibles, trophies, weapons, accessories, trials, and one-off goals.

```json
{
  "id": "story",
  "title": "Story",
  "layout": "checklist",
  "items": [
    {
      "id": "prologue",
      "title": "Complete the prologue",
      "done": false
    }
  ]
}
```

Required category fields:

- `id`: category id. Must match the file name.
- `title`: tab title shown in the UI.
- `layout`: must be `"checklist"`.
- `items`: array of checklist items.

Required item fields:

- `id`: item id.
- `title`: visible task name.
- `done`: boolean completion state.

Optional item fields:

- `level`: integer level, useful for hunts or bosses.
- `trophyIds`: trophy ids to claim/unclaim when this item is checked/unchecked.
- `trophyRule`: aggregate trophy rule. Usually used only inside `trophies.json`.
- `details`: extra instructions and nested checklist items.

## Details

Details can be bullets:

```json
{
  "layout": "bullets",
  "items": [
    "Start from the nearest fast travel point.",
    "Follow the eastern path to the target."
  ]
}
```

Or paragraphs:

```json
{
  "layout": "paragraphs",
  "paragraphs": [
    "This step becomes available after the main quest advances.",
    "Return later if the NPC is missing."
  ]
}
```

Details may include a nested checklist:

```json
{
  "layout": "bullets",
  "items": ["Complete the quest chain."],
  "checklist": [
    {
      "id": "talk-to-blacksmith",
      "title": "Talk to the blacksmith",
      "done": false,
      "trophyIds": ["crafted-first-weapon"]
    }
  ]
}
```

Nested checklist items require `id`, `title`, and `done`. They may also use `trophyIds`.

## Calendar Categories

Calendar categories are for date-based games.

```json
{
  "id": "calendar",
  "title": "Calendar",
  "layout": "calendar",
  "calendar": {
    "periods": [
      {
        "id": "april",
        "title": "April",
        "days": 30
      }
    ]
  },
  "entries": [
    {
      "id": "april-18",
      "period": "april",
      "day": 18,
      "items": [
        {
          "id": "start-palace-route",
          "title": "Start palace route",
          "done": false
        }
      ]
    }
  ]
}
```

Required calendar fields:

- `calendar.periods`: ordered period definitions.
- `entries`: calendar day entries.

Each period needs:

- `id`
- `title`
- `days`

Each entry needs:

- `id`: usually `<period-id>-<day>`.
- `period`: must match a period id.
- `day`: integer day number within that period.
- `items`: checklist items for the day.

Calendar items use the same basic item fields as checklist items: `id`, `title`, `done`, and optional `trophyIds`.

## Trophies And Achievements

Use a `trophies.json` checklist category when a game has PSN trophies, Steam achievements, Xbox achievements, or similar platform achievements.

```json
{
  "id": "trophies",
  "title": "Trophies",
  "layout": "checklist",
  "items": [
    {
      "id": "first-boss",
      "title": "First Boss - Defeat the first boss.",
      "done": false
    }
  ]
}
```

There are two sync models.

## Direct Trophy Links

Use `trophyIds` on a gameplay checklist item when a specific task directly claims a specific trophy.

```json
{
  "id": "defeat-first-boss",
  "title": "Defeat the first boss",
  "done": false,
  "trophyIds": ["first-boss"]
}
```

When the gameplay item is checked, the trophy is checked. When the gameplay item is unchecked, the trophy is unchecked.

`trophyIds` also works on nested detail checklist items.

## Aggregate Trophy Rules

Use `trophyRule` on trophy items when a trophy depends on a category-wide condition rather than one fixed item.

Count rule:

```json
{
  "id": "defeat-10-marks",
  "title": "Defeat 10 notorious marks.",
  "done": false,
  "trophyRule": {
    "type": "category-count",
    "categoryId": "hunts",
    "minDone": 10
  }
}
```

This becomes done when at least 10 items in `hunts` are done. Any 10 items count.

Complete rule:

```json
{
  "id": "clear-hunt-board",
  "title": "Clear the Hunt Board.",
  "done": false,
  "trophyRule": {
    "type": "category-complete",
    "categoryId": "hunts"
  }
}
```

This becomes done when every item in `hunts` is done. Empty categories do not count as complete.

Aggregate rules are recalculated when checklist, detail checklist, or calendar items are toggled.

## Recommended Categories

For a new game, choose categories based on what completion means for that game. Common categories:

- `story`
- `bosses`
- `hunts`
- `quests`
- `collectibles`
- `curiosities`
- `weapons`
- `accessories`
- `trials`
- `calendar`
- `trophies`

Avoid overloading one large checklist. Prefer separate category files so the UI tabs remain useful.

## Research Expectations

When asked to add real game data:

- Use current, reliable sources for trophy lists, quest names, collectible locations, and unlock requirements.
- Preserve exact game names and trophy names where practical.
- Convert display names into stable kebab-case ids.
- Include useful location or unlock notes in `details`.
- Use `level` for level-gated combat targets when the game exposes levels.
- For achievements that can be satisfied by any subset, use `trophyRule` rather than linking one arbitrary item.

## Validation Checklist

Before finishing data edits:

- Every touched JSON file parses.
- Every category file name matches its `id`.
- Every id is lowercase kebab-case.
- Every item has `id`, `title`, and boolean `done`.
- Calendar entries reference existing period ids.
- Trophy links point to ids in `trophies.json`.
- Aggregate trophy rules reference existing category ids.
- `npm run check` passes.
- `npm run build` passes.
