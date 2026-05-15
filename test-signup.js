const http = require('http');

const data = JSON.stringify({ email: 'newuser@test.com', password: 'Test1234*+' });
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/tess/auth/signup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log('Request sent, waiting for response...');
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
  console.error('Code:', e.code);
});
req.write(data);
req.end();
console.log('Request written');