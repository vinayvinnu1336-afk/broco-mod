#!/usr/bin/env bash
# ==============================================================================
# BroCo - paste the keys for Google Maps, Razorpay, email (ZeptoMail), SMS and
# WhatsApp (Gupshup) into /opt/broco-mod/.env and restart the API.
#
#   sudo bash /opt/broco-mod/scripts/deploy/set-keys.sh                 # asks, one integration at a time
#   sudo bash /opt/broco-mod/scripts/deploy/set-keys.sh KEY=value ...   # no questions, e.g.
#        sudo bash set-keys.sh RAZORPAY_KEY_ID=rzp_live_xxx RAZORPAY_KEY_SECRET=yyy
#
# Options:  --no-restart     only edit .env, do not restart the API
#           --env-file PATH  edit another file (default: /opt/broco-mod/.env)
#           --show           only print which integrations are configured
#           --lib            define the functions only (used by the tests)
#
# Blank answer = keep the current value. Secrets are typed without being shown.
# .env is backed up first (.env.bak-YYYYmmdd-HHMMSS); other lines and comments are kept.
# Giving Razorpay keys also sets PAYMENT_PROVIDER=Razorpay; Gupshup SMS / WhatsApp credentials also set
# SMS_PROVIDER / WHATSAPP_PROVIDER=Gupshup. Guide: docs/integrations-setup.md
# ==============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"

# Every setting this script knows, in the order it asks. SECRET ones are read without echo and never printed.
INTEGRATION_KEYS=(
    GOOGLE_MAPS_BROWSER_KEY GOOGLE_MAPS_SERVER_KEY
    PAYMENT_PROVIDER RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET
    ZEPTOMAIL_API_TOKEN ZEPTOMAIL_API_HOST EMAIL_FROM_ADDRESS EMAIL_FROM_NAME
    SMS_PROVIDER GUPSHUP_SMS_USERID GUPSHUP_SMS_PASSWORD SMS_SENDER_ID DLT_ENTITY_ID
    DLT_TEMPLATE_OTP DLT_TEMPLATE_BOOKING DLT_TEMPLATE_QUOTE DLT_TEMPLATE_PAYMENT DLT_TEMPLATE_COMMISSION_REMINDER
    WHATSAPP_PROVIDER GUPSHUP_WA_API_KEY GUPSHUP_WA_SOURCE_NUMBER GUPSHUP_WA_APP_NAME WA_TEMPLATE_OTP
)
SECRET_KEYS=" GOOGLE_MAPS_SERVER_KEY RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET ZEPTOMAIL_API_TOKEN GUPSHUP_SMS_PASSWORD GUPSHUP_WA_API_KEY "

is_secret() { [[ "$SECRET_KEYS" == *" $1 "* ]]; }
is_known() { local k; for k in "${INTEGRATION_KEYS[@]}"; do [[ "$k" == "$1" ]] && return 0; done; return 1; }

