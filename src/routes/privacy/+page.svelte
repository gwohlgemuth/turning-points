<script lang="ts">
	import Header from '#lib/components/Header.svelte';
</script>

<svelte:head>
	<title>Privacy · Turning Points</title>
</svelte:head>

<main>
	<Header />

	<div class="page-head">
		<h1>Privacy</h1>
		<p class="muted small">How Turning Points handles your data</p>
	</div>

	<div class="column">
		<section class="card">
			<h2 class="card-title">Controller</h2>
			<address>
				Gerhard Wohlgemuth<br />
				Ringstraße 22, 63322 Rödermark, Germany<br />
				<a href="mailto:gerhard.wohlgemuth@proton.me">gerhard.wohlgemuth@proton.me</a>
			</address>
		</section>

		<section class="card">
			<h2 class="card-title">Overview</h2>
			<p>
				Turning Points runs entirely in your browser. The chess engine is loaded from this server
				and runs locally on your device. Your games, analyses and notes are not sent to me. No
				analytics or tracking tools are used.
			</p>
		</section>

		<section class="card">
			<h2 class="card-title">Hosting</h2>
			<p>
				Turning Points is served by Cloudflare. When you open it, technically necessary information
				such as your IP address, the date and time of access, and details of your browser and
				operating system is processed to deliver the app and keep the systems secure. The legal
				basis is Art. 6(1)(f) GDPR; my legitimate interest is to deliver the app securely and
				reliably.
			</p>
			<p>
				Cloudflare is certified under the EU-US Data Privacy Framework. Data may be processed in
				data centres inside the European Union and in the USA. How long technical logs are kept
				depends on Cloudflare and the kind of data. More information:
				<a href="https://www.cloudflare.com/policies/privacy/">Cloudflare privacy policy</a>.
			</p>
		</section>

		<section class="card">
			<h2 class="card-title">Data stored on your device</h2>
			<p>So that the features you use work, the app stores in your browser:</p>
			<ul>
				<li>
					your settings (e.g. how many games to load, sound on/off, the last Lichess username) in a
					cookie named “turning-points”, kept for one year,
				</li>
				<li>recently analyzed games in local storage,</li>
				<li>your saved games and review progress in IndexedDB,</li>
				<li>
					the app's files in a service worker cache, so it loads faster, can be installed as an app
					and works offline.
				</li>
			</ul>
			<p>
				This data stays on your device and is not sent to me. Storing it is strictly necessary for
				the features you explicitly use (§ 25(2) no. 2 TDDDG).
			</p>
			<p>
				You can delete it at any time by removing the site data for turning-points.gwohl.de in your
				browser settings, or by uninstalling the app. To keep your saved games, use
				<strong>Save sync file</strong> on the Stats page first.
			</p>
		</section>

		<section class="card">
			<h2 class="card-title">Loading games from Lichess</h2>
			<p>
				When you enter a Lichess username and load games, your browser fetches them directly from
				Lichess (lichess.org, run by a non-profit association based in France). Your IP address,
				technical information about your browser and the username you entered are sent to Lichess.
				This only happens when you start it. The legal basis is Art. 6(1)(f) GDPR; my legitimate
				interest is to provide the feature you asked for. More information:
				<a href="https://lichess.org/privacy">Lichess privacy policy</a>.
			</p>
			<p>
				Games from other platforms (e.g. Chess.com) can be pasted or opened as PGN. This happens
				only in your browser; the app does not connect to that platform.
			</p>
		</section>

		<section class="card">
			<h2 class="card-title">External links</h2>
			<p>
				The app links to other websites, such as YouTube and Lichess. Their operators alone are
				responsible for how those websites process data.
			</p>
		</section>

		<section class="card">
			<h2 class="card-title">Your rights</h2>
			<p>
				Under the GDPR, you have the right of access, rectification, erasure, restriction of
				processing, data portability and objection regarding your personal data. You also have the
				right to lodge a complaint with a data protection supervisory authority. To exercise your
				rights or ask about privacy, write to the email address above.
			</p>
		</section>
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

	.column {
		max-width: 36rem;
		display: grid;
		gap: 22px;
	}

	.column p,
	.column li,
	address {
		line-height: 1.6;
	}

	.column p {
		margin: 0 0 10px;
	}

	.column p:last-child {
		margin-bottom: 0;
	}

	address {
		font-style: normal;
	}

	ul {
		margin: 0 0 10px;
		padding-left: 22px;
		display: grid;
		gap: 6px;
	}

	a {
		color: var(--accent);
	}

	.muted {
		color: var(--muted);
	}

	.small {
		font-size: 0.85rem;
	}
</style>
