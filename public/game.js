const socket = io();
const $ = id => document.getElementById(id);
let me = null, players = [], monsters = [], selectedTarget = null;
const canvas = $("world"), ctx = canvas.getContext("2d");
const WORLD_W = 1000, WORLD_H = 580;
const colors = { grass:"#bfe5a5", grass2:"#a8d68e", path:"#e8d6a3", tree:"#39764c", tree2:"#5d9959" };

socket.on("connect", () => $("connection").textContent = "● เชื่อมต่อเซิร์ฟเวอร์แล้ว");
socket.on("disconnect", () => $("connection").textContent = "○ หลุดการเชื่อมต่อ");
$("joinBtn").onclick = () => {
  socket.emit("join", { name: $("playerName").value, job: $("job").value });
  $("login").hidden = true; $("game").hidden = false;
};
socket.on("joined", p => { me = p; renderUI(); });
socket.on("worldState", state => {
  players = state.players || []; monsters = state.monsters || [];
  me = players.find(p => p.id === socket.id) || me;
  renderUI(); drawWorld();
});
socket.on("notice", msg => {
  const el = document.createElement("div"); el.textContent = "• " + msg;
  $("log").prepend(el); while ($("log").children.length > 30) $("log").lastChild.remove();
});
socket.on("tradeOffer", offer => {
  if (confirm(`${offer.name} ส่งคำขอแลกเปลี่ยนทดลอง (แลก 5 ทอง) รับหรือไม่?`)) socket.emit("tradeAccept", offer.from);
});

$("potionBtn").onclick = () => socket.emit("usePotion");
$("skillBtn").onclick = () => socket.emit("useSkill");
$("guildBtn").onclick = () => socket.emit("createGuild", { name: $("guildName").value });

function renderUI() {
  if (!me) return;
  $("stats").innerHTML = `
    <span class="stat">🧙 <b>${escapeHtml(me.name)}</b> · ${escapeHtml(me.job)}</span>
    <span class="stat">⭐ เลเวล <b>${me.level}</b> · EXP ${me.exp}/${me.level*100}</span>
    <span class="stat">❤️ HP <b>${me.hp}/${me.maxHp}</b></span>
    <span class="stat">🪙 <b>${me.gold}</b> ทอง</span>
    <span class="stat">🏰 ${me.guild ? escapeHtml(me.guild) : "ยังไม่มีกิลด์"}</span>`;
  $("inventory").innerHTML = (me.inventory || []).map(i => `<div class="item">🎁 ${escapeHtml(i.name)} <b>×${i.qty}</b></div>`).join("");
  const others = players.filter(p => p.id !== socket.id);
  $("playerList").innerHTML = others.length ? others.map(p => `
    <div class="player"><strong>🧑 ${escapeHtml(p.name)}</strong><div class="tiny">Lv.${p.level} · ${escapeHtml(p.job)} · HP ${p.hp}/${p.maxHp}</div>
    <div class="player-actions">
      <button data-action="trade" data-id="${p.id}">🔁 แลกเปลี่ยน</button>
      <button data-action="pvp" data-id="${p.id}">⚔️ PvP</button>
    </div></div>`).join("") : '<p>ยังไม่มีผู้เล่นอื่นออนไลน์ ลองเปิดเกมในอีกแท็บหรืออีกเครื่อง</p>';
  $("playerList").querySelectorAll("button").forEach(b => b.onclick = () => {
    socket.emit(b.dataset.action === "trade" ? "tradeRequest" : "pvp", b.dataset.id);
  });
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

function drawWorld() {
  ctx.clearRect(0,0,WORLD_W,WORLD_H);
  ctx.fillStyle=colors.grass; ctx.fillRect(0,0,WORLD_W,WORLD_H);
  // Soft grass patches
  for (let i=0;i<75;i++) {
    const x=(i*137+31)%WORLD_W, y=(i*83+17)%WORLD_H;
    ctx.fillStyle = i%2 ? colors.grass2 : "#c9e9b1";
    ctx.beginPath(); ctx.ellipse(x,y,13,5,0.3,0,Math.PI*2); ctx.fill();
  }
  // Winding path and pond
  ctx.strokeStyle=colors.path; ctx.lineWidth=72; ctx.lineCap="round";
  ctx.beginPath();ctx.moveTo(-20,470);ctx.bezierCurveTo(220,430,250,300,470,330);ctx.bezierCurveTo(680,370,740,450,1020,410);ctx.stroke();
  ctx.fillStyle="#83d1dc";ctx.beginPath();ctx.ellipse(865,115,105,60,-.2,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#e5f8fa";ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(865,115,90,48,-.2,0,Math.PI*2);ctx.stroke();
  // Trees
  for (const [x,y] of [[70,90],[120,125],[920,265],[920,315],[320,90],[520,100],[80,320],[830,520],[400,500],[690,80]]) {
    ctx.fillStyle="#815a3b";ctx.fillRect(x-5,y+10,10,22);
    ctx.fillStyle=colors.tree;ctx.beginPath();ctx.arc(x,y,23,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=colors.tree2;ctx.beginPath();ctx.arc(x-7,y-7,14,0,Math.PI*2);ctx.fill();
  }
  // Monsters
  monsters.forEach(m => {
    ctx.fillStyle="#3f8d74";ctx.beginPath();ctx.ellipse(m.x,m.y+8,23,17,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#b8f0d4";ctx.beginPath();ctx.arc(m.x-7,m.y+3,4,0,Math.PI*2);ctx.arc(m.x+7,m.y+3,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#264d3b";ctx.fillRect(m.x-23,m.y-25,46,5);
    ctx.fillStyle="#e75c60";ctx.fillRect(m.x-23,m.y-25,46*Math.max(0,m.hp/m.maxHp),5);
    ctx.fillStyle="#243b2c";ctx.font="13px Prompt, sans-serif";ctx.textAlign="center";ctx.fillText(`${m.name} Lv.${m.level}`,m.x,m.y-32);
  });
  // Players
  players.forEach(p => {
    const mine = p.id === socket.id;
    ctx.fillStyle= mine ? "#efb45c" : "#7798df";
    ctx.beginPath();ctx.arc(p.x,p.y,15,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#f7d8b6";ctx.beginPath();ctx.arc(p.x,p.y-5,8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#3b4a39";ctx.fillRect(p.x-13,p.y+15,26,4);
    ctx.fillStyle="#3b4a39";ctx.font=mine?"bold 14px Prompt, sans-serif":"12px Prompt, sans-serif";ctx.textAlign="center";
    ctx.fillText(p.name,p.x,p.y-23);
    if (mine) { ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,19,0,Math.PI*2);ctx.stroke(); }
  });
  ctx.textAlign="left";
}
function canvasPoint(e) {
  const r=canvas.getBoundingClientRect();
  return {x:(e.clientX-r.left)*WORLD_W/r.width,y:(e.clientY-r.top)*WORLD_H/r.height};
}
canvas.addEventListener("pointerdown", e => {
  if (!me) return;
  const pt=canvasPoint(e);
  const m=monsters.find(m=>Math.hypot(m.x-pt.x,m.y-pt.y)<38);
  if (m) { socket.emit("attack",m.id); return; }
  socket.emit("move",pt);
});