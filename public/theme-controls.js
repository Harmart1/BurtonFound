/* One simple appearance switch, available on every page. */
(()=>{'use strict';const key='burton_found_theme';
const buttons=()=>[...document.querySelectorAll('.theme-toggle')];
function refresh(){const dark=document.documentElement.dataset.theme==='dark';buttons().forEach(button=>{
button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');
button.setAttribute('title',dark?'Switch to light mode':'Switch to dark mode');
button.querySelector('.theme-icon').textContent=dark?'☀':'☾';
button.querySelector('.theme-label').textContent=dark?'Light mode':'Dark mode';
});}
function setTheme(next,save=true){document.documentElement.dataset.theme=next;
if(save)try{localStorage.setItem(key,next)}catch{}
refresh();}
function boot(){buttons().forEach(button=>button.addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark')));
refresh();
if(window.matchMedia){const q=window.matchMedia('(prefers-color-scheme: dark)');q.addEventListener?.('change',e=>{
let saved=null;try{saved=localStorage.getItem(key)}catch{}
if(saved!=='light'&&saved!=='dark')setTheme(e.matches?'dark':'light',false);
});}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('storage',e=>{if(e.key===key){const next=e.newValue==='light'||e.newValue==='dark'?e.newValue:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');setTheme(next,false)}});
})();
