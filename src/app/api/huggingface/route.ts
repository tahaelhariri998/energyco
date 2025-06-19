// app/api/chat-novita/route.ts
import { NextResponse } from 'next/server';
import { InferenceClient } from "@huggingface/inference";

type ChatCompletionRequestMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const SYSTEM_MESSAGE_CONTENT = `أنت عضو في فريق خدمة عملاء إنرجكو للطاقة.
مهمتك هي التواصل مع العملاء، فهم احتياجاتهم، وتقديم المساعدة والإجابة على استفساراتهم المتعلقة بمنتجات الطاقة الشمسية.
هام جداً:
يجب عليك الإجابة على استفسارات العملاء المتعلقة بالمنتجات والأسعار المذكورة حصرياً في "قائمة منتجات وأسعار إنرجكو المعتمدة" أدناه.
طريقة عرض الأسعار: عند الرد على استفسار عن الأسعار، يجب عليك عرض السعرين لكل منتج بوضوح تام كما في الجدول. اذكر "سعر الجملة (10 قطع فأكثر)" و "سعر التجزئة (أقل من 10 قطع)" لكل بند. لا تكتفِ بذكر السعر الأساسي مع ملاحظة في النهاية.
إذا سأل العميل عن منتج غير مدرج، رد بلطف بأن المعلومة غير متوفرة لديك حالياً.
تحدث دائماً بلباقة ومهنية، واستخدم نفس لغة العميل (العربية أو الإنجليزية).
قائمة منتجات وأسعار إنرجكو للطاقة المعتمدة (الأسعار بالدولار الأمريكي $):
الرقم	وصف المنتج	الضمان	سعر الجملة (10 قطع فأكثر)	سعر التجزئة (أقل من 10 قطع)
1.	Deye 6 kW single-phase Hybrid Inverter (SUN-6K-SG04LP1-EU-SM2)	5 سنوات	820$	902$
2.	Deye 6 kW single-phase Off Grid Inverter (SUN-6K-OG01LB1-EU-AM3)	4 سنوات	460$	506$
3.	Deye 12 kW three-phase Hybrid Inverter (SUN-12K-SG04LP3-EU)	5 سنوات	1695$	1864.5$
4.	Deye 16 kW single-phase Hybrid Inverter (SUN-16K-SG01LP1-EU)	5 سنوات	2100$	2310$
5.	Deye 20 kW three-phase Hybrid Inverter (SUN-20k-SG05LP3-EU-SM2)	5 سنوات	2600$	2860$
6.	Deye 5.1 kWh L.V lithium Battery (SE-G5.1)	4 سنوات	625$	687.5$
7.	Deye 10.2 kWh L.V lithium Battery (SE-G10.2)	4 سنوات	1140$	1254$
8.	Deye 30 kW three-phase Hybrid Inverter (SUN-30k-SG01HP3-EU-BM3)	5 سنوات	3900$	4290$
9.	Deye SUN-50K-SG01HP3-EU-BM4	5 سنوات	4400$	4840$
10.	Deye BOS-G PRO HV lithium Battery	5 سنوات	820$	902$
11.	Deye BOS-G H-Rack (13 layer)	5 سنوات	300$	330$
12.	BOS-G CONTROL BOX	5 سنوات	700$	770$
13.	BOS-A7.68 HV lithium Battery	5 سنوات	1150$	1265$
14.	14 LAYER RACK	5 سنوات	330$	363$
15.	CONTROL BOX (PDU-2-BOS-A)	5 سنوات	950$	1045$
16.	LONGI SOLAR 615W HI-MO-7 Bifacial Module with Dual Glass	12 سنة	75$	78.75$`;

export async function POST(request: Request) {
  try {
    const { prompt, history } = await request.json();

    const apiKey = process.env.HUGGINGFACE_API_TOKEN;
    const modelId = process.env.HF_NOVITA_DEEPSEEK_MODEL || "deepseek-ai/DeepSeek-V3-0324";

    if (!apiKey) {
      console.error('Hugging Face API token not configured.');
      return NextResponse.json({ error: 'API token not configured' }, { status: 500 });
    }
    if (!modelId) {
        console.error('Novita DeepSeek Model ID not configured.');
        return NextResponse.json({ error: 'Model ID not configured' }, { status: 500 });
    }

    if (!prompt && (!history || history.length === 0)) {
        return NextResponse.json({ error: 'Prompt or history is required' }, { status: 400 });
    }

    const apiMessages: ChatCompletionRequestMessage[] = [
      { role: 'system', content: SYSTEM_MESSAGE_CONTENT }
    ];

    if (history && Array.isArray(history)) {
      const filteredHistory = history.filter(msg => msg.role && msg.content && msg.role !== 'system');
      apiMessages.push(...filteredHistory);
    }
    if (prompt) {
      apiMessages.push({ role: 'user', content: prompt });
    }

    if (apiMessages.filter(m => m.role === 'user').length === 0) {
     return NextResponse.json({ error: 'No user messages to send' }, { status: 400 });
    }

    const client = new InferenceClient(apiKey);

    console.log(`Sending to Novita via HF Client. Model: ${modelId}. Messages:`, JSON.stringify(apiMessages, null, 2));

    const chatCompletion = await client.chatCompletion({
      provider: "novita",
      model: modelId,
      messages: apiMessages,
      // max_tokens: 500, // يمكنك تعديل هذه القيم حسب الحاجة
      temperature: 0.5,
    });

    const assistantReplyMessage = chatCompletion.choices?.[0]?.message;

    if (!assistantReplyMessage) {
      console.error("No message content in Novita's response:", chatCompletion);
      return NextResponse.json({ error: "Failed to get a valid reply from the model provider." }, { status: 500 });
    }

    return NextResponse.json({ reply: assistantReplyMessage });

  } catch (error: unknown) {
    console.error("Error in api/chat-novita:", error);
    let errorMessage = "An unexpected error occurred.";
    let errorStatus = 500;
    if (typeof error === "object" && error !== null) {
      const errObj = error as { message?: string; status?: number; cause?: { message?: string; status?: number } };
      if (
        "cause" in errObj &&
        typeof errObj.cause === "object" &&
        errObj.cause !== null &&
        "message" in errObj.cause
      ) {
        errorMessage = errObj.cause.message as string;
      } else if ("message" in errObj) {
        errorMessage = errObj.message as string;
      }
      if ("status" in errObj) {
        errorStatus = errObj.status as number;
      } else if (
        "cause" in errObj &&
        typeof errObj.cause === "object" &&
        errObj.cause !== null &&
        "status" in errObj.cause
      ) {
        errorStatus = errObj.cause.status as number;
      }
    }
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
}