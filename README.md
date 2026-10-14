# Turning Points

A local chess analysis app that finds the **three moments in a game where the evaluation changed the most**, so you can study the critical decisions of your own games — inspired by the training method in [this video](https://www.youtube.com/watch?v=shma5hsckww&t=830s): find the turning points, think about those positions yourself first, and only then check the engine.

- Frontend: SvelteKit + Svelte 5 (runes)
- Engine: a local [Stockfish](https://stockfishchess.org/) binary, driven over UCI from the SvelteKit server (or Stockfish WASM in the browser version)
- PGN parsing: [chess.js](https://github.com/jhlywa/chess.js)

## Demo

https://github.com/user-attachments/assets/1ca6332b-c436-441b-badc-1c33c2fc94c1

## How it works

1. Every position of the game is evaluated by Stockfish at a fixed depth.
2. Each evaluation is converted to White's winning chances (0–100 %) using the same logistic model as Lichess. This keeps a swing from +8 to +6 (still winning) from outranking a swing from +0.5 to −1.5 (the game turned).
3. For each move, the change in winning chances is computed. The three moves with the largest absolute change are the turning points, listed in game order.
4. For each turning point you can jump to the position _before_ the move (where the decision was made) and reveal the engine suggestion only when you want to.

Results stream to the browser position by position, so turning points appear while the analysis is still running.

## Setup

Install Stockfish, e.g.:

```sh
sudo apt install stockfish        # Debian/Ubuntu (binary at /usr/games/stockfish)
```

or download a binary from <https://stockfishchess.org/download/>.

Then:

```sh
pnpm install
cp .env.example .env              # set STOCKFISH_PATH if stockfish is not on your PATH
pnpm dev
```

| Variable            | Default     | Description                  |
| ------------------- | ----------- | ---------------------------- |
| `STOCKFISH_PATH`    | `stockfish` | Path to the Stockfish binary |
| `STOCKFISH_THREADS` | `2`         | Engine threads per analysis  |

## Browser version

`pnpm build:static` builds a version that runs entirely in the browser, served from `/turning-points` (e.g. `https://gwohl.de/turning-points`). Copy the `build` folder to that path on any static host. Differences from the local app:

- The engine is [Stockfish.js](https://github.com/nmrugg/stockfish.js) (lite, single-threaded WASM) in a Web Worker: no install, but weaker and slower than a native binary.
- Saved games and review progress live in the browser's IndexedDB instead of a folder. Use _Export all as PGN_ and _Import PGN_ on the Stats page to back them up or move them. Delete single games with ✕ in _My games_, or all of them with _Delete all_ on the Stats page.
- Games are loaded by username from Lichess only, queried directly from the browser. Other games can be pasted or opened as PGN.
- It can be installed as an app (_Install app_ on Android, _Add to Home Screen_ on iOS) and works offline, except for loading games. On iOS the installed app has its own storage, separate from Safari: use PGN export/import to move saved games.

## Scripts

```sh
pnpm dev       # development server
pnpm dev:static  # development server for the browser version (/turning-points)
pnpm build     # production build (adapter-node), run with `node build`
pnpm build:static  # browser-only build (adapter-static) under /turning-points
pnpm update:homepage  # build the browser version and commit it to ../homepage (push there to deploy)
pnpm check     # type checking
pnpm test      # unit tests
pnpm lint      # prettier + eslint
```

## Credits

Chess pieces: "cburnett" set by [Colin M.L. Burnett](https://en.wikipedia.org/wiki/User:Cburnett), licensed under GPLv2+/BSD/GFDL, taken from [lichess](https://github.com/lichess-org/lila/tree/master/public/piece/cburnett).

Browser engine: [Stockfish.js](https://github.com/nmrugg/stockfish.js) by Nathan Rugg and Chess.com, based on [Stockfish](https://github.com/official-stockfish/Stockfish), licensed under the GPLv3.

Font: [Inter](https://github.com/rsms/inter) by The Inter Project Authors, licensed under the SIL Open Font License 1.1 (see `static/fonts/OFL.txt`).

Built with the help of [Claude Code](https://claude.com/claude-code) (Anthropic).

## License

MIT, see `LICENSE`. The chess pieces, the Inter font and Stockfish.js keep their own licenses (see Credits).
