const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// 内存存储（Render 免费版文件系统是临时的，用内存更可靠）
let leads = [];

// 后台密码（修改这里即可改密码）
const ADMIN_PASSWORD = 'lead2024';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 密码验证中间件
app.post('/api/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.json({ success: true, token: Buffer.from(ADMIN_PASSWORD).toString('base64') });
  } else {
    res.status(403).json({ error: '密码错误' });
  }
});

// 后台 API 需要密码验证
function checkAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || '';
  const expected = Buffer.from(ADMIN_PASSWORD).toString('base64');
  if (token === expected) {
    return next();
  }
  res.status(403).json({ error: '需要登录' });
}

// 提交线索
app.post('/api/submit', (req, res) => {
  const { contact, contactType, peptideKnowledge, peptideUsage, job, notes } = req.body;

  if (!contact || !contactType) {
    return res.status(400).json({ error: '联系方式和方式不能为空' });
  }

  const lead = {
    id: uuidv4(),
    contact,
    contactType,
    peptideKnowledge: peptideKnowledge || '',
    peptideUsage: peptideUsage || '',
    job: job || '',
    notes: notes || '',
    submittedAt: new Date().toISOString(),
    submittedAtLocal: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  };

  leads.push(lead);
  res.json({ success: true, id: lead.id });
});

// 获取所有线索（后台管理用）
app.get('/api/leads', checkAdmin, (req, res) => {
  leads.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(leads);
});

// 删除线索
app.delete('/api/leads/:id', checkAdmin, (req, res) => {
  const idx = leads.findIndex(l => l.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: '未找到该线索' });
  }
  leads.splice(idx, 1);
  res.json({ success: true });
});

// 导出 CSV
app.get('/api/export', checkAdmin, (req, res) => {
  const headers = ['ID', '联系方式', '方式', '是否了解多肽', '是否使用过多肽', '职业', '备注', '提交时间'];
  const rows = leads.map(l => [
    l.id,
    l.contact,
    l.contactType === 'whatsapp' ? 'WhatsApp' : 'Telegram',
    l.peptideKnowledge || '',
    l.peptideUsage || '',
    l.job || '',
    l.notes || '',
    l.submittedAtLocal
  ]);

  let csv = '\uFEFF'; // BOM for Excel
  csv += headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',') + '\n';
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=leads_' + new Date().toISOString().slice(0, 10) + '.csv');
  res.send(csv);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  线索收集系统已启动！`);
  console.log(`  表单地址: http://localhost:${PORT}`);
  console.log(`  管理后台: http://localhost:${PORT}/admin.html`);
  console.log(`  数据文件: ${DATA_FILE}\n`);
});
