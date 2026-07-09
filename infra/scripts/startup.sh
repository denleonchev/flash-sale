#!/bin/bash
set -e
apt update
apt install -y ca-certificates curl git
if ! id -u deployer >/dev/null 2>&1; then
  useradd -m -s /bin/bash deployer
fi
git clone https://github.com/denleonchev/flash-sale.git /home/deployer/flash-sale
cd /home/deployer/flash-sale

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
