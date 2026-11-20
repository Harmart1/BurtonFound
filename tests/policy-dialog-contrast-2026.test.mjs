import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('public/policy-modal.css');
const body=(selector)=>{
  const at=css.indexOf(selector+' {');
  assert.ok(at>=0,'CSS rule exists: '+selector);
  return css.slice(at+selector.length+2,css.indexOf('}',at));
};
const token=(rules,name)=>{
  const m=rules.match(new RegExp('--bf-policy-'+name+':\\s*(#[0-9a-fA-F]{6})\\s*;'));
  assert.ok(m,'palette includes '+name);
  return m[1];
};
function relativeLuminance(hex){
  const values=[1,3,5].map(i=>Number.parseInt(hex.slice(i,i+2),16)/255);
  const linear=values.map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
  return 0.2126*linear[0]+0.7152*linear[1]+0.0722*linear[2];
}
function contrast(one,two){
  const [light,dark]=[relativeLuminance(one),relativeLuminance(two)].sort((a,b)=>b-a);
  return (light+0.05)/(dark+0.05);
}
test('policy pop-up always has paired text and background colours despite global dark dialog styles',()=>{
  const globalTheme=read('public/accessibility-theme.css');
  assert.match(globalTheme,/:is\([^\n]*dialog\)\{background:var\(--ui-surface\)!important/);
  const light=body('#bfPolicyDialog');
  const dark=body('html[data-theme="dark"] #bfPolicyDialog');
  assert.match(light,/background:\s*var\(--bf-policy-paper\)\s*!important/);
  assert.match(dark,/background:\s*var\(--bf-policy-paper\)\s*!important/);
  assert.match(light,/color:\s*var\(--bf-policy-ink\)\s*!important/);
  assert.match(dark,/color:\s*var\(--bf-policy-ink\)\s*!important/);
  assert.match(css,/#bfPolicyDialog \.bf-policy-content/);
  assert.match(css,/#bfPolicyDialog \.bf-policy-content :is\(p,ul,li/);
  for(const [theme,block] of [['light',light],['dark',dark]]){
    const colors=Object.fromEntries(['paper','ink','muted','soft','head','head-ink','link'].map(key=>[key,token(block,key)]));
    for(const [label,fg,bg] of [
      ['body',colors.ink,colors.paper],
      ['subdued copy',colors.muted,colors.paper],
      ['hyperlinks',colors.link,colors.paper],
      ['heading bar',colors['head-ink'],colors.head],
      ['secondary panel',colors.ink,colors.soft],
      ['panel links',colors.link,colors.soft]
    ]){
      const c=contrast(fg,bg);
      assert.ok(c>=7,theme+' '+label+' contrast '+c.toFixed(2)+' must reach WCAG AAA for normal text');
    }
  }
});
test('font size, line-height and visible close controls stay readable on small devices',()=>{
  const content=body('#bfPolicyDialog .bf-policy-content');
  assert.match(content,/font-size:\s*1\.075rem\s*!important/);
  assert.match(content,/line-height:\s*1\.76\s*!important/);
  assert.match(css,/@media \(max-width: 580px\)/);
  assert.match(css,/font-size:\s*1\.0625rem\s*!important/);
  assert.match(css,/#bfPolicyDialog :is\(\.bf-policy-dialog-close,\.bf-policy-dialog-bottom-close\)/);
  assert.match(css,/min-height:\s*46px/);
  const dialog=read('public/policy-modal.js');
  assert.match(dialog,/\.showModal\(\)/);
  assert.match(dialog,/dialog\.close\(\)/);
  assert.match(dialog,/\.focus\(\{preventScroll:true\}\)/);
});
