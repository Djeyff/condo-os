# Condo Manager OS — Deployment Guide

## Quick Deploy Options

### Option 1: Zeabur (Recommended — Easiest)
### Option 2: Docker (Self-hosted)
### Option 3: Manual Install (Any server)

---

## Option 1: Zeabur Deployment

### A) Testing via Service Clone (Fastest — No Reconfiguration)

If you already have a working OpenClaw instance on Zeabur, **don't create a new one**. Clone it:

1. **Go to your Zeabur project dashboard**
2. **Click your OpenClaw service** → **Settings** tab
3. **Scroll to "Backup"** → Click **"Create Backup"**
4. **Create a NEW project** in Zeabur (e.g., "openclaw-test")
5. **In the new project**, click **"Deploy from Backup"** → select the backup you just made
6. ✅ All environment variables (API keys, Notion tokens, model configs) carry over
7. **Your test instance is identical** — same config, same skills, same memory

> **Why this works**: Zeabur backups include the full container state + environment variables. You get a perfect clone without re-entering a single variable.

**Alternative — Fork via Git (if your OpenClaw is deployed from a repo):**
1. Your OpenClaw repo → **Fork** on GitHub
2. Zeabur → New Project → Deploy from your fork
3. **Copy environment variables**: Old service → Settings → Environment Variables → copy each to new service
4. This is slower but gives you a separate Git history

**Alternative — Duplicate Service (simplest):**
1. In your existing Zeabur **project**, click **"+"** → **"Deploy"** → **"From Marketplace"** → OpenClaw
2. Click the new service → **Settings** → **Environment Variables**
3. From your original service, copy-paste all env vars:
   - `ANTHROPIC_API_KEY`
   - `NOTION_API_KEY`  
   - `OPENAI_API_KEY` (if used)
   - Any other keys
4. **Mount the same Git repo** or copy skill files

> ⚠️ This method requires copying env vars but is still faster than starting from scratch.

### B) Fresh Zeabur Deploy for Clients

1. **Zeabur Dashboard** → **New Project**
2. **"+"** → **"Deploy"** → **"Marketplace"** → Search **"OpenClaw"** → Deploy
3. Wait for the container to start (~1 min)
4. **Add Environment Variables** (Settings → Environment Variables):
   ```
   ANTHROPIC_API_KEY = sk-ant-...    (or OPENAI_API_KEY)
   NOTION_API_KEY    = ntn_...
   ```
5. **Connect your chat app** (WhatsApp/Telegram/Discord) — follow OpenClaw docs
6. **SSH into the container** or use Zeabur's terminal:
   ```bash
   # Upload the skill package (or git clone)
   cd /app/skills/  # or wherever OpenClaw loads skills
   
   # Option A: Upload via Zeabur file manager
   # Option B: Git clone from your private repo
   git clone https://github.com/youruser/condo-manager-os.git
   
   # Option C: Download release
   curl -L https://yoursite.com/condo-manager-os-v2.tar.gz | tar xz
   ```
7. **Run the installer:**
   ```bash
   cd condo-manager-os
   chmod +x install.sh
   ./install.sh --notion-key $NOTION_API_KEY
   ```
8. **Restart the service** in Zeabur dashboard

### C) Zeabur Persistent Storage for Backups

Zeabur containers are ephemeral — files disappear on redeploy. For backups:

1. **Add Persistent Volume** in Zeabur:
   - Service → Settings → Volumes
   - Mount path: `/app/backups`
   - This survives redeploys

2. **Set backup dir**:
   ```bash
   export BACKUP_DIR=/app/backups
   ```

3. **For cloud backup** (recommended — data leaves the container):
   ```bash
   # Install rclone in container
   curl https://rclone.org/install.sh | bash
   
   # Configure for kDrive (Infomaniak)
   rclone config
   # Choose: WebDAV
   # URL: https://connect.drive.infomaniak.com
   # Vendor: Other
   # User: your-kdrive-email
   # Password: your-app-password
   # Name it: kdrive
   
   # Test
   rclone ls kdrive:/condo-backups/
   
   # Run backup with cloud upload
   ./scripts/backup-notion.sh --cloud kdrive
   ```

4. **Add to container cron** (via Zeabur "Commands" or entrypoint):
   ```bash
   # In your Dockerfile or startup script:
   echo "0 2 * * * NOTION_API_KEY=$NOTION_API_KEY /app/skills/condo-manager-os/scripts/backup-notion.sh --cloud kdrive >> /var/log/backup.log 2>&1" | crontab -
   ```

---

## Option 2: Docker Deployment

### docker-compose.yml

