(() => {
  const root=document.documentElement, t=document.getElementById("themeBtn");
  const apply=md=>{ if(md==="light") root.dataset.theme="light"; else delete root.dataset.theme; t.textContent=md==="light"?"☾":"☀"; t.setAttribute("aria-label",md==="light"?"Switch to dark mode":"Switch to light mode"); try{localStorage.setItem("chrish-theme",md);}catch(e){} };
  try{ if(localStorage.getItem("chrish-theme")==="light") apply("light"); }catch(e){}
  let activeTransition;
  t.onclick=async()=>{
    const next=root.dataset.theme==="light"?"dark":"light";
    if(activeTransition) return;
    if(!document.startViewTransition||matchMedia("(prefers-reduced-motion: reduce)").matches){
      apply(next);
      return;
    }

    const button=t.getBoundingClientRect();
    const x=button.left+button.width/2;
    const y=button.top+button.height/2;
    const distance=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
    const count=144;
    const duration=980;
    // Each frame starts at the toggle and grows an irregular edge with tapered fingers.
    const frames=Array.from({length:33},(_,i)=>{
      const time=i/32;
      const growth=time*time*(3-2*time);
      const feather=Math.sin(Math.PI*time);
      const points=Array.from({length:count},(_,j)=>{
        const angle=j/count*Math.PI*2;
        const drift=angle+.14*Math.sin(time*4+angle*3);
        const finger=Math.pow(.5+.5*Math.sin(drift*9+.8),6);
        const filament=Math.pow(.5+.5*Math.sin(drift*17-1.2),12);
        const wave=.075*Math.sin(angle*5+time*7)+.04*Math.cos(angle*13-time*5);
        const r=Math.max(0,distance*(1.12*growth+feather*(wave+.22*finger+.095*filament)));
        return (x+Math.cos(angle)*r).toFixed(1)+"px "+(y+Math.sin(angle)*r).toFixed(1)+"px";
      });
      return {clipPath:"polygon("+points.join(",")+")"};
    });

    root.style.setProperty("--ink-start",frames[0].clipPath);
    root.classList.add("ink-transition");
    const transition=document.startViewTransition(()=>apply(next));
    activeTransition=transition;
    // Handle failed snapshots while preserving the normal theme change.
    transition.finished.catch(()=>{});
    try {
      await transition.ready;
      const reveal=root.animate(frames,{duration,fill:"both",pseudoElement:"::view-transition-new(root)"});
      await reveal.finished;
      await transition.finished;
    } catch {
      transition.skipTransition();
      await transition.updateCallbackDone.catch(()=>{});
    } finally {
      root.classList.remove("ink-transition");
      root.style.removeProperty("--ink-start");
      activeTransition=null;
    }
  };
})();
