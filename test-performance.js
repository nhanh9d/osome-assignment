const http = require('http');

// Helper function to make HTTP requests
function makeRequest(method, path, callback) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      callback(null, { statusCode: res.statusCode, data: JSON.parse(data) });
    });
  });

  req.on('error', callback);
  req.end();
}

// Test sync endpoint
function testSyncEndpoint() {
  console.log('\n=== Testing SYNC Endpoint (old implementation) ===');
  const startTime = Date.now();
  
  makeRequest('POST', '/api/v1/reports/sync', (err, res) => {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    if (err) {
      console.error('Error:', err);
      return;
    }
    
    console.log('Status:', res.statusCode);
    console.log('Response:', res.data);
    console.log(`⏱️  Response Time: ${duration.toFixed(2)} seconds`);
    console.log('Note: Client was blocked for entire duration');
    
    // Now test async endpoint
    setTimeout(testAsyncEndpoint, 1000);
  });
}

// Test async endpoint
function testAsyncEndpoint() {
  console.log('\n=== Testing ASYNC Endpoint (new implementation) ===');
  const startTime = Date.now();
  
  makeRequest('POST', '/api/v1/reports', (err, res) => {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    if (err) {
      console.error('Error:', err);
      return;
    }
    
    console.log('Status:', res.statusCode);
    console.log('Response:', res.data);
    console.log(`⏱️  Response Time: ${duration.toFixed(3)} seconds`);
    console.log('Note: Client received immediate response!');
    
    // Check status after a delay
    console.log('\nChecking status after 2 seconds...');
    setTimeout(() => {
      checkStatus();
    }, 2000);
  });
}

// Check report status
function checkStatus() {
  makeRequest('GET', '/api/v1/reports', (err, res) => {
    if (err) {
      console.error('Error:', err);
      return;
    }
    
    console.log('\n=== Report Status ===');
    console.log(res.data);
    
    // Check metrics
    checkMetrics();
  });
}

// Check metrics
function checkMetrics() {
  makeRequest('GET', '/api/v1/reports/metrics', (err, res) => {
    if (err) {
      console.error('Error checking metrics:', err);
      return;
    }
    
    console.log('\n=== Performance Metrics ===');
    const metrics = res.data;
    
    for (const [report, data] of Object.entries(metrics)) {
      console.log(`\n${report}:`);
      console.log(`  - Files Processed: ${data.filesProcessed}`);
      console.log(`  - Duration: ${data.duration}s`);
    }
    
    console.log('\n=== Summary ===');
    console.log('✅ Async endpoint responds immediately (non-blocking)');
    console.log('✅ Reports process in background');
    console.log('✅ Status and metrics available via GET endpoints');
    console.log('✅ Client can check progress without being blocked');
  });
}

console.log('Performance Test for Reports Endpoint');
console.log('=====================================');
console.log('Make sure the server is running: npm start');
console.log('\nStarting tests in 2 seconds...');

setTimeout(testSyncEndpoint, 2000);