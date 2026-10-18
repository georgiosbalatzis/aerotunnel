import test from 'node:test';
import assert from 'node:assert/strict';
import { containRect, figureTitle, fieldCaption, wrapText, EMBED_URL, EMBED_CODE, defaultFigureTitle } from '../src/publishing/figure.js';
import { sessionIssue } from '../src/controls/validation.js';
import { csvIssue } from '../src/analysis/presentation.js';

test('publication fitting preserves source aspect ratio and contains portrait or landscape canvases', () => {
  for (const [w,h] of [[900,540],[400,1200],[2200,800]]) {
    const r=containRect(w,h,96,200,2208,1250);
    assert.ok(Math.abs(r.width/r.height-w/h)<1e-12);
    assert.ok(r.x>=96&&r.y>=200&&r.x+r.width<=2304.000001&&r.y+r.height<=1450.000001);
  }
  assert.throws(()=>containRect(0,200,0,0,100,100));
});
test('titles and wrapping retain Greek, bound long text and never exceed the available line width', () => {
  assert.equal(figureTitle('  Ροή\n\u0000 γύρω από πτέρυγα  ','Fallback'),'Ροή γύρω από πτέρυγα');
  assert.equal(figureTitle('', 'F1 Car · velocity'),'F1 Car · velocity');
  assert.equal(figureTitle('x'.repeat(500),'Fallback').length,140);
  const ctx={measureText:text=>({width:Array.from(text).length*10})};
  const text='A verylongunbrokentitle ελληνικά';const lines=wrapText(ctx,text,80);
  assert.ok(lines.every(line=>ctx.measureText(line).width<=80));
  assert.equal(lines.join('').replace(/\s/g,''),text.replace(/\s/g,''));
});
test('field captions use actual lattice quantities, ranges and qualitative caveats', () => {
  const density=fieldCaption({mode:'pressure',fields:[{mode:'pressure',min:.999,max:1.001}]});
  assert.match(density,/Density ρ.*lattice density.*0.999 to 1.001/);assert.match(density,/not Pa/);
  assert.match(fieldCaption({mode:'streamlines'}),/age, not speed/);
  assert.match(fieldCaption({mode:'3d',referenceShown:true}),/not a 3D LBM solution.*not the simulated 2D boundary/);
  assert.match(fieldCaption({mode:'velocity',comparing:true,fields:[{mode:'velocity',min:0,max:.2},{mode:'vorticity',min:-.1,max:.1}]}),/A ·.*B ·/);
});
test('article embeds carry only a fixed presentation flag and no local simulation state', () => {
  const url=new URL(EMBED_URL);assert.equal(url.pathname,'/aerotunnel/');assert.deepEqual([...url.searchParams],[['embed','1']]);
  assert.match(EMBED_CODE,/title=.*sandbox=.*allow="fullscreen"/);assert.doesNotMatch(EMBED_CODE,/session=|history=|top-navigation|postMessage/);
});
test('spreadsheet formula/text metrics are blocked without rewriting valid CSV data or raw JSON', () => {
  const valid=[{t:0,cl:0,cd:.008,re:6000,maxV:1}];assert.equal(csvIssue(valid),'');
  for (const bad of ['=1+1','+SUM(1,2)','@SUM(1)','1',NaN,Infinity]) {
    const row={...valid[0],cl:bad};assert.match(csvIssue([row]),/nonnumeric or nonfinite/);assert.equal(row.cl,bad);
  }
  assert.equal(csvIssue([{t:0,cl:null}]),'');
});

test('default publication titles identify captured comparison fields instead of the inactive base mode', () => {
  const title=defaultFigureTitle({preset:'f1car',mode:'velocity',comparing:true,difference:true,fields:[{mode:'pressure'},{mode:'vorticity'}]});
  assert.match(title,/F1 Car.*A: Density ρ.*B: Signed vorticity.*normalized Δ/);
  assert.doesNotMatch(title,/velocity/);
});

test('malformed import labels cannot enter React or unsupported visualization state', () => {
  assert.match(sessionIssue({app:'aerolab',version:2,geometry:{preset:{bad:1}}}),/must be text/);
  assert.match(sessionIssue({app:'aerolab',version:2,display:{mode:'javascript:alert(1)'}}),/supported/);
  assert.equal(sessionIssue({app:'aerolab',version:2,geometry:{preset:'legacy-custom'},display:{mode:'3d'}}),null);
});
