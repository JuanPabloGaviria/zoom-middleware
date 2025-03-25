// A simpler test script that doesn't require node-fetch
// You can run this with: node test-validation-simple.js

const https = require('https');
const crypto = require('crypto');

// Configuration
const BASE_URL = process.env.BASE_URL || 'zoom-clickup-integration.onrender.com';
const VERIFICATION_TOKEN = process.env.ZOOM_VERIFICATION_TOKEN || '';
const PLAIN_TOKEN = process.env.PLAIN_TOKEN || ''; // Use the token from the logs

// Expected encrypted token
const hashAlgorithm = crypto.createHmac('sha256', VERIFICATION_TOKEN);
const expectedToken = hashAlgorithm.update(PLAIN_TOKEN).digest('hex');

console.log('===== Zoom Webhook Validation Test =====');
console.log(`URL: ${BASE_URL}`);
console.log(`Verification token: ${VERIFICATION_TOKEN.substring(0, 5)}...`);
console.log(`Plain token: ${PLAIN_TOKEN}`);
console.log(`Expected encrypted token: ${expectedToken}`);
console.log('=======================================\n');

// Endpoints to test
const endpoints = [
  '/zoom-validate',
  '/webhook/zoom',
  '/webhook/zoom/validate',
  '/webhook/zoom/direct'
];

// Test data
const postData = JSON.stringify({
  event: 'endpoint.url_validation',
  payload: {
    plainToken: PLAIN_TOKEN
  }
});

function testEndpoint(endpoint) {
  console.log(`\nTesting endpoint: ${endpoint}`);
  
  const options = {
    hostname: BASE_URL,
    port: 443,
    path: endpoint,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('Response:', response);
        
        if (response.encryptedToken === expectedToken) {
          console.log('✅ Success! The tokens match.');
        } else {
          console.log('❌ Failure! The tokens do not match.');
          console.log(`Expected: ${expectedToken}`);
          console.log(`Received: ${response.encryptedToken}`);
        }
      } catch (e) {
        console.log('Error parsing response:', e.message);
        console.log('Raw response:', data);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('Error:', error);
  });
  
  req.write(postData);
  req.end();
}

// Test each endpoint sequentially
let index = 0;
function testNext() {
  if (index < endpoints.length) {
    testEndpoint(endpoints[index]);
    index++;
    setTimeout(testNext, 2000); // Wait 2 seconds between requests
  }
}

testNext();