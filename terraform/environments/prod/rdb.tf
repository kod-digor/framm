# PostgreSQL managée : sauvegardes automatiques quotidiennes (rétention 30 j,
# copie hors région), remplace le conteneur postgres de la VM App pour
# l'app déployée sur Kapsule.
# - Kapsule : réseau privé (K8S_DATABASE_URL)
# - Dev local : endpoint public TLS + ACL IP (DEV_DATABASE_URL, sans tunnel)

resource "random_password" "rdb_password" {
  length           = 32
  special          = true
  override_special = "!@#$%&*-_=+"
}

resource "scaleway_rdb_instance" "main" {
  name      = "framm-${var.environment}"
  node_type = var.rdb_node_type
  engine    = "PostgreSQL-16"
  region    = var.scw_region

  is_ha_cluster = var.rdb_ha

  disable_backup            = false
  backup_schedule_frequency = 24
  backup_schedule_retention = 30
  backup_same_region        = false

  user_name = "framm"
  password  = random_password.rdb_password.result

  private_network {
    pn_id       = scaleway_vpc_private_network.framm.id
    enable_ipam = true
  }

  # Endpoint public (load balancer) pour dev local direct — restreint par scaleway_rdb_acl
  load_balancer {}

  tags = ["framm"]
}

resource "scaleway_rdb_acl" "main" {
  count       = length(local.rdb_acl_ips) > 0 ? 1 : 0
  instance_id = scaleway_rdb_instance.main.id

  dynamic "acl_rules" {
    for_each = local.rdb_acl_ips
    content {
      ip          = acl_rules.value
      description = "Framm dev/admin"
    }
  }

  depends_on = [scaleway_rdb_instance.main]
}

resource "scaleway_rdb_database" "framm" {
  instance_id = scaleway_rdb_instance.main.id
  name        = "framm"
}

resource "scaleway_rdb_privilege" "framm" {
  instance_id   = scaleway_rdb_instance.main.id
  user_name     = scaleway_rdb_instance.main.user_name
  database_name = scaleway_rdb_database.framm.name
  permission    = "all"
}
