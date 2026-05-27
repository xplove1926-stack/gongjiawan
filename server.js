const http = require("http");
const fs = require("fs");
const path = require("path");
const DATA_FILE = path.join(__dirname, "data.json");
const PORT = process.env.PORT || 3457;

function ld() { try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch (_) { return null; } }
function sv(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), "utf8"); }

function initData() {
  if (ld()) return;
  const d = {
    boss: { name: "彭瑜婷", pass: "123456" },
    employees: [
      { name: "肖景文", pass: "123456", position: "" },
      { name: "徐敏", pass: "123456", position: "" },
      { name: "车增平", pass: "123456", position: "" },
      { name: "石方平", pass: "123456", position: "" },
      { name: "任玉洁", pass: "123456", position: "" },
      { name: "段兴乾", pass: "123456", position: "" },
      { name: "王安奎", pass: "123456", position: "" },
      { name: "钟旭东", pass: "123456", position: "" },
      { name: "成婷婷", pass: "123456", position: "" },
      { name: "樊蕾娟", pass: "123456", position: "" },
      { name: "李辉", pass: "123456", position: "" }
    ],
    months: {}
  };
  sv(d);
}

initData();

function authBoss(d, body) {
  return d.boss.name === body.bossName && d.boss.pass === body.bossPass;
}

function authEmp(d, body) {
  const idx = parseInt(body.empId);
  if (isNaN(idx) || idx < 0 || idx >= d.employees.length) return -1;
  if (d.employees[idx].pass !== body.pass) return -1;
  return idx;
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = ""; req.on("data", c => b += c);
    req.on("end", () => { try { resolve(JSON.parse(b)); } catch (_) { resolve({}); } });
  });
}

