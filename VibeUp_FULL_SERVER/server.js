const express=require('express');const cors=require('cors');const multer=require('multer');const path=require('path');const fs=require('fs');
const app=express(),PORT=Number(process.env.PORT||3000);const audioDir=path.join(__dirname,'music','audio'),coverDir=path.join(__dirname,'music','covers'),tracksFile=path.join(__dirname,'tracks.json');
const YAPI='https://cloud-api.yandex.net/v1/disk';
const AUDD_TOKEN=process.env.VIBEUP_AUDD_TOKEN||'';const RECOGNIZER_URL=process.env.VIBEUP_RECOGNIZER_URL||'http://127.0.0.1:8765/recognize';const YTOKEN=process.env.VIBEUP_YANDEX_TOKEN||'';const ADMIN_KEY=process.env.VIBEUP_ADMIN_KEY||'';const YROOT='app:/VibeUp';const AI_URL=process.env.VIBEUP_AI_URL||'https://api.openai.com/v1/chat/completions';const AI_MODEL=process.env.VIBEUP_AI_MODEL||'gpt-4o-mini';const AI_KEY=process.env.VIBEUP_AI_KEY||'';
fs.mkdirSync(audioDir,{recursive:true});fs.mkdirSync(coverDir,{recursive:true});app.use(cors());app.use(express.json());app.use('/music/audio',express.static(audioDir,{acceptRanges:true,cacheControl:true}));app.use('/music/covers',express.static(coverDir,{cacheControl:true}));
let tracks=[];try{if(fs.existsSync(tracksFile))tracks=JSON.parse(fs.readFileSync(tracksFile,'utf8'))}catch{tracks=[]}function save(){fs.writeFileSync(tracksFile,JSON.stringify(tracks,null,2),'utf8')}
async function yreq(endpoint,opts={}){if(!YTOKEN)throw new Error('VIBEUP_YANDEX_TOKEN не задан в окружении');const r=await fetch(YAPI+endpoint,{...opts,headers:{Authorization:'OAuth '+YTOKEN,...(opts.headers||{})}});const text=await r.text();let data={};try{data=JSON.parse(text)}catch{}if(!r.ok)throw new Error(data.message||data.description||('Yandex HTTP '+r.status));return data}
async function yUpload(localPath,remotePath,mime){const link=await yreq('/resources/upload?path='+encodeURIComponent(remotePath)+'&overwrite=true');const body=fs.readFileSync(localPath);const r=await fetch(link.href,{method:'PUT',body,headers:{'Content-Type':mime||'application/octet-stream'}});if(!r.ok)throw new Error('Не удалось загрузить файл в Яндекс Диск: HTTP '+r.status)}
async function yPublish(remotePath){try{const d=await yreq('/resources/publish?path='+encodeURIComponent(remotePath),{method:'PUT'});return d.public_url||d.public_key||''}catch(e){const info=await yreq('/resources?path='+encodeURIComponent(remotePath));return info.public_url||''}}
async function yWriteJson(remotePath,obj){const tmp=path.join(__dirname,'.vibeup-cloud-catalog.json');fs.writeFileSync(tmp,JSON.stringify(obj,null,2),'utf8');try{await yUpload(tmp,remotePath,'application/json')}finally{try{fs.unlinkSync(tmp)}catch{}}}
async function yDelete(remotePath){try{await yreq('/resources?path='+encodeURIComponent(remotePath),{method:'DELETE'})}catch(e){if(!String(e.message||e).toLowerCase().includes('not found'))throw e}}
async function syncCloudCatalog(){if(!YTOKEN)return '';await yWriteJson(YROOT+'/catalog.json',{version:2,updated:new Date().toISOString(),tracks});return await yPublish(YROOT+'/catalog.json')}
async function loadCloudCatalog(){if(!YTOKEN)return false;try{const d=await yreq('/resources/download?path='+encodeURIComponent(YROOT+'/catalog.json'));const r=await fetch(d.href);if(!r.ok)return false;const data=await r.json();if(Array.isArray(data.tracks)){tracks=data.tracks;save();return true}}catch(e){console.warn('Cloud catalog load failed:',e.message||e)}return false}
async function publishCatalog(){if(!YTOKEN)return '';const publicUrl=await yPublish(YROOT+'/catalog.json');return publicUrl}
const storage=multer.diskStorage({destination:(req,file,cb)=>cb(null,file.fieldname==='audio'?audioDir:coverDir),filename:(req,file,cb)=>{const ext=path.extname(file.originalname).toLowerCase();cb(null,Date.now()+'-'+Math.random().toString(36).slice(2)+ext)}});
const upload=multer({storage,limits:{fileSize:500*1024*1024},fileFilter:(req,file,cb)=>{const a=['.mp3','.wav','.flac','.m4a','.ogg','.aac'];const c=['.jpg','.jpeg','.png','.webp'];const ext=path.extname(file.originalname).toLowerCase();if(file.fieldname==='audio'&&!a.includes(ext))return cb(new Error('Неподдерживаемый аудиофайл'));if(file.fieldname==='cover'&&!c.includes(ext))return cb(new Error('Неподдерживаемая обложка'));cb(null,true)}});
function requireAdmin(req,res,next){
  if(!ADMIN_KEY)return res.status(503).json({error:'Админ-доступ не настроен: задайте VIBEUP_ADMIN_KEY на backend.'});
  const key=req.get('x-vibeup-admin-key')||req.body?.adminKey||'';
  if(key!==ADMIN_KEY)return res.status(401).json({error:'Неверный админ-ключ'});
  next();
}
app.get('/api/health',(req,res)=>res.json({ok:true,time:new Date().toISOString(),tracks:tracks.length,cloud:!!YTOKEN,admin:!!ADMIN_KEY}));
async function wikiResearch(query){
  const q=String(query||'').trim();
  if(!q)return [];
  try{
    const u='https://ru.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(q)+'&gsrlimit=5&prop=extracts|info&exintro=1&explaintext=1&inprop=url&format=json&origin=*';
    const r=await fetch(u,{headers:{'User-Agent':'VibeUp/2.0 music assistant'}});
    if(!r.ok)return [];
    const d=await r.json();
    return Object.values(d.query?.pages||{}).map(x=>({title:x.title,extract:x.extract||'',url:x.fullurl||''})).filter(x=>x.extract);
  }catch{return []}
}
function isResearchQuestion(q){return /(кто такой|кто такая|биограф|исполнитель|певец|певица|группа|музыкант|альбом|дискограф|песн|трек|родил|умер|карьер|творчеств|истори|факт|басков|hush|artist|album|song|discograph)/i.test(q)}
app.post('/api/ai',async(req,res)=>{
  try{
    if(!AI_KEY)return res.status(503).json({error:'AI не настроен. На ПК задайте переменную VIBEUP_AI_KEY.'});
    const incoming=Array.isArray(req.body?.messages)?req.body.messages:[];
    const fallbackQuery=String(req.body?.query||'').trim();
    const messages=incoming.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-18);
    if(!messages.length&&fallbackQuery)messages.push({role:'user',content:fallbackQuery});
    if(!messages.length)return res.status(400).json({error:'Пустой запрос'});
    const latest=[...messages].reverse().find(m=>m.role==='user')?.content||fallbackQuery;
    const catalog=Array.isArray(req.body?.tracks)?req.body.tracks:[];
    let research=[];
    if(isResearchQuestion(latest))research=await wikiResearch(latest);
    const system=`Ты VibeUp AI — живой музыкальный собеседник внутри приложения VibeUp. Твоя задача — реально помогать пользователю, а не выдавать сухую энциклопедическую справку.

Стиль:
- Отвечай естественно, дружелюбно и по-человечески, без канцелярита и роботизированных фраз.
- Не заканчивай каждый ответ шаблонами вроде «Чем могу помочь?» или «Если хотите, я могу...». Предлагай следующий шаг только когда это действительно уместно.
- Поддерживай контекст предыдущих сообщений и помни, о чём идёт разговор.
- На короткий вопрос отвечай коротко, на просьбу «подробно», «максимально», «расскажи всё» — разворачивай ответ.
- Не ограничивайся 2–3 предложениями, если пользователь просит информацию.

Музыкальная справка:
- Для исполнителя по возможности дай: полное имя, дату/место рождения, путь к известности, ключевые этапы карьеры, основные жанры, важные альбомы, известные песни, сотрудничества, награды/звания, влияние и интересные факты.
- Для песни: авторы, исполнитель, альбом, год, жанр, история создания/контекст — только если подтверждается источниками или общеизвестными данными.
- Для альбома: год, концепция, трек-лист если известен, важные песни, стиль и место в карьере.
- Для дискографии не выдумывай полный список. Если список большой — группируй по периодам и называй ключевые релизы.
- Если источники дают спорные сведения, обозначай это.
- Не придумывай факты, даты, песни или награды.

Диалог:
- Пользователь может просто болтать, спрашивать совета по музыке, просить рекомендации, обсуждать песни или возвращаться к предыдущей теме.
- Можно сравнивать исполнителей, объяснять жанры, помогать составлять плейлисты и разбирать музыкальные вкусы.
- Для рекомендаций учитывай каталог VibeUp, если он передан.

Данные каталога VibeUp:
${JSON.stringify(catalog).slice(0,30000)}

Материалы внешнего исследования (используй как справочные источники, не выдавай наличие доступа к Википедии как собственную память):
${JSON.stringify(research).slice(0,24000)}`;
    const payload={model:AI_MODEL,messages:[{role:'system',content:system},...messages],temperature:0.75,max_tokens:4000};
    const r=await fetch(AI_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+AI_KEY},body:JSON.stringify(payload)});
    const text=await r.text();let d={};try{d=JSON.parse(text)}catch{}
    if(!r.ok)return res.status(r.status).json({error:d.error?.message||d.message||'AI provider error'});
    const answer=d.choices?.[0]?.message?.content||d.output_text||'';
    if(!answer)return res.status(502).json({error:'Пустой ответ AI'});
    res.json({answer,research:research.map(x=>({title:x.title,url:x.url}))});
  }catch(e){res.status(500).json({error:e.message})}
});

const recognizeUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024}});
app.post('/api/recognize',recognizeUpload.single('audio'),async(req,res)=>{
  try{
    if(!req.file?.buffer?.length)return res.status(400).json({error:'Аудиофрагмент не получен'});
    const form=new FormData();
    form.append('audio',new Blob([req.file.buffer],{type:req.file.mimetype||'audio/webm'}),req.file.originalname||'sample.webm');
    try{
      const rr=await fetch(RECOGNIZER_URL,{method:'POST',body:form});
      const rd=await rr.json().catch(()=>({}));
      if(rr.ok)return res.json(rd);
      if(!AUDD_TOKEN)return res.status(rr.status||502).json({error:rd.detail||rd.error||'Сервис распознавания недоступен'});
    }catch(e){
      if(!AUDD_TOKEN)return res.status(503).json({error:'Сервис распознавания временно недоступен.'});
    }
    // Optional fallback for installations that still have an AudD token.
    const form2=new FormData();
    form2.append('api_token',AUDD_TOKEN);
    form2.append('return','apple_music,spotify,musicbrainz');
    form2.append('file',new Blob([req.file.buffer],{type:req.file.mimetype||'audio/webm'}),req.file.originalname||'sample.webm');
    const r=await fetch('https://api.audd.io/',{method:'POST',body:form2});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.status==='error')return res.status(r.status||502).json({error:d.error?.error_message||d.error||'Не удалось распознать музыку'});
    res.json({result:d.result||null});
  }catch(e){res.status(502).json({error:e.message||'Ошибка распознавания'})}
});

