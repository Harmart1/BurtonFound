(()=>{'use strict';
 const key='bf_aggregate_activity_choice';
 const groups=new Set(['home','coca-cola','hollywood','automobiles','sets','guides','other']);
 const events=new Set(['page_view','add_to_bag','checkout_open']);
 const blocked=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'||window.doNotTrack==='1';
 const allowed=()=>{try{return !blocked()&&localStorage.getItem(key)==='yes';}catch{return false;}};
 const group=()=>{
  const path=location.pathname,sku=document.querySelector('[data-bf-stock-sku]')?.getAttribute('data-bf-stock-sku')||'';
  if(path.includes('/collections/sets'))return 'sets';
  if(/^(VA-|BF-VA-)/.test(sku)||/vintage-cars|collections\/automobiles/.test(path))return 'automobiles';
  if(/^OH/.test(sku)||path.includes('/collections/hollywood'))return 'hollywood';
  if(/^CC/.test(sku)||path.includes('/collections/coca-cola'))return 'coca-cola';
  if(path.includes('/guides/')||path.includes('/gifts/'))return 'guides';
  return path==='/'||/\/(index|storefront)(\.html)?$/.test(path)?'home':'other';
 };
 function record(event,collection='other'){
  if(!allowed()||!events.has(event)||!groups.has(collection))return;
  fetch('/api/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,collection}),credentials:'omit',referrerPolicy:'no-referrer',keepalive:true}).catch(()=>{});
 }
 let counted=false;
 function page(){if(!counted&&allowed()){counted=true;record('page_view',group());}}
 function render(){for(const b of document.querySelectorAll('[data-bf-activity-choice]')){b.textContent=blocked()?'Optional analytics off (browser privacy setting)':allowed()?'Optional analytics: on — turn off':'Optional analytics: off — enable';b.setAttribute('aria-pressed',String(allowed()));b.disabled=blocked();}}
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-bf-activity-choice]');if(!b||blocked())return;
  try{localStorage.setItem(key,allowed()?'no':'yes');}catch{}
  render();page();
 });
 window.addEventListener('storage',e=>{if(e.key===key){render();page();}});
 function start(){
  const footer=document.querySelector('footer');
  if(footer&&!document.querySelector('[data-bf-activity-choice]')){
   const p=document.createElement('p'),b=document.createElement('button');b.type='button';b.dataset.bfActivityChoice='';b.className='bf-activity-choice';p.append(b,document.createTextNode(' · Optional anonymous daily activity counts. No advertising tracking.'));footer.append(p);
  }
  render();page();
 }
 window.BURTON_ACTIVITY=Object.freeze({record});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();