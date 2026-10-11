<svelte:head>
	<title>Guide · Turning Points</title>
</svelte:head>

<main>
	<header>
		<img class="logo" src="/pieces/wN.svg" alt="" />
		<div>
			<h1>Guide</h1>
			<p class="muted small">How to use Turning Points, and how to get the most out of it</p>
		</div>
		<a class="back first" href="/review">Review</a>
		<a class="back" href="/stats">Stats</a>
		<a class="back" href="/">← Back to analysis</a>
	</header>

	<section class="card">
		<h2 class="card-title">The idea</h2>
		<p>
			Most games are decided by two to four moments. Turning Points finds them for you: the moves
			where your winning chances changed the most. That is not the same as the biggest swing in
			centipawns, because +8 to +6 is still winning, while +0.5 to −1.5 turns the game.
		</p>
		<p>
			The training, inspired by GM Noël Studer: look at each of these positions yourself first, as
			if you were at the board, and only then check the engine. The engine tells you
			<em>what</em> was better. Thinking first teaches you <em>why</em>, and only that carries over
			to your next game.
		</p>
	</section>

	<section class="card">
		<h2 class="card-title">Quick start</h2>
		<ol>
			<li>
				In the <strong>Online</strong> tab, enter your Lichess or Chess.com username and press
				<strong>Load games</strong>. Choose yourself under <strong>View as</strong>, then click a
				game.
			</li>
			<li>
				The engine analyzes every position. The evaluation stays hidden from the first open turning
				point on, so it can't give the answer away.
			</li>
			<li>
				Every new game starts with <strong>spotting</strong>: step through it and flag the moves you
				think decided it (<kbd>Space</kbd>), then press <strong>Check</strong>, or
				<strong>Skip</strong> if you'd rather not. This trains recognizing critical moments, which is
				exactly what you need at the board.
			</li>
			<li>
				Press <strong>Next open turning point</strong> (or <kbd>N</kbd>). Think, then play your
				candidate move on the board. It is marked <span class="found">✓ found</span> if it is about
				as good as the engine's move, otherwise <span class="missed">✗ missed</span>. Then press
				<strong>Reveal</strong>.
			</li>
			<li>
				Answer the three questions in your own words: Why did I choose that move? Why is my move not
				ideal? Why is the better move better?
			</li>
			<li>
				Press <strong>Save notes</strong>. The game is saved as a PGN file with your notes, and
				feeds Review and Stats.
			</li>
		</ol>
	</section>

	<section class="card">
		<h2 class="card-title">A routine that makes you stronger</h2>
		<ul>
			<li>
				<strong>After every serious game</strong>, meaning rapid or classical, not bullet: analyze
				it the same day, while you still remember what you were thinking, and before you look at any
				other engine.
			</li>
			<li>
				<strong>Think like at the board.</strong> Take 3–5 minutes per turning point and commit to a candidate
				before you reveal. Peeking turns training into reading.
			</li>
			<li>
				<strong>Write the answers.</strong> Putting the reason into words is where the learning happens.
				One honest sentence is worth more than a long line of moves.
			</li>
			<li>
				<strong>Review daily, 5–10 minutes.</strong> Positions you missed come back after 1, 3, 7, 14
				and 30 days, until you find them.
			</li>
			<li>
				<strong>Once a week</strong>, use <strong>Analyze all</strong> on your recent games, then
				open
				<strong>Stats</strong> and pick the one weakness you will work on next. The
				<strong>Progress</strong> chart shows whether your missed rate goes down and your spot rate goes
				up.
			</li>
		</ul>
	</section>

	<section class="card">
		<h2 class="card-title">Reading your stats</h2>
		<ul>
			<li>
				<span class="found">Found</span> means that once you knew the moment mattered, you found a
				good move. The problem in the game was <em>recognition</em>. Learn to sense critical
				moments: when the position is tense, slow down.
			</li>
			<li>
				<span class="missed">Missed</span> means that even knowing it mattered, you found no good
				move. The gap is <em>calculation or knowledge</em>. Study that kind of position.
			</li>
			<li>
				The <strong>Error profile</strong> shows where you miss the most:
				<ul>
					<li><strong>Quick move</strong>: build a blunder-check habit before every move.</li>
					<li><strong>Time trouble</strong>: spend your time earlier and more evenly.</li>
					<li><strong>Endgame</strong>: study basic and practical endgames.</li>
					<li><strong>Material lost</strong>: train tactics every day.</li>
					<li><strong>Positional</strong>: study plans and annotated games.</li>
				</ul>
			</li>
			<li>
				<strong>Opening leaks</strong> and positions that turned in several games show the lines that
				keep costing you. Fix that line in your repertoire.
			</li>
			<li>
				Work on <strong>one</strong> weakness at a time, then check Stats again after a few weeks.
			</li>
		</ul>
	</section>

	<section class="card">
		<h2 class="card-title">More tools</h2>
		<ul>
			<li>
				<strong>Play vs Stockfish</strong> from any position, at a chosen strength. Use it to practise
				converting a position you were better in.
			</li>
			<li>
				Move pieces on the board to test your own lines. The engine evaluates them, and
				<strong>Engine lines</strong> shows its best continuations.
			</li>
			<li><strong>Autoplay</strong> replays the game and pauses before each turning point.</li>
			<li>
				<strong>Recent</strong> reopens analyzed games instantly. <strong>My games</strong> lists the
				games you saved.
			</li>
			<li>
				The number of turning points and the engine depth can be changed in the toolbar. Higher
				depth is more accurate but slower.
			</li>
			<li>
				Shortcuts: <kbd>←</kbd> <kbd>→</kbd> to step through the moves, <kbd>N</kbd> for the next open
				turning point.
			</li>
		</ul>
	</section>
</main>

<style>
	main {
		max-width: 820px;
		margin: 0 auto;
		padding: 16px 20px 80px;
		display: grid;
		gap: 22px;
	}

	header {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.logo {
		width: 40px;
		height: 40px;
		padding: 5px;
		border-radius: 12px;
		background: radial-gradient(circle at 30% 25%, #3a3220, #191c24 70%);
		border: 1px solid rgb(227 179 65 / 0.35);
		box-sizing: border-box;
	}

	h1 {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 750;
		letter-spacing: -0.02em;
		width: fit-content;
		background: linear-gradient(90deg, #fff 0%, var(--accent-2) 55%, var(--accent) 100%);
		background-clip: text;
		color: transparent;
	}

	header p {
		margin: 2px 0 0;
	}

	.back.first {
		margin-left: auto;
	}

	.back {
		color: var(--accent-2);
		text-decoration: none;
	}

	.back:hover {
		text-decoration: underline;
	}

	p,
	li {
		line-height: 1.6;
	}

	p {
		margin: 0 0 10px;
	}

	ol,
	ul {
		margin: 0;
		padding-left: 22px;
		display: grid;
		gap: 8px;
	}

	li ul {
		margin-top: 6px;
		gap: 4px;
	}

	kbd {
		padding: 1px 6px;
		border: 1px solid var(--border-strong);
		border-radius: 5px;
		font: inherit;
		font-size: 0.85em;
	}

	.found {
		color: var(--good);
	}

	.missed {
		color: var(--danger);
	}

	.muted {
		color: var(--muted);
	}

	.small {
		font-size: 0.85rem;
	}
</style>
