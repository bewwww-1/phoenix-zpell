import { createClient } from '@supabase/supabase-js';
import './style.css';

// ==========================================
// 1. SUPABASE
// ==========================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('YOUR_PROJECT')
    ? createClient(supabaseUrl, supabaseKey)
    : null;

let session = null;
let profile = null;
let active = 'overview';
let signingUp = false;

let cache = {
  staff: [],
  services: [],
  members: [],
  appointments: [],
  applications: []
};

const $ = selector => document.querySelector(selector);

const money = n =>
  '฿' + Number(n || 0).toLocaleString('th-TH');

const dateToday = () =>
  new Date().toISOString().slice(0, 10);

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);

const allowedStaffRoles = [
  'manager',
  'receptionist',
  'stylist',
  'assistant'
];

const roleNames = {
  owner: 'เจ้าของร้าน',
  manager: 'ผู้จัดการ',
  receptionist: 'พนักงานต้อนรับ',
  stylist: 'ช่างทำผม',
  assistant: 'ผู้ช่วยช่าง',
  customer: 'ลูกค้า'
};

function toast(message, bad = false) {
  const el = $('#toast');

  if (!el) {
    console[bad ? 'error' : 'log'](message);
    return;
  }

  el.textContent = message;
  el.className = 'toast show' + (bad ? ' bad' : '');

  setTimeout(() => {
    el.className = 'toast';
  }, 3200);
}

function avatarMarkup(sizeClass = '') {
  return profile?.avatar_url
    ? `<img class="${sizeClass}" src="${esc(profile.avatar_url)}"
        alt="รูปโปรไฟล์"
        style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
    : esc(
        (profile?.full_name || session?.user?.email || 'P')
          .slice(0, 1)
          .toUpperCase()
      );
}

// ==========================================
// 2. LOGIN
// ==========================================

function loginView() {
  session = null;
  profile = null;

  $('#app').innerHTML = `
    <main class="login-shell">
      <section class="login-art">
        <div class="brand-mark">P</div>
        <div class="brand-word">Phoenix</div>
        <p>HAIR SPA RITUAL</p>
        <div class="art-line"></div>
        <small>THE ART OF BEAUTIFUL HAIR</small>
      </section>

      <section class="login-panel">
        <div class="login-content">
          <span class="eyebrow">SALON MANAGEMENT</span>
          <h1>ยินดีต้อนรับ</h1>
          <p class="muted">เข้าสู่ระบบจัดการร้าน Phoenix Zpell</p>

          <form id="loginForm">
            <label>อีเมล
              <input name="email" type="email"
                placeholder="name@phoenix.com" required>
            </label>

            <label>รหัสผ่าน
              <input name="password" type="password"
                placeholder="กรอกรหัสผ่าน" required>
            </label>

            <button class="primary full" type="submit">
              เข้าสู่ระบบ
            </button>
          </form>

          <div class="login-note">
            ${supabase
              ? 'เชื่อมต่อฐานข้อมูลแล้ว'
              : 'โหมดตัวอย่าง · ตั้งค่า Supabase เพื่อเปิดใช้งานฐานข้อมูลจริง'}
          </div>

          <button class="text-button" id="staffSignupBtn">
            สมัครเป็นพนักงาน
          </button>

          <button class="text-button" id="demoBtn">
            ดูตัวอย่างระบบ
          </button>
        </div>
      </section>
    </main>

    <div id="toast" class="toast"></div>
  `;

  $('#staffSignupBtn').onclick = employeeSignupView;

  $('#demoBtn').onclick = () => {
    session = {
      user: { email: 'demo@phoenixzpell.com' }
    };

    profile = {
      full_name: 'Phoenix Demo',
      role: 'owner'
    };

    loadDemo();
    render();
  };

  $('#loginForm').onsubmit = async e => {
    e.preventDefault();

    if (!supabase) {
      return toast('ยังไม่ได้เชื่อมต่อ Supabase', true);
    }

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    const button = e.currentTarget.querySelector('button[type="submit"]');

    button.disabled = true;
    button.textContent = 'กำลังเข้าสู่ระบบ...';

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      if (!data?.session) {
        throw new Error('ไม่พบ Session กรุณาลองเข้าสู่ระบบอีกครั้ง');
      }

      await boot(data.session);

    } catch (err) {
      console.error(err);
      toast(err.message || 'เข้าสู่ระบบไม่สำเร็จ', true);

    } finally {
      if ($('#loginForm')) {
        button.disabled = false;
        button.textContent = 'เข้าสู่ระบบ';
      }
    }
  };
}

// ==========================================
// 3. EMPLOYEE SIGNUP
// ==========================================

function employeeSignupView() {
  loginView();
  toast('การสมัครพนักงานปิดให้บริการ กรุณาติดต่อเจ้าของร้าน');
}

// ==========================================
// 4. DEMO DATA
// ==========================================

const staffSeed = [
  ['NU', 'ช่างนุ', 'Senior Hair Stylist', 'Cut & Blow, Styling'],
  ['MUYONG', 'ช่างหมูหยอง', 'Colorist Specialist', 'ORDEVE, Schwarzkopf'],
  ['AOF', 'ช่างอ๊อฟ', 'Perm & Straightening Specialist', 'Digital Perm, Relaxing'],
  ['BEE', 'ช่างบี', 'Highlights & Bleaching Specialist', 'Highlights, Bleaching'],
  ['BAM', 'ช่างแบม', 'Keratin & Treatment Specialist', 'Brazilian Blowout, Olaplex'],
  ['POR', 'ช่างปอ', 'Hair Stylist & Updo', 'Cut & Blow, Hair Up']
];

const catalog = [
  ['ตัดและจัดแต่งทรง', 'Cut & Styling', [
    ['Cut & Blow', 'ตัดผม + สระไดร์', 500, 500],
    ['Blow Dry', 'สระไดร์', 200, 500],
    ['Hair up + Make up', 'เกล้าผม + แต่งหน้า', 2000, 2000]
  ]],
  ['ทำสีและฟอกผม', 'Color & Highlights', [
    ['ORDEVE', 'ทำสีออร์ดีฟ', 2500, 4500],
    ['Schwarzkopf ZERO AMM', 'ทำสีชวาร์สคอฟ', 2500, 4500],
    ['Schwarzkopf + LECTURA', 'ทำสีชวาร์สคอฟ + เลคทูร่า', 2000, 4000],
    ['Glossing', 'Semi-permanent color', 1500, 3500],
    ['Prelightening / Bleaching', 'ฟอกสีผม Step 1–3', 500, 3500],
    ['Hilight / Lowlight', 'ไฮไลท์ครึ่งศีรษะ / เต็มศีรษะ', 1500, 4000]
  ]],
  ['ดัดและยืดผม', 'Perm & Relaxing', [
    ['Digital Perm', 'ดัดดิจิตอล', 3000, 5500],
    ['Shiseido ISO Cold Perm', 'ดัดเย็น', 1500, 3500],
    ['Down Perm', 'ดาวเพิร์ม', 1500, 1500],
    ['Foil Perm', 'ดัดฟอยล์', 2500, 3000],
    ['Relaxing', 'ยืดผม', 2000, 5000]
  ]],
  ['ทรีทเม้นท์และบำรุง', 'Treatment & Care', [
    ['Brazilian Blowout', 'บราซิเลี่ยน โบลว์เอาท์', 3500, 6500],
    ['Keratin Complex', 'เคราติน คอมเพล็กซ์', 4000, 7500],
    ['Olaplex Bond Strengthening', 'บำรุงโครงสร้างเส้นผม', 3000, 4000],
    ['Moroccanoil Treatment', 'โมรอคแคนออยล์', 1500, 3500],
    ['Joico 4 pac', '4 ขั้นตอน', 1500, 3000],
    ['FIBERPLEX / LECTURA', 'เชื่อมแกน LECTURA', 1500, 3000],
    ['Nioxin', 'ล้างสารเคมี', 2500, 3000]
  ]]
];

function loadDemo() {
  cache.staff = staffSeed.map((x, i) => ({
    id: 'demo' + i,
    nickname: x[0],
    name_th: x[1],
    role: x[2],
    specialty: x[3],
    active: true
  }));

  cache.services = catalog.flatMap((c, i) =>
    c[2].map((s, j) => ({
      id: `s${i}${j}`,
      category_th: c[0],
      category_en: c[1],
      name: s[0],
      description: s[1],
      price_min: s[2],
      price_max: s[3],
      active: true
    }))
  );

  cache.members = [{
    id: 'm1',
    full_name: 'คุณลูกค้าตัวอย่าง',
    phone: '08X-XXX-XXXX',
    created_at: new Date().toISOString()
  }];

  cache.appointments = [{
    id: 'a1',
    appointment_date: dateToday(),
    appointment_time: '10:30',
    customer_name: 'คุณลูกค้าตัวอย่าง',
    staff_nickname: 'NU',
    service_name: 'Cut & Blow',
    price: 500,
    status: 'confirmed'
  }];
}

// ==========================================
// 5. LOGIN AUTHENTICATION
// ==========================================

async function boot(s) {
  if (!s?.user?.id) {
    session = null;
    profile = null;
    loginView();
    return;
  }

  session = s;

  if (!supabase) {
    loadDemo();
    render();
    return;
  }

  try {
    const { data: p, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', s.user.id)
      .maybeSingle();

    if (error) throw error;

    const allowedRoles = [
      'owner',
      'manager',
      'receptionist',
      'stylist',
      'assistant'
    ];

    if (!p || !allowedRoles.includes(String(p.role || '').toLowerCase())) {
      const { data: application } = await supabase
        .from('staff_applications')
        .select('status')
        .eq('user_id', s.user.id)
        .eq('status', 'pending')
        .maybeSingle();

      await supabase.auth.signOut();

      session = null;
      profile = null;
      loginView();

      if (application) {
        toast('ใบสมัครของคุณกำลังรอเจ้าของร้านอนุมัติ');
      } else {
        toast('บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบหลังบ้าน', true);
      }

      return;
    }

    profile = p;

    await refresh();

if (profile.role === 'owner') {
  await refreshApplications();
}

render();
  } catch (err) {
    console.error('Boot error:', err);

    await supabase.auth.signOut();

    session = null;
    profile = null;
    loginView();

    toast(err.message || 'ตรวจสอบข้อมูลผู้ใช้งานไม่สำเร็จ', true);
  }
}

// ==========================================
// 6. LOAD DATA
// ==========================================

async function refresh() {
  const [st, se, me, ap] = await Promise.all([
    supabase.from('staff').select('*').order('nickname'),

    supabase.from('services')
      .select('*')
      .eq('active', true)
      .order('category_th'),

    supabase.from('members')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),

    supabase.from('appointments')
      .select('*, staff(nickname), services(name), members(full_name)')
      .order('appointment_date', { ascending: false })
      .limit(100)
  ]);

  if (st.error || se.error || me.error || ap.error) {
    const error = st.error || se.error || me.error || ap.error;
    toast(error.message || 'โหลดข้อมูลไม่สำเร็จ', true);
    throw error;
  }

  cache.staff = st.data || [];
  cache.services = se.data || [];
  cache.members = me.data || [];

  cache.appointments = (ap.data || []).map(a => ({
    ...a,
    staff_nickname: a.staff?.nickname || '-',
    service_name: a.services?.name || '-',
    customer_name: a.members?.full_name || a.customer_name || '-'
  }));
}

async function refreshApplications() {
  const { data, error } = await supabase
    .from('staff_applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const applications = data || [];
  const userIds = [...new Set(applications.map(a => a.user_id))];

  let profiles = [];

  if (userIds.length) {
    const result = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    if (result.error) throw result.error;
    profiles = result.data || [];
  }

  cache.applications = applications.map(a => ({
    ...a,
    applicant_name:
      profiles.find(p => p.id === a.user_id)?.full_name || 'ไม่พบชื่อ'
  }));
}

// ==========================================
// 7. NAVIGATION
// ==========================================

const nav = [
  ['overview', 'layout-dashboard', 'ภาพรวม'],
  ['booking', 'calendar-plus', 'จองคิว'],
  ['pos', 'receipt', 'ขายหน้าร้าน (POS)'],
  ['schedule', 'calendar-days', 'ตารางงาน'],
  ['staff', 'users', 'ทะเบียนช่าง'],
  ['my-commission', 'chart-no-axes-combined', 'แดชบอร์ดค่าคอมมิชชัน'],
  ['staff-accounts', 'users', 'จัดการบัญชีพนักงาน'],
  ['services', 'scissors', 'ประเภทบริการ'],
  ['members', 'contact-round', 'ทะเบียนสมาชิก'],
  ['applications', 'users', 'ใบสมัครพนักงาน'],
  ['reports', 'chart-no-axes-combined', 'รายงาน'],
  ['profile', 'user-round', 'โปรไฟล์'],
  ['settings', 'settings', 'ตั้งค่าระบบ']
];

function icon(name) {
  const paths = {
    'layout-dashboard': '▦',
    'receipt': '▤',
    'calendar-plus': '＋',
    'calendar-days': '▤',
    'users': '♧',
    'scissors': '✂',
    'contact-round': '◎',
    'chart-no-axes-combined': '⌁',
    'settings': '⚙',
    'user-round': '◉'
  };

  return paths[name] || '•';
}

function render() {
const allowedPOSRoles = [
  'owner',
  'manager',
  'receptionist'
];


const visibleNav = nav.filter(item => {
  if (
    item[0] === 'applications' ||
    item[0] === 'staff-accounts'
  ) {
    return profile?.role === 'owner';
  }

  if (item[0] === 'pos') {
    return allowedPOSRoles.includes(profile?.role);
  }

  if (item[0] === 'my-commission') {
    return profile?.role === 'stylist';
  }

  return true;
});


if (
  ['applications', 'staff-accounts'].includes(active) &&
  profile?.role !== 'owner'
) {
  active = 'overview';
}

if (
  active === 'pos' &&
  !allowedPOSRoles.includes(profile?.role)
) {
  active = 'overview';
}
  
if (
  active === 'my-commission' &&
  profile?.role !== 'stylist'
) {
  active = 'overview';
}


  $('#app').innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="side-brand">
          <span class="brand-mark small">P</span>
          <div>
            <div class="brand-word side">Phoenix</div>
            <small>HAIR SPA RITUAL</small>
          </div>
        </div>

        <div class="side-label">MENU</div>

        <nav>
          ${visibleNav.map(([id, ic, title]) => `
            <button class="nav-item ${active === id ? 'active' : ''}"
              data-nav="${id}">
              <span class="nav-icon">${icon(ic)}</span>
              ${title}
            </button>
          `).join('')}
        </nav>

        <div class="side-bottom">
          <div class="user-avatar" data-profile>
            ${avatarMarkup()}
          </div>

          <div class="user-meta" data-profile>
            <b>${esc(profile?.full_name || 'Phoenix')}</b>
            <small>${roleNames[profile?.role] || 'พนักงาน'}</small>
          </div>

          <button class="logout" id="logout" title="ออกจากระบบ">↗</button>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <span class="eyebrow">PHOENIX ZPELL / SALON</span>
            <h2>${nav.find(n => n[0] === active)?.[2] || ''}</h2>
          </div>

          <div class="top-right">
            <span class="today">
              ${new Date().toLocaleDateString('th-TH', {
                weekday: 'short',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </span>

            <span class="top-avatar" data-profile
              style="cursor:pointer;overflow:hidden">
              ${avatarMarkup()}
            </span>
          </div>
        </header>

        <section class="content" id="content">
          ${page()}
        </section>
      </main>

      <div id="toast" class="toast"></div>
    </div>
  `;

  document.querySelectorAll('[data-nav]').forEach(button => {
    button.onclick = () => {
      active = button.dataset.nav;
      render();
    };
  });

  $('#logout').onclick = async () => {
    if (supabase) await supabase.auth.signOut();

    session = null;
    profile = null;
    loginView();
  };

  wirePage();
}

