-- Apply after supabase/schema.sql.
-- BetLab production schema for Supabase.
-- The app uses the Data API with a publishable key. All reads/writes happen through
-- token-protected RPC functions; direct anon/authenticated table access is denied.

create schema if not exists betlab_private;
revoke all on schema betlab_private from public, anon, authenticated;

create table if not exists betlab_private.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
revoke all on table betlab_private.settings from public, anon, authenticated;

create unique index if not exists uq_betlab_snapshot_identity on public.odds_snapshots(event_id, bookmaker, market, selection, coalesce(line, -999999::numeric), observed_at);

alter table public.strategies enable row level security;
alter table public.odds_snapshots enable row level security;
alter table public.signals enable row level security;
alter table public.research_trials enable row level security;
alter table public.regulatory_rules enable row level security;

revoke all on table public.strategies from anon, authenticated;
revoke all on table public.odds_snapshots from anon, authenticated;
revoke all on table public.signals from anon, authenticated;
revoke all on table public.research_trials from anon, authenticated;
revoke all on table public.regulatory_rules from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

create or replace function betlab_private.assert_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or length(p_token) < 32 or not exists (
    select 1 from betlab_private.settings s
    where s.key = 'ingest_token' and s.value = p_token
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
end;
$$;
revoke all on function betlab_private.assert_token(text) from public, anon, authenticated;

create or replace function public.betlab_dashboard(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  perform betlab_private.assert_token(p_token);
  select jsonb_build_object(
    'strategies', (select count(*) from public.strategies),
    'intraday', (select count(*) from public.strategies where requires_intraday),
    'snapshots', (select count(*) from public.odds_snapshots),
    'signals', (select count(*) from public.signals),
    'shadow', (select count(*) from public.signals where decision = 'SHADOW_BET'),
    'regulatoryMode', 'DEFAULT_DENY_UNTIL_RULES_LOADED'
  ) into v;
  return v;
end;
$$;

create or replace function public.betlab_strategies(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  perform betlab_private.assert_token(p_token);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.priority, x.family, x.name), '[]'::jsonb)
  into v from public.strategies x;
  return v;
end;
$$;

create or replace function public.betlab_snapshots(p_token text, p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  perform betlab_private.assert_token(p_token);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.observed_at desc, x.id desc), '[]'::jsonb)
  into v
  from (
    select * from public.odds_snapshots
    order by observed_at desc, id desc
    limit greatest(1, least(coalesce(p_limit,100),500))
  ) x;
  return v;
end;
$$;

create or replace function public.betlab_signals(p_token text, p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  perform betlab_private.assert_token(p_token);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc), '[]'::jsonb)
  into v
  from (
    select s.*, st.name as strategy_name
    from public.signals s
    left join public.strategies st on st.id = s.strategy_id
    order by s.created_at desc, s.id desc
    limit greatest(1, least(coalesce(p_limit,100),500))
  ) x;
  return v;
end;
$$;

create or replace function public.betlab_regulatory_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_count bigint; v_date date;
begin
  perform betlab_private.assert_token(p_token);
  select count(*), max(version_date) into v_count, v_date from public.regulatory_rules;
  return jsonb_build_object(
    'jurisdiction','FR',
    'loaded', v_count > 0,
    'versionDate', v_date,
    'policy','DEFAULT_DENY_WITHOUT_CURRENT_RULE'
  );
end;
$$;

create or replace function public.betlab_insert_snapshots(p_token text, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare item jsonb; v_count integer := 0; v_id bigint;
begin
  perform betlab_private.assert_token(p_token);
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be an array';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(item->>'event_id','') = ''
       or coalesce(item->>'sport','') = ''
       or coalesce(item->>'bookmaker','') = ''
       or coalesce(item->>'market','') = ''
       or coalesce(item->>'selection','') = ''
       or coalesce((item->>'odds')::numeric,0) <= 1
       or coalesce(item->>'observed_at','') = '' then
      continue;
    end if;

    v_id := null;
    insert into public.odds_snapshots(event_id,sport,competition,bookmaker,market,selection,line,odds,observed_at,source)
    values (
      item->>'event_id', item->>'sport', nullif(item->>'competition',''), item->>'bookmaker', item->>'market', item->>'selection',
      nullif(item->>'line','')::numeric, (item->>'odds')::numeric, (item->>'observed_at')::timestamptz, nullif(item->>'source','')
    )
    on conflict do nothing
    returning id into v_id;
    if v_id is not null then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;

create or replace function public.betlab_insert_signal(
  p_token text,
  p_event_id text,
  p_strategy_id text,
  p_market text,
  p_selection text,
  p_bookmaker text,
  p_odds numeric,
  p_market_probability numeric,
  p_model_probability numeric,
  p_shrunk_probability numeric,
  p_ev_raw numeric,
  p_ev_robust numeric,
  p_decision text,
  p_revision_of bigint,
  p_created_at timestamptz
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_id bigint;
begin
  perform betlab_private.assert_token(p_token);
  if p_decision not in ('NO_BET','SHADOW_BET','CANARY','PRODUCTION') then
    raise exception 'invalid decision';
  end if;
  insert into public.signals(event_id,strategy_id,market,selection,bookmaker,odds,p_market,p_model,p_shrunk,ev_raw,ev_robust,decision,revision_of,created_at)
  values (p_event_id,p_strategy_id,p_market,p_selection,p_bookmaker,p_odds,p_market_probability,p_model_probability,p_shrunk_probability,p_ev_raw,p_ev_robust,p_decision,p_revision_of,coalesce(p_created_at,now()))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.betlab_dashboard(text) from public, authenticated;
revoke all on function public.betlab_strategies(text) from public, authenticated;
revoke all on function public.betlab_snapshots(text,integer) from public, authenticated;
revoke all on function public.betlab_signals(text,integer) from public, authenticated;
revoke all on function public.betlab_regulatory_status(text) from public, authenticated;
revoke all on function public.betlab_insert_snapshots(text,jsonb) from public, authenticated;
revoke all on function public.betlab_insert_signal(text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,text,bigint,timestamptz) from public, authenticated;

grant execute on function public.betlab_dashboard(text) to anon;
grant execute on function public.betlab_strategies(text) to anon;
grant execute on function public.betlab_snapshots(text,integer) to anon;
grant execute on function public.betlab_signals(text,integer) to anon;
grant execute on function public.betlab_regulatory_status(text) to anon;
grant execute on function public.betlab_insert_snapshots(text,jsonb) to anon;
grant execute on function public.betlab_insert_signal(text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,text,bigint,timestamptz) to anon;

notify pgrst, 'reload schema';
