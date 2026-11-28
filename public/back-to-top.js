/* Shared, independent collection navigation. No network or storage access. */
(()=>{
 'use strict';
 function boot(){
  if(document.getElementById('bfBackToTop'))return;
  const button=document.createElement('button');
  button.id='bfBackToTop';button.className='bf-back-to-top';button.type='button';button.hidden=true;
  button.setAttribute('aria-label','Back to top of page');
  const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='↑';
  const label=document.createElement('span');label.textContent='Top';button.append(arrow,label);
  document.body.append(button);
  let scheduled=false;
  const update=()=>{scheduled=false;button.hidden=window.scrollY<Math.max(400,window.innerHeight*.65);};
  const onScroll=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}};
  button.addEventListener('click',()=>{
   const target=document.querySelector('header a[href], header button, .top a[href]')||document.querySelector('h1');
   if(target){if(!target.matches('a[href],button,[tabindex]'))target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
   window.scrollTo({top:0,left:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  });
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',onScroll,{passive:true});
  window.addEventListener('pageshow',update);
  update();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
