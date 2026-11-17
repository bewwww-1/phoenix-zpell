import { createClient } from '@supabase/supabase-js';
import './style.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey && !supabaseUrl.includes('YOUR_PROJECT')
  ? createClient(supabaseUrl, supabaseKey) : null;

const staffSeed = [
  ['NU','ช่างนุ','Senior Hair Stylist','Cut & Blow, Styling'],
  ['MUYONG','ช่างหมูหยอง','Colorist Specialist','ORDEVE, Schwarzkopf'],
  ['AOF','ช่างอ๊อฟ','Perm & Straightening Specialist','Digital Perm, Relaxing'],
  ['BEE','ช่างบี','Highlights & Bleaching Specialist','Highlights, Bleaching'],
  ['BAM','ช่างแบม','Keratin & Treatment Specialist','Brazilian Blowout, Olaplex'],
  ['POR','ช่างปอ','Hair Stylist & Updo','Cut & Blow, Hair Up']
];
const catalog = [
  ['ตัดและจัดแต่งทรง','Cut & Styling',[
    ['Cut & Blow','ตัดผม + สระไดร์',500,500],
    ['Blow Dry','สระไดร์',200,500],
    ['Hair up + Make up','เกล้าผม + แต่งหน้า',2000,2000]
  ]],
  ['ทำสีและฟอกผม','Color & Highlights',[
    ['ORDEVE','ทำสีออร์ดีฟ',2500,4500],
    ['Schwarzkopf ZERO AMM','ทำสีชวาร์สคอฟ',2500,4500],
    ['Schwarzkopf + LECTURA','ทำสีชวาร์สคอฟ + เลคทูร่า',2000,4000],
    ['Glossing','Semi-permanent color',1500,3500],
    ['Prelightening / Bleaching','ฟอกสีผม Step 1–3',500,3500],
    ['Hilight / Lowlight','ไฮไลท์ครึ่งศีรษะ / เต็มศีรษะ',1500,4000]
  ]],
  ['ดัดและยืดผม','Perm & Relaxing',[
    ['Digital Perm','ดัดดิจิตอล',3000,5500],
    ['Shiseido ISO Cold Perm','ดัดเย็น',1500,3500],
    ['Down Perm','ดาวเพิร์ม',1500,1500],
    ['Foil Perm','ดัดฟอยล์',2500,3000],
    ['Relaxing','ยืดผม',2000,5000]
  ]],
  ['ทรีทเม้นท์และบำรุง','Treatment & Care',[
    ['Brazilian Blowout','บราซิเลี่ยน โบลว์เอาท์',3500,6500],
    ['Keratin Complex','เคราติน คอมเพล็กซ์',4000,7500],
    ['Olaplex Bond Strengthening','บำรุงโครงสร้างเส้นผม',3000,4000],
    ['Moroccanoil Treatment','โมรอคแคนออยล์',1500,3500],
    ['Joico 4 pac','4 ขั้นตอน',1500,3000],
    ['FIBERPLEX / LECTURA','เชื่อมแกน LECTURA',1500,3000],
    ['Nioxin','ล้างสารเคมี',2500,3000]
  ]]
];
let session = null, profile = null, active = 'overview', cache = {staff:[],services:[],members:[],appointments:[]};
const $ = s => document.querySelector(s);
const money = n => '฿' + Number(n || 0).toLocaleString('th-TH');
const dateToday = () => new Date().toISOString().slice(0,10);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = (msg, bad=false) => { const el=$('#toast'); if(!el){ console[bad?'error':'log'](msg); return; } el.textContent=msg; el.className='toast show'+(bad?' bad':''); setTimeout(()=>el.className='toast',3200); };
const avatarMarkup = (sizeClass='') => profile?.avatar_url
  ? `<img class="${sizeClass}" src="${esc(profile.avatar_url)}" alt="รูปโปรไฟล์" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
  : esc((profile?.full_name||session?.user?.email||'P').slice(0,1).toUpperCase());

function loginView(){
  $('#app').innerHTML = `<main class="login-shell"><section class="login-art"><div class="brand-mark">P</div><div class="brand-word">Phoenix</div><p>HAIR SPA RITUAL</p><div class="art-line"></div><small>THE ART OF BEAUTIFUL HAIR</small></section><section class="login-panel"><div class="login-content"><span class="eyebrow">SALON MANAGEMENT</span><h1>ยินดีต้อนรับ</h1><p class="muted">เข้าสู่ระบบจัดการร้าน Phoenix Zpell</p><form id="loginForm"><label>อีเมล<input name="email" type="email" placeholder="name@phoenix.com" required></label><label>รหัสผ่าน<input name="password" type="password" placeholder="กรอกรหัสผ่าน" required></label><button class="primary full">เข้าสู่ระบบ</button></form><div class="login-note">${supabase?'เชื่อมต่อฐานข้อมูลแล้ว':'โหมดตัวอย่าง · ตั้งค่า Supabase เพื่อเปิดใช้งานฐานข้อมูลจริง'}</div><button class="text-button" id="demoBtn">ดูตัวอย่างระบบ</button></div></section></main><div id="toast" class="toast"></div>`;
  $('#loginForm').onsubmit = async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const submitButton = form.querySelector('button[type="submit"], button:not([type])');
    if (!supabase) return toast('ยังเชื่อมต่อ Supabase ไม่ครบ กรุณาตรวจสอบ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY', true);
    const f = new FormData(form);
    const email = String(f.get('email') || '').trim();
    const password = String(f.get('password') || '');
    if (!email || !password) return toast('กรุณากรอกอีเมลและรหัสผ่าน', true);
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'กำลังเข้าสู่ระบบ...'; }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast(error.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง', true);
        return;
      }
      if (!data?.session) {
        toast('เข้าสู่ระบบไม่สำเร็จ: ไม่พบ session', true);
        return;
      }
      await boot(data.session);
    } catch (err) {
      console.error('Login failed:', err);
      toast(err?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่', true);
    } finally {
      if (submitButton && document.querySelector('#loginForm')) {
        submitButton.disabled = false;
        submitButton.textContent = 'เข้าสู่ระบบ';
      }
    }
  };
  $('#demoBtn').onclick=()=>{ session={user:{email:'demo@phoenixzpell.com'}}; profile={full_name:'Phoenix Demo',role:'owner'}; loadDemo(); render(); };
}
function loadDemo(){
  cache.staff=staffSeed.map((x,i)=>({id:'demo'+i,nickname:x[0],name_th:x[1],role:x[2],specialty:x[3],active:true}));
  cache.services=catalog.flatMap((c,i)=>c[2].map((s,j)=>({id:`s${i}${j}`,category_th:c[0],category_en:c[1],name:s[0],description:s[1],price_min:s[2],price_max:s[3],active:true})));
  cache.members=[{id:'m1',full_name:'คุณลูกค้าตัวอย่าง',phone:'08X-XXX-XXXX',created_at:new Date().toISOString()}];
  cache.appointments=[{id:'a1',appointment_date:dateToday(),appointment_time:'10:30',customer_name:'คุณลูกค้าตัวอย่าง',staff_nickname:'NU',service_name:'Cut & Blow',price:500,status:'confirmed'},{id:'a2',appointment_date:dateToday(),appointment_time:'13:00',customer_name:'คุณลูกค้าตัวอย่าง 2',staff_nickname:'MUYONG',service_name:'ORDEVE',price:2500,status:'waiting'}];
}
async function boot(s){
  if(!s?.user?.id){
    session=null; profile=null; loginView();
    return;
  }
  session=s;
  if(supabase){
    // Only accounts explicitly assigned staff/owner in profiles may enter the back office.
    const {data:p,error}=await supabase.from('profiles').select('*').eq('id',s.user.id).maybeSingle();
    if(error || !p || !['owner','staff'].includes(String(p.role||'').toLowerCase())){
      await supabase.auth.signOut();
      session=null; profile=null;
      loginView();
      toast('บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบหลังบ้าน กรุณาเข้าสู่ระบบด้วยบัญชีพนักงานหรือผู้ดูแลร้าน',true);
      return;
    }
    profile=p;
    await refresh();
  } else loadDemo();
  render();
}
async function refresh(){
  const [st,se,me,ap]=await Promise.all([
    supabase.from('staff').select('*').order('nickname'),
    supabase.from('services').select('*').eq('active',true).order('category_th'),
    supabase.from('members').select('*').order('created_at',{ascending:false}).limit(100),
    supabase.from('appointments').select('*, staff(nickname), services(name), members(full_name)').order('appointment_date',{ascending:false}).limit(100)
  ]);
  if(st.error||se.error||me.error||ap.error){toast('โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบ SQL และสิทธิ์ฐานข้อมูล',true);return;}
  cache.staff=st.data; cache.services=se.data; cache.members=me.data;
  cache.appointments=ap.data.map(a=>({...a,staff_nickname:a.staff?.nickname||'-',service_name:a.services?.name||'-',customer_name:a.members?.full_name||a.customer_name||'-'}));
}
const nav=[['overview','layout-dashboard','ภาพรวม'],['booking','calendar-plus','จองคิว'],['schedule','calendar-days','ตารางงาน'],['staff','users','ทะเบียนช่าง'],['services','scissors','ประเภทบริการ'],['members','contact-round','ทะเบียนสมาชิก'],['reports','chart-no-axes-combined','รายงาน'],['profile','user-round','โปรไฟล์'],['settings','settings','ตั้งค่าระบบ']];
function render(){
  $('#app').innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="side-brand"><span class="brand-mark small">P</span><div><div class="brand-word side">Phoenix</div><small>HAIR SPA RITUAL</small></div></div><div class="side-label">MENU</div><nav>${nav.map(([id,ic,t])=>`<button class="nav-item ${active===id?'active':''}" data-nav="${id}"><span class="nav-icon">${icon(ic)}</span>${t}</button>`).join('')}</nav><div class="side-bottom"><div class="user-avatar" data-profile title="ดูโปรไฟล์">${avatarMarkup()}</div><div class="user-meta" data-profile title="ดูโปรไฟล์"><b>${esc(profile?.full_name||'Phoenix')}</b><small>${profile?.role==='owner'?'เจ้าของร้าน':'พนักงาน'}</small></div><button class="logout" id="logout" title="ออกจากระบบ">↗</button></div></aside><main class="main"><header class="topbar"><div><span class="eyebrow">PHOENIX ZPELL / SALON</span><h2>${nav.find(n=>n[0]===active)?.[2]}</h2></div><div class="top-right"><span class="today">${new Date().toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'long',year:'numeric'})}</span><span class="top-avatar" data-profile title="ดูโปรไฟล์" style="cursor:pointer;overflow:hidden">${avatarMarkup()}</span></div></header><section class="content" id="content">${page()}</section></main><div id="toast" class="toast"></div></div>`;
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{active=b.dataset.nav;render();});
  $('#logout').onclick=async()=>{if(supabase) await supabase.auth.signOut();session=null;profile=null;loginView();};
  wirePage();
}
function icon(name){const paths={ 'layout-dashboard':'▦','calendar-plus':'＋','calendar-days':'▤','users':'♧','scissors':'✂','contact-round':'◎','chart-no-axes-combined':'⌁','settings':'⚙','user-round':'◉'};return paths[name]||'•';}
function page(){
 const ap=cache.appointments, today=ap.filter(a=>a.appointment_date===dateToday()), revenue=ap.filter(a=>a.status==='completed').reduce((s,a)=>s+Number(a.price||0),0);
 if(active==='overview')return `<div class="welcome-row"><div><span class="eyebrow">TUESDAY · SALON OVERVIEW</span><h1>สวัสดี, ${esc(profile?.full_name||'Phoenix')} <span class="gold">✦</span></h1><p class="muted">ภาพรวมการดำเนินงานของ Phoenix Zpell วันนี้</p></div><button class="primary" data-go="booking">＋ สร้างการจอง</button></div><div class="stats-grid"><article class="stat-card dark"><span>APPOINTMENTS TODAY</span><strong>${today.length.toString().padStart(2,'0')}</strong><small>คิวที่นัดหมายวันนี้</small></article><article class="stat-card"><span>ACTIVE STYLISTS</span><strong>${cache.staff.length.toString().padStart(2,'0')}</strong><small>ทีมช่างของเรา</small></article><article class="stat-card"><span>REGISTERED MEMBERS</span><strong>${cache.members.length.toString().padStart(2,'0')}</strong><small>สมาชิกทั้งหมด</small></article><article class="stat-card"><span>COMPLETED REVENUE</span><strong>${money(revenue)}</strong><small>ยอดจากคิวที่เสร็จสิ้น</small></article></div><div class="section-head"><div><span class="eyebrow">DAILY SCHEDULE</span><h3>คิววันนี้</h3></div><button class="quiet" data-go="schedule">ดูตารางงาน →</button></div>${appointmentTable(today)}`;
 if(active==='booking')return `<div class="section-head"><div><span class="eyebrow">NEW APPOINTMENT</span><h3>สร้างการจองใหม่</h3><p class="muted">เลือกบริการ ช่าง และเวลาที่ลูกค้าสะดวก</p></div></div><div class="panel form-panel"><form id="bookingForm" class="form-grid"><label>ชื่อลูกค้า<input name="customer_name" placeholder="ชื่อลูกค้า" required></label><label>เบอร์โทรศัพท์<input name="phone" placeholder="เบอร์โทรศัพท์"></label><label>วันที่<input name="appointment_date" type="date" value="${dateToday()}" required></label><label>เวลา<input name="appointment_time" type="time" value="10:00" required></label><label>ช่างผู้ให้บริการ<select name="staff_id" required>${cache.staff.map(s=>`<option value="${s.id}">${esc(s.nickname)} — ${esc(s.name_th)}</option>`).join('')}</select></label><label>บริการ<select name="service_id" id="serviceSelect" required>${cache.services.map(s=>`<option value="${s.id}">${esc(s.name)} · ${money(s.price_min)}${s.price_max>s.price_min?' – '+money(s.price_max):''}</option>`).join('')}</select></label><label>ราคาประเมิน (บาท)<input name="price" id="priceInput" type="number" min="0" value="${cache.services[0]?.price_min||0}" required></label><label>หมายเหตุ<input name="notes" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"></label><div class="form-actions"><button class="primary">บันทึกการจอง</button></div></form></div>`;
 if(active==='schedule')return `<div class="section-head"><div><span class="eyebrow">APPOINTMENT LIST</span><h3>ตารางงาน</h3></div><input class="search" id="scheduleSearch" placeholder="ค้นหาลูกค้า / ช่าง"></div>${appointmentTable(ap)}`;
 if(active==='staff')return `<div class="section-head"><div><span class="eyebrow">OUR PROFESSIONAL TEAM</span><h3>ทะเบียนช่าง</h3><p class="muted">ทีมผู้เชี่ยวชาญ Phoenix Zpell</p></div><button class="primary" id="addStaff">＋ เพิ่มช่างใหม่</button></div><div class="staff-grid">${cache.staff.map(s=>`<article class="staff-card"><div class="initial">${esc((s.nickname||'').slice(0,2))}</div><div><h3>${esc(s.nickname||'')}</h3><b>${esc(s.name_th||'')}</b><p>${esc(s.role||'')}</p><small>${esc(s.specialty||'')}</small></div></article>`).join('')||'<p class="empty">ยังไม่มีข้อมูลช่าง</p>'}</div>`;
 if(active==='services') {
   const categories=[...new Map(cache.services.map(s=>[s.category_th,{th:s.category_th,en:s.category_en}])).values()];
   return `<div class="section-head"><div><span class="eyebrow">SERVICE MENU</span><h3>ประเภทบริการ</h3><p class="muted">ราคาเริ่มต้นและช่วงราคาตามความยาวผม</p></div><button class="primary" id="addService">＋ เพิ่มบริการ</button></div>${categories.map(c=>`<div class="service-group"><div class="group-title"><div><h3>${esc(c.th||'')}</h3><small>${esc(c.en||'')}</small></div><span>${cache.services.filter(s=>s.category_th===c.th).length} SERVICES</span></div><div class="service-list">${cache.services.filter(s=>s.category_th===c.th).map(s=>`<div class="service-row"><div><b>${esc(s.name)}</b><small>${esc(s.description||'')}</small></div><strong>${money(s.price_min)}${s.price_max>s.price_min?' – '+money(s.price_max):''}</strong></div>`).join('')}</div></div>`).join('')||'<p class="empty">ยังไม่มีบริการ</p>'}`;
 }
 if(active==='members')return `<div class="section-head"><div><span class="eyebrow">CLIENT DIRECTORY</span><h3>ทะเบียนสมาชิก</h3></div><button class="primary" id="addMember">＋ เพิ่มสมาชิก</button></div><div class="panel"><input class="search wide" id="memberSearch" placeholder="ค้นหาชื่อหรือเบอร์โทรศัพท์"><div id="memberRows">${memberRows(cache.members)}</div></div>`;
 if(active==='reports')return `<div class="section-head"><div><span class="eyebrow">BUSINESS PERFORMANCE</span><h3>รายงานผลดำเนินงาน</h3></div></div><div class="stats-grid"><article class="stat-card dark"><span>REVENUE · ALL LOADED</span><strong>${money(revenue)}</strong><small>ยอดบริการที่เสร็จสิ้น</small></article><article class="stat-card"><span>COMPLETED</span><strong>${ap.filter(a=>a.status==='completed').length}</strong><small>คิวที่ให้บริการแล้ว</small></article><article class="stat-card"><span>UPCOMING</span><strong>${ap.filter(a=>a.status==='confirmed'||a.status==='waiting').length}</strong><small>คิวรอดำเนินการ</small></article><article class="stat-card"><span>MEMBERS</span><strong>${cache.members.length}</strong><small>สมาชิกในระบบ</small></article></div><div class="panel"><h3>รายการนัดหมายและสถานะ</h3>${appointmentTable(ap)}</div>`;
 if(active==='profile')return `<div class="section-head"><div><span class="eyebrow">MY ACCOUNT</span><h3>โปรไฟล์ผู้ใช้งาน</h3><p class="muted">ข้อมูลบัญชีที่ใช้เข้าสู่ระบบ Phoenix Zpell</p></div></div><div class="panel settings-panel"><div class="profile-heading"><div class="user-avatar profile-avatar" id="profileAvatarPreview" style="width:104px;height:104px;border-radius:50%;overflow:hidden;display:grid;place-items:center;font-size:2rem">${avatarMarkup()}</div><div><h3>${esc(profile?.full_name||'ผู้ใช้งาน')}</h3><p class="muted">${profile?.role==='owner'?'เจ้าของร้าน':'พนักงาน'}</p></div></div><form id="profileForm" class="form-grid"><label class="avatar-upload-field">รูปโปรไฟล์<input id="avatarFile" name="avatar" type="file" accept="image/png,image/jpeg,image/webp"><small class="muted">รองรับ JPG, PNG, WEBP ขนาดไม่เกิน 3 MB</small></label><label>ชื่อ–นามสกุล<input name="full_name" value="${esc(profile?.full_name||'')}" placeholder="กรอกชื่อ–นามสกุล" required></label><label>อีเมล<input value="${esc(session?.user?.email||'')}" type="email" disabled></label><label>ตำแหน่งผู้ใช้งาน<input value="${profile?.role==='owner'?'เจ้าของร้าน':'พนักงาน'}" disabled></label><div class="form-actions"><button class="primary" type="submit">บันทึกข้อมูลโปรไฟล์</button></div></form><p class="muted">การเปลี่ยนอีเมลและรหัสผ่านให้จัดการผ่านระบบบัญชี Supabase ในขั้นตอนถัดไป</p></div>`;
 return `<div class="section-head"><div><span class="eyebrow">WORKSPACE SETTINGS</span><h3>ตั้งค่าระบบ</h3></div></div><div class="panel settings-panel"><h3>บัญชีผู้ใช้งาน</h3><p>ผู้ใช้งาน: ${esc(session?.user?.email||'demo@phoenixzpell.com')}</p><p>สิทธิ์: ${profile?.role==='owner'?'เจ้าของร้าน':'พนักงาน'}</p><p class="muted">การสร้างบัญชีพนักงานและกำหนดสิทธิ์จัดการ ทำได้จาก Supabase Authentication และตาราง profiles</p><button class="primary" id="logout2">ออกจากระบบ</button></div>`;
}
function appointmentTable(rows){return `<div class="panel table-panel"><div class="table-wrap"><table><thead><tr><th>เวลา</th><th>ลูกค้า</th><th>บริการ</th><th>ช่าง</th><th>ราคา</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${rows.length?rows.map(a=>`<tr><td class="time">${esc(a.appointment_time||'--:--')}</td><td><b>${esc(a.customer_name)}</b><small>${esc(a.phone||'')}</small></td><td>${esc(a.service_name)}</td><td><span class="stylist-tag">${esc(a.staff_nickname)}</span></td><td>${money(a.price)}</td><td><span class="status ${a.status}">${statusText(a.status)}</span></td><td><select class="status-select" data-status="${a.id}"><option value="">เปลี่ยนสถานะ</option><option value="waiting">รอการบริการ</option><option value="completed">รับบริการแล้ว</option><option value="cancelled">ยกเลิก</option></select></td></tr>`).join(''):`<tr><td colspan="7" class="empty">ยังไม่มีรายการนัดหมาย</td></tr>`}</tbody></table></div></div>`}
function statusText(s){return ({confirmed:'ยืนยันแล้ว',waiting:'รอการบริการ',completed:'รับบริการแล้ว',cancelled:'ยกเลิก'})[s]||s}
function memberRows(rows){return `<div class="table-wrap"><table><thead><tr><th>สมาชิก</th><th>เบอร์โทรศัพท์</th><th>วันที่สมัคร</th><th>จัดการ</th></tr></thead><tbody>${rows.map(m=>`<tr><td><div class="member-name"><span class="initial mini">${esc((m.full_name||'?').slice(0,1))}</span><b>${esc(m.full_name||'')}</b></div></td><td>${esc(m.phone||'-')}</td><td>${m.created_at?new Date(m.created_at).toLocaleDateString('th-TH'):'-'}</td><td><button class="quiet delete-member" data-delete-member="${esc(m.id)}">ลบสมาชิก</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty">ยังไม่มีสมาชิก</td></tr>'}</tbody></table></div>`}

function wirePage(){
  document.querySelectorAll('[data-profile]').forEach(el=>el.onclick=()=>{active='profile';render();});
  const avatarInput=$('#avatarFile');
  if(avatarInput)avatarInput.onchange=()=>{
    const file=avatarInput.files?.[0];
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>3*1024*1024){toast('กรุณาเลือกรูป JPG, PNG หรือ WEBP ขนาดไม่เกิน 3 MB',true);avatarInput.value='';return;}
    const reader=new FileReader();
    reader.onload=()=>{const preview=$('#profileAvatarPreview');if(preview)preview.innerHTML=`<img src="${reader.result}" alt="ตัวอย่างรูปโปรไฟล์" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;};
    reader.readAsDataURL(file);
  };
  const pf=$('#profileForm');
  if(pf)pf.onsubmit=async e=>{
    e.preventDefault();
    const full_name=String(new FormData(pf).get('full_name')||'').trim();
    if(!full_name)return toast('กรุณากรอกชื่อ–นามสกุล',true);
    if(!supabase)return toast('โหมดตัวอย่างไม่สามารถบันทึกข้อมูลจริงได้',true);
    const submit=pf.querySelector('button[type="submit"]');
    const file=$('#avatarFile')?.files?.[0];
    if(file && !['image/jpeg','image/png','image/webp'].includes(file.type))return toast('กรุณาเลือกรูป JPG, PNG หรือ WEBP',true);
    if(file && file.size>3*1024*1024)return toast('รูปโปรไฟล์ต้องมีขนาดไม่เกิน 3 MB',true);
    if(submit){submit.disabled=true;submit.textContent='กำลังบันทึก...';}
    try{
      const updates={full_name};
      if(file){
        const ext=file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
        const path=`${session.user.id}/avatar-${Date.now()}.${ext}`;
        const {error:uploadError}=await supabase.storage.from('avatars').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});
        if(uploadError)throw uploadError;
        const {data:urlData}=supabase.storage.from('avatars').getPublicUrl(path);
        updates.avatar_url=urlData.publicUrl;
      }
      const {data:updated,error}=await supabase.from('profiles').update(updates).eq('id',session.user.id).select().single();
      if(error)throw error;
      profile={...profile,...(updated||updates)};
      toast('บันทึกโปรไฟล์เรียบร้อยแล้ว');
      render();
    }catch(err){
      console.error('Profile update failed:',err);
      toast(err?.message||'บันทึกโปรไฟล์ไม่สำเร็จ',true);
      if(submit){submit.disabled=false;submit.textContent='บันทึกข้อมูลโปรไฟล์';}
    }
  };
 document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{active=b.dataset.go;render()});
 const sf=$('#serviceSelect'); if(sf)sf.onchange=()=>$('#priceInput').value=cache.services.find(s=>s.id===sf.value)?.price_min||0;
 const bf=$('#bookingForm'); if(bf)bf.onsubmit=async e=>{e.preventDefault();const f=new FormData(bf);const service=cache.services.find(s=>s.id===f.get('service_id'));const staff=cache.staff.find(s=>s.id===f.get('staff_id'));const obj={appointment_date:f.get('appointment_date'),appointment_time:f.get('appointment_time'),customer_name:f.get('customer_name'),phone:f.get('phone'),staff_id:f.get('staff_id'),service_id:f.get('service_id'),price:Number(f.get('price')),notes:f.get('notes'),status:'confirmed'};if(supabase){let member=await supabase.from('members').select('id').eq('phone',obj.phone).maybeSingle();let memberId=member.data?.id;if(!memberId){const ins=await supabase.from('members').insert({full_name:obj.customer_name,phone:obj.phone}).select('id').single();if(ins.error)return toast(ins.error.message,true);memberId=ins.data.id;}const {error}=await supabase.from('appointments').insert({...obj,member_id:memberId,created_by:session.user.id});if(error)return toast(error.message,true);await refresh();}else{cache.appointments.unshift({...obj,id:'a'+Date.now(),staff_nickname:staff.nickname,service_name:service.name});}toast('บันทึกการจองเรียบร้อย');active='schedule';render();};
 document.querySelectorAll('[data-status]').forEach(s=>s.onchange=async()=>{if(!s.value)return;if(supabase){const {error}=await supabase.from('appointments').update({status:s.value}).eq('id',s.dataset.status);if(error)return toast(error.message,true);await refresh();}else{const a=cache.appointments.find(x=>x.id===s.dataset.status);if(a)a.status=s.value;}toast('อัปเดตสถานะแล้ว');render();});
 const ms=$('#memberSearch');if(ms)ms.oninput=()=>$('#memberRows').innerHTML=memberRows(cache.members.filter(m=>(m.full_name+' '+(m.phone||'')).toLowerCase().includes(ms.value.toLowerCase())));
 const add=$('#addMember');if(add)add.onclick=async()=>{const name=prompt('ชื่อ-นามสกุลสมาชิก');if(!name)return;const phone=prompt('เบอร์โทรศัพท์')||'';if(supabase){const {error}=await supabase.from('members').insert({full_name:name,phone});if(error)return toast(error.message,true);await refresh();}else cache.members.unshift({id:'m'+Date.now(),full_name:name,phone,created_at:new Date().toISOString()});render();toast('เพิ่มสมาชิกแล้ว');};
 const ss=$('#scheduleSearch');if(ss)ss.oninput=()=>{const q=ss.value.toLowerCase();const filtered=cache.appointments.filter(a=>(a.customer_name+a.staff_nickname+a.service_name).toLowerCase().includes(q));$('.table-panel').outerHTML=appointmentTable(filtered);wireStatusOnly();};
  const addStaff=$('#addStaff');
  if(addStaff)addStaff.onclick=async()=>{
    const nickname=prompt('ชื่อเล่นช่าง เช่น NU');
    if(!nickname?.trim())return;
    const name_th=prompt('ชื่อช่าง เช่น ช่างนุ');
    if(!name_th?.trim())return;
    const role=prompt('ตำแหน่ง เช่น Senior Hair Stylist')||'';
    const specialty=prompt('ความเชี่ยวชาญ')||'';
    const row={nickname:nickname.trim(),name_th:name_th.trim(),role:role.trim(),specialty:specialty.trim(),active:true};
    addStaff.disabled=true;
    try{
      if(supabase){const {error}=await supabase.from('staff').insert(row);if(error)throw error;await refresh();}
      else cache.staff.push({...row,id:'staff'+Date.now()});
      render();toast('เพิ่มช่างเรียบร้อยแล้ว');
    }catch(err){toast(err.message||'เพิ่มช่างไม่สำเร็จ',true);addStaff.disabled=false;}
  };

  const addService=$('#addService');
  if(addService)addService.onclick=async()=>{
    const category_th=prompt('ชื่อประเภทบริการภาษาไทย');
    if(!category_th?.trim())return;
    const category_en=prompt('ชื่อประเภทบริการภาษาอังกฤษ');
    if(!category_en?.trim())return;
    const name=prompt('ชื่อบริการภาษาอังกฤษ');
    if(!name?.trim())return;
    const description=prompt('รายละเอียดบริการภาษาไทย')||'';
    const minRaw=prompt('ราคาเริ่มต้น (บาท)');
    if(minRaw===null||minRaw.trim()==='')return;
    const price_min=Number(minRaw);
    if(!Number.isFinite(price_min)||price_min<0)return toast('กรุณากรอกราคาเริ่มต้นให้ถูกต้อง',true);
    const maxRaw=prompt('ราคาสูงสุด (บาท)');
    if(maxRaw===null||maxRaw.trim()==='')return;
    const price_max=Number(maxRaw);
    if(!Number.isFinite(price_max)||price_max<price_min)return toast('ราคาสูงสุดต้องไม่น้อยกว่าราคาเริ่มต้น',true);
    const row={category_th:category_th.trim(),category_en:category_en.trim(),name:name.trim(),description:description.trim(),price_min,price_max,active:true};
    addService.disabled=true;
    try{
      if(supabase){const {error}=await supabase.from('services').insert(row);if(error)throw error;await refresh();}
      else cache.services.push({...row,id:'service'+Date.now()});
      render();toast('เพิ่มบริการเรียบร้อยแล้ว');
    }catch(err){toast(err.message||'เพิ่มบริการไม่สำเร็จ',true);addService.disabled=false;}
  };

  document.querySelectorAll('[data-delete-member]').forEach(btn=>{
    btn.onclick=async()=>{
      const id=btn.dataset.deleteMember;
      const member=cache.members.find(m=>String(m.id)===String(id));
      if(!member)return;
      if(!confirm(`ต้องการลบสมาชิก "${member.full_name}" ใช่หรือไม่?`))return;
      btn.disabled=true;
      try{
        if(supabase){
          const {count,error:checkError}=await supabase.from('appointments').select('id',{count:'exact',head:true}).eq('member_id',id);
          if(checkError)throw checkError;
          if((count||0)>0){toast('สมาชิกนี้มีประวัติการจอง จึงยังลบไม่ได้ เพื่อรักษาประวัติการใช้บริการ',true);btn.disabled=false;return;}
          const {error}=await supabase.from('members').delete().eq('id',id);
          if(error)throw error;
          await refresh();
        }else cache.members=cache.members.filter(m=>String(m.id)!==String(id));
        render();toast('ลบสมาชิกเรียบร้อยแล้ว');
      }catch(err){toast(err.message||'ลบสมาชิกไม่สำเร็จ',true);btn.disabled=false;}
    };
  });

 const l2=$('#logout2');if(l2)l2.onclick=()=>$('#logout').click();
}
function wireStatusOnly(){document.querySelectorAll('[data-status]').forEach(s=>s.onchange=async()=>{if(!s.value)return;if(supabase){await supabase.from('appointments').update({status:s.value}).eq('id',s.dataset.status);await refresh();}else{const a=cache.appointments.find(x=>x.id===s.dataset.status);if(a)a.status=s.value;}render();});}
if(supabase){supabase.auth.getSession().then(({data})=>data.session?boot(data.session):loginView());supabase.auth.onAuthStateChange((_e,s)=>{if(s&&!session)boot(s);});}else loginView();
