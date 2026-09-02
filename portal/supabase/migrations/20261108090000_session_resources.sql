-- Kobler kursressurser til en konkret samling (nullbar = «Felles for kurset»).
-- Eksisterende RLS på resource_items dekker kolonnen: tilgang styres fortsatt
-- av audience + binding/enrollment, ikke av samlingskoblingen.
alter table public.resource_items
add column course_session_id uuid
  references public.course_sessions(id) on delete set null;

create index resource_items_course_session_id_idx
  on public.resource_items (course_session_id)
  where course_session_id is not null;
