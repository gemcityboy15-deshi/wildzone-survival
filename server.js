const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e5 });
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const WORLD = 180, MAX_PLAYERS = 4;
const players = new Map(), monsters = new Map(), resources = new Map();
let nextId = 1;
let boatRepaired = false, bossDefeated = false, keyFound = false, escaped = false;
let worldMessage = "MISSION 1: Shipwreck Survival — collect wood, berries and scrap.";
const BOSS_POS = { x: 57, z: -57 };

function rand(min,max){return min+Math.random()*(max-min);}
function spawnResource(type){
  let x,z;
  do { x=rand(-WORLD/2+8,WORLD/2-8); z=rand(-WORLD/2+8,WORLD/2-8); }
  while (Math.hypot(x-BOSS_POS.x,z-BOSS_POS.z)<13 || Math.hypot(x,z)<7);
  return {id:"r"+nextId++,type,x,z};
}
function resetResources(){
  resources.clear();
  for(let i=0;i<70;i++){
    const roll=Math.random();
    const type=roll<.48?"wood":roll<.78?"berry":"scrap";
    const r=spawnResource(type); resources.set(r.id,r);
  }
}
function addMonster(x,z,boss=false){
  const m={id:boss?"BOSS":"m"+nextId++,x,z,hp:boss?900:100,boss,attackCooldown:0};
  monsters.set(m.id,m); return m;
}
function resetMonsters(){
  monsters.clear();
  for(let i=0;i<8;i++) addMonster(rand(-75,75),rand(-75,75),false);
  addMonster(BOSS_POS.x,BOSS_POS.z,true);
}
resetResources(); resetMonsters();

function publicPlayers(){
  return [...players.values()].map(p=>({
    id:p.id,name:p.name,role:p.role,x:p.x,z:p.z,yaw:p.yaw,health:p.health,
    stamina:p.stamina,downed:p.downed,wood:p.wood,berries:p.berries,scrap:p.scrap
  }));
}
function snapshot(){
  return {
    players:publicPlayers(),monsters:[...monsters.values()],
    resources:[...resources.values()],worldSize:WORLD,
    quest:{boatRepaired,bossDefeated,keyFound,escaped,message:worldMessage}
  };
}
function broadcast(){io.emit("worldState",snapshot());}
function setMission(msg){worldMessage=msg;io.emit("missionUpdate",msg);broadcast();}

