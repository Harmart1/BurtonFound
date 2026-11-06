/* Apply preference before first paint to avoid flashing the wrong theme. */
(()=>{'use strict';const key='burton_found_theme';let v;try{v=localStorage.getItem(key)}catch{}
if(v!=='light'&&v!=='dark'){v=window.matchMedia?.('(prefers-color-scheme: dark)')?.matches?'dark':'light'}
document.documentElement.dataset.theme=v;
})();
