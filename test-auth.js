const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env.test') });

// Ajusta esta ruta a la ubicación real del servidor en tu máquina
const serverPath = __dirname + '/server';

var testEmail = process.env.TEST_ADMIN_EMAIL || 'adminchevy@tesseract.com';
var testPass = process.env.TEST_ADMIN_PASSWORD || 'AdminSegura2026*+';
console.log('[TEST] Using credentials for:', testEmail);

const server = spawn('node', ['server.js'], { 
  cwd: serverPath,
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', (d) => console.log('[OUT]', d.toString().trim()));
server.stderr.on('data', (d) => console.log('[ERR]', d.toString().trim()));
server.on('error', (e) => console.log('[SERVER ERROR]', e.message));

setTimeout(() => {
  console.log('Making request...');
  const data = JSON.stringify({ email: testEmail, password: testPass });
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/tess/auth/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  }, (res) => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', body);
      server.kill();
      process.exit(0);
    });
  });
  req.on('error', e => { console.log('Req Error:', e.message); server.kill(); process.exit(1); });
  req.write(data);
  req.end();
}, 10000);