'use strict';
// --headless: a menu-bar / notification-area icon, so a server running in the
// background is one click from its Settings page, start/stop and sharing.
// Server actions go through the same calls the admin page makes (`invoke`).
const path = require('path');
const { execFile } = require('child_process');
const { Tray, Menu, nativeImage, shell, Notification } = require('electron');


/**
 * @param {object} o
 * @param {string} o.adminUrl   signed-in Settings address
 * @param {() => string} o.gameUrl
 * @param {() => void} o.openGameWindow
 * @param {(name: string, args?: object) => Promise<any>} o.invoke
 * @param {() => string} o.logsDir
 * @param {() => void} o.quit
 * @param {(msg: string) => void} o.log
 * @returns {{ setPhase: (phase: string) => void, destroy: () => void } | null}
 */
function createTray(o) {
	let tray;
	try {
		tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'tray.png')));
	} catch (e) {
		// No graphical session (a Linux box over SSH): the admin page is still there.
		o.log(`headless: no tray icon (${e.message})`);
		return null;
	}
	tray.setToolTip('Ragnarok Offline');
	let phase = 'Starting…';
	let busy = '';
	let sharing = { state: 'stopped' };

	const tell = msg => {
		o.log(`tray: ${msg}`);
		if (Notification.isSupported()) new Notification({ title: 'Ragnarok Offline', body: msg, silent: true }).show();
	};
	const run = (label, fn) => async () => {
		busy = label;
		render();
		try {
			const out = await fn();
			if (typeof out === 'string' && out) tell(out);
		} catch (e) {
			tell(`${label} failed: ${(e && e.message) || e}`);
		} finally {
			busy = '';
			await refreshSharing();
		}
	};
	async function refreshSharing() {
		try { sharing = await o.invoke('sharing_status'); } catch { /* status is best-effort */ }
		render();
	}

	function render() {
		const on = ['sharing', 'reconnecting', 'starting'].includes(sharing.state);
		const sharingLabel = on
			? `Sharing on ${sharing.hostname || 'a temporary link'}${sharing.connectedFriends ? ` · ${sharing.connectedFriends} connected` : ''}`
			: 'Sharing is off';
		tray.setContextMenu(Menu.buildFromTemplate([
			{ label: busy ? `${busy}…` : `Server: ${phase}`, enabled: false },
			{ label: sharingLabel, enabled: false },
			{ type: 'separator' },
			{ label: 'Open Settings', click: () => shell.openExternal(o.adminUrl) },
			{ label: 'Open Game in Browser', click: () => shell.openExternal(o.gameUrl()) },
			{ label: 'Play in Window', click: run('Opening the game window', o.openGameWindow) },
			...(process.platform === 'darwin' ? [{ label: 'Play with nostalRE', click: () => execFile('open', ['-a', 'nostalRE'], e => {
				if (e) tell('nostalRE is not installed. Put nostalRE.app in Applications.');
			}) }] : []),
			{ type: 'separator' },
			{ label: 'Start Server', enabled: !busy, click: run('Starting the server', () => o.invoke('start_stack')) },
			{ label: 'Stop Server', enabled: !busy, click: run('Stopping the server', async () => { await o.invoke('stack_down'); phase = 'Stopped'; return 'Server stopped.'; }) },
			{ type: 'separator' },
			on
				? { label: 'Stop Sharing', enabled: !busy, click: run('Stopping sharing', async () => { await o.invoke('sharing_stop'); return 'Sharing stopped.'; }) }
				: { label: 'Share with Friends', enabled: !busy, click: run('Starting sharing', async () => {
					const s = await o.invoke('sharing_status');
					await o.invoke('sharing_start', { useDomain: !!s.configured });
					return 'Sharing is on. Use Copy Invitation Link to invite friends.';
				}) },
			{ label: 'Copy Invitation Link', enabled: !busy && sharing.state === 'sharing', click: run('Copying the invitation', () => o.invoke('sharing_copy')) },
			{ type: 'separator' },
			{ label: 'Open Logs Folder', click: () => shell.openPath(o.logsDir()) },
			{ label: 'Quit Ragnarok Offline', click: o.quit },
		]));
	}

	render();
	refreshSharing();
	// ponytail: 15 s poll for the sharing line (friend count, reconnects); event hook if it ever matters
	const timer = setInterval(refreshSharing, 15000);
	return {
		setPhase(p) { phase = p; render(); },
		destroy() { clearInterval(timer); tray.destroy(); },
	};
}

module.exports = { createTray };
