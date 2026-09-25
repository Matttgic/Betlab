-- BetLab SHADOW engine: research-only signal generation.
-- Requires the private betlab schema, pg_cron and previously seeded strategies.

create or replace function betlab.run_shadow_market_dispersion()
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $$
declare
  v_inserted int := 0;
  v_shadow int := 0;
  v_rejected int := 0;
begin
  with latest as (
    select event_id, max(observed_at) observed_at
    from betlab.odds_snapshots
    where market='H2H' and source='football-data-fixtures'
    group by event_id
  ), x as (
    select s.event_id,s.selection,
           max(s.odds) filter(where s.bookmaker='market_avg') avg_odds,
           max(s.odds) filter(where s.bookmaker='market_max') max_odds
    from betlab.odds_snapshots s
    join latest l on l.event_id=s.event_id and l.observed_at=s.observed_at
    where s.market='H2H'
    group by s.event_id,s.selection
  ), q as (
    select *,1/avg_odds q from x where avg_odds>1 and max_odds>1
  ), z as (
    select *,q/sum(q) over(partition by event_id) p_fair from q
  ), scored as (
    select *,
      case when max_odds>=5 then 0.04 when max_odds>=3.5 then 0.03 else 0.02 end uncertainty,
      p_fair*max_odds-1 ev_raw
    from z
  ), classified as (
    select *,
      greatest(0.01,p_fair-uncertainty)*max_odds-1 ev_robust,
      case
        when max_odds<=7.5
         and ev_raw>=0.03
         and greatest(0.01,p_fair-uncertainty)*max_odds-1 >= case when max_odds>4 then 0.04 else 0 end
        then 'SHADOW_BET' else 'NO_BET'
      end decision
    from scored
    where ev_raw>=0.02
  ), ins as (
    insert into betlab.signals(event_id,strategy_id,market,selection,bookmaker,odds,p_market,p_model,p_shrunk,ev_raw,ev_robust,decision,created_at)
    select c.event_id,
           case when c.decision='SHADOW_BET' then 'market_dispersion' else 'false_value' end,
           'H2H',c.selection,'market_max',c.max_odds,c.p_fair,null,null,c.ev_raw,c.ev_robust,c.decision,now()
    from classified c
    where not exists (
      select 1 from betlab.signals s
      where s.event_id=c.event_id and s.market='H2H' and s.selection=c.selection
        and s.bookmaker='market_max' and s.odds=c.max_odds
        and s.created_at > now()-interval '12 hours'
    )
    returning decision
  )
  select count(*),count(*) filter(where decision='SHADOW_BET'),count(*) filter(where decision='NO_BET')
  into v_inserted,v_shadow,v_rejected from ins;

  return jsonb_build_object(
    'inserted',v_inserted,'shadow',v_shadow,'rejected',v_rejected,
    'policy','market_avg_devig_vs_market_max_with_uncertainty_penalty'
  );
end;
$$;

revoke all on function betlab.run_shadow_market_dispersion() from public,anon,authenticated;

create or replace function public.betlab_public_signals(p_limit integer default 50)
returns jsonb
language sql
security definer
set search_path to ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb)
  from (
    select id,event_id,strategy_id,market,selection,bookmaker,odds,p_market,ev_raw,ev_robust,decision,created_at,result,profit,closing_odds
    from betlab.signals
    order by created_at desc,id desc
    limit greatest(1,least(coalesce(p_limit,50),200))
  ) x;
$$;
revoke all on function public.betlab_public_signals(integer) from public,authenticated;
grant execute on function public.betlab_public_signals(integer) to anon;

select cron.schedule(
  'betlab_shadow_engine_6h',
  '25 */6 * * *',
  'select betlab.run_shadow_market_dispersion();'
);

-- Legacy token RPCs are service-only. Public clients use read-only RPCs.
revoke all on function public.betlab_dashboard(text) from anon,authenticated,public;
revoke all on function public.betlab_insert_snapshots(text,jsonb) from anon,authenticated,public;
revoke all on function public.betlab_insert_signal(text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,numeric,text,bigint,timestamptz) from anon,authenticated,public;
revoke all on function public.betlab_regulatory_status(text) from anon,authenticated,public;
revoke all on function public.betlab_signals(text,integer) from anon,authenticated,public;
revoke all on function public.betlab_snapshots(text,integer) from anon,authenticated,public;
revoke all on function public.betlab_strategies(text) from anon,authenticated,public;

create index if not exists idx_betlab_research_trials_strategy_id on betlab.research_trials(strategy_id);
create index if not exists idx_betlab_signals_revision_of on betlab.signals(revision_of);
create index if not exists idx_betlab_signals_strategy_id on betlab.signals(strategy_id);
