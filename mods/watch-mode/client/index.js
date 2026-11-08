// Watch mode: hide the windows a spectator of OpenKore does not need. Each
// hidden window gets `:host{display:none!important}` in its shadow root, which
// beats roBrowser's own inline show()/hide(); toggling just flips `disabled`.

// ponytail: fixed list; add a settings window if per-window choice is ever wanted.
const HIDE = new Set([
    'NpcBox', 'NpcMenu', 'NpcStore', 'InputBox', 'CardIllustration',
    'ItemSelection', 'MakeItemSelection', 'PackageSelection', 'SkillTargetSelection',
    'ItemObtain', 'ShortCut', 'ShortCuts', 'JoystickUI', 'CashShopIcon', 'PCGoldTimer',
]);

export default function initialize(parameters, api) {
    if (api?.version !== 1) return false;
    let viaKore = false;
    try { viaKore = localStorage.getItem('rooff-server') === 'kore'; } catch {}
    const KEY = viaKore ? 'on-kore' : 'on-direct';
    let on = api.preferences.get(KEY, viaKore);
    const styles = new Map(); // host -> <style>

    api.on('ui:append', ({ name, root, host }) => {
        if (!HIDE.has(name) || styles.has(host) || !root) return;
        const style = document.createElement('style');
        style.textContent = ':host{display:none!important}';
        style.disabled = !on;
        root.append(style);
        styles.set(host, style);
    }, { replay: true });
    api.on('ui:remove', ({ host }) => { styles.get(host)?.remove(); styles.delete(host); });

    const set = next => {
        on = next;
        api.preferences.set(KEY, on);
        for (const s of styles.values()) s.disabled = !on;
        toast(on ? 'Watch mode on' : 'Watch mode off');
    };
    // `/watch` or `@watch` [on|off] typed in chat. Our window capture listener is
    // registered at plugin init, before ChatBox binds its own on append, so we see
    // Enter first and can swallow the line before it reaches the server.
    const CMD = /^[\/@](?:watch|wm)(?:\s+(on|off))?$/i;
    const onKey = e => {
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyH') {
            e.preventDefault(); e.stopImmediatePropagation();
            return set(!on);
        }
        if (e.key !== 'Enter') return;
        const box = e.composedPath()[0];
        const m = box?.classList?.contains('input-chatbox') && CMD.exec(box.textContent.trim());
        if (!m) return;
        e.preventDefault(); e.stopImmediatePropagation();
        box.innerHTML = '';
        set(m[1] ? m[1].toLowerCase() === 'on' : !on);
    };
    window.addEventListener('keydown', onKey, true);

    let toastEl;
    function toast(text) {
        toastEl ??= Object.assign(document.createElement('div'), {
            style: 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:100000;' +
                'background:#000a;color:#fff;font:13px Tahoma,sans-serif;padding:6px 12px;border-radius:4px;pointer-events:none',
        });
        document.body.append(toastEl);
        toastEl.textContent = text;
        clearTimeout(toast.t);
        toast.t = setTimeout(() => toastEl.remove(), 1500);
    }

    return () => {
        window.removeEventListener('keydown', onKey, true);
        for (const s of styles.values()) s.remove();
        styles.clear();
        toastEl?.remove();
    };
}
