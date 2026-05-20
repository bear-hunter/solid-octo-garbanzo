# Full Stack Run Guide

Copy/paste these commands from the repository root:

```bash
cd /Users/karlromero/personal/solid-octo-garbanzo

# 1) Install dependencies if needed
pnpm install

# 2) Start IPFS in Docker
pnpm ipfs
```

Open a second terminal:

```bash
cd /Users/karlromero/personal/solid-octo-garbanzo

# 3) Start the local Hardhat chain
pnpm chain
```

Open a third terminal:

```bash
cd /Users/karlromero/personal/solid-octo-garbanzo

# 4) Deploy contracts to the local chain
pnpm run deploy

# 5) Start the web app
pnpm dev
```

Then open:

```text
http://localhost:3000
```

## Quick smoke test

1. Go to `http://localhost:3000/issuer`.
2. Click **Load Presentation Records**.
3. Go to `http://localhost:3000/verify`.
4. Paste a credential ID payload, for example:

```json
{"id":"<credential-id>"}
```

5. Expect a valid verification result with score `100`.
6. Click **Demo: Verify Tampered Copy** and expect a tampered result.
7. Go to `/holder`, mint a verifier link, and open it.

## One-shot background startup

If you want to start everything in the background from one terminal:

```bash
cd /Users/karlromero/personal/solid-octo-garbanzo
mkdir -p .logs

docker compose up -d ipfs
pnpm chain > .logs/chain.log 2>&1 & echo $! > .logs/chain.pid
sleep 5
pnpm run deploy > .logs/deploy.log 2>&1
pnpm dev > .logs/web.log 2>&1 & echo $! > .logs/web.pid
```

Check status:

```bash
lsof -nP -iTCP:3000 -iTCP:8545 -iTCP:5001 -iTCP:8080 -sTCP:LISTEN
docker compose ps
```

Stop background stack:

```bash
kill $(cat .logs/web.pid) $(cat .logs/chain.pid) 2>/dev/null || true
docker compose stop ipfs
```

## Expected ports

- Web app: `http://localhost:3000`
- Hardhat RPC: `http://127.0.0.1:8545`
- IPFS API: `http://localhost:5001`
- IPFS Gateway: `http://localhost:8080`
