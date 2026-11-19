import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const {
      lineUid,
      status,
      description,
      name,
      department,
      location,
      phone,
      hasImage,
    } = await request.json();

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'Missing LINE_CHANNEL_ACCESS_TOKEN' },
        { status: 500 }
      );
    }

    let to = '';
    let messages = [];

    // ========================================================
    // กรณีที่ 1: มีการแจ้งปัญหาใหม่ -> ส่งการ์ดเข้ากลุ่ม LINE ทีม IT
    // ========================================================
    if (status === 'New') {
      const groupId = process.env.LINE_IT_GROUP_ID;
      if (!groupId) {
        return NextResponse.json(
          { error: 'Missing LINE_IT_GROUP_ID' },
          { status: 500 }
        );
      }

      const origin = request.headers.get('origin') || '';
      const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || origin;
      const cleanDesc = (description && description.trim()) || '-';

      const bubble = {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#DC2626',
          contents: [
            {
              type: 'text',
              text: '🚨 มีการแจ้งปัญหา IT ใหม่',
              color: '#FFFFFF',
              weight: 'bold',
              size: 'lg',
            },
          ],
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'text',
              text: 'อาการที่แจ้ง:',
              size: 'xs',
              color: '#6B7280',
              weight: 'bold',
            },
            {
              type: 'text',
              text: cleanDesc,
              wrap: true,
              size: 'md',
              weight: 'bold',
              color: '#111827',
            },
            {
              type: 'separator',
              margin: 'md',
            },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'md',
              spacing: 'xs',
              contents: [
                { type: 'text', text: `👤 ผู้แจ้ง: ${name || '-'}`, size: 'sm', wrap: true },
                { type: 'text', text: `🏢 กลุ่มงาน: ${department || '-'}`, size: 'sm', wrap: true },
                { type: 'text', text: `📍 สถานที่: ${location || '-'}`, size: 'sm', wrap: true },
                { type: 'text', text: `📞 เบอร์โทร: ${phone || '-'}`, size: 'sm', wrap: true },
                ...(hasImage
                  ? [{ type: 'text', text: '📎 มีรูปภาพแนบในระบบ', size: 'sm', color: '#2563EB' }]
                  : []),
              ],
            },
          ],
        },
      };

      // ปุ่มเปิด Dashboard (คลิกเปิดเบราว์เซอร์ได้ทั้งบน LINE PC และมือถือ)
      if (dashboardUrl && dashboardUrl.startsWith('https://')) {
        bubble.footer = {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#1D4ED8',
              action: {
                type: 'uri',
                label: '🖥️ เปิดดูใน Dashboard',
                uri: dashboardUrl,
              },
            },
          ],
        };
      }

      to = groupId;
      messages = [
        {
          type: 'flex',
          altText: `🚨 แจ้งปัญหา IT ใหม่: ${cleanDesc.slice(0, 300)}`,
          contents: bubble,
        },
      ];
    }

    // ========================================================
    // กรณีที่ 2: อัปเดตสถานะจาก Dashboard -> ส่งข้อความหาผู้แจ้ง
    // ========================================================
    else if (status === 'In Progress' || status === 'Resolved') {
      if (!lineUid) {
        return NextResponse.json({ error: 'Missing lineUid' }, { status: 400 });
      }

      const messageText =
        status === 'In Progress'
          ? `👨‍🔧 เจ้าหน้าที่ไอทีได้รับเรื่องปัญหาของคุณแล้วกำลังดำเนินการแก้ไข\n(เคส: ${description})`
          : `✅ ปัญหาของคุณได้รับการแก้ไขเรียบร้อยแล้ว\n(เคส: ${description})`;

      to = lineUid;
      messages = [{ type: 'text', text: messageText }];
    } else {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // ส่งข้อความผ่าน LINE Messaging API
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to, messages }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('LINE Push Error:', errText);
      throw new Error(`Failed to send LINE message: ${errText}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notify API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}