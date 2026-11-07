# server-switch (local fork)

Option menu (Escape) → **Switch Server**: Direct, or Through OpenKore (XKore 2 on 6901).
The pick lives in `localStorage['rooff-server']`; `config/Config.local.js` turns it into the
client's one server entry. The asset server's WebSocket allowlist gets OpenKore's ports from
`electron/openkore-sidecar.js` (`proxyTargets`).
