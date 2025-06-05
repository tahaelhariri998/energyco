// app/api/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = process.env.VERIFY_TOKEN!;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID!;
const AI_API_URL = process.env.AI_API_URL!;

// ✅ التحقق من Webhook - GET
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  } else {
    return new Response('Forbidden', { status: 403 });
  }
}

// ✅ استقبال الرسائل من واتساب والرد - POST
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const sender = message?.from;
    const text = message?.text?.body;

    if (sender && text) {
      // 👇 إرسال إلى الذكاء الصناعي
      const aiRes = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const aiData = await aiRes.json();
      const reply = aiData?.reply || 'رد تلقائي';

      // 👇 إرسال الرد عبر WhatsApp Cloud API
      await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: sender,
          text: { body: reply },
        }),
      });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
