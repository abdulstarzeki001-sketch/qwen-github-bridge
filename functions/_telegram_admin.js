// STAR NEXUS owner-only Telegram provisioning.
// Telegram API credentials are read inside Cloudflare Pages Functions only;
// never expose bot token, webhook secret, chat IDs or untrusted Telegram error bodies.
import {telegramConfigured} from "./_nexus_telegram.js";

const TARGET="https://star-cyber-ai-x.pages.dev/api/telegram/webhook";
const EXPECTED_BOT="aistar0017616bot";
const BOT_METHODS=new Set(["getMe","setWebhook","getWebhookInfo"]);

async function telegramApi(env,method,params={},upstreamFetch=fetch){
  if(!BOT_METHODS.has(method))throw Error("Invalid Telegram API method");
  const response=await upstreamFetch("https://api.telegram.org/bot"+env.TELEGRAM_BOT_TOKEN+"/"+method,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(params),
    signal:AbortSignal.timeout(12000)
  });
  // Only use Telegram's HTTP status; never expose its error text or token-bearing URL.
  if(!response.ok)throw Error("Telegram API unavailable (HTTP "+response.status+")");
  const result=await response.json();
  if(!result||result.ok!==true)throw Error("Telegram API rejected the request");
  return result.result;
}

export async function telegramOwnerStatus(env,{upstreamFetch=fetch}={}){
  if(!telegramConfigured(env))return {
    ok:true,configured:false,connected:false,reason:"Missing or invalid Cloudflare Telegram variables"
  };
  const info=await telegramApi(env,"getWebhookInfo",{},upstreamFetch);
  return {
    ok:true,configured:true,
    connected:info?.url===TARGET,
    webhook_url:info?.url===TARGET?TARGET:null,
    registered_elsewhere:Boolean(info?.url&&info.url!==TARGET),
    pending_updates:Number.isSafeInteger(info?.pending_update_count)?info.pending_update_count:null,
    last_error_date:Number.isSafeInteger(info?.last_error_date)?info.last_error_date:null,
    // Avoid returning upstream error messages: Telegram may include user-controlled data.
  };
}

export async function telegramOwnerConnect(env,{upstreamFetch=fetch}={}){
  if(!telegramConfigured(env))return {
    ok:false,configured:false,connected:false,
    error:"Configure TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, and TELEGRAM_ALLOWED_CHAT_IDS in Cloudflare Production and redeploy."
  };
  const bot=await telegramApi(env,"getMe",{},upstreamFetch);
  if(bot?.is_bot!==true||String(bot.username||"").toLowerCase()!==EXPECTED_BOT)
    throw Error("The Cloudflare BotFather token does not belong to @Aistar0017616bot");
  const applied=await telegramApi(env,"setWebhook",{
    url:TARGET,secret_token:env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates:["message"],drop_pending_updates:false
  },upstreamFetch);
  if(applied!==true)throw Error("Telegram did not confirm webhook setup");
  const status=await telegramOwnerStatus(env,{upstreamFetch});
  if(!status.connected)throw Error("Telegram did not report the expected STAR webhook");
  return {...status,bot_username:"@Aistar0017616bot"};
}

export const STAR_TELEGRAM_WEBHOOK=TARGET;
