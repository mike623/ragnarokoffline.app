'use strict';
// Local fork: the OpenKore panel window. Its page uses window.confirm/alert
// (Respawn, Relog, config saves), which never showed in this window and left
// the page hung. Route both to a native dialog in the main process.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__koreDialog', {
	confirm: message => ipcRenderer.sendSync('kore-panel-dialog', 'confirm', String(message ?? '')),
	alert: message => { ipcRenderer.sendSync('kore-panel-dialog', 'alert', String(message ?? '')); },
});
contextBridge.executeInMainWorld({
	func: () => {
		window.confirm = m => window.__koreDialog.confirm(m);
		window.alert = m => window.__koreDialog.alert(m);
	},
});
