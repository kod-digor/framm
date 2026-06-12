# PostgreSQL managée : sauvegardes automatiques quotidiennes (rétention 30 j,
# copie hors région), remplace le conteneur postgres de la VM App pour
# l'app déployée sur Kapsule. Accessible uniquement via le réseau privé.

resource "random_password" "rdb_password" {
  length  = 32
  special = false
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

  tags = ["framm"]
}

resource "scaleway_rdb_database" "framm" {
  instance_id = scaleway_rdb_instance.main.id
  name        = "framm"
}
