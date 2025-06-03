#!/usr/bin/env node

/**
 * Test script for unsubscribe functionality
 * This helps validate that the fixes are working correctly
 */

const { UnsubscribeService } = require('./dist/services/unsubscribeService');
const { logger } = require('./dist/utils/logger');

async function testUnsubscribeDetection() {
  console.log('🧪 Testing unsubscribe detection improvements...\n');
  
  const unsubscribeService = new UnsubscribeService();
  
  // Test case 1: Email with List-Unsubscribe header
  const emailWithHeader = {
    id: 'test-1',
    payload: {
      headers: [
        { name: 'From', value: 'Test Sender <test@example.com>' },
        { name: 'Subject', value: 'Test Newsletter' },
        { name: 'List-Unsubscribe', value: '<https://example.com/real-unsubscribe?id=123>' }
      ],
      body: { data: '' },
      parts: []
    }
  };
  
  console.log('📧 Test 1: Email with List-Unsubscribe header');
  const result1 = await unsubscribeService.findUnsubscribeMethod(emailWithHeader);
  console.log('Result:', JSON.stringify(result1, null, 2));
  console.log('✅ Should find URL from header\n');
  
  // Test case 2: Email with unsubscribe link in HTML body
  const htmlBody = `
    <html>
      <body>
        <p>This is a marketing email.</p>
        <a href="https://realcompany.com/unsubscribe?token=abc123">Click here to unsubscribe</a>
        <p>Thanks!</p>
      </body>
    </html>
  `;
  
  const emailWithBodyLink = {
    id: 'test-2',
    payload: {
      headers: [
        { name: 'From', value: 'Real Company <news@realcompany.com>' },
        { name: 'Subject', value: 'Weekly Newsletter' }
      ],
      parts: [
        {
          mimeType: 'text/html',
          body: { data: Buffer.from(htmlBody).toString('base64') }
        }
      ]
    }
  };
  
  console.log('📧 Test 2: Email with unsubscribe link in HTML body');
  const result2 = await unsubscribeService.findUnsubscribeMethod(emailWithBodyLink);
  console.log('Result:', JSON.stringify(result2, null, 2));
  console.log('✅ Should find URL from body\n');
  
  // Test case 3: Email with no unsubscribe options
  const emailNoUnsubscribe = {
    id: 'test-3',
    payload: {
      headers: [
        { name: 'From', value: 'Personal Friend <friend@gmail.com>' },
        { name: 'Subject', value: 'Personal Message' }
      ],
      body: { data: Buffer.from('Hey, how are you doing?').toString('base64') }
    }
  };
  
  console.log('📧 Test 3: Personal email with no unsubscribe options');
  const result3 = await unsubscribeService.findUnsubscribeMethod(emailNoUnsubscribe);
  console.log('Result:', JSON.stringify(result3, null, 2));
  console.log('✅ Should find no unsubscribe URL\n');
  
  console.log('🎉 Unsubscribe detection tests completed!');
  console.log('\n📊 Summary:');
  console.log(`- Test 1 (Header): ${result1.hasUnsubscribeLink ? '✅ PASS' : '❌ FAIL'} - Found: ${result1.unsubscribeUrl}`);
  console.log(`- Test 2 (Body):   ${result2.hasUnsubscribeLink ? '✅ PASS' : '❌ FAIL'} - Found: ${result2.unsubscribeUrl}`);
  console.log(`- Test 3 (None):   ${!result3.hasUnsubscribeLink ? '✅ PASS' : '❌ FAIL'} - Found: ${result3.unsubscribeUrl || 'none'}`);
}

// Run the test
testUnsubscribeDetection().catch(console.error);