io.on("connection",socket=>{
  socket.on("joinGame",rawName=>{
    if(socket.data.joined)return;
    if(players.size>=MAX_PLAYERS){socket.emit("joinError","Server එක full! Players 4 දෙනෙක් දැනටමත් ඉන්නවා.");return;}
    const payload=rawName&&typeof rawName==="object"?rawName:{name:rawName};
    const name=String(payload.name||"Survivor").replace(/[<>]/g,"").trim().slice(0,16)||"Survivor";
    const allowedRoles=["medic","scout","warrior","support"];
    const role=allowedRoles.includes(payload.role)?payload.role:"medic";
    const p={id:socket.id,name,role,x:rand(-5,5),z:rand(-5,5),yaw:0,health:100,stamina:100,downed:false,wood:0,berries:0,scrap:0,lastMoveAt:Date.now(),lastAttackAt:0,lastGatherAt:0,reviveUsed:false,lastBoostAt:0};
    players.set(socket.id,p);socket.data.joined=true;
    socket.emit("joined",{id:socket.id,...snapshot()});
    io.emit("notice",`${name} දූපතට ආවා! එකට survive කරමු.`);
    broadcast();
  });
  socket.on("move",data=>{
    const p=players.get(socket.id);
    if(!p||!data||![data.x,data.z,data.yaw].every(Number.isFinite))return;
    const now=Date.now(),dt=Math.min(.25,Math.max(.01,(now-p.lastMoveAt)/1000));p.lastMoveAt=now;
    const x=Math.max(-WORLD/2+2,Math.min(WORLD/2-2,data.x));
    const z=Math.max(-WORLD/2+2,Math.min(WORLD/2-2,data.z));
    if(Math.hypot(x-p.x,z-p.z)>11*dt+1.5)return;
    if(p.downed)return;
    p.x=x;p.z=z;p.yaw=data.yaw;
    if(Number.isFinite(data.stamina))p.stamina=Math.max(0,Math.min(100,data.stamina));
  });
  socket.on("gather",rid=>{
    const p=players.get(socket.id),r=resources.get(String(rid));
    if(!p||p.downed||!r||Date.now()-p.lastGatherAt<250||Math.hypot(p.x-r.x,p.z-r.z)>4.8)return;
    p.lastGatherAt=Date.now();
    if(r.type==="wood")p.wood++;
    else if(r.type==="berry")p.berries++;
    else p.scrap++;
    resources.delete(r.id);
    socket.emit("notice",r.type==="wood"?"🪵 ලී එකතු කළා!":r.type==="berry"?"🫐 කෑම එකතු කළා!":"🔩 Metal scrap එකතු කළා!");
    setTimeout(()=>{if(!escaped){const fresh=spawnResource(Math.random()<.48?"wood":Math.random()<.55?"berry":"scrap");resources.set(fresh.id,fresh);broadcast();}},12000);
    broadcast();
  });
  socket.on("eatBerry",()=>{
    const p=players.get(socket.id);if(!p||p.downed||p.berries<1||p.health>=100)return;
    p.berries--;p.health=Math.min(100,p.health+25);socket.emit("notice","🫐 Berry එකක් කාලා health වැඩි කරගත්තා.");broadcast();
  });
  socket.on("repairBoat",()=>{
    const p=players.get(socket.id);if(!p||p.downed||boatRepaired)return;
    if(Math.hypot(p.x+63,p.z-62)>12){socket.emit("notice","කැඩුණු බෝට්ටුව වෙරළේ තියෙන්නේ — marker එක ළඟට යන්න.");return;}
    const team=[...players.values()];
    const wood=team.reduce((s,x)=>s+x.wood,0),scrap=team.reduce((s,x)=>s+x.scrap,0);
    if(wood<12||scrap<5){socket.emit("notice",`බෝට්ටුව හදන්න team එකට ලී 12ක් සහ scrap 5ක් ඕනේ. දැන් ලී ${wood}/12, scrap ${scrap}/5.`);return;}
    let w=12,s=5;
    for(const q of team){const take=Math.min(q.wood,w);q.wood-=take;w-=take;const ts=Math.min(q.scrap,s);q.scrap-=ts;s-=ts;}
    boatRepaired=true;setMission("MISSION 5: The Island Guardian — boat repaired! Defeat the ancient boss and take its key.");
    io.emit("notice","🛶 බෝට්ටුව හදාගත්තා! දැන් Temple Boss ගෙන් key එක ගන්න.");
  });
  socket.on("attack",()=>{
    const p=players.get(socket.id);if(!p||p.downed||Date.now()-p.lastAttackAt<550)return;p.lastAttackAt=Date.now();
    let target=null,best=4.5;
    for(const m of monsters.values()){const d=Math.hypot(p.x-m.x,p.z-m.z);if(d<best){best=d;target=m;}}
    if(!target){socket.emit("notice","Attack කරන්න monster එකක් ළඟ නැහැ.");return;}
    target.hp-=p.role==="warrior"?(target.boss?45:60):(target.boss?30:40);
    if(target.hp<=0){
      monsters.delete(target.id);
      if(target.boss){
        bossDefeated=true;keyFound=true;
        setMission("FINAL MISSION: Key acquired! Return to the repaired boat and escape together.");
        io.emit("notice","👑 BOSS පරාජය කළා! 🔑 පුරාණ Key එක ලැබුණා — බෝට්ටුවට ආපහු යන්න!");
      }else{
        io.emit("notice","👹 Monster එක පරාජය කළා!");
        setTimeout(()=>{if(!escaped)addMonster(rand(-75,75),rand(-75,75));},12000);
      }
    }else if(target.boss){socket.emit("notice",`👑 BOSSට hit කළා! Boss HP: ${target.hp}/900`);}
    else socket.emit("notice",`Monster එකට hit කළා! HP: ${target.hp}`);
    broadcast();
  });
  socket.on("revive",()=>{
    const medic=players.get(socket.id);
    if(!medic||medic.downed)return;
    if(medic.role!=="medic"){socket.emit("notice","Revive කරන්න පුළුවන් Medic character එකට විතරයි.");return;}
    if(medic.reviveUsed){socket.emit("notice","Medicගේ one-time revive එක දැනටමත් භාවිතා කරලා.");return;}
    let target=null,best=5;
    for(const p of players.values()){
      if(p.id===medic.id||!p.downed)continue;
      const d=Math.hypot(medic.x-p.x,medic.z-p.z);
      if(d<best){best=d;target=p;}
    }
    if(!target){socket.emit("notice","Revive කරන්න down වෙලා ඉන්න teammate කෙනෙක් 5m ඇතුළත නැහැ.");return;}
    medic.reviveUsed=true;target.downed=false;target.health=55;target.stamina=35;
    io.to(target.id).emit("notice",`💚 ${medic.name} ඔයාව revive කළා! HP 55, stamina 35.`);
    io.to(medic.id).emit("notice",`💚 ${target.name} revive කළා. මේ match එකේ revive chance එක ඉවරයි.`);
    broadcast();
  });
  socket.on("teamStaminaBoost",()=>{
    const support=players.get(socket.id);
    if(!support||support.downed)return;
    if(support.role!=="support"){socket.emit("notice","Team stamina වැඩි කරන්න පුළුවන් Support character එකට විතරයි.");return;}
    const now=Date.now();
    if(now-support.lastBoostAt<30000){socket.emit("notice",`Stamina boost එකට තව ${Math.ceil((30000-(now-support.lastBoostAt))/1000)}s ඉන්න.`);return;}
    const nearby=[...players.values()].filter(p=>!p.downed&&p.id!==support.id&&Math.hypot(p.x-support.x,p.z-support.z)<=12);
    if(!nearby.length){socket.emit("notice","Stamina boost එකට teammate කෙනෙක් 12m ඇතුළත ළඟට එන්න ඕනේ.");return;}
    support.lastBoostAt=now;
    for(const p of nearby){p.stamina=100;io.to(p.id).emit("notice",`⚡ ${support.name} ඔයාගේ stamina full කළා!`);}
    support.stamina=100;socket.emit("notice","⚡ Team stamina boost භාවිතා කළා! Cooldown: 30 seconds.");
    broadcast();
  });
  socket.on("escape",()=>{
    const p=players.get(socket.id);
    if(!p||p.downed)return;
    if(!boatRepaired){socket.emit("notice","මුලින් බෝට්ටුව repair කරන්න!");return;}
    if(!keyFound){socket.emit("notice","පිටවෙන්න Key එක ඕනේ. Temple Boss පරාජය කරන්න!");return;}
    if(Math.hypot(p.x+63,p.z-62)>11){socket.emit("notice","බෝට්ටුව ළඟට ආපහු යන්න.");return;}
    escaped=true;setMission("🏆 TRUE ENDING — The team escaped the Lost Island!");
    io.emit("gameWon",{names:publicPlayers().map(p=>p.name)});
  });
  socket.on("disconnect",()=>{
    const p=players.get(socket.id);
    if(p){players.delete(socket.id);io.emit("notice",`${p.name} disconnect වුණා.`);broadcast();}
  });
});

