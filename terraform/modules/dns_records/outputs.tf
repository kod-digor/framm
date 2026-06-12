output "record_ids" {
  value = [for r in scaleway_domain_record.this : r.id]
}
