const http = require("http");
const fs = require("fs");
const path = require("path");
const DATA_FILE = path.join(__dirname, "data.json");
const PORT = process.env.PORT || 3457;

function loadData() { try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch (_) { return null; } }
function saveData(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), "utf8"); }

function initData() {
  if (loadData()) return;

  const categories = [
    { name: "贷款类奖励", items: ["个人贷款推荐落地（非客户经理）","客户经理个人贷款户数净增","个人贷款存量客户转贷","对公贷款推荐上门调查","客户经理对公贷款户数净增","对公贷款存量客户转贷"] },
    { name: "个存/对公账户类奖励", items: ["新增个人存款","个人定期转存","对公账户开变销","对公存量有效户净增","对公新增有效账户","代发户净增","开户尽调"] },
    { name: "网金类奖励", items: ["新增收单商户","盘活存量收单","信用卡有效户新增","信用卡月达标额外奖励","CRM+三星以上客户净增"] },
    { name: "惩罚扣减", items: ["运营人为纰漏/有效投诉"] }
  ];

  const itemStandards = {
    "个人贷款推荐落地（非客户经理）": "50/户",
    "客户经理个人贷款户数净增": "100/户(非客户经理200)",
    "个人贷款存量客户转贷": "300/户",
    "对公贷款推荐上门调查": "笔",
    "客户经理对公贷款户数净增": "5/笔",
    "对公贷款存量客户转贷": "3/笔",
    "新增个人存款": "10/笔",
    "个人定期转存": "100/户",
    "对公账户开变销": "按季度统计",
    "对公存量有效户净增": "营销70%经办30%",
    "对公新增有效账户": "20/户",
    "代发户净增": "200/户",
    "开户尽调": "10/人次",
    "新增收单商户": "20/户(有效后50)",
    "盘活存量收单": "项",
    "信用卡有效户新增": "200/项",
    "信用卡月达标额外奖励": "每月15张以上",
    "CRM+三星以上客户净增": "次",
    "运营人为纰漏/有效投诉": "100/次"
  };

  const defaultNotes = new Array(19).fill('');

  const employees = [
    { name: "肖景文", pass: "123456", data: [0,0,0,0,0,0,156,307,0,0,0,0,0,0,14,0,20,0,0] },
    { name: "徐敏", pass: "123456", data: [0,0,0,0,0,0,164,299,0,0,0,0,0,0,11,0,20,0,0] },
    { name: "车增平", pass: "123456", data: [0,0,0,0,0,0,130,260,0,0,0,0,0,0,10,0,15,0,0] },
    { name: "石方平", pass: "123456", data: [0,0,0,0,0,0,156,307,0,0,0,0,0,0,1,0,15,0,0] },
    { name: "任玉洁", pass: "123456", data: [0,0,0,0,0,0,8,45,38,0,0,3,0,0,0,14,0,5,0,0] },
    { name: "段兴乾", pass: "123456", data: [30,35,0,0,0,0,2,0,0,0,0,0,15,6,0,2,0,10,0,0] },
    { name: "王安奎", pass: "123456", data: [16,31,1,0,0,0,3,3,1,0,0,0,2,5,3,20,0,2,0,0] },
    { name: "钟旭东", pass: "123456", data: [39,6,0,0,0,0,6,1,0,0,0,0,8,9,3,11,0,5,0,0] },
    { name: "成婷婷", pass: "123456", data: [18,2,0,2,3,0,4,0,0,0,1,4,4,3,6,11,0,10,0,0] },
    { name: "樊蕾娟", pass: "123456", data: [32,6,0,0,3,0,3,0,0,0,0,0,5,3,0,10,0,10,0,0] },
    { name: "李辉", pass: "123456", data: [0,0,0,0,0,0,74,95,0,0,0,0,0,0,0,21,2,12,0,0] }
  ];

  const boss = { name: "彭瑜婷", pass: "123456" };

  saveData({ categories, itemStandards, employees, boss, defaultNotes });
}

initData();

