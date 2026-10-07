# Frontend Supabase

Copie indépendante de `../frontend`, avec les mêmes pages React, formulaires, navigation, thème et textes arabes RTL. Cette version utilise Supabase Auth, PostgreSQL et une Edge Function pour l'administration des comptes. Elle n'appelle pas l'API Express/MySQL. Le frontend et le backend originaux sont conservés.

## Configurer Supabase

Utiliser un projet Supabase neuf pour cette variante. Les données MySQL ne sont pas transférées automatiquement.

1. Exécuter dans le SQL Editor les trois fichiers de `../supabase/migrations/`, dans l'ordre de leurs noms. Ils créent un schéma privé `smd`, les tables, les calculs et les fonctions RPC.
2. Dans **Authentication → Users**, créer et confirmer le premier utilisateur `admin@club.invalid`, avec un mot de passe d'au moins 12 caractères. Adapter l'adresse si vous choisissez un autre domaine de connexion.
3. Adapter puis exécuter `../supabase/bootstrap-admin.sql`. Ce script crée le premier profil administrateur et refuse un second amorçage.
4. Désactiver les inscriptions publiques dans les réglages Auth ; les nouveaux comptes sont créés par l'administrateur.
5. Pour créer des comptes et réinitialiser leurs mots de passe depuis l'écran utilisateurs, déployer l'Edge Function. Depuis la racine du projet, avec la [CLI Supabase](https://supabase.com/docs/guides/cli) :

   ```powershell
   npx supabase login
   npx supabase link --project-ref VOTRE_REFERENCE_PROJET
   npx supabase functions deploy manage-users
   ```

   Les variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournies à la fonction par Supabase. Si vous changez `VITE_AUTH_LOGIN_DOMAIN`, définir aussi le secret `AUTH_LOGIN_DOMAIN` avec la même valeur. La clé serveur reste exclusivement dans l'environnement de la fonction.

6. Activer `pg_cron` dans Supabase puis exécuter `../supabase/schedule-monthly.sql` pour le rattrapage quotidien des cotisations. La génération s'effectue aussi à l'adhésion et à la réactivation ; le planning assure les mois suivants même si personne n'ouvre le front.

Alternative aux trois exécutions SQL : sur un projet neuf lié par la CLI, `npx supabase db push` installe les migrations. Choisir une méthode unique pour que l'historique de migrations reste cohérent.

## Lancer la copie

```powershell
Set-Location frontend-supabase
npm.cmd ci
Copy-Item .env.example .env
# Renseigner .env avec l'URL du projet et sa clé publique.
npm.cmd run dev
```

Ouvrir **http://127.0.0.1:5174**. L'original reste sur son port habituel 5173. Se connecter avec `admin` et le mot de passe du compte Auth créé précédemment.

Variables :

| Variable | Valeur |
| --- | --- |
| `VITE_SUPABASE_URL` | URL de votre projet Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique `sb_publishable_...` |
| `VITE_SUPABASE_ANON_KEY` | Ancienne clé publique `anon`, alternative à la précédente |
| `VITE_AUTH_LOGIN_DOMAIN` | `club.invalid` par défaut ; `admin` devient `admin@club.invalid` |
| `VITE_BUSINESS_TIMEZONE` | `Africa/Nouakchott` ; les paramètres en base font autorité |

Toutes les variables `VITE_*` sont publiques. Le front refuse les clés `service_role` et `sb_secret_...`. En l'absence de configuration, la connexion affiche un message arabe explicite.

## Fonctionnement

Le client Axios existant utilise désormais un adaptateur Supabase : les services conservent leurs types et envoient les opérations à `smd_request`. Les contrôles d'accès et calculs sont dans PostgreSQL ; les tables privées ont RLS activée et aucune permission directe pour `anon` ou `authenticated`. `smd_manage_user` est accessible uniquement à `service_role` et recontrôle l'administrateur et sa session. Les métadonnées modifiables des utilisateurs ne déterminent aucun rôle.

Les écritures sont transactionnelles. Les paiements conservent montants décimaux exacts, affectations, idempotence, corrections, reçus historiques et audit. Les obligations futures restent séparées des arriérés. Les rapports réutilisent leur borne `recordedBefore` pour conserver une situation historique stable. Les mutations sont sérialisées pour éviter les dépassements et protéger le dernier administrateur.

La session utilise le stockage du SDK Supabase et son renouvellement de jetons. Chaque RPC vérifie le profil et la session Auth en base ; désactivation, changement de rôle et réinitialisation du mot de passe révoquent les sessions antérieures, y compris après renouvellement d'un jeton. Ce mécanisme remplace les cookies HttpOnly/CSRF et l'expiration absolue de l'API originale. Voir les [sessions Supabase](https://supabase.com/docs/guides/auth/sessions).

Les reçus et rapports reprennent les modèles HTML originaux et la police arabe complète sous licence OFL. Le PDF est produit localement dans le navigateur et conserve le texte arabe sous forme d'image ; il n'est pas indexable comme le PDF texte produit par Chromium sur l'API originale. L'impression HTML reste disponible. Les exports sont limités à 5000 lignes par tableau et peuvent prendre du temps sur téléphone.

## Vérifier

```powershell
npm.cmd test
npm.cmd run test:e2e
npm.cmd run lint
npm.cmd run build
```

Les tests SQL appliquent les vraies migrations à PostgreSQL embarqué (PGlite) et vérifient rôles, facturation, calculs, paiement/reprise/correction, historique et révocation. Les tests navigateur utilisent ces mêmes fonctions SQL derrière les requêtes Supabase interceptées ; seule l'authentification distante est simulée. Aucun projet Supabase réel n'est modifié par les tests.

Le déploiement de la fonction et la connexion Auth réelle nécessitent votre projet et sa configuration. Le build statique se trouve dans `dist/` ; l'hébergement doit rediriger les routes React vers `index.html`.
