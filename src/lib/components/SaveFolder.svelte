<script lang="ts">
	import { untrack } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { ms } from '#lib/motion.ts';
	import { DEFAULT_SAVE_FOLDER } from '#lib/preferences.ts';
	import { saving, setSaveFolder } from '#lib/saving.svelte.ts';

	let { folder }: { folder: string } = $props();

	saving.folder = untrack(() => folder);

	let open = $state(false);
	let path = $state('');
	let folders = $state<string[]>([]);
	let exists = $state(true);
	let newName = $state('');
	let message = $state('');

	async function request(url: string, init?: RequestInit) {
		const response = await fetch(url, init);
		const body = await response.json();
		if (!response.ok) throw new Error(body.message ?? `Request failed (${response.status})`);
		return body;
	}

	async function browse(target: string) {
		message = '';
		try {
			const body = await request(`/api/folders?${new URLSearchParams({ path: target })}`);
			({ path, folders, exists } = body);
		} catch (err) {
			message = (err as Error).message;
		}
	}

	async function create(event: SubmitEvent) {
		event.preventDefault();
		message = '';
		try {
			const body = await request('/api/folders', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ parent: path, name: newName })
			});
			newName = '';
			await browse(body.path);
		} catch (err) {
			message = (err as Error).message;
		}
	}

	function toggle() {
		open = !open;
		if (open) browse(saving.folder);
	}

	function choose(folder: string) {
		setSaveFolder(folder);
		open = false;
	}

	const up = (folder: string) => folder.split('/').slice(0, -1).join('/');
	const display = (folder: string) => (folder ? `~/${folder}` : '~');
</script>

<div class="save-folder">
	<span>Save folder: <strong>{display(saving.folder)}</strong></span>
	<button onclick={toggle}>{open ? 'Close' : 'Change'}</button>
	{#if saving.message}
		{#key saving.message}
			<span class:error={saving.failed} class="status" in:fade={{ duration: ms(200) }}
				>{saving.message}</span
			>
		{/key}
	{/if}
</div>

{#if open}
	<div class="picker" transition:slide={{ duration: ms(200) }}>
		<div class="current">
			<button onclick={() => browse(up(path))} disabled={!path} aria-label="Up">↑</button>
			<strong>{display(path)}</strong>
			{#if !exists}<span class="muted">(will be created when saving)</span>{/if}
		</div>
		<ul>
			{#each folders as folder (folder)}
				<li>
					<button class="folder" onclick={() => browse(path ? `${path}/${folder}` : folder)}>
						📁 {folder}
					</button>
				</li>
			{:else}
				<li class="muted">No subfolders</li>
			{/each}
		</ul>
		<form onsubmit={create}>
			<input bind:value={newName} placeholder="New folder name" aria-label="New folder name" />
			<button type="submit" disabled={!newName.trim()}>Create folder</button>
		</form>
		{#if message}<p class="error">{message}</p>{/if}
		<div class="actions">
			<button class="primary" onclick={() => choose(path)}>Use this folder</button>
			<button onclick={() => choose(DEFAULT_SAVE_FOLDER)}>Use default</button>
		</div>
	</div>
{/if}

<style>
	.save-folder {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		font-size: 0.9rem;
	}

	.status {
		color: var(--muted);
	}

	.error {
		color: var(--danger);
		margin: 0;
	}

	.muted {
		color: var(--muted);
	}

	.picker {
		display: grid;
		gap: 8px;
		padding: 10px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface-2);
		max-width: 520px;
	}

	.current {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 220px;
		overflow-y: auto;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: rgb(0 0 0 / 0.18);
	}

	li.muted {
		padding: 6px 10px;
	}

	.folder {
		width: 100%;
		text-align: left;
		border: none;
		border-radius: 0;
		border-bottom: 1px solid var(--border);
	}

	.folder {
		background: transparent;
	}

	.folder:not(:disabled):hover {
		background: rgb(255 255 255 / 0.04);
		transform: none;
	}

	form,
	.actions {
		display: flex;
		gap: 8px;
	}

	form input {
		flex: 1;
	}
</style>
