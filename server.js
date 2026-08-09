const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

let leads = [];
const ADMIN_PASSWORD = '***';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.json({ success: true, token: Buffer.from(ADMIN_PASSWORD).toString('base64') });
  } else {
    res.status(403).json({ error: 'Incorrect password' });
  }
});

function checkAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || '';
  const expected = Buffer.from(ADMIN_PASSWORD).toString('base64');
  if (token === expected) {
    return next();
  }
  res.status(403).json({ error: 'Authentication required' });
}

app.post('/api/submit', (req, res) => {
  const { contact, contactType, peptideKnowledge, peptideUsage, job, notes } = req.body;
  if (!contact || !contactType) {
    return res.status(400).json({ error: 'Contact information is required' });
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

app.get('/api/leads', checkAdmin, (req, res) => {
  leads.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(leads);
});

app.delete('/api/leads/:id', checkAdmin, (req, res) => {
  const idx = leads.findIndex(l => l.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Lead not found' });
  }
  leads.splice(idx, 1);
  res.json({ success: true });
});

app.get('/api/export', checkAdmin, (req, res) => {
  const headers = ['ID', 'Contact', 'Method', 'Familiar with peptides', 'Used peptides before', 'Occupation', 'Notes', 'Submitted At'];
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
  let csv = '\uFEFF';
  csv += headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(field => '"' + String(field).replace(/"/g, '""') + '"').join(',') + '\n';
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=leads_' + new Date().toISOString().slice(0, 10) + '.csv');
  res.send(csv);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Lead form server running on port ' + PORT);
});
