(function(){
    const URL_MOTEUR = "https://gist.githubusercontent.com/Rico91130/83d163d4902414dc970d642164fc07f6/raw/35a5f1118ac5b3e0dbe4e1410372eaa6b7eea7d0/gistfile1.txt";
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
