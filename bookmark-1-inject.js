javascript:(function(){
    /* L'URL BRUTE de votre fichier JS hébergé (ex: Gist Raw) */
    const URL_MOTEUR = "https://raw.githubusercontent.com/Rico91130/npslExec/main/moteur.js";

    console.log("⬇️ Téléchargement du moteur depuis " + URL_MOTEUR);
    
    fetch(URL_MOTEUR)
        .then(response => {
            if (!response.ok) throw new Error("Erreur HTTP " + response.status);
            return response.text();
        })
        .then(code => {
            /* On stocke le code téléchargé dans le localStorage partagé */
            localStorage.setItem('MON_MOTEUR_TEST', code);
            alert("✅ Moteur mis à jour avec succès dans le LocalStorage !");
            console.log("Code stocké (début) : ", code.substring(0, 50) + "...");
        })
        .catch(err => {
            alert("❌ Erreur de téléchargement : " + err);
            console.error(err);
        });
})();
