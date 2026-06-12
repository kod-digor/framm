# Framm

Dépôt regroupant l'ensemble de l'infrastructure de l'association Kod Digor, gérée sous forme de code afin d'en garantir la traçabilité, la reproductibilité et la transparence.

Plateforme multi-associations : site web, messagerie Stalwart, gestion de domaines et boîtes mail.

## Architecture

- **2 VMs Scaleway** : App (Next.js, PostgreSQL, Grafana) + Mail (Stalwart)
- **S3** : uploads, backups, archives froides, tfstate
- **Domaines plateforme** : `kod-digor.bzh`, `app.bzh` (activable plus tard)

## Prérequis

- Terraform >= 1.5
- Compte Scaleway avec clés API
- Domaine `kod-digor.bzh` acheté chez Scaleway (zone DNS auto-créée)
- Une clé SSH publique (`~/.ssh/id_ed25519.pub` ou `~/.ssh/id_rsa.pub`)

## Déploiement en une commande

```bash
cp .env.example .env
# Renseigner les variables ci-dessous
bin/framm bootstrap
```

Le bootstrap enchaîne automatiquement :

1. Terraform (VMs, S3, DNS, secrets, `env.production`)
2. Attente DNS Scaleway si la zone n'est pas encore active
3. Recréation des VMs si SSH indisponible (injection clé cloud-init)
4. Déploiement Docker sur les 2 VMs (app, mail, observability)
5. HTTPS via Let's Encrypt (ACME, gratuit)
6. Health check

### Variables `.env` obligatoires

| Variable | Description |
|----------|-------------|
| `SCW_ACCESS_KEY` | Clé API Scaleway |
| `SCW_SECRET_KEY` | Secret API Scaleway |
| `SCW_PROJECT_ID` | ID projet Scaleway |
| `ADMIN_PASSWORD` | Mot de passe admin bureau |
| `BUREAU_ADMIN_EMAIL` | Email du compte bureau |

### Variables `.env` optionnelles

| Variable | Description |
|----------|-------------|
| `SSH_PUBLIC_KEY` | Clé SSH (auto-détectée depuis `~/.ssh/` si absente) |
| `DNS_ENABLED` | `true` pour forcer le DNS (auto-détecté sinon) |
| `APP_BZH_ENABLED` | `true` pour activer `app.bzh` |

### HTTPS

Certificats émis automatiquement via **Let's Encrypt** (gratuit, protocole ACME). Aucun compte à créer : certbot s'inscrit tout seul avec l'email `BUREAU_ADMIN_EMAIL`. Renouvellement automatique sur les VMs.

## GitOps (déploiement applicatif)

Chaque **push sur `main`** (ou `master`) déclenche automatiquement le déploiement prod via **GitHub Actions** (`.github/workflows/deploy.yml`) :

1. `test-web` — lint + build Next.js
2. `deploy-prod` — rsync + Docker sur les VMs (même logique que `bin/framm deploy`)

Avant chaque build, le script monte automatiquement le **volume bloc Scaleway** (20 Go) sur `/var/lib/docker`, nettoie le cache Docker et vérifie l'espace disque disponible.

### Secrets GitHub requis

**Settings → Secrets and variables → Actions** :

| Secret | Description |
|--------|-------------|
| `SSH_PRIVATE_KEY` | Clé privée SSH (paire de la clé injectée dans les VMs) |
| `APP_PUBLIC_IP` | IP VM App (`terraform output -raw app_public_ip`) |
| `MAIL_PUBLIC_IP` | IP VM Mail (`terraform output -raw mail_public_ip`) |

L'infra (Terraform, DNS, HTTPS initial) reste sur `bin/framm bootstrap` en local. Les mises à jour applicatives passent par Git.

## Commandes CLI

| Commande | Description |
|----------|-------------|
| `bin/framm bootstrap` | Déploiement complet (infra + apps + HTTPS) |
| `bin/framm deploy` | Met à jour l'application manuellement (hors CI) |
| `bin/framm status` | Vérifie la santé des services |
| `bin/framm setup-tls` | Renouvelle / configure les certificats HTTPS |
| `bin/framm enable-dns` | Active les records DNS |
| `bin/framm wait-dns` | Attend l'activation registrar puis applique le DNS |
| `bin/framm enable-app-bzh` | Active le domaine app.bzh |

## Observabilité

- Grafana : `https://grafana.kod-digor.bzh`
- Alertes envoyées à l'email défini dans `BUREAU_ADMIN_EMAIL`

## Licence

Ce projet est distribué sous licence [CeCILL v2.1](http://www.cecill.info/licences/Licence_CeCILL_V2.1-fr.html).

Copyright © Association Kod Digor. Voir le fichier [LICENSE](LICENSE).
