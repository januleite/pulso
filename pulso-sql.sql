-- ============================================================
-- PULSO DO BRASIL — setup completo do backend (Supabase)
-- Cole TUDO de uma vez no SQL Editor do seu projeto e rode.
-- Os nomes de cidade batem exatamente com os do app (importante).
-- ============================================================

-- 0. extensões (se pg_cron der erro, ative em Database > Extensions e rode de novo)
create extension if not exists pg_cron;

-- 1. tipo das 8 emoções
do $$ begin
  create type emotion as enum
    ('amor','esperanca','paz','raiva','ansiedade','tristeza','solidao','gratidao');
exception when duplicate_object then null; end $$;

-- 2. centróides aproximados (privacidade: o servidor "puxa" o batimento pro mais próximo)
create table if not exists cities (
  name text primary key, uf char(2) not null, region text not null,
  lat double precision not null, lng double precision not null
);
insert into cities (name, uf, region, lat, lng) values
 ('São Paulo','SP','Sudeste',-23.55,-46.63),('Rio de Janeiro','RJ','Sudeste',-22.91,-43.17),
 ('Belo Horizonte','MG','Sudeste',-19.92,-43.94),('Vitória','ES','Sudeste',-20.32,-40.34),
 ('Brasília','DF','Centro-Oeste',-15.79,-47.88),('Goiânia','GO','Centro-Oeste',-16.68,-49.25),
 ('Cuiabá','MT','Centro-Oeste',-15.60,-56.10),('Campo Grande','MS','Centro-Oeste',-20.46,-54.62),
 ('Salvador','BA','Nordeste',-12.97,-38.50),('Recife','PE','Nordeste',-8.05,-34.88),
 ('Fortaleza','CE','Nordeste',-3.73,-38.52),('Maceió','AL','Nordeste',-9.65,-35.74),
 ('Arapiraca','AL','Nordeste',-9.75,-36.66),('Natal','RN','Nordeste',-5.79,-35.21),
 ('João Pessoa','PB','Nordeste',-7.12,-34.86),('Aracaju','SE','Nordeste',-10.91,-37.07),
 ('Teresina','PI','Nordeste',-5.09,-42.80),('São Luís','MA','Nordeste',-2.53,-44.30),
 ('Belém','PA','Norte',-1.46,-48.50),('Manaus','AM','Norte',-3.12,-60.02),
 ('Porto Velho','RO','Norte',-8.76,-63.90),('Rio Branco','AC','Norte',-9.97,-67.81),
 ('Boa Vista','RR','Norte',2.82,-60.67),('Macapá','AP','Norte',0.03,-51.07),
 ('Palmas','TO','Norte',-10.18,-48.33),('Curitiba','PR','Sul',-25.43,-49.27),
 ('Florianópolis','SC','Sul',-27.59,-48.55),('Porto Alegre','RS','Sul',-30.03,-51.23)
on conflict (name) do nothing;

-- 3. batimentos: anônimos, efêmeros, sem usuário e sem coordenada crua
create table if not exists beats (
  id bigint generated always as identity primary key,
  emotion emotion not null, region text, uf char(2), city text,
  created_at timestamptz not null default now()
);
create index if not exists beats_created_idx on beats (created_at);

-- 4. arquivo afetivo permanente (só agregado)
create table if not exists daily_atlas (
  day date primary key, participations int not null, dominant emotion not null,
  color text not null, distribution jsonb not null, cities int not null,
  states int not null, hourly jsonb not null, soundscape_id text not null
);

