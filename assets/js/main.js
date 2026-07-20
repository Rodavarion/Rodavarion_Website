
(()=>{
  const root=document.documentElement;
  const button=document.querySelector('.theme-toggle');
  const saved=localStorage.getItem('rodavarion-theme');
  if(saved==='light'||saved==='dark') root.dataset.theme=saved;
  button?.addEventListener('click',()=>{const next=root.dataset.theme==='light'?'dark':'light';root.dataset.theme=next;localStorage.setItem('rodavarion-theme',next)});

  const items=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.1});items.forEach(item=>observer.observe(item));}else items.forEach(item=>item.classList.add('visible'));

  const canvas=document.querySelector('.engineering-canvas');
  if(canvas && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();canvas.style.setProperty('--mx',`${((e.clientX-r.left)/r.width)*100}%`);canvas.style.setProperty('--my',`${((e.clientY-r.top)/r.height)*100}%`)});
    canvas.addEventListener('pointerleave',()=>{canvas.style.setProperty('--mx','50%');canvas.style.setProperty('--my','50%')});
  }

  const modules=[...document.querySelectorAll('.topology .module')];
  let moduleIndex=0;
  const activateModule=()=>{modules.forEach((m,i)=>m.classList.toggle('is-active',i===moduleIndex));document.querySelector('.core-ring')?.classList.toggle('is-active',true);moduleIndex=(moduleIndex+1)%modules.length};
  activateModule();
  const moduleTimer=matchMedia('(prefers-reduced-motion: reduce)').matches?null:setInterval(activateModule,2200);
  modules.forEach((m,i)=>m.addEventListener('mouseenter',()=>{if(moduleTimer) clearInterval(moduleTimer);modules.forEach((x,j)=>x.classList.toggle('is-active',i===j))}));

  const rows=[...document.querySelectorAll('.system-row')];
  const openProduct=row=>{const target=row.dataset.target;if(target){const el=document.querySelector(target);if(el){el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});history.replaceState(null,'',target);setTimeout(()=>el.classList.add('download-attention'),180);setTimeout(()=>el.classList.remove('download-attention'),1500)}}};
  rows.forEach(row=>{row.addEventListener('click',()=>openProduct(row));row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openProduct(row)}})});

  const latency=document.querySelector('#latency-readout');
  if(latency && !matchMedia('(prefers-reduced-motion: reduce)').matches){setInterval(()=>{latency.textContent=`latency ${String(3+Math.floor(Math.random()*6)).padStart(2,'0')}ms`},2400)}


  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const boot=document.querySelector('.boot-sequence');
  if(boot){
    const done=()=>boot.classList.add('is-complete');
    if(reduced) done(); else window.addEventListener('load',()=>setTimeout(done,2550),{once:true});
  }


  const coordX=document.querySelector('#coord-x'),coordY=document.querySelector('#coord-y');
  window.addEventListener('pointermove',e=>{
    coordX&&(coordX.textContent=`X ${String(Math.round(e.clientX)).padStart(3,'0')}`);
    coordY&&(coordY.textContent=`Y ${String(Math.round(e.clientY)).padStart(3,'0')}`);
  },{passive:true});

  const dataCanvas=document.querySelector('.data-canvas');
  if(dataCanvas && !reduced){
    const ctx=dataCanvas.getContext('2d'); let w=0,h=0,dpr=1,t=0;
    const resize=()=>{dpr=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;dataCanvas.width=w*dpr;dataCanvas.height=h*dpr;dataCanvas.style.width=w+'px';dataCanvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0)};
    resize(); addEventListener('resize',resize,{passive:true});
    const branches=[.16,.29,.43,.58,.72,.84];
    const draw=()=>{t+=.0035;ctx.clearRect(0,0,w,h);ctx.lineWidth=.7;ctx.strokeStyle='rgba(85,214,176,.16)';ctx.fillStyle='rgba(228,185,73,.42)';
      branches.forEach((p,i)=>{const y=h*p;ctx.beginPath();ctx.moveTo(-40,y);for(let x=-40;x<w+60;x+=70){ctx.lineTo(x,y+Math.sin(x*.008+t*16+i)*8)}ctx.stroke();const px=((t*90+i*.17)%1)*(w+120)-60;ctx.beginPath();ctx.arc(px,y+Math.sin(px*.008+t*16+i)*8,1.8,0,Math.PI*2);ctx.fill()});requestAnimationFrame(draw)};draw();
  }

  if(!reduced){
    const parallax=[...document.querySelectorAll('.engineering-canvas,.heritage-emblem,.layer-stack')];
    addEventListener('scroll',()=>{const y=scrollY;parallax.forEach((el,i)=>el.style.transform=`translate3d(0,${Math.sin((y+i*140)*.002)*5}px,0)`)},{passive:true});
  }

  root.classList.add('css-ready');
})();