```yaml
version: '3.8'

services:
  openclaw:
    image: openclaw/openclaw:latest
    container_name: condo-openclaw
    restart: unless-stopped
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - NOTION_API_KEY=${NOTION_API_KEY}
      # Add your chat platform keys
    volumes:
      - ./condo-manager-os:/app/skills/condo-manager-os:ro
      - ./memory:/app/memory
      - ./backups:/app/backups
    ports:
      - "3000:3000"

  # Optional: automated daily backup
  backup:
    image: alpine:latest
    container_name: condo-backup
    restart: unless-stopped
    environment:
      - NOTION_API_KEY=${NOTION_API_KEY}
      - BACKUP_DIR=/backups
    volumes:
      - ./condo-manager-os/scripts:/scripts:ro
      - ./backups:/backups
      - ./memory:/memory:ro
    entrypoint: >
      sh -c "
        apk add --no-cache curl jq bash &&
        echo '0 2 * * * /scripts/backup-notion.sh >> /var/log/backup.log 2>&1' | crontab - &&
        crond -f
      "
```

### .env file
```env
ANTHROPIC_API_KEY=sk-ant-your-key
NOTION_API_KEY=ntn_your-key
```

### Deploy
```bash
# Clone the skill
git clone https://github.com/youruser/condo-manager-os.git

# Start
docker-compose up -d

# Run installer inside container
docker exec -it condo-openclaw bash
cd /app/skills/condo-manager-os
./install.sh --skip-databases  # Create DBs separately or via Notion UI
```

---

## Option 3: Manual Install (Any Server)

```bash
# 1. Install OpenClaw (follow official docs)
npm install -g openclaw
# or
npx openclaw init

# 2. Install Notion skill
npx clawdhub@latest install notion

# 3. Download Condo Manager OS
git clone https://github.com/youruser/condo-manager-os.git
# or extract the .tar.gz

# 4. Run installer
cd condo-manager-os
chmod +x install.sh scripts/*.sh
./install.sh

# 5. Done — message your agent!
```

---

## Cloud Backup Configuration

### Supported Providers (via rclone)

| Provider | rclone Type | Notes |
|----------|------------|-------|
| **Infomaniak kDrive** | WebDAV | `https://connect.drive.infomaniak.com` |
| **Amazon S3** | s3 | Any S3-compatible (Wasabi, DO Spaces, etc.) |
| **Google Drive** | drive | Free 15GB |
| **Dropbox** | dropbox | Free 2GB |
| **OneDrive** | onedrive | Free 5GB |
| **SFTP/SSH** | sftp | Any server with SSH |
| **Backblaze B2** | b2 | Cheapest cloud storage |

### rclone Quick Setup

```bash
# Install
curl https://rclone.org/install.sh | sudo bash

# Configure (interactive)
rclone config

# Test
rclone ls yourremote:condo-backups/

# Manual backup
./scripts/backup-notion.sh --cloud yourremote

# Automated (cron)
echo "0 2 * * * NOTION_API_KEY=ntn_xxx /path/to/backup-notion.sh --cloud yourremote" | crontab -
```

### kDrive Specific Setup (Infomaniak)

```
rclone config
> n                          (new remote)
> Name: kdrive
> Type: webdav
> URL: https://connect.drive.infomaniak.com
> Vendor: other
> User: your@email.com
> Password: (app password from Infomaniak dashboard)
> Bearer token: (leave blank)
```

### Backup Retention

Default: 30 days of local backups. Change via environment:
```bash
export BACKUP_RETAIN=90  # Keep 90 days
```

Each backup is ~1-5 MB (compressed JSON+CSV), so 30 days ≈ 30-150 MB.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NOTION_API_KEY` | ✅ | Notion integration token (`ntn_...`) |
| `ANTHROPIC_API_KEY` | ✅* | Claude API key (if using Claude) |
| `OPENAI_API_KEY` | ✅* | OpenAI key (if using GPT) |
| `BACKUP_DIR` | ❌ | Backup location (default: `~/.condo-backups`) |
| `BACKUP_RETAIN` | ❌ | Days to keep backups (default: 30) |

*At least one AI provider key required.

---

## Troubleshooting

### "Skill not loading"
```bash
# Check skill directory
ls -la /path/to/openclaw/skills/condo-manager-os/SKILL.md
# Must contain SKILL.md at the root of the skill folder
```

### "Notion API errors"
```bash
# Test your key
curl -s https://api.notion.com/v1/users/me \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28"
# Should return your user info, not an error
```

### "Databases not found"
- Make sure you shared the parent page with your integration
- In Notion: Page → **...** → **Connections** → Add your integration
- Each database must also be shared (automatically shared if parent is shared)

### "Backup fails"
```bash
# Test manually
NOTION_API_KEY=ntn_xxx ./scripts/backup-notion.sh
# Check output for specific errors

# Test rclone
rclone ls yourremote:/
```

### "Container resets on Zeabur redeploy"
- Add a Persistent Volume in Zeabur Settings
- Or use cloud backup (rclone) — data lives outside the container
- MEMORY.md should be in a mounted volume or rebuilt from backup
