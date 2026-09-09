const http = require('http');
const fs = require('fs');
const path = require('path');

let submissions = [];
let photos = {}; // key -> { buffer, contentType }

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
