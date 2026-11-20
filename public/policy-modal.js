/* Burton & Found policy viewer: links remain valid standalone pages without JS. */
(()=>{'use strict';
  const allowed=new Set(['privacy','terms','shipping-returns','cookies','accessibility']);
  let dialog,content,title,closeButton,lastTrigger=null;
  const cache=new Map();
  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='bfPolicyDialog';dialog.className='bf-policy-dialog';
    dialog.setAttribute('aria-labelledby','bfPolicyDialogTitle');
    dialog.innerHTML='<div class="bf-policy-dialog-frame"><header class="bf-policy-dialog-head"><p class="bf-policy-dialog-brand">Burton &amp; Found · Store Policies</p><h2 id="bfPolicyDialogTitle" tabindex="-1">Store policy</h2><button type="button" class="bf-policy-dialog-close" aria-label="Close policy window">Close <span aria-hidden="true">×</span></button></header><div class="bf-policy-dialog-scroll" id="bfPolicyDialogBody" tabindex="0" aria-label="Policy text"></div><footer class="bf-policy-dialog-foot"><a id="bfPolicyDialogFull" href="/policies/privacy.html">Open full policy page</a><button type="button" class="bf-policy-dialog-bottom-close">Close window</button></footer></div>';
    document.body.appendChild(dialog);
    content=dialog.querySelector('#bfPolicyDialogBody');
    title=dialog.querySelector('#bfPolicyDialogTitle');
    closeButton=dialog.querySelector('.bf-policy-dialog-close');
    dialog.querySelectorAll('.bf-policy-dialog-close,.bf-policy-dialog-bottom-close').forEach(button=>button.addEventListener('click',()=>dialog.close()));
    dialog.addEventListener('close',()=>{
      const element=lastTrigger;
      if(element?.isConnected&&typeof element.focus==='function')element.focus({preventScroll:true});
      else document.querySelector('a[data-policy]')?.focus({preventScroll:true});
      lastTrigger=null;
    });
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
    return dialog;
  }
  function policySlug(url){
    try{
      const parsed=new URL(url,window.location.href);
      const match=parsed.pathname.match(/^\/policies\/(privacy|terms|shipping-returns|cookies|accessibility)\.html$/);
      return parsed.origin===window.location.origin&&match?match[1]:null;
    }catch{return null}
  }
  async function show(slug,trigger){
    if(!allowed.has(slug))return;
    const target='/policies/'+slug+'.html';
    ensureDialog();
    if(!dialog.open){lastTrigger=trigger||document.activeElement;dialog.showModal()}
    content.innerHTML='<p class="bf-policy-loading" role="status">Loading policy…</p>';
    title.textContent='Store policy';dialog.querySelector('#bfPolicyDialogFull').href=target;content.scrollTop=0;
    closeButton.focus();
    try{
      let markup=cache.get(slug);
      if(!markup){
        const response=await fetch(target,{headers:{Accept:'text/html'}});
        if(!response.ok)throw Error('Policy page unavailable');
        const documentPage=new DOMParser().parseFromString(await response.text(),'text/html');
        const article=documentPage.querySelector('[data-bf-policy-content]');
        const heading=article?.querySelector('h1')?.textContent?.trim();
        if(!article||!heading)throw Error('Policy content not found');
        markup={html:article.outerHTML,title:heading};
        cache.set(slug,markup);
      }
      // The source is our own same-origin static policy page, not user input.
      content.innerHTML=markup.html;
      title.textContent=markup.title;
    }catch{
      content.innerHTML='<p>We could not load this policy in the pop-up. <a href="'+target+'">Open the full policy page</a> instead.</p>';
      title.textContent='Policy unavailable in pop-up';
    }
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[data-policy]');
    if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
    const slug=policySlug(link.href);
    if(!slug)return;
    event.preventDefault();
    show(slug,link);
  });
  window.BURTON_POLICY={open:slug=>show(slug,document.activeElement)};
})();