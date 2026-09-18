import assert from "node:assert/strict";
const base = "http://localhost:5173";
const headers = { Cookie: "__sites_local_auth=1", Origin: base, "Content-Type": "application/json" };
async function request(path,body,overrides={}) {
  const response=await fetch(base+path,{headers:{...headers,...overrides},...(body ? {method:"POST",body:JSON.stringify(body)} : {})});
  const text=await response.text();
  let data; try { data=JSON.parse(text); } catch { data=text; }
  return {status:response.status,data};
}
let result=await request('/api/catalog'); assert.equal(result.status,200,JSON.stringify(result.data));
assert.equal(result.data.filter(i=>i.kind==='product' && !i.code.startsWith('QA-')).length,251);
const item={id:crypto.randomUUID(),kind:'product',code:'QA-'+Date.now(),label:'QA TESTE LOCAL',internal:'ADAPTADOR',classCc:'SMT',station:'',sector:'',active:1,revision:0};
assert.equal((await request('/api/catalog',item)).status,200);
assert.equal((await request('/api/catalog',{...item,id:crypto.randomUUID()})).status,409);
assert.equal((await request('/api/catalog',{...item,id:crypto.randomUUID(),code:'QA-INVALID',classCc:''})).status,400);
assert.equal((await request('/api/catalog',{...item,revision:1,label:'QA EDITADO'})).status,200);
assert.equal((await request('/api/catalog',{...item,revision:1})).status,409);
assert.equal((await request('/api/catalog',{...item,revision:2,active:0})).status,200);
assert.equal((await request('/api/catalog',{...item,revision:3,active:1},{Origin:'https://invalid.example'})).status,403);
assert.equal((await request('/api/catalog',undefined,{Cookie:''})).status,401);
const record={id:crypto.randomUUID(),kind:'production',date:'2026-09-17',shift:'1',line:'QA-CATALOG-'+Date.now(),pn:'33K0008-0',model:'24W FRECOM',quantity:100,code:'',description:'',position:'',station:'',category:'ADAPTADOR',classCc:'ADAPTADOR',author:'QA',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:1};
assert.equal((await request('/api/records',{id:crypto.randomUUID(),entry:record})).status,200);
result=await request('/api/records?year=2026');
const saved=result.data.records.find(r=>r.id===record.id);
assert.equal(saved.category,'ADAPTADOR'); assert.equal(saved.classCc,'ADAPTADOR');
console.log('PASS: catálogo, duplicação, validação, edição, conflito, inativação, origem, autenticação e persistência das classificações. Dados QA somente no banco local.');
