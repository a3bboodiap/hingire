-- ============================================================================
-- Sample data.
--
-- Every company and job below is INVENTED. Never add a real company here:
-- the PRD forbids putting invented reviews on real companies, and these
-- reviews are invented. Everything is flagged is_sample = true.
-- ============================================================================

-- Sample reviews have no real author, so author_id becomes nullable but is
-- still required for anything a user writes.
alter table public.reviews alter column author_id drop not null;
alter table public.reviews
  add constraint reviews_author_or_sample
  check (author_id is not null or is_sample);

-- Sample reviews are inserted by the service role, which bypasses RLS, so the
-- "must have passed KYC" insert policy is untouched by this.

insert into public.companies (name, is_sample) values
  ('Lumen & Pike',        true),
  ('Verdabyte',           true),
  ('Olivetree Logistics', true),
  ('Northwind Studio',    true),
  ('Papersun Media',      true),
  ('Kestrel Analytics',   true),
  ('Bluefig Hospitality', true),
  ('Arcadia Health Tech', true),
  ('Tinderbox Games',     true),
  ('Marigold Retail Co',  true)
on conflict (name) do nothing;

with c as (select id, name from public.companies)
insert into public.jobs (
  company_id, title, description, location, pay_min, pay_max, currency,
  contract_type, work_mode, skills_wanted, languages_wanted,
  source_name, source_url, posted_at, is_sample
)
select c.id, j.title, j.description, j.location, j.pay_min, j.pay_max, 'EUR',
       j.contract_type::contract_type, j.work_mode::work_mode,
       j.skills, j.langs, 'Sample data', j.url,
       now() - (j.age_days || ' days')::interval, true
from (values
  ('Lumen & Pike', 'Marketing Intern',
   'Support the marketing team with social posts, a weekly newsletter and simple campaign reports. You will own the content calendar with help from your mentor. No prior agency experience needed.',
   'Madrid', 900, 1100, 'internship', 'hybrid',
   array['social media','canva','excel','copywriting','communication'],
   array['spanish','english'], 'https://example.invalid/jobs/lumen-pike-marketing-intern', 2),

  ('Verdabyte', 'Junior Data Analyst',
   'Clean and analyse product usage data, build dashboards and answer questions from the product team. SQL is used daily; Python is a bonus. Structured onboarding over the first month.',
   'Barcelona', 1600, 2000, 'full_time', 'hybrid',
   array['sql','excel','python','data analysis','tableau'],
   array['english'], 'https://example.invalid/jobs/verdabyte-junior-data-analyst', 5),

  ('Olivetree Logistics', 'Operations Assistant',
   'Keep shipments moving: track deliveries, update the system, and sort out problems with carriers over phone and email. Busy, practical, and you learn the whole chain quickly.',
   'Valencia', 1300, 1500, 'full_time', 'on_site',
   array['excel','customer service','time management','data entry','problem solving'],
   array['spanish','english'], 'https://example.invalid/jobs/olivetree-operations-assistant', 1),

  ('Northwind Studio', 'Junior UI Designer',
   'Work on screens for client apps under an art director. Figma all day, with a weekly critique. Portfolio matters more than years of experience.',
   'Remote', 1400, 1800, 'full_time', 'remote',
   array['figma','photoshop','illustrator','communication','teamwork'],
   array['english'], 'https://example.invalid/jobs/northwind-junior-ui-designer', 8),

  ('Papersun Media', 'Content Writing Intern',
   'Write short articles and social copy for lifestyle brands. You get a style guide, an editor and real bylines. Two days a week in the office.',
   'Seville', 700, 900, 'internship', 'hybrid',
   array['copywriting','seo','research','social media','content'],
   array['spanish','english'], 'https://example.invalid/jobs/papersun-content-intern', 3),

  ('Kestrel Analytics', 'Research Assistant (Part-time)',
   'Help a small research team gather and tidy data for client reports. Flexible hours around study, 20 hours a week. Heavy on spreadsheets and careful note-taking.',
   'Madrid', 800, 1000, 'part_time', 'hybrid',
   array['excel','research','data entry','spss','time management'],
   array['english','spanish'], 'https://example.invalid/jobs/kestrel-research-assistant', 11),

  ('Bluefig Hospitality', 'Front of House Team Member',
   'Greet guests, take orders and keep the floor running during service. Training provided, including barista basics. Shifts include evenings and weekends.',
   'Malaga', 1100, 1300, 'part_time', 'on_site',
   array['customer service','teamwork','communication','cash handling','barista'],
   array['spanish','english'], 'https://example.invalid/jobs/bluefig-front-of-house', 4),

  ('Arcadia Health Tech', 'Junior Software Engineer',
   'Build features in a TypeScript and React codebase for a clinic scheduling product. Pair programming twice a week, code review on everything. Graduates welcome.',
   'Barcelona', 1900, 2400, 'full_time', 'hybrid',
   array['typescript','react','git','sql','problem solving'],
   array['english'], 'https://example.invalid/jobs/arcadia-junior-software-engineer', 6),

  ('Tinderbox Games', 'QA Tester Intern',
   'Play builds, find bugs, write them up clearly and re-test fixes. You will sit with the dev team and see how a game gets finished. Six-month internship.',
   'Remote', 600, 800, 'internship', 'remote',
   array['communication','research','problem solving','teamwork','data entry'],
   array['english'], 'https://example.invalid/jobs/tinderbox-qa-intern', 9),

  ('Marigold Retail Co', 'Sales Assistant',
   'Help customers find what they need, keep the shop floor tidy and handle the till. Good first job: structured training and a supportive store manager.',
   'Zaragoza', 1200, 1400, 'full_time', 'on_site',
   array['sales','customer service','cash handling','stock control','teamwork'],
   array['spanish'], 'https://example.invalid/jobs/marigold-sales-assistant', 7)
) as j(company, title, description, location, pay_min, pay_max,
       contract_type, work_mode, skills, langs, url, age_days)
