const http = require('http');
const fs = require('fs');
const path = require('path');

let submissions = [];
let photos = {}; // key -> { buffer, contentType }
let contacts = {}; // location -> record

const CONTACT_DEFAULTS = {
  Ontario: {
    location: 'Ontario',
    shifts: [
      { id: 'shift1', name: '1st Shift', start: '06:00', end: '14:30', days: [1,2,3,4,5] },
      { id: 'shift2', name: '2nd Shift', start: '14:30', end: '23:00', days: [1,2,3,4,5] }
    ],
    supervisors: [
      { name: 'Tony Sanchez', shiftId: 'shift1', cell: '' },
      { name: 'Conrado Sotelo', shiftId: 'shift1', cell: '' },
      { name: 'Miguel Villalvazo', shiftId: 'shift2', cell: '' }
    ],
    otherContacts: [
      { name: 'Brian Nguyen', roleEn: 'Plant Manager', roleEs: 'Gerente de Planta', cell: '', afterHours: true },
      { name: 'Israel Sanchez', roleEn: 'Production / Scheduling', roleEs: 'Producción / Programación', cell: '', afterHours: false },
      { name: 'Jess Goodrich', roleEn: 'Maintenance Manager', roleEs: 'Gerente de Mantenimiento', cell: '', afterHours: false },
      { name: 'Ramon Flores', roleEn: 'Shipping Manager', roleEs: 'Gerente de Envíos', cell: '', afterHours: false }
    ]
  }
};
function contactDefaultFor(loc) {
  return CONTACT_DEFAULTS[loc] || { location: loc, shifts: [], supervisors: [], otherContacts: [] };
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/photos')) {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        const { imageBase64 } = JSON.parse(body);
        const match = /^data:([^;]+);base64,(.+)$/.exec(imageBase64 || '');
        if (!match) { res.writeHead(400); res.end('bad image'); return; }
        const key = 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
        photos[key] = { buffer: Buffer.from(match[2], 'base64'), contentType: match[1] };
        res.writeHead(201, {'content-type':'application/json'});
        res.end(JSON.stringify({ key }));
      });
      return;
    }
    if (req.method === 'GET') {
      const key = req.url.split('/api/photos/')[1];
      const p = photos[key];
      if (!p) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, {'content-type': p.contentType, 'cache-control':'public, max-age=31536000, immutable'});
      res.end(p.buffer);
      return;
    }
  }
  if (req.url.startsWith('/api/submissions')) {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        const payload = JSON.parse(body);
        const id = 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
        const record = { id, ...payload, submittedAt: new Date().toISOString() };
        submissions.push(record);
        res.writeHead(201, {'content-type':'application/json'});
        res.end(JSON.stringify(record));
      });
      return;
    }
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://x');
      const formId = url.searchParams.get('formId');
      let results = submissions.slice().reverse();
      if (formId) results = results.filter(r => r.formId === formId);
      res.writeHead(200, {'content-type':'application/json'});
      res.end(JSON.stringify(results));
      return;
    }
    if (req.method === 'DELETE') {
      const url = new URL(req.url, 'http://x');
      const id = url.searchParams.get('id');
      const requester = (url.searchParams.get('requester') || '').trim().toLowerCase();
      if (!id) { res.writeHead(400, {'content-type':'application/json'}); res.end(JSON.stringify({error:'Missing id'})); return; }
      if (requester !== 'brian nguyen') { res.writeHead(403, {'content-type':'application/json'}); res.end(JSON.stringify({error:'Not authorized to delete'})); return; }
      submissions = submissions.filter(r => r.id !== id);
      res.writeHead(200, {'content-type':'application/json'});
      res.end(JSON.stringify({ deleted: id }));
      return;
    }
  }
  if (req.url.startsWith('/api/contacts')) {
    const url = new URL(req.url, 'http://x');
    const loc = url.searchParams.get('loc') || 'Ontario';
    if (req.method === 'GET') {
      res.writeHead(200, {'content-type':'application/json'});
      res.end(JSON.stringify(contacts[loc] || contactDefaultFor(loc)));
      return;
    }
    if (req.method === 'PUT') {
      const requester = (url.searchParams.get('requester') || '').trim().toLowerCase();
      const password = url.searchParams.get('password') || '';
      if (requester !== 'brian nguyen' || password !== '727StWorth!') { res.writeHead(403, {'content-type':'application/json'}); res.end(JSON.stringify({error:'Not authorized to save'})); return; }
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        const payload = JSON.parse(body);
        const record = { ...payload, location: loc, updatedAt: new Date().toISOString() };
        contacts[loc] = record;
        res.writeHead(200, {'content-type':'application/json'});
        res.end(JSON.stringify(record));
      });
      return;
    }
  }
  // static file serving
  const urlPath = req.url.split('?')[0];
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(__dirname, 'public', filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {'content-type': filePath.endsWith('.html') ? 'text/html' : 'text/plain'});
    res.end(data);
  });
});
server.listen(8791, () => console.log('mock server on 8791'));
