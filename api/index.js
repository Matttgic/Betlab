const U='https://zbmgskmvrqrzjdreggxg.supabase.co';
const K='sb_publishable_5_cFyydmpxFryLIy0J2p8A_KsSaVUjP';

async function rpc(name){
  const r=await fetch(`${U}/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:{apikey:K,'content-type':'application/json',accept:'application/json'},
    body:'{}'
  });
  const raw=await r.text();
  let b;
  try{b=raw?JSON.parse(raw):null}catch{b=raw}
  if(!r.ok)throw new Error(b?.message||b?.hint||String(b||r.statusText));
  return b;
}

function out(res,status,body){
  res.status(status).setHeader('cache-control','no-store').json(body);
}

export default async function(req,res){
  try{
    const p=String(req.query.path||'');
    if(p==='health')return out(res,200,{ok:true,service:'BetLab',store:'SUPABASE',mode:'PUBLIC_READ_PRIVATE_WRITE',time:new Date().toISOString()});
    if(p==='dashboard')return out(res,200,await rpc('betlab_public_dashboard'));
    if(p==='strategies')return out(res,200,{items:await rpc('betlab_public_strategies')||[]});
    if(p==='regulatory/status')return out(res,200,await rpc('betlab_public_regulatory_status'));
    return out(res,404,{error:'Not found'});
  }catch(e){
    console.error(e);
    return out(res,500,{error:e.message||'Internal error'});
  }
}