function json(res, data, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function getMonthKey() {
  const now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
}

function ensureMonth(d, month) {
  if (!d.months[month]) {
    d.months[month] = { tasks: [], targets: {}, entries: {} };
  }
  return d.months[month];
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = req.url.split("?")[0];

  // Static file serve
  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    const fp = path.join(__dirname, "index.html");
    if (fs.existsSync(fp)) { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); fs.createReadStream(fp).pipe(res); return; }
  }

  // ===== INIT: get all data for frontend =====
  if (req.method === "GET" && url === "/api/init") {
    const d = ld();
    const months = Object.keys(d.months || {});
    const currentMonth = getMonthKey();
    return json(res, {
      bossName: d.boss.name,
      employees: d.employees.map(e => ({ name: e.name, position: e.position || "" })),
      months: months,
      currentMonth: currentMonth
    });
  }

  // ===== LOGIN =====
  if (req.method === "POST" && url === "/api/login") {
    const body = await readBody(req);
    const d = ld();
    if (d.boss.name === body.name && d.boss.pass === body.pass) {
      return json(res, { ok: true, isBoss: true, name: d.boss.name, pass: d.boss.pass, bossPass: d.boss.pass });
    }
    const ei = d.employees.findIndex(e => e.name === body.name && e.pass === body.pass);
    if (ei >= 0) {
      return json(res, { ok: true, isBoss: false, empId: ei, name: d.employees[ei].name, pass: d.employees[ei].pass, position: d.employees[ei].position || "" });
    }
    return json(res, { ok: false, msg: "姓名或密码错误" }, 401);
  }

  // ===== CHANGE PASSWORD =====
  if (req.method === "POST" && url === "/api/change-password") {
    const body = await readBody(req);
    const d = ld();
    if (!body.name || !body.pass || !body.newPass) return json(res, { ok: false, msg: "参数不完整" }, 400);
    if (body.isBoss) {
      if (d.boss.name !== body.name || d.boss.pass !== body.pass) return json(res, { ok: false, msg: "原密码错误" }, 403);
      d.boss.pass = body.newPass;
    } else {
      const ei = authEmp(d, body);
      if (ei < 0) return json(res, { ok: false, msg: "原密码错误" }, 403);
      d.employees[ei].pass = body.newPass;
    }
    sv(d);
    return json(res, { ok: true });
  }

  // ===== GET MONTH DATA (tasks + targets + entries for summary) =====
  if (req.method === "POST" && url === "/api/month-data") {
    const body = await readBody(req);
    const d = ld();
    const month = body.month || getMonthKey();
    const md = d.months[month] || { tasks: [], targets: {}, entries: {} };
    // Calculate completion for each employee
    const empData = d.employees.map((emp, i) => {
      const entries = (md.entries && md.entries[String(i)]) ? md.entries[String(i)] : [];
      const targets = (md.targets && md.targets[String(i)]) ? md.targets[String(i)] : {};
      // Aggregate by task
      const agg = {};
      entries.forEach(e => { agg[e.taskId] = (agg[e.taskId] || 0) + (e.qty || 0); });
      const total = Object.values(agg).reduce((a, b) => a + b, 0);
      return { idx: i, name: emp.name, position: emp.position || "", completed: agg, targets: targets, total: total };
    });
    // Grand totals per task
    const grandTotals = {};
    empData.forEach(ed => {
      Object.keys(ed.completed).forEach(tid => {
        grandTotals[tid] = (grandTotals[tid] || 0) + ed.completed[tid];
      });
    });
    const grandTotal = Object.values(grandTotals).reduce((a, b) => a + b, 0);
    // Performance score = completed qty * unitScore
    empData.forEach(ed => {
      ed.scores = {};
      ed.totalScore = 0;
      Object.keys(ed.completed).forEach(tid => {
        const task = (md.tasks || []).find(t => t.id === tid);
        const us = task ? (task.unitScore || 0) : 0;
        ed.scores[tid] = ed.completed[tid] * us;
        ed.totalScore += ed.scores[tid];
      });
    });
    return json(res, {
      month: month,
      tasks: md.tasks || [],
      employees: empData,
      grandTotals: grandTotals,
      grandTotal: grandTotal,
      isCurrentMonth: month === getMonthKey()
    });
  }

  // ===== GET MY ENTRIES (employee's own data entries) =====
  if (req.method === "POST" && url === "/api/my-entries") {
    const body = await readBody(req);
    const d = ld();
    const ei = authEmp(d, body);
    if (ei < 0) return json(res, { ok: false, msg: "验证失败" }, 403);
    const month = body.month || getMonthKey();
    const md = d.months[month] || { tasks: [], targets: {}, entries: {} };
    const entries = (md.entries && md.entries[String(ei)]) ? md.entries[String(ei)] : [];
    const targets = (md.targets && md.targets[String(ei)]) ? md.targets[String(ei)] : {};
    // Aggregate
    const agg = {};
    entries.forEach(e => { agg[e.taskId] = (agg[e.taskId] || 0) + (e.qty || 0); });
    return json(res, {
      ok: true,
      month: month,
      tasks: md.tasks || [],
      entries: entries,
      targets: targets,
      completed: agg,
      empName: d.employees[ei].name,
      position: d.employees[ei].position || ""
    });
  }

  // ===== ADD ENTRY (employee adds completion data) =====
  if (req.method === "POST" && url === "/api/add-entry") {
    const body = await readBody(req);
    const d = ld();
    const ei = authEmp(d, body);
    if (ei < 0) return json(res, { ok: false, msg: "验证失败" }, 403);
    const month = body.month || getMonthKey();
    const md = ensureMonth(d, month);
    if (!md.entries[String(ei)]) md.entries[String(ei)] = [];
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      date: body.date || new Date().toISOString().slice(0, 10),
      taskId: body.taskId,
      qty: parseInt(body.qty) || 0,
      note: body.note || ""
    };
    md.entries[String(ei)].push(entry);
    sv(d);
    return json(res, { ok: true, entry: entry });
  }

  // ===== DELETE ENTRY =====
  if (req.method === "POST" && url === "/api/delete-entry") {
    const body = await readBody(req);
    const d = ld();
    const ei = authEmp(d, body);
    if (ei < 0) return json(res, { ok: false, msg: "验证失败" }, 403);
    const month = body.month || getMonthKey();
    const md = d.months[month];
    if (!md || !md.entries || !md.entries[String(ei)]) return json(res, { ok: false, msg: "无数据" }, 404);
    md.entries[String(ei)] = md.entries[String(ei)].filter(e => e.id !== body.entryId);
    sv(d);
    return json(res, { ok: true });
  }

  // ===== ADMIN: Save month tasks =====
  if (req.method === "POST" && url === "/api/admin/save-tasks") {
    const body = await readBody(req);
    const d = ld();
    if (!authBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    const month = body.month || getMonthKey();
    const md = ensureMonth(d, month);
    md.tasks = body.tasks || [];
    sv(d);
    return json(res, { ok: true });
  }

  // ===== ADMIN: Save targets for an employee =====
  if (req.method === "POST" && url === "/api/admin/save-targets") {
    const body = await readBody(req);
    const d = ld();
    if (!authBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    const month = body.month || getMonthKey();
    const md = ensureMonth(d, month);
    if (!md.targets) md.targets = {};
    md.targets[String(body.empIdx)] = body.targets || {};
    sv(d);
    return json(res, { ok: true });
  }

  // ===== ADMIN: Update employee position =====
  if (req.method === "POST" && url === "/api/admin/update-position") {
    const body = await readBody(req);
    const d = ld();
    if (!authBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    const idx = parseInt(body.empIdx);
    if (isNaN(idx) || idx < 0 || idx >= d.employees.length) return json(res, { ok: false, msg: "员工不存在" }, 404);
    d.employees[idx].position = body.position || "";
    sv(d);
    return json(res, { ok: true });
  }

  // ===== ADMIN: Add employee =====
  if (req.method === "POST" && url === "/api/admin/add-employee") {
    const body = await readBody(req);
    const d = ld();
    if (!authBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    if (!body.newName) return json(res, { ok: false, msg: "姓名不能为空" }, 400);
    d.employees.push({ name: body.newName, pass: "123456", position: body.position || "" });
    sv(d);
    return json(res, { ok: true, employees: d.employees.map(e => ({ name: e.name, position: e.position || "" })) });
  }

  // ===== ADMIN: Delete employee =====
  if (req.method === "POST" && url === "/api/admin/delete-employee") {
    const body = await readBody(req);
    const d = ld();
    if (!authBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    const idx = parseInt(body.empIdx);
    if (isNaN(idx) || idx < 0 || idx >= d.employees.length) return json(res, { ok: false, msg: "员工不存在" }, 404);
    d.employees.splice(idx, 1);
    sv(d);
    return json(res, { ok: true, employees: d.employees.map(e => ({ name: e.name, position: e.position || "" })) });
  }

  // ===== ADMIN: Rename employee =====
  if (req.method === "POST" && url === "/api/admin/rename") {
    const body = await readBody(req);
    const d = ld();
    if (!authBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    const idx = parseInt(body.empIdx);
    if (isNaN(idx) || idx < 0 || idx >= d.employees.length) return json(res, { ok: false, msg: "员工不存在" }, 404);
    d.employees[idx].name = body.newName || d.employees[idx].name;
    sv(d);
    return json(res, { ok: true, employees: d.employees.map(e => ({ name: e.name, position: e.position || "" })) });
  }

  // ===== ADMIN: Rename boss =====
  if (req.method === "POST" && url === "/api/admin/rename-boss") {
    const body = await readBody(req);
    const d = ld();
    if (!authBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    d.boss.name = body.newName || d.boss.name;
    sv(d);
    return json(res, { ok: true });
  }

  // ===== ADMIN: Reset all data =====
  if (req.method === "POST" && url === "/api/admin/reset") {
    const body = await readBody(req);
    const d = ld();
    if (!authBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    d.months = {};
    d.boss = { name: "彭瑜婷", pass: "123456" };
    d.employees = [
      { name: "肖景文", pass: "123456", position: "" },
      { name: "徐敏", pass: "123456", position: "" },
      { name: "车增平", pass: "123456", position: "" },
      { name: "石方平", pass: "123456", position: "" },
      { name: "任玉洁", pass: "123456", position: "" },
      { name: "段兴乾", pass: "123456", position: "" },
      { name: "王安奎", pass: "123456", position: "" },
      { name: "钟旭东", pass: "123456", position: "" },
      { name: "成婷婷", pass: "123456", position: "" },
      { name: "樊蕾娟", pass: "123456", position: "" },
      { name: "李辉", pass: "123456", position: "" }
    ];
    sv(d);
    return json(res, { ok: true });
  }

  // ===== ADMIN: Get all months list =====
  if (req.method === "POST" && url === "/api/admin/months") {
    const body = await readBody(req);
    const d = ld();
    if (!authBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    return json(res, { ok: true, months: Object.keys(d.months || {}).sort().reverse() });
  }

  res.writeHead(404); res.end("Not Found");
});

server.listen(PORT, () => console.log("龚家湾绩效系统 :" + PORT));