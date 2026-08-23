export const domains = [
  { "host": process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN, "cloud": "hetzner", "mode": "dns", "domains": [ process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN, `*.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}` ] },
]
