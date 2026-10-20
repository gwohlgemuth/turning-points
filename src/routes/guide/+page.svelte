<script lang="ts">
	import Header from '#lib/components/Header.svelte';
	import { replaceState } from '$app/navigation';
	import { prefersReducedMotion } from 'svelte/motion';

	const SECTIONS = [
		{ id: 'idea', title: 'The idea' },
		{ id: 'quick-start', title: 'Quick start' },
		{ id: 'routine', title: 'A routine that makes you stronger' },
		{ id: 'why', title: 'Why this works' },
		{ id: 'stats', title: 'Reading your stats' },
		{ id: 'tools', title: 'More tools' }
	];
	const title = (id: string) => SECTIONS.find((section) => section.id === id)?.title;

	let active = $state(SECTIONS[0].id);

	$effect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries.filter((entry) => entry.isIntersecting);
				if (visible.length) active = visible.at(-1)!.target.id;
				trackBottom();
			},
			{ rootMargin: '0px 0px -65% 0px' }
		);
		for (const { id } of SECTIONS) {
			const element = document.getElementById(id);
			if (element) observer.observe(element);
		}
		return () => observer.disconnect();
	});

	function trackBottom() {
		const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
		if (atBottom) active = SECTIONS[SECTIONS.length - 1].id;
	}

	function jump(event: MouseEvent, id: string) {
		event.preventDefault();
		document.getElementById(id)?.scrollIntoView({
			behavior: prefersReducedMotion.current ? 'auto' : 'smooth'
		});
		active = id;
		replaceState(`#${id}`, {});
	}
</script>

<svelte:window onscroll={trackBottom} />

<svelte:head>
	<title>Guide · Turning Points</title>
</svelte:head>

