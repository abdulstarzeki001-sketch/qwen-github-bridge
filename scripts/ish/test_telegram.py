import importlib.util
import io
import json
import os
import urllib.error
import unittest
from pathlib import Path
from unittest.mock import patch

path=Path("scripts/ish/telegram.py")
spec=importlib.util.spec_from_file_location("star_telegram_ish",path)
bot=importlib.util.module_from_spec(spec)
spec.loader.exec_module(bot)

class DummyResponse:
    def __init__(self,status=200,body=None,content_type="application/json"):
        self.status=status
        self.payload=body if body is not None else {"ok":True,"result":True}
        self.headers={"Content-Type":content_type}
    def read(self,maxbytes=999999): return json.dumps(self.payload).encode()
    def __enter__(self): return self
    def __exit__(self,*args): return False

class StarTelegramTest(unittest.TestCase):
    def setUp(self):
        self.token="123456789:"+ "A"*37
        self.secret="x"*48
        self.calls=[]
    def transport(self,request,timeout=15):
        self.calls.append(request)
        url=request.full_url
        if url.endswith("/getWebhookInfo"):
            return DummyResponse(body={"ok":True,"result":{"url":"","pending_update_count":0}})
        if url.endswith("/getUpdates"):
            return DummyResponse(body={"ok":True,"result":[
                {"message":{"chat":{"id":123456789,"type":"private"}}},
                {"message":{"chat":{"id":987654321,"type":"group"}}}
            ]})
        if url.endswith("/getMe"):
            return DummyResponse(body={"ok":True,"result":{"username":"testbot"}})
        if url.endswith("/setWebhook"):
            return DummyResponse(body={"ok":True,"result":True})
        if url==bot.STAR_WEBHOOK:
            raise urllib.error.HTTPError(url,401,"Unauthorized",{},None)
        raise AssertionError("unexpected URL")
    def test_get_private_id(self):
        self.assertEqual(bot.private_chat_ids(self.token,self.transport),["123456789"])
        self.assertEqual(len(self.calls),2)
    def test_webhook_registration(self):
        self.assertTrue(bot.register_webhook(self.token,self.secret,self.transport))
        self.assertEqual(len(self.calls),2)
        self.assertEqual(self.calls[1].get_method(),"POST")
        self.assertIn(b"secret_token="+self.secret.encode(),self.calls[1].data)
        self.assertIn(b"allowed_updates=",self.calls[1].data)
        self.assertNotIn(self.secret,bot.STAR_WEBHOOK)
    def test_wrong_secret_rejected_before_network(self):
        with self.assertRaisesRegex(bot.SetupError,"Webhook secret"):
            bot.register_webhook(self.token,"bad",self.transport)
        self.assertFalse(self.calls)
    def test_503_detects_unconfigured_cloudflare(self):
        def unavailable(request,timeout=15):
            raise urllib.error.HTTPError(request.full_url,503,"Not configured",{},None)
        with self.assertRaisesRegex(bot.SetupError,"NOT configured"):
            bot.require_configured_webhook(unavailable)
    def test_public_access_login_detected(self):
        def access_redirect(request,timeout=15):
            return DummyResponse(status=200,body={},content_type="text/html")
        with self.assertRaisesRegex(bot.SetupError,"Cloudflare Access"):
            bot.require_configured_webhook(access_redirect)
    def test_token_not_in_http_error_message(self):
        def forbidden(request,timeout=15):
            raise urllib.error.HTTPError(request.full_url,401,"bad token "+self.token,{},None)
        with self.assertRaises(bot.SetupError) as ctx:
            bot.telegram_request(self.token,"getMe",transport=forbidden)
        self.assertNotIn(self.token,str(ctx.exception))
    def test_existing_webhook_prevents_long_polling(self):
        def active(request,timeout=15):
            return DummyResponse(body={"ok":True,"result":{"url":bot.STAR_WEBHOOK}})
        with self.assertRaisesRegex(bot.SetupError,"already active"):
            bot.private_chat_ids(self.token,active)
    def test_unrecognized_method_not_called(self):
        with self.assertRaisesRegex(bot.SetupError,"Invalid Telegram method"):
            bot.telegram_request(self.token,"../../escape",transport=self.transport)
        self.assertFalse(self.calls)
    def test_getpass_no_echo_fallback(self):
        with patch.dict(os.environ,{"TELEGRAM_BOT_TOKEN":self.token}):
            self.assertEqual(bot.read_bot_token(),self.token)

if __name__=="__main__":unittest.main()
