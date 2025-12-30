(function(){
    const REPO = "https://raw.githubusercontent.com/Rico91130/npslExec/main/";
    const TS = Date.now(); 
    
    const FILES = [
        { name: 'moteur.js', key: 'MON_MOTEUR_LIB' },
        { name: 'dashboard.js', key: 'MON_DASHBOARD' },
        { name: 'toolbar.js', key: 'MON_TOOLBAR' }
    ];

    console.log(`[Boot] Chargement des outils (TS: ${TS})...`);

    Promise.all(FILES.map(f => 
        fetch(REPO + f.name + '?t=' + TS)
        .then(r => {
            if (!r.ok) throw new Error("HTTP " + r.status + " sur " + f.name);
            return r.text();
        })
        .then(c => localStorage.setItem(f.key, c))
    ))
    .then(() => {
        console.log("[Boot] Outils chargés avec succès.");
        if (window.location.href.includes('/demarche') && localStorage.getItem('TEST_SCENARIO')) {
             const toolbarCode = localStorage.getItem('MON_TOOLBAR');
             if(toolbarCode) window.eval(toolbarCode);
        } else {
             const dashCode = localStorage.getItem('MON_DASHBOARD');
             if(dashCode) window.eval(dashCode);
        }
    })
    .catch(e => alert("Erreur Bootloader : " + e));
})();