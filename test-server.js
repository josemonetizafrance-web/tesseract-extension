const { spawn } = require('child_process');
const http = require('http');

const server = spawn('node', ['server.js'], { 
  cwd: 'C:\\Users\\Familia Molina Rojas\\Downloads\\TESSERACT_v24_temp\\TESSERACT_extension_v24\\server',
  detached: true,
  stdio: 'ignore'
 });

server.unref();

console.log('Server started, waiting...');
setTimeout(() => {
  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/tess/auth/signup',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', data);
      process.exit(0);
    });
  });
  
  req.on('error', (e) => {
    console.error('Request error:', e.message);
    process.exit(1);
  });
  
  req.write(JSON.stringify({ email: 'testuser999@test.com', password: 'Test1234*+' }));
  req.end();
}, 3000);