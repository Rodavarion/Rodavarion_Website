const enc=new TextEncoder();
export function json(data,status=200,headers={}){
 return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
}
export async function body(request){try{return await request.json()}catch{return {}}}
export function now(){return Math.floor(Date.now()/1000)}
export function cookieMap(request){
 const out={}; for(const part of (request.headers.get("cookie")||"").split(";")){const i=part.indexOf("=");if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim()} return out;
}
export function bytesToHex(a){return [...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,"0")).join("")}
export function hexToBytes(s){return new Uint8Array((s.match(/../g)||[]).map(x=>parseInt(x,16)))}
export function randomHex(n){const a=new Uint8Array(n);crypto.getRandomValues(a);return bytesToHex(a)}
export function randomToken(n=32){const a=new Uint8Array(n);crypto.getRandomValues(a);return btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
export async function sha256(s){return bytesToHex(await crypto.subtle.digest("SHA-256",enc.encode(String(s))))}
export async function passwordHash(password){
 const iterations=310000,salt=crypto.getRandomValues(new Uint8Array(16));
 const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations},key,256);
 return `pbkdf2-sha256$${iterations}$${bytesToHex(salt)}$${bytesToHex(bits)}`;
}
export async function passwordOk(password,stored){
 try{
  const [kind,it,saltHex,expected]=stored.split("$"); if(kind!=="pbkdf2-sha256")return false;
  const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:hexToBytes(saltHex),iterations:Number(it)},key,256);
  const got=bytesToHex(bits); let diff=got.length^expected.length;for(let i=0;i<Math.min(got.length,expected.length);i++)diff|=got.charCodeAt(i)^expected.charCodeAt(i);return diff===0;
 }catch{return false}
}
const B32="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes){let out="",bits=0,val=0;for(const b of bytes){val=(val<<8)|b;bits+=8;while(bits>=5){out+=B32[(val>>>(bits-5))&31];bits-=5}}if(bits)out+=B32[(val<<(5-bits))&31];return out}
function base32Decode(s){let bits=0,val=0,out=[];for(const ch of s.replace(/=+$/,"").toUpperCase()){const n=B32.indexOf(ch);if(n<0)continue;val=(val<<5)|n;bits+=5;if(bits>=8){out.push((val>>>(bits-8))&255);bits-=8}}return new Uint8Array(out)}
async function totpAt(secret,seconds){
 const counter=Math.floor(seconds/30),msg=new Uint8Array(8);let x=BigInt(counter);for(let i=7;i>=0;i--){msg[i]=Number(x&255n);x>>=8n}
 const key=await crypto.subtle.importKey("raw",base32Decode(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
 const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,msg)),off=sig[sig.length-1]&15;
 const num=((sig[off]&127)<<24)|(sig[off+1]<<16)|(sig[off+2]<<8)|sig[off+3];
 return String(num%1000000).padStart(6,"0");
}
export async function totpOk(secret,code){const c=String(code).replace(/\D/g,"");if(c.length!==6)return false;const t=Math.floor(Date.now()/1000);for(const d of [-30,0,30])if(await totpAt(secret,t+d)===c)return true;return false}
export async function userFrom(request,db){
 const token=cookieMap(request).tlaw_session;if(!token)return null;const th=await sha256(token),t=now();
 const row=await db.prepare(`SELECT u.id,u.username,u.role,u.vault_salt,u.active,s.csrf,s.expires_at
 FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=?`).bind(th).first();
 if(!row||!row.active||row.expires_at<t)return null;return row;
}
export function requireCsrf(user,payload){return !!user && String(payload.csrf||"")===String(user.csrf||"")}
export async function audit(db,event,details,userId=null){await db.prepare("INSERT INTO app_audit(event,details,user_id,created_at) VALUES(?,?,?,?)").bind(event,JSON.stringify(details||{}),userId,now()).run()}
export function sessionCookie(token,maxAge){return `tlaw_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`}
export function clearCookie(){return "tlaw_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"}
