// roBrowser removes the WinDeal (Buy/Sell/Cancel) popup only from its own button
// handlers. Through OpenKore the bot sends the choice, the server answers with
// the buy/sell list (NpcStore), and the popup is left behind. A list opening
// means the choice is made, so drop any popup still showing.
// ponytail: removes the DOM host only (no component handle in the mod API); the
// stale clone is never reused, roBrowser clones a fresh WinDeal per shop.
export default function initialize(parameters, api) {
    if (api?.version !== 1) return false;
    const deals = new Set();
    api.on('ui:append', ({ name, host }) => {
        if (name === 'WinDeal') deals.add(host);
        else if (name === 'NpcStore') { for (const h of deals) h.remove(); deals.clear(); }
    }, { replay: true });
    api.on('ui:remove', ({ host }) => deals.delete(host));
    return true;
}