// Rodavarion Interface Language 0.6 — single canonical DataFlow view
(()=>{
  const root=document.documentElement;
  root.dataset.view='dataflow';
  localStorage.removeItem('rodavarion-view');
  localStorage.removeItem('rodavarion-view-06');

  const descriptions={
    FOUNDATION:['RODAVARION FOUNDATION','Стандарти, Toolkit і дизайн-мова формують перевірену базову лінію для всіх систем.','RDN-FND-01'],
    CORE:['RODAVARION CORE','Спільне ядро координує ідентичність, аудит, резервування та конфігурацію всієї екосистеми.','RDN-CORE-02'],
    TERP:['TERP','Операційна система бізнес-процесів: склад, облік, продажі, аналітика та контрольована багатокористувацька робота.','RDN-ERP-03A'],
    TDRIVER:['TDRIVER','Системне середовище для периферії, інтеграцій, профілів обладнання та автоматизації.','RDN-SYS-03B'],
    TLAW:['TLAW','Правова інтелектуальна система для чинності актів, зв’язків, ієрархії та виявлення суперечностей.','RDN-LAW-03C']
  };
  const nodes=[...document.querySelectorAll('.space-node')],title=document.querySelector('#inspector-title'),copy=document.querySelector('#inspector-copy'),code=document.querySelector('#inspector-code'),consoleEl=document.querySelector('.space-console');
  nodes.forEach(node=>node.addEventListener('click',()=>{const key=node.dataset.node;nodes.forEach(n=>n.classList.toggle('is-selected',n===node));consoleEl&&(consoleEl.dataset.activeSystem=key);const d=descriptions[key];if(d){title.textContent=d[0];copy.textContent=d[1];code.textContent=d[2]}}));
  const clock=document.querySelector('#console-clock');setInterval(()=>{if(clock)clock.textContent=new Date().toLocaleTimeString('uk-UA',{hour12:false})},1000);
  const sync=document.querySelector('#sync-value');setInterval(()=>{if(sync)sync.textContent=`${98+Math.floor(Math.random()*3)}%`},3200);

  const topoModules=[...document.querySelectorAll('.topology .module')],systemRows=[...document.querySelectorAll('.system-row')],state=document.querySelector('#topology-state');
  const focusSystem=name=>{topoModules.forEach(m=>{m.classList.toggle('is-focused',m.dataset.system===name);m.classList.toggle('is-dim',m.dataset.system!==name)});systemRows.forEach(r=>r.classList.toggle('is-linked',r.dataset.system===name));if(state)state.textContent=`route locked: ${name}`};
  const clearFocus=()=>{topoModules.forEach(m=>m.classList.remove('is-focused','is-dim'));systemRows.forEach(r=>r.classList.remove('is-linked'));if(state)state.textContent='topology synchronized'};
  const productTargets={TERP:'#download-terp',TDRIVER:'#download-tdriver',TLAW:'#download-tlaw'};
  topoModules.forEach(m=>{m.addEventListener('click',()=>{const name=m.dataset.system;focusSystem(name);const el=document.querySelector(productTargets[name]);if(el)setTimeout(()=>el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'}),120)});m.addEventListener('dblclick',clearFocus)});
  systemRows.forEach(r=>{r.addEventListener('mouseenter',()=>focusSystem(r.dataset.system));r.addEventListener('mouseleave',clearFocus)});
})();


// 0.6.2 — Product download navigation
(()=>{
  const targets={TERP:'#download-terp',TDRIVER:'#download-tdriver',TLAW:'#download-tlaw'};
  document.querySelectorAll('.space-node[data-node]').forEach(node=>{
    node.addEventListener('dblclick',()=>{const target=targets[node.dataset.node];if(target)document.querySelector(target)?.scrollIntoView({behavior:'smooth',block:'center'})});
  });
  document.querySelectorAll('.product-download').forEach(link=>{
    if(!link.getAttribute('href')||link.getAttribute('href').startsWith('__')){link.classList.add('btn-disabled');link.removeAttribute('download');link.addEventListener('click',e=>e.preventDefault())}
  });
})();
