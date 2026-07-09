#!/bin/bash
set -e
apt update
apt install -y ca-certificates curl git jq
if ! id -u deployer >/dev/null 2>&1; then
  useradd -m -s /bin/bash deployer
fi
# Idempotent: startup-script re-runs on every boot (not just first create), and a `reset`
# (unlike a full recreate) keeps the boot disk — so this directory already exists on any
# boot after the first. A plain `git clone` would fail into a non-empty dir and, with `set -e`,
# silently kill everything below it (.env fetch, Ops Agent) on every reset/reboot.
if [ -d /home/deployer/flash-sale/.git ]; then
  cd /home/deployer/flash-sale
  git pull
else
  git clone https://github.com/denleonchev/flash-sale.git /home/deployer/flash-sale
  cd /home/deployer/flash-sale
fi

# Add Docker's official GPG key:
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt update

apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker deployer
chown -R deployer:deployer /home/deployer/flash-sale

# .env survives VM recreation without ever passing through Terraform state (which is
# committed to this repo): the value is pushed straight into Secret Manager via
# `gcloud secrets versions add`, and fetched here on every boot using the VM's own identity.
PROJECT_ID=$(curl -sf -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/project/project-id")
ACCESS_TOKEN=$(curl -sf -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" \
  | jq -r .access_token)
curl -sf -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/flash-sale-env/versions/latest:access" \
  | jq -r .payload.data | base64 -d > /home/deployer/flash-sale/.env
chown deployer:deployer /home/deployer/flash-sale/.env
chmod 600 /home/deployer/flash-sale/.env

# Ops Agent: ships container logs to Cloud Logging and host metrics (incl. RAM/disk, which
# GCE does not expose agentlessly) to Cloud Monitoring. Config comes from instance metadata
# so it can be reviewed/versioned in this repo instead of hand-edited on the VM.
curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
bash add-google-cloud-ops-agent-repo.sh --also-install
mkdir -p /etc/google-cloud-ops-agent
curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/attributes/ops-agent-config" \
  -o /etc/google-cloud-ops-agent/config.yaml
systemctl restart google-cloud-ops-agent
