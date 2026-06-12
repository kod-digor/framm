output "public_ip" {
  value = scaleway_instance_ip.this.address
}

output "server_id" {
  value = scaleway_instance_server.this.id
}

output "volume_id" {
  value = scaleway_block_volume.this.id
}
