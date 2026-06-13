# Cluster Kubernetes Kapsule — cible de migration de l'app web.
# Le serveur mail (Stalwart) reste sur sa VM : un serveur mail ne bénéficie
# pas de l'orchestration et la réputation IP doit rester stable.

resource "scaleway_vpc_private_network" "framm" {
  name = "framm-${var.environment}"
}

resource "scaleway_k8s_cluster" "framm" {
  name    = "framm-${var.environment}"
  type    = "kapsule"
  version = var.k8s_version
  cni     = "cilium"

  private_network_id = scaleway_vpc_private_network.framm.id

  # Mises à jour Kubernetes automatiques (dimanche 03h00).
  # Si upgrade mineur manuel (ex. 1.32→1.33 avant EoS) : aligner var.k8s_version puis
  # `scw k8s cluster upgrade <id> version=<x.y.z> upgrade-pools=true -w` ou terraform apply.
  auto_upgrade {
    enable                        = true
    maintenance_window_start_hour = 3
    maintenance_window_day        = "sunday"
  }

  # Sécurité anti-perte : un destroy du cluster ne supprime pas les
  # volumes/load balancers associés.
  delete_additional_resources = false

  tags = ["framm"]
}

resource "scaleway_k8s_pool" "default" {
  cluster_id = scaleway_k8s_cluster.framm.id
  name       = "default"
  node_type  = var.k8s_node_type
  zone       = var.scw_zone

  size        = var.k8s_pool_min
  min_size    = var.k8s_pool_min
  max_size    = var.k8s_pool_max
  autoscaling = true
  autohealing = true

  tags = ["framm"]
}

resource "local_sensitive_file" "kubeconfig" {
  filename        = "${path.module}/../../../deploy/.generated/kubeconfig"
  content         = scaleway_k8s_cluster.framm.kubeconfig[0].config_file
  file_permission = "0600"

  depends_on = [scaleway_k8s_pool.default]
}

# Registre d'images privé — les nœuds Kapsule du même projet y accèdent
# nativement, sans imagePullSecrets.
resource "scaleway_registry_namespace" "framm" {
  name        = var.registry_namespace
  region      = var.scw_region
  project_id  = var.scw_project_id
  is_public   = false
  description = "Images Framm (web, worker)"
}
