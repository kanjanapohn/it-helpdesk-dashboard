'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface UserInfo {
  line_uid: string;
  name?: string | null;
  department?: string | null;
  location?: string | null;
  phone?: string | null;
}

interface Ticket {
  id: number | string;
  created_at: string;
  description: string;
  status: string;
  line_uid: string;
  image_url?: string | null;
  user?: UserInfo | null;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function Dashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    fetchTickets();
    const channel = supabase
      .channel('realtime-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchTickets();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTickets = async () => {
    const { data: ticketsData } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (!ticketsData) return;

    const typedTickets = ticketsData as Ticket[];
    const uids = Array.from(new Set(typedTickets.map((t) => t.line_uid).filter(Boolean)));
    const userMap: Record<string, UserInfo> = {};

    // ดึงข้อมูลผู้แจ้งจากตาราง users มาจับคู่ตาม line_uid
    if (uids.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('line_uid, name, department, location, phone')
        .in('line_uid', uids);

      if (usersData) {
        (usersData as UserInfo[]).forEach((u) => {
          userMap[u.line_uid] = u;
        });
      }
    }

    const mergedTickets: Ticket[] = typedTickets.map((t) => ({
      ...t,
      user: userMap[t.line_uid] || null,
    }));

    setTickets(mergedTickets);
  };

  const updateStatus = async (ticket: Ticket, newStatus: string, closeAfter: boolean = true) => {
    await supabase.from('tickets').update({ status: newStatus }).eq('id', ticket.id);

    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineUid: ticket.line_uid,
        status: newStatus,
        description: ticket.description,
      }),
    });

    if (closeAfter) {
      setSelectedTicket(null);
    } else {
      setSelectedTicket((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const handleViewDetails = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    if (ticket.status === 'Pending') {
      updateStatus(ticket, 'In Progress', false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-blue-800">🖥️ IT Helpdesk Dashboard</h1>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <table className="min-w-full">
            <thead className="bg-blue-50 border-b border-blue-100">
              <tr>
                <th className="py-4 px-6 text-left text-sm font-semibold text-gray-700">เวลาแจ้ง</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-gray-700">ผู้แจ้ง / กลุ่มงาน</th>
                <th className="py-4 px-6 text-left text-sm font-semibold text-gray-700">รายละเอียด</th>
                <th className="py-4 px-6 text-center text-sm font-semibold text-gray-700">สถานะ</th>
                <th className="py-4 px-6 text-center text-sm font-semibold text-gray-700">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="py-4 px-6 text-sm text-gray-600 align-middle whitespace-nowrap">
                    {new Date(ticket.created_at).toLocaleString('th-TH', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>

                  <td className="py-4 px-6 text-sm align-middle">
                    <p className="font-semibold text-gray-800">
                      {ticket.user?.name || 'ยังไม่ระบุชื่อ'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {ticket.user?.department || '-'}
                    </p>
                  </td>

                  <td className="py-4 px-6 text-sm text-gray-800 font-medium max-w-md align-middle">
                    <p className="truncate">{ticket.description}</p>
                    {ticket.image_url && (
                      <span className="inline-block mt-1 text-xs text-blue-500 font-normal">
                        📎 มีรูปภาพแนบ
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-6 text-center align-middle">
                    <span
                      className={`px-3 py-1.5 text-xs font-bold rounded-full shadow-sm inline-block w-28 ${
                        ticket.status === 'Pending'
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : ticket.status === 'In Progress'
                          ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                          : 'bg-green-100 text-green-700 border border-green-200'
                      }`}
                    >
                      {ticket.status === 'Pending'
                        ? '🔴 รอดำเนินการ'
                        : ticket.status === 'In Progress'
                        ? '🟡 กำลังแก้ไข'
                        : '🟢 ปิดงาน'}
                    </span>
                  </td>
                  <td className="py-4 px-6 flex justify-center gap-2 align-middle">
                    <button
                      onClick={() => handleViewDetails(ticket)}
                      className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 shadow-md transition-transform active:scale-95"
                    >
                      🔍 ข้อมูล
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= Popup (Modal) ================= */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4 flex justify-between items-center shrink-0">
              <h2 className="text-white font-bold text-xl flex items-center gap-2">
                <span>📋</span> รายละเอียดการแจ้งปัญหา
              </h2>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-white/80 hover:text-white text-3xl transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              {/* กล่องข้อมูลผู้แจ้ง */}
              <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  ข้อมูลผู้แจ้งและสถานที่
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">👤 ชื่อ-นามสกุล: </span>
                    <span className="font-semibold text-gray-800">
                      {selectedTicket.user?.name || 'ยังไม่ลงทะเบียน'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">🏢 กลุ่มงาน: </span>
                    <span className="font-semibold text-gray-800">
                      {selectedTicket.user?.department || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">📍 สถานที่: </span>
                    <span className="font-semibold text-gray-800">
                      {selectedTicket.user?.location || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">📞 เบอร์โทร: </span>
                    {selectedTicket.user?.phone ? (
                      <a
                        href={`tel:${selectedTicket.user.phone}`}
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        {selectedTicket.user.phone}
                      </a>
                    ) : (
                      <span className="font-semibold text-gray-800">-</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-6 flex justify-between items-start gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-500 mb-2">อาการที่แจ้ง:</p>
                  <p className="text-lg text-gray-800 bg-blue-50/50 p-4 rounded-xl border border-blue-100 whitespace-pre-wrap">
                    {selectedTicket.description}
                  </p>
                </div>
                <div className="shrink-0 mt-6">
                  <span
                    className={`px-4 py-2 text-sm font-bold rounded-full shadow-sm whitespace-nowrap ${
                      selectedTicket.status === 'Pending'
                        ? 'bg-red-100 text-red-700'
                        : selectedTicket.status === 'In Progress'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {selectedTicket.status === 'Pending'
                      ? '🔴 รอดำเนินการ'
                      : selectedTicket.status === 'In Progress'
                      ? '🟡 รับเรื่องแล้ว'
                      : '🟢 ปิดงานแล้ว'}
                  </span>
                </div>
              </div>

              {selectedTicket.image_url && (
                <div className="mb-6">
                  <p className="text-sm font-semibold text-gray-500 mb-2">ภาพประกอบ:</p>
                  <div className="bg-gray-50 rounded-xl p-2 border border-gray-200 flex justify-center items-center">
                    <img
                      src={selectedTicket.image_url}
                      alt="รูปประกอบ"
                      className="w-auto h-auto max-w-full max-h-[40vh] object-contain rounded-lg drop-shadow-sm"
                    />
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-gray-100 shrink-0">
                {selectedTicket.status !== 'Resolved' ? (
                  <button
                    onClick={() => updateStatus(selectedTicket, 'Resolved', true)}
                    className="w-full bg-green-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-600 shadow-md transition-all active:scale-95"
                  >
                    ✅ ซ่อมเสร็จแล้ว (คลิกเพื่อปิดงาน)
                  </button>
                ) : (
                  <div className="w-full text-center text-green-700 font-bold py-4 bg-green-50 rounded-xl border border-green-200">
                    ✅ เคสนี้ได้รับการแก้ไขและปิดงานเรียบร้อยแล้ว
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}