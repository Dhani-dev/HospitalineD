-- Expand (api/v4): additive and nullable so api/v3 keeps reading and writing.
-- Contract (drop or NOT NULL) only after v3 is retired; never in the same release.
alter table public.hospital
  add column if not exists bed_capacity integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'hospital_bed_capacity_non_negative'
  ) then
    alter table public.hospital
      add constraint hospital_bed_capacity_non_negative
      check (bed_capacity is null or bed_capacity >= 0);
  end if;
end $$;