function checkBoss(d, body) {
  return d.boss && d.boss.name === body.bossName && d.boss.pass === body.bossPass;
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = ""; req.on("data", c => body += c);
    req.on("end", () => { try { resolve(JSON.parse(body)); } catch (_) { resolve({}); } });
  });
}
function json(res, data, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = req.url.split("?")[0];

  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    const fp = path.join(__dirname, "index.html");
    if (fs.existsSync(fp)) { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); fs.createReadStream(fp).pipe(res); return; }
  }

  if (req.method === "GET" && url === "/api/init") {
    const d = loadData();
    return json(res, {
      categories: d.categories,
      itemStandards: d.itemStandards,
      employees: d.employees.map(e => ({ name: e.name, data: e.data, notes: e.notes || [] })),
      bossName: d.boss.name
    });
  }

  if (req.method === "POST" && url === "/api/login") {
    const body = await readBody(req);
    const d = loadData();
    if (d.boss && d.boss.name === body.name && d.boss.pass === body.pass) {
      return json(res, { ok: true, isBoss: true, name: d.boss.name, bossPass: d.boss.pass, data: [] });
    }
    const emp = d.employees.find(e => e.name === body.name && e.pass === body.pass);
    if (!emp) return json(res, { ok: false, msg: "姓名或密码错误" }, 401);
    const idx = d.employees.indexOf(emp);
    if (!emp.notes) emp.notes = new Array(emp.data.length).fill(""); saveData(d); return json(res, { ok: true, isBoss: false, empId: idx, name: emp.name, data: emp.data, notes: emp.notes, pass: emp.pass });
  }

  if (req.method === "GET" && url === "/api/summary") {
    const d = loadData();
    return json(res, { categories: d.categories, employees: d.employees.map(e => ({ name: e.name, data: e.data, notes: e.notes || [] })) });
  }

  if (req.method === "POST" && url === "/api/chpwd") {
    const body = await readBody(req);
    const d = loadData();
    if (body.isBoss) { d.boss.pass = body.newPass; saveData(d); return json(res, { ok: true }); }
    const emp = d.employees[body.empId];
    if (!emp) return json(res, { ok: false, msg: "用户不存在" }, 404);
    emp.pass = body.newPass; saveData(d);
    return json(res, { ok: true });
  }

  // ========== 管理员接口 (需要行长身份验证) ==========

  // 修改员工姓名
  if (req.method === "POST" && url === "/api/admin/rename") {
    const body = await readBody(req); const d = loadData();
    if (!checkBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    const emp = d.employees[body.empIdx];
    if (!emp) return json(res, { ok: false, msg: "员工不存在" }, 404);
    emp.name = body.newName; saveData(d);
    return json(res, { ok: true });
  }

  // 添加新员工
  if (req.method === "POST" && url === "/api/admin/add-employee") {
    const body = await readBody(req); const d = loadData();
    if (!checkBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    const totalItems = d.categories.reduce((s, c) => s + c.items.length, 0);
    const data = new Array(totalItems).fill(0); const notes = new Array(totalItems).fill("");
    d.employees.push({ name: body.newName, pass: "123456", data: data, notes: notes });
    saveData(d);
    return json(res, { ok: true });
  }

  // 删除员工
  if (req.method === "POST" && url === "/api/admin/delete-employee") {
    const body = await readBody(req); const d = loadData();
    if (!checkBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    d.employees.splice(body.empIdx, 1); saveData(d);
    return json(res, { ok: true });
  }

  // 重命名行长自己
  if (req.method === "POST" && url === "/api/admin/rename-boss") {
    const body = await readBody(req); const d = loadData();
    if (!checkBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    d.boss.name = body.newName; saveData(d);
    return json(res, { ok: true });
  }

  // 添加考核项目
  if (req.method === "POST" && url === "/api/admin/add-item") {
    const body = await readBody(req); const d = loadData();
    if (!checkBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    const cat = d.categories.find(c => c.name === body.catName);
    if (!cat) return json(res, { ok: false, msg: "分类不存在" }, 404);
    if (cat.items.includes(body.itemName)) return json(res, { ok: false, msg: "项目已存在" }, 400);
    cat.items.push(body.itemName);
    d.itemStandards[body.itemName] = body.standard || "";
    // 给每个员工补一个 0
    d.employees.forEach(e => { e.data.push(0); if (!e.notes) e.notes = []; e.notes.push(""); });
    saveData(d);
    return json(res, { ok: true });
  }

  // 删除考核项目
  if (req.method === "POST" && url === "/api/admin/delete-item") {
    const body = await readBody(req); const d = loadData();
    if (!checkBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    const cat = d.categories.find(c => c.name === body.catName);
    if (!cat) return json(res, { ok: false, msg: "分类不存在" }, 404);
    const itemIdx = cat.items.indexOf(body.itemName);
    if (itemIdx < 0) return json(res, { ok: false, msg: "项目不存在" }, 404);
    cat.items.splice(itemIdx, 1);
    delete d.itemStandards[body.itemName];
    // 从每个员工删除对应位置的数据
    const globalIdx = body.globalIdx;
    d.employees.forEach(e => { if (e.data.length > globalIdx) e.data.splice(globalIdx, 1); });
    saveData(d);
    return json(res, { ok: true });
  }

  // 更新考核标准
  if (req.method === "POST" && url === "/api/admin/update-standard") {
    const body = await readBody(req); const d = loadData();
    if (!checkBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    d.itemStandards[body.itemName] = body.standard;
    saveData(d);
    return json(res, { ok: true });
  }

  // 添加分类
  if (req.method === "POST" && url === "/api/admin/add-category") {
    const body = await readBody(req); const d = loadData();
    if (!checkBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    if (d.categories.find(c => c.name === body.catName)) return json(res, { ok: false, msg: "分类已存在" }, 400);
    d.categories.push({ name: body.catName, items: [] });
    saveData(d);
    return json(res, { ok: true });
  }

  // 删除分类
  if (req.method === "POST" && url === "/api/admin/delete-category") {
    const body = await readBody(req); const d = loadData();
    if (!checkBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    const catIdx = d.categories.findIndex(c => c.name === body.catName);
    if (catIdx < 0) return json(res, { ok: false, msg: "分类不存在" }, 404);
    const cat = d.categories[catIdx];
    // 计算全局起始索引
    let startIdx = 0;
    for (let i = 0; i < catIdx; i++) startIdx += d.categories[i].items.length;
    const count = cat.items.length;
    // 删除标准
    cat.items.forEach(it => delete d.itemStandards[it]);
    // 删除分类
    d.categories.splice(catIdx, 1);
    // 删除员工数据
    d.employees.forEach(e => e.data.splice(startIdx, count));
    saveData(d);
    return json(res, { ok: true });
  }

  // 更新员工数据
  if (req.method === "POST" && url === "/api/admin/update-data") {
    const body = await readBody(req); const d = loadData();
    if (!checkBoss(d, body)) return json(res, { ok: false, msg: "权限不足" }, 403);
    const emp = d.employees[body.empIdx];
    if (!emp) return json(res, { ok: false, msg: "员工不存在" }, 404);
    if (body.itemIdx >= 0 && body.itemIdx < emp.data.length) {
      emp.data[body.itemIdx] = body.value; if (body.note !== undefined) { if (!emp.notes) emp.notes = new Array(emp.data.length).fill(""); emp.notes[body.itemIdx] = body.note || ""; }
    }
    saveData(d);
    return json(res, { ok: true });
  }


  // 员工修改自己的业绩数量+备注
  if (req.method === "POST" && url === "/api/update-my-data") {
    const body = await readBody(req);
    const d = loadData();
    const emp = d.employees[body.empId];
    if (!emp) return json(res, { ok: false, msg: "用户不存在" }, 404);
    if (emp.pass !== body.pass) return json(res, { ok: false, msg: "密码验证失败" }, 403);
    if (body.itemIdx >= 0 && body.itemIdx < emp.data.length) {
      emp.data[body.itemIdx] = body.value; if (body.note !== undefined) { if (!emp.notes) emp.notes = new Array(emp.data.length).fill(""); emp.notes[body.itemIdx] = body.note || ""; }
    }
    if (!emp.notes) emp.notes = new Array(emp.data.length).fill('');
    if (body.noteIdx >= 0 && body.noteIdx < emp.notes.length) {
      emp.notes[body.noteIdx] = body.note || '';
    }
    saveData(d);
    return json(res, { ok: true, data: emp.data, notes: emp.notes || [] });
  }

  // 获取自己的数据（含备注）
  if (req.method === "POST" && url === "/api/my-data") {
    const body = await readBody(req);
    const d = loadData();
    const emp = d.employees[body.empId];
    if (!emp) return json(res, { ok: false, msg: "用户不存在" }, 404);
    if (emp.pass !== body.pass) return json(res, { ok: false, msg: "密码验证失败" }, 403);
    if (!emp.notes) emp.notes = new Array(emp.data.length).fill('');
    return json(res, { ok: true, data: emp.data, notes: emp.notes });
  }


  // 修改密码
  if (req.method === "POST" && url === "/api/change-password") {
    const body = await readBody(req);
    const d = loadData();
    if (!body.name || !body.pass || !body.newPass) return json(res, { ok: false, msg: "参数不完整" }, 400);
    if (body.isBoss) {
      if (!d.boss || d.boss.name !== body.name || d.boss.pass !== body.pass) return json(res, { ok: false, msg: "原密码错误" }, 403);
      d.boss.pass = body.newPass;
    } else {
      if (body.empId === undefined) return json(res, { ok: false, msg: "参数不完整" }, 400);
      const emp = d.employees[body.empId];
      if (!emp) return json(res, { ok: false, msg: "用户不存在" }, 404);
      if (emp.pass !== body.pass) return json(res, { ok: false, msg: "原密码错误" }, 403);
      emp.pass = body.newPass;
    }
    saveData(d);
    return json(res, { ok: true });
  }

  res.writeHead(404); res.end("Not Found");
});

server.listen(PORT, () => console.log("龚家湾业绩系统 :" + PORT));