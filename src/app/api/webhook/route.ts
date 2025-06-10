import { NextResponse } from 'next/server';

// --- متغيرات البيئة ---
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
// متغير جديد للإشارة إلى الرابط الأساسي للتطبيق
// في الوضع المحلي، سيكون http://localhost:3000
// في وضع الإنتاج، سيكون رابط موقعك https://your-domain.com
const API_BASE_URL = process.env.AI_API_URL; 

// --- واجهات الأنواع (Interfaces) للرسائل ---
interface SendMessagePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    body: string;
  };
}

interface SendMessageResponse {
  messages?: Array<{ id: string }>;
  error?: { message: string; type: string; code: number; [key: string]: unknown };
  [key: string]: unknown;
}

// --- دالة إرسال الرسائل إلى واتساب (بدون تغيير) ---
async function sendMessage(to: string, text: string): Promise<SendMessageResponse | void> {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
  const payload: SendMessagePayload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: { body: text },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to send WhatsApp message: ${JSON.stringify(errorData)}`);
    }

    const responseData: SendMessageResponse = await response.json();
    console.log('WhatsApp message sent successfully:', responseData);
    return responseData;

  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
}

// --- !! دالة جديدة: جلب الرد من نموذج الذكاء الاصطناعي !! ---
async function getAiResponse(prompt: string): Promise<string | null> {
  // التأكد من وجود الرابط الأساسي للـ API
  if (!API_BASE_URL) {
    console.error("API_BASE_URL environment variable is not set.");
    return "عذراً، حدث خطأ في الإعدادات.";
  }

  const groqApiEndpoint = `${API_BASE_URL}/api/groq`;
  console.log(`Sending prompt to AI at: ${groqApiEndpoint}`);

  try {
    const response = await fetch(groqApiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // نرسل الرسالة كنص أساسي (prompt) مع سجل محادثة فارغ
      body: JSON.stringify({
        prompt: prompt,
        history: [], 
      }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`AI API failed with status ${response.status}: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    // استخراج الرد من البنية المتوقعة { reply: { content: "..." } }
    const replyContent = data?.reply?.content;

    if (replyContent && typeof replyContent === 'string') {
      console.log('AI Response received:', replyContent);
      return replyContent;
    } else {
      console.error('Invalid AI response format:', data);
      return null;
    }

  } catch (error) {
    console.error('Error fetching AI response:', error);
    return null;
  }
}

// --- معالج GET للتحقق من الويب هوك (بدون تغيير) ---
interface WebhookRequest extends Request {
  url: string;
}
interface WebhookSearchParams {
  get(name: string): string | null;
}
export async function GET(request: WebhookRequest): Promise<NextResponse> {
  const { searchParams }: { searchParams: WebhookSearchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook Verified!');
    return new NextResponse(challenge, { status: 200 });
  } else {
    return new NextResponse('Failed validation.', { status: 403 });
  }
}

// --- واجهات الأنواع للويب هوك ---
interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  [key: string]: unknown;
}
interface WebhookChangeValue {
  messaging_product: string;
  metadata: { display_phone_number: string; phone_number_id: string };
  messages?: Array<WebhookMessage>;
  [key: string]: unknown;
}
interface WebhookChange {
  value: WebhookChangeValue;
  field: string;
}
interface WebhookEntry {
  id: string;
  changes: Array<WebhookChange>;
}
interface WebhookBody {
  object: string;
  entry: Array<WebhookEntry>;
  [key: string]: unknown;
}

// --- !! معالج POST المعدّل لاستدعاء الذكاء الاصطناعي !! ---
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: WebhookBody = await request.json();
    console.log('Incoming webhook:', JSON.stringify(body, null, 2));

    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    // تحقق من وجود رسالة نصية
    if (message && message.type === 'text' && message.text) {
      const from = message.from; // رقم المرسل
      const msgBody = message.text.body; // نص الرسالة

      console.log(`Received message from ${from}: "${msgBody}"`);

      // 1. جلب الرد من نموذج الذكاء الاصطناعي
      const aiReply = await getAiResponse(msgBody);

      // 2. إرسال الرد إلى المستخدم
      if (aiReply) {
        await sendMessage(from, aiReply);
        console.log(`AI reply sent to ${from}`);
      } else {
        // إرسال رسالة خطأ افتراضية إذا فشل النموذج
        await sendMessage(from, "عذراً، لم أتمكن من معالجة طلبك الآن. يرجى المحاولة مرة أخرى لاحقاً.");
        console.log(`Fallback error message sent to ${from}`);
      }
    }

    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  } catch (error) {
      console.error('Error processing webhook:', error);
      // من المهم إرجاع 200 حتى لا يقوم فيسبوك بإرسال نفس الحدث مرة أخرى
      return new NextResponse('INTERNAL_SERVER_ERROR', { status: 200 });
  }
}