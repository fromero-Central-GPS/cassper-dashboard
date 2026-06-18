import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp-integration';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contactId, message, isTemplate } = body;

    if (!contactId || !message) {
      return NextResponse.json({ success: false, error: 'Missing contactId or message' }, { status: 400 });
    }

    const result = await sendWhatsAppMessage(contactId, message, isTemplate);

    if (result.success) {
      return NextResponse.json({ success: true, data: result });
    } else {
      return NextResponse.json({ success: false, error: 'Unknown error' }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
