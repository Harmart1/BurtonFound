/* Burton & Found · public collection preview sharing.
   No feedback form, visitor review collection, or unconfigured email delivery. */
(()=>{
 'use strict';
 const byId=id=>document.getElementById(id);
 const status=byId('shareStatus');
 const context=byId('shareContext');
 const previewUrl=()=>new URL('preview.html',location.href).href;
 const publicLink=()=>location.protocol==='https:'&&!/(localhost|127\\.0\\.0\\.1|chatgpt|openai|oaiusercontent|sandbox)/i.test(location.hostname);
 const announce=message=>{if(status)status.textContent=message;};
 function gate(){
   if(publicLink())return true;
   announce('Use the published HTTPS website address to share the collection.');
   return false;
 }
 async function copy(value){
   if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);return;}catch{}}
   const temp=document.createElement('textarea');
   temp.value=value;temp.style.cssText='position:fixed;top:-10000px;left:-10000px';
   document.body.appendChild(temp);temp.focus();temp.select();
   let ok=false;try{ok=document.execCommand('copy')}catch{}
   temp.remove();
   if(!ok)throw Error('Copy unavailable');
 }
 const on=(id,fn)=>byId(id)?.addEventListener('click',fn);
 on('shareCopy',async()=>{
   if(!gate())return;
   try{await copy(previewUrl());announce('Collection preview link copied.');}
   catch{announce('Unable to copy automatically. Copy this page address from your browser.');}
 });
 on('shareFacebook',()=>{
   if(!gate())return;
   window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(previewUrl()),'_blank','noopener,noreferrer');
 });
 on('shareEmail',()=>{
   if(!gate())return;
   const subject='Discover Burton & Found — vintage advertising and collectibles';
   const body='I thought you might enjoy browsing Burton & Found, a vintage paper and collectibles store with Coca-Cola advertising, Old Hollywood, and classic automobile advertisements.\\n\\n'+previewUrl()+'\\n\\nExplore the photographed items and prices in Canadian dollars. Online card payments are not yet enabled.';
   location.href='mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
 });
 on('shareNative',async()=>{
   if(!gate())return;
   if(navigator.share){
     try{
       await navigator.share({title:'Burton & Found | Collection Preview',text:'Explore vintage advertising, Old Hollywood, automobiles and collectible paper.',url:previewUrl()});
     }catch(error){if(error?.name!=='AbortError')announce('Sharing was unavailable. Use Copy preview link instead.');}
   }else{
     byId('shareCopy')?.click();
   }
 });
 if(!publicLink()&&context)context.textContent='These sharing controls use the public website address when the preview is hosted over HTTPS.';
})();