say()  { printf '%s\n' "$*"; }
warn() { printf '[warning] %s\n' "$*" >&2; }
die()  { printf '[error] %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- .env editing

# Value of KEY in FILE (last active line wins), without quotes or a trailing " # comment".
env_get() {
    local file="$1" key="$2" line value
    [[ -f "$file" ]] || return 0
    line="$(grep -E "^[[:space:]]*${key}=" "$file" 2>/dev/null | tail -n1 || true)"
    [[ -n "$line" ]] || return 0
    value="${line#*=}"
    value="${value%$'\r'}"
    if [[ "$value" == \'* ]]; then
        value="${value#\'}"; value="${value%%\'*}"
    elif [[ "$value" == \"* ]]; then
        value="${value#\"}"; value="${value%\"*}"
        value="${value//\\\"/\"}"; value="${value//\$\$/\$}"; value="${value//\\\\/\\}"
    else
        value="$(printf '%s' "$value" | sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]+$//')"
    fi
    printf '%s' "$value"
}

# How VALUE is written: bare when it only has safe characters, otherwise in single quotes (docker compose reads
# single-quoted values literally, so a "$" in a secret is never expanded), or double quotes if it has a "'".
env_format() {
    local value="$1"
    if [[ -z "$value" || "$value" =~ ^[A-Za-z0-9_./:@+=,-]+$ ]]; then
        printf '%s' "$value"
    elif [[ "$value" != *"'"* ]]; then
        printf "'%s'" "$value"
    else
        value="${value//\\/\\\\}"; value="${value//\"/\\\"}"; value="${value//\$/\$\$}"
        printf '"%s"' "$value"
    fi
}

# Sets KEY=VALUE in FILE: replaces the active line (keeping its trailing comment), or uncomments a
# "# KEY=" placeholder line, or appends at the end. Every other line is left exactly as it was.
env_set() {
    local file="$1" key="$2" value="$3" formatted tmp
    [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || die "Not a valid setting name: $key"
    [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || die "$key: the value must be on one line"
    [[ -f "$file" ]] || : > "$file"
    formatted="$(env_format "$value")"
    tmp="$(mktemp "$(dirname "$file")/.env.tmp.XXXXXX")"
    KEY="$key" VAL="$formatted" COMMENT_RE="[[:space:]]+#[^'\"]*\$" awk '
        BEGIN { key = ENVIRON["KEY"]; val = ENVIRON["VAL"]; commentRe = ENVIRON["COMMENT_RE"]; done = 0; placeholder = 0; crlf = 0 }
        {
            line = $0; cr = ""
            if (sub(/\r$/, "", line)) { cr = "\r"; crlf = 1 }
            lines[NR] = line; crs[NR] = cr
            if (match(line, "^[ \t]*" key "=")) last = NR
            else if (!placeholder && match(line, "^[ \t]*#[ \t]*" key "=")) placeholder = NR
        }
        END {
            target = last ? last : placeholder
            for (i = 1; i <= NR; i++) {
                if (i == target) {
                    comment = ""
                    rest = lines[i]; sub("^[ \t]*#?[ \t]*" key "=", "", rest)
                    if (match(rest, commentRe)) comment = substr(rest, RSTART)
                    printf "%s=%s%s%s\n", key, val, comment, crs[i]
                    done = 1
                } else {
                    printf "%s%s\n", lines[i], crs[i]
                }
            }
            if (!done) printf "%s=%s%s\n", key, val, (crlf ? "\r" : "")
        }' "$file" > "$tmp"
    chmod --reference="$file" "$tmp" 2>/dev/null || chmod 600 "$tmp"
    chown --reference="$file" "$tmp" 2>/dev/null || true
    mv -f "$tmp" "$file"
}

BACKED_UP=""
backup_env() {
    [[ -n "$BACKED_UP" || ! -f "$ENV_FILE" ]] && return 0
    BACKED_UP="$ENV_FILE.bak-$(date +%Y%m%d-%H%M%S)"
    cp -p "$ENV_FILE" "$BACKED_UP"
    chmod 600 "$BACKED_UP" 2>/dev/null || true
}

CHANGED=()
# Sets KEY to VALUE when it differs from the current value (backing up .env first).
apply() {
    local key="$1" value="$2" current
    current="$(env_get "$ENV_FILE" "$key")"
    [[ "$current" == "$value" ]] && return 0
    backup_env
    env_set "$ENV_FILE" "$key" "$value"
    CHANGED+=("$key")
}

# Turns the provider switches on when their credentials were given in this run.
switch_providers() {
    local given=" $* "
    if [[ "$given" == *" RAZORPAY_KEY_ID "* || "$given" == *" RAZORPAY_KEY_SECRET "* ]] \
        && [[ -n "$(env_get "$ENV_FILE" RAZORPAY_KEY_ID)" && -n "$(env_get "$ENV_FILE" RAZORPAY_KEY_SECRET)" ]] \
        && [[ "$given" != *" PAYMENT_PROVIDER "* ]]; then
        apply PAYMENT_PROVIDER Razorpay
    fi
    if [[ "$given" == *" GUPSHUP_SMS_USERID "* || "$given" == *" GUPSHUP_SMS_PASSWORD "* ]] \
        && [[ -n "$(env_get "$ENV_FILE" GUPSHUP_SMS_USERID)" && -n "$(env_get "$ENV_FILE" GUPSHUP_SMS_PASSWORD)" ]] \
        && [[ "$given" != *" SMS_PROVIDER "* ]]; then
        apply SMS_PROVIDER Gupshup
    fi
    if [[ "$given" == *" GUPSHUP_WA_API_KEY "* || "$given" == *" GUPSHUP_WA_SOURCE_NUMBER "* ]] \
        && [[ -n "$(env_get "$ENV_FILE" GUPSHUP_WA_API_KEY)" && -n "$(env_get "$ENV_FILE" GUPSHUP_WA_SOURCE_NUMBER)" ]] \
        && [[ "$given" != *" WHATSAPP_PROVIDER "* ]]; then
        apply WHATSAPP_PROVIDER Gupshup
    fi
}

# ---------------------------------------------------------------- summary

has() { [[ -n "$(env_get "$ENV_FILE" "$1")" ]]; }
mark() { if has "$1"; then printf 'set'; else printf 'EMPTY'; fi; }

print_summary() {
    local v mode
    say ""
    say "Integrations in $ENV_FILE"
    say "-------------------------------------------------------------"
    if has GOOGLE_MAPS_BROWSER_KEY && has GOOGLE_MAPS_SERVER_KEY; then v="configured"
    elif has GOOGLE_MAPS_BROWSER_KEY || has GOOGLE_MAPS_SERVER_KEY; then v="partly configured"
    else v="not configured (booking works without a map)"; fi
    printf '  %-12s %s  [browser key %s, server key %s]\n' "Google Maps" "$v" "$(mark GOOGLE_MAPS_BROWSER_KEY)" "$(mark GOOGLE_MAPS_SERVER_KEY)"

    v="$(env_get "$ENV_FILE" PAYMENT_PROVIDER)"
    mode="$(env_get "$ENV_FILE" RAZORPAY_KEY_ID)"
    case "$mode" in rzp_live_*) mode="LIVE - real money" ;; rzp_test_*) mode="test mode" ;; "") mode="no key" ;; *) mode="key id looks wrong" ;; esac
    if [[ "${v,,}" == "razorpay" ]]; then
        if has RAZORPAY_KEY_ID && has RAZORPAY_KEY_SECRET; then
            printf '  %-12s configured, %s  [webhook secret %s]\n' "Razorpay" "$mode" "$(mark RAZORPAY_WEBHOOK_SECRET)"
        else
            printf '  %-12s ERROR: PAYMENT_PROVIDER=Razorpay but key id/secret missing - the API will not start\n' "Razorpay"
        fi
    else
        printf '  %-12s not configured (PAYMENT_PROVIDER=%s)\n' "Razorpay" "${v:-DevelopmentFake}"
    fi

    if has ZEPTOMAIL_API_TOKEN; then
        printf '  %-12s configured, from %s via %s\n' "Email" "$(env_get "$ENV_FILE" EMAIL_FROM_ADDRESS || true)" "$(env_get "$ENV_FILE" ZEPTOMAIL_API_HOST || true)"
    else
        printf '  %-12s not configured\n' "Email"
    fi

    v="$(env_get "$ENV_FILE" SMS_PROVIDER)"
    if [[ "${v,,}" == "gupshup" || ( -z "$v" && -n "$(env_get "$ENV_FILE" GUPSHUP_SMS_USERID)" && -n "$(env_get "$ENV_FILE" GUPSHUP_SMS_PASSWORD)" ) ]]; then
        local missing=() k
        for k in GUPSHUP_SMS_USERID GUPSHUP_SMS_PASSWORD SMS_SENDER_ID DLT_ENTITY_ID DLT_TEMPLATE_OTP; do has "$k" || missing+=("$k"); done
        if [[ ${#missing[@]} -eq 0 ]]; then
            printf '  %-12s configured, sender %s  [templates: booking %s, quote %s, payment %s, commission %s]\n' "SMS" \
                "$(env_get "$ENV_FILE" SMS_SENDER_ID)" "$(mark DLT_TEMPLATE_BOOKING)" "$(mark DLT_TEMPLATE_QUOTE)" "$(mark DLT_TEMPLATE_PAYMENT)" "$(mark DLT_TEMPLATE_COMMISSION_REMINDER)"
        else
            printf '  %-12s ERROR: missing %s\n' "SMS" "${missing[*]}"
        fi
    else
        printf '  %-12s not configured\n' "SMS"
    fi

    v="$(env_get "$ENV_FILE" WHATSAPP_PROVIDER)"
    if [[ "${v,,}" == "gupshup" || ( -z "$v" && -n "$(env_get "$ENV_FILE" GUPSHUP_WA_API_KEY)" && -n "$(env_get "$ENV_FILE" GUPSHUP_WA_SOURCE_NUMBER)" ) ]]; then
        local missing=() k
        for k in GUPSHUP_WA_API_KEY GUPSHUP_WA_SOURCE_NUMBER WA_TEMPLATE_OTP; do has "$k" || missing+=("$k"); done
        if [[ ${#missing[@]} -eq 0 ]]; then printf '  %-12s configured (codes go by WhatsApp first, then SMS)\n' "WhatsApp"
        else printf '  %-12s ERROR: missing %s\n' "WhatsApp" "${missing[*]}"; fi
    else
        printf '  %-12s not configured (optional)\n' "WhatsApp"
    fi
    say "-------------------------------------------------------------"
    say "Check them live in Admin -> System health -> Integrations, and use the test buttons there."
}

# ---------------------------------------------------------------- interactive

ask() {
    local key="$1" label="$2" current shown answer
    current="$(env_get "$ENV_FILE" "$key")"
    if is_secret "$key"; then
        shown="$([[ -n "$current" ]] && printf 'set, hidden' || printf 'empty')"
        read -r -s -p "  $label [$key, $shown]: " answer; printf '\n'
    else
        shown="${current:-empty}"
        read -r -p "  $label [$key, now: $shown]: " answer
    fi
    answer="${answer#"${answer%%[![:space:]]*}"}"; answer="${answer%"${answer##*[![:space:]]}"}"
    if [[ -n "$answer" ]]; then
        apply "$key" "$answer"
        GIVEN+=("$key")
    fi
}

section_wanted() {
    local answer
    read -r -p "$1 [y/N]: " answer
    [[ "${answer,,}" == y || "${answer,,}" == yes ]]
}

interactive() {
    say "BroCo keys - press Enter to keep a value as it is. Guide: docs/integrations-setup.md"
    say ""
    if section_wanted "Google Maps keys?"; then
        ask GOOGLE_MAPS_BROWSER_KEY "Browser key (Maps JavaScript + Places, restricted to your domain)"
        ask GOOGLE_MAPS_SERVER_KEY "Server key (Geocoding API, restricted to this server's IP)"
    fi
    if section_wanted "Razorpay keys?"; then
        ask RAZORPAY_KEY_ID "Key id (rzp_test_... or rzp_live_...)"
        ask RAZORPAY_KEY_SECRET "Key secret"
        ask RAZORPAY_WEBHOOK_SECRET "Webhook secret"
    fi
    if section_wanted "Email (ZeptoMail)?"; then
        ask ZEPTOMAIL_API_TOKEN "Send mail token"
        ask ZEPTOMAIL_API_HOST "API host (api.zeptomail.in for India accounts)"
        ask EMAIL_FROM_ADDRESS "From address (on your verified domain)"
        ask EMAIL_FROM_NAME "From name"
    fi
    if section_wanted "SMS (Gupshup, DLT)?"; then
        ask GUPSHUP_SMS_USERID "Gupshup Enterprise user id"
        ask GUPSHUP_SMS_PASSWORD "Gupshup Enterprise password"
        ask SMS_SENDER_ID "Sender id / DLT header (6 letters)"
        ask DLT_ENTITY_ID "DLT principal entity id"
        ask DLT_TEMPLATE_OTP "DLT template id: verification code"
        ask DLT_TEMPLATE_BOOKING "DLT template id: booking confirmed"
        ask DLT_TEMPLATE_QUOTE "DLT template id: quotation ready"
        ask DLT_TEMPLATE_PAYMENT "DLT template id: payment received"
        ask DLT_TEMPLATE_COMMISSION_REMINDER "DLT template id: commission reminder"
    fi
    if section_wanted "WhatsApp (Gupshup)?"; then
        ask GUPSHUP_WA_API_KEY "Gupshup API key"
        ask GUPSHUP_WA_SOURCE_NUMBER "WhatsApp business number (e.g. 919876543210)"
        ask GUPSHUP_WA_APP_NAME "Gupshup app name"
        ask WA_TEMPLATE_OTP "Template id of the approved authentication template"
    fi
}

# ---------------------------------------------------------------- restart

restart_backend() {
    command -v docker >/dev/null 2>&1 || { warn "docker not found - restart the API yourself: cd $APP_DIR && docker compose up -d backend"; return 0; }
    say ""
    say "==> Restarting the API with the new keys (a few seconds)"
    (cd "$APP_DIR" && docker compose up -d backend)
    local i
    for i in $(seq 1 30); do
        if (cd "$APP_DIR" && docker compose exec -T backend curl -fsS http://localhost:5000/healthz/live >/dev/null 2>&1); then
            say "    API is up."
            return 0
        fi
        sleep 2
    done
    warn "The API did not come up within a minute. See why: cd $APP_DIR && docker compose logs --tail=50 backend"
    warn "(A wrong or missing Razorpay key stops it on purpose. Your previous settings: ${BACKED_UP:-unchanged})"
}

main() {
    local restart=1 show_only=0 args=()
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --no-restart) restart=0 ;;
            --env-file) shift; ENV_FILE="${1:?--env-file needs a path}" ;;
            --show) show_only=1 ;;
            -h|--help) sed -n '2,22p' "${BASH_SOURCE[0]}"; exit 0 ;;
            *=*) args+=("$1") ;;
            *) die "Unknown argument: $1 (expected KEY=value)" ;;
        esac
        shift
    done

    [[ -f "$ENV_FILE" ]] || die "No settings file at $ENV_FILE - run scripts/deploy/setup-server.sh first (or pass --env-file)."
    if [[ $show_only -eq 1 ]]; then print_summary; exit 0; fi
    if [[ $restart -eq 1 && "$(id -u)" -ne 0 ]]; then die "Run as root: sudo bash $0 (or add --no-restart)"; fi

    GIVEN=()
    if [[ ${#args[@]} -gt 0 ]]; then
        local pair key value
        for pair in "${args[@]}"; do
            key="${pair%%=*}"; value="${pair#*=}"
            is_known "$key" || warn "$key is not one of the integration settings; writing it anyway."
            apply "$key" "$value"
            GIVEN+=("$key")
        done
    else
        [[ -t 0 ]] || die "No KEY=value arguments and no terminal to ask in."
        interactive
    fi
    switch_providers "${GIVEN[@]:-}"

    if [[ ${#CHANGED[@]} -eq 0 ]]; then
        say ""
        say "Nothing changed."
    else
        say ""
        say "Updated: ${CHANGED[*]}"
        say "Backup of the previous file: $BACKED_UP"
        if [[ $restart -eq 1 ]]; then restart_backend; else say "Not restarted (--no-restart). Apply with: cd $APP_DIR && docker compose up -d backend"; fi
    fi
    print_summary
}

if [[ "${1:-}" == "--lib" ]]; then
    return 0 2>/dev/null || exit 0
fi
main "$@"