<main>
	<Header />

	<div class="page-head">
		<h1>Guide</h1>
		<p class="muted small">How to use Turning Points, and how to get the most out of it</p>
	</div>

	<div class="layout">
		<div class="column">
			<section class="card" id="idea">
				<h2 class="card-title">{title('idea')}</h2>
				<p>
					Most games are decided by two to four moments. Turning Points finds them for you: the
					moves where your winning chances changed the most. That is not the same as the biggest
					swing in centipawns, because +8 to +6 is still winning, while +0.5 to −1.5 turns the game.
				</p>
				<p>
					The training, inspired by
					<a
						href="https://www.youtube.com/watch?v=shma5hsckww&amp;t=830s"
						target="_blank"
						rel="noopener noreferrer">this video</a
					>: look at each of these positions yourself first, as if you were at the board, and only
					then check the engine. The engine tells you
					<em>what</em> was better. Thinking first teaches you <em>why</em>, and only that carries
					over to your next game.
				</p>
			</section>

			<section class="card" id="quick-start">
				<h2 class="card-title">{title('quick-start')}</h2>
				<ol>
					<li>
						In the <strong>Online</strong> tab, enter your {import.meta.env.STATIC
							? 'Lichess'
							: 'Lichess or Chess.com'} username and press
						<strong>Load games</strong>. Choose yourself under <strong>View as</strong>, then click
						a game. Got a game from elsewhere? Paste it or open a file in the <strong>PGN</strong> tab.
					</li>
					<li>
						The engine analyzes every position. The evaluation stays hidden from the first open
						turning point on, so it can't give the answer away.
					</li>
					<li>
						Every new game starts with <strong>spotting</strong>: step through it and flag the moves
						you think decided it (<kbd>Space</kbd>), then press <strong>Check</strong>, or
						<strong>Skip</strong> if you'd rather not. This trains recognizing critical moments, which
						is exactly what you need at the board: they are the moves worth a full check of the forcing
						moves, while quiet moves can be played quickly.
					</li>
					<li>
						Press <strong>Next open turning point</strong> (or <kbd>N</kbd>). First ask what your
						opponent wants, then think and play your candidate move on the board. It is marked
						<span class="found">✓ found</span>
						if it is about as good as the engine's move, otherwise
						<span class="missed">✗ missed</span>. Say how sure you are, then press
						<strong>Reveal</strong>.
					</li>
					<li>
						Answer the three questions in your own words: Why did I choose that move? Why is my move
						not ideal? Why is the better move better? Pick what went wrong in the game, then write
						one rule for next time: “When …, then …”.
					</li>
					<li>
						Press <strong>Save notes</strong>. The game is saved as a PGN file with your notes, and
						feeds Review and Stats.
					</li>
				</ol>
			</section>

			<section class="card" id="routine">
				<h2 class="card-title">{title('routine')}</h2>
				<ul>
					<li>
						<strong>After every serious game</strong>, meaning rapid or classical, not bullet:
						analyze it the same day, while you still remember what you were thinking, and before you
						look at any other engine.
					</li>
					<li>
						<strong>Think like at the board.</strong> Take 3–5 minutes per turning point and commit to
						a candidate before you reveal. Peeking turns training into reading.
					</li>
					<li>
						<strong>Write the answers.</strong> Putting the reason into words is where the learning happens.
						One honest sentence is worth more than a long line of moves.
					</li>
					<li>
						<strong>Be honest about how sure you were.</strong> A move you were sure of that turns out
						wrong is the one you remember best, and Stats shows where your judgment misleads you.
					</li>
					<li>
						<strong>Name the cause.</strong> Missed a threat, miscalculated, wrong plan: only you know
						what went wrong in your head. The engine can't tell you, and it decides what you train.
					</li>
					<li>
						<strong>End with a rule.</strong> “When …, then …” turns the analysis into something you can
						use at the board. It comes back with the position in Review, and Stats collects all your rules,
						grouped by cause. Read them before you play.
					</li>
					<li>
						<strong>Review daily, 5–10 minutes.</strong> Positions you missed come back after 1, 3, 7,
						14 and 30 days, until you find them.
					</li>
					<li>
						<strong>Once a week</strong>, use <strong>Analyze all</strong> on your recent games,
						then open
						<strong>Stats</strong> and pick the one weakness you will work on next. The
						<strong>Progress</strong> chart shows whether your missed rate goes down and your spot rate
						goes up.
					</li>
				</ul>
			</section>

			<section class="card" id="why">
				<h2 class="card-title">{title('why')}</h2>
				<p>
					Training that feels harder usually sticks better. That is why the app makes you think
					before it shows the answer.
				</p>
				<ul>
					<li>
						<strong>Think first.</strong> A move you came up with yourself sticks better than one you
						read.
					</li>
					<li>
						<strong>Say how sure you are.</strong> An error you were sure about gets corrected most reliably.
					</li>
					<li>
						<strong>Ask why.</strong> Explaining the reason is what lets it carry over to new positions.
					</li>
					<li>
						<strong>When …, then ….</strong> An if-then rule comes back at the board by itself.
					</li>
					<li>
						<strong>Spaced and mixed.</strong> Coming back after days, with positions from different games,
						beats reviewing everything at once, even when it feels less productive.
					</li>
				</ul>
			</section>

			<section class="card" id="stats">
				<h2 class="card-title">{title('stats')}</h2>
				<ul>
					<li>
						<span class="found">Found</span> means that once you knew the moment mattered, you found
						a good move. The problem in the game was <em>recognition</em>. Learn to sense critical
						moments: when the position is tense, slow down.
					</li>
					<li>
						<span class="missed">Missed</span> means that even knowing it mattered, you found no
						good move. The gap is <em>calculation or knowledge</em>. Study that kind of position.
					</li>
					<li>
						The <strong>Error profile</strong> shows where you miss the most:
						<ul>
							<li><strong>Quick move</strong>: build a blunder-check habit before every move.</li>
							<li><strong>Time trouble</strong>: spend your time earlier and more evenly.</li>
							<li><strong>Endgame</strong>: study basic and practical endgames.</li>
							<li><strong>Material lost</strong>: train tactics every day.</li>
							<li>
								<strong>Missed win</strong>: solve tactics puzzles daily so patterns become
								automatic. In tense positions, check the forcing moves for both sides.
							</li>
							<li><strong>Positional</strong>: study plans and annotated games.</li>
						</ul>
					</li>
					<li>
						<strong>Cause</strong> shows what went wrong, as you named it:
						<ul>
							<li>
								<strong>Missed a threat</strong>: before every move, ask what your opponent's last
								move wants.
							</li>
							<li>
								<strong>Missed a chance</strong>: check checks, captures and threats for yourself.
							</li>
							<li>
								<strong>Miscalculated</strong>: solve exercises without moving the pieces, and write
								down the line before you check it.
							</li>
							<li>
								<strong>Misjudged</strong>: at the end of each line, ask who is better and why.
								Annotated master games train this.
							</li>
							<li>
								<strong>Wrong plan</strong>: study the typical plans of your openings' structures.
							</li>
							<li><strong>Rushed</strong>: no move without a final blunder check.</li>
							<li>
								<strong>Nerves</strong>: play the position, not the result. Breathe before critical
								moves.
							</li>
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

			<section class="card" id="tools">
				<h2 class="card-title">{title('tools')}</h2>
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
						The logo always leads back to the analysis. <strong>Recent</strong> reopens analyzed
						games instantly. <strong>My games</strong> lists the games you saved{import.meta.env
							.STATIC
							? '; ✕ deletes one, and Delete all on the Stats page removes them all'
							: ''}.
					</li>
					<li>
						The engine depth can be changed in the toolbar. Higher depth is more accurate but
						slower.
					</li>
					<li>
						Shortcuts: <kbd>←</kbd> <kbd>→</kbd> to step through the moves, <kbd>N</kbd> for the next
						open turning point.
					</li>
				</ul>
			</section>
		</div>
		<nav class="toc" aria-label="On this page">
			<span class="label">On this page</span>
			<ul>
				{#each SECTIONS as section (section.id)}
					<li>
						<a
							href="#{section.id}"
							class:active={active === section.id}
							aria-current={active === section.id ? 'location' : undefined}
							onclick={(event) => jump(event, section.id)}>{section.title}</a
						>
					</li>
				{/each}
			</ul>
		</nav>
	</div>
</main>

<style>
	main {
		max-width: 1180px;
		margin: 0 auto;
		padding: 16px 20px 80px;
		display: grid;
		gap: 22px;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 36rem) 14rem;
		gap: 48px;
		align-items: start;
	}

	.card {
		scroll-margin-top: 24px;
	}

	.toc {
		position: sticky;
		top: 24px;
		display: grid;
		gap: 10px;
		padding-top: 18px;
	}

	.toc ul {
		list-style: none;
		padding: 0;
		gap: 0;
	}

	.toc a {
		display: block;
		padding: 5px 0 5px 12px;
		color: var(--muted);
		text-decoration: none;
		font-size: 0.9rem;
		box-shadow: inset 2px 0 0 var(--border-strong);
		transition:
			color 150ms ease,
			box-shadow 150ms ease;
	}

	.toc a:hover {
		color: var(--text);
	}

	.toc a.active {
		color: var(--accent-2);
		box-shadow: inset 2px 0 0 var(--accent);
	}

	.label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}

		.toc {
			display: none;
		}
	}

	.column {
		max-width: 36rem;
		display: grid;
		gap: 22px;
	}

	.page-head h1 {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 750;
		letter-spacing: -0.02em;
	}

	.page-head p {
		margin: 2px 0 0;
	}

	.column p,
	.column li {
		line-height: 1.6;
	}

	.column p {
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
