/* Single source of truth for mobile/tablet site navigation on every page. */
(()=>{'use strict';
 function boot(){
   const menu=document.getElementById('mobileNav');
   const toggle=document.getElementById('menuToggle');
   if(!menu||!toggle)return;
   const closeButton=document.getElementById('menuClose');
   const overlay=document.createElement('button');
   overlay.type='button';overlay.className='site-menu-backdrop';overlay.tabIndex=-1;
   overlay.setAttribute('aria-label','Close navigation menu');overlay.hidden=true;
   menu.insertAdjacentElement('beforebegin',overlay);
   let returnFocus=null;
   const placeMenu=()=>{const header=toggle.closest('header');const bottom=Math.max(0,Math.round(header?.getBoundingClientRect().bottom||0));menu.style.top=bottom+'px';menu.style.maxHeight=Math.max(160,window.innerHeight-bottom)+'px';};
   const close=(restoreFocus=false)=>{
     if(menu.hidden)return;
     menu.hidden=true;overlay.hidden=true;
     toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open site menu');
     document.body.classList.remove('site-menu-open');
     if(restoreFocus)(returnFocus||toggle).focus();
   };
   const open=()=>{
     placeMenu();
     returnFocus=document.activeElement;
     menu.hidden=false;overlay.hidden=false;
     toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','Close site menu');
     document.body.classList.add('site-menu-open');
     (closeButton||menu.querySelector('a'))?.focus();
   };
   toggle.addEventListener('click',()=>menu.hidden?open():close(true));
   closeButton?.addEventListener('click',()=>close(true));
   overlay.addEventListener('click',()=>close(true));
   menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>close(false)));
   document.addEventListener('pointerdown',e=>{
     if(!menu.hidden&&!menu.contains(e.target)&&!toggle.contains(e.target)&&!overlay.contains(e.target))close(false);
   });
   document.addEventListener('keydown',e=>{
     if(menu.hidden)return;
     if(e.key==='Escape'){e.preventDefault();close(true);return}
     if(e.key!=='Tab')return;
     const focusable=[...menu.querySelectorAll('a[href],button:not([disabled])')].filter(x=>x.getClientRects().length);
     if(!focusable.length)return;
     const first=focusable[0],last=focusable[focusable.length-1];
     if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
     else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
   });
   window.addEventListener('resize',()=>{if(!menu.hidden)placeMenu()},{passive:true});
   window.addEventListener('scroll',()=>{if(!menu.hidden)placeMenu()},{passive:true});
   const viewport=window.matchMedia('(min-width: 1651px)');
   viewport.addEventListener?.('change',()=>close(false));
   window.addEventListener('pagehide',()=>close(false));
   window.addEventListener('hashchange',()=>close(false));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
