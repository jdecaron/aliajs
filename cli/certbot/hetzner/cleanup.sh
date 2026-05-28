#!/bin/bash

# https://certbot.eff.org/docs/using.html#pre-and-post-validation-hooks

if [ -f /tmp/CERTBOT_$CERTBOT_DOMAIN/RECORD_ID ]; then
  RECORD_ID=$(cat /tmp/CERTBOT_$CERTBOT_DOMAIN/RECORD_ID)
  rm -f /tmp/CERTBOT_$CERTBOT_DOMAIN/RECORD_ID
fi

if [ -n "${RECORD_ID}" ]; then
  curl -s -X DELETE "https://api.hetzner.cloud/v1/zones/$ZONE/rrsets/$RECORD_ID/TXT" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json"
fi
