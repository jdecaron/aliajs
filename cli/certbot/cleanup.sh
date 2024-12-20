#!/bin/bash

# https://certbot.eff.org/docs/using.html#pre-and-post-validation-hooks

if [ -f /tmp/CERTBOT_$CERTBOT_DOMAIN/RECORD_ID ]; then
  RECORD_ID=$(cat /tmp/CERTBOT_$CERTBOT_DOMAIN/RECORD_ID)
  rm -f /tmp/CERTBOT_$CERTBOT_DOMAIN/RECORD_ID
fi

if [ -n "${RECORD_ID}" ]; then
  curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/84f030b8865f04484b14f533770df715/dns_records/$RECORD_ID" \
    -H "Authorization: Bearer $CF_API_KEY" \
    -H "Content-Type: application/json"
fi
