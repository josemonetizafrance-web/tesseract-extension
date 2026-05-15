const { spawn } = require('child_process');
const http = require('http');

const serverPath = 'C:\\Users\\Familia Molina Rojas\\Downloads\\TESSERACT_v24_temp\\TESSERACT_extension_v24\\server';

const server = spawn('node', ['server.js'], { 
  cwd: serverPath,
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', (d) => console.log('[OUT]', d.toString().trim()));
server.stderr.on('data', (d) => console.log('[ERR]', d.toString().trim()));
server.on('error', (e) => console.log('[SERVER ERROR]', e.message));

setTimeout(() => {
  console.log('Making request...');
  const data = JSON.stringify({ email: 'adminchevy@tesseract.com', password: 'AdminSegura2026*+' });
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