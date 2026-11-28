#!/bin/bash

# https://certbot.eff.org/docs/using.html#pre-and-post-validation-hooks

DOMAIN_NAME="$( echo $CERTBOT_DOMAIN | rev | cut -d'.' -f 1,2 | rev)"

CF_ZONE_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN_NAME}" \
  -H "Authorization: Bearer ${API_KEY}" | python3 -c "import sys,json;print(json.load(sys.stdin)['result'][0]['id'])")

RECORD_ID=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  --data '{"type":"TXT","name":"'_acme-challenge'","content":"'"$CERTBOT_VALIDATION"'","ttl":120}' \ | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['id'])")

if [ ! -d /tmp/CERTBOT_$CERTBOT_DOMAIN ];then
  mkdir -m 0700 /tmp/CERTBOT_$CERTBOT_DOMAIN
fi
echo $RECORD_ID > /tmp/CERTBOT_$CERTBOT_DOMAIN/RECORD_ID

sleep 25
