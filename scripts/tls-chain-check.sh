#!/usr/bin/env bash
# tls-chain-check.sh — prove whether a host serves a complete TLS certificate chain.
#
# Why this exists: browsers repair an incomplete chain on the fly (they fetch the missing
# intermediate themselves via the certificate's AIA field, and cache intermediates seen
# elsewhere), so "it loads fine in Chrome" is not evidence of anything. Node, Java, Android,
# Go and curl do not do that — they refuse the connection. This script asks the server
# directly and reports what it actually sends.
#
# Usage:  bash scripts/tls-chain-check.sh [host ...]
# Default: the prod API, with staging alongside it for contrast.

set -uo pipefail

HOSTS=("$@")
if [ ${#HOSTS[@]} -eq 0 ]; then
  HOSTS=(attend-backend-prod.experienceattend.com attend-api.schulltech.com)
fi

for HOST in "${HOSTS[@]}"; do
  echo "═══════════════════════════════════════════════════════════════════"
  echo "  $HOST"
  echo "═══════════════════════════════════════════════════════════════════"

  RAW=$(echo | openssl s_client -showcerts -servername "$HOST" -connect "$HOST:443" 2>/dev/null)

  if [ -z "$RAW" ]; then
    echo "  ✗ Could not connect at all (DNS, firewall, or nothing listening on 443)."
    echo
    continue
  fi

  # How many certificates did the server actually send?
  COUNT=$(printf '%s' "$RAW" | grep -c "BEGIN CERTIFICATE")
  VERIFY=$(printf '%s' "$RAW" | grep -m1 "Verify return code:")

  echo "  Certificates sent : $COUNT"
  echo "  ${VERIFY:-Verify return code: (not reported)}"

  # Who issued the leaf, and is that issuer present in what was sent?
  echo
  echo "  Chain as served:"
  printf '%s' "$RAW" | awk '/^ [0-9]+ s:/ {print "    " $0} /^   i:/ {print "    " $0}' | head -20

  # Where it resolves and what is answering — catches "fixed the wrong box" and
  # "TLS is terminated by a load balancer, not by that nginx".
  echo
  IPS=$(dig +short "$HOST" A | tr '\n' ' ')
  echo "  Resolves to       : ${IPS:-(no A record)}"
  SERVER_HDR=$(curl -sS -m 10 -o /dev/null -D - "https://$HOST" -k 2>/dev/null | grep -i "^server:" | head -1 | tr -d '\r')
  echo "  ${SERVER_HDR:-Server: (no header)}"

  # Validity window — a freshly issued certificate that is still not trusted means the
  # renewal happened but the chain file was assembled without the intermediate.
  DATES=$(printf '%s' "$RAW" | openssl x509 -noout -dates 2>/dev/null | tr '\n' ' ')
  echo "  Leaf validity     : ${DATES:-(unreadable)}"

  echo
  if [ "$COUNT" -le 1 ]; then
    echo "  ✗ VERDICT: leaf certificate only — the intermediate is MISSING."
    echo "    nginx is pointing at cert.pem where it needs fullchain.pem (or the file it"
    echo "    points at was assembled without the intermediate appended)."
    echo "    Every non-browser client will refuse this host. Browsers will not."
  elif printf '%s' "$VERIFY" | grep -q "Verify return code: 0"; then
    echo "  ✓ VERDICT: chain is complete and verifies."
  else
    echo "  ⚠ VERDICT: $COUNT certificates sent, but verification still fails."
    echo "    The chain is present but wrong — expired, out of order, or the wrong"
    echo "    intermediate. Read the 'Verify return code' above: 10 = expired,"
    echo "    2 or 20 = issuer not found, 21 = cannot verify the leaf."
  fi
  echo
done

cat <<'NOTE'
───────────────────────────────────────────────────────────────────
For whoever administers the server, two checks that take seconds:

  nginx -T | grep -n ssl_certificate        # every block, and which file each uses
  openssl crl2pkcs7 -nocrl -certfile /path/to/that/file.pem \
    | openssl pkcs7 -print_certs -noout | grep -c 'subject='

The second counts the certificates inside the file nginx is serving. It must be
2 or more. If it prints 1, that file is the leaf alone no matter what it is named,
and the fix is to point at fullchain.pem or append the CA's intermediate to it.

Then: nginx -t && systemctl reload nginx

Do not verify the result in a browser — browsers hide exactly this fault.
───────────────────────────────────────────────────────────────────
NOTE
