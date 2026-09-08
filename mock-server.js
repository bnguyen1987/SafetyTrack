const http = require('http');
const fs = require('fs');
const path = require('path');

let submissions = [];

const server = http.createServer((req, res) => {
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
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {'content-type': filePath.endsWith('.html') ? 'text/html' : 'text/plain'});
    res.end(data);
  });
});
server.listen(8791, () => console.log('mock server on 8791'));
