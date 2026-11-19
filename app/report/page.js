'use client';
import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ReportForm() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lineUid, setLineUid] = useState('');
  
  // สถานะการลงทะเบียน
  const [isRegistered, setIsRegistered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // ข้อมูลผู้แจ้ง
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');

  // ข้อมูลปัญหา
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const profile = await liff.getProfile();
        setLineUid(profile.userId);

        // เช็กข้อมูลใน Supabase ว่าเคยลงทะเบียนหรือยัง
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('line_uid', profile.userId)
          .single();

        if (user && user.name && user.department) {
          setName(user.name);
          setDepartment(user.department);
          setLocation(user.location || '');
          setPhone(user.phone || '');
          setIsRegistered(true);
        }
      } catch (err) {
        console.error('LIFF Error:', err);
      } finally {
        setLoading(false);
      }
    };
    initLiff();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !department || !description) {
      alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    setSubmitting(true);
    try {
      // 1. บันทึก/อัปเดตข้อมูลผู้แจ้ง (ทำครั้งเดียว หรือตอนกดแก้ไข)
      await supabase.from('users').upsert({
        line_uid: lineUid,
        name,
        department,
        location,
        phone
      }, { onConflict: 'line_uid' });

      // 2. อัปโหลดรูปภาพ (ถ้ามี)
      let imageUrl = null;
      if (imageFile) {
        const fileName = `${lineUid}_${Date.now()}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from('ticket-images')
          .upload(fileName, imageFile);
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from('ticket-images')
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      // 3. บันทึก Ticket ลงฐานข้อมูล
      const { error: ticketErr } = await supabase.from('tickets').insert([{
        line_uid: lineUid,
        description: description,
        image_url: imageUrl,
        status: 'Pending'
      }]);
      if (ticketErr) throw ticketErr;

      alert('✅ ส่งเรื่องแจ้งปัญหาเรียบร้อยแล้วครับ!');
      liff.closeWindow(); // ปิดหน้าต่างฟอร์มกลับเข้าแชท LINE อัตโนมัติ
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">กำลังโหลดข้อมูล...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-md p-6">
        <h1 className="text-xl font-bold text-blue-800 mb-4">🛠️ แจ้งปัญหา IT (สสจ.ขอนแก่น)</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ส่วนข้อมูลผู้แจ้ง: ถ้าเคยลงทะเบียนแล้วจะย่อเหลือการ์ดสั้นๆ */}
          {isRegistered && !isEditing ? (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-start">
              <div className="text-sm text-gray-700">
                <p className="font-bold text-blue-900">👤 {name}</p>
                <p>🏢 {department} ({location})</p>
                <p>📞 {phone || '-'}</p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsEditing(true)}
                className="text-xs text-blue-600 underline"
              >
                แก้ไข
              </button>
            </div>
          ) : (
            <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <p className="text-xs font-bold text-gray-500">ข้อมูลผู้แจ้ง (กรอกครั้งเดียวจบ)</p>
              <input
                type="text"
                placeholder="ชื่อ-นามสกุล *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
                required
              />
              <input
                type="text"
                placeholder="กลุ่มงาน / ฝ่าย * (เช่น การเงิน, ควบคุมโรค)"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
                required
              />
              <input
                type="text"
                placeholder="อาคาร / ชั้น / ห้อง * (เช่น อาคาร 1 ชั้น 2)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
                required
              />
              <input
                type="tel"
                placeholder="เบอร์โทรติดต่อ / เบอร์ภายใน"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
          )}

          {/* ส่วนรายละเอียดปัญหา */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">อาการ / ปัญหาที่พบ *</label>
            <textarea
              rows="3"
              placeholder="อธิบายปัญหา เช่น ปริ้นเตอร์ไม่ทำงาน, เน็ตหลุด..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border rounded-xl text-sm"
              required
            />
          </div>

          {/* ส่วนแนบรูปภาพ */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">แนบรูปภาพประกอบ (ถ้ามี)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files[0])}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-400"
          >
            {submitting ? 'กำลังส่งข้อมูล...' : 'ส่งเรื่องแจ้งปัญหา'}
          </button>
        </form>
      </div>
    </div>
  );
}