on c.name = j.company
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Sample reviews. Invented, on invented companies, flagged is_sample and
-- approved so they are visible. No reviewer name is stored or shown.
-- ---------------------------------------------------------------------------
with j as (
  select jobs.id as job_id, jobs.company_id, jobs.title, jobs.location,
         jobs.contract_type, companies.name as company
  from public.jobs
  join public.companies on companies.id = jobs.company_id
)
insert into public.reviews (
  author_id, job_id, company_id, job_title, job_description, job_location,
  contract_type, months_worked, overall, pay_fairness, workload, learning,
  management, would_recommend, comment, status, year_label, is_sample,
  published_at, proof_checked
)
select null, j.job_id, j.company_id, j.title, r.desc, j.location,
       j.contract_type, r.months, r.overall, r.pay, r.workload, r.learning,
       r.mgmt, r.rec, r.comment, 'approved'::review_status, r.yr, true,
       now() - (r.age || ' days')::interval, true
from j join (values
  ('Marketing Intern', 'Ran the content calendar and the weekly newsletter.', 6, 4, 3, 4, 5, 4, true,
   'Genuinely learned a lot. I was given real work in week two rather than filing things. Pay is low for the hours, which is the main downside, but the mentoring was excellent and I left with a portfolio.', 2025, 40),
  ('Marketing Intern', 'Social media and campaign reporting.', 4, 3, 2, 3, 4, 3, true,
   'Good people and a relaxed office. The internship pay barely covered transport and lunch. Work itself was varied and nobody treated me like free labour.', 2024, 120),
  ('Junior Data Analyst', 'Dashboards and ad-hoc analysis for the product team.', 14, 5, 5, 4, 5, 5, true,
   'Best first job I could have asked for. Proper code review on SQL, a real onboarding plan, and my manager protected my time when other teams piled on requests. Pay was fair for a junior role in the city.', 2025, 25),
  ('Junior Data Analyst', 'Reporting and data cleaning.', 9, 4, 4, 3, 4, 4, true,
   'Steady, well-organised team. Some weeks are repetitive data cleaning, which nobody pretends otherwise about. Flexible hybrid policy that was actually respected.', 2024, 200),
  ('Operations Assistant', 'Shipment tracking and carrier issues.', 11, 3, 3, 2, 3, 3, false,
   'Busy is an understatement. You learn the whole supply chain fast, but the phone does not stop and cover during holidays was thin. Fine if you want pace, hard if you want calm.', 2025, 55),
  ('Operations Assistant', 'Day-to-day operations support.', 18, 4, 3, 2, 4, 4, true,
   'Hard work and you earn your money, but the team genuinely helps each other. Got promoted after a year, which I did not expect.', 2024, 160),
  ('Junior UI Designer', 'Client app screens in Figma.', 8, 4, 4, 4, 5, 3, true,
   'Weekly critiques made me a much better designer in under a year. Fully remote and it worked. Direction from above could swing late in a project, which meant some rework.', 2025, 33),
  ('Content Writing Intern', 'Articles and social copy for lifestyle clients.', 5, 2, 1, 3, 3, 2, false,
   'The bylines were real and that helped my portfolio. But the pay is very low even for an internship, and feedback was inconsistent depending on who edited you that week.', 2025, 70),
  ('Content Writing Intern', 'Short-form content and SEO.', 6, 4, 2, 3, 5, 4, true,
   'Learned more about SEO here in six months than in two years of coursework. Low pay is the trade-off and they are upfront about it.', 2024, 240),
  ('Research Assistant (Part-time)', 'Data gathering for client reports.', 10, 5, 4, 5, 4, 5, true,
   'Genuinely flexible around exams, which is rare. Work is detailed and quiet. If you like spreadsheets and being left alone to concentrate, it is ideal.', 2025, 48),
  ('Front of House Team Member', 'Service, orders and floor.', 7, 3, 3, 2, 3, 2, false,
   'Shifts get changed at short notice, which made planning anything difficult. The team itself was great and training on coffee was proper. Tips help.', 2025, 60),
  ('Front of House Team Member', 'Front of house during service.', 13, 4, 4, 3, 3, 4, true,
   'Fast-paced but fair. Breaks were respected, which I hear is not normal in hospitality. Good first job for confidence.', 2024, 180),
  ('Junior Software Engineer', 'Features in a TypeScript and React codebase.', 16, 5, 5, 4, 5, 5, true,
   'Code review on everything and nobody made me feel stupid for asking. Pairing twice a week accelerated things enormously. Pay was at the top of the junior band locally.', 2025, 20),
  ('Junior Software Engineer', 'Frontend work on the scheduling product.', 12, 4, 4, 3, 5, 4, true,
   'Solid engineering culture and real tests. Some legacy corners of the codebase are rough and documentation lags behind. Still a great place to start.', 2024, 150),
  ('QA Tester Intern', 'Testing builds and writing up bugs.', 6, 3, 2, 3, 4, 3, true,
   'Seeing a game ship is a brilliant experience. Crunch near milestones was real, and as an intern you feel it too. Pay is at the bottom of the scale.', 2025, 44),
  ('Sales Assistant', 'Shop floor, customers and till.', 15, 4, 4, 3, 3, 5, true,
   'The store manager made the job. Clear training, fair rota, and problems got dealt with rather than ignored. Standing all day is the hardest part.', 2025, 36),
  ('Sales Assistant', 'Customer service and stock.', 8, 2, 2, 2, 2, 2, false,
   'Understaffed most shifts, so you are covering two sections at once. Nothing malicious, just stretched thin. Would not go back.', 2024, 210)
) as r(job_title, desc, months, overall, pay, workload, learning, mgmt, rec, comment, yr, age)
on r.job_title = j.title
on conflict do nothing;
