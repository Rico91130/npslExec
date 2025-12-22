javascript:(function(){
    /* 1. RECUPERATION & INJECTION DU MOTEUR */
    const engineCode = localStorage.getItem('MON_MOTEUR_TEST');
    
    if (!engineCode) {
        alert("⚠️ Moteur introuvable ! Lancez le bookmarklet 'Update Moteur' depuis la page d'accueil d'abord.");
        window.open('https://demarches.service-public.gouv.fr/', '_blank');
        return;
    }

    try {
        // On exécute le code stocké (autorisé par unsafe-eval du formulaire)
        window.eval(engineCode);
    } catch (e) {
        alert("❌ Erreur lors de l'évaluation du moteur : " + e);
        return;
    }

    /* 2. DEFINITION DU SCENARIO (À modifier selon le test voulu) */
    const SCENARIO = {
        "numeroCamera": "12345",
        "arrondissementParis": "75001", // Match partiel sur le texte
        "adresseCameraEstManuelle": true,
        "adresseCameraManuelle": "10 Rue de la Paix"
    };

    /* 3. LANCEMENT */
    if (window.FormulaireTester) {
        window.FormulaireTester.run(SCENARIO);
    } else {
        alert("❌ L'objet FormulaireTester n'a pas été créé par le script chargé.");
    }
})();
