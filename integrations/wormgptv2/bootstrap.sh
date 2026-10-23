#!/usr/bin/env bash
# From STAR repo root: bash integrations/wormgptv2/bootstrap.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v node >/dev/null || { echo "Install Node.js 22+ first." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required." >&2; exit 1; }
command -v curl >/dev/null || { echo "curl is required." >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "sha256sum is required." >&2; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' || { echo "Requires Node.js >=22" >&2; exit 1; }
mkdir -p .integrations/wormgptv2
tempdir="$(mktemp -d)"
archive="$tempdir/wormgpt-v0.22.0.tgz"
trap 'rm -rf "$tempdir"' EXIT
source_url="https://github.com/WormGPTv2/wormgpt/releases/download/v0.22.0/gitlawb-wormgpt-0.22.0.tgz"
expected_sha256="4b4668f8e00a41fc7780c368a22dfc268dd9cf5aa74dd73230de96ed5093a0fd"
echo "Downloading WormGPTv2 0.22.0 tagged release for verification."
curl --fail --location --silent --show-error --retry 2 --connect-timeout 15 "$source_url" -o "$archive"
echo "$expected_sha256  $archive" | sha256sum -c -
tar -xOzf "$archive" package/package.json | node --input-type=module -e '
let input="";for await(const chunk of process.stdin)input+=chunk;
const p=JSON.parse(input);
if(p.name!=="@gitlawb/wormgpt"||p.version!=="0.22.0"||p.bin?.wormgpt!=="./bin/wormgpt")process.exit(1);
console.log("Package metadata verified:",p.name,p.version);
'
npm install --prefix .integrations/wormgptv2 --ignore-scripts --no-audit --no-fund "$archive"
node .integrations/wormgptv2/node_modules/@gitlawb/wormgpt/dist/cli.mjs --version
echo "WormGPTv2 CLI installed and invoked; a provider is required for actual chat."
