import { createClient } from '@supabase/supabase-js';
import './customer.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
const app = document.querySelector('#customer-app');
const state = { session: null, member: null, staff: [], services: [], page: 'home', category: 'ทั้งหมด', busy: false };
const money = n => '฿' + Number(n || 0).toLocaleString('th-TH');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
const toast = (message, bad=false) => { const el = document.querySelector('#toast'); if (!el) return alert(message); el.textContent = message; el.className = `toast visible${bad ? ' error' : ''}`; window.clearTimeout(toast.timer); toast.timer = window.setTimeout(() => el.className = 'toast', 3600); };

async function init() {
  if (!supabase) { renderConfigError(); return; }
  const [{ data: auth }, staff, services] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from('staff').select('id,nickname,name_th,role,specialty,active').eq('active', true).order('nickname'),
    supabase.from('services').select('id,category_th,category_en,name,description,price_min,price_max,price_note,active').eq('active', true).order('category_th')
  ]);
  if (staff.error || services.error) {
    renderError('ไม่สามารถโหลดบริการหรือรายชื่อช่างได้ กรุณาตรวจสอบ SQL และสิทธิ์การอ่านข้อมูลใน Supabase');
    return;
  }
  state.session = auth.session;
  state.staff = staff.data || [];
  state.services = services.data || [];
  if (state.session) await loadMember();
  render();
  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    if (session) await loadMember(); else state.member = null;
    render();
  });
}

function renderConfigError() {
  app.innerHTML = `<main class="center-screen"><div class="brand-mark">P</div><p class="eyebrow">PHOENIX ZPELL</p><h1>ยังไม่ได้เชื่อมต่อฐานข้อมูล</h1><p>กรุณาตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ใน Environment Variables ของ Vercel</p></main>`;
}
function renderError(message) { app.innerHTML = `<main class="center-screen"><div class="brand-mark">P</div><h1>ขออภัย</h1><p>${esc(message)}</p><button class="btn btn-dark" onclick="location.reload()">ลองอีกครั้ง</button></main>`; }

async function loadMember() {
  if (!state.session) return;
  const { data, error } = await supabase.from('members').select('*').eq('auth_user_id', state.session.user.id).maybeSingle();
  if (error) { console.error(error); toast('โหลดข้อมูลสมาชิกไม่สำเร็จ กรุณาตรวจสอบ SQL สำหรับหน้าลูกค้า', true); return; }
  state.member = data;
}

