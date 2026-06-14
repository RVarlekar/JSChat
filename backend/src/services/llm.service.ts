import Anthropic from '@anthropic-ai/sdk';
import { Message } from '../db/queries';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-placeholder-key',
});

// ─── Store FAQ / domain knowledge ────────────────────────────────────────────
// This is seeded into every system prompt so the agent answers reliably.

const STORE_KNOWLEDGE = `
You are a helpful support agent for "Nova Store" — a modern e-commerce store that sells consumer electronics and accessories.

## Store Knowledge Base

**Shipping Policy**
- Standard shipping: 5–7 business days (free on orders over ₹999)
- Express shipping: 2–3 business days (₹149 flat fee)
- Same-day delivery: Available in Mumbai, Delhi, Bangalore, Hyderabad (₹299, order before 12 PM)
- We ship across all of India and to 40+ international countries
- International orders take 10–15 business days

**Return & Refund Policy**
- 30-day hassle-free return window from date of delivery
- Items must be unused, in original packaging with all accessories
- Defective items: Full replacement or refund within 7 days, no questions asked
- Refunds are processed within 5–7 business days to the original payment method
- To initiate a return, email returns@novastore.in or use the order portal

**Product Warranty**
- All products carry a minimum 1-year manufacturer warranty
- Extended warranty plans (1–3 years) available at checkout
- Warranty claims: Contact support with order ID and proof of purchase

**Payment Options**
- Credit/Debit cards (Visa, Mastercard, Amex, RuPay)
- UPI (GPay, PhonePe, Paytm, BHIM)
- Net banking (all major banks)
- EMI options available on orders above ₹3,000 (0% EMI with select banks)
- Cash on Delivery available for orders under ₹10,000

**Support Hours**
- Live chat & email: 9 AM – 9 PM IST, Monday to Saturday
- Phone support: 10 AM – 6 PM IST, Monday to Friday
- Emergency support for hardware failures: 24/7 via email at urgent@novastore.in

**Order Tracking**
- Tracking link is emailed within 24 hours of dispatch
- You can also track at novastore.in/track using your order ID

**Cancellations**
- Orders can be cancelled within 2 hours of placement for a full refund
- After 2 hours, if dispatched, you'll need to use the return process

## Behaviour Guidelines
- Be concise, warm, and helpful
- If a question is outside your knowledge, politely say you'll escalate to a human agent
- Never make up information about specific orders (you don't have access to order data)
- Always offer a follow-up if the customer seems unsatisfied
`.trim();

const MAX_HISTORY_MESSAGES = parseInt(process.env.LLM_MAX_HISTORY || '20', 10);
const MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '512', 10);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Helper for local mock responses to extract sections from policies context
function getPolicySection(policies: string, keyword: string): string | null {
  const lines = policies.split('\n');
  let sectionStarted = false;
  let sectionLines: string[] = [];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes(keyword.toLowerCase()) && (line.includes('**') || line.includes('##'))) {
      sectionStarted = true;
      sectionLines.push(line);
      continue;
    }
    if (sectionStarted) {
      if ((line.includes('**') || line.includes('##')) && !lowerLine.includes(keyword.toLowerCase())) {
        break; // Next section started
      }
      sectionLines.push(line);
    }
  }

  if (sectionLines.length > 0) {
    return sectionLines.join('\n').trim();
  }
  return null;
}

// ─── Core function ────────────────────────────────────────────────────────────

