// app/api/groq/route.ts
import { NextResponse } from 'next/server';
import Groq from "groq-sdk";
import { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
const SYSTEM_MESSAGE_CONTENT = `أنت عضو في فريق خدمة عملاء إنرجكو للطاقة.
مهمتك هي التواصل مع العملاء، فهم احتياجاتهم، وتقديم المساعدة والإجابة على استفساراتهم المتعلقة بمنتجات الطاقة الشمسية.
هام جداً:
يجب عليك الإجابة على استفسارات العملاء المتعلقة بالمنتجات والأسعار المذكورة حصرياً في "قائمة منتجات وأسعار إنرجكو المعتمدة" الموجودة أدناه. لا تقدم أي معلومات أو أسعار غير موجودة في هذه القائمة.
قاعدة التسعير للكميات الصغيرة: الأسعار المذكورة في القائمة هي للطلبات بكمية 10 قطع أو أكثر.
إذا طلب العميل كمية أقل من 10 قطع، قم بإضافة 10% على سعر الوحدة المذكور.
استثناء: بالنسبة لألواح الطاقة الشمسية (البند رقم 16)، قم بإضافة 5% فقط على سعر الوحدة للكميات الصغيرة.
إذا سأل العميل عن منتج أو سعر غير مدرج، يجب أن ترد بلطف ووضوح بأن هذه المعلومة غير متوفرة لديك حالياً ضمن القائمة المعتمدة. مثال للرد: "أعتذر، لا تتوفر لدي معلومات عن [المنتج المطلوب] في الوقت الحالي. هل يمكنني مساعدتك بأحد المنتجات المتوفرة في قائمتنا؟"
تحدث دائماً بلباقة، مهنية، وبأسلوب ودود. استمر في التحدث مع العميل بنفس اللغة التي بدأ بها (العربية أو الإنجليزية).
قائمة منتجات وأسعار إنرجكو للطاقة المعتمدة (الأسعار بالدولار الأمريكي $):
الرقم	وصف المنتج	الضمان	السعر الأساسي (لـ 10 قطع فأكثر)
1.	Deye 6 kW single-phase Hybrid Inverter (SUN-6K-SG04LP1-EU-SM2)	5 سنوات	820$
2.	Deye 6 kW single-phase Off Grid Inverter (SUN-6K-OG01LB1-EU-AM3)	4 سنوات	460$
3.	Deye 12 kW three-phase Hybrid Inverter (SUN-12K-SG04LP3-EU)	5 سنوات	1695$
4.	Deye 16 kW single-phase Hybrid Inverter (SUN-16K-SG01LP1-EU)	5 سنوات	2100$
5.	Deye 20 kW three-phase Hybrid Inverter (SUN-20k-SG05LP3-EU-SM2)	5 سنوات	2600$
6.	Deye 5.1 kWh L.V lithium Battery (SE-G5.1)	4 سنوات	625$
7.	Deye 10.2 kWh L.V lithium Battery (SE-G10.2)	4 سنوات	1140$
8.	Deye 30 kW three-phase Hybrid Inverter (SUN-30k-SG01HP3-EU-BM3)	5 سنوات	3900$
9.	Deye SUN-50K-SG01HP3-EU-BM4	5 سنوات	4400$
10.	Deye BOS-G PRO HV lithium Battery	5 سنوات	820$
11.	Deye BOS-G H-Rack (13 layer)	5 سنوات	300$
12.	BOS-G CONTROL BOX	5 سنوات	700$
13.	BOS-A7.68 HV lithium Battery	5 سنوات	1150$
14.	14 LAYER RACK	5 سنوات	330$
15.	CONTROL BOX (PDU-2-BOS-A)	5 سنوات	950$
16.	LONGI SOLAR 615W HI-MO-7 Bifacial Module with Dual Glass	12 سنة	75$`;

export async function POST(request: Request) {
  try {
    const { prompt, history } = await request.json();

    const apiKey = process.env.GROQ_API_KEY;
    const modelId = process.env.GROQ_MODEL_ID || "llama3-8b-8192";

    if (!apiKey) {
      console.error('Groq API key not configured.');
      return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 });
    }
    if (!prompt && (!history || history.length === 0)) {
      return NextResponse.json({ error: 'Prompt or history is required' }, { status: 400 });
    }

    const groq = new Groq({ apiKey });

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: SYSTEM_MESSAGE_CONTENT,
      }
    ];

    if (history && Array.isArray(history)) {
      messages.push(...history.filter(msg => msg.role && msg.content && (msg.role === 'user' || msg.role === 'assistant')));
    }
    if (prompt) {
      messages.push({ role: 'user', content: prompt });
    }
    
    if (messages.filter(m => m.role === 'user').length === 0 && messages.length > 1) {
        return NextResponse.json({ error: 'No user messages to send' }, { status: 400 });
    }

    console.log(`Sending to Groq (${modelId}) with messages:`, JSON.stringify(messages, null, 2));

    const completion = await groq.chat.completions.create({
      messages: messages,
      model: modelId,
      temperature: 0.5, // يمكنك تعديل هذه القيم حسب الحاجة
      // max_tokens: 1024,
      // stream: true,
    });

    const assistantReplyContent = completion.choices[0]?.message?.content;

    if (!assistantReplyContent) {
      console.error("No message content in Groq's response:", completion);
      return NextResponse.json({ error: "Failed to get a valid reply from Groq." }, { status: 500 });
    }

    return NextResponse.json({
      reply: {
        role: 'assistant',
        content: assistantReplyContent,
      }
    });

  } catch (error: unknown) {
    console.error("Error in /api/groq:", error);
    const errorMessage = typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message: string }).message
      : "An unexpected error occurred with Groq API.";
    const errorStatus = typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status: number }).status
      : 500;
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
}