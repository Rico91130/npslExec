javascript:(function(){
    /* CONFIGURATION - Vos URLs Git RAW */
    const BASE_URL = "https://raw.githubusercontent.com/Rico91130/npslExec/main/";
    const FILES = [
        { name: 'moteur.js', storageKey: 'MON_MOTEUR_LIB' },
        { name: 'client.js', storageKey: 'MON_MOTEUR_CLIENT' }
    ];

    console.log("⬇️ Téléchargement des outils de test...");

    /* Téléchargement en parallèle */
    Promise.all(FILES.map(file => 
        fetch(BASE_URL + file.name)
            .then(res => {
                if (!res.ok) throw new Error(`Erreur ${res.status} sur ${file.name}`);
                return res.text();
            })
            .then(code => {
                localStorage.setItem(file.storageKey, code);
                return `${file.name} (v${code.length})`;
            })
    ))
    .then(results => {
        alert(`✅ Succès !\nMis à jour :\n- ${results.join('\n- ')}`);
    })
    .catch(err => {
        alert("❌ Erreur de mise à jour : " + err.message);
        console.error(err);
    });
})();
