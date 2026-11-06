'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
test('tray offers the local game window beside the browser and reports opening errors', async () => {
	let menu, opened = 0, external;
	const messages = [];
	const electron = {
		Tray: class { setToolTip() {} setContextMenu(value) { menu = value; } destroy() {} },
		Menu: { buildFromTemplate: value => value },
		nativeImage: { createFromPath() {} },
		shell: { openExternal: url => { external = url; } },
		Notification: { isSupported: () => false },
	};
	const context = {
		module: { exports: {} }, __dirname: path.join(root, 'electron/headless'), process,
		require: name => name === 'electron' ? electron : require(name),
		setInterval: () => 1, clearInterval() {},
	};
	vm.runInNewContext(fs.readFileSync(path.join(root, 'electron/headless/tray.js'), 'utf8'), context);
	const options = {
		gameUrl: () => 'http://localhost:3338/',
		openGameWindow: () => { opened++; },
		invoke: async name => { assert.equal(name, 'sharing_status'); return { state: 'stopped' }; },
		log: message => messages.push(message),
	};
	const tray = context.module.exports.createTray(options);
	const browser = menu.findIndex(item => item.label === 'Open Game in Browser');
	assert.equal(menu[browser + 1].label, 'Play in Window');
	menu[browser].click();
	assert.equal(external, options.gameUrl());
	await menu[browser + 1].click();
	assert.equal(opened, 1);
	tray.destroy();
	options.openGameWindow = () => { throw new Error('window unavailable'); };
	const failedTray = context.module.exports.createTray(options);
	await menu[browser + 1].click();
	assert.match(messages.at(-1), /Opening the game window failed: window unavailable/);
	failedTray.destroy();
});

test('tray callback reuses the game flow and restores a minimized window', () => {
	const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
	const callback = main.match(/openGameWindow: (\(\) => \{[\s\S]*?\n\t\t\}),/)[1];
	for (const minimized of [false, true]) {
		const calls = [];
		const win = {
			isMinimized: () => minimized,
			restore: () => calls.push('restore'), show: () => calls.push('show'), focus: () => calls.push('focus'),
		};
		vm.runInNewContext(`(${callback})()`, { openGame: () => { calls.push('openGame'); return win; } });
		assert.deepEqual(calls, ['openGame', ...(minimized ? ['restore'] : []), 'show', 'focus']);
	}
});