-- 5. registrar batimento (arredonda lat/lng -> cidade e descarta a coordenada)
create or replace function cast_beat(
  p_emotion emotion, p_lat double precision default null, p_lng double precision default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_uf char(2); v_region text; v_city text;
begin
  if p_lat is not null and p_lng is not null then
    select uf, region, name into v_uf, v_region, v_city
    from cities order by (lat-p_lat)^2 + (lng-p_lng)^2 limit 1;
  end if;
  insert into beats(emotion, region, uf, city) values (p_emotion, v_region, v_uf, v_city);
end $$;
revoke all on function cast_beat from public;
grant execute on function cast_beat to anon, authenticated;

-- 6. leitura de agora (mistura dos últimos 15 min, só contagens)
create or replace function get_live() returns jsonb language sql stable as $$
  with w as (select * from beats where created_at > now() - interval '15 minutes')
  select jsonb_build_object(
    'counts',(select coalesce(jsonb_object_agg(emotion::text,c),'{}'::jsonb)
              from (select emotion, count(*) c from w group by emotion) e),
    'participants',(select count(*) from w),
    'cities',(select count(distinct city) from w),
    'states',(select count(distinct uf) from w),
    'beats_per_min',(select count(*) from w where created_at > now() - interval '1 minute'));
$$;
grant execute on function get_live to anon, authenticated;

-- 7. rollup diário (gera/atualiza um dia no Atlas)
create or replace function rollup_daily(p_day date) returns void language plpgsql as $$
declare v_total int; v_dom emotion; v_dist jsonb; v_hourly jsonb; v_color text;
begin
  select count(*) into v_total from beats where created_at >= p_day and created_at < p_day+1;
  if v_total = 0 then return; end if;

  select emotion into v_dom from beats
   where created_at >= p_day and created_at < p_day+1
   group by emotion order by count(*) desc limit 1;

  select jsonb_object_agg(emotion::text, round(c::numeric/v_total,4)) into v_dist
  from (select emotion, count(*) c from beats
        where created_at >= p_day and created_at < p_day+1 group by emotion) s;

  select jsonb_agg(jsonb_build_object('h',h,'counts',counts) order by h) into v_hourly
  from (select h, jsonb_object_agg(emotion::text,c) counts
        from (select extract(hour from created_at)::int h, emotion, count(*) c
              from beats where created_at >= p_day and created_at < p_day+1
              group by 1,2) pe
        group by h) ph;

  v_color := (select hex from (values
     ('amor','#ff2d55'),('esperanca','#ffc23d'),('paz','#2ee6c8'),('raiva','#ff3b1f'),
     ('ansiedade','#b14dff'),('tristeza','#2f6bff'),('solidao','#8a93a8'),('gratidao','#3ddb6a')
   ) m(k,hex) where k = v_dom::text);

  insert into daily_atlas(day,participations,dominant,color,distribution,cities,states,hourly,soundscape_id)
  values (p_day, v_total, v_dom, v_color, v_dist,
     (select count(distinct city) from beats where created_at>=p_day and created_at<p_day+1),
     (select count(distinct uf)   from beats where created_at>=p_day and created_at<p_day+1),
     coalesce(v_hourly,'[]'::jsonb),
     'Pulso #' || (abs(hashtext(p_day::text)) % 9000 + 1000)::text)
  on conflict (day) do update set
     participations=excluded.participations, dominant=excluded.dominant, color=excluded.color,
     distribution=excluded.distribution, cities=excluded.cities, states=excluded.states,
     hourly=excluded.hourly;
end $$;

-- 8. agendamentos: poda os batimentos crus e atualiza o Atlas
select cron.schedule('poda-beats','* * * * *',
  $$delete from beats where created_at < now() - interval '60 minutes'$$);
select cron.schedule('atlas-hoje','*/10 * * * *', $$select rollup_daily(now()::date)$$);
select cron.schedule('atlas-ontem','5 0 * * *',   $$select rollup_daily(now()::date - 1)$$);

-- 9. tempo real (Postgres Changes) + RLS
-- (beats já está na publicação supabase_realtime — linha removida)

alter table beats       enable row level security;
alter table daily_atlas enable row level security;

-- anon SÓ enxerga batimentos dos últimos 2 min (feed ao vivo, nunca histórico individual)
drop policy if exists "feed ao vivo" on beats;
create policy "feed ao vivo" on beats for select to anon, authenticated
  using (created_at > now() - interval '2 minutes');

-- Atlas é público (só agregado)
drop policy if exists "atlas público" on daily_atlas;
create policy "atlas público" on daily_atlas for select to anon, authenticated using (true);

grant select on beats       to anon, authenticated;
grant select on daily_atlas to anon, authenticated;
-- escrita só via cast_beat() (security definer). Ninguém faz INSERT direto.

-- ============================================================
-- pronto. Pegue Project URL + anon key em Settings > API
-- e cole nas duas linhas do topo do pulso-do-brasil.html
-- ============================================================
