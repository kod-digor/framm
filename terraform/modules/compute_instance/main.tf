resource "scaleway_instance_ip" "this" {
  zone = var.zone
}

resource "scaleway_instance_security_group" "this" {
  name                    = "${var.name}-sg"
  zone                    = var.zone
  inbound_default_policy  = "drop"
  outbound_default_policy = "accept"

  dynamic "inbound_rule" {
    for_each = toset(var.inbound_ports)
    content {
      action   = "accept"
      port     = inbound_rule.value
      protocol = "TCP"
    }
  }

  dynamic "inbound_rule" {
    for_each = toset(var.admin_ips)
    content {
      action   = "accept"
      ip_range = "${inbound_rule.value}/32"
      protocol = "ANY"
    }
  }
}

resource "scaleway_block_volume" "this" {
  name       = "${var.name}-data"
  size_in_gb = var.volume_size_gb
  iops       = 5000
  zone       = var.zone
}

resource "scaleway_instance_server" "this" {
  name  = var.name
  type  = var.instance_type
  image = var.image_id
  zone  = var.zone

  ip_id = scaleway_instance_ip.this.id
  security_group_id = scaleway_instance_security_group.this.id

  user_data = {
    cloud-init = var.cloud_init
  }

  additional_volume_ids = [scaleway_block_volume.this.id]

  tags = length(var.tags) > 0 ? var.tags : ["framm"]

  lifecycle {
    ignore_changes = [image]
  }
}
