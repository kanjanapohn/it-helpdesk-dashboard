import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { lineUid, status, description } = await request.json();

    let messageText = '';
    if (status === 'In Progress') {
      messageText = `👨‍🔧 เจ้าหน้าที่ไอทีได้รับเรื่องปัญหาของคุณแล้วกำลังดำเนินการแก้ไข\n(เคส: ${description})`;
    } else if (status === 'Resolved') {
      messageText = `✅ ปัญหาของคุณได้รับการแก้ไขเรียบร้อยแล้ว\n(เคส: ${description})`;
    }

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: lineUid,
        messages: [{ type: 'text', text: messageText }]
      })
    });

    if (!response.ok) throw new Error('Failed to send LINE message');

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}