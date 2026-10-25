const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, game: "Browser MMORPG Starter" }));

// Prototype data lives in memory. Restarting the server resets players and items.
const players = new Map();
const monsters = [
  { id: "slime-a", name: "สไลม์", x: 420, y: 240, hp: 30, maxHp: 30, level: 1 },
  { id: "slime-b", name: "สไลม์", x: 600, y: 360, hp: 30, maxHp: 30, level: 1 },
  { id: "mushroom-a", name: "เห็ดป่า", x: 760, y: 220, hp: 55, maxHp: 55, level: 2 }
];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const publicPlayer = p => ({
  id: p.id, name: p.name, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp,
  level: p.level, exp: p.exp, gold: p.gold, job: p.job, guild: p.guild,
  inventory: p.inventory, skills: p.skills, online: true
});
function broadcastState() {
  io.emit("worldState", {
    players: [...players.values()].map(publicPlayer),
    monsters: monsters.map(m => ({ ...m }))
  });
}
function addLog(p, message) {
  io.to(p.id).emit("notice", message);
}

io.on("connection", socket => {
  socket.on("join", raw => {
    const name = String(raw?.name || "นักผจญภัย").trim().slice(0, 16) || "นักผจญภัย";
    const job = ["นักดาบ", "นักเวท", "นักธนู"].includes(raw?.job) ? raw.job : "นักดาบ";
    const p = {
      id: socket.id, name, x: 180 + Math.random() * 80, y: 180 + Math.random() * 100,
      hp: 100, maxHp: 100, level: 1, exp: 0, gold: 50, job, guild: "",
      inventory: [{ name: "ยาฟื้นพลัง", qty: 3 }, { name: "ดาบฝึกหัด", qty: 1 }],
      skills: ["โจมตีธรรมดา", job === "นักเวท" ? "ลูกไฟ" : job === "นักธนู" ? "ยิงแม่นยำ" : "ฟันหนัก"]
    };
    players.set(socket.id, p);
    socket.emit("joined", publicPlayer(p));
    addLog(p, `ยินดีต้อนรับ ${p.name}! เดินสำรวจและคลิกมอนสเตอร์เพื่อโจมตี`);
    broadcastState();
  });

  socket.on("move", pos => {
    const p = players.get(socket.id); if (!p) return;
    p.x = clamp(Number(pos?.x) || p.x, 40, 960);
    p.y = clamp(Number(pos?.y) || p.y, 70, 520);
    broadcastState();
  });

  socket.on("attack", monsterId => {
    const p = players.get(socket.id); if (!p) return;
    const m = monsters.find(x => x.id === monsterId); if (!m) return;
    const distance = Math.hypot(p.x - m.x, p.y - m.y);
    if (distance > 170) return addLog(p, "อยู่ไกลเกินไป เดินเข้าใกล้มอนสเตอร์ก่อน!");
    const damage = p.job === "นักเวท" ? 18 : p.job === "นักธนู" ? 15 : 20;
    m.hp -= damage;
    addLog(p, `คุณโจมตี ${m.name} สร้างความเสียหาย ${damage}`);
    if (m.hp <= 0) {
      p.exp += m.level * 20;
      p.gold += 10 + m.level * 3;
      p.inventory.push({ name: "เจลสไลม์", qty: 1 });
      addLog(p, `กำจัด ${m.name} สำเร็จ! ได้ EXP และเงิน พร้อมรับเจลสไลม์`);
      if (p.exp >= p.level * 100) {
        p.exp -= p.level * 100; p.level += 1; p.maxHp += 10; p.hp = p.maxHp;
        addLog(p, `เลเวลอัป! ตอนนี้คุณเลเวล ${p.level}`);
      }
      m.hp = m.maxHp;
    }
    broadcastState();
  });

  socket.on("usePotion", () => {
    const p = players.get(socket.id); if (!p) return;
    const potion = p.inventory.find(i => i.name === "ยาฟื้นพลัง" && i.qty > 0);
    if (!potion) return addLog(p, "ยาฟื้นพลังหมดแล้ว");
    if (p.hp === p.maxHp) return addLog(p, "พลังชีวิตเต็มอยู่แล้ว");
    potion.qty--; p.hp = Math.min(p.maxHp, p.hp + 40);
    addLog(p, "ใช้ยาฟื้นพลัง ฟื้น HP 40 หน่วย"); broadcastState();
  });

  socket.on("useSkill", () => {
    const p = players.get(socket.id); if (!p) return;
    addLog(p, `ใช้สกิล ${p.skills[1]}! (ต้นแบบ: สกิลแสดงข้อความ ยังไม่ใช้ระบบคูลดาวน์)`);
  });

  socket.on("createGuild", raw => {
    const p = players.get(socket.id); if (!p) return;
    const guild = String(raw?.name || "").trim().slice(0, 20);
    if (!guild) return addLog(p, "กรุณาใส่ชื่อกิลด์");
    p.guild = guild; addLog(p, `คุณสร้าง/เข้าร่วมกิลด์ ${guild} แล้ว`); broadcastState();
  });

  socket.on("tradeRequest", targetId => {
    const p = players.get(socket.id), target = players.get(targetId);
    if (!p || !target || target.id === p.id) return;
    io.to(target.id).emit("tradeOffer", { from: p.id, name: p.name });
    addLog(p, `ส่งคำขอแลกเปลี่ยนให้ ${target.name} แล้ว`);
  });
  socket.on("tradeAccept", fromId => {
    const p = players.get(socket.id), other = players.get(fromId);
    if (!p || !other) return;
    // Safe demo trade: transfers 5 gold, no client-supplied amount.
    if (other.gold < 5) return addLog(p, "อีกฝ่ายมีทองไม่พอสำหรับการแลกเปลี่ยนทดลอง");
    other.gold -= 5; p.gold += 5;
    addLog(p, `แลกเปลี่ยนทดลองสำเร็จ ได้รับ 5 ทองจาก ${other.name}`);
    addLog(other, `แลกเปลี่ยนทดลองสำเร็จกับ ${p.name}: เสีย 5 ทอง`);
    broadcastState();
  });

  socket.on("pvp", targetId => {
    const p = players.get(socket.id), target = players.get(targetId);
    if (!p || !target || p.id === target.id) return;
    if (Math.hypot(p.x - target.x, p.y - target.y) > 170) return addLog(p, "คู่ต่อสู้อยู่ไกลเกินไป");
    target.hp -= 10;
    addLog(p, `โจมตี PvP ใส่ ${target.name} 10 ความเสียหาย`);
    if (target.hp <= 0) { target.hp = target.maxHp; addLog(target, "คุณพ่ายแพ้ในการประลองและฟื้นพลังที่เมือง"); target.x = 180; target.y = 180; }
    broadcastState();
  });

  socket.on("disconnect", () => { players.delete(socket.id); broadcastState(); });
});

server.listen(PORT, () => console.log(`Game server running at http://localhost:${PORT}`));
