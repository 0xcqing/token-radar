# token-radar

A token launch radar for make.fun's `token-radar-01` bounty: it reads the sealed DefiLlama snapshot,
scores every pre-token protocol by a stated implied value, and renders the board as a single page.

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/c/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/0xcqing/token-radar/rank.svg)](https://make.fun/c/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/0xcqing/token-radar/reward.svg)](https://make.fun/c/token-radar-01)

- Competition: [token-radar-01 on make.fun](https://make.fun/c/token-radar-01)
- Entry: this repository at the submitted commit; `screenshots/` holds the page as rendered on the snapshot.

## Run it

```sh
mkdir -p out
node main.ts --input ../token-radar-01-kit/input/snapshot.json --output out
```

`main.ts` writes `out/board.json`, `out/data.js`, copies `dashboard/` and `screenshots/`, and writes
`out/dossier.json` last. Open `out/dashboard/index.html` to read the board.

## Layout

- `main.ts` — reads the snapshot, builds the board, writes the outputs.
- `lib/model.ts` — the value model, the farm-plan generator and the board builder.
- `dashboard/` — one HTML page, one stylesheet, one script; no network of any kind.
- `vendor/makefun-board.ts` — the kit's dossier builder, unmodified.
- `screenshots/` — the board, a detail view and a filtered view.

## License

MIT, see `LICENSE`.
