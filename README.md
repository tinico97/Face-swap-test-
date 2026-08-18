# Dragon Face Test — version minimale

Objectif unique : prouver le flux réel

photo -> POST /api/preview -> gpt-image-2 edit -> résultat affiché

Aucun Shopify, aucun CORS cross-domain, aucun webhook, aucune base de données.

## Déployer sur Render

Crée un nouveau Web Service depuis ce dépôt.
Le Dockerfile est déjà prêt.

Variable obligatoire :
OPENAI_API_KEY = ta clé

Variable optionnelle :
QUALITY = medium

Quand Render affiche Live, ouvre simplement son URL racine.
Le front et le backend sont servis par le MÊME domaine.

## Pourquoi cette version est utile

Si ce test fonctionne techniquement mais que le visage n'est pas assez fidèle,
le problème est le moteur / pipeline d'identité, pas Shopify.

Si ce test échoue, l'écran affiche le vrai message d'erreur du backend + un requestId.
Le même requestId apparaît dans les logs Render.

## Important

Le poster est verrouillé comme image source, et le masque n'ouvre que la zone
tête / cheveux / haut du cou. GPT Image 2 reste un modèle génératif : le masque
guide l'édition mais n'est pas une garantie mathématique de pixels strictement inchangés.
