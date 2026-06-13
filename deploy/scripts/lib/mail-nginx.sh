#!/usr/bin/env bash
# Rendu nginx mail : TLS par vhost si certificat présent, sinon HTTP (ACME + proxy).
# Sourcer sur la VM mail après source env.production.

framm_mail_le_dir() {
  local host="$1" domain="$2"
  echo "/etc/letsencrypt/live/${host}.${domain}"
}

framm_mail_has_cert() {
  local host="$1" domain="$2"
  [[ -f "$(framm_mail_le_dir "$host" "$domain")/fullchain.pem" ]]
}

framm_mail_write_nginx_site() {
  local domain="${1:?domain requis}"
  local out="${2:-/etc/nginx/sites-available/framm-mail}"
  local webmail_ssl mail_ssl

  webmail_ssl=false
  mail_ssl=false
  framm_mail_has_cert webmail "$domain" && webmail_ssl=true
  framm_mail_has_cert mail "$domain" && mail_ssl=true

  mkdir -p /var/www/acme
  : > "$out"

  if $webmail_ssl; then
    cat >> "$out" <<EOF
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name webmail.${domain};

    ssl_certificate     /etc/letsencrypt/live/webmail.${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/webmail.${domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

EOF
  fi

  if $mail_ssl; then
    cat >> "$out" <<EOF
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name mail.${domain};

    ssl_certificate     /etc/letsencrypt/live/mail.${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mail.${domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

EOF
  fi

  cat >> "$out" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name webmail.${domain};

    location /.well-known/acme-challenge/ {
        root /var/www/acme;
    }

    location / {
EOF
  if $webmail_ssl; then
    cat >> "$out" <<'EOF'
        return 301 https://$host$request_uri;
    }
}

EOF
  else
    cat >> "$out" <<'EOF'
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

EOF
  fi

  cat >> "$out" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name mail.${domain};

    location /.well-known/acme-challenge/ {
        root /var/www/acme;
    }

    location / {
EOF
  if $mail_ssl; then
    cat >> "$out" <<'EOF'
        return 301 https://$host$request_uri;
    }
}

EOF
  else
    cat >> "$out" <<'EOF'
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

EOF
  fi
}

framm_mail_obtain_missing_certs() {
  local domain="${1:?}"
  local email="${2:-}"
  local domains=() d

  framm_mail_has_cert webmail "$domain" || domains+=("webmail.${domain}")
  framm_mail_has_cert mail "$domain" || domains+=("mail.${domain}")

  [[ ${#domains[@]} -eq 0 ]] && return 0
  if [[ -z "$email" ]]; then
    echo "Certificats manquants (${domains[*]}) — BUREAU_ADMIN_EMAIL absent, ACME ignoré" >&2
    return 0
  fi

  mkdir -p /var/www/acme
  local args=()
  for d in "${domains[@]}"; do
    args+=(-d "$d")
  done

  echo "ACME : tentative certificats pour ${domains[*]}..."
  if certbot certonly --non-interactive --agree-tos --email "$email" \
    --server https://acme-v02.api.letsencrypt.org/directory \
    --webroot -w /var/www/acme "${args[@]}"; then
    echo "ACME : certificats obtenus"
    return 0
  fi
  echo "AVERTISSEMENT : ACME a échoué — nginx reste en mode HTTP pour les vhosts sans certificat" >&2
  return 0
}

framm_mail_apply_nginx() {
  local domain="${1:?}"
  framm_mail_write_nginx_site "$domain"
  ln -sf /etc/nginx/sites-available/framm-mail /etc/nginx/sites-enabled/framm-mail
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
}
