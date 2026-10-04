# Turning Points

A local chess analysis app that finds the **n moments in a game where the evaluation changed the most**, so you can study the critical decisions of your own games — a training method suggested by GM Noël Studer: find the turning points, think about those positions yourself first, and only then check the engine.

- Frontend: SvelteKit + Svelte 5 (runes)
- Engine: a local [Stockfish](https://stockfishchess.org/) binary, driven over UCI from the SvelteKit server
- PGN parsing: [chess.js](https://github.com/jhlywa/chess.js)

## How it works

1. Every position of the game is evaluated by Stockfish at a fixed depth.
2. Each evaluation is converted to White's winning chances (0–100 %) using the same logistic model as Lichess. This keeps a swing from +8 to +6 (still winning) from outranking a swing from +0.5 to −1.5 (the game turned).
3. For each move, the change in winning chances is computed. The `n` moves with the largest absolute change are the turning points, listed in game order.
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

## Scripts

```sh
pnpm dev       # development server
pnpm build     # production build (adapter-node), run with `node build`
pnpm check     # type checking
pnpm test      # unit tests
pnpm lint      # prettier + eslint
```

## Credits

Chess pieces: "cburnett" set by [Colin M.L. Burnett](https://en.wikipedia.org/wiki/User:Cburnett), licensed under GPLv2+/BSD/GFDL, taken from [lichess](https://github.com/lichess-org/lila/tree/master/public/piece/cburnett).

Font: [Inter](https://github.com/rsms/inter) by The Inter Project Authors, licensed under the SIL Open Font License 1.1 (see `static/fonts/OFL.txt`).