setInterval(()=>{
  if(escaped)return;
  const now=Date.now();
  for(const m of monsters.values()){
    let nearest=null,best=m.boss?55:38;
    for(const p of players.values()){if(p.downed)continue;const d=Math.hypot(p.x-m.x,p.z-m.z);if(d<best){best=d;nearest=p;}}
    if(nearest&&best>2.4){
      const dx=nearest.x-m.x,dz=nearest.z-m.z,d=Math.hypot(dx,dz)||1;
      const speed=m.boss?2.3:3.3;
      m.x+=dx/d*speed*.1;m.z+=dz/d*speed*.1;
    }else if(nearest&&best<=2.4&&now-(m.attackCooldown||0)>(m.boss?1100:1500)){
      nearest.health=Math.max(0,nearest.health-(m.boss?18:8));m.attackCooldown=now;
      io.to(nearest.id).emit("notice",m.boss?"👑 Boss-ийн хүчтэй довтолгоо!":"👹 Monster එක ඔයාට පහර දුන්නා!");
      if(nearest.health<=0){nearest.health=0;nearest.downed=true;io.to(nearest.id).emit("notice","ඔයා DOWN වුණා! Medic කෙනෙක් ළඟට ඇවිත් REVIVE කරන්න ඕනේ.");}
    }
  }
  broadcast();
},100);

app.get("/healthz",(req,res)=>res.json({ok:true,players:players.size}));
server.listen(PORT,"0.0.0.0",()=>console.log(`WILDZONE running on port ${PORT}`));
