resource "random_password" "auth_secret" {
  length  = 64
  special = false
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "random_password" "grafana_password" {
  length  = 24
  special = true
}

resource "random_password" "stalwart_api_key" {
  length  = 48
  special = false
}

resource "random_password" "bulwark_session_secret" {
  length  = 64
  special = false
}
