-- Phoenix Zpell Salon Management
-- Run this entire script in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'staff' check (role in ('owner','staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  nickname text not null unique,
  name_th text not null,
  role text not null,
  specialty text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name_th text not null unique,
  name_en text not null,
  sort_order int not null default 0
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id),
  category_th text not null,
  category_en text not null,
  name text not null,
  description text,
  price_min numeric(10,2) not null default 0,
  price_max numeric(10,2) not null default 0,
  price_note text default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists members_phone_idx on public.members(phone);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete set null,
  customer_name text,
  phone text,
  staff_id uuid references public.staff(id),
  service_id uuid references public.services(id),
  appointment_date date not null,
  appointment_time time not null,
  price numeric(10,2) not null default 0,
  status text not null default 'confirmed' check (status in ('confirmed','waiting','completed','cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists appointments_date_idx on public.appointments(appointment_date, appointment_time);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  amount numeric(10,2) not null,
  payment_method text,
  paid_at timestamptz not null default now(),
  received_by uuid references auth.users(id)
);

create table if not exists public.work_schedules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  work_date date not null,
  start_time time not null,
  end_time time not null,
  note text,
  unique(staff_id, work_date, start_time)
);

-- Profile role helper. SECURITY DEFINER avoids recursive RLS on profiles.
create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.categories enable row level security;
alter table public.services enable row level security;
alter table public.members enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.work_schedules enable row level security;

-- Signed-in staff can read operational data. Owner-only tables/actions are guarded.
create policy "profiles read self or owner" on public.profiles for select to authenticated
using (id = auth.uid() or public.current_user_role() = 'owner');
create policy "owner manages profiles" on public.profiles for all to authenticated
using (public.current_user_role() = 'owner') with check (public.current_user_role() = 'owner');

create policy "staff read" on public.staff for select to authenticated using (true);
create policy "owner manages staff" on public.staff for all to authenticated
using (public.current_user_role() = 'owner') with check (public.current_user_role() = 'owner');
create policy "categories read" on public.categories for select to authenticated using (true);
create policy "owner manages categories" on public.categories for all to authenticated
using (public.current_user_role() = 'owner') with check (public.current_user_role() = 'owner');
create policy "services read" on public.services for select to authenticated using (true);
create policy "owner manages services" on public.services for all to authenticated
using (public.current_user_role() = 'owner') with check (public.current_user_role() = 'owner');

create policy "staff reads members" on public.members for select to authenticated using (true);
create policy "staff adds members" on public.members for insert to authenticated with check (true);
create policy "owner or staff updates members" on public.members for update to authenticated using (true) with check (true);
create policy "owner deletes members" on public.members for delete to authenticated using (public.current_user_role() = 'owner');

create policy "staff reads appointments" on public.appointments for select to authenticated using (true);
create policy "staff creates appointments" on public.appointments for insert to authenticated with check (true);
create policy "staff updates appointments" on public.appointments for update to authenticated using (true) with check (true);
create policy "owner deletes appointments" on public.appointments for delete to authenticated using (public.current_user_role() = 'owner');

create policy "staff reads payments" on public.payments for select to authenticated using (true);
create policy "staff creates payments" on public.payments for insert to authenticated with check (true);
create policy "owner manages payments" on public.payments for all to authenticated
using (public.current_user_role() = 'owner') with check (public.current_user_role() = 'owner');

create policy "staff reads schedules" on public.work_schedules for select to authenticated using (true);
create policy "owner manages schedules" on public.work_schedules for all to authenticated
using (public.current_user_role() = 'owner') with check (public.current_user_role() = 'owner');

-- Seed salon roster
insert into public.staff(nickname,name_th,role,specialty) values
('NU','ช่างนุ','Senior Hair Stylist','Cut & Blow, Styling'),
('MUYONG','ช่างหมูหยอง','Colorist Specialist','ORDEVE, Schwarzkopf'),
('AOF','ช่างอ๊อฟ','Perm & Straightening Specialist','Digital Perm, Relaxing'),
('BEE','ช่างบี','Highlights & Bleaching Specialist','Highlights, Bleaching'),
('BAM','ช่างแบม','Keratin & Treatment Specialist','Brazilian Blowout, Olaplex'),
('POR','ช่างปอ','Hair Stylist & Updo','Cut & Blow, Hair Up')
on conflict (nickname) do update set name_th=excluded.name_th,role=excluded.role,specialty=excluded.specialty;

insert into public.categories(name_th,name_en,sort_order) values
('ตัดและจัดแต่งทรง','Cut & Styling',1),
('ทำสีและฟอกผม','Color & Highlights',2),
('ดัดและยืดผม','Perm & Relaxing',3),
('ทรีทเม้นท์และบำรุง','Treatment & Care',4)
on conflict (name_th) do nothing;

insert into public.services(category_th,category_en,name,description,price_min,price_max,price_note) values
('ตัดและจัดแต่งทรง','Cut & Styling','Cut & Blow','ตัดผม + สระไดร์',500,500,''),
('ตัดและจัดแต่งทรง','Cut & Styling','Blow Dry','สระไดร์',200,500,'ตามความยาวผม'),
('ตัดและจัดแต่งทรง','Cut & Styling','Hair up + Make up','เกล้าผม + แต่งหน้า',2000,2000,''),
('ทำสีและฟอกผม','Color & Highlights','ORDEVE','ทำสีออร์ดีฟ',2500,4500,'+'),
('ทำสีและฟอกผม','Color & Highlights','Schwarzkopf ZERO AMM','ทำสีชวาร์สคอฟ',2500,4500,'++'),
('ทำสีและฟอกผม','Color & Highlights','Schwarzkopf + LECTURA','ทำสีชวาร์สคอฟ + เลคทูร่า',2000,4000,'++'),
('ทำสีและฟอกผม','Color & Highlights','Glossing','Semi-permanent color',1500,3500,'++'),
('ทำสีและฟอกผม','Color & Highlights','Prelightening / Bleaching','ฟอกสีผม Step 1–3',500,3500,'++'),
('ทำสีและฟอกผม','Color & Highlights','Hilight / Lowlight','ไฮไลท์ครึ่งศีรษะ / เต็มศีรษะ',1500,4000,'++'),
('ดัดและยืดผม','Perm & Relaxing','Digital Perm','ดัดดิจิตอล',3000,5500,'++'),
('ดัดและยืดผม','Perm & Relaxing','Shiseido ISO Cold Perm','ดัดเย็น',1500,3500,''),
('ดัดและยืดผม','Perm & Relaxing','Down Perm','ดาวเพิร์ม',1500,1500,''),
('ดัดและยืดผม','Perm & Relaxing','Foil Perm','ดัดฟอยล์',2500,3000,''),
('ดัดและยืดผม','Perm & Relaxing','Relaxing','ยืดผม',2000,5000,''),
('ทรีทเม้นท์และบำรุง','Treatment & Care','Brazilian Blowout','บราซิเลี่ยน โบลว์เอาท์',3500,6500,'+++'),
('ทรีทเม้นท์และบำรุง','Treatment & Care','Keratin Complex','เคราติน คอมเพล็กซ์',4000,7500,'++'),
('ทรีทเม้นท์และบำรุง','Treatment & Care','Olaplex Bond Strengthening','บำรุงโครงสร้างเส้นผม',3000,4000,'++'),
('ทรีทเม้นท์และบำรุง','Treatment & Care','Moroccanoil Treatment','โมรอคแคนออยล์',1500,3500,'++'),
('ทรีทเม้นท์และบำรุง','Treatment & Care','Joico 4 pac','4 ขั้นตอน',1500,3000,''),
('ทรีทเม้นท์และบำรุง','Treatment & Care','FIBERPLEX / เชื่อมแกน LECTURA','เชื่อมแกน LECTURA',1500,3000,''),
('ทรีทเม้นท์และบำรุง','Treatment & Care','Nioxin','ล้างสารเคมี',2500,3000,'')
on conflict do nothing;

-- Create auth users in Supabase Authentication first, then add their profile rows.
-- First account should be assigned role='owner' manually in Table Editor / SQL:
-- insert into public.profiles(id,full_name,role) values ('AUTH_USER_UUID','ชื่อเจ้าของร้าน','owner');
