#!/bin/bash

# https://certbot.eff.org/docs/using.html#pre-and-post-validation-hooks

if [ -f /tmp/CERTBOT_$CERTBOT_DOMAIN/RECORD_ID ]; then
  RECORD_ID=$(cat /tmp/CERTBOT_$CERTBOT_DOMAIN/RECORD_ID)
  rm -f /tmp/CERTBOT_$CERTBOT_DOMAIN/RECORD_ID
fi

CF_ZONE_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=$CERTBOT_DOMAIN" \
  -H "Authorization: Bearer ${API_KEY}" | jq -r '.result[0].id')

if [ -n "${RECORD_ID}" ]; then
  curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records/$RECORD_ID" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json"
fi
