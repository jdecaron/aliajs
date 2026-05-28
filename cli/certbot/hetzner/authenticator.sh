#!/bin/bash

# https://certbot.eff.org/docs/using.html#pre-and-post-validation-hooks

RECORD_ID=$(curl -s -X POST "https://api.hetzner.cloud/v1/zones/$ZONE/rrsets" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"type":"TXT","name":"'_acme-challenge'","records": [{"value": "\"'$CERTBOT_VALIDATION'\""}],"ttl":120}' \ | python3 -c "import sys,json;print(json.load(sys.stdin)['rrset']['name'])")

if [ ! -d /tmp/CERTBOT_$CERTBOT_DOMAIN ];then
  mkdir -m 0700 /tmp/CERTBOT_$CERTBOT_DOMAIN
fi
echo $RECORD_ID > /tmp/CERTBOT_$CERTBOT_DOMAIN/RECORD_ID

sleep 25
