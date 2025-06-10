import { NextResponse } from 'next/server';

// استيراد متغيرات البيئة
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ----- دالة جديدة لإرسال الرسائل -----
interface SendMessagePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    body: string;
  };
}

interface SendMessageResponse {
  messages?: Array<{
    id: string;
  }>;
  error?: {
    message: string;
    type: string;
    code: number;
    error_data?: unknown;
    fbtrace_id?: string;
  };
  [key: string]: unknown;
}

async function sendMessage(to: string, text: string): Promise<SendMessageResponse | void> {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
  
  const payload: SendMessagePayload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: {
      body: text,
    },
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
      throw new Error(`Failed to send message: ${JSON.stringify(errorData)}`);
    }

    const responseData: SendMessageResponse = await response.json();
    console.log('Message sent successfully:', responseData);
    return responseData;

  } catch (error) {
    console.error('Error sending message:', error);
  }
}
// ------------------------------------

// استقبال طلبات GET للتحقق
interface WebhookRequest extends Request {
  url: string;
}

interface WebhookSearchParams {
  get(name: string): string | null;
}

export async function GET(request: WebhookRequest): Promise<NextResponse> {
  const { searchParams }: { searchParams: WebhookSearchParams } = new URL(request.url);
  const mode: string | null = searchParams.get('hub.mode');
  const token: string | null = searchParams.get('hub.verify_token');
  const challenge: string | null = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook Verified!');
    return new NextResponse(challenge, { status: 200 });
  } else {
    return new NextResponse('Failed validation.', { status: 403 });
  }
}

// استقبال طلبات POST مع بيانات الرسائل
interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  [key: string]: unknown;
}

interface WebhookChangeValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<Record<string, unknown>>;
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

export async function POST(request: Request): Promise<NextResponse> {
  const body: WebhookBody = await request.json();
  console.log('Incoming webhook:', JSON.stringify(body, null, 2));

  if (body.object) {
    if (
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const message: WebhookMessage = body.entry[0].changes[0].value.messages[0];
      
      // تأكد من أن الرسالة نصية وليست إشعارًا أو غيره
      if (message.type === 'text') {
        const from: string = message.from; // رقم المرسل
        const msgBody: string = message.text?.body ?? ''; // نص الرسالة المستقبلة

        console.log(`Received message from ${from}: "${msgBody}"`);

        // ----- هنا يتم استدعاء دالة الرد التلقائي -----
        try {
          await sendMessage(from, "مرحباً"); // الرد بكلمة "مرحباً"
          console.log(`Auto-reply sent to ${from}`);
        } catch (error) {
          console.error(`Failed to send auto-reply to ${from}`, error);
        }
        // ------------------------------------------
      }
    }
  }

  return new NextResponse('EVENT_RECEIVED', { status: 200 });
}