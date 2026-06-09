#!/bin/bash
# https://community.hetzner.com/tutorials/letsencrypt-dns
# https://certbot.eff.org/docs/using.html#pre-and-post-validation-hooks

domain_name="$( echo $CERTBOT_DOMAIN | rev | cut -d'.' -f 1,2 | rev)"
subdomain=".${CERTBOT_DOMAIN%.$domain_name}"
if [ "$CERTBOT_DOMAIN" = "$domain_name" ]; then
  subdomain=""
fi

curl "https://api.hetzner.cloud/v1/zones/${domain_name}/rrsets/_acme-challenge${subdomain}/TXT" \
     -X "DELETE" \
     -H "Authorization: Bearer ${API_KEY}" >/dev/null 2>/dev/null
