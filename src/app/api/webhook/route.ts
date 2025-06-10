import { NextResponse } from 'next/server';

// هذا هو الرمز الذي ستضعه في لوحة تحكم Meta للتحقق من الـ Webhook
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// استقبال طلبات GET للتحقق
interface WebhookRequest extends Request {
  url: string;
}

interface WebhookQueryParams {
  'hub.mode': string | null;
  'hub.verify_token': string | null;
  'hub.challenge': string | null;
}

export async function GET(request: WebhookRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const mode: WebhookQueryParams['hub.mode'] = searchParams.get('hub.mode');
  const token: WebhookQueryParams['hub.verify_token'] = searchParams.get('hub.verify_token');
  const challenge: WebhookQueryParams['hub.challenge'] = searchParams.get('hub.challenge');

  // التحقق من أن الطلب من واتساب
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook Verified!');
    return new NextResponse(challenge, { status: 200 });
  } else {
    return new NextResponse('Failed validation. Make sure the validation tokens match.', { status: 403 });
  }
}

// استقبال طلبات POST مع بيانات الرسائل
interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  text: {
    body: string;
  };
  type: string;
}

interface WebhookMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

interface WebhookValue {
  messaging_product: string;
  metadata: WebhookMetadata;
  contacts?: {
    profile?: {
      name?: string;
    };
    wa_id?: string;
  }[];
  messages?: WebhookMessage[];
  statuses?: unknown[];
}

interface WebhookChange {
  value: WebhookValue;
  field: string;
}

interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

interface WebhookBody {
  object: string;
  entry: WebhookEntry[];
}

export async function POST(request: Request): Promise<NextResponse> {
  const body: WebhookBody = await request.json();

  // اطبع محتوى الرسالة في الكونسول للتأكد من أنها تعمل
  // في تطبيق حقيقي، ستقوم بتخزينها في قاعدة بيانات
  console.log(JSON.stringify(body, null, 2));

  // تحقق من أن الرسالة من مستخدم وليست إشعار حالة
  if (body.object) {
    if (
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const message: WebhookMessage = body.entry[0].changes[0].value.messages[0];
      const phoneNumber: string = body.entry[0].changes[0].value.metadata.display_phone_number;
      const from: string = message.from; // رقم المرسل
      const msgBody: string = message.text.body; // نص الرسالة

      console.log(`New message from ${from}: "${msgBody}" on number ${phoneNumber}`);

      // هنا يمكنك إضافة منطقك الخاص
      // مثلاً: await saveMessageToDB({ from, body: msgBody });
    }
  }

  // أرسل استجابة 200 OK لتأكيد استلام الرسالة
  return new NextResponse('EVENT_RECEIVED', { status: 200 });
}