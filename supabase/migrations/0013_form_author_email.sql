-- Add author_email to forms table so we can display the creator without joining auth.users
alter table forms add column if not exists author_email text;
