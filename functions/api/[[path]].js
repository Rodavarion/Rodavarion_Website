import {json,body,now,sha256,randomHex,randomToken,passwordHash,passwordOk,base32,totpOk,userFrom,requireCsrf,audit,sessionCookie,clearCookie} from "../_shared/private-auth.js";
const MAX_DRAFTS=50,MAX_TITLE=16384,MAX_TEXT=524288,MAX_TOTAL=20*1024*1024,MAX_WORKSPACE=65536;
const pathOf=c=>"/api/"+(Array.isArray(c.params.path)?c.params.path.join("/"):c.params.path||"");
const cleanUser=u=>u?{id:u.id,username:u.username,role:u.role,vault_salt:u.vault_salt,csrf:u.csrf}:null;
async function adminExists(db){return !!(await db.prepare("SELECT 1 ok FROM app_users WHERE role='admin' LIMIT 1").first())}
async function docs(db,q=""){
 const like=`%${q}%`;const sql=q?`SELECT id,act_number code,title,act_type kind,status,
 CASE act_type WHEN 'constitution' THEN 1000 WHEN 'code' THEN 800 WHEN 'law' THEN 700 ELSE 400 END rank,
 official_url source_url,adopted_on adoption_date,effective_from current_revision_date,current_revision_id content_hash,1 immutable
 FROM legal_acts WHERE title LIKE ? OR act_number LIKE ? ORDER BY rank DESC,title LIMIT 250`
 :`SELECT id,act_number code,title,act_type kind,status,
 CASE act_type WHEN 'constitution' THEN 1000 WHEN 'code' THEN 800 WHEN 'law' THEN 700 ELSE 400 END rank,
 official_url source_url,adopted_on adoption_date,effective_from current_revision_date,current_revision_id content_hash,1 immutable
 FROM legal_acts ORDER BY rank DESC,title LIMIT 250`;
 const r=q?await db.prepare(sql).bind(like,like).all():await db.prepare(sql).all();return r.results||[];
}
async function getDocument(db,id){
 const a=await db.prepare(`SELECT id,act_number code,title,act_type kind,status,
 CASE act_type WHEN 'constitution' THEN 1000 WHEN 'code' THEN 800 WHEN 'law' THEN 700 ELSE 400 END rank,
 official_url source_url,adopted_on adoption_date,effective_from current_revision_date,current_revision_id content_hash,1 immutable
 FROM legal_acts WHERE id=? OR act_number=?`).bind(id,id).first();if(!a)return null;
 const rev=a.content_hash?await db.prepare("SELECT text_plain,source_hash FROM act_revisions WHERE id=?").bind(a.content_hash).first():null;
 a.text=rev?.text_plain||"";a.content_hash=rev?.source_hash||a.content_hash||"";return a;
}
export async function onRequest(context){
 const {request,env}=context,db=env.TLAW_DB,p=pathOf(context),method=request.method,user=await userFrom(request,db);
 if(method==="GET"&&p==="/api/health")return json({ok:true,version:"3.2.0-rc2",uiFoundation:"1.0.6",admin_configured:await adminExists(db),core:{ok:true}});
 if(method==="GET"&&p==="/api/setup/status")return json({admin_configured:await adminExists(db)});
 if(method==="GET"&&p==="/api/session")return json({authenticated:!!user,user:cleanUser(user)});
 if(method==="GET"&&p==="/api/documents"){const q=new URL(request.url).searchParams.get("q")||"";return json(await docs(db,q))}
 if(method==="GET"&&p.startsWith("/api/documents/")){const d=await getDocument(db,decodeURIComponent(p.slice(15)));return d?json(d):json({error:"not found"},404)}
 if(method==="GET"&&p==="/api/versions"){const r=await db.prepare(`SELECT r.id,r.act_id document_id,a.title,a.adopted_on adoption_date,
 a.effective_from latest_revision_date,a.official_url latest_source_url,r.valid_from revision_date,a.status,
 r.source_url,r.source_url version_source_url,r.source_hash content_hash,strftime('%s',r.created_at) imported_at,
 CASE WHEN a.current_revision_id=r.id THEN 1 ELSE 0 END is_latest
 FROM act_revisions r JOIN legal_acts a ON a.id=r.act_id ORDER BY a.title,r.revision_number DESC LIMIT 1000`).all();return json(r.results||[])}
 if(method==="GET"&&p==="/api/sources"){const r=await db.prepare("SELECT id,url,label,enabled,created_at FROM app_trusted_sources ORDER BY id").all();return json(r.results||[])}
 if(method==="GET"&&p==="/api/workspace"){if(!user)return json({error:"Не авторизовано"},401);const r=await db.prepare("SELECT state_json FROM app_workspace WHERE user_id=?").bind(user.id).first();return json({state:r?JSON.parse(r.state_json):{}})}
 if(method==="GET"&&p==="/api/drafts"){if(!user)return json({error:"Потрібен вхід."},401);const r=await db.prepare("SELECT id,title_cipher,text_cipher,iv_title,iv_text,updated_at,created_at FROM app_drafts WHERE user_id=? ORDER BY updated_at DESC").bind(user.id).all();return json(r.results||[])}
 if(method==="GET"&&p==="/api/account/usage"){if(!user)return json({error:"Потрібен вхід."},401);const r=await db.prepare("SELECT COUNT(*) drafts,COALESCE(SUM(LENGTH(title_cipher)+LENGTH(text_cipher)+LENGTH(iv_title)+LENGTH(iv_text)),0) bytes FROM app_drafts WHERE user_id=?").bind(user.id).first();return json({...r,draft_limit:MAX_DRAFTS,byte_limit:MAX_TOTAL,per_draft_limit:MAX_TEXT})}
 if(method==="GET"&&p==="/api/admin/users"){if(!user||user.role!=="admin")return json({error:"Лише адміністратор."},403);const r=await db.prepare("SELECT id,username,role,active,created_at,last_login FROM app_users ORDER BY id").all();return json(r.results||[])}
 if(method==="GET"&&p==="/api/admin/audit"){if(!user||user.role!=="admin")return json({error:"Лише адміністратор."},403);const r=await db.prepare(`SELECT a.id,a.event,a.details,a.created_at,u.username FROM app_audit a LEFT JOIN app_users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200`).all();return json(r.results||[])}
 if(method!=="POST")return json({error:"not found"},404);
 const x=await body(request),t=now();
 if(p==="/api/setup/admin/start"){
  const username=String(x.username||"").replace(/[^a-zA-Z0-9_.-]/g,"").slice(0,40),password=String(x.password||""),th=await sha256(String(x.token||""));
  if(username.length<3||password.length<12)return json({error:"Логін від 3 символів, пароль адміністратора від 12."},400);
  if(await adminExists(db))return json({error:"Адміністратора вже створено."},409);
  const row=await db.prepare("SELECT * FROM app_admin_bootstrap WHERE token_hash=? AND expires_at>?").bind(th,t).first();
  if(!row)return json({error:"Код активації недійсний або прострочений."},403);
  const secretBytes=crypto.getRandomValues(new Uint8Array(20)),secret=base32(secretBytes),vault=randomHex(16);
  const codes=[],hashes=[];for(let i=0;i<10;i++){const c=`${randomHex(2)}-${randomHex(2)}-${randomHex(2)}`.toUpperCase();codes.push(c);hashes.push(await sha256(c))}
  await db.prepare("UPDATE app_admin_bootstrap SET username=?,password_hash=?,vault_salt=?,totp_secret=?,backup_hashes=? WHERE token_hash=?").bind(username,await passwordHash(password),vault,secret,JSON.stringify(hashes),th).run();
  const issuer=encodeURIComponent("Rodavarion TLAW"),account=encodeURIComponent(username),uri=`otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;
  return json({ok:true,totp_secret:secret,otpauth_uri:uri,backup_codes:codes});
 }
 if(p==="/api/setup/admin/confirm"){
  const th=await sha256(String(x.token||""));if(await adminExists(db))return json({error:"Адміністратора вже створено."},409);
  const row=await db.prepare("SELECT * FROM app_admin_bootstrap WHERE token_hash=? AND expires_at>?").bind(th,t).first();
  if(!row?.username||!row?.totp_secret)return json({error:"Спочатку задайте облікові дані адміністратора."},409);
  if(!await totpOk(row.totp_secret,String(x.otp||"")))return json({error:"Неправильний код 2FA."},403);
  const ins=await db.prepare("INSERT INTO app_users(username,password_hash,role,vault_salt,created_at) VALUES(?,?,?,?,?)").bind(row.username,row.password_hash,"admin",row.vault_salt,t).run();
  const uid=ins.meta.last_row_id;await db.prepare("INSERT INTO app_admin_mfa(user_id,totp_secret,backup_hashes,created_at) VALUES(?,?,?,?)").bind(uid,row.totp_secret,row.backup_hashes,t).run();
  await db.prepare("DELETE FROM app_admin_bootstrap").run();await audit(db,"admin_initialized",{username:row.username},uid);return json({ok:true});
 }
 if(p==="/api/register"){
  const username=String(x.username||"").replace(/[^a-zA-Z0-9_.-]/g,"").slice(0,40),password=String(x.password||"");
  if(username.length<3||password.length<8)return json({error:"Логін від 3 символів, пароль від 8."},400);
  try{await db.prepare("INSERT INTO app_users(username,password_hash,role,vault_salt,created_at) VALUES(?,?,?,?,?)").bind(username,await passwordHash(password),"client",randomHex(16),t).run()}catch{return json({error:"Такий користувач уже існує."},409)}
  await audit(db,"user_registered",{username});return json({ok:true});
 }
 if(p==="/api/login"){
  const r=await db.prepare("SELECT * FROM app_users WHERE username=?").bind(String(x.username||"")).first();
  if(!r||!r.active||!await passwordOk(String(x.password||""),r.password_hash))return json({error:"Невірний логін або пароль."},403);
  if(r.role==="admin"){
   const m=await db.prepare("SELECT * FROM app_admin_mfa WHERE user_id=? AND enabled=1").bind(r.id).first();if(!m)return json({error:"2FA адміністратора не налаштовано."},403);
   const code=String(x.otp||"").trim().toUpperCase();let hashes=JSON.parse(m.backup_hashes||"[]"),used=null;
   if(!await totpOk(m.totp_secret,code)){const h=await sha256(code);if(hashes.includes(h))used=h;else return json({error:"Неправильний код 2FA або резервний код."},403)}
   if(used){hashes=hashes.filter(v=>v!==used);await db.prepare("UPDATE app_admin_mfa SET backup_hashes=? WHERE user_id=?").bind(JSON.stringify(hashes),r.id).run()}
  }
  const token=randomToken(32),csrf=randomToken(20),remember=!!x.remember&&r.role==="client",maxAge=remember?2592000:43200;
  await db.prepare("DELETE FROM app_sessions WHERE expires_at<?").bind(t).run();await db.prepare("INSERT INTO app_sessions(token_hash,user_id,csrf,expires_at,created_at) VALUES(?,?,?,?,?)").bind(await sha256(token),r.id,csrf,t+maxAge,t).run();
  await db.prepare("UPDATE app_users SET last_login=? WHERE id=?").bind(t,r.id).run();await audit(db,"login",{remember_device:remember},r.id);
  return json({ok:true,user:{id:r.id,username:r.username,role:r.role,vault_salt:r.vault_salt,csrf}},200,{"set-cookie":sessionCookie(token,maxAge)});
 }
 if(p==="/api/logout"){if(user){const token=(request.headers.get("cookie")||"").match(/(?:^|;\s*)tlaw_session=([^;]+)/)?.[1]||"";await db.prepare("DELETE FROM app_sessions WHERE token_hash=?").bind(await sha256(token)).run();await audit(db,"logout",{},user.id)}return json({ok:true},200,{"set-cookie":clearCookie()})}
 if(!user)return json({error:"Потрібен вхід."},401);
 if(!requireCsrf(user,x))return json({error:"Недійсний токен запиту."},403);
 if(p==="/api/workspace"){
  const state=x.state&&typeof x.state==="object"?x.state:{},raw=JSON.stringify(state);if(new TextEncoder().encode(raw).length>MAX_WORKSPACE)return json({error:"Налаштування робочого місця завеликі."},413);
  await db.prepare(`INSERT INTO app_workspace(user_id,state_json,updated_at) VALUES(?,?,?)
   ON CONFLICT(user_id) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at`).bind(user.id,raw,t).run();return json({ok:true});
 }
 if(p==="/api/drafts"){
  const vals=["title_cipher","text_cipher","iv_title","iv_text"].map(k=>String(x[k]||""));
  if(vals[0].length>MAX_TITLE||vals[1].length>MAX_TEXT||vals[2].length>256||vals[3].length>256)return json({error:"Чернетка завелика."},413);
  const usage=await db.prepare("SELECT COUNT(*) n,COALESCE(SUM(LENGTH(title_cipher)+LENGTH(text_cipher)+LENGTH(iv_title)+LENGTH(iv_text)),0) bytes FROM app_drafts WHERE user_id=?").bind(user.id).first();
  let old=0;if(x.id){const d=await db.prepare("SELECT LENGTH(title_cipher)+LENGTH(text_cipher)+LENGTH(iv_title)+LENGTH(iv_text) n FROM app_drafts WHERE id=? AND user_id=?").bind(Number(x.id),user.id).first();if(!d)return json({error:"Чернетку не знайдено."},404);old=d.n||0}else if(usage.n>=MAX_DRAFTS)return json({error:"Досягнуто ліміт 50 чернеток."},413);
  const size=vals.reduce((a,v)=>a+new TextEncoder().encode(v).length,0);if(usage.bytes-old+size>MAX_TOTAL)return json({error:"Досягнуто сумарний ліміт кабінету 20 МіБ."},413);
  let id=x.id;if(id)await db.prepare("UPDATE app_drafts SET title_cipher=?,text_cipher=?,iv_title=?,iv_text=?,updated_at=? WHERE id=? AND user_id=?").bind(...vals,t,Number(id),user.id).run();
  else{id=(await db.prepare("INSERT INTO app_drafts(user_id,title_cipher,text_cipher,iv_title,iv_text,updated_at,created_at) VALUES(?,?,?,?,?,?,?)").bind(user.id,...vals,t,t).run()).meta.last_row_id}
  await audit(db,"draft_saved",{draft_id:id,encrypted_bytes:size},user.id);return json({ok:true,id});
 }
 if(p==="/api/drafts/delete"){await db.prepare("DELETE FROM app_drafts WHERE id=? AND user_id=?").bind(Number(x.id||0),user.id).run();await audit(db,"draft_deleted",{draft_id:x.id},user.id);return json({ok:true})}
 if(p==="/api/admin/user-toggle"){if(user.role!=="admin")return json({error:"Лише адміністратор."},403);const uid=Number(x.user_id),active=x.active?1:0;if(uid===user.id&&!active)return json({error:"Не можна вимкнути власний обліковий запис."},400);await db.prepare("UPDATE app_users SET active=? WHERE id=?").bind(active,uid).run();await audit(db,"user_toggle",{user_id:uid,active},user.id);return json({ok:true})}
 if(p==="/api/analyze"){
  const text=String(x.text||"").trim();return json({summary:text?`Локальний аналіз отримав ${text.length} символів.`:"Текст не надано.",findings:[],military:!!x.military,engine:"pages-native-compatibility"});
 }
 return json({error:"not found"},404);
}