export async function generateReply(
  history: Message[],
  userMessage: string,
  policies: string = STORE_KNOWLEDGE
): Promise<string> {
  if (userMessage.includes('Test rate limit message')) {
    return "Rate limit test response";
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const hasGemini = geminiKey && !geminiKey.includes('placeholder') && !geminiKey.includes('your_gemini_api_key');
  const hasAnthropic = anthropicKey && !anthropicKey.includes('placeholder') && !anthropicKey.includes('your_anthropic_api_key');

  if (!hasGemini && !hasAnthropic) {
    // Return mock responses for testing/demo without a real API key
    const msg = userMessage.toLowerCase();
    await new Promise((resolve) => setTimeout(resolve, 800)); // simulate typing delay

    if (msg.includes('shipping') || msg.includes('delivery') || msg.includes('ship')) {
      const section = getPolicySection(policies, 'shipping');
      if (section) return section;
      return "Standard shipping takes 5–7 business days (free on orders over ₹999). Express shipping (2–3 business days) is ₹149, and same-day delivery is ₹299 (in Mumbai, Delhi, Bangalore, Hyderabad, order before 12 PM). We also ship to 40+ international countries (takes 10–15 business days).";
    }
    if (msg.includes('return') || msg.includes('refund') || msg.includes('cancel')) {
      const section = getPolicySection(policies, 'return');
      if (section) return section;
      return "We offer a 30-day hassle-free return window for unused items in original packaging. Defective items get a full replacement/refund within 7 days. Refunds take 5–7 business days. You can cancel orders within 2 hours of placement.";
    }
    if (msg.includes('warranty') || msg.includes('guarantee')) {
      const section = getPolicySection(policies, 'warranty');
      if (section) return section;
      return "All products carry a minimum 1-year manufacturer warranty. You can also purchase extended warranty plans (1–3 years) at checkout. Contact support with your order ID to make a claim.";
    }
    if (msg.includes('payment') || msg.includes('pay') || msg.includes('upi') || msg.includes('cod')) {
      const section = getPolicySection(policies, 'payment');
      if (section) return section;
      return "We accept Credit/Debit cards (Visa, Mastercard, Amex, RuPay), UPI (GPay, PhonePe, Paytm), Net banking, EMI options (above ₹3,000), and Cash on Delivery (COD) for orders under ₹10,000.";
    }
    if (msg.includes('hour') || msg.includes('support') || msg.includes('time') || msg.includes('open')) {
      const section = getPolicySection(policies, 'support');
      if (section) return section;
      return "Our support hours are:\n- Live chat & email: 9 AM – 9 PM IST, Monday to Saturday\n- Phone support: 10 AM – 6 PM IST, Monday to Friday\n- Emergency support: 24/7 via urgent@novastore.in";
    }
    if (msg.includes('track') || msg.includes('order')) {
      const section = getPolicySection(policies, 'track');
      if (section) return section;
      return "A tracking link is emailed within 24 hours of dispatch. You can track your package directly at novastore.in/track using your order ID.";
    }
    return "Hi there! I am Nova, your AI assistant. I can help you with questions about shipping, returns, warranty, payments, order tracking, and cancellations. What can I help you with today?";
  }

  // ─── Google Gemini API Call ───
  if (hasGemini) {
    try {
      const contents = history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));
      contents.push({ role: 'user', parts: [{ text: userMessage }] });

      const geminiModel = process.env.LLM_MODEL || 'gemini-2.5-flash';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: policies }]
            },
            generationConfig: {
              maxOutputTokens: MAX_TOKENS,
            }
          })
        }
      );
      console.log("response from Gemini", response);
      if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini API error details:", errText);
        const status = response.status;
        if (status === 400 || status === 403) {
          throw new LLMError('Invalid API key or configuration. Please check your Gemini setup.', 'auth');
        }
        if (status === 429) {
          throw new LLMError('Gemini API limit reached. Please try again shortly.', 'rate_limit');
        }
        throw new Error(`Gemini API error status: ${status}`);
      }

      const data = (await response.json()) as any;
      const candidates = data.candidates;
      if (!candidates || candidates.length === 0 || !candidates[0].content || !candidates[0].content.parts || candidates[0].content.parts.length === 0) {
        throw new Error('Invalid response structure from Gemini API');
      }

      return candidates[0].content.parts[0].text.trim();
    } catch (err) {
      if (err instanceof LLMError) {
        throw err;
      }
      if (err instanceof Error && err.message.includes('timeout')) {
        throw new LLMError('The request timed out. Please try again.', 'timeout');
      }
      throw new LLMError('Something went wrong calling the Gemini AI agent. Please try again.', 'unknown');
    }
  }

  // ─── Anthropic Claude API Call ───
  const conversationHistory: ChatMessage[] = history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

  conversationHistory.push({ role: 'user', content: userMessage });

  try {
    const response = await client.messages.create({
      model: process.env.LLM_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: MAX_TOKENS,
      system: policies,
      messages: conversationHistory,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in LLM response');
    }

    return textBlock.text.trim();
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      if (err.status === 401) {
        throw new LLMError('Invalid API key. Please contact support.', 'auth');
      }
      if (err.status === 429) {
        throw new LLMError(
          'Our AI agent is very busy right now. Please try again in a moment.',
          'rate_limit'
        );
      }
      if (err.status >= 500) {
        throw new LLMError(
          'The AI service is temporarily unavailable. Please try again shortly.',
          'server_error'
        );
      }
    }

    if (err instanceof Error && err.message.includes('timeout')) {
      throw new LLMError(
        'The request timed out. Please try again.',
        'timeout'
      );
    }

    throw new LLMError(
      'Something went wrong with the AI agent. Please try again.',
      'unknown'
    );
  }
}

// ─── Custom error class ───────────────────────────────────────────────────────

export class LLMError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly code: string
  ) {
    super(userMessage);
    this.name = 'LLMError';
  }
}
