/**
 * CLIENT D'EXÉCUTION (Interface Utilisateur)
 * Charge le moteur et propose l'ouverture de fichier
 */
(function() {
    console.log("🖥️ Lancement du Client de Test PVPP...");

    // 1. Récupération & Chargement du Moteur (Library)
    const engineCode = localStorage.getItem('MON_MOTEUR_LIB');
    if (!engineCode) {
        alert("⚠️ Moteur introuvable ! Veuillez lancer le bookmarklet 'Mise à jour' depuis la page d'accueil.");
        return;
    }

    try {
        // Chargement du moteur en mémoire
        window.eval(engineCode);
    } catch (e) {
        alert("❌ Erreur critique au chargement du moteur : " + e.message);
        return;
    }

    // 2. Création de l'interface d'upload (Input File caché)
    // On vérifie si un input existe déjà pour ne pas polluer le DOM
    let fileInput = document.getElementById('test-runner-input');
    
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.id = 'test-runner-input';
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        // 3. Gestion de l'événement de sélection
        fileInput.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const jsonData = JSON.parse(event.target.result);
                    console.log(`📂 Fichier chargé : ${file.name} (${event.target.result.length} octets)`);

                    if (window.FormulaireTester) {
                        // Lancement effectif via le Moteur v2
                        window.FormulaireTester.run(jsonData);
                    } else {
                        alert("❌ L'objet global FormulaireTester n'a pas été initialisé.");
                    }
                } catch (err) {
                    console.error(err);
                    alert("❌ JSON Invalide : " + err.message);
                }
                // Reset de l'input pour permettre de re-sélectionner le même fichier si besoin
                fileInput.value = ''; 
            };
            reader.readAsText(file);
        };
    }

    // 4. Ouverture immédiate de la fenêtre
    fileInput.click();

})();