app.get('/api/cloud-catalog',async(req,res)=>{try{if(!YTOKEN)return res.status(503).json({error:'Облако не подключено'});const d=await yreq('/resources?path='+encodeURIComponent(YROOT+'/catalog.json'));res.json({url:d.public_url||''})}catch(e){res.status(404).json({error:e.message})}});
app.get('/api/tracks/:id/stream',async(req,res)=>{
  try{
    if(!YTOKEN)return res.status(503).json({error:'Облако не подключено'});
    const t=tracks.find(x=>String(x.id)===String(req.params.id));
    if(!t?.cloudAudioPath)return res.status(404).json({error:'Облачный файл не найден'});
    const d=await yreq('/resources/download?path='+encodeURIComponent(t.cloudAudioPath));
    const headers={}; if(req.headers.range)headers.Range=req.headers.range;
    const r=await fetch(d.href,{headers});
    if(!r.ok||!r.body)return res.status(502).json({error:'Не удалось получить аудио из облака'});
    res.status(r.status);
    res.setHeader('Content-Type',t.mimeType||'audio/mpeg');
    for(const h of ['content-length','content-range','accept-ranges','etag','last-modified']){
      const v=r.headers.get(h); if(v)res.setHeader(h,v);
    }
    if(r.body.pipeTo){
      const {Writable}=require('stream'); await r.body.pipeTo(Writable.toWeb(res));
    }else res.end(Buffer.from(await r.arrayBuffer()));
  }catch(e){res.status(502).json({error:e.message})}
});
app.get('/api/tracks',async(req,res)=>{let out=tracks.map(t=>({...t}));if(YTOKEN){for(const t of out){if(t.cloudAudioPath){try{const d=await yreq('/resources?path='+encodeURIComponent(t.cloudAudioPath));t.audioUrl=d.public_url||t.audioUrl||''}catch{}}if(t.cloudCoverPath){try{const d=await yreq('/resources?path='+encodeURIComponent(t.cloudCoverPath));t.coverUrl=d.public_url||t.coverUrl||''}catch{}}}}res.json(out.map(t=>({...t,audio:t.audioUrl||t.audio,cover:t.coverUrl||t.cover})))});
app.post('/api/tracks',requireAdmin,upload.fields([{name:'audio',maxCount:1},{name:'cover',maxCount:1}]),async(req,res)=>{if(!req.body.title)return res.status(400).json({error:'Не указано название'});if(!req.files?.audio?.[0])return res.status(400).json({error:'Не выбран аудиофайл'});const a=req.files.audio[0],c=req.files.cover?.[0];const id=Date.now().toString();const t={id,title:req.body.title.trim(),artist:(req.body.artist||'Неизвестный исполнитель').trim(),album:(req.body.album||'').trim(),genre:(req.body.genre||'').trim(),year:req.body.year?Number(req.body.year):undefined,audio:'/music/audio/'+a.filename,cover:c?'/music/covers/'+c.filename:null,mimeType:a.mimetype||'audio/mpeg',originalName:path.basename(a.originalname)};if(t.year===undefined)delete t.year;try{if(YTOKEN){t.cloudAudioPath=YROOT+'/audio/'+id+'-'+path.basename(a.originalname);await yUpload(a.path,t.cloudAudioPath,a.mimetype);t.audioUrl=await yPublish(t.cloudAudioPath);if(c){t.cloudCoverPath=YROOT+'/covers/'+id+'-'+path.basename(c.originalname);await yUpload(c.path,t.cloudCoverPath,c.mimetype);t.coverUrl=await yPublish(t.cloudCoverPath)}else t.coverUrl=''}tracks.push(t);if(YTOKEN){t.cloudCatalogPath=YROOT+'/catalog.json';t.cloudCatalogUrl=await syncCloudCatalog()}save();res.json({success:true,track:t,cloud:!!YTOKEN})}catch(e){return res.status(502).json({error:e.message})}});
app.patch('/api/tracks/:id',express.json(),requireAdmin,async(req,res)=>{try{const t=tracks.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:'Трек не найден'});for(const k of ['title','artist','album','genre'])if(req.body[k]!==undefined)t[k]=String(req.body[k]).trim();if(req.body.year!==undefined)t.year=Number(req.body.year)||undefined;if(YTOKEN)await syncCloudCatalog();save();res.json({success:true,track:t})}catch(e){res.status(502).json({error:e.message})}});
app.delete('/api/tracks/:id',requireAdmin,async(req,res)=>{try{const t=tracks.find(x=>x.id===req.params.id);if(!t)return res.status(404).json({error:'Трек не найден'});for(const rel of [t.audio,t.cover])if(rel&&rel.startsWith('/music/')){const p=path.join(__dirname,rel.replace(/^\/+/,''));if(fs.existsSync(p))try{fs.unlinkSync(p)}catch{}}if(YTOKEN){if(t.cloudAudioPath)await yDelete(t.cloudAudioPath);if(t.cloudCoverPath)await yDelete(t.cloudCoverPath)}tracks=tracks.filter(x=>x.id!==req.params.id);if(YTOKEN)await syncCloudCatalog();save();res.json({success:true})}catch(e){res.status(502).json({error:e.message})}});
app.get('/api/config',(req,res)=>res.json({cloud:!!YTOKEN,adminConfigured:!!ADMIN_KEY,recognition:true,recognizer:RECOGNIZER_URL,tracks:tracks.length}));
app.use(express.static(path.join(__dirname,'www')));app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'www','admin','index.html')));app.use((err,req,res,next)=>{console.error(err);res.status(400).json({error:err.message||'Ошибка сервера'})});app.listen(PORT,'0.0.0.0',()=>{console.log(`VibeUp server: http://localhost:${PORT} | Yandex cloud: ${YTOKEN?'ON':'OFF'}`);loadCloudCatalog().then(ok=>console.log('VibeUp catalog:',ok?'loaded from Yandex Disk':'using local catalog')).catch(()=>{})});
