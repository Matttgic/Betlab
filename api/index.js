const U='https://zbmgskmvrqrzjdreggxg.supabase.co';
const K='sb_publishable_5_cFyydmpxFryLIy0J2p8A_KsSaVUjP';

async function rpc(name,args={}){
  const r=await fetch(`${U}/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:{apikey:K,'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify(args)
  });
  const raw=await r.text(); let b;
  try{b=raw?JSON.parse(raw):null}catch{b=raw}
  if(!r.ok)throw new Error(b?.message||b?.hint||String(b||r.statusText));
  return b;
}
function out(res,status,body){res.status(status).setHeader('cache-control','no-store').json(body)}
function lim(req,d=50,max=500){const n=Number(req.query.limit||d);return Math.min(max,Math.max(1,Number.isFinite(n)?n:d))}

export default async function(req,res){
  try{
    const p=String(req.query.path||'');
    if(p==='health')return out(res,200,{ok:true,service:'BetLab',store:'SUPABASE',mode:'PUBLIC_READ_PRIVATE_WRITE',time:new Date().toISOString()});
    if(p==='dashboard')return out(res,200,await rpc('betlab_public_dashboard'));
    if(p==='strategies')return out(res,200,{items:await rpc('betlab_public_strategies')||[]});
    if(p==='regulatory/status')return out(res,200,await rpc('betlab_public_regulatory_status'));
    if(p==='feed/status')return out(res,200,await rpc('betlab_public_feed_status'));
    if(p==='snapshots')return out(res,200,{items:await rpc('betlab_public_snapshots',{p_limit:lim(req,100)})||[]});
    if(p==='events/current')return out(res,200,{items:await rpc('betlab_public_current_events',{p_limit:lim(req,60,200)})||[]});
    if(p==='backtests')return out(res,200,{items:await rpc('betlab_public_backtests',{p_limit:lim(req,50,200)})||[]});
    if(p==='signals')return out(res,200,{items:await rpc('betlab_public_signals',{p_limit:lim(req,50,200)})||[]});
    return out(res,404,{error:'Not found'});
  }catch(e){console.error(e);return out(res,500,{error:e.message||'Internal error'})}
}
