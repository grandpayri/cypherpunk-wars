// bunker-logic.js
window.addEventListener('load', async () => {
    updateStatus("SYNCING_WITH_POWER_GRID...");
    const address = localStorage.getItem('bunker_id');
    
    if (!address) {
        window.location.href = 'index.html'; // Kick to airlock
        return;
    }

    document.getElementById('op-address').innerText = address.substring(0,10) + "...";
    await refreshBunkerStats(address);
});

async function refreshBunkerStats(address) {
    // 1. Get KAS Balance and convert to GWh (Simplified: 1 KAS = 1000 GWh)
    const balance = await getAddressBalance(address); 
    const gwh = (balance / 0.0001).toFixed(0); // Adjusting for gas scale
    
    document.getElementById('sideGWh').innerText = `${gwh}`;
    
    // 2. Fetch $PUNKW from DAG (Logic to be built in v0.2)
    // For now, we use a placeholder or local storage
}

async function executePhish() {
    updateStatus("ALLOCATING_GIGAWATTS...");
    
    try {
        // This is where the 1.01 Gas Fee / Turn logic lives
        const success = await sendGameTransaction("PHISH_OP"); 
        
        if (success) {
            const yield = Math.floor(Math.random() * 40) + 10;
            updateStatus(`SUCCESS: Ingested ${yield} $PUNKW fragments.`);
            // Update UI
        }
    } catch (err) {
        updateStatus("ERROR: GRID_FAILURE. CHECK_RESERVES.");
    }
}

function updateStatus(msg) {
    const log = document.getElementById('log');
    log.innerHTML += `<br>> ${msg}`;
    log.scrollTop = log.scrollHeight;
}
