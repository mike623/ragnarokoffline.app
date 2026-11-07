// Switch Server: option-menu button and a small window to choose where the
// game logs in. The choice is kept in localStorage ('rooff-server') and read
// by config/Config.local.js before the client starts, so switching is a
// reload back to the login screen.

const KEY = 'rooff-server';
const NAMES = { direct: 'Direct (Ragnarok Offline)', kore: 'Through OpenKore (bot assists)' };

function current() {
    try { return localStorage.getItem(KEY) === 'kore' ? 'kore' : 'direct'; } catch { return 'direct'; }
}

export default function initialize(parameters, api) {
    if (api?.version !== 1 || !api.ui?.menuButton) return;
    const win = api.ui.window({ id: 'server-switch', title: 'Switch Server', width: 300, height: 170 });
    const now = document.createElement('p');
    const note = document.createElement('p');
    note.style.cssText = 'font-size:11px;opacity:.8;margin:6px 0';
    note.textContent = 'The game reloads to the login screen. Through OpenKore needs the bot running and logged in; it shares the bot\'s character.';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    win.body.append(now, row, note);

    function render() {
        now.textContent = 'Now: ' + NAMES[current()];
        row.replaceChildren(...Object.keys(NAMES).filter(k => k !== current()).map(k => {
            const b = document.createElement('button');
            b.textContent = 'Switch to ' + NAMES[k];
            b.onclick = () => {
                try { localStorage.setItem(KEY, k); } catch { return; }
                location.reload();
            };
            return b;
        }));
    }

    api.ui.menuButton({
        background: 'esc_serverswitch_a.bmp',
        hover: 'esc_serverswitch_b.bmp',
        down: 'esc_serverswitch_c.bmp',
        title: 'Switch Server',
        onClick: () => { render(); win.toggle(); },
    });
}
