-- EXF Evaluator seed data
-- Insert NTAE program
insert into programs (id, name, slug, description, brand_color)
values (
  'a1000000-0000-0000-0000-000000000001',
  'New Technologies for Ag Extension (NTAE)',
  'ntae',
  'Supports Cooperative Extension professionals in adopting and scaling technology-enabled educational tools and approaches.',
  '#ea580c'
) on conflict (slug) do nothing;

-- Assign super_admin to Aaron
insert into program_memberships (user_id, program_id, role)
values (
  '4b4d7065-0235-4d1c-a42b-db7a62cc32a7',
  'a1000000-0000-0000-0000-000000000001',
  'super_admin'
) on conflict (user_id, program_id) do nothing;
