# AliaJS

> **Warning**
>
> This project is in early alpha.

Atwood's Law:
> “Any application that can be written in JavaScript, will eventually be written in JavaScript.” - [Jeff Atwood](https://blog.codinghorror.com/about-me/)

AliaJS: Atwood's Law Infrastructure as JavaScript

If you or your team care about JavaScript, then maybe AliaJS is a solution for your infrastructure orchestration.

AliaJS is to [Node.js](https://nodejs.org/en) as [Capistrano](https://capistranorb.com) is to [Ruby on Rails](https://rubyonrails.org).

## What AliaJS is:
- Infrastructure orchestrator designed for small operation-infrastructure teams that want to use JavaScript as their definition & execution language.
- Designed with architecture and code simplicity. AliaJS takes HTTP as an input & can talk HTTP as a first-class citizen. It's an Express.js service that runs shell commands & Node.js code.
- All-in-one solution to manage the service infrastructure, including the secret vault integration, monitoring & alerting.
- NGINX-oriented.

# What AliaJS is not:
- Tool for big operation-infrastructure teams.
- Project that is well supported by a community.
- Something that is perfect, AliaJS is aligned with the [wabi-sabi ](https://en.wikipedia.org/wiki/Wabi-sabi) way.

## Architecture
[./src/app.js](./src/app.js), [./src/main.js](./src/main.js) & [./src/routes.js](./src/routes.js): Main Express.js files that define the server.

[./src/deploy.js](./src/deploy.js): Update a service that is up and running.  
[./src/new-image.js](./src/new-image.js): Create & keep updated the EC2 virtual machines according to the scheduled job (104 lines).  
[./src/new-instance.js](./src/new-instance.js): Create new instances according to its definition in [./configurations/instances.js](./configurations/instances.js) (302 lines).  
[./src/renew-certificates.js](./src/renew-certificates.js): Create & keep updated the SSL certificates (46 lines).  

[./src/items.js](./src/items.js), vault management utils.js(152 lines).  
[./src/logger.js](./src/logger.js), [utils.js](utils.js): Util code used by the project (200 lines).

[./templates](./templates): Where the EJS templates files are.  
[./configurations](./configurations): Where the instance & image configuration definitions are.

## Getting started
Changing the values in [.env](.env)

Setup your environment variables according to the Bitwarden vault.

```bash
npm install
npm run dev
```

## Usage
`$ALIAJS_AUTHORIZATION` must be defined in your shell environment.

**Updating running services:**
```bash
curl -v -N --header "Authorization: ${ALIAJS_AUTHORIZATION}" "https://aliajs-production.rotat.io/deploy?checkout=${CHECKOUT}&service_name=aliajs&tier=production"
```

**Starting new EC2 instances:**
```bash
curl -v -N --header "Authorization: ${ALIAJS_AUTHORIZATION}" "https://aliajs-production.rotat.io/new-instance?address=1.1.1.1&checkout=${CHECKOUT}&instance_name=aliajs-production&replace=false"
```
`address`, default `undefined`: possible values: `allocate`, `ip`: examples `address=allocate` `address=1.1.1.1`: address=allocate will request a permanent IP from AWS and associate it to the new instance.
`replace`, default `false`: will replace the current running instance.