function header() {
  return `<header class="site-header"><a class="brand" href="#home" data-page="home"><span class="brand-mark">P</span><span><b>Phoenix</b><small>HAIR SPA RITUAL</small></span></a><nav class="desktop-nav"><a href="#home" data-page="home">หน้าแรก</a><a href="#services" data-page="services">บริการของเรา</a><a href="#team" data-page="team">ทีมช่าง</a><a href="#booking" data-page="booking">จองคิว</a></nav><div class="header-actions">${state.session ? `<button class="account-link" data-page="account">${esc(state.member?.full_name || state.session.user.email)}</button><button class="btn btn-outline small-btn" id="logoutBtn">ออกจากระบบ</button>` : `<button class="account-link" data-page="login">เข้าสู่ระบบ</button><button class="btn btn-dark small-btn" data-page="signup">สมัครสมาชิก</button>`}<button class="menu-toggle" id="menuToggle" aria-label="เปิดเมนู">☰</button></div></header>`;
}
function hero() {
  return `<section class="hero"><div class="hero-copy"><span class="eyebrow">THE ART OF BEAUTIFUL HAIR</span><h1>ความงามของเส้นผม<br><em>เริ่มต้นที่การดูแล</em></h1><p>สัมผัสประสบการณ์ Hair Spa Ritual ที่ Phoenix Zpell ด้วยทีมช่างผู้เชี่ยวชาญและผลิตภัณฑ์ดูแลเส้นผมระดับพรีเมียม</p><div class="hero-actions"><button class="btn btn-gold" data-page="booking">จองคิวบริการ <span>↗</span></button><button class="btn btn-text" data-page="services">ค้นพบบริการของเรา</button></div><div class="hero-note"><span>✦</span> BEAUTY IN EVERY DETAIL</div></div><div class="hero-art"><div class="hero-image"><div class="image-caption"><small>PHOENIX ZPELL</small><b>Beauty, beyond hair.</b></div></div><div class="floating-seal">P<br><small>HAIR SPA</small></div></div></section><section class="trust-strip"><span>EXPERT STYLISTS</span><i>✦</i><span>PREMIUM HAIR CARE</span><i>✦</i><span>PERSONALIZED SERVICE</span></section>`;
}
function serviceCards() {
  const cats = ['ทั้งหมด', ...new Set(state.services.map(s => s.category_th).filter(Boolean))];
  const list = state.category === 'ทั้งหมด' ? state.services : state.services.filter(s => s.category_th === state.category);
  return `<section class="section-wrap" id="servicesSection"><div class="section-heading"><span class="eyebrow">OUR SERVICES</span><h2>บริการที่ออกแบบ<br><em>เพื่อเส้นผมของคุณ</em></h2><p>เลือกบริการที่เหมาะกับสไตล์และความต้องการของคุณ</p></div><div class="category-tabs">${cats.map(c => `<button class="category-tab ${state.category===c?'selected':''}" data-category="${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="service-grid">${list.map((s,i)=>`<article class="service-card"><span class="service-number">${String(i+1).padStart(2,'0')}</span><div><small>${esc(s.category_th||'PHOENIX SERVICE')}</small><h3>${esc(s.name)}</h3><p>${esc(s.description||'บริการดูแลเส้นผมโดยช่างผู้เชี่ยวชาญ')}</p></div><div class="service-bottom"><b>${money(s.price_min)}${Number(s.price_max)>Number(s.price_min)?` – ${money(s.price_max)}`:''}${esc(s.price_note||'')}</b><button data-book-service="${s.id}" aria-label="จองบริการ ${esc(s.name)}">↗</button></div></article>`).join('') || '<p class="empty-state">ยังไม่มีข้อมูลบริการ</p>'}</div></section>`;
}
function teamSection() {
  return `<section class="team-section" id="teamSection"><div class="section-heading light"><span class="eyebrow">MEET OUR STYLISTS</span><h2>ทีมช่างผู้เชี่ยวชาญ<br><em>ที่ใส่ใจในทุกรายละเอียด</em></h2><p>เพราะทุกเส้นผมมีเอกลักษณ์ เราจึงใส่ใจในทุกขั้นตอน</p></div><div class="team-grid">${state.staff.map((s,i)=>`<article class="team-card"><div class="team-portrait"><span>${String(i+1).padStart(2,'0')}</span><b>${esc((s.nickname||'P').slice(0,2))}</b></div><h3>${esc(s.name_th||s.nickname)}</h3><p>${esc(s.role||'Hair Stylist')}</p><small>${esc(s.specialty||'Phoenix Zpell Stylist')}</small></article>`).join('') || '<p>กำลังอัปเดตรายชื่อทีมช่าง</p>'}</div></section>`;
}
function homePage() { return `${hero()}${serviceCards()}${teamSection()}<section class="booking-banner"><div><span class="eyebrow">YOUR HAIR, YOUR RITUAL</span><h2>พร้อมดูแลเส้นผม<br>ในแบบที่เป็นคุณหรือยัง?</h2></div><button class="btn btn-gold" data-page="booking">นัดหมายเลย <span>↗</span></button></section>`; }
function loginPage() { return authShell('เข้าสู่ระบบ','ยินดีต้อนรับกลับมา','loginForm',`<label>อีเมล<input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label><label>รหัสผ่าน<input name="password" type="password" autocomplete="current-password" placeholder="รหัสผ่าน" required></label>`,`<button class="btn btn-dark full-width" type="submit">เข้าสู่ระบบ</button><p class="form-foot">ยังไม่มีบัญชี? <a href="#signup" data-page="signup">สมัครสมาชิก</a></p>`); }
function signupPage() { return authShell('สมัครสมาชิก','เริ่มต้นประสบการณ์ดูแลเส้นผมกับเรา','signupForm',`<label>ชื่อ–นามสกุล<input name="full_name" autocomplete="name" placeholder="ชื่อ–นามสกุล" required></label><label>เบอร์โทรศัพท์<input name="phone" type="tel" autocomplete="tel" placeholder="08X-XXX-XXXX" required></label><label>อีเมล<input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label><label>ตั้งรหัสผ่าน<input name="password" type="password" autocomplete="new-password" minlength="6" placeholder="อย่างน้อย 6 ตัวอักษร" required></label>`,`<button class="btn btn-dark full-width" type="submit">สร้างบัญชีสมาชิก</button><p class="form-foot">มีบัญชีแล้ว? <a href="#login" data-page="login">เข้าสู่ระบบ</a></p><small class="fine-print">เมื่อสมัครสมาชิก คุณยอมรับให้เราใช้ข้อมูลเพื่อจัดการบัญชีและการจองบริการ</small>`); }
function authShell(title, sub, id, fields, footer) { return `<section class="auth-layout"><div class="auth-visual"><span class="eyebrow">PHOENIX ZPELL · MEMBER</span><h2>Make time<br><em>for yourself.</em></h2><p>ช่วงเวลาดี ๆ สำหรับคุณและเส้นผมของคุณ</p></div><div class="auth-panel"><span class="eyebrow">MEMBER ACCOUNT</span><h1>${title}</h1><p>${sub}</p><form id="${id}" class="auth-form">${fields}${footer}</form></div></section>`; }
function bookingPage() {
  if (!state.session) return `<section class="simple-page"><span class="eyebrow">BOOK AN APPOINTMENT</span><h1>จองคิวบริการ</h1><p>กรุณาสมัครสมาชิกหรือเข้าสู่ระบบก่อน เพื่อจัดการการจองและดูประวัติการใช้บริการ</p><div class="inline-actions"><button class="btn btn-dark" data-page="signup">สมัครสมาชิก</button><button class="btn btn-outline" data-page="login">เข้าสู่ระบบ</button></div></section>`;
  if (!state.member) return `<section class="simple-page"><h1>กำลังเตรียมข้อมูลสมาชิก</h1><p>กรุณารอสักครู่ หรือเข้าสู่ระบบใหม่อีกครั้ง</p></section>`;
  return `<section class="simple-page wide-page"><span class="eyebrow">BOOK YOUR RITUAL</span><h1>จองคิวบริการ</h1><p>เลือกบริการ ช่าง และเวลาที่คุณสะดวก</p><form id="customerBookingForm" class="booking-form"><label>บริการ<select name="service_id" id="customerService" required><option value="">เลือกบริการ</option>${state.services.map(s=>`<option value="${s.id}">${esc(s.name)} · ${money(s.price_min)}${s.price_max>s.price_min?' – '+money(s.price_max):''}</option>`).join('')}</select></label><label>ช่างที่ต้องการ<select name="staff_id" required><option value="">เลือกช่าง</option>${state.staff.map(s=>`<option value="${s.id}">${esc(s.name_th||s.nickname)}${s.role?' · '+esc(s.role):''}</option>`).join('')}</select></label><label>วันที่<input type="date" name="appointment_date" min="${today()}" value="${today()}" required></label><label>เวลา<input type="time" name="appointment_time" value="11:00" required></label><label class="full-field">หมายเหตุเพิ่มเติม<textarea name="notes" rows="3" placeholder="บอกเราเกี่ยวกับทรงผมหรือความต้องการของคุณ"></textarea></label><div class="booking-total"><span>ราคาเริ่มต้นโดยประมาณ</span><strong id="customerPrice">เลือกบริการ</strong></div><button class="btn btn-dark full-field" type="submit">ยืนยันการจอง</button></form></section>`;
}
async function accountPage() {
  if (!state.session) return loginPage();
  const { data: bookings } = await supabase.from('appointments').select('id,appointment_date,appointment_time,customer_name,price,status,staff(nickname),services(name)').eq('member_id', state.member?.id || '00000000-0000-0000-0000-000000000000').order('appointment_date', { ascending: false }).limit(30);
  return `<section class="simple-page wide-page"><span class="eyebrow">MY PHOENIX ACCOUNT</span><h1>บัญชีของฉัน</h1><div class="account-card"><div class="account-avatar">${esc((state.member?.full_name||'P').slice(0,1))}</div><div><h2>${esc(state.member?.full_name||'สมาชิก Phoenix')}</h2><p>${esc(state.session.user.email)}</p><p>${esc(state.member?.phone||'')}</p></div></div><h2 class="history-title">ประวัติการจอง</h2><div class="history-list">${(bookings||[]).map(b=>`<article class="history-item"><div><b>${esc(b.services?.name||'บริการ Phoenix')}</b><small>${esc(b.appointment_date)} · ${esc(String(b.appointment_time||'').slice(0,5))} · ${esc(b.staff?.nickname||'')}</small></div><strong>${money(b.price)}</strong><span class="booking-status">${esc(statusLabel(b.status))}</span></article>`).join('') || '<p class="empty-state">ยังไม่มีประวัติการจอง</p>'}</div><button class="btn btn-outline" id="logoutAccount">ออกจากระบบ</button></section>`;
}
function statusLabel(s) { return ({confirmed:'ยืนยันแล้ว',waiting:'รอรับบริการ',completed:'รับบริการแล้ว',cancelled:'ยกเลิก'})[s] || s || 'รอดำเนินการ'; }

