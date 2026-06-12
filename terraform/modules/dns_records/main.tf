resource "scaleway_domain_record" "this" {
  for_each = { for r in var.records : "${r.name}-${r.type}" => r }

  dns_zone = var.zone_name
  name     = each.value.name
  type     = each.value.type
  data     = each.value.data
  ttl      = each.value.ttl
}
