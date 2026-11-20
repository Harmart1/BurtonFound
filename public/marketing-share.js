/* Share controls only act on a visitor click. No pixels, cookies, storage or auto-posting. */
(()=>{
  'use strict';
  const absolute=(raw)=>{
    try{
      const value=new URL(raw||window.location.href,window.location.href);
      return /^https?:$/.test(value.protocol)?value.href:null;
    }catch{return null;}
  };
  const status=(button,message)=>{
    const area=button.closest('.mk-share,.bf-gift-share');
    const output=area?.querySelector('[data-bf-copy-status]');
    if(output)output.textContent=message;
  };
  async function copy(url){
    if(navigator.clipboard?.writeText){
      try{await navigator.clipboard.writeText(url);return true;}catch{}
    }
    const field=document.createElement('textarea');
    field.value=url;field.setAttribute('readonly','');
    field.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
    document.body.append(field);field.select();
    let copied=false;
    try{copied=document.execCommand('copy');}catch{}
    field.remove();return copied;
  }
  document.addEventListener('click',async(event)=>{
    const button=event.target.closest?.('[data-bf-copy-link],[data-bf-share-platform]');
    if(!button)return;
    const raw=button.dataset.bfCopyLink||button.dataset.bfShareUrl;
    const url=absolute(raw);
    if(!url){status(button,'This link could not be prepared.');return;}
    if(button.hasAttribute('data-bf-copy-link')){
      const ok=await copy(url);
      status(button,ok?'Link copied. Ready to share.':'Copy the link from your browser address bar.');
      return;
    }
    const platform=button.dataset.bfSharePlatform;
    const title=button.dataset.bfShareTitle||document.title;
    if(platform==='native'&&navigator.share){
      try{await navigator.share({title,url});status(button,'Share options opened.');}
      catch(err){if(err?.name!=='AbortError')status(button,'Sharing was not completed. Try Copy link.');}
      return;
    }
    if(platform==='native'){const ok=await copy(url);status(button,ok?'Link copied. Ready to share.':'Use Copy link to share this item.');return;}
    let destination=null;
    if(platform==='facebook')destination='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url);
    if(platform==='pinterest'){
      const image=absolute(button.dataset.bfShareImage);
      destination='https://www.pinterest.com/pin/create/button/?url='+encodeURIComponent(url)+
        (image?'&media='+encodeURIComponent(image):'')+'&description='+encodeURIComponent(title);
    }
    if(!destination)return;
    const opened=window.open(destination,'_blank','noopener,noreferrer');
    status(button,opened===null?'Your browser may have blocked the share window. Use Copy link if needed.':'Share window opened.');
  });
})();