// ==========================================
// 8. PAGE CONTENT
// ==========================================

function page() {
  const ap = cache.appointments;

  const today = ap.filter(
    a => a.appointment_date === dateToday()
  );

  const revenue = ap
    .filter(a => a.status === 'completed')
    .reduce((sum, a) => sum + Number(a.price || 0), 0);
  
  if (active === 'my-commission') {
    return `
      <div class="welcome-row">
        <div>
          <span class="eyebrow">STYLIST DASHBOARD</span>
          <h1>ค่าคอมมิชชันของฉัน <span class="gold">✦</span></h1>
          <p class="muted">สรุปผลงานและรายได้จากการให้บริการ</p>
        </div>
      </div>

      <div class="stats-grid">
        <article class="stat-card dark">
          <span>CUSTOMERS TODAY</span>
          <strong id="myTodayCustomers">-</strong>
          <small>ลูกค้าที่รับบริการวันนี้</small>
        </article>

        <article class="stat-card">
          <span>COMMISSION TODAY</span>
          <strong id="myTodayCommission">-</strong>
          <small>ค่าคอมมิชชันวันนี้</small>
        </article>

        <article class="stat-card">
          <span>CUSTOMERS THIS MONTH</span>
          <strong id="myMonthCustomers">-</strong>
          <small>ลูกค้าที่รับบริการเดือนนี้</small>
        </article>

        <article class="stat-card">
          <span>COMMISSION THIS MONTH</span>
          <strong id="myMonthCommission">-</strong>
          <small>ค่าคอมมิชชันเดือนนี้</small>
        </article>
      </div>

      <div class="section-head">
        <div>
          <span class="eyebrow">SERVICE HISTORY</span>
          <h3>ประวัติค่าคอมมิชชัน</h3>
        </div>
      </div>

      <div class="panel" id="myCommissionHistory">
        <p class="muted">กำลังโหลดข้อมูล...</p>
      </div>
    `;
  }


  if (active === 'overview') {
    return `
      <div class="welcome-row">
        <div>
          <span class="eyebrow">SALON OVERVIEW</span>
          <h1>สวัสดี, ${esc(profile?.full_name || 'Phoenix')}
            <span class="gold">✦</span>
          </h1>
          <p class="muted">ภาพรวมการดำเนินงานของ Phoenix Zpell วันนี้</p>
        </div>

        <button class="primary" data-go="booking">
          ＋ สร้างการจอง
        </button>
      </div>

      <div class="stats-grid">
        <article class="stat-card dark">
          <span>APPOINTMENTS TODAY</span>
          <strong>${today.length.toString().padStart(2, '0')}</strong>
          <small>คิวที่นัดหมายวันนี้</small>
        </article>

        <article class="stat-card">
          <span>ACTIVE STYLISTS</span>
          <strong>${cache.staff.length.toString().padStart(2, '0')}</strong>
          <small>ทีมช่างของเรา</small>
        </article>

        <article class="stat-card">
          <span>REGISTERED MEMBERS</span>
          <strong>${cache.members.length.toString().padStart(2, '0')}</strong>
          <small>สมาชิกทั้งหมด</small>
        </article>

        <article class="stat-card">
          <span>COMPLETED REVENUE</span>
          <strong>${money(revenue)}</strong>
          <small>ยอดจากคิวที่เสร็จสิ้น</small>
        </article>
      </div>

      <div class="section-head">
        <div>
          <span class="eyebrow">DAILY SCHEDULE</span>
          <h3>คิววันนี้</h3>
        </div>
        <button class="quiet" data-go="schedule">ดูตารางงาน →</button>
      </div>

      ${appointmentTable(today)}
    `;
  }

  if (active === 'booking') {
    return `
      <div class="section-head">
        <div>
          <span class="eyebrow">NEW APPOINTMENT</span>
          <h3>สร้างการจองใหม่</h3>
          <p class="muted">เลือกบริการ ช่าง และเวลาที่ลูกค้าสะดวก</p>
        </div>
      </div>

      <div class="panel form-panel">
        <form id="bookingForm" class="form-grid">
          <label>ชื่อลูกค้า
            <input name="customer_name" placeholder="ชื่อลูกค้า" required>
          </label>

          <label>เบอร์โทรศัพท์
            <input name="phone" placeholder="เบอร์โทรศัพท์">
          </label>

          <label>วันที่
            <input name="appointment_date" type="date"
              value="${dateToday()}" required>
          </label>

          <label>เวลา
            <input name="appointment_time" type="time"
              value="10:00" required>
          </label>

          <label>ช่างผู้ให้บริการ
            <select name="staff_id" required>
              ${cache.staff.map(s => `
                <option value="${s.id}">
                  ${esc(s.nickname)} — ${esc(s.name_th)}
                </option>
              `).join('')}
            </select>
          </label>

          <label>บริการ
            <select name="service_id" id="serviceSelect" required>
              ${cache.services.map(s => `
                <option value="${s.id}">
                  ${esc(s.name)} · ${money(s.price_min)}
                </option>
              `).join('')}
            </select>
          </label>

          <label>ราคาประเมิน (บาท)
            <input name="price" id="priceInput" type="number"
              min="0" value="${cache.services[0]?.price_min || 0}" required>
          </label>

          <label>หมายเหตุ
            <input name="notes" placeholder="รายละเอียดเพิ่มเติม">
          </label>

          <div class="form-actions">
            <button class="primary" type="submit">บันทึกการจอง</button>
          </div>
        </form>
      </div>
    `;
  }

  if (active === 'schedule') {
    return `
      <div class="section-head">
        <div>
          <span class="eyebrow">APPOINTMENT LIST</span>
          <h3>ตารางงาน</h3>
        </div>
        <input class="search" id="scheduleSearch"
          placeholder="ค้นหาลูกค้า / ช่าง">
      </div>

      ${appointmentTable(ap)}
    `;
  }


if (active === 'staff') {
  return `
    <div class="section-head">
      <div>
        <span class="eyebrow">OUR PROFESSIONAL TEAM</span>
        <h3>ทะเบียนช่าง</h3>
        <p class="muted">ทีมผู้เชี่ยวชาญ Phoenix Zpell</p>
      </div>
      <button class="primary" id="addStaff">
        ＋ เพิ่มช่างใหม่
      </button>
    </div>

    <div class="staff-grid">
      ${cache.staff.map(s => `
        <article class="staff-card">
          <div class="initial">
            ${esc((s.nickname || '').slice(0, 2))}
          </div>
          <div>
            <h3>${esc(s.nickname || '')}</h3>
            <b>${esc(s.name_th || '')}</b>
            <p>${esc(s.role || '')}</p>
            <small>${esc(s.specialty || '')}</small>

<div class="staff-card-actions">
  <button
    type="button"
    class="secondary edit-staff"
    data-id="${esc(s.id)}"
  >
    ✏️ แก้ไขข้อมูล
  </button>

  <button
    type="button"
    class="${s.active === false ? 'primary' : 'secondary'} toggle-staff"
    data-id="${esc(s.id)}"
    data-active="${s.active !== false}"
  >
    ${s.active === false ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
  </button>
</div>
<!-- EDIT STAFF MODAL -->
<div class="modal-overlay" id="editStaffModal" style="display:none">
  <div class="modal-card">
    <div class="modal-header">
      <div>
        <span class="eyebrow">EMPLOYEE MANAGEMENT</span>
        <h3>แก้ไขข้อมูลช่าง</h3>
        <p class="muted">ปรับปรุงข้อมูลพนักงาน</p>
      </div>

      <button type="button" class="modal-close" id="closeEditStaffModal">
        ✕
      </button>
    </div>

    <form id="editStaffForm" class="form-grid">
      <input type="hidden" name="id">

      <label>ชื่อเล่น
        <input name="nickname" required>
      </label>

      <label>ชื่อ–นามสกุล
        <input name="name_th" required>
      </label>

      <label>ตำแหน่งงาน
        <input name="role">
      </label>

      <label>ความเชี่ยวชาญ
        <input name="specialty">
      </label>

      <label>สถานะการทำงาน
        <select name="active">
          <option value="true">ปฏิบัติงาน</option>
          <option value="false">ไม่ปฏิบัติงาน</option>
        </select>
      </label>

      <div class="form-actions">
        <button type="button" class="secondary" id="cancelEditStaff">
          ยกเลิก
        </button>

        <button type="submit" class="primary" id="saveEditStaff">
          บันทึกการแก้ไข
        </button>
      </div>
    </form>
  </div>
</div>
          </div>
        </article>
      `).join('') || '<p class="empty">ยังไม่มีข้อมูลช่าง</p>'}
    </div>

    <!-- ADD STAFF MODAL -->
    <div class="modal-overlay" id="staffModal" style="display:none">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <span class="eyebrow">EMPLOYEE MANAGEMENT</span>
            <h3>เพิ่มช่างใหม่</h3>
            <p class="muted">กรอกข้อมูลพนักงานให้ครบถ้วน</p>
          </div>
          <button type="button" class="modal-close" id="closeStaffModal">
            ✕
          </button>
        </div>

        <form id="staffForm" class="form-grid">

          <label>ชื่อเล่น
            <input name="nickname" placeholder="เช่น NU" required>
          </label>

          <label>ชื่อ–นามสกุล
            <input name="full_name" placeholder="ชื่อและนามสกุล" required>
          </label>

          <label>อีเมลเข้าสู่ระบบ
            <input name="email" type="email"
              placeholder="employee@example.com" required>
          </label>

          <label>รหัสผ่าน
            <input name="password" type="password"
              minlength="8" placeholder="อย่างน้อย 8 ตัวอักษร" required>
          </label>

          <label>ตำแหน่งงาน
            <input name="job_title"
              placeholder="เช่น Senior Hair Stylist">
          </label>

          <label>ความเชี่ยวชาญ
            <input name="specialty"
              placeholder="เช่น Hair Color, Hair Spa">
          </label>

          <label>สิทธิ์บัญชี
            <select name="account_role" required>
              <option value="">เลือกสิทธิ์บัญชี</option>
              <option value="manager">Manager</option>
              <option value="receptionist">Receptionist</option>
              <option value="stylist">Stylist</option>
              <option value="assistant">Assistant</option>
            </select>
          </label>

          <div class="form-actions">
            <button type="button" class="secondary" id="cancelStaffModal">
              ยกเลิก
            </button>
            <button type="submit" class="primary" id="saveStaff">
              บันทึกข้อมูลช่าง
            </button>
          </div>

        </form>
      </div>
    </div>
  `;
}

// ==========================================
// POS - หน้าขายหน้าร้าน
// ==========================================
if (active === 'pos') {
  const allowedRoles = ['owner', 'manager', 'receptionist'];

  if (!allowedRoles.includes(profile?.role)) {
    return '<div class="panel">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>';
  }

  return `
    <div class="section-head">
      <div>
        <span class="eyebrow">POINT OF SALE</span>
        <h3>ขายหน้าร้าน</h3>
        <p class="muted">
          บันทึกบริการ คำนวณยอดชำระ และออกใบเสร็จให้ลูกค้า
        </p>
      </div>
    </div>

    <form id="posForm">

      <div class="panel">
        <h3>01. ข้อมูลลูกค้า</h3>

        <div class="form-grid">
          <label>
            ชื่อลูกค้า
            <input
              name="customer_name"
              placeholder="ชื่อลูกค้า หรือ Walk-in"
              required
            >
          </label>

          <label>
            เบอร์โทรศัพท์
            <input
              name="customer_phone"
              type="tel"
              placeholder="08X-XXX-XXXX"
            >
          </label>
        </div>
      </div>

      <div class="panel">
        <h3>02. เลือกบริการ</h3>
        <p class="muted">สามารถเลือกได้มากกว่าหนึ่งบริการ</p>

        <div class="form-grid">
          ${
            cache.services.map(service => `
              <label class="service-option">
                <span>
                  <input
                    type="checkbox"
                    name="service_ids"
                    value="${esc(String(service.id))}"
                    data-price="${Number(service.price_min) || 0}"
                  >
                  ${esc(service.name || 'บริการ')}
                </span>

                <b>
                  ${Number(service.price_min || 0).toLocaleString('th-TH')}
                  บาท
                </b>
              </label>
            `).join('')
          || '<p class="muted">ยังไม่มีรายการบริการ กรุณาเพิ่มบริการก่อน</p>'
          }
        </div>
      </div>

      <div class="panel">
        <h3>03. ช่างผู้ให้บริการ</h3>

        <label>
          เลือกช่าง
          <select name="staff_id">
            <option value="">เลือกช่างผู้ให้บริการ</option>

            ${cache.staff.map(staff => `
              <option value="${esc(String(staff.id))}">
                ${esc(staff.nickname || staff.name_th || 'ช่าง')}
              </option>
            `).join('')}
          </select>
        </label>
      </div>

      <div class="panel">
        <h3>04. สรุปยอดชำระ</h3>

        <div class="form-grid">
          <label>
            ส่วนลด (บาท)
            <input
              name="discount"
              type="number"
              min="0"
              value="0"
            >
          </label>

          <label>
            วิธีชำระเงิน
            <select name="payment_method" required>
              <option value="cash">เงินสด</option>
              <option value="transfer">โอนเงิน</option>
              <option value="card">บัตรเครดิต / เดบิต</option>
            </select>
          </label>

          <label>
            จำนวนเงินที่รับมา (บาท)
            <input
              name="amount_received"
              type="number"
              min="0"
              value="0"
              required
            >
          </label>
        </div>

        <div class="pos-summary">
          <div>
            <span>ยอดรวมบริการ</span>
            <b id="posSubtotal">0.00 บาท</b>
          </div>

          <div>
            <span>ส่วนลด</span>
            <b id="posDiscount">0.00 บาท</b>
          </div>

          <div class="pos-total">
            <span>ยอดสุทธิ</span>
            <b id="posTotal">0.00 บาท</b>
          </div>

          <div>
            <span>เงินทอน</span>
            <b id="posChange">0.00 บาท</b>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="primary">
            รับชำระเงินและออกใบเสร็จ
          </button>
        </div>
      </div>

    </form>
  `;
}

  
  
if (active === 'services') {
  const categories = [
    ...new Map(
      cache.services.map(s => [
        s.category_th,
        { th: s.category_th, en: s.category_en }
      ])
    ).values()
  ];

  return `
    <div class="section-head">
      <div>
        <span class="eyebrow">SERVICE MENU</span>
        <h3>ประเภทบริการ</h3>
        <p class="muted">จัดการรายการบริการ ราคา และระยะเวลา</p>
      </div>
      <button class="primary" id="addService">
        ＋ เพิ่มบริการ
      </button>
    </div>

    ${categories.map(c => `
      <div class="service-group">
        <div class="group-title">
          <div>
            <h3>${esc(c.th || '')}</h3>
            <small>${esc(c.en || '')}</small>
          </div>
          <span>
            ${cache.services.filter(s => s.category_th === c.th).length}
            SERVICES
          </span>
        </div>

        <div class="service-list">
          ${cache.services
            .filter(s => s.category_th === c.th)
            .map(s => `
              <div class="service-row">
                <div>
                  <b>${esc(s.name)}</b>
                  <small>${esc(s.description || '')}</small>
                  <small>${Number(s.duration_minutes || 60)} นาที</small>
                </div>
                <strong>
                  ${money(s.price_min)}
                  ${s.price_max > s.price_min
                    ? ' – ' + money(s.price_max)
                    : ''}
                </strong>
              </div>
            `).join('')}
        </div>
      </div>
    `).join('') || '<p class="empty">ยังไม่มีบริการ</p>'}

    <!-- ADD SERVICE MODAL -->
    <div class="modal-overlay" id="serviceModal" style="display:none">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <span class="eyebrow">SERVICE MANAGEMENT</span>
            <h3>เพิ่มบริการใหม่</h3>
            <p class="muted">กรอกรายละเอียดบริการให้ครบถ้วน</p>
          </div>
          <button type="button" class="modal-close"
            id="closeServiceModal">✕</button>
        </div>

        <form id="serviceForm" class="form-grid">

          <label>หมวดหมู่บริการ (ภาษาไทย)
            <input name="category_th" required
              placeholder="เช่น ทำสีผม">
          </label>

          <label>หมวดหมู่บริการ (ภาษาอังกฤษ)
            <input name="category_en"
              placeholder="เช่น Hair Color">
          </label>

          <label>ชื่อบริการ
            <input name="name" required
              placeholder="เช่น Hair Coloring">
          </label>

          <label>รายละเอียดบริการ
            <input name="description"
              placeholder="รายละเอียดบริการ">
          </label>

          <label>ราคาเริ่มต้น (บาท)
            <input name="price_min" type="number"
              min="0" step="0.01" required>
          </label>

          <label>ราคาสูงสุด (บาท)
            <input name="price_max" type="number"
              min="0" step="0.01">
          </label>

          <label>ระยะเวลาให้บริการ (นาที)
            <input name="duration_minutes" type="number"
              min="1" value="60" required>
          </label>

          <label>หมายเหตุราคา
            <input name="price_note"
              placeholder="เช่น ราคาขึ้นอยู่กับความยาวผม">
          </label>

          <div class="form-actions">
            <button type="button" class="secondary"
              id="cancelServiceModal">
              ยกเลิก
            </button>

            <button type="submit" class="primary"
              id="saveService">
              บันทึกบริการ
            </button>
          </div>

        </form>
      </div>
    </div>
  `;
}


  if (active === 'members') {
    return `
      <div class="section-head">
        <div>
          <span class="eyebrow">CLIENT DIRECTORY</span>
          <h3>ทะเบียนสมาชิก</h3>
        </div>
        <button class="primary" id="addMember">＋ เพิ่มสมาชิก</button>
      </div>

      <div class="panel">
        <input class="search wide" id="memberSearch"
          placeholder="ค้นหาชื่อหรือเบอร์โทรศัพท์">
        <div id="memberRows">${memberRows(cache.members)}</div>
      </div>
    `;
  }

  if (active === 'applications') {
    return `
      <div class="section-head">
        <div>
          <span class="eyebrow">EMPLOYEE REGISTRATION</span>
          <h3>ใบสมัครพนักงาน</h3>
          <p class="muted">ตรวจสอบและจัดการใบสมัครเข้าร่วมทีม</p>
        </div>
        <button class="quiet" id="refreshApplications">↻ รีเฟรช</button>
      </div>

      <div class="panel table-panel">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ชื่อผู้สมัคร</th>
                <th>ตำแหน่ง</th>
                <th>วันที่สมัคร</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${cache.applications.map(a => `
                <tr>
                  <td>
                    <b>${esc(a.applicant_name)}</b>
                    <small>${esc(a.user_id)}</small>
                  </td>
                  <td>${esc(roleNames[a.requested_role] || a.requested_role)}</td>
                  <td>
                    ${a.created_at
                      ? new Date(a.created_at).toLocaleDateString('th-TH')
                      : '-'}
                  </td>
                  <td>
                    <span class="status ${a.status}">
                      ${a.status === 'pending'
                        ? 'รออนุมัติ'
                        : a.status === 'approved'
                          ? 'อนุมัติแล้ว'
                          : 'ปฏิเสธแล้ว'}
                    </span>
                  </td>
                  <td>
                    ${a.status === 'pending' ? `
                      <button class="quiet approve-application"
                        data-approve="${esc(a.id)}">
                        อนุมัติ
                      </button>
                      <button class="quiet reject-application"
                        data-reject="${esc(a.id)}">
                        ปฏิเสธ
                      </button>
                    ` : '-'}
                  </td>
                </tr>
              `).join('') || `
                <tr>
                  <td colspan="5" class="empty">ยังไม่มีใบสมัครพนักงาน</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (active === 'reports') {
    return `
      <div class="section-head">
        <div>
          <span class="eyebrow">BUSINESS PERFORMANCE</span>
          <h3>รายงานผลดำเนินงาน</h3>
        </div>
      </div>

      <div class="stats-grid">
        <article class="stat-card dark">
          <span>REVENUE</span>
          <strong>${money(revenue)}</strong>
          <small>ยอดบริการที่เสร็จสิ้น</small>
        </article>

        <article class="stat-card">
          <span>COMPLETED</span>
          <strong>${ap.filter(a => a.status === 'completed').length}</strong>
          <small>คิวที่ให้บริการแล้ว</small>
        </article>

        <article class="stat-card">
          <span>UPCOMING</span>
          <strong>
            ${ap.filter(a =>
              a.status === 'confirmed' || a.status === 'waiting'
            ).length}
          </strong>
          <small>คิวรอดำเนินการ</small>
        </article>

        <article class="stat-card">
          <span>MEMBERS</span>
          <strong>${cache.members.length}</strong>
          <small>สมาชิกในระบบ</small>
        </article>
      </div>

      <div class="panel">
        <h3>รายการนัดหมายและสถานะ</h3>
        ${appointmentTable(ap)}
      </div>
    `;
  }

  if (active === 'profile') {
    return `
      <div class="section-head">
        <div>
          <span class="eyebrow">MY ACCOUNT</span>
          <h3>โปรไฟล์ผู้ใช้งาน</h3>
          <p class="muted">ข้อมูลบัญชีที่ใช้เข้าสู่ระบบ Phoenix Zpell</p>
        </div>
      </div>

      <div class="panel settings-panel">
        <div class="profile-heading">
          <div class="user-avatar profile-avatar"
            id="profileAvatarPreview"
            style="width:104px;height:104px;border-radius:50%;
            overflow:hidden;display:grid;place-items:center;font-size:2rem">
            ${avatarMarkup()}
          </div>

          <div>
            <h3>${esc(profile?.full_name || 'ผู้ใช้งาน')}</h3>
            <p class="muted">${roleNames[profile?.role] || 'พนักงาน'}</p>
          </div>
        </div>

        <form id="profileForm" class="form-grid">
          <label class="avatar-upload-field">รูปโปรไฟล์
            <input id="avatarFile" name="avatar" type="file"
              accept="image/png,image/jpeg,image/webp">
            <small class="muted">รองรับ JPG, PNG, WEBP ขนาดไม่เกิน 3 MB</small>
          </label>

          <label>ชื่อ–นามสกุล
            <input name="full_name"
              value="${esc(profile?.full_name || '')}" required>
          </label>

          <label>อีเมล
            <input value="${esc(session?.user?.email || '')}"
              type="email" disabled>
          </label>

          <label>ตำแหน่งผู้ใช้งาน
            <input value="${esc(roleNames[profile?.role] || 'พนักงาน')}"
              disabled>
          </label>

          <div class="form-actions">
            <button class="primary" type="submit">
              บันทึกข้อมูลโปรไฟล์
            </button>
          </div>
        </form>
      </div>
    `;
  }

  return `
    <div class="section-head">
      <div>
        <span class="eyebrow">WORKSPACE SETTINGS</span>
        <h3>ตั้งค่าระบบ</h3>
      </div>
    </div>

    <div class="panel settings-panel">
      <h3>บัญชีผู้ใช้งาน</h3>
      <p>ผู้ใช้งาน: ${esc(session?.user?.email || '')}</p>
      <p>สิทธิ์: ${esc(roleNames[profile?.role] || 'พนักงาน')}</p>
      <button class="primary" id="logout2">ออกจากระบบ</button>
    </div>
  `;
}

// ==========================================
// 9. TABLES
// ==========================================

function appointmentTable(rows) {
  return `
    <div class="panel table-panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>เวลา</th>
              <th>ลูกค้า</th>
              <th>บริการ</th>
              <th>ช่าง</th>
              <th>ราคา</th>
              <th>สถานะ</th>
              <th>จัดการ</th>
            </tr>
          </thead>

          <tbody>
            ${rows.length ? rows.map(a => `
              <tr>
                <td class="time">${esc(a.appointment_time || '--:--')}</td>
                <td>
                  <b>${esc(a.customer_name || '-')}</b>
                  <small>${esc(a.phone || '')}</small>
                </td>
                <td>${esc(a.service_name || '-')}</td>
                <td>
                  <span class="stylist-tag">
                    ${esc(a.staff_nickname || '-')}
                  </span>
                </td>
                <td>${money(a.price)}</td>
                <td>
                  <span class="status ${esc(a.status)}">
                    ${statusText(a.status)}
                  </span>
                </td>
                <td>
                  <select class="status-select" data-status="${esc(a.id)}">
                    <option value="">เปลี่ยนสถานะ</option>
                    <option value="waiting">รอการบริการ</option>
                    <option value="completed">รับบริการแล้ว</option>
                    <option value="cancelled">ยกเลิก</option>
                  </select>
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="7" class="empty">ยังไม่มีรายการนัดหมาย</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function statusText(status) {
  return ({
    confirmed: 'ยืนยันแล้ว',
    waiting: 'รอการบริการ',
    completed: 'รับบริการแล้ว',
    cancelled: 'ยกเลิก'
  })[status] || status || '-';
}

function memberRows(rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>สมาชิก</th>
            <th>เบอร์โทรศัพท์</th>
            <th>วันที่สมัคร</th>
            <th>จัดการ</th>
          </tr>
        </thead>

        <tbody>
          ${rows.map(m => `
            <tr>
              <td>
                <div class="member-name">
                  <span class="initial mini">
                    ${esc((m.full_name || '?').slice(0, 1))}
                  </span>
                  <b>${esc(m.full_name || '')}</b>
                </div>
              </td>
              <td>${esc(m.phone || '-')}</td>
              <td>
                ${m.created_at
                  ? new Date(m.created_at).toLocaleDateString('th-TH')
                  : '-'}
              </td>
              <td>
                <button class="quiet delete-member"
                  data-delete-member="${esc(m.id)}">
                  ลบสมาชิก
                </button>
              </td>
            </tr>
          `).join('') || `
            <tr>
              <td colspan="4" class="empty">ยังไม่มีสมาชิก</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  `;
}

// ==========================================
// 10. PAGE EVENTS
// ==========================================

function wirePage() {
  document.querySelectorAll('[data-profile]').forEach(el => {
    el.onclick = () => {
      active = 'profile';
      render();
    };
  });

  document.querySelectorAll('[data-go]').forEach(button => {
    button.onclick = () => {
      active = button.dataset.go;
      render();
    };
  });
  
  // ==========================================
  // MY COMMISSION DASHBOARD
  // ==========================================

  if (active === 'my-commission') {
    const historyEl = $('#myCommissionHistory');

    const loadMyCommission = async () => {
      if (!supabase) return;

      if (historyEl) {
        historyEl.innerHTML = '<p class="muted">กำลังโหลดข้อมูล...</p>';
      }

      const { data, error } = await supabase.rpc(
        'get_my_staff_commission'
      );

      if (error) {
        console.error('Commission error:', error);
        if (historyEl) {
          historyEl.innerHTML =
            '<p class="muted">ไม่สามารถโหลดข้อมูลได้: ' +
            esc(error.message) + '</p>';
        }
        return;
      }

      const moneyText = value =>
        Number(value || 0).toLocaleString('th-TH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }) + ' บาท';

      $('#myTodayCustomers').textContent =
        Number(data.today_customers || 0).toLocaleString('th-TH');

      $('#myTodayCommission').textContent =
        moneyText(data.today_commission);

      $('#myMonthCustomers').textContent =
        Number(data.month_customers || 0).toLocaleString('th-TH');

      $('#myMonthCommission').textContent =
        moneyText(data.month_commission);

      const history = data.history || [];

      if (!history.length) {
        historyEl.innerHTML =
          '<p class="muted">ยังไม่มีประวัติค่าคอมมิชชันในเดือนนี้</p>';
        return;
      }

      historyEl.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>วันที่</th>
                <th>เลขที่ใบเสร็จ</th>
                <th>บริการ</th>
                <th>ค่าคอมมิชชัน</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(item => `
                <tr>
                  <td>${new Date(item.date).toLocaleDateString('th-TH')}</td>
                  <td>${esc(item.receipt_no || '-')}</td>
                  <td>${esc(item.service_name || '-')}</td>
                  <td>${moneyText(item.commission_amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    loadMyCommission();
  }


  // PROFILE IMAGE PREVIEW
  const avatarInput = $('#avatarFile');

  if (avatarInput) {
    avatarInput.onchange = () => {
      const file = avatarInput.files?.[0];
      if (!file) return;

      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 3 * 1024 * 1024
      ) {
        toast('กรุณาเลือกรูป JPG, PNG หรือ WEBP ขนาดไม่เกิน 3 MB', true);
        avatarInput.value = '';
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        const preview = $('#profileAvatarPreview');

        if (preview) {
          preview.innerHTML = `
            <img src="${reader.result}"
              alt="ตัวอย่างรูปโปรไฟล์"
              style="width:100%;height:100%;object-fit:cover;border-radius:inherit">
          `;
        }
      };

      reader.readAsDataURL(file);
    };
  }

  // SAVE PROFILE
  const profileForm = $('#profileForm');

  if (profileForm) {
    profileForm.onsubmit = async e => {
      e.preventDefault();

      const form = new FormData(profileForm);
      const full_name = String(form.get('full_name') || '').trim();

      if (!full_name) {
        return toast('กรุณากรอกชื่อ–นามสกุล', true);
      }

      const button = profileForm.querySelector('button[type="submit"]');
      const file = $('#avatarFile')?.files?.[0];

      button.disabled = true;
      button.textContent = 'กำลังบันทึก...';

      try {
        const updates = { full_name };

        if (file) {
          const ext = file.name.split('.').pop()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '') || 'jpg';

          const path =
            `${session.user.id}/avatar-${Date.now()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(path, file, {
              upsert: true,
              contentType: file.type,
              cacheControl: '3600'
            });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(path);

          updates.avatar_url = urlData.publicUrl;
        }

        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', session.user.id)
          .select()
          .single();

        if (error) throw error;

        profile = data;

        toast('บันทึกโปรไฟล์เรียบร้อยแล้ว');
        render();

      } catch (err) {
        console.error(err);
        toast(err.message || 'บันทึกโปรไฟล์ไม่สำเร็จ', true);

        button.disabled = false;
        button.textContent = 'บันทึกข้อมูลโปรไฟล์';
      }
    };
  }

  // BOOKING PRICE
  const serviceSelect = $('#serviceSelect');

  if (serviceSelect) {
    serviceSelect.onchange = () => {
      $('#priceInput').value =
        cache.services.find(s => s.id === serviceSelect.value)?.price_min || 0;
    };
  }

  // CREATE BOOKING
  const bookingForm = $('#bookingForm');

  if (bookingForm) {
    bookingForm.onsubmit = async e => {
      e.preventDefault();

      const f = new FormData(bookingForm);

      const service = cache.services.find(
        s => String(s.id) === String(f.get('service_id'))
      );

      const staff = cache.staff.find(
        s => String(s.id) === String(f.get('staff_id'))
      );

      const obj = {
        appointment_date: f.get('appointment_date'),
        appointment_time: f.get('appointment_time'),
        customer_name: f.get('customer_name'),
        phone: f.get('phone'),
        staff_id: f.get('staff_id'),
        service_id: f.get('service_id'),
        price: Number(f.get('price')),
        notes: f.get('notes'),
        status: 'confirmed'
      };

      try {
        if (supabase) {
const { data: hasConflict, error: conflictError } =
  await supabase.rpc('check_appointment_conflict', {
    p_staff_id: obj.staff_id,
    p_appointment_date: obj.appointment_date,
    p_appointment_time: obj.appointment_time,
    p_duration_minutes: Number(service?.duration_minutes || 60)
  });

if (conflictError) throw conflictError;

if (hasConflict) {
  throw new Error(
    'ช่างท่านนี้มีลูกค้าจองในช่วงเวลาดังกล่าวแล้ว กรุณาเลือกเวลาใหม่'
  );
}
          let member = await supabase
            .from('members')
            .select('id')
            .eq('phone', obj.phone)
            .maybeSingle();

          if (member.error) throw member.error;

          let memberId = member.data?.id;

          if (!memberId) {
            const ins = await supabase
              .from('members')
              .insert({
                full_name: obj.customer_name,
                phone: obj.phone
              })
              .select('id')
              .single();

            if (ins.error) throw ins.error;
            memberId = ins.data.id;
          }

          const { error } = await supabase
            .from('appointments')
            .insert({
              ...obj,
              member_id: memberId,
              created_by: session.user.id
            });

          if (error) throw error;

          await refresh();

        } else {
          cache.appointments.unshift({
            ...obj,
            id: 'a' + Date.now(),
            staff_nickname: staff?.nickname || '-',
            service_name: service?.name || '-'
          });
        }

        toast('บันทึกการจองเรียบร้อย');
        active = 'schedule';
        render();

      } catch (err) {
        toast(err.message || 'บันทึกการจองไม่สำเร็จ', true);
      }
    };
  }

  // UPDATE APPOINTMENT STATUS
  document.querySelectorAll('[data-status]').forEach(select => {
    select.onchange = async () => {
      if (!select.value) return;

      try {
        if (supabase) {
          const { error } = await supabase
            .from('appointments')
            .update({ status: select.value })
            .eq('id', select.dataset.status);

          if (error) throw error;

          await refresh();

        } else {
          const appointment = cache.appointments.find(
            a => String(a.id) === String(select.dataset.status)
          );

          if (appointment) appointment.status = select.value;
        }

        toast('อัปเดตสถานะแล้ว');
        render();

      } catch (err) {
        toast(err.message || 'อัปเดตสถานะไม่สำเร็จ', true);
      }
    };
  });

  // MEMBER SEARCH
  const memberSearch = $('#memberSearch');

  if (memberSearch) {
    memberSearch.oninput = () => {
      $('#memberRows').innerHTML = memberRows(
        cache.members.filter(m =>
          `${m.full_name || ''} ${m.phone || ''}`
            .toLowerCase()
            .includes(memberSearch.value.toLowerCase())
        )
      );

      wireDeleteMembers();
    };
  }

  // ADD MEMBER
  const addMember = $('#addMember');

  if (addMember) {
    addMember.onclick = async () => {
      const name = prompt('ชื่อ-นามสกุลสมาชิก');
      if (!name?.trim()) return;

      const phone = prompt('เบอร์โทรศัพท์') || '';

      try {
        if (supabase) {
          const { error } = await supabase
            .from('members')
            .insert({
              full_name: name.trim(),
              phone
            });

          if (error) throw error;
          await refresh();

        } else {
          cache.members.unshift({
            id: 'm' + Date.now(),
            full_name: name.trim(),
            phone,
            created_at: new Date().toISOString()
          });
        }

        render();
        toast('เพิ่มสมาชิกแล้ว');

      } catch (err) {
        toast(err.message || 'เพิ่มสมาชิกไม่สำเร็จ', true);
      }
    };
  }

  // SCHEDULE SEARCH
  const scheduleSearch = $('#scheduleSearch');

  if (scheduleSearch) {
    scheduleSearch.oninput = () => {
      const q = scheduleSearch.value.toLowerCase();

      const filtered = cache.appointments.filter(a =>
        `${a.customer_name || ''} ${a.staff_nickname || ''} ${a.service_name || ''}`
          .toLowerCase()
          .includes(q)
      );

      const panel = $('.table-panel');

      if (panel) {
        panel.outerHTML = appointmentTable(filtered);
        wireStatusOnly();
      }
    };
  }

  // ADD STAFF
  

// ==========================================
// ADD STAFF MODAL
// ==========================================

const addStaff = $('#addStaff');
const staffModal = $('#staffModal');
const staffForm = $('#staffForm');

const closeStaffModal = () => {
  if (staffModal) {
    staffModal.style.display = 'none';
  }
};

if (addStaff && staffModal) {
  addStaff.onclick = () => {
    if (profile?.role !== 'owner') {
      return toast('เฉพาะเจ้าของร้านเท่านั้น', true);
    }

    staffModal.style.display = 'flex';
  };
}

$('#closeStaffModal')?.addEventListener('click', closeStaffModal);
$('#cancelStaffModal')?.addEventListener('click', closeStaffModal);

if (staffModal) {
  staffModal.addEventListener('click', e => {
    if (e.target === staffModal) {
      closeStaffModal();
    }
  });
}

// SAVE STAFF
if (staffForm) {
  staffForm.onsubmit = async e => {
    e.preventDefault();

    if (profile?.role !== 'owner') {
      return toast('เฉพาะเจ้าของร้านเท่านั้นที่สร้างพนักงานได้', true);
    }

    const f = new FormData(staffForm);

    const nickname = String(f.get('nickname') || '').trim();
    const fullName = String(f.get('full_name') || '').trim();
    const email = String(f.get('email') || '').trim();
    const password = String(f.get('password') || '');
    const jobTitle = String(f.get('job_title') || '').trim();
    const specialty = String(f.get('specialty') || '').trim();
    const accountRole = String(f.get('account_role') || '');

    const allowedRoles = [
      'manager',
      'receptionist',
      'stylist',
      'assistant'
    ];

    if (!nickname || !fullName || !email || !password) {
      return toast('กรุณากรอกข้อมูลให้ครบ', true);
    }

    if (password.length < 8) {
      return toast('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร', true);
    }

    if (!allowedRoles.includes(accountRole)) {
      return toast('กรุณาเลือกสิทธิ์บัญชีให้ถูกต้อง', true);
    }

    const saveButton = $('#saveStaff');
    if (saveButton) saveButton.disabled = true;

    try {
      const { data, error } = await supabase.functions.invoke(
        'create-staff',
        {
          body: {
            full_name: fullName,
            email,
            password,
            role: accountRole
          }
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const userId = data?.user?.id || data?.user_id || data?.id;

      if (!userId) {
        throw new Error(
          'สร้างบัญชีแล้ว แต่ไม่พบ User ID จาก create-staff กรุณาตรวจสอบผลลัพธ์ของฟังก์ชัน'
        );
      }

      const { error: staffError } = await supabase
        .from('staff')
        .insert({
          nickname,
          name_th: fullName,
          role: jobTitle,
          specialty,
          active: true,
          user_id: userId
        });

      if (staffError) throw staffError;

      await refresh();

      closeStaffModal();
      staffForm.reset();

      render();
      toast('เพิ่มช่างและสร้างบัญชีเรียบร้อยแล้ว');

    } catch (err) {
      console.error('Add staff error:', err);
      toast(err.message || 'เพิ่มช่างไม่สำเร็จ', true);

    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  };
}

// ==========================================
// EDIT STAFF MODAL
// ==========================================

const editStaffModal = $('#editStaffModal');
const editStaffForm = $('#editStaffForm');

const closeEditStaffModal = () => {
  if (editStaffModal) {
    editStaffModal.style.display = 'none';
  }
};

// OPEN EDIT MODAL
document.querySelectorAll('.edit-staff').forEach(button => {
  button.onclick = () => {
    if (profile?.role !== 'owner') {
      return toast('เฉพาะเจ้าของร้านเท่านั้น', true);
    }

    const staffId = button.dataset.id;

    const staff = cache.staff.find(
      s => String(s.id) === String(staffId)
    );

    if (!staff) {
      return toast('ไม่พบข้อมูลช่าง', true);
    }

    editStaffForm.elements.id.value = staff.id;
    editStaffForm.elements.nickname.value = staff.nickname || '';
    editStaffForm.elements.name_th.value = staff.name_th || '';
    editStaffForm.elements.role.value = staff.role || '';
    editStaffForm.elements.specialty.value = staff.specialty || '';
    editStaffForm.elements.active.value =
      String(staff.active !== false);

 editStaffModal.style.display = 'flex';
  };
});
// CLOSE MODAL
$('#closeEditStaffModal')?.addEventListener(
  'click',
  closeEditStaffModal
);

$('#cancelEditStaff')?.addEventListener(
  'click',
  closeEditStaffModal
);

editStaffModal?.addEventListener('click', e => {
  if (e.target === editStaffModal) {
    closeEditStaffModal();
  }
});

// SAVE EDIT STAFF
if (editStaffForm) {
  editStaffForm.onsubmit = async e => {
    e.preventDefault();

    if (profile?.role !== 'owner') {
      return toast('เฉพาะเจ้าของร้านเท่านั้น', true);
    }

    const f = new FormData(editStaffForm);

    const staffId = f.get('id');

    const updates = {
      nickname: String(f.get('nickname') || '').trim(),
      name_th: String(f.get('name_th') || '').trim(),
      role: String(f.get('role') || '').trim(),
      specialty: String(f.get('specialty') || '').trim(),
      active: f.get('active') === 'true'
    };

    if (!updates.nickname || !updates.name_th) {
      return toast('กรุณากรอกชื่อเล่นและชื่อ–นามสกุล', true);
    }

    const saveButton = $('#saveEditStaff');
    if (saveButton) saveButton.disabled = true;

    try {
      const { error } = await supabase
        .from('staff')
        .update(updates)
        .eq('id', staffId);

      if (error) throw error;

      await refresh();

      closeEditStaffModal();
      render();

      toast('แก้ไขข้อมูลช่างเรียบร้อยแล้ว');

    } catch (err) {
      console.error('Edit staff error:', err);
      toast(err.message || 'แก้ไขข้อมูลช่างไม่สำเร็จ', true);

    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  };
}
  
// ==========================================
// TOGGLE STAFF STATUS
// ==========================================

document.querySelectorAll('.toggle-staff').forEach(button => {
  button.onclick = async () => {
    if (profile?.role !== 'owner') {
      return toast('เฉพาะเจ้าของร้านเท่านั้น', true);
    }

    const staffId = button.dataset.id;
    const currentActive = button.dataset.active === 'true';

    const action = currentActive
      ? 'ปิดใช้งาน'
      : 'เปิดใช้งาน';

    const confirmed = confirm(
      `ต้องการ${action}ช่างคนนี้ใช่หรือไม่?`
    );

    if (!confirmed) return;

    button.disabled = true;

    try {
      const { error } = await supabase
        .from('staff')
        .update({ active: !currentActive })
        .eq('id', staffId);

      if (error) throw error;

      await refresh();
      render();

      toast(
        currentActive
          ? 'ปิดใช้งานช่างเรียบร้อยแล้ว'
          : 'เปิดใช้งานช่างเรียบร้อยแล้ว'
      );

    } catch (err) {
      console.error('Toggle staff error:', err);
      toast(err.message || 'เปลี่ยนสถานะไม่สำเร็จ', true);

    } finally {
      button.disabled = false;
    }
  };
});

  
  // ==========================================
  // ADD SERVICE MODAL
  // ==========================================

  const addService = $('#addService');
  const serviceModal = $('#serviceModal');
  const serviceForm = $('#serviceForm');

  const closeServiceModal = () => {
    if (serviceModal) {
      serviceModal.style.display = 'none';
    }
  };

  if (addService && serviceModal) {
    addService.onclick = () => {
      if (profile?.role !== 'owner') {
        return toast('เฉพาะเจ้าของร้านเท่านั้น', true);
      }

      serviceModal.style.display = 'flex';
    };
  }

  $('#closeServiceModal')?.addEventListener(
    'click',
    closeServiceModal
  );

  $('#cancelServiceModal')?.addEventListener(
    'click',
    closeServiceModal
  );

  serviceModal?.addEventListener('click', e => {
    if (e.target === serviceModal) {
      closeServiceModal();
    }
  });

  // SAVE SERVICE
  if (serviceForm) {
    serviceForm.onsubmit = async e => {
      e.preventDefault();

      if (profile?.role !== 'owner') {
        return toast('เฉพาะเจ้าของร้านเท่านั้น', true);
      }

      const f = new FormData(serviceForm);

      const categoryTh = String(
        f.get('category_th') || ''
      ).trim();

      const categoryEn = String(
        f.get('category_en') || ''
      ).trim();

      const name = String(
        f.get('name') || ''
      ).trim();

      const description = String(
        f.get('description') || ''
      ).trim();

      const priceMin = Number(f.get('price_min'));
      const priceMaxRaw = f.get('price_max');
      const priceMax = priceMaxRaw === ''
        ? priceMin
        : Number(priceMaxRaw);

      const duration = Number(
        f.get('duration_minutes')
      );

      const priceNote = String(
        f.get('price_note') || ''
      ).trim();

      if (
        !categoryTh ||
        !name ||
        !Number.isFinite(priceMin) ||
        priceMin < 0 ||
        !Number.isFinite(priceMax) ||
        priceMax < priceMin ||
        !Number.isInteger(duration) ||
        duration < 1
      ) {
        return toast('กรุณาตรวจสอบข้อมูลและราคาให้ถูกต้อง', true);
      }

      const saveButton = $('#saveService');
      if (saveButton) saveButton.disabled = true;

      try {
        const { error } = await supabase
          .from('services')
          .insert({
            category_th: categoryTh,
            category_en: categoryEn,
            name,
            description,
            price_min: priceMin,
            price_max: priceMax,
            duration_minutes: duration,
            price_note: priceNote,
            active: true
          });

        if (error) throw error;

        await refresh();

        closeServiceModal();
        serviceForm.reset();

        render();

        toast('เพิ่มบริการเรียบร้อยแล้ว');

      } catch (err) {
        console.error('Add service error:', err);
        toast(err.message || 'เพิ่มบริการไม่สำเร็จ', true);

      } finally {
        if (saveButton) saveButton.disabled = false;
      }
    };
  }



  // CREATE STAFF ACCOUNT
  const createStaffAccountForm = $('#createStaffAccountForm');

  if (createStaffAccountForm) {
    createStaffAccountForm.onsubmit = async (event) => {
      event.preventDefault();

      if (profile?.role !== 'owner') {
        return toast('เฉพาะเจ้าของร้านเท่านั้น', true);
      }

      if (!supabase) {
        return toast('ไม่สามารถเชื่อมต่อ Supabase ได้', true);
      }

      const formData = new FormData(createStaffAccountForm);

      const full_name = String(formData.get('full_name') || '').trim();
      const email = String(formData.get('email') || '').trim();
      const password = String(formData.get('password') || '');
      const role = String(formData.get('role') || '');

      if (!full_name || !email || password.length < 8 || !role) {
        return toast('กรุณากรอกข้อมูลให้ครบถ้วน', true);
      }

      const submitButton =
        createStaffAccountForm.querySelector('button[type="submit"]');

      submitButton.disabled = true;

      try {
        const { data, error } = await supabase.functions.invoke(
          'create-staff',
          {
            body: {
              full_name,
              email,
              password,
              role
            }
          }
        );

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        createStaffAccountForm.reset();

        toast('สร้างบัญชีพนักงานเรียบร้อยแล้ว');

      } catch (err) {
        console.error('Create staff account error:', err);
        toast(err.message || 'สร้างบัญชีไม่สำเร็จ', true);

      } finally {
        submitButton.disabled = false;
      }
    };
  }

 
  
  // ==========================================
  // POS - CALCULATE TOTAL + SAVE SALE + RECEIPT
  // ==========================================

  const posForm = $('#posForm');

  if (posForm) {
    const subtotalEl = $('#posSubtotal');
    const discountEl = $('#posDiscount');
    const totalEl = $('#posTotal');
    const changeEl = $('#posChange');

    const discountInput = posForm.querySelector(
      '[name="discount"]'
    );

    const receivedInput = posForm.querySelector(
      '[name="amount_received"]'
    );

    const money = (value) =>
      Number(value).toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) + ' บาท';

    const getSelectedServices = () => [
      ...posForm.querySelectorAll(
        'input[name="service_ids"]:checked'
      )
    ];

    const calculatePOS = () => {
      const selectedServices = getSelectedServices();

      const subtotal = selectedServices.reduce(
        (sum, item) =>
          sum + (Number(item.dataset.price) || 0),
        0
      );

      const discount = Math.min(
        Math.max(Number(discountInput.value) || 0, 0),
        subtotal
      );

      const total = subtotal - discount;

      const received = Math.max(
        Number(receivedInput.value) || 0,
        0
      );

      const difference = received - total;

      subtotalEl.textContent = money(subtotal);
      discountEl.textContent = money(discount);
      totalEl.textContent = money(total);

      changeEl.textContent = difference >= 0
        ? money(difference)
        : 'ขาดอีก ' + money(Math.abs(difference));

      return {
        subtotal,
        discount,
        total,
        received,
        change: Math.max(difference, 0)
      };
    };

    posForm.addEventListener('change', calculatePOS);
    posForm.addEventListener('input', calculatePOS);

    calculatePOS();

    // ==========================================
    // SAVE SALE
    // ==========================================

    posForm.onsubmit = async (event) => {
      event.preventDefault();

      if (!supabase) {
        return toast('ไม่สามารถเชื่อมต่อ Supabase ได้', true);
      }

      const allowedRoles = [
        'owner',
        'manager',
        'receptionist'
      ];

      if (!allowedRoles.includes(profile?.role)) {
        return toast('ไม่มีสิทธิ์ใช้งานระบบขายหน้าร้าน', true);
      }

      const selectedServices = getSelectedServices();

      if (selectedServices.length === 0) {
        return toast('กรุณาเลือกบริการอย่างน้อย 1 รายการ', true);
      }

      const totals = calculatePOS();

      if (totals.received < totals.total) {
        return toast('จำนวนเงินที่รับมายังไม่ครบ', true);
      }

      const formData = new FormData(posForm);

      const customerName =
        String(formData.get('customer_name') || '').trim();

      const customerPhone =
        String(formData.get('customer_phone') || '').trim();

      const staffId =
        String(formData.get('staff_id') || '');

      const paymentMethod =
        String(formData.get('payment_method') || 'cash');

      if (!customerName) {
        return toast('กรุณากรอกชื่อลูกค้า', true);
      }

      const selectedStaff = cache.staff.find(
        staff => String(staff.id) === staffId
      );

      const staffName = selectedStaff
        ? selectedStaff.nickname ||
          selectedStaff.name_th ||
          'ช่าง'
        : '';

      const items = selectedServices.map(input => {
        const service = cache.services.find(
          item => String(item.id) === input.value
        );

        return {
          service_id: input.value,
          service_name: service?.name || 'บริการ',
          staff_id: staffId || null,
          staff_name: staffName || null,
          quantity: 1,
          unit_price: Number(input.dataset.price) || 0
        };
      });

      const submitButton =
        posForm.querySelector('button[type="submit"]');

      submitButton.disabled = true;
      submitButton.textContent = 'กำลังบันทึก...';

      try {
        const { data, error } = await supabase.rpc(
          'create_pos_sale',
          {
            p_sale: {
              customer_name: customerName,
              customer_phone: customerPhone,
              discount: totals.discount,
              payment_method: paymentMethod,
              amount_received: totals.received
            },
            p_items: items
          }
        );

        if (error) throw error;
        if (!data?.success) {
          throw new Error('ไม่สามารถบันทึกยอดขายได้');
        }
      

        // ==========================================
        // SHOW RECEIPT
        // ==========================================

        const receiptDate = new Date().toLocaleString('th-TH');

        const paymentNames = {
          cash: 'เงินสด',
          transfer: 'โอนเงิน',
          card: 'บัตรเครดิต / เดบิต'
        };

        $('#content').innerHTML = `
          <div class="panel receipt-panel" id="receipt">
            <div class="receipt-header">
              <h2>PHOENIX ZPELL</h2>
              <p>HAIR SPA RITUAL</p>
              <h3>ใบเสร็จรับเงิน</h3>
              <p>RECEIPT</p>
            </div>

            <hr>

            <p>เลขที่ใบเสร็จ: <b>${esc(data.receipt_no)}</b></p>
            <p>วันที่: ${esc(receiptDate)}</p>
            <p>ลูกค้า: ${esc(customerName)}</p>
            <p>เบอร์โทร: ${esc(customerPhone || '-')}</p>

            <hr>

            <h3>รายการบริการ</h3>

            
            ${savedItems.map(item => `
              <div class="receipt-line">
                <span>${esc(item.service_name)}</span>
                <b>${money(item.line_total)}</b>
              </div>
             
<small>
  ช่าง: ${esc(item.staff_name || '-')}
</small>

            `).join('')}


            <hr>

            <div class="receipt-line">
              <span>ยอดรวม</span>
              <b>${money(totals.subtotal)}</b>
            </div>

            <div class="receipt-line">
              <span>ส่วนลด</span>
              <b>${money(totals.discount)}</b>
            </div>

            <div class="receipt-line receipt-total">
              <span>ยอดสุทธิ</span>
              <b>${money(data.total)}</b>
            </div>
            <div class="receipt-line">
             <span>ค่าคอมมิชชันช่างรวม</span>
              <b>${money(commissionTotal)}</b>
            </div>

            <div class="receipt-line">
              <span>วิธีชำระเงิน</span>
              <b>${paymentNames[paymentMethod]}</b>
            </div>

            <div class="receipt-line">
              <span>รับเงิน</span>
              <b>${money(totals.received)}</b>
            </div>

            <div class="receipt-line">
              <span>เงินทอน</span>
              <b>${money(data.change_amount)}</b>
            </div>

            <hr>

            <div class="receipt-footer">
              <h3>ขอบคุณที่ใช้บริการ</h3>
              <p>PHOENIX ZPELL HAIR SPA RITUAL</p>
            </div>
          </div>

          <div class="form-actions receipt-actions">
            <button class="primary" id="printReceipt">
              พิมพ์ใบเสร็จ
            </button>

            <button class="secondary" id="newSale">
              ขายรายการใหม่
            </button>
          </div>
        `;

        $('#printReceipt').onclick = () => {
          window.print();
        };

        $('#newSale').onclick = () => {
          active = 'pos';
          render();
        };

        toast('บันทึกยอดขายเรียบร้อยแล้ว');

      } catch (err) {
        console.error('POS save error:', err);
        toast(err.message || 'บันทึกยอดขายไม่สำเร็จ', true);

        submitButton.disabled = false;
        submitButton.textContent = 'รับชำระเงินและออกใบเสร็จ';
      }
    };
  }

     

  // ADD SERVICE
  const addService = $('#addService');

  if (addService) {
    addService.onclick = async () => {
      const category_th = prompt('ชื่อประเภทบริการภาษาไทย');
      if (!category_th?.trim()) return;

      const category_en = prompt('ชื่อประเภทบริการภาษาอังกฤษ');
      if (!category_en?.trim()) return;

      const name = prompt('ชื่อบริการภาษาอังกฤษ');
      if (!name?.trim()) return;

      const description = prompt('รายละเอียดบริการภาษาไทย') || '';

      const minRaw = prompt('ราคาเริ่มต้น (บาท)');
      if (minRaw === null || minRaw.trim() === '') return;

      const price_min = Number(minRaw);

      if (!Number.isFinite(price_min) || price_min < 0) {
        return toast('กรุณากรอกราคาเริ่มต้นให้ถูกต้อง', true);
      }

      const maxRaw = prompt('ราคาสูงสุด (บาท)');
      if (maxRaw === null || maxRaw.trim() === '') return;

      const price_max = Number(maxRaw);

      if (!Number.isFinite(price_max) || price_max < price_min) {
        return toast('ราคาสูงสุดต้องไม่น้อยกว่าราคาเริ่มต้น', true);
      }

      const row = {
        category_th: category_th.trim(),
        category_en: category_en.trim(),
        name: name.trim(),
        description: description.trim(),
        price_min,
        price_max,
        active: true
      };

      try {
        if (supabase) {
          const { error } = await supabase.from('services').insert(row);
          if (error) throw error;
          await refresh();
        } else {
          cache.services.push({
            ...row,
            id: 'service' + Date.now()
          });
        }

        render();
        toast('เพิ่มบริการเรียบร้อยแล้ว');

      } catch (err) {
        toast(err.message || 'เพิ่มบริการไม่สำเร็จ', true);
      }
    };
  }

  wireDeleteMembers();

  // APPLICATIONS
  const refreshApplicationsButton = $('#refreshApplications');

  if (refreshApplicationsButton) {
    refreshApplicationsButton.onclick = async () => {
      try {
        await refreshApplications();
        render();
        toast('รีเฟรชใบสมัครแล้ว');
      } catch (err) {
        toast(err.message || 'โหลดใบสมัครไม่สำเร็จ', true);
      }
    };
  }

  document.querySelectorAll('[data-approve]').forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.approve;

      const application = cache.applications.find(
        a => String(a.id) === String(id)
      );

      if (!application) return;

      if (!confirm(
        `ต้องการอนุมัติ ${application.applicant_name} เป็น ${roleNames[application.requested_role]} ใช่หรือไม่?`
      )) return;

      button.disabled = true;

      try {
        // เปลี่ยน role ใน profiles ก่อน
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ role: application.requested_role })
          .eq('id', application.user_id);

        if (profileError) throw profileError;

        // เปลี่ยนสถานะใบสมัคร
        const { error: applicationError } = await supabase
          .from('staff_applications')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: session.user.id
          })
          .eq('id', id)
          .eq('status', 'pending');

        if (applicationError) throw applicationError;

        await refreshApplications();

        toast('อนุมัติพนักงานเรียบร้อยแล้ว');
        render();

      } catch (err) {
        console.error(err);
        toast(
          err.message || 'อนุมัติไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ RLS ของ profiles',
          true
        );
        button.disabled = false;
      }
    };
  });

  document.querySelectorAll('[data-reject]').forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.reject;

      if (!confirm('ต้องการปฏิเสธใบสมัครนี้ใช่หรือไม่?')) return;

      button.disabled = true;

      try {
        const { error } = await supabase
          .from('staff_applications')
          .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            reviewed_by: session.user.id
          })
          .eq('id', id)
          .eq('status', 'pending');

        if (error) throw error;

        await refreshApplications();

        toast('ปฏิเสธใบสมัครเรียบร้อยแล้ว');
        render();

         } catch (err) {
      toast(err.message || 'ปฏิเสธใบสมัครไม่สำเร็จ', true);
      button.disabled = false;
    }
  };
});

