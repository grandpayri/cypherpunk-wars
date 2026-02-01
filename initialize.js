    // 1. Initial Load & Engine Boot
    window.addEventListener('load', async () => {
        const ready = await bootBunkerEngine();
        if (ready) {
            const savedId = localStorage.getItem('bunker_id');
            if (savedId) {
                updateStatus(`RECON: PREVIOUS_ID_${savedId.substring(0,8)}..._DETECTED`);
                document.getElementById('sideId').innerText = savedId.substring(0,10) + "...";
            } else {
                updateStatus("AWAITING_OPERATOR_HANDSHAKE...");
            }
        } else {
            updateStatus("CRITICAL_ERROR: WASM_ENGINE_OFFLINE");
        }
    });

    // 2. Terminal Logging
    function updateStatus(msg) {
        const log = document.getElementById('log');
        if (log) {
            log.innerHTML += `<br>> ${msg}`;
            log.scrollTop = log.scrollHeight;
        }
    }

    // 3. Navigation (Restoring the view)
    function showPage(pageId, btn) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        const target = document.getElementById('page-' + pageId);
        if (target) {
            target.classList.add('active');
            btn.classList.add('active');
        }
    }

    // 4. Forge Identity (Handshake)
    function handleForgeNew() {
        const secret = forgeNewIdentity();
        if (secret) {
            const input = document.getElementById('mnemonic-input');
            input.value = secret;
            input.type = "text"; // Reveal for recording
            updateStatus("NEW_IDENTITY_FORGED: RECORD_KEY_IMMEDIATELY");
        }
    }

    // 5. Boot Bunker (Sync)
    async function handleBunkerBoot() {
        const val = document.getElementById('mnemonic-input').value.trim();
        if (!val) {
            updateStatus("ERROR: IDENTITY_STRING_REQUIRED");
            return;
        }

        updateStatus("STATUS: SYNCING_WITH_DAG...");
        try {
            const bunkerId = await syncBunkerIdentity(val);
            document.getElementById('sideId').innerText = bunkerId.substring(0,12) + "...";
            updateStatus(`SUCCESS: BUNKER_${bunkerId.substring(0,10)}... ONLINE`);
        } catch (err) {
            updateStatus("ERROR: SYNC_FAILED. VERIFY_MNEMONIC.");
        }
    }
