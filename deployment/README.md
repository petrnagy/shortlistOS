# Production deployment

Production uses one immutable application image for the web process, Web
Clipper API, and four workers. Compose runs each process in its own container.
PostgreSQL and Redis have persistent volumes and no host port exposure. Only
the web and clipper services bind to loopback for the host nginx proxy.

## One-time VPS installation

1. Create `/opt/shortlistos`, copy `compose.yml` there, and create
   `/opt/shortlistos/.env` from `.env.production.example`. Set every required
   application secret. `POSTGRES_URL` must use the Compose hostname `postgres`.
2. Install `server/deploy.sh` as `/usr/local/sbin/shortlistos-deploy` and
   `server/ssh-command.sh` as
   `/usr/local/sbin/shortlistos-ssh-command`, both owned by root and mode 755.
3. Create an unprivileged `shortlist-deploy` account with no password. Do not
   add it to the `docker` group.
4. Give that account passwordless sudo access only to the SSH wrapper:

   ```text
   Defaults!/usr/local/sbin/shortlistos-ssh-command env_keep += "SSH_ORIGINAL_COMMAND"
   shortlist-deploy ALL=(root) NOPASSWD: /usr/local/sbin/shortlistos-ssh-command
   ```

5. Put the GitHub deployment public key in the account's `authorized_keys`:

   ```text
   restrict,command="sudo -n /usr/local/sbin/shortlistos-ssh-command" ssh-ed25519 PUBLIC_KEY
   ```

6. Install `nginx/shortlistos.conf` as a native nginx virtual host. Place a
   Cloudflare Origin CA certificate covering `shortlistos.co` and
   `*.shortlistos.co` at the paths referenced by the file, run `nginx -t`, and
   reload nginx. Configure the three DNS records as proxied and use Cloudflare
   SSL mode **Full (strict)**.

## GitHub configuration

Create a public-repository environment named `production`, restricted to the
`main` branch, with these secrets:

- `DEPLOY_HOST`
- `DEPLOY_PORT`
- `DEPLOY_USER` (`shortlist-deploy`)
- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_HOST_KEY` (a complete known_hosts line captured out of band)

Create a repository variable named `PRODUCTION_DEPLOYMENTS_ENABLED` with the
value `false` for the initial release. Automatic deployments require it to be
exactly `true`; manual `workflow_dispatch` deployments remain available while
the gate is disabled. Set it to `true` only after the first manual production
deployment has passed its smoke tests.

Protect `main` against direct pushes and require both jobs from the `CI`
workflow. CI runs linting, type checking, unit tests, translation verification,
and both production image builds for every pull request targeting `dev` or
`main`.

Production images are published only after a pull request targeting `main` is
closed as merged and its source branch starts with `release/` or `hotfix/`.
Open or updated pull requests cannot publish or deploy images. The manual
workflow accepts only a full commit SHA already contained in `main`.

While automatic deployment remains gated off, deploy a verified release by
running `Build and deploy production` manually with the full resulting `main`
SHA. Set the repository variable to `true` only after production smoke,
recovery, and rollback checks pass.

The GitHub packages `petrnagy/shortlistos` and
`petrnagy/shortlistos-migrate` must be public so the VPS can pull without a
registry credential.

## Public routes

- `shortlistos.co` proxies to `127.0.0.1:3000`, including Stripe endpoints.
- `api.shortlistos.co` proxies to the Web Clipper API on `127.0.0.1:3010`.
- `hooks.shortlistos.co` allows only
  `POST /api/shortlist_magic_inbox/incoming_webhook`.
- `/api/shortlist_magic_clip` is explicitly returned as 404 by nginx.
- `/api/partner/webhook` remains in the application but is also returned as
  404 by nginx.