const logout2 = $('#logout2');
  if (logout2) {
    logout2.onclick = () => $('#logout').click();
  }
}

// ==========================================
// 11. MEMBER DELETE
// ==========================================

function wireDeleteMembers() {
  document.querySelectorAll('[data-delete-member]').forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.deleteMember;

      const member = cache.members.find(
        m => String(m.id) === String(id)
      );

      if (!member) return;

      if (!confirm(
        `ต้องการลบสมาชิก "${member.full_name}" ใช่หรือไม่?`
      )) return;

      button.disabled = true;

      try {
        if (supabase) {
          const { count, error: checkError } = await supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('member_id', id);

          if (checkError) throw checkError;

          if ((count || 0) > 0) {
            toast(
              'สมาชิกนี้มีประวัติการจอง จึงยังลบไม่ได้',
              true
            );
            button.disabled = false;
            return;
          }

          const { error } = await supabase
            .from('members')
            .delete()
            .eq('id', id);

          if (error) throw error;

          await refresh();

        } else {
          cache.members = cache.members.filter(
            m => String(m.id) !== String(id)
          );
        }

        render();
        toast('ลบสมาชิกเรียบร้อยแล้ว');

      } catch (err) {
        toast(err.message || 'ลบสมาชิกไม่สำเร็จ', true);
        button.disabled = false;
      }
    };
  });
}

function wireStatusOnly() {
  document.querySelectorAll('[data-status]').forEach(select => {
    select.onchange = async () => {
      if (!select.value) return;

      try {
        if (supabase) {
          const { error } = await supabase
            .from('appointments')
            .update({ status: select.value })
            .eq('id', select.dataset.status);

          if (error) throw error;

          await refresh();

        } else {
          const a = cache.appointments.find(
            x => String(x.id) === String(select.dataset.status)
          );

          if (a) a.status = select.value;
        }

        render();

      } catch (err) {
        toast(err.message || 'เปลี่ยนสถานะไม่สำเร็จ', true);
      }
    };
  });
}

// ==========================================
// 12. START APPLICATION
// ==========================================

if (supabase) {
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error(error);
      loginView();
      return;
    }

    if (data.session) {
      boot(data.session);
    } else {
      loginView();
    }
  });

  supabase.auth.onAuthStateChange((event, newSession) => {
    if (signingUp) return;

    if (newSession && !session) {
      // ป้องกันการเรียก boot ซ้ำระหว่างกำลังโหลด Session
      boot(newSession);
    }

    if (!newSession && session) {
      session = null;
      profile = null;
      loginView();
    }
  });

} else {
  loginView();
}
