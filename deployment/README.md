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

   The main domain is protected with HTTP Basic Authentication. Create its
   root-owned password file interactively so the password is not stored in the
   repository or shell history:

   ```bash
   sudo apt-get install apache2-utils
   sudo htpasswd -c /etc/nginx/.htpasswd-shortlistos shortlistos
   sudo chown root:www-data /etc/nginx/.htpasswd-shortlistos
   sudo chmod 640 /etc/nginx/.htpasswd-shortlistos
   sudo nginx -t
   sudo systemctl reload nginx
   ```

   This authentication applies only to `shortlistos.co`; the Web Clipper API
   and whitelisted Magic Inbox hook remain available on their own subdomains.

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

Protect `main` against direct pushes. Production is built and deployed only
when a merged pull request targets `main` and its source branch starts with
`release/` or `hotfix/`. The manual workflow accepts only a full commit SHA
already contained in `main`.

For the initial promotion from `dev`, run the Translate workflow manually if
the merged pull request does not trigger it. Then run this workflow manually
with the resulting translated `main` SHA. This bootstrap path is expected
while automatic deployment remains gated off.

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
