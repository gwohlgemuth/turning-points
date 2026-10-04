export function downloadText(text: string, filename: string): void {
	const blob = new Blob([text], { type: 'application/x-chess-pgn' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = filename;
	link.click();
	setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
