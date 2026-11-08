'use strict';
//
// Local fork only: run OpenKore, its web panel (kore-gateway.py) and the
// kore.namike.me tunnel alongside the game server, and stop them with it.
// Off unless OPENKORE_HOME (default ~/.ragnarokoffline/openkore-probe) holds
// an openkore/ checkout. Logs go next to it: kore.log, kore-gateway.log,
// kore-tunnel.log.
//
// ponytail: fixed paths and no settings UI; add a Settings toggle if this
// ever ships beyond this machine.
//
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { powerSaveBlocker } = require('electron');

const HOME = process.env.OPENKORE_HOME || path.join(os.homedir(), '.ragnarokoffline', 'openkore-probe');
const KORE = path.join(HOME, 'openkore');
const HELPERS = path.join(os.homedir(), 'Library', 'Application Support', 'Ragnarok Offline', 'sharing', 'helpers');

function cloudflaredBin() {
	try {
		const versions = fs.readdirSync(HELPERS).sort();
		for (const v of versions.reverse()) {
			const bin = path.join(HELPERS, v, 'cloudflared');
			if (fs.existsSync(bin)) return bin;
		}
	} catch { /* no helpers */ }
	return null;
}

function createOpenKoreSidecar({ log = () => {} } = {}) {
	const children = [];
	let blocker = null; // keeps the Mac awake while the bot runs

	function run(name, cmd, args, opts = {}) {
		const out = fs.openSync(path.join(HOME, `${name}.log`), 'a');
		const child = spawn(cmd, args, { stdio: ['ignore', out, out], detached: true, ...opts });
		fs.closeSync(out);
		child.on('error', e => log(`openkore-sidecar: ${name} failed to start: ${e.message}`));
		child.on('exit', code => log(`openkore-sidecar: ${name} exited (${code})`));
		children.push(child);
		log(`openkore-sidecar: started ${name} (pid ${child.pid})`);
	}

	return {
		// The web panel with its invite, so the window signs itself in.
		panelUrl() {
			try {
				const invite = fs.readFileSync(path.join(KORE, 'web', 'kore-gateway.invite'), 'utf8').trim();
				return `https://kore.namike.me/#invite=${invite}`;
			} catch { return null; }
		},
		enabled: () => fs.existsSync(path.join(KORE, 'openkore.pl')),

		// XKore 2's login/char/map ports, for the game's WebSocket allowlist
		// (the server-switch mod). Char and map are dialled at XKore_publicIp.
		proxyTargets() {
			if (!this.enabled()) return [];
			let cfg = '';
			try { cfg = fs.readFileSync(path.join(KORE, 'control', 'config.txt'), 'utf8'); } catch { return []; }
			const get = (key, fallback) => (cfg.match(new RegExp(`^${key}[ \\t]+(\\S+)`, 'm')) || [])[1] || fallback;
			const hosts = [...new Set(['127.0.0.1', get('XKore_publicIp', '127.0.0.1')])];
			const ports = [get('XKore_listenPort', '6901'), get('XKore_listenPort_char', '6902'), get('XKore_listenPort_map', '6903')];
			return hosts.flatMap(host => ports.map(port => `${host}:${port}`));
		},
		running: () => children.some(c => c.exitCode === null && !c.killed),

		start() {
			if (!this.enabled() || this.running()) return;
			blocker = powerSaveBlocker.start('prevent-app-suspension');
			// TERM: a GUI-launched app has none, and OpenKore's console code warns on every line without it.
			run('kore', '/usr/bin/perl', ['openkore.pl', '--interface=Socket'], { cwd: KORE, env: { ...process.env, TERM: process.env.TERM || 'dumb' } });
			const uv = path.join(os.homedir(), '.local', 'bin', 'uv');
			if (fs.existsSync(uv)) {
				run('kore-gateway', uv, ['run', 'kore-gateway.py'], {
					cwd: path.join(KORE, 'web'),
					env: { ...process.env, KORE_HOST: process.env.KORE_HOST || '127.0.0.1' },
				});
			}
			const tokenFile = path.join(HOME, 'kore-tunnel.token');
			const cf = cloudflaredBin();
			if (cf && fs.existsSync(tokenFile)) {
				run('kore-tunnel', cf, ['tunnel', '--no-autoupdate', 'run'], {
					env: { ...process.env, TUNNEL_TOKEN: fs.readFileSync(tokenFile, 'utf8').trim() },
				});
			}
		},

		// Sync on purpose: called from the signal path too. Kills each
		// child's whole process group (uv spawns python under it).
		stop() {
			for (const child of children.splice(0)) {
				if (child.exitCode !== null) continue;
				try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ }
			}
			if (blocker !== null) { powerSaveBlocker.stop(blocker); blocker = null; }
		},
	};
}

module.exports = { createOpenKoreSidecar };
