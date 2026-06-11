import test from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';


test('Integration Test Suite - AI Live Chat API', async (t) => {
  // Test health check
  await t.test('GET /health should return 200 OK', async () => {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      assert.strictEqual(res.status, 200);
      const body = await res.json() as { status: string };
      assert.strictEqual(body.status, 'ok');
      console.log('✅ Test Passed: GET /health is OK');
    } catch (err) {
      assert.fail(`Health check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // Test validation for empty message
  await t.test('POST /chat/message with empty message should return 400', async () => {
    const res = await fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json() as { error: string };
    assert.ok(body.error.includes('message is required'));
    console.log('✅ Test Passed: Empty message returns 400');
  });

  // Test validation for invalid sessionId
  await t.test('POST /chat/message with invalid sessionId should return 400', async () => {
    const res = await fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello', sessionId: 'invalid-uuid' })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json() as { error: string };
    assert.ok(body.error.includes('sessionId must be a valid UUID'));
    console.log('✅ Test Passed: Invalid sessionId returns 400');
  });

  // Test chat message flow & LLM knowledge
  let sessionId: string | null = null;
  await t.test('POST /chat/message should return reply and sessionId', async () => {
    const res = await fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is your shipping policy?' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json() as { reply: string, sessionId: string };
    assert.ok(body.reply);
    assert.ok(body.sessionId);
    sessionId = body.sessionId;

    // Verify it answers based on store policies (standard shipping, etc.)
    const replyLower = body.reply.toLowerCase();
    assert.ok(
      replyLower.includes('shipping') || replyLower.includes('standard') || replyLower.includes('delivery'),
      'Reply should contain shipping details'
    );
    console.log('✅ Test Passed: Chat message flow returns valid reply and session ID');
  });

  // Test conversation continuation (threading)
  await t.test('POST /chat/message with existing sessionId should persist context', async () => {
    assert.ok(sessionId, 'Session ID from previous test should exist');
    const res = await fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'And return policy?', sessionId })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json() as { reply: string, sessionId: string };
    assert.strictEqual(body.sessionId, sessionId);
    
    // Verify it answers based on store policies (30-day, refund, etc.)
    const replyLower = body.reply.toLowerCase();
    assert.ok(
      replyLower.includes('return') || replyLower.includes('refund') || replyLower.includes('30-day') || replyLower.includes('30 day'),
      'Reply should contain return policy details'
    );
    console.log('✅ Test Passed: Conversation continues correctly within the same session');
  });

  // Test get history
  await t.test('GET /chat/history/:sessionId should return correct conversation history', async () => {
    assert.ok(sessionId, 'Session ID should exist');
    const res = await fetch(`${BASE_URL}/chat/history/${sessionId}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as { sessionId: string, messages: Array<{ sender: string, text: string }> };
    assert.strictEqual(body.sessionId, sessionId);
    assert.ok(body.messages.length >= 4, 'Should contain at least 4 messages (2 user, 2 ai)');
    
    // First message checks
    assert.strictEqual(body.messages[0].sender, 'user');
    assert.strictEqual(body.messages[0].text, 'What is your shipping policy?');
    assert.strictEqual(body.messages[1].sender, 'ai');

    // Second message checks
    assert.strictEqual(body.messages[2].sender, 'user');
    assert.strictEqual(body.messages[2].text, 'And return policy?');
    assert.strictEqual(body.messages[3].sender, 'ai');
    console.log('✅ Test Passed: History endpoint retrieves past conversation correctly');
  });

  // Test rate limiting
  await t.test('POST /chat/message rate limiter should trigger on exceeding limit', async () => {
    const rateLimitSessionId = `23456789-2345-5432-bcde-${Date.now().toString().slice(-12)}`;
    let hitRateLimit = false;

    // Send 11 requests in sequence using the rateLimitSessionId
    for (let i = 0; i < 11; i++) {
      const res = await fetch(`${BASE_URL}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Test rate limit message ${i}`, sessionId: rateLimitSessionId })
      });

      if (res.status === 429) {
        hitRateLimit = true;
        const body = await res.json() as { error: string };
        assert.ok(body.error.includes('Too many messages'));
        break;
      }
    }

    assert.ok(hitRateLimit, 'Rate limit should be triggered (status 429) after 10 requests');
    console.log('✅ Test Passed: Rate limiter correctly restricts excess queries to 10/min');
  });
});
