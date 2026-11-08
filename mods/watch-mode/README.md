# watch-mode (local fork)

For watching OpenKore play through XKore 2. Hides dialog/popup/hotbar windows (list `HIDE` in
`client/index.js`); chat, HP/SP, minimap, buffs and the Escape menu stay. Default: on when
`localStorage['rooff-server'] === 'kore'` (server-switch mod), off on Direct. **Ctrl+Shift+H**
toggles; so does typing `/watch` or `@watch` (alias `wm`, optional `on`/`off`) in chat — swallowed client-side, never sent to the server. Choice remembered per server via `api.preferences`.