async function render() {
  let body = state.page === 'login' ? loginPage() : state.page === 'signup' ? signupPage() : state.page === 'services' ? serviceCards() : state.page === 'team' ? teamSection() : state.page === 'booking' ? bookingPage() : state.page === 'account' ? await accountPage() : homePage();
  app.innerHTML = `${header()}<main>${body}</main><footer class="site-footer"><a class="brand" href="#home" data-page="home"><span class="brand-mark">P</span><span><b>Phoenix</b><small>HAIR SPA RITUAL</small></span></a><p>THE ART OF BEAUTIFUL HAIR</p><small>© ${new Date().getFullYear()} PHOENIX ZPELL. ALL RIGHTS RESERVED.</small></footer><div id="toast" class="toast"></div>`;
  document.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); }));
  document.querySelectorAll('[data-category]').forEach(el => el.onclick = () => { state.category = el.dataset.category; render(); });
  document.querySelectorAll('[data-book-service]').forEach(el => el.onclick = () => { state.selectedService = el.dataset.bookService; navigate('booking'); });
  const logout = document.querySelector('#logoutBtn') || document.querySelector('#logoutAccount');
  if (logout) logout.onclick = async () => { await supabase.auth.signOut(); state.session = null; state.member = null; navigate('home'); };
  const menu = document.querySelector('#menuToggle'); if (menu) menu.onclick = () => document.querySelector('.desktop-nav')?.classList.toggle('nav-open');
  const login = document.querySelector('#loginForm'); if (login) login.onsubmit = handleLogin;
  const signup = document.querySelector('#signupForm'); if (signup) signup.onsubmit = handleSignup;
  const booking = document.querySelector('#customerBookingForm'); if (booking) { const serviceSelect = document.querySelector('#customerService'); if (state.selectedService) serviceSelect.value = state.selectedService; updateBookingPrice(); serviceSelect.onchange = updateBookingPrice; booking.onsubmit = handleBooking; }
}
function navigate(page) { state.page = page; window.history.replaceState({}, '', `#${page}`); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function updateBookingPrice() { const service = state.services.find(s => s.id === document.querySelector('#customerService')?.value); const el = document.querySelector('#customerPrice'); if (el) el.textContent = service ? `${money(service.price_min)}${service.price_max>service.price_min?' – '+money(service.price_max):''}` : 'เลือกบริการ'; }

async function handleSignup(e) {
  e.preventDefault(); if (state.busy) return; state.busy = true;
  const form = e.currentTarget; const f = new FormData(form); const full_name = String(f.get('full_name')).trim(); const phone = String(f.get('phone')).trim(); const email = String(f.get('email')).trim(); const password = String(f.get('password'));
  if (password.length < 6) { toast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', true); state.busy=false; return; }
  const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'กำลังสร้างบัญชี...';
  try {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name, phone } } });
    if (error) throw error;
    if (data.session) {
      state.session = data.session;
      await ensureMember(full_name, phone);
      toast('สมัครสมาชิกสำเร็จ'); navigate('account');
    } else {
      toast('สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี'); navigate('login');
    }
  } catch (err) { toast(err.message || 'สมัครสมาชิกไม่สำเร็จ', true); }
  finally { state.busy=false; if (document.body.contains(button)) { button.disabled=false; button.textContent='สร้างบัญชีสมาชิก'; } }
}
async function handleLogin(e) {
  e.preventDefault(); const f = new FormData(e.currentTarget); const button = e.currentTarget.querySelector('button[type="submit"]'); button.disabled=true; button.textContent='กำลังเข้าสู่ระบบ...';
  try { const { data, error } = await supabase.auth.signInWithPassword({ email:String(f.get('email')).trim(), password:String(f.get('password')) }); if (error) throw error; state.session=data.session; await loadMember(); if (!state.member) { const meta=data.user.user_metadata||{}; await ensureMember(meta.full_name||data.user.email, meta.phone||''); } toast('เข้าสู่ระบบสำเร็จ'); navigate('account'); }
  catch(err) { toast(err.message || 'เข้าสู่ระบบไม่สำเร็จ', true); }
  finally { if (document.body.contains(button)) { button.disabled=false; button.textContent='เข้าสู่ระบบ'; } }
}
async function ensureMember(full_name, phone) {
  const { data: existing, error: findError } = await supabase.from('members').select('*').eq('auth_user_id', state.session.user.id).maybeSingle();
  if (findError) throw findError;
  if (existing) { state.member=existing; return existing; }
  const { data, error } = await supabase.from('members').insert({ auth_user_id: state.session.user.id, full_name, phone }).select().single();
  if (error) throw error; state.member=data; return data;
}
async function handleBooking(e) {
  e.preventDefault(); const f = new FormData(e.currentTarget); const service = state.services.find(s=>s.id===f.get('service_id')); if(!service) return toast('กรุณาเลือกบริการ',true);
  try {
    const member = state.member || await ensureMember(state.session.user.user_metadata?.full_name||state.session.user.email, state.session.user.user_metadata?.phone||'');
    const { error } = await supabase.from('appointments').insert({ member_id: member.id, customer_name: member.full_name, phone: member.phone, appointment_date: f.get('appointment_date'), appointment_time: f.get('appointment_time'), staff_id: f.get('staff_id'), service_id: f.get('service_id'), price: service.price_min, notes: f.get('notes'), status: 'confirmed', created_by: state.session.user.id });
    if (error) throw error; toast('ส่งคำขอจองคิวเรียบร้อยแล้ว'); navigate('account');
  } catch(err) { console.error(err); toast(err.message || 'จองคิวไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Supabase', true); }
}

window.addEventListener('hashchange', () => { const p = location.hash.replace('#',''); if (['home','services','team','booking','login','signup','account'].includes(p)) { state.page=p; render(); } });
const initial = location.hash.replace('#',''); state.page = ['home','services','team','booking','login','signup','account'].includes(initial) ? initial : 'home';
init();
