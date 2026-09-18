import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { validateCatalog } from "../src/domain/catalog.ts";
import { validateEntry } from "../src/domain/fpy.ts";

function migrated() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../drizzle/",import.meta.url)).filter(f => f.endsWith(".sql")).sort())
    db.exec(readFileSync(new URL("../drizzle/"+file,import.meta.url),"utf8"));
  return db;
}
test("importação mantém 251 PNs, ambas classificações e todos os defeitos", () => {
  const db=migrated();
  assert.equal(db.prepare("SELECT count(*) AS n FROM catalog WHERE kind='product'").get().n,251);
  assert.equal(db.prepare("SELECT count(*) AS n FROM catalog WHERE kind='defect'").get().n,1210);
  for (const pn of ['16B071-0','16B072-0','24V0008-0','90K0008-0']) assert.equal(db.prepare("SELECT count(*) AS n FROM catalog WHERE kind='product' AND code=?").get(pn).n,0);
  const frecom=db.prepare("SELECT * FROM catalog WHERE code='33K0008-0'").get();
  assert.equal(frecom.label,'24W FRECOM'); assert.equal(frecom.internal,'ADAPTADOR'); assert.equal(frecom.class_cc,'ADAPTADOR');
  for (const row of db.prepare("SELECT id,kind,code,label,internal,class_cc AS classCc,station,sector,active,revision FROM catalog").all()) assert.doesNotThrow(() => validateCatalog(row));
  assert.equal(db.prepare("SELECT count(*) AS n FROM catalog WHERE code='AUT10'").get().n,2);
  assert.equal(db.prepare("SELECT count(*) AS n FROM catalog WHERE code='RFT01'").get().n,2);
  db.close();
});
test("unicidade de PN e de defeito por setor/estação, revisão e auditoria", () => {
  const db=migrated();
  assert.throws(() => db.exec("INSERT INTO catalog SELECT 'duplicate-pn',kind,lower(code),label,internal,class_cc,station,sector,active,revision,changed_by,updated_at FROM catalog WHERE code='33K0008-0'"),/UNIQUE/);
  const item=db.prepare("SELECT * FROM catalog WHERE code='33K0008-0'").get();
  const before=db.prepare("SELECT count(*) AS n FROM catalog_audit").get().n;
  const change=db.prepare("UPDATE catalog SET active=0,revision=revision+1,changed_by='qa' WHERE id=? AND revision=?");
  assert.equal(change.run(item.id,1).changes,1);
  assert.equal(change.run(item.id,1).changes,0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM catalog_audit").get().n,before+1);
  const audit=db.prepare("SELECT * FROM catalog_audit ORDER BY id DESC LIMIT 1").get();
  assert.equal(JSON.parse(audit.before).active,1); assert.equal(JSON.parse(audit.after).active,0);
  db.close();
});
test("cadastro exige classificações e produção preserva Interno / Class. CC", () => {
  const product={id:'test-product',kind:'product',code:' 33k0008-0 ',label:'24W FRECOM',internal:'adaptador',classCc:'adaptador',station:'',sector:'',active:1,revision:0};
  assert.equal(validateCatalog(product).code,'33K0008-0');
  assert.throws(() => validateCatalog({...product,classCc:''}),/Class/);
  assert.throws(() => validateCatalog({...product,revision:-1}),/Estado/);
  assert.throws(() => validateCatalog({...product,kind:'defect'}),/estação/);
  const entry=validateEntry({id:'test-entry',kind:'production',date:'2026-09-17',shift:'1',line:'A',pn:'33K0008-0',model:'24W FRECOM',quantity:100,code:'',description:'',position:'',station:'',category:'ADAPTADOR',classCc:'ADAPTADOR'});
  assert.equal(entry.category,'ADAPTADOR'); assert.equal(entry.classCc,'ADAPTADOR');
});
