#!/usr/bin/env python3
"""Configure STAR's first-party Telegram webhook from iSH without storing bot secrets."""
import getpass
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import warnings

STAR_WEBHOOK = "https://star-cyber-ai-x.pages.dev/api/telegram/webhook"
TOKEN_PATTERN = re.compile(r"^[0-9]+:[A-Za-z0-9_-]{30,}$")
SECRET_PATTERN = re.compile(r"^[A-Za-z0-9_-]{32,256}$")


class SetupError(Exception):
    pass


def secret_input(variable, title):
    value = os.environ.get(variable, "")
    if value:
        return value.strip()
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", getpass.GetPassWarning)
            return getpass.getpass(title).strip()
    except (EOFError, OSError, getpass.GetPassWarning) as exc:
        raise SetupError("Use iSH interactively with a terminal; secret input is unavailable.") from exc


def read_bot_token():
    token = secret_input("TELEGRAM_BOT_TOKEN", "Telegram BotFather token (hidden): ")
    if not TOKEN_PATTERN.fullmatch(token):
        raise SetupError("Invalid BotFather token format.")
    return token


def telegram_request(token, method, params=None, transport=None):
    if not re.fullmatch(r"[A-Za-z]{3,32}", method):
        raise SetupError("Invalid Telegram method.")
    api_url = "https://api.telegram.org/bot" + token + "/" + method
    data = urllib.parse.urlencode(params).encode() if params is not None else None
    request = urllib.request.Request(api_url, data=data, method="POST" if data is not None else "GET")
    request.add_header("Accept", "application/json")
    if transport is None:
        transport = urllib.request.urlopen
    try:
        with transport(request, timeout=18) as response:
            payload = json.loads(response.read(150_000))
    except urllib.error.HTTPError as exc:
        # Do not print exception details: the exception URL includes the bot token.
        raise SetupError("Telegram API rejected the request (HTTP " + str(exc.code) + ").") from None
    except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError):
        raise SetupError("Unable to contact Telegram Bot API.") from None
    if not isinstance(payload, dict) or payload.get("ok") is not True:
        raise SetupError("Telegram API returned an unsuccessful result.")
    return payload.get("result")


def webhook_probe(transport=None):
    request = urllib.request.Request(
        STAR_WEBHOOK, data=b"{}", method="POST",
        headers={"Content-Type": "application/json"}
    )
    if transport is None:
        transport = urllib.request.urlopen
    try:
        with transport(request, timeout=15) as response:
            return response.status, response.headers.get("Content-Type", "")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.headers.get("Content-Type", "")
    except (urllib.error.URLError, TimeoutError):
        raise SetupError("STAR Cloudflare endpoint cannot be reached.") from None


def require_configured_webhook(transport=None):
    status, content_type = webhook_probe(transport)
    if status == 401:
        return True
    if status == 503:
        raise SetupError(
            "Cloudflare webhook is NOT configured: set TELEGRAM_BOT_TOKEN, "
            "TELEGRAM_WEBHOOK_SECRET and TELEGRAM_ALLOWED_CHAT_IDS in Pages Production, "
            "then redeploy."
        )
    if status in (301, 302, 303, 307, 308, 403) or (status == 200 and "text/html" in content_type):
        raise SetupError(
            "STAR webhook may be blocked by Cloudflare Access. Allow Telegram's request "
            "to reach only /api/telegram/webhook; STAR still validates its secret header."
        )
    raise SetupError("Unexpected webhook response status: " + str(status))


def status(token, transport=None):
    result = telegram_request(token, "getWebhookInfo", transport=transport)
    if not isinstance(result, dict):
        raise SetupError("Telegram returned invalid webhook info.")
    data = {
        "url": result.get("url") or "(not installed)",
        "pending_updates": result.get("pending_update_count"),
        "last_error": (result.get("last_error_message") or "")[:200],
    }
    return data


def private_chat_ids(token, transport=None):
    info = status(token, transport)
    if info["url"] != "(not installed)":
        raise SetupError("A webhook is already active; getUpdates cannot run. Use 'status'.")
    updates = telegram_request(token, "getUpdates", {"limit": 30, "timeout": 0}, transport)
    ids = set()
    if isinstance(updates, list):
        for update in updates:
            msg = update.get("message") if isinstance(update, dict) else None
            chat = msg.get("chat") if isinstance(msg, dict) else None
            if isinstance(chat, dict) and chat.get("type") == "private":
                ident = chat.get("id")
                if isinstance(ident, int) and ident > 0:
                    ids.add(str(ident))
    return sorted(ids)


def register_webhook(token, secret, transport=None):
    if not SECRET_PATTERN.fullmatch(secret):
        raise SetupError("Webhook secret must be 32–256 characters: letters, digits, _ or -.")
    require_configured_webhook(transport)
    result = telegram_request(
        token, "setWebhook",
        {"url": STAR_WEBHOOK, "secret_token": secret, "allowed_updates": '["message"]'},
        transport
    )
    if result is not True:
        raise SetupError("Telegram did not confirm webhook registration.")
    return True


def main(args):
    if not args or args[0] in ("help", "--help", "-h"):
        print("""STAR Telegram from iSH
  python3 scripts/ish/telegram.py check-star
  python3 scripts/ish/telegram.py bot-info
  python3 scripts/ish/telegram.py chat-id
  python3 scripts/ish/telegram.py set-webhook
  python3 scripts/ish/telegram.py status

Setup order:
1. Create a Telegram bot via @BotFather; privately send /start to your bot.
2. Before setting a webhook, run 'chat-id' and copy your own numeric ID.
3. In Cloudflare Pages -> star-cyber-ai-x -> Production Variables and Secrets:
   TELEGRAM_BOT_TOKEN (encrypted secret)
   TELEGRAM_WEBHOOK_SECRET (encrypted secret; 32-256 safe characters)
   TELEGRAM_ALLOWED_CHAT_IDS (your numeric ID)
   STAR_AI_PROVIDER=cloudflare (or your already-working backend)
   Redeploy Pages so the secrets are available to the Function.
4. Run 'check-star' (must return unauthorized=401), then 'set-webhook'.
5. Run 'status', then ask your bot /start and a question.

The token is requested privately and never saved into project files.
Do not run another polling process using the same bot token with STAR webhook.
""")
        return 0
    command = args[0]
    if command == "check-star":
        require_configured_webhook()
        print("[OK] STAR Telegram route reachable; missing secret header rejected (401).")
        return 0
    if command not in ("bot-info", "chat-id", "status", "set-webhook"):
        raise SetupError("Unknown operation. Use 'help'.")
    token = read_bot_token()
    if command == "bot-info":
        identity = telegram_request(token, "getMe")
        print("[OK] Bot: @" + str(identity.get("username", "?")))
    elif command == "chat-id":
        ids = private_chat_ids(token)
        if ids:
            print("Private Telegram Chat ID(s): " + ", ".join(ids))
        else:
            print("No private messages yet: open the bot in Telegram, send /start, and retry.")
    elif command == "status":
        print(json.dumps(status(token), ensure_ascii=False, indent=2))
    else:
        secret = secret_input("TELEGRAM_WEBHOOK_SECRET", "Cloudflare webhook secret (hidden): ")
        register_webhook(token, secret)
        print("[OK] Telegram webhook installed: " + STAR_WEBHOOK)
        print("Send /start to the bot, then a question; check 'status' for delivery errors.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except SetupError as exc:
        print("[STAR TELEGRAM] " + str(exc), file=sys.stderr)
        raise SystemExit(1) from None
