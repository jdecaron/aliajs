#!/bin/bash
# https://community.hetzner.com/tutorials/letsencrypt-dns
# https://certbot.eff.org/docs/using.html#pre-and-post-validation-hooks

domain_name="$( echo $CERTBOT_DOMAIN | rev | cut -d'.' -f 1,2 | rev)"
subdomain=".${CERTBOT_DOMAIN%.$domain_name}"
if [ "$CERTBOT_DOMAIN" = "$domain_name" ]; then
  subdomain=""
fi

# Create or append TXT record for DNS-01 challenge
curl "https://api.hetzner.cloud/v1/zones/${domain_name}/rrsets/_acme-challenge${subdomain}/TXT/actions/add_records" \
     -X POST \
     -H "Authorization: Bearer ${API_KEY}" \
     -H "Content-Type: application/json" \
     -d "{
    \"ttl\":300,
    \"records\":[{\"value\":\"\\\"${CERTBOT_VALIDATION}\\\"\"}] }" > /dev/null 2>/dev/null

sleep 30
