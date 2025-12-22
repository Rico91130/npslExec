javascript:(function(){
    const REPO = "https://raw.githubusercontent.com/Rico91130/npslExec/main/";
    const FILES = [
        { name: 'moteur.js', key: 'MON_MOTEUR_LIB' },
        { name: 'dashboard.js', key: 'MON_DASHBOARD' },
        { name: 'toolbar.js', key: 'MON_TOOLBAR' }
    ];
    Promise.all(FILES.map(f => fetch(REPO + f.name).then(r => r.text()).then(c => localStorage.setItem(f.key, c))))
    .then(() => {
        window.eval(localStorage.getItem('MON_DASHBOARD'));
    })
    .catch(e => alert("Erreur MAJ: " + e));
})();
