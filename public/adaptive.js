/* Responsive capabilities: feature detection, not browser/device-name sniffing.
   Keeps accessibility + menu states correct after rotation or browser resizing. */
(() => {
 'use strict';
 const init=()=>{
 const root=document.documentElement;
 const isLab=document.body.classList.contains('papertrail-page');
 const menu=document.getElementById('mobileNav');
 const toggle=document.getElementById('menuToggle');
 const desktop=window.matchMedia('(min-width:1121px)');
 const touch=window.matchMedia('(pointer:coarse)');
 let priorWidth=-1;
 const sync=()=>{
   const width=document.documentElement.clientWidth;
   root.dataset.viewport=width<=700?'phone':width<=1120?'tablet':'desktop';
   root.dataset.input=touch.matches?'touch':'pointer';
   root.dataset.orientation=window.innerWidth>window.innerHeight?'landscape':'portrait';
   if(desktop.matches && menu && toggle){
     menu.hidden=true;
     toggle.setAttribute('aria-expanded','false');
   }
   priorWidth=width;
 };
 let pending=false;
 const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;sync()})};
 window.addEventListener('resize',schedule,{passive:true});
 window.addEventListener('orientationchange',schedule,{passive:true});
 touch.addEventListener?.('change',schedule);
 desktop.addEventListener?.('change',schedule);
 sync();
 /* The universal site-menu.js controls every mobile navigation consistently. */
};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
