#!/bin/sh
# Picks the HTTPS server config when a certificate for $DOMAIN exists, otherwise plain HTTP.
# Runs from the official nginx image's /docker-entrypoint.d/ hook on every container start.
set -eu

DOMAIN="${DOMAIN:-localhost}"
TEMPLATE=/etc/nginx/templates-available/http.conf.template

if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    TEMPLATE=/etc/nginx/templates-available/https.conf.template
    echo "select-config: certificate found for ${DOMAIN}, serving HTTPS"
else
    echo "select-config: no certificate for ${DOMAIN}, serving HTTP only"
fi

# Only substitute ${DOMAIN}; nginx's own $variables must stay untouched.
envsubst '${DOMAIN}' < "$TEMPLATE" > /etc/nginx/conf.d/default.conf
