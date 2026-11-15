// Bounded, owner-provided, privacy-filtered conversation context. No server-side persistence.
// Never permit client-supplied system, developer, tool, image or arbitrary role payloads.
const MAX_TURNS=8;
const MAX_TURN_CHARS=1000;
const MAX_TOTAL_CHARS=6000;
export function conversationMessages(body,system,prompt,redact){
  const input=body?.history;
  if(input!==undefined&&!Array.isArray(input))return {error:"history must be an array"};
  if(Array.isArray(input)&&input.length>MAX_TURNS)return {error:"Conversation history is too long (max 8 turns)"};
  let size=0;
  const turns=[];
  for(const turn of input||[]){
    if(!turn||typeof turn!=="object"||Array.isArray(turn)||
       !["user","assistant"].includes(turn.role)||typeof turn.content!=="string"||
       !turn.content.trim()||turn.content.length>MAX_TURN_CHARS)
      return {error:"Invalid history turn"};
    size+=turn.content.length;
    if(size>MAX_TOTAL_CHARS)return {error:"Conversation history exceeds 6000 characters"};
    turns.push({role:turn.role,content:redact(turn.content.trim())});
  }
  // Systems are always chosen by owner policy on the server, never by the user messages.
  const messages=[{role:"system",content:system},...turns,{role:"user",content:redact(prompt)}];
  return {messages,turns};
}
