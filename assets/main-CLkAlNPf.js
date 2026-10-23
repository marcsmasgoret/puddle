const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/forest-CiIavrkb.js","assets/solver-B8WNz4Cn.js","assets/beach-B-YUSv2V.js","assets/city-d74cJSU1.js","assets/backyard-BYdCulm2.js","assets/dock-CV6H0io3.js","assets/highpark-CWtnBYID.js","assets/lionsgate-BtxsEJfZ.js","assets/algonquin-BwXQs1nl.js"])))=>i.map(i=>d[i]);
import"./modulepreload-polyfill-P2Xu9kJm.js";import{$ as e,At as t,B as n,Bt as r,C as i,Ct as a,D as o,Dt as s,F as c,G as l,I as u,It as d,J as f,K as p,L as m,Lt as h,M as g,Mt as _,N as ee,Nt as te,O as v,Ot as y,P as b,Pt as ne,Q as re,R as ie,Rt as x,S as ae,St as oe,T as se,Tt as ce,U as le,V as ue,W as de,X as fe,Y as pe,Z as me,_ as he,a as ge,at as _e,bt as ve,c as ye,ct as be,dt as xe,et as Se,f as Ce,ft as we,gt as S,h as Te,ht as Ee,i as De,it as Oe,j as ke,jt as Ae,k as je,kt as Me,l as Ne,lt as C,m as Pe,mt as Fe,nt as Ie,o as Le,ot as w,p as Re,q as T,r as ze,rt as E,s as Be,st as Ve,t as He,tt as Ue,ut as We,vt as Ge,w as Ke,wt as qe,x as Je,xt as Ye,yt as Xe,z as Ze,zt as Qe}from"./solver-B8WNz4Cn.js";var $e=.022,et=.5;function tt(e,t,n){let r=t*n*.8*e.depth;return{x:e.x,z:e.z,radius:$e,pressure:r*(1-Math.exp(-e.t/et))}}var nt=.045,rt=.5;function it(e){return .3+4.7*Math.max(0,Math.min(1,e))**1.4}function at(e,t,n,r,i=nt,a=1/0){let o=i,s=n.density,c=Math.min(4/3*s*o**3*e,a),l=c/(Math.PI*o*o),u=Math.sqrt(2/Math.E)*l/(s*o),d=Math.sqrt(r*Math.max(t,.002)),f=u/d,p=Math.min(1,1*d/u),m=Math.min(.8*e,6),h=rt/(1+5*Je(n)),g=p<1&&n.splashes?(1-p)*c*h/m:0,_=.5*s*Math.PI*o*o*t;return g=Math.min(g,_),{pressureImpulse:p*l,radius:o,sprayMass:g,sprayMeanSpeed:m,froudeRequested:f}}var ot=.02,st=.05,ct=1.5;function lt(e,t,n,r,i){let a=n-e,o=r-t,s=Math.hypot(a,o);if(s<1e-5)return[];let c=a/i,l=o/i,u=Math.hypot(c,l);u>ct&&(c*=ct/u,l*=ct/u);let d=1-Math.exp(-.04/Math.max(Math.hypot(c,l),.001)/st),f=Math.max(1,Math.ceil(s/(ot*.5))),p=s/f,m=Math.min(1,p/(ot*Math.sqrt(Math.PI))),h=[];for(let n=1;n<=f;n++){let r=n/f;h.push({x:e+a*r,z:t+o*r,radius:ot,pressureImpulse:0,push:[c*d*m,l*d*m]})}return h}var ut=1.204,dt=.47,ft=class{fluid;isWater;towardWater;pos=new Float32Array(1800);vel=new Float32Array(1800);radius=new Float32Array(600);alive=new Uint8Array(600);mode=new Uint8Array(600);timer=new Float32Array(600);count=0;gravity=9.81;constructor(e,t,n){this.fluid=e,this.isWater=t,this.towardWater=n}clear(){this.alive.fill(0),this.mode.fill(0),this.count=0}spray(e,t,n,r,i){let a=r/this.fluid.density,o=0;for(let r=0;r<600&&a>0;r++){let r=this.alive.indexOf(0);if(r<0)break;let s=.0012*Math.exp(Math.random()*Math.log(4.5/1.2))*Math.cbrt(1+Je(this.fluid)),c=4/3*Math.PI*s**3,l=Math.random()*Math.PI*2,u=(25+Math.random()*45)*(Math.PI/180),d=i*(.55+.9*Math.random())*(.0025/s)**.25,f=n*(.8+.6*Math.random());this.pos[r*3]=e+Math.cos(l)*f,this.pos[r*3+1]=.004,this.pos[r*3+2]=t+Math.sin(l)*f,this.vel[r*3]=Math.cos(l)*Math.cos(u)*d,this.vel[r*3+1]=Math.sin(u)*d,this.vel[r*3+2]=Math.sin(l)*Math.cos(u)*d,this.radius[r]=s,this.alive[r]=1,this.mode[r]=0,this.count++,a-=c,o+=c}return o}stepBead(e,t,n){let r=e*3;if(this.mode[e]===1){this.timer[e]-=t,this.timer[e]<=0&&(this.mode[e]=2);return}let[i,a]=this.towardWater(this.pos[r],this.pos[r+2]),o=.08;if(this.vel[r]=i*o,this.vel[r+2]=a*o,this.pos[r]+=this.vel[r]*t,this.pos[r+2]+=this.vel[r+2]*t,this.isWater(this.pos[r],this.pos[r+2])){let t=this.radius[e];n.push({x:this.pos[r],z:this.pos[r+2],radius:t,volume:4/3*Math.PI*t**3,speed:.08,onWater:!0}),this.alive[e]=0,this.mode[e]=0,this.count--}}step(e){let t=[];if(this.count===0)return t;let n=Math.max(1,Math.ceil(e/.004)),r=e/n;for(let i=0;i<600;i++){if(!this.alive[i])continue;let a=this.radius[i];if(this.mode[i]!==0){this.stepBead(i,e,t);continue}let o=3*ut*dt/(8*this.fluid.density*a);for(let e=0;e<n;e++){let e=i*3,n=this.vel[e],s=this.vel[e+1],c=this.vel[e+2],l=Math.hypot(n,s,c);if(this.vel[e]-=o*l*n*r,this.vel[e+1]-=(this.gravity+o*l*s)*r,this.vel[e+2]-=o*l*c*r,this.pos[e]+=this.vel[e]*r,this.pos[e+1]+=this.vel[e+1]*r,this.pos[e+2]+=this.vel[e+2]*r,this.pos[e+1]<=0&&this.vel[e+1]<0){let n=this.pos[e],r=this.pos[e+2];if(!this.fluid.wetsGround&&!this.isWater(n,r)){this.mode[i]=1,this.timer[i]=1.5+Math.random()*3,this.pos[e+1]=a*.75,this.vel.fill(0,e,e+3);break}t.push({x:n,z:r,radius:a,volume:4/3*Math.PI*a**3,speed:-this.vel[e+1],onWater:this.isWater(n,r)}),this.alive[i]=0,this.count--;break}}}return t}};function pt(e,t,n,r,i){let a=[],o=new x;for(let s=t.x+r/2;s<n.x;s+=r)for(let c=t.y+r/2;c<n.y;c+=r)for(let l=t.z+r/2;l<n.z;l+=r)o.set(s,c,l),e(o)&&a.push({p:o.clone().sub(i),dV:r*r*r,h:r});return a}function mt(e,t,n,r,i=1){return new x(e/5*(n*n+r*r),e/5*(t*t+r*r),e/5*(t*t+n*n)).multiplyScalar(i)}var D={body:{c:new x(0,.03,0),r:new x(.045,.03,.035)},head:{c:new x(.027,.07,0),r:.023},base:.007,com:new x(0,.028,0),mass:.025},ht={length:.12,keel:.07,width:.05,hull:.026,com:new x(0,.009,0),mass:.003},gt={hull:{c:new x(0,.026,0),r:new x(.08,.026,.032)},mast:.19,com:new x(0,.012,0),mass:.045},_t={r:.012,mass:.0036,com:new x(0,-.003,0)},vt={duck:.0032,paperBoat:.0035,sailboat:.011,bobber:3e-4};function yt(e){if(e===`bobber`){let{r:e,mass:t,com:n}=_t,r=pt(t=>t.length()<=e,new x(-e,-e,-e),new x(e,e,e),.004,n);return{mass:t,inertia:mt(t,e,e,e,1.5),samples:r,bottom:-e-n.y,radius:e}}if(e===`duck`){let{body:e,head:t,com:n,mass:r}=D,i=pt(n=>n.y<D.base?!1:n.clone().sub(e.c).divide(e.r).lengthSq()<=1||n.distanceTo(t.c)<=t.r,new x(-.05,D.base,-.04),new x(.055,.095,.04),.008,n);return{mass:r,inertia:mt(r,.045,.04,.035,1.5),samples:i,bottom:D.base-n.y,radius:.045}}if(e===`paperBoat`){let{length:e,keel:t,width:n,hull:r,com:i,mass:a}=ht,o=pt(i=>{if(i.y<0||i.y>r)return!1;let a=i.y/r,o=(t+(e-t)*a)/2,s=n/2*Math.min(1,.6+.6*a);return Math.abs(i.x)<=o&&Math.abs(i.z)<=s},new x(-.06,0,-.025),new x(.06,r,.025),.006,i);return{mass:a,inertia:new x(a/12*(n**2+r**2),a/12*(e**2+n**2),a/12*(e**2+r**2)).multiplyScalar(1.6),samples:o,bottom:-i.y,radius:.055}}let{hull:t,com:n,mass:r}=gt,i=pt(e=>e.y>t.c.y?!1:e.clone().sub(t.c).divide(t.r).lengthSq()<=1,new x(-.08,0,-.032),new x(.08,.026,.032),.01,n),a=mt(r,.08,.026,.032);return a.x+=.004*(gt.mast*gt.mast)/3,a.z+=.004*(gt.mast*gt.mast)/3,{mass:r,inertia:a,samples:i,bottom:-n.y,radius:.07}}function bt(e,t){let r=new _(1,14,10),i=new y({uniforms:{uSceneColor:t.uSceneColor,uResolution:t.uResolution,uSunDir:t.uSunDir,uSunColor:t.uSunColor,uSkyTop:{value:new g},uSkyHorizon:{value:new g},uTint:{value:new g(1,1,1)},uMetal:{value:0}},vertexShader:`
      varying vec3 vN;
      varying vec3 vWPos;
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,fragmentShader:`
      uniform sampler2D uSceneColor;
      uniform vec2 uResolution;
      uniform vec3 uSunDir, uSunColor, uSkyTop, uSkyHorizon, uTint;
      uniform float uMetal;
      varying vec3 vN;
      varying vec3 vWPos;
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vWPos);
        float cosV = clamp(dot(N, V), 0.0, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);       // Schlick, n = 1.33
        // a sphere acts like a strong lens: the background appears shifted
        vec3 Nv = (viewMatrix * vec4(N, 0.0)).xyz;
        vec2 uv = gl_FragCoord.xy / uResolution - Nv.xy * 0.035;
        vec3 refr = texture2D(uSceneColor, clamp(uv, 0.001, 0.999)).rgb * uTint;
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(R.y * 2.0, 0.0, 1.0));
        float spec = pow(max(dot(R, uSunDir), 0.0), 400.0) * 6.0;
        // mercury beads: a tiny curved mirror (≈ 78 % reflectance, no refraction)
        vec3 col = uMetal > 0.5 ? sky * 0.78 + uSunColor * spec * 0.78 : mix(refr, sky, F) + uSunColor * spec;
        gl_FragColor = vec4(col, 1.0);
      }`}),a=new re(r,i,600);a.frustumCulled=!1,a.count=0,a.instanceMatrix.setUsage(n);let o=new _e,s=new ve,c=new x,l=new x(0,1,0),u=new x,d=new x;function f(){let t=0;for(let n=0;n<600;n++){if(!e.alive[n])continue;let r=e.radius[n];c.set(e.vel[n*3],e.vel[n*3+1],e.vel[n*3+2]);let i=c.length(),f=1+i/180/r;i>1e-4?s.setFromUnitVectors(l,c.multiplyScalar(1/i)):s.identity(),u.set(e.pos[n*3],e.pos[n*3+1],e.pos[n*3+2]),e.mode[n]===0?d.set(r,r*Math.min(f,3),r):(s.identity(),d.set(r*1.1,r*.75,r*1.1)),o.compose(u,s,d),a.setMatrixAt(t++,o)}a.count=t,a.instanceMatrix.needsUpdate=!0}return{mesh:a,material:i,update:f}}var xt=[5.2,4.2],St=[1024,828],Ct=40,wt=class{target;scene=new s;camera=new we(-xt[0]/2,xt[0]/2,xt[1]/2,-xt[1]/2,0,1);splats;decayScene=new s;decayMat;pending=[];dummy=new xe;fadeAcc=0;live=0;constructor(){this.target=new r(St[0],St[1],{type:T,minFilter:Ie,magFilter:Ie,depthBuffer:!1,generateMipmaps:!1}),this.camera.position.set(0,.5,0),this.camera.up.set(0,0,-1),this.camera.lookAt(0,0,0),this.camera.updateMatrixWorld(),this.decayMat=new y({uniforms:{uFactor:{value:1}},vertexShader:`void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,fragmentShader:`uniform float uFactor; void main(){ gl_FragColor = vec4(uFactor); }`,blending:5,blendEquation:100,blendSrc:200,blendDst:202,depthTest:!1,depthWrite:!1});let e=new w(new S(2,2),this.decayMat);e.frustumCulled=!1,this.decayScene.add(e);let t=new y({vertexShader:`
        varying vec2 vUv;
        varying float vSeed;
        void main() {
          vUv = uv * 2.0 - 1.0;
          vSeed = instanceMatrix[3].x * 31.7 + instanceMatrix[3].z * 17.3;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        }`,fragmentShader:`
        varying vec2 vUv;
        varying float vSeed;
        void main() {
          // irregular blot: radius wobbles with angle
          float a = atan(vUv.y, vUv.x);
          float r = 0.75 + 0.12 * sin(a * 5.0 + vSeed) + 0.08 * sin(a * 9.0 + vSeed * 2.3);
          float d = length(vUv);
          if (d > r) discard;
          gl_FragColor = vec4(1.0 - smoothstep(r * 0.7, r, d) * 0.4);
        }`,blending:5,blendEquation:104,depthTest:!1,depthWrite:!1}),n=new S(2,2);n.rotateX(-Math.PI/2),this.splats=new re(n,t,256),this.splats.frustumCulled=!1,this.splats.count=0,this.scene.add(this.splats)}clear(e){e.setRenderTarget(this.target);let t=e.getClearColor(new g),n=e.getClearAlpha();e.setClearColor(0,0),e.clear(!0,!1,!1),e.setClearColor(t,n),e.setRenderTarget(null),this.pending.length=0}stamp(e,t,n){this.pending.push({x:e,z:t,r:n})}update(e,t){this.fadeAcc+=t;let n=this.live>0&&this.fadeAcc>=.25;if(!n&&!this.pending.length)return;let r=e.autoClear;if(e.autoClear=!1,e.setRenderTarget(this.target),n&&(this.decayMat.uniforms.uFactor.value=Math.exp(-this.fadeAcc/Ct),e.render(this.decayScene,this.camera),this.live-=this.fadeAcc,this.fadeAcc=0),this.pending.length){this.live=200;let t=this.pending.splice(0,256);t.forEach((e,t)=>{this.dummy.position.set(e.x,0,e.z),this.dummy.scale.setScalar(e.r),this.dummy.updateMatrix(),this.splats.setMatrixAt(t,this.dummy.matrix)}),this.splats.count=t.length,this.splats.instanceMatrix.needsUpdate=!0,e.render(this.scene,this.camera)}e.setRenderTarget(null),e.autoClear=r}},Tt=`puddle.settings.v1`,Et={strength:.35,fluid:`water`,mode:`slap`,best:{},hintsSeen:[],location:`forest`,season:`summer`,time:`day`,weather:`clear`,volume:.7,muted:!1};function Dt(){try{return{...Et,...JSON.parse(localStorage.getItem(Tt)??`{}`)}}catch{return{...Et}}}var O=Dt();function Ot(){try{localStorage.setItem(Tt,JSON.stringify(O))}catch{}}function kt(){let e=document.createElement(`button`);e.className=`ui-button`,e.setAttribute(`aria-label`,`Settings`),e.innerHTML=`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="16" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <circle cx="10" cy="17" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;let t=document.createElement(`div`);t.className=`ui-panel`,document.body.append(e,t);let n=!1,r=r=>{n=r,t.classList.toggle(`open`,r),e.classList.toggle(`active`,r)};e.addEventListener(`click`,()=>r(!n));let i={el:t,isOpen:()=>n,close:()=>r(!1),addChoice(e,n,r,i){let a=document.createElement(`div`);a.className=`ui-section`,a.innerHTML=`<div class="ui-label">${e}</div><div class="ui-chips"></div>`;let o=a.querySelector(`.ui-chips`),s=n.map(([e,t])=>{let n=document.createElement(`button`);return n.className=`ui-chip`,n.textContent=t,n.addEventListener(`click`,()=>{i(e),c(e)}),o.append(n),{value:e,b:n}}),c=e=>s.forEach(t=>t.b.classList.toggle(`on`,t.value===e));return c(r()),t.append(a),c},addSlider(e,n,r,i,a){let o=document.createElement(`div`);o.className=`ui-section`,o.innerHTML=`
        <div class="ui-row"><span class="ui-label">${e}</span><span class="ui-value"></span></div>
        <input type="range" min="0" max="1" step="0.01" />
        <div class="ui-scale"><span>${a[0]}</span><span>${a[1]}</span></div>`;let s=o.querySelector(`input`),c=o.querySelector(`.ui-value`);s.value=String(n()),c.textContent=i(n()),s.addEventListener(`input`,()=>{r(parseFloat(s.value)),c.textContent=i(n())}),t.append(o)},addButtons(e){let n=document.createElement(`div`);n.className=`ui-section ui-buttons`;let r=e.map(([e,t])=>{let r=document.createElement(`button`);return r.className=`ui-chip ui-action`,r.textContent=e,r.addEventListener(`click`,t),n.append(r),r});return t.append(n),r}};return i.addSlider(`Slap strength`,()=>O.strength,e=>{O.strength=e,Ot()},e=>`hand ${it(e).toFixed(1)} m/s`,[`gentle`,`hard`]),i}function At(){let e=document.documentElement,t=document,n=e.requestFullscreen?.bind(e)??e.webkitRequestFullscreen?.bind(e);if(!n)return;let r=document.exitFullscreen?.bind(document)??t.webkitExitFullscreen?.bind(document),i=()=>!!(document.fullscreenElement??t.webkitFullscreenElement),a=document.createElement(`button`);a.className=`ui-button ui-button-2`;let o=()=>{a.innerHTML=i()?`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`:`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,a.setAttribute(`aria-label`,i()?`Exit full screen`:`Full screen`)};a.addEventListener(`click`,()=>{i()?r?.():n({navigationUI:`hide`})?.catch?.(()=>{})}),document.addEventListener(`fullscreenchange`,o),document.addEventListener(`webkitfullscreenchange`,o),o(),document.body.append(a)}var jt={duck:`<svg viewBox="0 0 48 48" width="40" height="40"><ellipse cx="22" cy="31" rx="15" ry="9" fill="#ffcf2e"/><path d="M8 30c-2-6 2-9 4-9" fill="#ffcf2e"/><circle cx="30" cy="18" r="8" fill="#ffd43a"/><ellipse cx="39" cy="19.5" rx="5" ry="2.2" fill="#ff8a1f"/><circle cx="32" cy="16" r="1.4" fill="#1b1b1f"/></svg>`,paperBoat:`<svg viewBox="0 0 48 48" width="40" height="40"><path d="M6 27h36l-8 10H14z" fill="#f6f3ec"/><path d="M6 27h36l-8 10H14z" fill="none" stroke="#c9c3b5" stroke-width="1"/><path d="M15 27l9-14 9 14z" fill="#ebe6da" stroke="#c9c3b5" stroke-width="1"/></svg>`,sailboat:`<svg viewBox="0 0 48 48" width="40" height="40"><path d="M8 32h32c-2 5-6 7-16 7S10 37 8 32z" fill="#2f5577"/><rect x="23" y="7" width="1.6" height="25" fill="#a27b52"/><path d="M22.5 9v21H11z" fill="#f4efe2"/><path d="M25.5 12v18h9z" fill="#e9846a"/></svg>`},Mt={duck:`Rubber duck`,paperBoat:`Paper boat`,sailboat:`Sailboat`};function Nt(e){let t=document.createElement(`button`);t.className=`ui-button ui-drawer-button`,t.setAttribute(`aria-label`,`Toys`),t.innerHTML=jt.duck.replace(`width="40" height="40"`,`width="26" height="26"`);let n=document.createElement(`div`);n.className=`ui-tray`,Object.keys(jt).forEach(e=>{let t=document.createElement(`div`);t.className=`ui-toy`,t.title=Mt[e],t.setAttribute(`role`,`button`),t.setAttribute(`aria-label`,Mt[e]),t.innerHTML=jt[e],t.addEventListener(`pointerdown`,t=>o(t,e)),n.append(t)});let r=document.createElement(`button`);r.className=`ui-chip ui-tray-clear`,r.textContent=`Clear`,r.addEventListener(`click`,()=>e.onClear()),n.append(r),document.body.append(t,n);let i=!1,a=e=>{i=e,n.classList.toggle(`open`,e),t.classList.toggle(`active`,e)};t.addEventListener(`click`,()=>a(!i));function o(t,n){t.preventDefault();let r=t.pointerId,i=t.clientX,o=t.clientY,s=!1,c=t=>{t.pointerId===r&&(!s&&Math.hypot(t.clientX-i,t.clientY-o)>8&&(s=!0,a(!1),e.onDragStart(n,r,t.clientX,t.clientY)),s&&e.onDragMove(r,t.clientX,t.clientY))},l=t=>{t.pointerId===r&&(window.removeEventListener(`pointermove`,c),window.removeEventListener(`pointerup`,l),window.removeEventListener(`pointercancel`,l),s?e.onDragEnd(r,t.clientX,t.clientY):e.onTap(n))};window.addEventListener(`pointermove`,c),window.addEventListener(`pointerup`,l),window.addEventListener(`pointercancel`,l)}return{isOpen:()=>i,close:()=>a(!1),isOverButton(e,n){let r=t.getBoundingClientRect();return e>=r.left-12&&e<=r.right+12&&n>=r.top-12&&n<=r.bottom+12}}}function Pt(e,t){let n=document.createElement(`button`);n.className=`ui-button ui-button-3`;let r=()=>{n.innerHTML=e()?`<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`:`<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,n.setAttribute(`aria-label`,e()?`Unmute`:`Mute`)};return n.addEventListener(`click`,()=>{t(!e()),r()}),r(),document.body.append(n),r}var Ft=3.26,It=class{ctx=null;master;sfx;amb;noise;beds={};spec=null;timers=[];volume=.7;muted=!1;unlock(){if(this.ctx){this.ctx.state===`suspended`&&this.ctx.resume();return}let e=window.AudioContext??window.webkitAudioContext;if(!e)return;let t=new e;this.ctx=t;let n=t.createDynamicsCompressor();n.threshold.value=-14,n.ratio.value=4,this.master=t.createGain(),this.master.connect(n).connect(t.destination),this.sfx=t.createGain(),this.amb=t.createGain(),this.sfx.connect(this.master),this.amb.connect(this.master),this.amb.gain.value=.55,this.noise=t.createBuffer(1,t.sampleRate*2,t.sampleRate);let r=this.noise.getChannelData(0);for(let e=0;e<r.length;e++)r[e]=Math.random()*2-1;this.applyVolume(),this.spec&&this.setAmbience(this.spec)}setVolume(e){this.volume=e,this.applyVolume()}setMuted(e){this.muted=e,this.applyVolume()}applyVolume(){if(!this.ctx)return;let e=this.muted?0:this.volume*this.volume;this.master.gain.setTargetAtTime(e,this.ctx.currentTime,.05)}noiseSrc(e=!1){let t=this.ctx.createBufferSource();return t.buffer=this.noise,t.loop=e,t.loopStart=Math.random(),t}env(e,t,n,r,i){e.gain.setValueAtTime(1e-4,t),e.gain.exponentialRampToValueAtTime(Math.max(n,2e-4),t+r),e.gain.exponentialRampToValueAtTime(1e-4,t+r+i)}burst(e,t,n,r,i,a,o=0,s=this.sfx){let c=this.ctx,l=c.currentTime+o,u=this.noiseSrc(),d=c.createBiquadFilter();d.type=e,d.frequency.value=t,d.Q.value=n;let f=c.createGain();this.env(f,l,r,i,a),u.connect(d).connect(f).connect(s),u.start(l,Math.random()),u.stop(l+i+a+.05)}tone(e,t,n,r,i,a=0,o=`sine`,s=this.sfx){let c=this.ctx,l=c.currentTime+a,u=c.createOscillator();u.type=o,u.frequency.setValueAtTime(e,l),u.frequency.exponentialRampToValueAtTime(Math.max(t,1),l+r+i);let d=c.createGain();this.env(d,l,n,r,i),u.connect(d).connect(s),u.start(l),u.stop(l+r+i+.05)}bubble(e,t=.15,n=0,r=this.sfx){if(!this.ctx)return;let i=Ft/Math.max(e,2e-4);i>16e3||this.tone(i*.9,i*1.25,t,.002,.03+e*30,n,`sine`,r)}slap(e,t,n){if(!this.ctx)return;let r=.25+t*.75;if(e===`water`)this.tone(160,55,.5*r,.003,.18),this.burst(`bandpass`,1400,.7,.45*r,.003,.25),this.splashTail(n,.0015);else if(e===`honey`)this.tone(110,60,.6*r,.01,.45),this.burst(`lowpass`,500,1,.3*r,.01,.4),this.tone(220,360,.18*r,.02,.18,.28);else if(e===`mercury`){this.tone(120,70,.45*r,.003,.15);for(let[e,t]of[[2150,.12],[3370,.09],[5260,.06],[7110,.04]])this.tone(e,e*.99,t*r,.002,.9,0,`sine`);this.splashTail(n,.0012)}else this.tone(90,45,.7*r,.002,.12),this.burst(`lowpass`,300,1,.35*r,.002,.08)}splashTail(e,t){let n=Math.min(24,Math.round(e*.8));for(let e=0;e<n;e++)this.bubble(t*(.4+Math.random()*1.6),.05,.12+Math.random()*.6)}dropLanded(e,t){this.ctx&&(t?this.bubble(e*.4,.04):this.burst(`highpass`,3e3,.7,.015,.001,.02))}stir(e){!this.ctx||e<.05||this.burst(`bandpass`,700+e*900,.8,Math.min(.12,e*.08),.03,.12)}squeak(){if(!this.ctx)return;let e=this.ctx,t=e.currentTime,n=e.createOscillator();n.type=`sawtooth`,n.frequency.setValueAtTime(1400,t),n.frequency.linearRampToValueAtTime(2100,t+.08),n.frequency.linearRampToValueAtTime(1600,t+.28);let r=e.createBiquadFilter();r.type=`bandpass`,r.frequency.value=2200,r.Q.value=3;let i=e.createGain();this.env(i,t,.18,.02,.3),n.connect(r).connect(i).connect(this.sfx),n.start(t),n.stop(t+.4)}skip(e,t){if(this.ctx){if(t===`mercury`&&this.tone(3e3,2900,.08,.002,.4),t===`oobleck`)return this.tone(260,140,.25,.002,.06,0,`triangle`);this.burst(`bandpass`,2500,1.2,.12+e*.03,.002,.06),this.bubble(.0015+Math.random()*.001,.08,.01)}}plop(){this.ctx&&(this.tone(420,140,.25,.003,.22),this.bubble(.004,.12,.03))}crack(){if(this.ctx){for(let e=0;e<6;e++)this.burst(`highpass`,2500+Math.random()*3e3,1,.12,.001,.03+Math.random()*.05,Math.random()*.15);this.tone(180,90,.15,.002,.2)}}entry(e,t,n){if(!this.ctx)return;let r=Math.min(1,e*t*8);if(n===`oobleck`)return this.tone(120,60,.4*r+.1,.002,.1);this.tone(260,110,.3*r+.08,.003,.15),this.splashTail(r*10,.0018)}cast(){this.ctx&&this.burst(`bandpass`,1800,2,.06,.15,.35)}nibble(){this.ctx&&this.bubble(.003,.06)}setAmbience(e){if(this.spec=e,!this.ctx)return;let t=this.ctx;for(let n of Object.keys(e)){let r=e[n],i=this.beds[n];!i&&r>0&&(i=this.beds[n]=this.makeBed(n)),i?.gain.gain.setTargetAtTime(r,t.currentTime,1.2)}this.timers.forEach(e=>clearInterval(e)),this.timers=[];let n=(e,t)=>this.timers.push(window.setInterval(()=>document.hidden||t(),e));e.birds>0&&n(900,()=>Math.random()<.35*e.birds&&this.birdsong(e.birds)),e.crickets>0&&n(350,()=>Math.random()<.6&&this.cricket(e.crickets)),e.frogs>0&&n(1300,()=>Math.random()<.4&&this.frog(e.frogs)),e.fire>0&&n(120,()=>Math.random()<.35&&this.crackle(e.fire)),e.loons>0&&n(9e3,()=>Math.random()<.3&&this.loon(e.loons)),e.rain>0&&n(60,()=>this.bubble(4e-4+Math.random()*.0012,.025*e.rain,0,this.amb)),e.bubbles>0&&n(70,()=>this.bubble(.002+Math.random()*.004,.05*e.bubbles,0,this.amb))}makeBed(e){let t=this.ctx,n=t.createGain();n.gain.value=0,n.connect(this.amb);let r=this.noiseSrc(!0),i=t.createBiquadFilter(),a=t.createOscillator(),o=t.createGain(),s=t.createGain();s.gain.value=.6,a.connect(o).connect(s.gain),r.connect(i).connect(s).connect(n);let c=(e,t,n,r,s)=>{i.type=e,i.frequency.value=t,i.Q.value=n,a.frequency.value=r,o.gain.value=s};return e===`wind`?c(`lowpass`,420,.8,.09,.45):e===`waves`?c(`lowpass`,900,.6,.11,.55):e===`lapping`?c(`bandpass`,500,.8,.45,.4):e===`traffic`?c(`lowpass`,160,.7,.05,.3):e===`rain`?c(`highpass`,2200,.5,.2,.08):e===`fire`?c(`lowpass`,250,.7,.3,.3):e===`bubbles`?c(`lowpass`,700,.7,2.5,.3):c(`bandpass`,3e3,1,.1,0),r.start(),a.start(),{gain:n,stop:()=>(r.stop(),a.stop())}}birdsong(e){let t=2600+Math.random()*2200,n=2+Math.floor(Math.random()*5);for(let r=0;r<n;r++){let n=t*(.85+Math.random()*.4);this.tone(n,n*(Math.random()<.5?1.35:.75),.03*e,.01,.07,r*.11,`sine`,this.amb)}}cricket(e){for(let t=0;t<3;t++)this.tone(4600,4580,.012*e,.002,.018,t*.035,`sine`,this.amb)}frog(e){for(let t=0;t<2;t++)this.tone(260,220,.05*e,.01,.08,t*.15,`triangle`,this.amb)}crackle(e){this.burst(`highpass`,1800+Math.random()*2500,1,.05*e,.001,.02+Math.random()*.03,0,this.amb)}loon(e){let t=this.ctx,n=t.currentTime,r=t.createOscillator();r.frequency.setValueAtTime(620,n),r.frequency.linearRampToValueAtTime(1050,n+.6),r.frequency.setValueAtTime(1050,n+1.5),r.frequency.linearRampToValueAtTime(880,n+2.2);let i=t.createGain();i.gain.setValueAtTime(1e-4,n),i.gain.linearRampToValueAtTime(.05*e,n+.3),i.gain.setValueAtTime(.05*e,n+1.9),i.gain.linearRampToValueAtTime(1e-4,n+2.4),r.connect(i).connect(this.amb),r.start(n),r.stop(n+2.5)}};function Lt(e){try{navigator.vibrate?.(Math.round(e))}catch{}}function Rt(e,t){let n=e.time===`night`,r=e.time===`sunrise`||e.time===`sunset`,i=e.season===`summer`||e.season===`spring`,a=e.season===`winter`,o={wind:.12,waves:0,lapping:0,traffic:0,rain:0,birds:0,crickets:0,frogs:0,fire:0,bubbles:0,loons:0},s=e.location;return s===`beach`&&(o.waves=.55),s===`lionsgate`&&(o.waves=.3),(s===`dock`||s===`algonquin`)&&(o.lapping=.35),s===`highpark`&&(o.lapping=.1),s===`city`&&(o.traffic=n?.25:.45),s===`algonquin`&&(o.fire=n?.5:.25),s!==`algonquin`&&s!==`dock`||a||(o.loons=r||n?1:.4),s===`backyard`&&t&&(o.bubbles=.6),n||(o.birds=(s===`city`?.35:.9)*(a?.25:1)*(e.weather===`rain`?.3:1)),n&&e.season===`summer`&&s!==`city`&&(o.crickets=.8),(n||r)&&i&&(s===`dock`||s===`highpark`||s===`algonquin`)&&(o.frogs=.6),e.weather===`wind`&&(o.wind=.7),e.weather===`rain`&&(o.rain=.6,o.wind=.3),e.weather===`snow`&&(o.wind=.18,o.birds*=.3),o}var zt=`
// matplotlib "viridis", polynomial fit (Mattias Ehrnström / shadertoy WlfXRN)
vec3 viridis(float t) {
  const vec3 c0 = vec3(0.2777273272234177, 0.005407344544966578, 0.3340998053353061);
  const vec3 c1 = vec3(0.1050930431085774, 1.404613529898575, 1.384590162594685);
  const vec3 c2 = vec3(-0.3308618287255563, 0.214847559468213, 0.09509516302823659);
  const vec3 c3 = vec3(-4.634230498983486, -5.799100973351585, -19.33244095627987);
  const vec3 c4 = vec3(6.228269936347081, 14.17993336680509, 56.69055260068105);
  const vec3 c5 = vec3(4.776384997670288, -13.74514537774601, -65.35303263337234);
  const vec3 c6 = vec3(-5.435455855934631, 4.645852612178535, 26.3124352495832);
  t = clamp(t, 0.0, 1.0);
  return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6)))));
}
// blue – white – red, for signed quantities
vec3 diverging(float t) {
  t = clamp(t, -1.0, 1.0);
  vec3 lo = vec3(0.16, 0.38, 0.74), mid = vec3(0.96, 0.95, 0.93), hi = vec3(0.80, 0.22, 0.18);
  return t < 0.0 ? mix(mid, lo, -t) : mix(mid, hi, t);
}
`,Bt={diverging:`linear-gradient(90deg, rgb(41,97,189), rgb(245,242,237), rgb(204,56,46))`,viridis:`linear-gradient(90deg, #440154, #3b528b, #21918c, #5ec962, #fde725)`},Vt=`
varying vec2 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`,Ht=`
precision highp float;
precision highp sampler2D;
uniform sampler2D uState;   // R = η, G = u(i-½,j), B = v(i,j-½)
uniform sampler2D uShape;   // R = sdf, G = H (half float, filterable)
uniform vec2 uOrigin;       // world xz of the grid corner
uniform vec2 uSize;         // cells
uniform float uDx;
ivec2 cellOf(vec2 world) { return ivec2(floor((world - uOrigin) / uDx)); }
vec4 S(ivec2 c) { return texelFetch(uState, clamp(c, ivec2(0), ivec2(uSize) - 1), 0); }
vec2 shapeAt(vec2 world) { return texture(uShape, (world - uOrigin) / (uSize * uDx)).rg; }
// cell-centred velocity: the average of the two faces in each direction
vec2 velAt(ivec2 c) { vec4 s = S(c); return 0.5 * vec2(s.g + S(c + ivec2(1, 0)).g, s.b + S(c + ivec2(0, 1)).b); }
`,Ut=`
${Ht}
${zt}
${De}
uniform int uMode;        // 1 height, 2 speed, 3 viscosity / strain rate
uniform float uScale;     // height: η at full colour [m]; speed: |u| at full colour [m/s]
uniform float uG;
varying vec2 vWorld;

float strainRate(ivec2 c) {
  float ux = (S(c + ivec2(1, 0)).g - S(c).g) / uDx;
  float vz = (S(c + ivec2(0, 1)).b - S(c).b) / uDx;
  float uz = (S(c + ivec2(0, 1)).g - S(c - ivec2(0, 1)).g) / (2.0 * uDx);
  float vx = (S(c + ivec2(1, 0)).b - S(c - ivec2(1, 0)).b) / (2.0 * uDx);
  return sqrt(2.0 * ux * ux + 2.0 * vz * vz + (uz + vx) * (uz + vx));
}

void main() {
  vec2 shp = shapeAt(vWorld);
  if (shp.r > 0.0) discard;
  ivec2 c = cellOf(vWorld);
  vec4 s = S(c);
  vec3 col;
  float a = 0.82;
  if (uMode == 1) {
    col = diverging(s.r / uScale);
  } else if (uMode == 2) {
    col = viridis(length(velAt(c)) / uScale);
    a = 0.7;
  } else {
    // the same strain rate the solver uses: bed shear 3|ū|/h with the
    // in-plane strain added in quadrature
    float h = max(shp.g + s.r, 0.0005);
    float gb = 3.0 * length(velAt(c)) / h, st = strainRate(c);
    float gd = sqrt(gb * gb + st * st);
    if (uShearThick > 0.5) {
      float nu = viscosityAt(gd);
      col = viridis(log(nu / uRheo.x) / log(uRheo.w / uRheo.x));
    } else {
      // γ̇ from 0.1 to 1000 1/s, log scale
      col = viridis((log(max(gd, 1e-3)) / log(10.0) + 1.0) / 4.0);
    }
  }
  // soft shoreline
  a *= smoothstep(0.0, -0.01, shp.r);
  gl_FragColor = vec4(col, a);
}
`,Wt=`
${Ht}
attribute vec2 aCell;     // world xz of this arrow's base
uniform float uArrowScale; // metres of arrow per m/s
uniform float uMaxLen;
varying float vA;
void main() {
  ivec2 c = cellOf(aCell);
  vec2 v = velAt(c);
  float sp = length(v);
  float len = min(sp * uArrowScale, uMaxLen);
  vec2 shp = shapeAt(aCell);
  vA = (shp.r < -2.0 * uDx && len > 0.002) ? 1.0 : 0.0;
  vec2 d = sp > 1e-6 ? v / sp : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);
  // position.x runs 0…1 along the arrow, position.z across (fixed width)
  vec2 p = aCell + d * position.x * len + n * position.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(p.x, 0.0, p.y, 1.0);
}
`,Gt=`
varying float vA;
void main() {
  if (vA < 0.5) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, 0.95);
}
`;function Kt(e){let t=e*.06,n=e*.2,r=[0,0,-t,.68,0,-t,.68,0,t,0,0,-t,.68,0,t,0,0,t,.62,0,-n,1,0,0,.62,0,n],i=new me;return i.setAttribute(`position`,new le(r,3)),i}var qt=class{solver;mode=`off`;heightScale=.002;speedScale=.15;scene=new s;field;arrows;forces=new p;pool=[];constructor(e){this.solver=e;let[t,n]=e.origin,[r,i]=e.extent,{nx:a,nz:o,dx:s}=e.grid,c={uState:{value:e.stateTexture},uShape:{value:e.shapeTexture},uOrigin:{value:new h(t,n)},uSize:{value:new h(a,o)},uDx:{value:s}},l={uShearThick:{value:0},uRheo:{value:new Qe(1,1,1,1)},uTauY:{value:0}},u=new S(r,i);u.rotateX(-Math.PI/2),u.translate(t+r/2,0,n+i/2),this.field=new w(u,new y({vertexShader:Vt,fragmentShader:Ut,uniforms:{...c,...l,uMode:{value:1},uScale:{value:.002},uG:{value:9.81}},transparent:!0,depthTest:!1,depthWrite:!1,toneMapped:!1})),this.field.frustumCulled=!1;let d=.045,f=[];for(let e=n+d/2;e<n+i;e+=d)for(let n=t+d/2;n<t+r;n+=d)f.push(n,e);let p=Kt(d);p.setAttribute(`aCell`,new fe(new Float32Array(f),2)),p.instanceCount=f.length/2,this.arrows=new w(p,new y({vertexShader:Wt,fragmentShader:Gt,side:2,uniforms:{...c,uArrowScale:{value:.8},uMaxLen:{value:d*1.4}},transparent:!0,depthTest:!1,depthWrite:!1,toneMapped:!1})),this.arrows.frustumCulled=!1,this.scene.add(this.field,this.arrows,this.forces)}setFluid(e,t){let n=ge(e),r=this.field.material.uniforms;r.uShearThick.value=n.enabled,r.uRheo.value.set(n.nu0,n.gammaC,n.n,n.nuMax),r.uTauY.value=n.tauY,r.uG.value=t}updateForces(e,t){let n=e=>{let t=new se(new x(0,1,0),new x,.1,e,.025,.014);for(let e of[t.line.material,t.cone.material])e.depthTest=!1,e.toneMapped=!1,e.transparent=!0;return t.renderOrder=10,this.forces.add(t),t};for(;this.pool.length<e.length;)this.pool.push({w:n(12106946),b:n(4891616),d:n(15764043)});let r=e=>.35*Math.sqrt(e),i=new x;this.pool.forEach((n,a)=>{let o=e[a],s=!!o;if(n.w.visible=n.b.visible=n.d.visible=s,!o)return;let c=o.pos,l=(e,t)=>{let n=t.length();if(e.visible=n>1e-5,!e.visible)return;let a=r(n);e.position.copy(c),e.setDirection(i.copy(t).divideScalar(n)),e.setLength(a,Math.min(.025,a*.4),Math.min(.014,a*.25))};l(n.w,new x(0,-o.def.mass*t,0)),l(n.b,new x(0,o.buoyancy,0)),l(n.d,o.drag)})}render(e,t,n,r){if(this.mode===`off`)return;let i=this.field.material.uniforms;i.uState.value=this.solver.stateTexture,this.arrows.material.uniforms.uState.value=this.solver.stateTexture,this.field.visible=this.mode!==`forces`,this.arrows.visible=this.mode===`velocity`,this.forces.visible=this.mode===`forces`,i.uMode.value=this.mode===`height`?1:this.mode===`velocity`?2:3,i.uScale.value=this.mode===`height`?this.heightScale:this.speedScale,this.mode===`forces`&&this.updateForces(n,r);let a=e.autoClear,o=e.toneMapping;e.autoClear=!1,e.toneMapping=0,e.setRenderTarget(null),e.render(this.scene,t),e.autoClear=a,e.toneMapping=o}},k=(e,t=3)=>{if(e===0)return`0`;let n=Math.abs(e);return n>=1e4||n<.001?e.toExponential(t-1):String(+e.toPrecision(t))},Jt=class{solver;overlay;hooks;el;open=!1;fluid;g=He;readouts={};sliders=[];legend;chips=[];lastHeavy=0;lastLight=0;baseVolume=0;constructor(e,t,n,r){this.solver=e,this.overlay=t,this.hooks=n,this.fluid=n.base();let i=this.el=document.createElement(`div`);i.className=`eng`,i.innerHTML=`
      <div class="eng-head"><b>Engineering</b><span class="eng-commit">build ${r}</span><button class="eng-close" aria-label="Close">×</button></div>
      <div class="eng-grid" data-r></div>
      <div class="eng-sub">Overlay</div>
      <div class="eng-chips" data-o></div>
      <div class="eng-legend" data-l></div>
      <div class="eng-sub">Parameters <span class="eng-note">live, no reset</span></div>
      <div data-p></div>
      <div class="eng-sub">Grid</div>
      <div class="eng-chips" data-g></div>
      <div class="eng-links"><button class="eng-btn" data-reset>Back to measured values</button></div>
      <div class="eng-links"><a href="./physics.html" target="_blank" rel="noopener">Physics write-up ↗</a><a href="./validate.html" target="_blank" rel="noopener">Validation ↗</a></div>`,document.body.append(i),i.querySelector(`.eng-close`).addEventListener(`click`,()=>this.toggle(!1)),i.addEventListener(`pointerdown`,e=>e.stopPropagation());let a=i.querySelector(`[data-r]`);for(let[e,t]of[[`fps`,`Frame rate`],[`cpu`,`CPU per frame`],[`grid`,`Grid`],[`steps`,`Substeps`],[`limits`,`dt limits`],[`c`,`Wave speed √(gH)`],[`eta`,`Max |η|`],[`u`,`Max |u|`],[`fr`,`Max Froude`],[`vol`,`Volume change`],[`slap`,`Last slap`],[`mu`,`Viscosity`],[`toys`,`Toys F_b / mg`]]){let n=document.createElement(`span`);n.textContent=t;let r=document.createElement(`span`);r.className=`eng-v`,a.append(n,r),this.readouts[e]=r}let o=i.querySelector(`[data-o]`);for(let[e,t]of[[`off`,`Off`],[`height`,`Height`],[`velocity`,`Velocity`],[`viscosity`,`Strain / μ`],[`forces`,`Forces`]]){let n=document.createElement(`button`);n.className=`ui-chip`,n.textContent=t,n.addEventListener(`click`,()=>this.setOverlay(e)),n.dataset.m=e,o.append(n),this.chips.push(n)}this.legend=i.querySelector(`[data-l]`);let s=[{label:`Density ρ`,unit:`kg/m³`,min:100,max:2e4,log:!0,get:()=>this.fluid.density,set:e=>this.patch({density:e}),fmt:e=>k(e,4)},{label:`Viscosity μ`,unit:`Pa·s`,min:1e-5,max:100,log:!0,get:()=>this.fluid.viscosity,set:e=>this.patch({viscosity:e}),fmt:e=>k(e),only:`newtonian`},{label:`Surface tension σ`,unit:`N/m`,min:0,max:.6,log:!1,get:()=>this.fluid.surfaceTension,set:e=>this.patch({surfaceTension:e}),fmt:e=>k(e)},{label:`Gravity g`,unit:`m/s²`,min:.5,max:30,log:!0,get:()=>this.g,set:e=>this.setGravity(e),fmt:e=>`${k(e)}${Yt(e)}`},{label:`Extra damping`,unit:`1/s`,min:0,max:5,log:!1,get:()=>this.solver.extraDamping,set:e=>this.solver.extraDamping=e,fmt:e=>k(e,2)},{label:`Smagorinsky C_s`,unit:``,min:0,max:.4,log:!1,get:()=>this.solver.smagorinsky,set:e=>this.solver.smagorinsky=e,fmt:e=>e.toFixed(2)},{label:`μ₀ (liquid)`,unit:`Pa·s`,min:.05,max:50,log:!0,get:()=>this.rheo(`mu0`),set:e=>this.patchRheo({mu0:e}),fmt:e=>k(e),only:`oobleck`},{label:`γ̇_c (onset)`,unit:`1/s`,min:.2,max:100,log:!0,get:()=>this.rheo(`gammaC`),set:e=>this.patchRheo({gammaC:e}),fmt:e=>k(e),only:`oobleck`},{label:`n (steepness)`,unit:``,min:1,max:6,log:!1,get:()=>this.rheo(`n`),set:e=>this.patchRheo({n:e}),fmt:e=>e.toFixed(2),only:`oobleck`},{label:`μ_max (jammed)`,unit:`Pa·s`,min:10,max:1e5,log:!0,get:()=>this.rheo(`muMax`),set:e=>this.patchRheo({muMax:e}),fmt:e=>k(e),only:`oobleck`},{label:`τ_y (yield)`,unit:`Pa`,min:0,max:20,log:!1,get:()=>this.rheo(`yieldStress`),set:e=>this.patchRheo({yieldStress:e}),fmt:e=>k(e,2),only:`oobleck`}],c=i.querySelector(`[data-p]`);for(let e of s){let t=document.createElement(`div`);t.className=`eng-param`,t.innerHTML=`<div class="eng-prow"><span>${e.label}</span><span class="eng-v"></span></div><input type="range" min="0" max="1000" step="1">`;let n=t.querySelector(`input`),r=t.querySelector(`.eng-v`);n.addEventListener(`input`,()=>{let t=n.value/1e3;e.set(e.log?e.min*(e.max/e.min)**t:e.min+(e.max-e.min)*t),r.textContent=`${e.fmt(e.get())} ${e.unit}`}),c.append(t),this.sliders.push({p:e,input:n,value:r,row:t})}let l=i.querySelector(`[data-g]`);for(let t of[128,256,384,512,768]){let n=document.createElement(`button`);n.className=`ui-chip`,n.textContent=String(t),n.classList.toggle(`on`,t===e.grid.nx),n.addEventListener(`click`,()=>{let e=new URLSearchParams(location.search);e.set(`grid`,String(t)),e.set(`eng`,`1`),location.search=e.toString()}),l.append(n)}i.querySelector(`[data-reset]`).addEventListener(`click`,()=>this.resetParams()),this.setOverlay(`off`),this.syncSliders()}get isOpen(){return this.open}toggle(e=!this.open){this.open=e,this.el.classList.toggle(`open`,e),e?(this.syncSliders(),this.baseVolume=this.volume()):this.setOverlay(`off`)}fluidChanged(){this.fluid=this.hooks.base(),this.overlay.setFluid(this.fluid,this.g),this.syncSliders(),this.baseVolume=0}get current(){return this.fluid}rheo(e){let t=this.fluid.rheology;return t.kind===`shearThickening`?t[e]:0}patch(e){this.fluid={...this.fluid,...e},this.apply()}patchRheo(e){let t=this.fluid.rheology;t.kind===`shearThickening`&&(this.fluid={...this.fluid,rheology:{...t,...e},viscosity:e.mu0??this.fluid.viscosity},this.apply())}apply(){this.hooks.setFluid(this.fluid),this.overlay.setFluid(this.fluid,this.g)}setGravity(e){this.g=e,this.hooks.setGravity(e),this.overlay.setFluid(this.fluid,e)}resetParams(){this.fluid=this.hooks.base(),this.apply(),this.setGravity(He),this.solver.extraDamping=0,this.solver.smagorinsky=.17,this.syncSliders()}syncSliders(){let e=this.fluid.rheology.kind===`shearThickening`?`oobleck`:`newtonian`;for(let t of this.sliders){let{p:n}=t;t.row.style.display=n.only&&n.only!==e?`none`:``;let r=n.get(),i=n.log?Math.log(Math.max(r,n.min)/n.min)/Math.log(n.max/n.min):(r-n.min)/(n.max-n.min);t.input.value=String(Math.round(Math.min(Math.max(i,0),1)*1e3)),t.value.textContent=`${n.fmt(r)} ${n.unit}`}}setOverlay(e){this.overlay.mode=e,this.chips.forEach(t=>t.classList.toggle(`on`,t.dataset.m===e));let t=this.fluid,n=(e,t,n,r)=>`<div class="eng-bar" style="background:${e}"></div><div class="eng-scale"><span>${t}</span><span>${r}</span><span>${n}</span></div>`,r=t.rheology;this.legend.innerHTML=e===`height`?n(Bt.diverging,`−${this.overlay.heightScale*1e3} mm`,`+${this.overlay.heightScale*1e3} mm`,`surface height η`):e===`velocity`?n(Bt.viridis,`0`,`${this.overlay.speedScale} m/s`,`depth-averaged speed`):e===`viscosity`?r.kind===`shearThickening`?n(Bt.viridis,`${k(r.mu0)} Pa·s`,`${k(r.muMax)} Pa·s`,`viscosity μ(γ̇), log`):n(Bt.viridis,`0.1 /s`,`1000 /s`,`strain rate γ̇, log`):e===`forces`?`<div class="eng-keys"><span><i style="background:#b8bcc2"></i>weight</span><span><i style="background:#4aa3e0"></i>buoyancy</span><span><i style="background:#f08a4b"></i>drag</span></div><div class="eng-scale"><span>arrow length ∝ √|F|</span></div>`:``}volume(){let e=this.solver.readState(),t=this.solver.grid.dx**2,n=0;for(let r=0;r<e.length;r+=4)n+=e[r]*t;return n}update(e){if(!this.open||e-this.lastLight<250)return;this.lastLight=e;let t=this.readouts,n=this.solver,r=n.lastPlan,i=this.fluid,{nx:a,nz:o,dx:s}=n.grid;t.fps.textContent=`${this.hooks.stats.fps}`,t.cpu.textContent=`${this.hooks.stats.cpuMs.toFixed(1)} ms`,t.grid.textContent=`${a} × ${o}, Δx ${(s*1e3).toFixed(2)} mm`,r&&(t.steps.textContent=`${r.substeps} × ${(r.dt*1e3).toFixed(2)} ms${r.slowMotion?` (slowed)`:``}`,t.limits.textContent=`wave ${(r.limits.wave*1e3).toFixed(2)} · adv ${(r.limits.advection*1e3).toFixed(1)} ms`);let c=0,l=n.shape.data;for(let e=0;e<a*o;e++)c=Math.max(c,l[e*4]);t.c.textContent=`${Math.sqrt(this.g*c).toFixed(3)} m/s at ${(c*1e3).toFixed(1)} mm`;let u=this.hooks.lastSlap();t.slap.textContent=u.froude?`Fr ${u.froude}, spray ${u.sprayMl} mL`:`–`;let d=i.rheology;t.mu.textContent=d.kind===`shearThickening`?`${k(Le(i,.5))} → ${k(Le(i,50))} Pa·s (γ̇ 0.5 → 50 /s)`:`${k(i.viscosity)} Pa·s, ν ${k(i.viscosity/i.density)} m²/s`;let f=this.hooks.bodies();if(t.toys.textContent=f.length?f.map(e=>`${e.kind} ${(e.body.buoyancy/(e.body.def.mass*this.g)).toFixed(2)}`).join(`, `):`–`,e-this.lastHeavy<1e3)return;this.lastHeavy=e;let p=n.readState(),m=0,h=0,g=0,_=0;for(let e=0;e<a*o;e++){if(l[e*4+2]<.5)continue;let t=p[e*4],n=p[e*4+1],r=p[e*4+2];m=Math.max(m,Math.abs(t));let i=Math.hypot(n,r);h=Math.max(h,i);let a=l[e*4]+t;a>.002&&(g=Math.max(g,i/Math.sqrt(this.g*a))),_+=t*s*s}this.baseVolume||=_,t.eta.textContent=`${(m*1e3).toFixed(2)} mm`,t.u.textContent=`${h.toFixed(3)} m/s`,t.fr.textContent=g.toFixed(2),t.vol.textContent=`${((_-this.baseVolume)*1e6).toFixed(3)} mL`}};function Yt(e){let t=t=>Math.abs(e/t-1)<.03;return t(9.81)?` (Earth)`:t(1.62)?` (Moon)`:t(3.71)?` (Mars)`:t(24.8)?` (Jupiter)`:``}var Xt=`puddle.quality`,Zt=[1,.8,.65,.5],Qt=4,$t=2.5,en=1/42,tn=class{onChange;gridCells;level;warm=0;frames=0;time=0;slowAtBottom=0;steady=0;enabled=!navigator.webdriver;constructor(e,t){this.onChange=e,this.gridCells=t;let n=0;try{n=parseInt(localStorage.getItem(Xt)??`0`,10)||0}catch{}this.level=Math.min(Math.max(n-1,0),Zt.length-1)}get scale(){return Zt[this.level]}sample(e){if(!this.enabled||e>.25||(this.warm+=e,this.warm<Qt)||(this.frames++,this.time+=e,this.time<$t))return;let t=this.time/this.frames;this.frames=0,this.time=0,t<=en?++this.steady===8&&this.save(Xt,String(this.level)):(this.steady=0,this.level<Zt.length-1?(this.level++,this.warm=2.5,this.save(Xt,String(this.level)),this.onChange()):this.gridCells>256&&++this.slowAtBottom>=3&&this.save(Ce,`256`))}save(e,t){try{localStorage.setItem(e,t)}catch{}}},nn=1,rn=class{def;pos=new x;vel=new x;quat=new ve;omega=new x;world;frac;submerged=0;buoyancy=0;drag=new x;airborne=!0;held=!1;volume;Re;constructor(e){this.def=e,this.world=e.samples.map(()=>new x),this.frac=new Float32Array(e.samples.length),this.volume=e.samples.reduce((e,t)=>e+t.dV,0),this.Re=Math.cbrt(3*this.volume/(4*Math.PI))}updateWorld(){this.def.samples.forEach((e,t)=>this.world[t].copy(e.p).applyQuaternion(this.quat).add(this.pos))}surfaceAt(e,t,n){return e.eta0+e.slopeX*(t-this.pos.x)+e.slopeZ*(n-this.pos.z)}step(e,t,n,r,i,a){let o=this.def,s=Math.sqrt(t.density*n*Math.PI*o.radius*o.radius*.5/o.mass),c=Math.min(64,Math.max(1,Math.ceil(e*s/.4))),l=e/c,u=new x,d=new x,f=new x,p=new x,m=new x,h=new x,g=new Oe().set(1/o.inertia.x,0,0,0,1/o.inertia.y,0,0,0,1/o.inertia.z),_=new Oe,ee=new _e;for(let e=0;e<c;e++){this.updateWorld(),u.set(0,-o.mass*n,0),d.set(0,0,0),p.set(0,0,0);let e=0,s=0,c=0;for(let i=0;i<o.samples.length;i++){let a=o.samples[i],l=this.world[i],m=this.surfaceAt(r,l.x,l.z),g=E.clamp((m-l.y)/a.h+.5,0,1);this.frac[i]=g,!(g<=0)&&(e+=g*a.dV,f.subVectors(l,this.pos),h.set(0,t.density*n*g*a.dV,0),u.add(h),d.add(f.clone().cross(h)),p.addScaledVector(l,g*a.dV),g<1&&(s+=a.h*a.h,c+=a.h*a.h*(f.x*f.x+f.z*f.z)))}this.submerged=e,this.buoyancy=t.density*n*e,e>0&&(this.airborne=!1),a&&u.add(a);let te=0,v=0,y=0;if(this.drag.set(0,0,0),e>0){p.divideScalar(e);let i=e/this.volume;f.subVectors(p,this.pos),m.copy(this.omega).cross(f).add(this.vel),m.x-=r.u,m.z-=r.v;let a=m.length(),l=Le(t,a/this.Re),g=6*Math.PI*l*this.Re*Math.cbrt(i),_=.5*t.density*nn*Math.PI*this.Re*this.Re*i**(2/3)*a;te=g+_,h.set(r.u,0,r.v).multiplyScalar(te),u.add(h),d.add(f.clone().cross(h)),this.drag.copy(m).multiplyScalar(-te),y=8*Math.PI*l*this.Re**3*i+_*this.Re*this.Re*.2;let ee=Math.sqrt(t.density*n*Math.max(s,1e-6)/o.mass),b=Math.max(r.depth,.003);v=t.density*ee*s*s/(4*b),y+=t.density*ee*s*c/(4*b)}this.vel.addScaledVector(u,l/o.mass);let b=1/(1+te*l/o.mass);this.vel.x*=b,this.vel.z*=b,this.vel.y*=1/(1+(te+v)*l/o.mass),_.setFromMatrix4(ee.makeRotationFromQuaternion(this.quat));let ne=_.clone().multiply(g).multiply(_.clone().transpose());this.omega.add(d.applyMatrix3(ne).multiplyScalar(l));let re=Math.min(o.inertia.x,o.inertia.y,o.inertia.z);this.omega.multiplyScalar(1/(1+y*l/re)),this.pos.addScaledVector(this.vel,l);let ie=new ve(this.omega.x*l*.5,this.omega.y*l*.5,this.omega.z*l*.5,0).multiply(this.quat);this.quat.set(this.quat.x+ie.x,this.quat.y+ie.y,this.quat.z+ie.z,this.quat.w+ie.w).normalize(),this.resolveContact(i,l)}this.updateWorld()}resolveContact(e,t){let n=0,r=this.def;this.updateWorld();for(let t=0;t<r.samples.length;t++){let i=this.world[t];n=Math.max(n,e(i.x,i.z)-(i.y-r.samples[t].h*.5))}if(n<=0)return;this.pos.y+=n,this.vel.y<0&&(this.vel.y*=-.15);let i=Math.exp(-t*6);this.vel.x*=i,this.vel.z*=i,this.omega.multiplyScalar(Math.exp(-t*8));let a=new x(0,1,0).applyQuaternion(this.quat);this.omega.addScaledVector(a.clone().cross(new x(0,1,0)),t*25)}},an=32,on=32,sn=1024,cn=class{renderer;posTex;posData=new Float32Array(4096);target;quad;busy=!1;readBuf=new Float32Array(4096);result=new Float32Array(4096);resultTag=null;constructor(e,t,n,i,a){this.renderer=e,this.posTex=new u(this.posData,an,on,Ye,de),this.target=new r(an,on,{type:de,depthBuffer:!1,minFilter:We,magFilter:We});let o=new y({uniforms:{uState:{value:null},uPos:{value:this.posTex},uSize:{value:new h(...n)},uOrigin:{value:new h(...i)},uDx:{value:a}},vertexShader:`void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,fragmentShader:`
        precision highp float;
        precision highp sampler2D;
        uniform sampler2D uState, uPos;
        uniform ivec2 uSize;
        uniform vec2 uOrigin;
        uniform float uDx;
        vec4 S(ivec2 c) { return texelFetch(uState, clamp(c, ivec2(0), uSize - 1), 0); }
        // bilinear sample of η (cell centres) and cell-centred velocity
        vec3 fluidAt(vec2 g) {
          vec2 f = g - 0.5;
          ivec2 i = ivec2(floor(f));
          vec2 t = f - vec2(i);
          vec3 acc = vec3(0.0);
          for (int dy = 0; dy <= 1; dy++)
          for (int dx = 0; dx <= 1; dx++) {
            ivec2 c = i + ivec2(dx, dy);
            vec4 s = S(c);
            vec2 vel = 0.5 * vec2(s.g + S(c + ivec2(1, 0)).g, s.b + S(c + ivec2(0, 1)).b);
            float w = (dx == 1 ? t.x : 1.0 - t.x) * (dy == 1 ? t.y : 1.0 - t.y);
            acc += w * vec3(s.r, vel);
          }
          return acc;
        }
        void main() {
          vec4 p = texelFetch(uPos, ivec2(gl_FragCoord.xy), 0);
          vec2 g = (p.xy - uOrigin) / uDx;   // grid coordinates
          gl_FragColor = vec4(fluidAt(g), 0.0);
        }`,depthTest:!1,depthWrite:!1});this.quad=new Be(o),this.stateTex=t}stateTex;request(e,t,n){if(this.busy)return;let r=Math.min(t,sn);for(let t=0;t<r;t++)this.posData[t*4]=e[t*2],this.posData[t*4+1]=e[t*2+1];this.posTex.needsUpdate=!0;let i=this.quad.material;i.uniforms.uState.value=this.stateTex(),this.renderer.setRenderTarget(this.target),this.quad.render(this.renderer),this.renderer.setRenderTarget(null),this.busy=!0;let a=Math.max(1,Math.ceil(r/an));this.renderer.readRenderTargetPixelsAsync(this.target,0,0,an,a,this.readBuf).then(()=>{this.result.set(this.readBuf.subarray(0,a*an*4)),this.resultTag=n}).catch(()=>{}).finally(()=>this.busy=!1)}};function ln(e,t=!1){let n=e[0].index!==null,r=new Set(Object.keys(e[0].attributes)),i=new Set(Object.keys(e[0].morphAttributes)),a={},o={},s=e[0].morphTargetsRelative,c=new v,l=0;for(let u=0;u<e.length;++u){let d=e[u],f=0;if(n!==(d.index!==null))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.`),null;for(let e in d.attributes){if(!r.has(e))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. All geometries must have compatible attributes; make sure "`+e+`" attribute exists among all geometries, or in none of them.`),null;a[e]===void 0&&(a[e]=[]),a[e].push(d.attributes[e]),f++}if(f!==r.size)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. Make sure all geometries have the same number of attributes.`),null;if(s!==d.morphTargetsRelative)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. .morphTargetsRelative must be consistent throughout all geometries.`),null;for(let e in d.morphAttributes){if(!i.has(e))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`.  .morphAttributes must be consistent throughout all geometries.`),null;o[e]===void 0&&(o[e]=[]),o[e].push(d.morphAttributes[e])}if(t){let e;if(n)e=d.index.count;else if(d.attributes.position!==void 0)e=d.attributes.position.count;else return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. The geometry must have either an index or a position attribute`),null;c.addGroup(l,e,u),l+=e}}if(n){let t=0,n=[];for(let r=0;r<e.length;++r){let i=e[r].index;for(let e=0;e<i.count;++e)n.push(i.getX(e)+t);t+=e[r].attributes.position.count}c.setIndex(n)}for(let e in a){let t=un(a[e]);if(!t)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the `+e+` attribute.`),null;c.setAttribute(e,t)}for(let e in o){let t=o[e][0].length;if(t!==0){c.morphAttributes=c.morphAttributes||{},c.morphAttributes[e]=[];for(let n=0;n<t;++n){let t=[];for(let r=0;r<o[e].length;++r)t.push(o[e][r][n]);let r=un(t);if(!r)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the `+e+` morphAttribute.`),null;c.morphAttributes[e].push(r)}}}return c}function un(e){let t,n,r,i=-1,a=0;for(let o=0;o<e.length;++o){let s=e[o];if(t===void 0&&(t=s.array.constructor),t!==s.array.constructor)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.`),null;if(n===void 0&&(n=s.itemSize),n!==s.itemSize)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.`),null;if(r===void 0&&(r=s.normalized),r!==s.normalized)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes.`),null;if(i===-1&&(i=s.gpuType),i!==s.gpuType)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes.`),null;a+=s.count*n}let s=new t(a),c=new o(s,n,r),l=0;for(let t=0;t<e.length;++t){let r=e[t];if(r.isInterleavedBufferAttribute){let e=l/n;for(let t=0,i=r.count;t<i;t++)for(let i=0;i<n;i++){let n=r.getComponent(t,i);c.setComponent(t+e,i,n)}}else s.set(r.array,l);l+=r.count*n}return i!==void 0&&(c.gpuType=i),c}function dn(e,t=1e-4){t=Math.max(t,2**-52);let n={},r=e.getIndex(),i=e.getAttribute(`position`),a=r?r.count:i.count,o=0,s=Object.keys(e.attributes),c={},l={},u=[],d=[`getX`,`getY`,`getZ`,`getW`],f=[`setX`,`setY`,`setZ`,`setW`];for(let t=0,n=s.length;t<n;t++){let n=s[t],r=e.attributes[n];c[n]=new r.constructor(new r.array.constructor(r.count*r.itemSize),r.itemSize,r.normalized);let i=e.morphAttributes[n];i&&(l[n]||(l[n]=[]),i.forEach((e,t)=>{let r=new e.array.constructor(e.count*e.itemSize);l[n][t]=new e.constructor(r,e.itemSize,e.normalized)}))}let p=t*.5,m=10**Math.log10(1/t),h=p*m;for(let t=0;t<a;t++){let i=r?r.getX(t):t,a=``;for(let t=0,n=s.length;t<n;t++){let n=s[t],r=e.getAttribute(n),o=r.itemSize;for(let e=0;e<o;e++)a+=`${Math.trunc(r[d[e]](i)*m+h)},`}if(a in n)u.push(n[a]);else{for(let t=0,n=s.length;t<n;t++){let n=s[t],r=e.getAttribute(n),a=e.morphAttributes[n],u=r.itemSize,p=c[n],m=l[n];for(let e=0;e<u;e++){let t=d[e],n=f[e];if(p[n](o,r[t](i)),a)for(let e=0,r=a.length;e<r;e++)m[e][n](o,a[e][t](i))}}n[a]=o,u.push(o),o++}}let g=e.clone();for(let t in e.attributes){let e=c[t];if(g.setAttribute(t,new e.constructor(e.array.slice(0,o*e.itemSize),e.itemSize,e.normalized)),t in l)for(let e=0;e<l[t].length;e++){let n=l[t][e];g.morphAttributes[t][e]=new n.constructor(n.array.slice(0,o*n.itemSize),n.itemSize,n.normalized)}}return g.setIndex(u),g}var fn={name:`CopyShader`,uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`},pn=class extends ye{constructor(e,t=`tDiffuse`){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof y?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=d.clone(e.uniforms),this.material=new y({name:e.name===void 0?`unspecified`:e.name,defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new Be(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},mn=class extends ye{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let r=e.getContext(),i=e.state;i.buffers.color.setMask(!1),i.buffers.depth.setMask(!1),i.buffers.color.setLocked(!0),i.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),i.buffers.stencil.setTest(!0),i.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),i.buffers.stencil.setFunc(r.ALWAYS,a,4294967295),i.buffers.stencil.setClear(o),i.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),i.buffers.color.setLocked(!1),i.buffers.depth.setLocked(!1),i.buffers.color.setMask(!0),i.buffers.depth.setMask(!0),i.buffers.stencil.setLocked(!1),i.buffers.stencil.setFunc(r.EQUAL,1,4294967295),i.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),i.buffers.stencil.setLocked(!0)}},hn=class extends ye{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}},gn=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new h);this._width=n.width,this._height=n.height,t=new r(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:T}),t.texture.name=`EffectComposer.rt1`}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name=`EffectComposer.rt2`,this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new pn(fn),this.copyPass.material.blending=0,this.timer=new te}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let t=0,r=this.passes.length;t<r;t++){let r=this.passes[t];if(r.enabled!==!1){if(r.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(t),r.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),r.needsSwap){if(n){let t=this.renderer.getContext(),n=this.renderer.state.buffers.stencil;n.setFunc(t.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),n.setFunc(t.EQUAL,1,4294967295)}this.swapBuffers()}mn!==void 0&&(r instanceof mn?n=!0:r instanceof hn&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new h);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(n,r),this.renderTarget2.setSize(n,r);for(let e=0;e<this.passes.length;e++)this.passes[e].setSize(n,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}},_n={name:`LuminosityHighPassShader`,uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new g(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`},vn=class e extends ye{constructor(e,t=1,n,i){super(),this.strength=t,this.radius=n,this.threshold=i,this.resolution=e===void 0?new h(256,256):new h(e.x,e.y),this.clearColor=new g(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let a=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);this.renderTargetBright=new r(a,o,{type:T,depthBuffer:!1}),this.renderTargetBright.texture.name=`UnrealBloomPass.bright`,this.renderTargetBright.texture.generateMipmaps=!1;for(let e=0;e<this.nMips;e++){let t=new r(a,o,{type:T,depthBuffer:!1});t.texture.name=`UnrealBloomPass.h`+e,t.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(t);let n=new r(a,o,{type:T,depthBuffer:!1});n.texture.name=`UnrealBloomPass.v`+e,n.texture.generateMipmaps=!1,this.renderTargetsVertical.push(n),a=Math.round(a/2),o=Math.round(o/2)}let s=_n;this.highPassUniforms=d.clone(s.uniforms),this.highPassUniforms.luminosityThreshold.value=i,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new y({uniforms:this.highPassUniforms,vertexShader:s.vertexShader,fragmentShader:s.fragmentShader}),this.separableBlurMaterials=[];let c=[6,10,14,18,22];a=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);for(let e=0;e<this.nMips;e++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(c[e])),this.separableBlurMaterials[e].uniforms.invSize.value=new h(1/a,1/o),a=Math.round(a/2),o=Math.round(o/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;let l=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=l,this.bloomTintColors=[new x(1,1,1),new x(1,1,1),new x(1,1,1),new x(1,1,1),new x(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=d.clone(fn.uniforms),this.blendMaterial=new y({uniforms:this.copyUniforms,vertexShader:fn.vertexShader,fragmentShader:fn.fragmentShader,premultipliedAlpha:!0,blending:2,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new g,this._oldClearAlpha=1,this._basic=new Ve,this._fsQuad=new Be(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),r=Math.round(t/2);this.renderTargetBright.setSize(n,r);for(let e=0;e<this.nMips;e++)this.renderTargetsHorizontal[e].setSize(n,r),this.renderTargetsVertical[e].setSize(n,r),this.separableBlurMaterials[e].uniforms.invSize.value=new h(1/n,1/r),n=Math.round(n/2),r=Math.round(r/2)}render(t,n,r,i,a){t.getClearColor(this._oldClearColor),this._oldClearAlpha=t.getClearAlpha();let o=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),a&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=r.texture,t.setRenderTarget(null),t.clear(),this._fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=r.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this._fsQuad.render(t);let s=this.renderTargetBright;for(let n=0;n<this.nMips;n++)this._fsQuad.material=this.separableBlurMaterials[n],this.separableBlurMaterials[n].uniforms.colorTexture.value=s.texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[n]),t.clear(),this._fsQuad.render(t),this.separableBlurMaterials[n].uniforms.colorTexture.value=this.renderTargetsHorizontal[n].texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[n]),t.clear(),this._fsQuad.render(t),s=this.renderTargetsVertical[n];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this._fsQuad.render(t),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(r),this._fsQuad.render(t)),t.setClearColor(this._oldClearColor,this._oldClearAlpha),t.autoClear=o}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let r=0;r<e;r++)t.push(.39894*Math.exp(-.5*r*r/(n*n))/n);let r=[],i=[];for(let n=1;n<e;n+=2){let a=t[n],o=n+1<e?t[n+1]:0,s=a+o;r.push((n*a+(n+1)*o)/s),i.push(s)}return new y({defines:{KERNEL_PAIRS:r.length},uniforms:{colorTexture:{value:null},invSize:{value:new h(.5,.5)},direction:{value:new h(.5,.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:r},gaussianWeights:{value:i}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new y({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}};vn.BlurDirectionX=new h(1,0),vn.BlurDirectionY=new h(0,1);var yn={name:`OutputShader`,uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`},bn=class extends ye{constructor(){super(),this.isOutputPass=!0,this.uniforms=d.clone(yn.uniforms),this.material=new oe({name:yn.name,uniforms:this.uniforms,vertexShader:yn.vertexShader,fragmentShader:yn.fragmentShader}),this._fsQuad=new Be(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},ee.getTransfer(this._outputColorSpace)===`srgb`&&(this.material.defines.SRGB_TRANSFER=``),this._toneMapping===1?this.material.defines.LINEAR_TONE_MAPPING=``:this._toneMapping===2?this.material.defines.REINHARD_TONE_MAPPING=``:this._toneMapping===3?this.material.defines.CINEON_TONE_MAPPING=``:this._toneMapping===4?this.material.defines.ACES_FILMIC_TONE_MAPPING=``:this._toneMapping===6?this.material.defines.AGX_TONE_MAPPING=``:this._toneMapping===7?this.material.defines.NEUTRAL_TONE_MAPPING=``:this._toneMapping===5&&(this.material.defines.CUSTOM_TONE_MAPPING=``),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},xn=class extends ye{scene;waterScene;camera;opaque;reflection;reflCam=new Fe;reflMatrix=new _e;copy;clip=[new Ee(new x(0,1,0),.002)];constructor(e,t,n,i){super(),this.scene=e,this.waterScene=t,this.camera=n,this.opaque=new r(1,1,{type:T,samples:i,depthTexture:new ie(1,1,de)}),this.reflection=new r(1,1,{type:T,samples:Math.min(i,2)}),this.copy=new Be(new y({uniforms:{tColor:{value:this.opaque.texture},tDepth:{value:this.opaque.depthTexture}},vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,fragmentShader:`
          uniform sampler2D tColor, tDepth; varying vec2 vUv;
          void main(){ gl_FragColor = texture2D(tColor, vUv); gl_FragDepth = texture2D(tDepth, vUv).r; }`,depthTest:!0,depthWrite:!0,depthFunc:1}))}setSize(e,t){this.opaque.setSize(e,t),this.reflection.setSize(Math.max(1,Math.round(e/2)),Math.max(1,Math.round(t/2)))}render(e,t){let n=this.camera,r=this.reflCam;r.copy(n,!1),r.position.set(n.position.x,-n.position.y,n.position.z);let i=n.getWorldDirection(new x);r.up.set(0,1,0),r.lookAt(r.position.clone().add(new x(i.x,-i.y,i.z))),r.updateMatrixWorld(),this.reflMatrix.multiplyMatrices(r.projectionMatrix,r.matrixWorldInverse),r.layers.set(1),e.shadowMap.needsUpdate=!0,e.clippingPlanes=this.clip,e.setRenderTarget(this.reflection),e.clear(),e.render(this.scene,r),e.clippingPlanes=[],e.setRenderTarget(this.opaque),e.clear(),e.render(this.scene,n),e.setRenderTarget(this.renderToScreen?null:t),e.clear(),this.copy.render(e);let a=e.autoClear;e.autoClear=!1,e.render(this.waterScene,n),e.autoClear=a}},Sn=class{renderer;waterUniforms;composer;bloom;main;constructor(e,t,n,i,a,o){this.renderer=e,this.waterUniforms=a;let s=new r(1,1,{type:T,samples:o});this.composer=new gn(e,s),this.main=new xn(t,n,i,o),this.bloom=new vn(new h(256,256),.32,.55,1),this.composer.addPass(this.main),this.composer.addPass(this.bloom),this.composer.addPass(new bn),a.uSceneColor.value=this.main.opaque.texture,a.uSceneDepth.value=this.main.opaque.depthTexture,a.uReflection.value=this.main.reflection.texture,a.uReflMatrix.value=this.main.reflMatrix}setSize(e,t,n){this.renderer.setPixelRatio(n),this.renderer.setSize(e,t,!1),this.composer.setPixelRatio(n),this.composer.setSize(e,t);let r=Math.round(e*n),i=Math.round(t*n);this.main.setSize(r,i),this.waterUniforms.uResolution.value.set(r,i)}render(e){this.composer.render(e)}};function A(e,t){let n=new g(t),r=e.attributes.position.count,i=new Float32Array(r*3);for(let e=0;e<r;e++)n.toArray(i,e*3);return e.setAttribute(`color`,new o(i,3)),e.deleteAttribute(`uv`),e.index?e.toNonIndexed():e}function Cn(){let{body:e,head:t}=D,n=new _(1,40,28);n.scale(e.r.x,e.r.y,e.r.z);let r=n.attributes.position;for(let e=0;e<r.count;e++){let t=r.getX(e),n=r.getY(e);t<-.02&&r.setY(e,n+((-t-.02)/.025)**2*.018*(n>-.005?1:.4))}n.translate(e.c.x,e.c.y,e.c.z);for(let e=0;e<r.count;e++)r.getY(e)<D.base&&r.setY(e,D.base);n.computeVertexNormals();let i=new _(t.r,32,24);i.translate(t.c.x,t.c.y,t.c.z);let a=new _(1,20,12);a.scale(.016,.006,.012),a.translate(t.c.x+.022,t.c.y-.004,0);let o=[-1,1].map(e=>{let n=new _(.0035,12,8);return n.translate(t.c.x+.015,t.c.y+.007,e*.013),A(n,`#1b1b1f`)});return{geo:ln([A(n,`#ffcf2e`),A(i,`#ffd43a`),A(a,`#ff8a1f`),...o]),mat:new be({vertexColors:!0,roughness:.32,clearcoat:.6,clearcoatRoughness:.25}),com:D.com}}function wn(){let{length:e,keel:t,width:n,hull:r}=ht,i=[],a=(e,t,n)=>i.push(...e,...t,...n),o=[-t/2,0,0],s=[t/2,0,0],c=[-e/2,r,0],l=[e/2,r,0],u=n*.3;for(let i of[-1,1]){let d=[-e/2+.012,r,i*n/2],f=[e/2-.012,r,i*n/2],p=[-t/2,0,i*u],m=[t/2,0,i*u];a(o,s,m),a(o,m,p),a(p,m,f),a(p,f,d),a(o,p,c),a(p,d,c),a(s,l,m),a(m,l,f),a([-.032,r,i*.004],[.032,r,i*.004],[0,r+.038,0])}let d=new v;return d.setAttribute(`position`,new le(i,3)),d.computeVertexNormals(),{geo:A(d,`#f6f3ec`),mat:new C({vertexColors:!0,roughness:.85,flatShading:!0,side:2}),com:ht.com}}function Tn(){let{hull:e,mast:t}=gt,n=new _(1,40,20,0,Math.PI*2,Math.PI/2,Math.PI/2);n.scale(e.r.x,e.r.y,e.r.z);let r=n.attributes.position;for(let t=0;t<r.count;t++){let n=r.getX(t);n>0&&r.setZ(t,r.getZ(t)*(1-.45*(n/e.r.x)**2))}n.translate(e.c.x,e.c.y,e.c.z),n.computeVertexNormals();let i=new ke(1,40);i.rotateX(-Math.PI/2),i.scale(e.r.x,1,e.r.z);let a=i.attributes.position;for(let t=0;t<a.count;t++){let n=a.getX(t);n>0&&a.setZ(t,a.getZ(t)*(1-.45*(n/e.r.x)**2))}i.translate(e.c.x,e.c.y,e.c.z);let o=new ne(1,.06,6,48);o.rotateX(Math.PI/2),o.scale(e.r.x*.995,.08,e.r.z*.995),o.translate(e.c.x,e.c.y-.004,e.c.z);let s=new c(.0025,.003,t,8);s.translate(.008,e.c.y+t/2,0);let l=new v;l.setAttribute(`position`,new le([.006,e.c.y+.02,0,.006,e.c.y+t-.01,0,-.07,e.c.y+.02,0],3)),l.computeVertexNormals();let u=new v;return u.setAttribute(`position`,new le([.011,e.c.y+.025,0,.011,e.c.y+t-.04,0,.07,e.c.y+.02,0],3)),u.computeVertexNormals(),{geo:ln([A(n,`#2f5577`),A(i,`#d8b98c`),A(o,`#f2efe6`),A(s,`#a27b52`),A(l,`#f4efe2`),A(u,`#e9846a`)]),mat:new C({vertexColors:!0,roughness:.55,side:2}),com:gt.com}}function En(){let{r:e}=_t,t=new _(e,24,12,0,Math.PI*2,0,Math.PI/2),n=new _(e,24,12,0,Math.PI*2,Math.PI/2,Math.PI/2),r=new c(e*1.01,e*1.01,e*.18,24,1,!0),i=new c(.0012,.0016,.022,8);return i.translate(0,e+.009,0),{geo:ln([A(t,`#e8392f`),A(n,`#f4f1ea`),A(r,`#1f1f24`),A(i,`#e8392f`)]),mat:new be({vertexColors:!0,roughness:.3,clearcoat:.8}),com:_t.com}}var Dn={duck:Cn,paperBoat:wn,sailboat:Tn,bobber:En},On=new Map;function kn(e){let t=On.get(e);if(!t){let n=Dn[e]();n.geo.translate(-n.com.x,-n.com.y,-n.com.z),t={geo:n.geo,mat:n.mat},On.set(e,t)}let n=new w(t.geo,t.mat);return n.castShadow=!0,n.layers.enable(1),n}var An=.2,j=8,jn=class{scene;solver;camera;events;toys=[];sampler;xz=new Float32Array(sn*2);ray=new a;carryPlane=new Ee(new x(0,1,0),-.2);carried=new Map;wind=new x;constructor(e,t,n,r,i){this.scene=e,this.solver=t,this.camera=r,this.events=i,this.sampler=new cn(n,()=>t.stateTexture,[t.grid.nx,t.grid.nz],t.origin,t.grid.dx)}floorAt=(e,t)=>{let n=this.solver.depthAt(e,t);return n>0?-n:0};spawn(e,t){this.toys.length>=6&&this.remove(this.toys.find(e=>!e.body.held)??this.toys[0]);let n=new rn(yt(e));n.pos.copy(t),n.quat.setFromAxisAngle(new x(0,1,0),Math.random()*Math.PI*2);let r=kn(e);this.scene.add(r);let i={kind:e,body:n,mesh:r,loads:[],fluid:{eta0:0,slopeX:0,slopeZ:0,u:0,v:0,depth:0}};return this.toys.push(i),this.sync(i),i}remove(e){let t=this.toys.indexOf(e);t>=0&&this.toys.splice(t,1),this.scene.remove(e.mesh);for(let[t,n]of this.carried)n.toy===e&&this.carried.delete(t)}clear(){[...this.toys].forEach(e=>this.remove(e))}rayFrom(e){return this.ray.setFromCamera(e,this.camera),this.ray.ray}carryNew(e,t,n){let r=this.rayFrom(n).intersectPlane(this.carryPlane,new x)??new x(0,An,0),i=this.spawn(t,r);i.body.held=!0,this.carried.set(e,{toy:i,target:r.clone()})}pick(e,t){let n=this.rayFrom(t),r=null,i=1/0;for(let e of this.toys){let t=new Ae(e.body.pos,e.body.def.radius*1.3),a=n.intersectSphere(t,new x);if(a){let t=a.distanceTo(n.origin);t<i&&(i=t,r=e)}}if(!r)return!1;r.body.held=!0;let a=n.intersectPlane(this.carryPlane,new x)??r.body.pos.clone();return this.carried.set(e,{toy:r,target:a}),!0}moveCarry(e,t){let n=this.carried.get(e);if(!n)return;let r=this.rayFrom(t).intersectPlane(this.carryPlane,new x);r&&n.target.copy(r)}endCarry(e,t=!1){let n=this.carried.get(e);n&&(this.carried.delete(e),n.toy.body.held=!1,n.toy.body.airborne=!0,t&&this.remove(n.toy))}isCarrying(e){return this.carried.has(e)}update(e,t,n,r){if(e<=0)return this.allLoads();let i=this.sampler.resultTag;if(i){for(let{toy:e,offset:t,count:n}of i.toys){if(!this.toys.includes(e)||n<j)continue;let r=this.sampler.result,i=this.ringRadius(e),a=0,o=0,s=0,c=0,l=0;for(let e=0;e<j;e++){let n=e/j*Math.PI*2,i=r[(t+e)*4];a+=i,o+=i*Math.cos(n),s+=i*Math.sin(n),c+=r[(t+e)*4+1],l+=r[(t+e)*4+2]}let u=j/2*i;e.fluid.eta0=a/j,e.fluid.slopeX=o/u,e.fluid.slopeZ=s/u,e.fluid.u=c/j,e.fluid.v=l/j}this.sampler.resultTag=null}for(let i of this.toys){let a=i.body;if(a.held){let t=[...this.carried.values()].find(e=>e.toy===i);if(t){let n=1-Math.exp(-e*18),r=a.pos.clone().lerp(t.target,n);a.vel.copy(r).sub(a.pos).divideScalar(e).clampLength(0,3),a.pos.copy(r),a.omega.multiplyScalar(.9),a.quat.slerp(new ve().setFromEuler(new ue(0,new ue().setFromQuaternion(a.quat).y,0)),.15)}i.loads=[],this.sync(i);continue}let o=a.airborne,s=-a.vel.y;i.fluid.depth=this.solver.depthAt(a.pos.x,a.pos.z),a.step(e,t,n,i.fluid,this.floorAt,r?.(i)),o&&!a.airborne&&s>.3&&this.events.onEntry(i.kind,a.pos.x,a.pos.z,s,a.def.mass,a.def.radius),this.coupleToFluid(i,e,t,n),this.sync(i),(a.pos.y<-1||Math.abs(a.pos.x)>6||Math.abs(a.pos.z)>6)&&this.remove(i)}let a={toys:[]},o=0;for(let e of this.toys){if(o+j>1024)break;let t=this.ringRadius(e);for(let n=0;n<j;n++){let r=n/j*Math.PI*2;this.xz[(o+n)*2]=e.body.pos.x+Math.cos(r)*t,this.xz[(o+n)*2+1]=e.body.pos.z+Math.sin(r)*t}a.toys.push({toy:e,offset:o,count:j}),o+=j}return o&&this.sampler.request(this.xz,o,a),this.allLoads()}allLoads(){return this.toys.flatMap(e=>e.loads)}ringRadius(e){return e.body.def.radius*1.6+1.5*this.solver.grid.dx}coupleToFluid(e,t,n,r){let i=e.body,a=i.def,o=new x(1,0,0).applyQuaternion(i.quat),s=[0,1,2].map(()=>({f:0,x:0,z:0,xx:0,zz:0})),c=a.radius,l=1.5*this.solver.grid.dx;for(let e=0;e<a.samples.length;e++){let t=i.world[e],l=i.frac[e];if(l<=0)continue;let u=n.density*r*l*a.samples[e].dV,d=(t.x-i.pos.x)*o.x+(t.z-i.pos.z)*o.z,f=s[d<-c/3?0:d>c/3?2:1];f.f+=u,f.x+=u*t.x,f.z+=u*t.z,f.xx+=u*t.x*t.x,f.zz+=u*t.z*t.z}e.loads=[];for(let t of s){if(t.f<=0)continue;let i=t.x/t.f,a=t.z/t.f,o=Math.sqrt(Math.max(t.xx/t.f-i*i+t.zz/t.f-a*a,0)),s=Math.max(o*1.2,l),c=Math.max(this.solver.depthAt(i,a),.001),u=Math.min(t.f/(Math.PI*s*s),.9*n.density*r*c);e.loads.push({x:i,z:a,radius:s,pressure:u})}let u=Math.max(this.solver.depthAt(i.pos.x,i.pos.z),.002);if(i.submerged>0&&this.solver.sdfAt(i.pos.x,i.pos.z)<0){let e=Math.max(a.radius*.7,l),r=-t/(n.density*u*Math.PI*e*e),o=[i.drag.x*r,i.drag.z*r];Math.hypot(...o)>1e-5&&this.events.impulse({x:i.pos.x,z:i.pos.z,radius:e,pressureImpulse:0,push:o})}}sync(e){e.mesh.position.copy(e.body.pos),e.mesh.quaternion.copy(e.body.quat)}},M={radius:.02,thickness:.005,density:2650},Mn=M.density*Math.PI*M.radius**2*M.thickness,Nn=1,Pn=Math.cbrt(3*Math.PI*M.radius**2*M.thickness/(4*Math.PI));function Fn(e,t=M.radius){if(e<=0)return 0;if(e>=2*t)return Math.PI*t*t;let n=1-e/t;return t*t*(Math.acos(n)-n*Math.sqrt(1-n*n))}var In=class{pos=new x;vel=new x;tilt;spin;heading=new h(1,0);state=`flying`;skips=0;inContact=!1;contactMomentum=0;contactSpeed=0;angle=0;constructor(e,t,n,r){this.pos.copy(e),this.vel.copy(t),this.tilt=n,this.spin=r;let i=new h(t.x,t.z);i.lengthSq()>0&&this.heading.copy(i.normalize())}normal(){return new x(-this.heading.x*Math.sin(this.tilt),Math.cos(this.tilt),-this.heading.y*Math.sin(this.tilt))}step(e,t,n,r,i,a){let o=[],s=Math.max(1,Math.ceil(e/5e-4)),c=e/s,l=M.radius,u=Mn;this.angle+=this.spin*e;for(let e=0;e<s&&this.state!==`gone`&&this.state!==`resting`;e++){let e=new x(0,-u*n,0),s=this.normal(),d=this.pos.clone().add(new x(-this.heading.x*Math.cos(this.tilt)*l,-Math.sin(this.tilt)*l,-this.heading.y*Math.cos(this.tilt)*l)),f=i(d.x,d.z),p=f?r(d.x,d.z):-1/0,m=p-d.y;if(this.state===`flying`&&f&&m>0){if(t.rheology.kind===`shearThickening`&&Math.abs(this.vel.y)/M.thickness>t.rheology.gammaC*4){let e=this.vel.y;this.vel.y=-e*.45;let t=Math.min(1,1.45*Math.abs(e)*.35/Math.max(Math.hypot(this.vel.x,this.vel.z),1e-6));this.vel.x*=1-t,this.vel.z*=1-t,this.pos.y=p+Math.sin(this.tilt)*l+1e-4,this.skips++,o.push({kind:`clatter`,x:d.x,z:d.z,momentum:u*1.45*Math.abs(e),speed:Math.abs(e)}),this.perturbTilt(n);continue}let r=m/Math.max(Math.sin(this.tilt),.02),i=Fn(r,l),a=this.vel.dot(s);if(r>=2*l||this.tilt<=.01){this.toSinking(o,t);break}let f=.5*t.density*this.vel.lengthSq()*i;e.addScaledVector(s,Nn*f);let h=this.vel.clone().addScaledVector(s,-a);h.lengthSq()>1e-8&&e.addScaledVector(h.normalize(),-.05*f),e.addScaledVector(this.vel,-6*Math.PI*t.viscosity*Pn*(i/(Math.PI*l*l))),this.inContact||(this.inContact=!0,this.contactMomentum=0,this.contactSpeed=-this.vel.y),this.contactMomentum+=e.y*c+u*n*c}else if(this.inContact&&this.state===`flying`){if(this.inContact=!1,this.vel.y>0)this.skips++,o.push({kind:`skip`,x:this.pos.x,z:this.pos.z,momentum:this.contactMomentum,speed:this.contactSpeed}),this.perturbTilt(n);else{this.toSinking(o,t);break}}if(this.state===`sinking`){let r=u/M.density;e.y+=t.density*n*r,e.addScaledVector(this.vel,-.6*t.density*Math.PI*l*l*this.vel.length()),e.addScaledVector(this.vel,-6*Math.PI*t.viscosity*Pn),this.tilt*=1-c*4}if(this.state===`floating`){let i=u/M.density,a=E.clamp((r(this.pos.x,this.pos.z)-(this.pos.y-M.thickness/2))/M.thickness,0,1);e.y+=t.density*n*i*a,this.vel.multiplyScalar(1-c*3),this.tilt*=1-c*6}this.vel.addScaledVector(e,c/u),this.pos.addScaledVector(this.vel,c);let h=a(this.pos.x,this.pos.z)+M.thickness/2;this.pos.y<h&&(this.pos.y=h,this.state===`flying`&&!i(this.pos.x,this.pos.z)&&o.push({kind:`ground`,x:this.pos.x,z:this.pos.z,momentum:0,speed:Math.abs(this.vel.y)}),this.vel.set(0,0,0),this.state=`resting`)}return o}toSinking(e,t){this.inContact=!1,this.state=M.density<t.density?`floating`:`sinking`,e.push({kind:`plop`,x:this.pos.x,z:this.pos.z,momentum:Mn*this.vel.length()*.5,speed:this.vel.length()}),this.vel.x*=.15,this.vel.z*=.15,this.vel.y=Math.min(this.vel.y,0)*.3}perturbTilt(e){let t=e/(M.radius*Math.max(this.spin*this.spin,1));this.tilt+=(Math.random()*2-1)*t*.6,this.tilt=E.clamp(this.tilt,-.2,1.4)}},Ln=8,Rn=.04,zn=18*Math.PI/180,Bn=class{scene;world;onEvent;onDone;list=[];geo;mat;current=null;constructor(e,t,n,r){this.scene=e,this.world=t,this.onEvent=n,this.onDone=r;let i=new _(1,28,14),a=i.attributes.position;for(let e=0;e<a.count;e++){let t=a.getX(e),n=a.getY(e),r=a.getZ(e);a.setXYZ(e,t*(1+.08*r),n*.5*(1-.15*t*t),r*.92)}i.computeVertexNormals(),i.scale(M.radius,M.thickness,M.radius),this.geo=i,this.mat=new C({color:`#7e7a72`,roughness:.6})}throwFrom(e,t){let n=Math.hypot(e.dx,e.dy)/t/Math.max(e.ms/1e3,.04),r=E.clamp(.6+n*1.6,.6,9),i=E.clamp(2+n*3.5,2,22),a=E.clamp(Math.atan2(-e.dy,Math.abs(e.dx)),-.1,1.3),o=Math.sign(e.dx)||1,s=E.clamp(e.start.z,-this.world.halfZ*.5,this.world.halfZ*.5),c=-o*this.world.halfX;for(let e=-o*(this.world.halfX+.1);Math.abs(e)>.01;e+=o*.01)if(this.world.isFluid(e,s)){c=e;break}let l=Rn/Math.tan(zn),u=new In(new x(c+o*(.08-l),Rn,s),new x(o*r*Math.cos(zn),-r*Math.sin(zn),0),Math.max(a,0),i*Math.PI*2);return this.add(u),{speed:r,tiltDeg:a*180/Math.PI,spinHz:i}}add(e){if(this.list.length>=Ln){let e=this.list.shift();this.scene.remove(e.mesh)}let t=new w(this.geo,this.mat);t.castShadow=!0,t.layers.enable(1),this.scene.add(t),this.list.push({stone:e,mesh:t,age:0}),this.current=e}clear(){this.list.forEach(e=>this.scene.remove(e.mesh)),this.list=[],this.current=null}update(e,t,n){for(let r of this.list){let i=r.stone;r.age+=e;let a=i.state;if(i.state===`flying`||i.state===`sinking`||i.state===`floating`){let r=i.step(e,t,n,()=>0,this.world.isFluid,this.world.floorAt);for(let e of r)this.onEvent(e,i);a===`flying`&&i.state!==`flying`&&this.onDone(i.skips,i)}let o=i.normal();r.mesh.position.copy(i.pos),r.mesh.quaternion.setFromUnitVectors(new x(0,1,0),o),r.mesh.quaternion.multiply(new ve().setFromAxisAngle(new x(0,1,0),i.angle))}this.list=this.list.filter(e=>{let t=e.age<120;return t||this.scene.remove(e.mesh),t})}static massKg(){return Mn}},Vn=.75,Hn=class{toys;camera;onNibble;bobber=null;line;positions=new Float32Array(96);nextNibble=0;tug=0;tugForce=0;queue=[];reeling=!1;active=!1;constructor(t,n,r,i){this.toys=n,this.camera=r,this.onNibble=i;let a=new v;a.setAttribute(`position`,new o(this.positions,3)),this.line=new e(a,new Se({color:`#f2f0ea`,transparent:!0,opacity:.55})),this.line.frustumCulled=!1,this.line.visible=!1,t.add(this.line)}rodTip(){return new x(1.25,-.25,.4).unproject(this.camera).sub(this.camera.position).normalize().multiplyScalar(.9).add(this.camera.position)}onCast=()=>{};cast(e,t){this.onCast(),this.reelIn(!0);let n=this.rodTip(),r=new x(e,.012,t),i=Vn,a=this.toys.spawn(`bobber`,n);a.body.vel.set((r.x-n.x)/i,(r.y-n.y+4.905*i*i)/i,(r.z-n.z)/i),a.body.quat.identity(),this.bobber=a,this.line.visible=!0,this.nextNibble=5+Math.random()*10,this.queue=[],this.tug=0,this.reeling=!1}reelIn(e=!1){this.bobber&&(e?(this.toys.remove(this.bobber),this.bobber=null,this.line.visible=!1):this.reeling=!0)}forceFor(e){if(!this.bobber||e!==this.bobber)return;let t=new x;if(this.tug>0&&(t.y-=this.tugForce),this.reeling){let e=this.rodTip().sub(this.bobber.body.pos);t.addScaledVector(e.normalize(),.08)}return t}update(e){if(!this.bobber)return;if(!this.toys.toys.includes(this.bobber)){this.bobber=null,this.line.visible=!1;return}let t=this.bobber.body;if(!t.airborne&&!this.reeling&&(this.nextNibble-=e,this.nextNibble<=0)){let e=Math.random()<.15,t=e?1:1+Math.floor(Math.random()*3),n=0;for(let r=0;r<t;r++)this.queue.push({delay:n,dur:e?.7:.12+Math.random()*.1,force:e?.06:.015+Math.random()*.015}),n+=.25+Math.random()*.35;this.nextNibble=8+Math.random()*18}for(let t of this.queue)t.delay-=e;let n=this.queue.findIndex(e=>e.delay<=0);if(n>=0&&this.tug<=0){let e=this.queue.splice(n,1)[0];this.tug=e.dur,this.tugForce=e.force,this.onNibble(e.force)}this.tug-=e,this.reeling&&t.pos.distanceTo(this.rodTip())<.15&&this.reelIn(!0);let r=this.rodTip(),i=t.pos.clone().add(new x(0,.02,0)),a=t.airborne?.05:.18;for(let e=0;e<32;e++){let t=e/31,n=r.clone().lerp(i,t);n.y-=Math.sin(Math.PI*t)*a*r.distanceTo(i)*.5,n.y=Math.max(n.y,i.y-.01),n.toArray(this.positions,e*3)}this.line.geometry.attributes.position.needsUpdate=!0}get hasBobber(){return!!this.bobber}},Un=null,Wn=0;function Gn(e,t=2600){Un||(Un=document.createElement(`div`),Un.className=`ui-toast`,document.body.append(Un)),Un.innerHTML=e,Un.classList.add(`show`),clearTimeout(Wn),Wn=window.setTimeout(()=>Un?.classList.remove(`show`),t)}var Kn=class{target;scene=new s;camera=new we(-1,1,1,-1,0,1);material;constructor(e,t,n){let{nx:i,nz:a}=e.grid;this.target=new r(i,a,{type:T,minFilter:Ie,magFilter:Ie,depthBuffer:!1,generateMipmaps:!1});let o=Math.round(i/n),s=Math.round(a/n),c=new S(1,1,o,s);c.translate(.5,.5,0),this.material=new y({uniforms:{uSurface:{value:e.surface.texture},uShape:{value:e.shapeTexture},uExtent:{value:new h(...e.extent)},uLight:{value:new x(0,-1,0)},uEta:{value:1/t},uKappa:{value:new x}},vertexShader:`
        uniform sampler2D uSurface, uShape;
        uniform vec2 uExtent;
        uniform vec3 uLight;   // direction sunlight travels (unit, pointing down)
        uniform float uEta;    // n_air / n_fluid
        uniform vec3 uKappa;   // absorption along the light's path [1/m]
        varying vec3 vOld, vNew;
        varying vec3 vT;
        void main() {
          vec2 uv = position.xy;
          vec4 s = texture2D(uSurface, uv);
          float H = texture2D(uShape, uv).g;
          vec3 n = normalize(vec3(-s.g, 1.0, -s.b));
          vec2 q = uv * uExtent;
          vec3 p = vec3(q.x, s.r, q.y);                    // point on the surface (y = η)
          vec3 r0 = refract(uLight, vec3(0, 1, 0), uEta); // through flat water
          vec3 r  = refract(uLight, n, uEta);              // through the real surface
          // follow each ray down to the floor at depth H below rest level
          vOld = vec3(q.x, 0.0, q.y) + r0 * (H / -r0.y);
          vNew = p + r * ((H + s.r) / -r.y);
          // light reaching the bed has crossed the layer once (Beer–Lambert)
          vT = exp(-uKappa * length(vNew - p));
          vec2 clip = (vNew.xz / uExtent) * 2.0 - 1.0;
          gl_Position = vec4(clip, 0.0, 1.0);
        }`,fragmentShader:`
        varying vec3 vOld, vNew;
        varying vec3 vT;
        void main() {
          float aOld = length(dFdx(vOld.xz)) * length(dFdy(vOld.xz));
          float aNew = length(dFdx(vNew.xz)) * length(dFdy(vNew.xz));
          float I = aOld / max(aNew, 1e-12);
          gl_FragColor = vec4(min(I, 12.0) * vT, 1.0);
        }`,blending:2,depthTest:!1,depthWrite:!1,side:2});let l=new w(c,this.material);l.frustumCulled=!1,this.scene.add(l)}stats(e){let{width:t,height:n}=this.target,r=new Uint16Array(t*n*4);e.readRenderTargetPixels(this.target,0,0,t,n,r);let i=1/0,a=0,o=0;for(let e=0;e<r.length;e+=4){let t=m.fromHalfFloat(r[e]);i=Math.min(i,t),a=Math.max(a,t),o+=t}return{min:i,max:a,mean:o/(r.length/4)}}enabled=!0;clearedWhite=!1;setOptics(e,t=[0,0,0]){this.enabled=e!==null,e!==null&&(this.material.uniforms.uEta.value=1/e),this.material.uniforms.uKappa.value.set(...t)}update(e,t){if(!this.enabled){if(!this.clearedWhite){e.setRenderTarget(this.target);let t=e.getClearColor(new g);e.setClearColor(16777215,1),e.clear(!0,!1,!1),e.setClearColor(t),e.setRenderTarget(null),this.clearedWhite=!0}return}this.clearedWhite=!1,this.material.uniforms.uLight.value.copy(t).negate();let n=e.getClearColor(new g),r=e.getClearAlpha();e.setRenderTarget(this.target),e.setClearColor(0,1),e.clear(!0,!1,!1),e.render(this.scene,this.camera),e.setRenderTarget(null),e.setClearColor(n,r)}},qn=`
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int k = 0; k < 5; k++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
// Voronoi: returns (distance to nearest feature, distance to 2nd, cell id hash)
vec3 voronoi(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y);
    vec2 o = hash22(i + g);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = hash12(i + g + 3.7); }
    else if (d < d2) { d2 = d; }
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}
`,Jn=`
float iceBand(vec2 p, float sdf) {
  float w = 0.05 + 0.09 * fbm(p * 3.0);
  return sdf < 0.0 ? smoothstep(-w - 0.015, -w + 0.01, sdf) : 0.0;
}
`;function Yn(e){let[t,n]=e.origin,[r,i]=e.extent,a=new S(r,i,Math.round(e.grid.nx/2),Math.round(e.grid.nz/2));a.rotateX(-Math.PI/2),a.translate(t+r/2,0,n+i/2);let o={uSurface:{value:e.surface.texture},uShape:{value:e.shapeTexture},uOrigin:{value:new h(t,n)},uExtent:{value:new h(r,i)},uTexel:{value:new h(1/e.grid.nx,1/e.grid.nz)},uSceneColor:{value:null},uSceneDepth:{value:null},uReflection:{value:null},uReflMatrix:{value:new _e},uResolution:{value:new h(1,1)},uSunDir:{value:new x(0,1,0)},uSunColor:{value:new g(1,1,1)},uAmbient:{value:new g(.5,.55,.6)},uMode:{value:0},uIor:{value:1.333},uAbsorption:{value:new x},uTurbidity:{value:new x},uScatter:{value:new g(`#6f6a4c`)},uRoughness:{value:.05},uMetalN:{value:new x},uMetalK:{value:new x},uAlbedo:{value:new g},uExtinction:{value:0},uMeniscus:{value:0},uIce:{value:null},uIceOn:{value:0},uJamMarks:{value:[0,1,2,3].map(()=>new Qe)}},s=new y({uniforms:o,vertexShader:`
      uniform sampler2D uSurface;
      uniform vec2 uOrigin, uExtent;
      varying vec3 vWPos;
      varying vec2 vUv;
      void main() {
        vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
        vUv = (p.xz - uOrigin) / uExtent;
        p.y += texture2D(uSurface, vUv).r;   // real displacement (millimetres)
        vWPos = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,fragmentShader:`
      uniform sampler2D uSurface, uShape, uSceneColor, uSceneDepth, uReflection, uIce;
      uniform float uIceOn;
      uniform mat4 projectionMatrix;
      uniform vec2 uOrigin, uExtent, uResolution, uTexel;
      uniform mat4 uReflMatrix;
      uniform vec3 uSunDir, uSunColor, uAmbient, uAbsorption, uTurbidity, uScatter, uAlbedo;
      uniform vec3 uMetalN, uMetalK;
      uniform float uIor, uRoughness, uExtinction, uMeniscus;
      uniform int uMode;
      uniform vec4 uJamMarks[4];
      varying vec3 vWPos;
      varying vec2 vUv;
      ${qn}
      ${Jn}

      // Exact Fresnel reflectance for unpolarised light at a dielectric
      // interface (average of s- and p-polarisations).
      float fresnel(float cosI, float n) {
        float sinT2 = (1.0 - cosI * cosI) / (n * n);
        if (sinT2 >= 1.0) return 1.0;
        float cosT = sqrt(1.0 - sinT2);
        float rs = (cosI - n * cosT) / (cosI + n * cosT);
        float rp = (n * cosI - cosT) / (n * cosI + cosT);
        return 0.5 * (rs * rs + rp * rp);
      }
      // Fresnel reflectance of a conductor with complex index n + ik (the
      // standard closed form used in physically based rendering), per colour.
      vec3 fresnelMetal(float c, vec3 n, vec3 k) {
        vec3 nk = n * n + k * k;
        float c2 = c * c;
        vec3 rs = (nk - 2.0 * n * c + c2) / (nk + 2.0 * n * c + c2);
        vec3 rp = (nk * c2 - 2.0 * n * c + 1.0) / (nk * c2 + 2.0 * n * c + 1.0);
        return 0.5 * (rs + rp);
      }
      float ggx(vec3 n, vec3 h, float a) {
        float a2 = a * a * a * a;
        float NdH = max(dot(n, h), 0.0);
        float d = NdH * NdH * (a2 - 1.0) + 1.0;
        return a2 / (3.14159265 * d * d);
      }
      vec2 toScreen(vec3 world) {
        vec4 c = projectionMatrix * viewMatrix * vec4(world, 1.0);
        return c.xy / c.w * 0.5 + 0.5;
      }

      void main() {
        vec2 shp = texture2D(uShape, vUv).rg;
        float sdf = shp.r, H = shp.g;
        if (sdf > 0.0015) discard;

        vec4 s = texture2D(uSurface, vUv);
        vec3 n = normalize(vec3(-s.g, 1.0, -s.b));
        // non-wetting rim (mercury): the surface rolls over into a bead at
        // the edge, so tilt the normal outward close to the contact line
        if (uMeniscus > 0.0) {
          float gx = texture2D(uShape, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uShape, vUv - vec2(uTexel.x, 0.0)).r;
          float gz = texture2D(uShape, vUv + vec2(0.0, uTexel.y)).r - texture2D(uShape, vUv - vec2(0.0, uTexel.y)).r;
          vec2 outward = normalize(vec2(gx, gz) + 1e-6);
          float t = clamp(1.0 + sdf / uMeniscus, 0.0, 1.0);    // 0 inside … 1 at the edge
          float slope = tan(t * t * 1.2);                      // up to ~50° at the rim
          n = normalize(n + vec3(outward.x, 0.0, outward.y) * slope);
        }
        vec3 V = normalize(cameraPosition - vWPos);
        float cosV = clamp(dot(n, V), 0.0, 1.0);
        vec2 screenUv = gl_FragCoord.xy / uResolution;
        vec3 direct = texture2D(uSceneColor, screenUv).rgb;

        // reflection: perturb the mirrored ray by the surface slope
        vec3 R = reflect(-V, n);
        vec4 rc = uReflMatrix * vec4(vWPos + R * 8.0, 1.0);
        vec2 reflUv = clamp(rc.xy / rc.w * 0.5 + 0.5, 0.001, 0.999);
        vec3 refl = texture2D(uReflection, reflUv).rgb;

        vec3 Hv = normalize(V + uSunDir);
        float NdL = max(dot(n, uSunDir), 0.0);
        float D = ggx(n, Hv, uRoughness);
        float geom = NdL / max(4.0 * NdL * cosV, 1e-3);

        // refraction path to the bed (used by dielectrics and thin opaque edges)
        vec3 rd = refract(-V, n, 1.0 / uIor);
        float depth = max(H + s.r, 0.0);
        vec3 P = vWPos + rd * (depth / max(-rd.y, 0.15));
        float Hp = texture2D(uShape, (P.xz - uOrigin) / uExtent).g;
        P = vWPos + rd * ((vWPos.y + Hp) / max(-rd.y, 0.15));
        vec2 refrUv = clamp(toScreen(P), 0.001, 0.999);
        // something above the surface at that pixel: refraction is invalid
        if (texture2D(uSceneDepth, refrUv).r < gl_FragCoord.z) refrUv = screenUv;
        float L = length(P - vWPos);

        vec3 col;
        float edgeBand = 0.004;
        if (uMode == 1) {
          // ── metal ──
          vec3 F = fresnelMetal(cosV, uMetalN, uMetalK);
          vec3 Fh = fresnelMetal(max(dot(V, Hv), 0.0), uMetalN, uMetalK);
          col = F * refl + uSunColor * Fh * min(D * geom, 80.0) * NdL;
          edgeBand = 0.0008;
        } else if (uMode == 2) {
          // ── opaque suspension ──
          // the small yield stress leaves the surface gently lumpy instead of
          // perfectly level: a soft, low-amplitude bump texture
          vec2 q = vWPos.xz * 9.0;
          float e = 0.05;
          float b = vnoise(q) + 0.5 * vnoise(q * 2.3 + 4.0);
          vec2 g = vec2(vnoise(q + vec2(e, 0.0)) + 0.5 * vnoise((q + vec2(e, 0.0)) * 2.3 + 4.0) - b,
                        vnoise(q + vec2(0.0, e)) + 0.5 * vnoise((q + vec2(0.0, e)) * 2.3 + 4.0) - b) / e;
          n = normalize(n + vec3(g.x, 0.0, g.y) * 0.025);
          cosV = clamp(dot(n, V), 0.0, 1.0);
          Hv = normalize(V + uSunDir);
          NdL = max(dot(n, uSunDir), 0.0);
          R = reflect(-V, n);
          rc = uReflMatrix * vec4(vWPos + R * 8.0, 1.0);
          refl = texture2D(uReflection, clamp(rc.xy / rc.w * 0.5 + 0.5, 0.001, 0.999)).rgb;
          geom = NdL / max(4.0 * NdL * cosV, 1e-3);
          // jammed where the solver says the strain rate is high right now, and
          // where a recent impact froze the surface: an impact sends a jamming
          // front out wider than the impactor (Waitukaitis & Jaeger 2012),
          // which then "melts" back to liquid over a fraction of a second
          float jam = s.a;
          for (int k = 0; k < 4; k++) {
            vec2 d = vWPos.xz - uJamMarks[k].xy;
            jam = max(jam, uJamMarks[k].w * exp(-dot(d, d) / (uJamMarks[k].z * uJamMarks[k].z)));
          }
          float rough = mix(uRoughness, 0.85, jam);
          // jammed grains poke through the surface: it turns matte, a touch
          // paler and grainy, and loses its wet reflection
          float grain = vnoise(vWPos.xz * 900.0) * jam;
          float F = fresnel(cosV, uIor) * (1.0 - 0.85 * jam);
          // soft wrap lighting: light scatters a little way into the cream
          float wrap = clamp((dot(n, uSunDir) + 0.3) / 1.3, 0.0, 1.0);
          vec3 diffuse = uAlbedo * (uSunColor * wrap * 0.28 + uAmbient * 0.42);
          diffuse *= 1.0 + 0.1 * jam - 0.12 * grain;
          float Ds = ggx(n, Hv, rough);
          vec3 spec = uSunColor * fresnel(max(dot(V, Hv), 0.0), uIor) * min(Ds * geom, 40.0) * NdL * (1.0 - 0.9 * jam);
          vec3 body = mix(diffuse, refl, min(F * 1.6, 1.0));
          // a film thinner than the scattering length shows the bed through it
          float T = exp(-uExtinction * depth);
          col = mix(body, texture2D(uSceneColor, refrUv).rgb, T) + spec;
        } else {
          // ── dielectric ──
          vec3 transmit = exp(-(uAbsorption + uTurbidity) * L);
          vec3 refr = texture2D(uSceneColor, refrUv).rgb * transmit
                    + uScatter * (uAmbient * 0.35 + uSunColor * 0.12) * (1.0 - exp(-uTurbidity * L));
          float F = fresnel(cosV, uIor);
          float spec = min(D * fresnel(max(dot(V, Hv), 0.0), uIor) * geom, 80.0);
          col = mix(refr, refl, F) + uSunColor * spec * NdL;
        }

        // ice skim: flat, pale and glassy, with white fracture lines where it
        // has been cracked; a sharp mirror sheen at grazing angles
        if (uIceOn > 0.5) {
          vec2 ic = texture2D(uIce, vUv).rg;
          // the ice texture lives on the simulation grid; its outline is
          // redrawn here per pixel so the edge never shows grid steps
          ic.r = min(smoothstep(0.0, 0.6, ic.r), iceBand(vWPos.xz, shp.r));
          if (ic.r > 0.01) {
            vec3 up = vec3(0.0, 1.0, 0.0);
            float cv = clamp(dot(up, V), 0.0, 1.0);
            vec4 rf = uReflMatrix * vec4(vWPos + reflect(-V, up) * 8.0, 1.0);
            vec3 flatRefl = texture2D(uReflection, clamp(rf.xy / rf.w * 0.5 + 0.5, 0.001, 0.999)).rgb;
            vec3 frost = vec3(0.84, 0.9, 0.96) * (uAmbient * 0.55 + uSunColor * max(uSunDir.y, 0.0) * 0.25);
            vec3 iceCol = mix(mix(direct, frost, 0.55), flatRefl, fresnel(cv, 1.31));
            vec3 v = voronoi(vWPos.xz * 22.0);
            float line = smoothstep(0.06, 0.0, v.y - v.x) * ic.g;
            iceCol = mix(iceCol, vec3(0.97, 0.99, 1.0) * (uAmbient * 0.8 + uSunColor * 0.2), line * 0.8);
            col = mix(col, iceCol, ic.r);
          }
        }

        // shoreline: the film thins to nothing, blend into the ground
        col = mix(col, direct, smoothstep(-edgeBand, 0.0015, sdf));
        gl_FragColor = vec4(col, 1.0);
      }`}),c=new w(a,s);c.frustumCulled=!1;function l(e){let t=e.optics,n=o;n.uMeniscus.value=0,n.uTurbidity.value.set(0,0,0),t.kind===`dielectric`?(n.uMode.value=0,n.uIor.value=t.ior,n.uAbsorption.value.set(...t.absorption),n.uRoughness.value=t.roughness,e.id===`water`&&(n.uTurbidity.value.set(2,2.6,3.4),n.uScatter.value.set(`#6f6a4c`)),e.id===`honey`&&(n.uTurbidity.value.set(6,6,6),n.uScatter.value.set(`#f0a02a`))):t.kind===`metal`?(n.uMode.value=1,n.uMetalN.value.set(...t.n),n.uMetalK.value.set(...t.k),n.uRoughness.value=t.roughness,n.uIor.value=1.5,n.uMeniscus.value=.008):(n.uMode.value=2,n.uAlbedo.value.setRGB(...t.albedo),n.uIor.value=t.ior,n.uExtinction.value=t.extinction,n.uRoughness.value=t.roughness)}return{mesh:c,uniforms:o,applyFluid:l}}var Xn={forest:0,sand:1,asphalt:2,tile:3,planks:4,park:5,granite:6,shore:7};function Zn(e,t,n,r){let i=new C({roughness:.95,metalness:0,envMapIntensity:.45});r&&(i.defines={BED:``}),i.customProgramCacheKey=()=>r?`puddle-bed`:`puddle-ground`;let a={uShape:{value:e.shapeTexture},uCaustics:{value:t},uWetMap:{value:n},uWetSize:{value:new h(...xt)},uStain:{value:new x(.5,.5,.5)},uWets:{value:1},uRingRough:{value:.78},uOrigin:{value:new h(...e.origin)},uExtent:{value:new h(...e.extent)},uStyle:{value:0},uA:{value:new g},uB:{value:new g},uC:{value:new g},uBed:{value:new g},uBedAccent:{value:new g},uSnow:{value:0},uLeaves:{value:0},uGrass:{value:new x(1,1,1)},uRain:{value:0},uPrints:{value:null},uPrintsArea:{value:new Qe(-8,-9,16,9)}};return i.onBeforeCompile=e=>{Object.assign(e.uniforms,a),e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
varying vec3 vWPos;`).replace(`#include <project_vertex>`,`#include <project_vertex>
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
        varying vec3 vWPos;
        uniform sampler2D uShape, uCaustics, uWetMap;
        uniform vec2 uOrigin, uExtent, uWetSize;
        uniform vec3 uStain, uA, uB, uC, uBed, uBedAccent, uGrass;
        uniform float uWets, uRingRough, uSnow, uLeaves, uRain;
        uniform sampler2D uPrints;
        uniform vec4 uPrintsArea;
        uniform int uStyle;
        ${qn}
        float gWet; float gGloss; float gSdf; vec2 gUv; float gSnow;

        // ── ground patterns, one per location ─────────────────────────────
        vec3 groundColor(vec2 p, float fine) {
          if (uStyle == 0) {            // forest: soft moss over earth, needle litter
            float m = fbm(p * 0.9);
            vec3 col = mix(uA, uB * uGrass, 0.55 + 0.45 * smoothstep(0.35, 0.7, m));
            return mix(col, uC, smoothstep(0.6, 0.85, fbm(p * 2.3 + 9.0)) * 0.35);
          } else if (uStyle == 1) {     // sand: wind ripples and darker patches
            float r = sin((p.x * 0.6 + p.y + fbm(p * 0.7) * 2.0) * 32.0) * 0.5 + 0.5;
            vec3 col = mix(uA, uB, smoothstep(0.3, 0.8, fbm(p * 0.6)) * 0.5);
            return col * (0.93 + 0.07 * r);
          } else if (uStyle == 2) {     // asphalt: aggregate speckle, tar patches, a lane line
            vec3 col = uA * (0.85 + 0.3 * vnoise(p * 140.0)) * (0.9 + 0.2 * fbm(p * 0.8));
            col = mix(col, uA * 0.6, smoothstep(0.65, 0.75, fbm(p * 1.7 + 3.0)) * 0.6);
            return col;
          } else if (uStyle == 3) {     // pool deck: square pavers with grout
            vec2 t = fract(p / 0.3);
            float grout = 1.0 - smoothstep(0.0, 0.02, min(min(t.x, t.y), min(1.0 - t.x, 1.0 - t.y)));
            vec3 col = uA * (0.92 + 0.12 * hash12(floor(p / 0.3)));
            return mix(col, uC, grout);
          } else if (uStyle == 4) {     // dock planks running along x
            float w = 0.14;
            float row = floor(p.y / w);
            float gap = 1.0 - smoothstep(0.0, 0.012, min(fract(p.y / w), 1.0 - fract(p.y / w)) * w);
            float grain = vnoise(vec2(p.x * 3.0, p.y * 60.0) + row * 7.0);
            vec3 col = mix(uA, uB, 0.3 + 0.5 * hash12(vec2(row, 1.0)) ) * (0.85 + 0.25 * grain);
            float knot = smoothstep(0.06, 0.0, length(vec2(fract(p.x * 0.7 + row * 0.37) - 0.5, (fract(p.y / w) - 0.5) * 0.3)));
            return mix(mix(col, uC * 0.8, knot * 0.5), uC * 0.35, gap);
          } else if (uStyle == 5) {     // park lawn
            float m = fbm(p * 0.5);
            vec3 col = mix(uA, uB, smoothstep(0.3, 0.7, m)) * uGrass;
            return col * (0.9 + 0.2 * vnoise(p * 60.0));
          } else if (uStyle == 6) {     // Canadian Shield granite: pink feldspar, quartz, biotite, lichen
            vec3 col = mix(uA, uB, smoothstep(0.35, 0.65, fbm(p * 1.2)));
            float g = vnoise(p * 180.0);
            col = mix(col, vec3(0.9, 0.88, 0.85), step(0.82, g) * 0.5);   // quartz
            col = mix(col, vec3(0.12), step(0.9, vnoise(p * 210.0 + 5.0)) * 0.6); // biotite
            float lichen = smoothstep(0.62, 0.7, fbm(p * 3.0 + 11.0));
            return mix(col, uC, lichen * 0.6);
          } else {                       // shoreline: small rounded pebbles in sand
            vec2 pw = vec2(vnoise(p * 12.0), vnoise(p * 12.0 + 3.0)) * 0.4;
            vec3 v = voronoi(p * 18.0 + pw);
            float peb = smoothstep(0.4, 0.28, v.x) * smoothstep(0.25, 0.6, fbm(p * 0.7));
            vec3 stone = mix(uA, uB, v.z) * (0.9 + 0.15 * fine);
            return mix(uC * (0.92 + 0.15 * fine), stone, peb * 0.75);
          }
        }
        vec3 bedColor(vec2 p, float fine) {
          if (uStyle == 3) {             // pool: small blue mosaic tiles
            vec2 t = fract(p / 0.025);
            float grout = 1.0 - smoothstep(0.0, 0.12, min(min(t.x, t.y), min(1.0 - t.x, 1.0 - t.y)));
            vec3 col = uBed * (0.85 + 0.3 * hash12(floor(p / 0.025)));
            return mix(col, uBedAccent, grout * 0.7);
          }
          if (uStyle == 4) return groundColor(p, fine) * 0.9;   // a puddle on the planks
          if (uStyle == 2) return groundColor(p, fine) * 0.95;  // on the asphalt
          // natural beds: silt with scattered, irregular gravel. Its texture is
          // what makes the refraction wobble visible.
          vec2 gw = vec2(vnoise(p * 30.0), vnoise(p * 30.0 + 7.0)) * 0.6;
          vec3 g = voronoi(p * 22.0 + gw);
          float gravel = smoothstep(0.34, 0.2, g.x) * step(0.55, g.z);
          vec3 b = uBed * (0.8 + 0.4 * vnoise(p * 14.0)) * (0.9 + 0.2 * fine);
          return mix(b, uBedAccent * (0.55 + 0.45 * g.z) * (0.85 + 0.3 * fine), gravel * 0.7);
        }`).replace(`#include <color_fragment>`,`#include <color_fragment>
        gUv = (vWPos.xz - uOrigin) / uExtent;
        bool inDomain = all(greaterThan(gUv, vec2(0.0))) && all(lessThan(gUv, vec2(1.0)));
        gSdf = inDomain ? texture2D(uShape, gUv).r : 1.0;
        // The bed mesh covers the simulation area plus a 0.5 m apron at ground
        // level; the big ground plane has a rectangular hole 0.25 m inside the
        // apron. Where they overlap both are flat at y = 0 and shaded by the
        // same code, so the seam is invisible and can never crack open.
        #ifndef BED
          if (all(greaterThan(vWPos.xz, uOrigin - 0.25)) && all(lessThan(vWPos.xz, uOrigin + uExtent + 0.25))) discard;
        #endif
        vec2 p = vWPos.xz;
        float fine = vnoise(p * 38.0) * 0.6 + vnoise(p * 90.0) * 0.4;
        vec3 col = groundColor(p, fine);
        // fallen leaves (autumn): scattered blots in warm colours
        if (uLeaves > 0.0) {
          // drifts of leaves: small, varied, gathered in patches
          float leafPatch = smoothstep(0.3, 0.7, fbm(p * 0.8 + 2.0));
          // fewer on swept surfaces (street, deck, dock) than on the ground
          float amt = uLeaves * ((uStyle == 2 || uStyle == 3 || uStyle == 4) ? 0.3 : 1.0);
          // each grid cell may hold one leaf: random position, angle, size
          // and colour; the shape is an ellipse pinched to a point at both
          // ends, with a darker midrib
          vec2 lp = p * 14.0;
          vec2 cell = floor(lp);
          float leaf = 0.0, rib = 0.0;
          vec3 lc = vec3(0.0);
          for (int j = -1; j <= 1; j++)
          for (int i = -1; i <= 1; i++) {
            vec2 c = cell + vec2(float(i), float(j));
            float h = hash12(c);
            if (h > amt * (0.25 + 0.85 * leafPatch)) continue;
            float h2 = hash12(c + 17.3), h3 = hash12(c + 41.9);
            vec2 q = lp - c - vec2(hash12(c + 3.1), hash12(c + 8.7));
            float a = h2 * 6.2832;
            q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
            float L = 0.38 + 0.22 * h3;               // half-length (cells)
            float w = L * (0.42 + 0.12 * h2) * (1.0 - smoothstep(0.2, 1.0, abs(q.x) / L) * 0.85);
            float inside = smoothstep(0.03, 0.0, abs(q.y) - w) * step(abs(q.x), L);
            if (inside > leaf) {
              leaf = inside;
              rib = smoothstep(0.035, 0.0, abs(q.y)) * step(abs(q.x), L * 0.9);
              // maple red, burnt orange, ochre, faded brown
              float t = fract(h3 * 7.3);
              lc = t < 0.25 ? vec3(0.58, 0.15, 0.07) : t < 0.55 ? vec3(0.72, 0.32, 0.08) : t < 0.8 ? vec3(0.7, 0.48, 0.12) : vec3(0.38, 0.23, 0.12);
              lc *= 0.75 + 0.3 * hash12(c + 5.5);
            }
          }
          // far away a leaf is smaller than a few pixels: blend toward the
          // average colour of the litter instead of shimmering
          float far = smoothstep(0.06, 0.2, length(fwidth(lp)));
          vec3 nearCol = mix(col, mix(lc, lc * 0.6, rib * 0.5), leaf);
          float cover = clamp(amt * (0.25 + 0.85 * leafPatch), 0.0, 1.0) * 0.4;
          col = mix(nearCol, mix(col, vec3(0.6, 0.31, 0.1), cover), far);
        }
        col *= 0.88 + 0.24 * fine;
        float underwater = 1.0 - smoothstep(-0.03, 0.0, gSdf);
        col = mix(col, bedColor(p, fine), underwater);
        // wet ring: width varies along the edge
        float ring = 0.035 + 0.06 * vnoise(p * 4.0);
        gWet = (1.0 - smoothstep(0.0, ring, gSdf)) * uWets;
        // splashes that landed on the ground (drying over time)
        vec2 wuv = vec2(vWPos.x / uWetSize.x + 0.5, 0.5 - vWPos.z / uWetSize.y);
        if (all(greaterThan(wuv, vec2(0.0))) && all(lessThan(wuv, vec2(1.0))))
          gWet = max(gWet, texture2D(uWetMap, wuv).r * 0.9);
        // rain wets everything
        gWet = max(gWet, uRain * 0.85);
        // Under water there is no air–film sheen: the stone–water interface
        // reflects very little, so the glossiness applies only above water.
        gGloss = gWet * smoothstep(-0.004, 0.004, gSdf);
        col *= mix(vec3(1.0), uStain, gWet);
        // snow cover: thinner near the water (meltwater) and patchy at the edges
        gSnow = uSnow * smoothstep(0.05, 0.25, gSdf) * smoothstep(0.25, 0.45, fbm(p * 1.5) + uSnow * 0.5);
        // footprints pressed into the snow: shadowed blue-grey hollows
        vec2 puv = vec2((vWPos.x - uPrintsArea.x) / uPrintsArea.z, (uPrintsArea.y + uPrintsArea.w - vWPos.z) / uPrintsArea.w);
        float pr = 0.0;
        if (gSnow > 0.0 && all(greaterThan(puv, vec2(0.0))) && all(lessThan(puv, vec2(1.0)))) pr = texture2D(uPrints, puv).r;
        col = mix(col, vec3(0.93, 0.95, 0.98) * (0.94 + 0.06 * fine), gSnow);
        col = mix(col, vec3(0.62, 0.68, 0.8), pr * gSnow * 0.7);
        diffuseColor.rgb = min(col, vec3(1.0));`).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, uRingRough, gGloss);
        roughnessFactor = mix(roughnessFactor, 0.7, gSnow);`).replace(`#include <lights_fragment_end>`,`#include <lights_fragment_end>
        #ifdef BED
          // caustics only modulate direct sunlight on the bed
          reflectedLight.directDiffuse *= mix(vec3(1.0), texture2D(uCaustics, gUv).rgb, step(gSdf, 0.0));
        #endif`)},i.userData.uniforms=a,i}function Qn(e,t,n,r){let i=e.userData.uniforms;i.uStain.value.set(...t),i.uWets.value=+!!n,i.uRingRough.value=r}function $n(e,t){e.userData.uniforms.uPrints.value=t}function er(e,t){let n=e.userData.uniforms;n.uStyle.value=Xn[t.style],n.uA.value.set(t.a),n.uB.value.set(t.b),n.uC.value.set(t.c),n.uBed.value.set(t.bed),n.uBedAccent.value.set(t.bedAccent)}function tr(e,t,n){let r=e.userData.uniforms;r.uSnow.value=t.snow,r.uLeaves.value=t.leaves,r.uGrass.value.set(...t.grass),r.uRain.value=n}function nr(e){let t=new S(6e3,6e3,120,120);t.rotateX(-Math.PI/2);let n=new w(t,e);return n.receiveShadow=!0,n}function rr(e,t,n,r,i){let a=Math.max(0,Math.min(t-2,Math.floor(r))),o=Math.max(0,Math.min(n-2,Math.floor(i))),s=Math.max(0,Math.min(1,r-a)),c=Math.max(0,Math.min(1,i-o)),l=(n,r)=>e[(r*t+n)*4];return(l(a,o)*(1-s)+l(a+1,o)*s)*(1-c)+(l(a,o+1)*(1-s)+l(a+1,o+1)*s)*c}var ir=.5;function ar(e,t){let{nx:n,nz:r}=e.grid,[i,a]=e.origin,[o,s]=e.extent,c=o+2*ir,l=s+2*ir,u=Math.ceil(c/.009),d=Math.ceil(l/.009),f=new S(c,l,u,d);f.rotateX(-Math.PI/2);let p=new w(f,t);p.receiveShadow=!0;let m=()=>{let t=f.attributes.position,c=e.shape.data;for(let e=0;e<t.count;e++){let l=t.getX(e),u=t.getZ(e);t.setY(e,-rr(c,n,r,(l-i)/o*n-.5,(u-a)/s*r-.5))}t.needsUpdate=!0,f.computeVertexNormals()};return m(),{mesh:p,update:m}}function or(e,t){let n=t<1,r=n?64:55,i=n?12:10,a=n?-.1:-.06,o=new Fe(r,t,.05,1e3);o.rotation.set(-E.degToRad(i),0,0);let s=e.filter((e,t)=>t%8==0).map(([e,t])=>new x(e,0,t)),c=new x,l={score:1/0,pos:new x};for(let e=.4;e<=6;e+=.04)for(let t=0;t<=8;t+=.04){o.position.set(0,e,t),o.updateMatrixWorld();let r=1/0,i=-1/0,u=1/0,d=-1/0,f=!1;for(let e of s){if(c.copy(e).project(o),c.z>1||c.z<-1){f=!0;break}r=Math.min(r,c.x),i=Math.max(i,c.x),u=Math.min(u,c.y),d=Math.max(d,c.y)}if(f)continue;let p=n?1.4:.97,m=Math.max(0,i-p,-p-r),h=(u+.9)**2+(d-a)**2+m*m*50;h<l.score&&(l={score:h,pos:o.position.clone()})}let u=new x(0,0,-1).applyEuler(o.rotation);return{position:l.pos,target:l.pos.clone().add(u),fov:r}}var sr=160,cr=10;function lr(e,t,n){let r=new a,i=new Ee(new x(0,1,0),0),o=new x,s=new Map,c=t=>{let n=e.getBoundingClientRect();return new h((t.clientX-n.left)/n.width*2-1,-((t.clientY-n.top)/n.height)*2+1)},l=e=>(r.setFromCamera(c(e),t),r.ray.intersectPlane(i,o)?o:null);e.addEventListener(`pointerdown`,t=>{if(t.preventDefault(),n.onPressAnywhere?.())return;if(e.setPointerCapture(t.pointerId),n.onPickDown?.(t.pointerId,c(t))){s.set(t.pointerId,{x:0,z:0,t:t.timeStamp,sx:t.clientX,sy:t.clientY,state:`carry`,t0:t.timeStamp,ground:new x});return}let r=l(t);if(!r)return;let i={x:r.x,z:r.z,t:t.timeStamp,sx:t.clientX,sy:t.clientY,state:`stir`,t0:t.timeStamp,ground:r.clone()};s.set(t.pointerId,i);let a=n.mode();a===`skip`?i.state=`flick`:a===`fish`?(n.isWater(r.x,r.z)?n.onCast(r.x,r.z):n.onReel(),i.state=`carry`):n.isWater(r.x,r.z)&&(n.canHold()?(i.state=`pending`,i.timer=window.setTimeout(()=>{i.state===`pending`&&(i.state=`hold`,n.onHoldStart(t.pointerId,i.x,i.z))},sr)):n.onSlap(r.x,r.z))}),e.addEventListener(`pointermove`,e=>{let t=s.get(e.pointerId);if(!t)return;if(t.state===`carry`){n.onCarryMove?.(e.pointerId,c(e));return}if(t.state===`flick`)return;t.state===`pending`&&Math.hypot(e.clientX-t.sx,e.clientY-t.sy)>cr&&(t.state=`stir`,clearTimeout(t.timer));let r=e.getCoalescedEvents?.()??[e];for(let i of r.length?r:[e]){let r=l(i);if(!r)continue;let a=Math.max((i.timeStamp-t.t)/1e3,1/240);t.state===`stir`&&(n.isWater(r.x,r.z)||n.isWater(t.x,t.z))&&n.onStir(t.x,t.z,r.x,r.z,a),t.state===`hold`&&n.onHoldMove(e.pointerId,r.x,r.z),t.x=r.x,t.z=r.z,t.t=i.timeStamp}});let u=e=>{let t=s.get(e.pointerId);if(t){if(clearTimeout(t.timer),t.state===`pending`&&n.onSlap(t.x,t.z),t.state===`hold`&&n.onHoldEnd(e.pointerId),t.state===`carry`&&n.onCarryEnd?.(e.pointerId,e.clientX,e.clientY),t.state===`flick`){let r=e.clientX-t.sx,i=e.clientY-t.sy,a=e.timeStamp-t.t0;Math.hypot(r,i)>30&&a<700?n.onFlick(r,i,a,t.ground):n.isWater(t.x,t.z)&&n.onSlap(t.x,t.z)}s.delete(e.pointerId)}};e.addEventListener(`pointerup`,u),e.addEventListener(`pointercancel`,u),e.addEventListener(`contextmenu`,e=>e.preventDefault()),e.addEventListener(`touchstart`,e=>e.preventDefault(),{passive:!1})}new g(`#6d9bd1`),new g(`#f6dcc0`),new g(`#c8d6dc`),new g(`#ffe6c2`),E.degToRad(24),E.degToRad(-58),new g(`#c4dbf0`),new g(`#6b6a48`),new g(`#fff4ea`);function ur(e,t=new x){let n=Math.cos(e.sunElevation);return t.set(Math.sin(e.sunAzimuth)*n,Math.sin(e.sunElevation),-Math.cos(e.sunAzimuth)*n).normalize()}function dr(e){let t={uTop:{value:e.skyTop.clone()},uHorizon:{value:e.skyHorizon.clone()},uSunDir:{value:ur(e)},uSunColor:{value:e.sunColor.clone()},uCloud:{value:e.cloudColor.clone()},uCloudAmount:{value:e.cloudAmount},uNight:{value:0},uOvercast:{value:0},uTime:{value:0}},n=new y({side:1,depthWrite:!1,fog:!1,uniforms:t,vertexShader:`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // always at the far plane
      }`,fragmentShader:`
      uniform vec3 uTop, uHorizon, uSunDir, uSunColor, uCloud;
      uniform float uCloudAmount, uNight, uOvercast, uTime;
      varying vec3 vDir;
      ${qn}
      void main() {
        vec3 d = normalize(vDir);
        float y = max(d.y, 0.0);
        float s = max(dot(d, uSunDir), 0.0);
        // gradient: horizon band warmed toward the sun
        vec3 horizon = mix(uHorizon, uHorizon * vec3(1.08, 0.98, 0.9), pow(s, 4.0) * (1.0 - uNight));
        vec3 col = mix(horizon, uTop, pow(smoothstep(0.0, 0.4, y), 0.6));
        if (d.y < 0.0) col = horizon;
        // stars: sparse hashed points, twinkling, fading toward the horizon
        if (uNight > 0.0) {
          vec2 sp = d.xz / max(d.y + 0.15, 0.05) * 140.0;
          vec2 cell = floor(sp);
          float h = hash12(cell);
          vec2 o = hash22(cell) - 0.5;
          float star = smoothstep(0.08, 0.0, length(fract(sp) - 0.5 - o * 0.6)) * step(0.985, h);
          star *= 0.6 + 0.4 * sin(uTime * (1.5 + 3.0 * h) + h * 40.0);
          col += vec3(0.9, 0.95, 1.0) * star * uNight * smoothstep(0.05, 0.3, y) * (1.0 - uOvercast);
        }
        // soft stratus streaks, projected on a high flat layer
        vec2 cp = d.xz / max(d.y + 0.08, 0.02) * 0.6;
        float c = fbm(cp * vec2(0.6, 2.2) + vec2(3.0 + uTime * 0.004, 1.0));
        c = smoothstep(0.62 - 0.3 * uCloudAmount, 0.95, c) * smoothstep(0.0, 0.12, d.y) * (1.0 - smoothstep(0.35, 0.8, d.y));
        col = mix(col, uCloud * (1.0 + 0.5 * pow(s, 3.0)), c * 0.55 * (1.0 - uOvercast));
        // sun by day (HDR disc that blooms) or a small, cool moon by night
        float disc = mix(smoothstep(0.9994, 0.9997, s) * 30.0, smoothstep(0.99955, 0.9997, s) * 6.0, uNight);
        float glow = mix(pow(s, 64.0) * 0.6 + pow(s, 6.0) * 0.18, pow(s, 200.0) * 0.4, uNight);
        col += uSunColor * (disc + glow) * (1.0 - 0.9 * uOvercast);
        gl_FragColor = vec4(col, 1.0);
      }`}),r=new w(new _(500,48,24),n);return r.frustumCulled=!1,r.renderOrder=-1e3,{mesh:r,uniforms:t}}var fr=class{renderer;scene;sky;sun=new Ze;hemi=new f;sunDir=new x(0,1,0);mood;pmrem;envSky;envScene=new s;envRT=null;constructor(e,t,n,r){this.renderer=e,this.scene=t,this.mood=n,this.sky=dr(n),this.envSky=dr(n),this.sky.mesh.layers.enable(1),t.add(this.sky.mesh);let i=this.sun;i.castShadow=!0,i.shadow.mapSize.set(r,r);let a=i.shadow.camera;a.left=-22,a.right=22,a.top=22,a.bottom=-22,a.near=1,a.far=120,i.shadow.bias=-4e-4,i.shadow.normalBias=.02,i.layers.enable(1),this.hemi.layers.enable(1),t.add(i,i.target,this.hemi),t.fog=new l(n.haze,n.fogNear,n.fogFar),this.pmrem=new ae(e),this.envScene.add(this.envSky.mesh),this.apply(n)}apply(e){this.mood=e,ur(e,this.sunDir);for(let t of[this.sky.uniforms,this.envSky.uniforms])t.uTop.value.copy(e.skyTop),t.uHorizon.value.copy(e.skyHorizon),t.uSunDir.value.copy(this.sunDir),t.uSunColor.value.copy(e.sunColor),t.uCloud.value.copy(e.cloudColor),t.uCloudAmount.value=e.cloudAmount,t.uNight.value=e.night,t.uOvercast.value=e.overcast;this.sun.color.copy(e.sunColor),this.sun.intensity=e.sunIntensity,this.sun.position.copy(this.sunDir).multiplyScalar(60),this.sun.castShadow=e.overcast<.5,this.hemi.color.copy(e.hemiSky),this.hemi.groundColor.copy(e.hemiGround),this.hemi.intensity=e.hemiIntensity;let t=this.scene.fog;t.color.copy(e.haze),t.near=e.fogNear,t.far=e.fogFar,this.renderer.toneMappingExposure=e.exposure,this.envRT?.dispose(),this.envRT=this.pmrem.fromScene(this.envScene,.02),this.scene.environment=this.envRT.texture,this.scene.environmentIntensity=.6*(1-.6*e.night)}update(e){this.sky.uniforms.uTime.value=e}},pr=`modulepreload`,mr=function(e){return`/puddle/`+e},hr={},gr=function(e){return e.pathname.endsWith(`.css`)},_r=function(e,t,n){if(t in e)return e[t];let r=n();if(!r){e[t]=void 0;return}let i=r.then(()=>{e[t]=void 0},n=>{throw e[t]=void 0,n});return e[t]=i,i},N=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e,i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?new URL(import.meta.resolve(e)):new URL(e,import.meta.url)}r=o(t.map(t=>{t=mr(t,n);let r=s(t),i=gr(r);return _r(hr,r.href,()=>{if(e===void 0){e={all:new Set,styles:new Set};let t=document.getElementsByTagName(`link`);for(let n=t.length-1;n>=0;n--){let r=t[n];e.all.add(r.href),r.rel===`stylesheet`&&e.styles.add(r.href)}}if((i?e.styles:e.all).has(r.href))return;let t=document.createElement(`link`);if(t.rel=i?`stylesheet`:pr,i||(t.as=`script`),t.crossOrigin=``,t.href=r.href,a&&t.setAttribute(`nonce`,a),document.head.appendChild(t),i)return new Promise((e,n)=>{t.addEventListener(`load`,e),t.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${r}`)))})})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},vr=[[`forest`,`Forest`],[`beach`,`Beach`],[`city`,`City street`],[`backyard`,`Backyard pool`],[`dock`,`Cottage dock`],[`highpark`,`High Park`],[`lionsgate`,`Lions Gate`],[`algonquin`,`Algonquin`]],yr={forest:()=>N(()=>import(`./forest-CiIavrkb.js`),__vite__mapDeps([0,1])),beach:()=>N(()=>import(`./beach-B-YUSv2V.js`),__vite__mapDeps([2,1])),city:()=>N(()=>import(`./city-d74cJSU1.js`),__vite__mapDeps([3,1])),backyard:()=>N(()=>import(`./backyard-BYdCulm2.js`),__vite__mapDeps([4,1])),dock:()=>N(()=>import(`./dock-CV6H0io3.js`),__vite__mapDeps([5,1])),highpark:()=>N(()=>import(`./highpark-CWtnBYID.js`),__vite__mapDeps([6,1])),lionsgate:()=>N(()=>import(`./lionsgate-BtxsEJfZ.js`),__vite__mapDeps([7,1])),algonquin:()=>N(()=>import(`./algonquin-BwXQs1nl.js`),__vite__mapDeps([8,1]))},P=e=>new g(e),F=E.degToRad,br={sunrise:{skyTop:P(`#7486c0`),skyHorizon:P(`#f7c4a6`),haze:P(`#dcc6c4`),sunColor:P(`#ffc79e`),sunIntensity:2.4,sunElevation:F(7),sunAzimuth:F(55),hemiSky:P(`#c8c4df`),hemiGround:P(`#6a5c52`),hemiIntensity:1.15,cloudColor:P(`#ffd9c4`),cloudAmount:.5,night:0,overcast:0,fogNear:20,fogFar:230,exposure:1},day:{skyTop:P(`#6d9bd1`),skyHorizon:P(`#f6dcc0`),haze:P(`#c8d6dc`),sunColor:P(`#ffe6c2`),sunIntensity:3.6,sunElevation:F(24),sunAzimuth:F(-58),hemiSky:P(`#c4dbf0`),hemiGround:P(`#6b6a48`),hemiIntensity:1.5,cloudColor:P(`#fff4ea`),cloudAmount:.45,night:0,overcast:0,fogNear:25,fogFar:260,exposure:1},sunset:{skyTop:P(`#55619e`),skyHorizon:P(`#f7a473`),haze:P(`#e0ad9a`),sunColor:P(`#ff9b5e`),sunIntensity:2.7,sunElevation:F(4),sunAzimuth:F(-18),hemiSky:P(`#b7a9cf`),hemiGround:P(`#5c4a42`),hemiIntensity:1.05,cloudColor:P(`#ffb98f`),cloudAmount:.55,night:0,overcast:0,fogNear:20,fogFar:230,exposure:1},night:{skyTop:P(`#0a1430`),skyHorizon:P(`#1f2d4f`),haze:P(`#1b2540`),sunColor:P(`#a9bce6`),sunIntensity:.55,sunElevation:F(38),sunAzimuth:F(28),hemiSky:P(`#36497a`),hemiGround:P(`#1a1c24`),hemiIntensity:.55,cloudColor:P(`#3a4566`),cloudAmount:.3,night:1,overcast:0,fogNear:15,fogFar:200,exposure:1.15}};function xr(e){let t={...e};for(let e of Object.keys(t)){let n=t[e];n instanceof g&&(t[e]=n.clone())}return t}function Sr(e,t,n){let r=xr(br[e]);if(t===`rain`||t===`snow`){let n=P(t===`rain`?`#8f99a4`:`#c3cad4`),i=e===`night`?.35:.72;for(let t of[r.skyTop,r.skyHorizon,r.haze,r.cloudColor])t.lerp(e===`night`?n.clone().multiplyScalar(.25):n,i);r.sunIntensity*=.22,r.hemiSky.lerp(n,.5),r.hemiIntensity*=t===`snow`?1.05:.85,r.cloudAmount=1,r.overcast=1,r.fogNear*=.5,r.fogFar*=t===`snow`?.45:.6}else t===`wind`&&(r.cloudAmount=Math.min(1,r.cloudAmount+.3),r.overcast=.25);return n===`winter`?(r.hemiGround.lerp(P(`#c9ced6`),.6),r.haze.lerp(P(`#cfd8e2`),.25),r.sunIntensity*=.9):n===`autumn`?(r.haze.lerp(P(`#d8c4ac`),.2),r.hemiGround.lerp(P(`#7a5a3a`),.3)):n===`spring`&&r.haze.lerp(P(`#d3e0d6`),.15),r}function Cr(e){let t=e%2147483647;return t<=0&&(t+=2147483646),()=>(t=t*16807%2147483647,(t-1)/2147483646)}function wr(e,t,n,r){return new g(e).lerp(t,1-Math.exp(-n/r))}function Tr(e){return e.layers.enable(1),e}function Er(e,t){let n=new g(t),r=e.attributes.position.count,i=new Float32Array(r*3);for(let e=0;e<r;e++)n.toArray(i,e*3);return e.setAttribute(`color`,new o(i,3)),e.deleteAttribute(`uv`),e.index?e.toNonIndexed():e}var Dr=Er;function Or(e){let n=Cr(e.seed),r=1400,i=new Float32Array(1401),a=[n()*10,n()*10,n()*10],o=100/Math.abs(e.z);for(let t=0;t<=r;t++){let n=(t/r-.5)*e.width,s=n*o;i[t]=e.base+e.hill*(.5+.3*Math.sin(s*.011+a[0])+.2*Math.sin(s*.031+a[1])+.08*Math.sin(s*.09+a[2])),e.extra&&(i[t]+=e.extra(n+(e.x??0)))}let s=i.slice(),c=Math.round(e.width*(e.treeDensity??0));for(let t=0;t<c;t++){let t=(n()-.5)*e.width,a=(e.treeH??0)*(.7+.45*n()),o=a*(e.pointy?.5+.15*n():2.5+1.5*n()),c=Math.floor(((t-o/2)/e.width+.5)*r),l=Math.ceil(((t+o/2)/e.width+.5)*r),u=Math.round((t/e.width+.5)*r),d=s[Math.max(0,Math.min(r,u))]-a*.15;for(let n=Math.max(0,c);n<=Math.min(r,l);n++){let s=(n/r-.5)*e.width,c=1-Math.abs(s-t)/(o/2);if(c<=0)continue;let l=e.pointy?c*(1-.1*(c*4%1)):Math.sqrt(c*(2-c));i[n]=Math.max(i[n],d+a*l)}}let l=new Me;l.moveTo(-e.width/2,-40);for(let t=0;t<=r;t++)l.lineTo((t/r-.5)*e.width,i[t]);l.lineTo(e.width/2,-40);let u=new t(l),d=new y({fog:!1,side:2,uniforms:{uColor:{value:e.color},uHaze:{value:e.haze},uMistTop:{value:e.base+e.hill*.4},uMist:{value:e.mist}},vertexShader:`
      varying float vY;
      void main() {
        vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,fragmentShader:`
      uniform vec3 uColor, uHaze;
      uniform float uMistTop, uMist;
      varying float vY;
      void main() {
        // valley mist: each layer fades toward the haze colour at its foot
        float m = (1.0 - smoothstep(0.0, uMistTop, vY)) * uMist;
        gl_FragColor = vec4(mix(uColor, uHaze, m), 1.0);
      }`}),f=new w(u,d);return f.position.set(e.x??0,0,e.z),Tr(f)}var kr={time:{value:0},strength:{value:.02}};function Ar(e){return e.onBeforeCompile=e=>{e.uniforms.uSwayT=kr.time,e.uniforms.uSwayK=kr.strength,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
uniform float uSwayT, uSwayK;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 wpos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #else
            vec3 wpos = vec3(0.0);
          #endif
          float hgt = max(transformed.y, 0.0);
          float ph = wpos.x * 0.37 + wpos.z * 0.23;
          transformed.x += uSwayK * hgt * hgt * (sin(uSwayT * 1.3 + ph) + 0.35 * sin(uSwayT * 3.1 + ph * 1.7));
          transformed.z += uSwayK * 0.5 * hgt * hgt * sin(uSwayT * 1.1 + ph * 0.8);
        }`)},e.customProgramCacheKey=()=>`sway`,e}function jr(e,t){let n=Cr(e),r=[],i=new c(.03,.06,1,6);i.translate(0,.5,0),r.push(Er(i,`#4a3526`));for(let e=0;e<7;e++){let i=e/7,a=.62*(1-i*.85)*(.9+.2*n()),o=1*(1-i*.4),s=new b(a,o,7,3,!0);s.rotateY(n()*Math.PI);let c=new g(`#2f4a2c`).multiplyScalar(.85+.25*i),l=Er(s,c);if(t){let e=l.attributes.position,t=l.attributes.color,n=new g(.9,.93,.96),r=new g;for(let i=0;i<t.count;i++){let a=e.getY(i)/o+.5,s=E.smoothstep(a,.3,.85)*.9;r.copy(c).lerp(n,s),t.setXYZ(i,r.r,r.g,r.b)}}l.translate(0,.35+i*3.3+o/2,0),r.push(l)}let a=ln(r);return a.computeVertexNormals(),a}function Mr(e,t,n=1){let r=t===`winter`,i=Ar(new C({vertexColors:!0,flatShading:!0,roughness:.9,side:2})),a=[jr(3+n,r),jr(8+n,r),jr(15+n,r)],o=new p,s=new _e,c=new ve,l=Cr(n*31+7);return a.forEach((t,n)=>{let r=e.filter((e,t)=>t%3===n),a=new re(t,i,Math.max(r.length,1));r.forEach(([e,t,n],r)=>{let i=n/4.3;c.setFromAxisAngle(new x(0,1,0),l()*Math.PI*2),s.compose(new x(e,0,t),c,new x(i*(.85+.3*l()),i,i*(.85+.3*l()))),a.setMatrixAt(r,s)}),a.count=r.length,a.castShadow=!0,a.receiveShadow=!0,a.frustumCulled=!1,o.add(Tr(a))}),o}var Nr={spring:[`#8cbf5a`,`#9fcb6a`,`#f2c6d6`,`#7fb24a`],summer:[`#4f7f36`,`#5d8c3c`,`#46732f`,`#5a8a3a`],autumn:[`#d9832b`,`#c4521f`,`#e6b13a`,`#b8442a`],winter:[]};function Pr(e,t){let n=Cr(e),r=[],i=new c(.06,.11,1.6,7);i.translate(0,.8,0),r.push(Er(i,`#5a4636`));for(let e=0;e<4;e++){let e=new c(.02,.045,1.1,5);e.translate(0,.55,0),e.rotateZ((n()-.5)*1.2),e.rotateY(n()*Math.PI*2),e.translate(0,1.4+n()*.4,0),r.push(Er(e,`#5a4636`))}let a=Nr[t];if(a.length)for(let e=0;e<7;e++){let e=new pe(.55+n()*.35,2);e.deleteAttribute(`normal`),e.deleteAttribute(`uv`),e=dn(e),e.translate((n()-.5)*1.3,2.1+n()*1,(n()-.5)*1.3),e.computeVertexNormals(),r.push(Er(e,a[Math.floor(n()*a.length)]))}let o=ln(r);return o.computeVertexNormals(),o}function Fr(e,t,n=1){let r=Ar(new C({vertexColors:!0,roughness:.85})),i=new p,a=Cr(n*13+5),o=[Pr(n+2,t),Pr(n+9,t)],s=new _e,c=new ve;return o.forEach((t,n)=>{let o=e.filter((e,t)=>t%2===n),l=new re(t,r,Math.max(o.length,1));o.forEach(([e,t,n],r)=>{let i=n/3.4;c.setFromAxisAngle(new x(0,1,0),a()*Math.PI*2),s.compose(new x(e,0,t),c,new x(i,i,i)),l.setMatrixAt(r,s)}),l.count=o.length,l.castShadow=!0,l.receiveShadow=!0,l.frustumCulled=!1,i.add(Tr(l))}),i}function Ir(e,t=`#8a877f`,n=`#617a34`,r=1){let i=Cr(e),a=new pe(1,5);a.deleteAttribute(`normal`),a.deleteAttribute(`uv`),a=dn(a);let s=a.attributes.position,c=new x,l=[i()*9,i()*9,i()*9,i()*9],u=.55+.15*i(),d=1+.35*i();for(let e=0;e<s.count;e++){c.fromBufferAttribute(s,e);let t=1+.16*Math.sin(c.x*1.5+l[0])*Math.sin(c.z*1.7+l[1])+.07*Math.sin(c.y*2.4+l[2])*Math.sin(c.x*2.1+l[3])+.1*Math.max(0,c.x*Math.cos(l[0])+c.z*Math.sin(l[0]));c.multiplyScalar(t),c.x*=d,c.y*=u,s.setXYZ(e,c.x,c.y,c.z)}a.computeVertexNormals();let f=a.attributes.normal,p=new Float32Array(f.count*3),m=new g(t),h=new g(n),_=new g,ee=.72+.12*i();for(let e=0;e<f.count;e++){let t=f.getY(e)+.25*s.getY(e);_.copy(m).lerp(h,E.smoothstep(t,ee,ee+.18)*.9*r),_.toArray(p,e*3)}return a.setAttribute(`color`,new o(p,3)),a}function Lr(e,t,n={}){let r=new p,i=new C({vertexColors:!0,roughness:.88});for(let[a,o,s,c]of e){let e=a,l=o,u=Math.hypot(e,l)||1;for(let n=0;n<60&&t(e,l)<s*1.05;n++)e+=a/u*.03,l+=o/u*.03;let d=new w(Ir(c,n.stone,n.snow?`#e8edf2`:n.moss,n.snow?1.2:n.mossAmount??1),i);d.scale.setScalar(s),d.position.set(e,-s*.2,l),d.rotation.y=c,d.castShadow=!0,d.receiveShadow=!0,r.add(Tr(d))}return r}function Rr(e,t,n,r,a={}){let o=new S(e.w,e.d,Math.ceil(e.w/25),Math.ceil(e.d/25));o.rotateX(-Math.PI/2);let s=new y({fog:!0,uniforms:d.merge([i.fog,{uRefl:{value:null},uReflMatrix:{value:new _e},uDeep:{value:new g(n)},uWaves:{value:a.waves??1},uIce:{value:+!!a.ice},uHoles:{value:[0,1,2].map(e=>new Qe(...a.holes?.[e]??[0,0,0,0]))}}]),vertexShader:`
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,fragmentShader:`
      #include <fog_pars_fragment>
      uniform sampler2D uRefl;
      uniform mat4 uReflMatrix;
      uniform vec3 uDeep;
      uniform float uTime, uWaves, uIce;
      uniform vec4 uHoles[3];
      varying vec3 vW;
      ${qn}
      void main() {
        vec2 p = vW.xz;
        for (int k = 0; k < 3; k++)
          if (p.x > uHoles[k].x && p.x < uHoles[k].z && p.y > uHoles[k].y && p.y < uHoles[k].w) discard;
        float e = 0.15;
        float t = uTime * 0.6;
        float h0 = vnoise(p * 0.8 + vec2(t, t * 0.6)) + 0.5 * vnoise(p * 2.1 - vec2(t * 0.8, 0.0));
        float hx = vnoise((p + vec2(e, 0.0)) * 0.8 + vec2(t, t * 0.6)) + 0.5 * vnoise((p + vec2(e, 0.0)) * 2.1 - vec2(t * 0.8, 0.0));
        float hz = vnoise((p + vec2(0.0, e)) * 0.8 + vec2(t, t * 0.6)) + 0.5 * vnoise((p + vec2(0.0, e)) * 2.1 - vec2(t * 0.8, 0.0));
        vec3 n = normalize(vec3(-(hx - h0) / e * 0.06 * uWaves * (1.0 - uIce), 1.0, -(hz - h0) / e * 0.06 * uWaves * (1.0 - uIce)));
        vec3 V = normalize(cameraPosition - vW);
        vec3 R = reflect(-V, n);
        vec4 rc = uReflMatrix * vec4(vW + R * 30.0, 1.0);
        vec3 refl = texture2D(uRefl, clamp(rc.xy / rc.w * 0.5 + 0.5, 0.001, 0.999)).rgb;
        float cosV = clamp(dot(n, V), 0.0, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
        vec3 col = mix(uDeep, refl, F);
        if (uIce > 0.5) col = mix(vec3(0.82, 0.88, 0.94), refl, F * 0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`});s.uniforms.uTime=r.time,s.polygonOffset=!0,s.polygonOffsetFactor=-2,s.polygonOffsetUnits=-2;let c=new w(o,s);return c.position.y=t,c.onBeforeRender=()=>{s.uniforms.uRefl.value=r.reflection.texture,s.uniforms.uReflMatrix.value.copy(r.reflection.matrix)},c}var zr=1.204,Br=class{bounds;isWater;onRaindrop;kind=`clear`;wind=new h;rain;rainPos;snow;snowPos;gusts=[];rainDebt=0;t=0;N_RAIN;N_SNOW;constructor(e,t,n,r,i){this.bounds=t,this.isWater=n,this.onRaindrop=r,this.N_RAIN=i?500:1200,this.N_SNOW=i?500:1100,this.rainPos=new Float32Array(this.N_RAIN*6);let a=new v;a.setAttribute(`position`,new o(this.rainPos,3)),this.rain=new Ue(a,new Se({color:`#dfe7ef`,transparent:!0,opacity:.32,depthWrite:!1})),this.rain.frustumCulled=!1,this.rain.visible=!1,this.snowPos=new Float32Array(this.N_SNOW*3);let s=new v;s.setAttribute(`position`,new o(this.snowPos,3)),this.snow=new Ge(s,new Xe({color:`#ffffff`,size:.035,transparent:!0,opacity:.9,depthWrite:!1,map:Vr(),alphaTest:.01})),this.snow.frustumCulled=!1,this.snow.visible=!1;for(let e=0;e<this.N_RAIN;e++)this.respawnRain(e,!0);for(let e=0;e<this.N_SNOW;e++)this.respawnSnow(e,!0);e.add(this.rain,this.snow)}set(e){this.kind=e,this.rain.visible=e===`rain`,this.snow.visible=e===`snow`;let t=e===`wind`?7:e===`rain`?2.5:e===`snow`?1.5:.6;this.wind.set(t*.95,t*.3),this.gusts=[];let n=e===`wind`?5:e===`rain`?2:0;for(let e=0;e<n;e++)this.gusts.push(this.newGust(!0))}respawnRain(e,t=!1){let n=(Math.random()*2-1)*6,r=-8+Math.random()*9.5,i=t?Math.random()*6:6;this.rainPos.set([n,i,r,n,i+.18,r],e*6)}respawnSnow(e,t=!1){this.snowPos.set([(Math.random()*2-1)*6,t?Math.random()*5:5,-8+Math.random()*9.5],e*3)}newGust(e=!1){let t=this.bounds.halfX;return{x:e?(Math.random()*2-1)*t:-t-.4,z:(Math.random()*2-1)*this.bounds.halfZ,r:.18+Math.random()*.2,amp:1.5+Math.random()*3,phase:Math.random()*6.28}}windForce(e){let t=this.wind.length();return new x(this.wind.x,0,this.wind.y).multiplyScalar(.5*zr*1*e*t)}loads(){return this.gusts.map(e=>({x:e.x,z:e.z,radius:e.r,pressure:e.amp*Math.sin(this.t*9+e.phase)}))}update(e){this.t+=e;let t=this.wind.x,n=this.wind.y;if(this.kind===`rain`){for(let r=0;r<this.N_RAIN;r++){let i=r*6;for(let r of[0,3])this.rainPos[i+r]+=t*.4*e,this.rainPos[i+r+1]-=6.5*e,this.rainPos[i+r+2]+=n*.4*e;this.rainPos[i+3]=this.rainPos[i]-t*.012,this.rainPos[i+1]<0&&this.respawnRain(r)}for(this.rain.geometry.attributes.position.needsUpdate=!0,this.rainDebt+=e*45;this.rainDebt>=1;){--this.rainDebt;for(let e=0;e<6;e++){let e=(Math.random()*2-1)*this.bounds.halfX,t=(Math.random()*2-1)*this.bounds.halfZ;if(this.isWater(e,t)){let n=.001+Math.random()*.0015;this.onRaindrop(e,t,n,4+n*1200);break}}}}if(this.kind===`snow`){for(let r=0;r<this.N_SNOW;r++){let i=r*3;this.snowPos[i]+=(t*.5+Math.sin(this.t*1.3+r)*.25)*e,this.snowPos[i+1]-=(.7+r%5*.08)*e,this.snowPos[i+2]+=(n*.5+Math.cos(this.t*1.1+r*1.7)*.2)*e,this.snowPos[i+1]<0&&this.respawnSnow(r)}this.snow.geometry.attributes.position.needsUpdate=!0}for(let r=0;r<this.gusts.length;r++){let i=this.gusts[r];i.x+=t*.6*e*.25,i.z+=n*.6*e*.25,(i.x>this.bounds.halfX+.5||Math.abs(i.z)>this.bounds.halfZ+.5)&&(this.gusts[r]=this.newGust())}}};function Vr(){let e=document.createElement(`canvas`);e.width=e.height=32;let t=e.getContext(`2d`),n=t.createRadialGradient(16,16,0,16,16,16);return n.addColorStop(0,`rgba(255,255,255,1)`),n.addColorStop(.5,`rgba(255,255,255,0.6)`),n.addColorStop(1,`rgba(255,255,255,0)`),t.fillStyle=n,t.fillRect(0,0,32,32),new je(e)}var I=28,Hr=class{solver;mesh;pos=Array.from({length:I},()=>new x);vel=Array.from({length:I},()=>new x);spin=new Float32Array(I);angle=new Float32Array(I);state=new Uint8Array(I);age=new Float32Array(I);cur=new Float32Array(84);sampler;xz=new Float32Array(56);dummy=new xe;active=!1;constructor(e,n,r){this.solver=r;let i=new Me;i.moveTo(0,-.03),i.quadraticCurveTo(.024,-.005,0,.035),i.quadraticCurveTo(-.024,-.005,0,-.03);let a=new t(i,6);a.rotateX(-Math.PI/2),this.mesh=new re(a,new C({roughness:.7,side:2}),I);let o=[`#d9832b`,`#c4521f`,`#e6b13a`,`#b8442a`,`#e0962c`];for(let e=0;e<I;e++)this.mesh.setColorAt(e,new g(o[e%o.length])),this.respawn(e,!0);this.mesh.frustumCulled=!1,this.mesh.castShadow=!0,this.mesh.visible=!1,e.add(this.mesh),this.sampler=new cn(n,()=>r.stateTexture,[r.grid.nx,r.grid.nz],r.origin,r.grid.dx)}setActive(e){if(this.active=e,this.mesh.visible=e,e)for(let e=0;e<I;e++)this.respawn(e,!0)}respawn(e,t=!1){this.pos[e].set((Math.random()*2-1)*3.5,t?Math.random()*4+.5:4+Math.random()*1.5,-2.5+Math.random()*3.6),this.vel[e].set(0,-.6,0),this.spin[e]=(Math.random()-.5)*6,this.angle[e]=Math.random()*6.28,this.state[e]=0,this.age[e]=0}update(e,t,n){if(!this.active)return;let r=this.sampler.result,i=this.sampler.resultTag!==null;for(let a=0;a<I;a++){let o=this.pos[a],s=this.state[a];if(this.age[a]+=e,s===0){if(o.x+=(Math.sin(t*2.1+a)*.35+n.x*.5)*e,o.z+=(Math.cos(t*1.7+a*1.3)*.25+n.y*.5)*e,o.y-=(.55+.25*Math.sin(t*3+a))*e,this.angle[a]+=this.spin[a]*e,o.y<=.002){let e=this.solver.sdfAt(o.x,o.z)<-.01;this.state[a]=e?1:2,this.age[a]=0,this.cur.fill(0,a*3,a*3+3),o.y=.002}}else s===1?(i&&this.cur.set([r[a*4],r[a*4+1],r[a*4+2]],a*3),o.y=this.cur[a*3]+.002,o.x+=(this.cur[a*3+1]+n.x*.03)*e,o.z+=(this.cur[a*3+2]+n.y*.03)*e,this.angle[a]+=(this.cur[a*3+1]-this.cur[a*3+2])*e*4,this.solver.sdfAt(o.x,o.z)>0&&(this.state[a]=2),this.age[a]>90&&this.respawn(a)):(o.x+=n.x*.05*e,o.z+=n.y*.05*e,(this.age[a]>40||Math.abs(o.x)>7)&&this.respawn(a));this.dummy.position.copy(o),this.dummy.rotation.set(s===0?Math.sin(t*3+a)*.8:0,this.angle[a],s===0?Math.cos(t*2.5+a)*.6:0),this.dummy.updateMatrix(),this.mesh.setMatrixAt(a,this.dummy.matrix),this.xz[a*2]=o.x,this.xz[a*2+1]=o.z}this.mesh.instanceMatrix.needsUpdate=!0,this.sampler.resultTag=null,this.sampler.request(this.xz,I,!0)}},Ur=6,Wr=class{renderer;solver;rt;quad;breaks=[];enabled=!1;constructor(e,t){this.renderer=e,this.solver=t;let{nx:n,nz:i}=t.grid,a=()=>new r(n,i,{type:T,minFilter:Ie,magFilter:Ie,depthBuffer:!1});this.rt=[a(),a()],this.quad=new Be(new y({uniforms:{uPrev:{value:null},uShape:{value:t.shapeTexture},uOrigin:{value:new h(...t.origin)},uExtent:{value:new h(...t.extent)},uDt:{value:0},uReset:{value:1},uCount:{value:0},uBreak:{value:Array.from({length:Ur},()=>new Qe)},uSize:{value:new h(n,i)}},vertexShader:`void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,fragmentShader:`
          uniform sampler2D uPrev, uShape;
          uniform vec2 uOrigin, uExtent, uSize;
          uniform float uDt, uReset;
          uniform int uCount;
          uniform vec4 uBreak[${Ur}];   // (x, z, radius, unused)
          ${qn}
          ${Jn}
          void main() {
            vec2 uv = gl_FragCoord.xy / uSize;
            vec2 p = uOrigin + uv * uExtent;
            float sdf = texture2D(uShape, uv).r;
            // frozen extent: a band 5–14 cm wide, ragged with noise
            float target = iceBand(p, sdf);
            vec2 prev = uReset > 0.5 ? vec2(target, 0.0) : texture2D(uPrev, uv).rg;
            // refreezing: grow back toward the frozen extent over ~60 s,
            // cracks slowly heal
            float ice = min(prev.r + uDt / 60.0 * step(0.01, target), target);
            float crack = max(prev.g - uDt / 90.0, 0.0);
            for (int k = 0; k < ${Ur}; k++) {
              if (k >= uCount) break;
              float d = length(p - uBreak[k].xy) / uBreak[k].z;
              if (d < 1.0 && ice > 0.05) {
                vec3 v = voronoi(p * 22.0);
                // nearer the blow, more shards are lost
                if (v.z < 0.75 * (1.0 - d * d)) ice = 0.0;
                else crack = 1.0;
              }
            }
            gl_FragColor = vec4(ice, crack, 0.0, 1.0);
          }`,depthTest:!1,depthWrite:!1}))}get texture(){return this.rt[0].texture}breakAt(e,t,n){this.enabled&&this.breaks.push(new Qe(e,t,n,0))}reset(){this.quad.material.uniforms.uReset.value=1}update(e){if(!this.enabled)return;let t=this.quad.material.uniforms;t.uPrev.value=this.rt[0].texture,t.uDt.value=e;let n=this.breaks.splice(0,Ur);n.forEach((e,n)=>t.uBreak.value[n].copy(e)),t.uCount.value=n.length,this.renderer.setRenderTarget(this.rt[1]),this.quad.render(this.renderer),this.renderer.setRenderTarget(null),this.rt.reverse(),t.uReset.value=0,this.solver.setIce(this.rt[0].texture)}disable(){this.enabled=!1,this.solver.setIce(null)}},L=(e,t=1,n=1,r=1,i=18)=>{let a=new _(e,i,Math.max(8,i/2));return a.scale(t,n,r),a};function R(e,t){let n=new w(e,t);return n.castShadow=!0,n.layers.enable(1),n}function Gr(){let e={value:new _e},t=new C({roughness:.85});return t.onBeforeCompile=t=>{t.uniforms.uRootInv=e,t.vertexShader=t.vertexShader.replace(`#include <common>`,`#include <common>
uniform mat4 uRootInv;
varying vec3 vCat;`).replace(`#include <project_vertex>`,`#include <project_vertex>
vCat = (uRootInv * modelMatrix * vec4(transformed, 1.0)).xyz;`),t.fragmentShader=t.fragmentShader.replace(`#include <common>`,`#include <common>\nvarying vec3 vCat;\n${qn}`).replace(`#include <color_fragment>`,`#include <color_fragment>
        vec3 p = vCat;
        vec3 grey = vec3(0.47, 0.46, 0.44);
        vec3 dark = vec3(0.09, 0.09, 0.1);
        vec3 white = vec3(0.92, 0.91, 0.88);
        // mackerel stripes run around the body, wavy, stronger on top
        float wav = vnoise(p.xz * 18.0) * 0.6 + vnoise(p.xy * 25.0) * 0.4;
        float stripe = smoothstep(0.35, 0.6, sin(p.x * 95.0 + wav * 5.0) * 0.5 + 0.5);
        stripe *= smoothstep(0.08, 0.2, p.y);
        // a dark spine line, tail rings
        stripe = max(stripe, smoothstep(0.02, 0.0, abs(p.z)) * step(0.18, p.y));
        vec3 col = mix(grey, dark, stripe * 0.85);
        // white socks, chest and muzzle
        float w = 1.0 - smoothstep(0.04, 0.07, p.y);
        w = max(w, smoothstep(0.12, 0.2, p.x) * (1.0 - smoothstep(0.15, 0.24, p.y)));
        w = max(w, smoothstep(0.31, 0.34, p.x) * (1.0 - smoothstep(0.25, 0.3, p.y)));
        col = mix(col, white, clamp(w, 0.0, 1.0));
        diffuseColor.rgb = col;`)},t.customProgramCacheKey=()=>`tabby`,{mat:t,uRootInv:e}}function Kr(e,t,n,r){let i=new p,a=R(new c(r*1.2,r,t,8).translate(0,-t/2,0),e);i.add(a);let o=new p;o.position.y=-t;let s=R(new c(r,r*.85,n,8).translate(0,-n/2,0),e),l=R(L(r*1.25,1.4,.7,1.1,10),e);return l.position.set(r*.5,-n,0),o.add(s,l),i.add(o),{hip:i,knee:o}}function qr(){let{mat:e,uRootInv:t}=Gr(),n=new p,r=new p;r.position.y=.23,n.add(r);let i=R(L(.1,1.15,1,.85),e);i.position.x=.11;let a=R(L(.1,1.7,.9,.8),e);a.position.x=-.03,r.add(i,a);let o=new p;o.position.x=-.15,r.add(o);let s=R(L(.095,1.2,1,.9),e);o.add(s);let l=[-1,1].map(t=>{let n=Kr(e,.12,.12,.02);return n.hip.position.set(-.01,-.03,t*.05),o.add(n.hip),n}),u=[-1,1].map(t=>{let n=Kr(e,.11,.11,.018);return n.hip.position.set(.16,-.05,t*.045),r.add(n.hip),n}),d=[],f=o;for(let t=0;t<7;t++){let n=new p;n.position.set(t===0?-.09:-.045,t===0?.03:0,0);let r=R(new c(.014-t*.0012,.016-t*.0012,.05,6).rotateZ(Math.PI/2).translate(-.022,0,0),e);n.add(r),f.add(n),d.push(n),f=n}let m=new p;m.position.set(.24,.08,0),r.add(m);let h=R(L(.06,1.05,.92,1),e),_=R(L(.03,1,.8,1.2),e);_.position.set(.05,-.02,0),m.add(h,_);let ee=[-1,1].map(t=>{let n=R(new b(.022,.045,4),e);return n.position.set(0,.058,t*.032),n.rotation.x=t*-.25,m.add(n),n}),te=new C({color:`#c9b84a`,roughness:.2,emissive:new g(`#3a3a10`)});for(let e of[-1,1]){let t=R(L(.009),te);t.position.set(.052,.012,e*.024),m.add(t)}let v=R(L(.006),new C({color:`#c98a8a`}));return v.position.set(.081,-.008,0),m.add(v),{root:n,torso:r,hips:o,head:m,frontLegs:u,backLegs:l,tail:d,ears:ee,uRootInv:t}}function Jr(){let e=new C({color:`#7d6d60`,roughness:.9}),t=new C({color:`#d9a0a0`,roughness:.6}),n=new p,r=new p;r.position.y=.022,n.add(r),r.add(R(L(.022,1.6,1,1.05,14),e));let i=new p;i.position.set(.034,.004,0);let a=R(L(.014,1.5,1,1,12),e),o=R(L(.003),t);o.position.set(.021,-.001,0),i.add(a,o);for(let e of[-1,1]){let n=R(new ke(.008,10),t);n.material=t.clone(),n.material.side=2,n.position.set(-.002,.012,e*.009),n.rotation.y=Math.PI/2-e*.4,i.add(n)}r.add(i);let s=[0,1,2,3].map(e=>{let n=new p;return n.position.set(e<2?.018:-.016,-.012,(e%2?1:-1)*.011),n.add(R(new c(.003,.003,.012,5).translate(0,-.006,0),t)),r.add(n),n}),l=[],u=r;for(let e=0;e<6;e++){let n=new p;n.position.set(e===0?-.034:-.012,0,0),n.add(R(new c(.0018,.0022,.012,4).rotateZ(Math.PI/2).translate(-.006,0,0),t)),u.add(n),l.push(n),u=n}return{root:n,body:r,legs:s,tail:l,head:i}}function Yr(e,n){let r=new C({color:e,roughness:.9,side:2}),i=new p,a=R(L(n*.09,2.6,.9,.9,10),r);i.add(a);let o=R(L(n*.06,1,1,1,8),r);return o.position.x=n*.26,i.add(o),{root:i,wings:[-1,1].map(e=>{let a=new p,o=new Me;o.moveTo(n*.1,0),o.lineTo(-n*.12,0),o.lineTo(-n*.05,n*.5),o.lineTo(n*.06,n*.42);let s=new t(o);s.rotateX(e*Math.PI/2);let c=R(s,r);return a.add(c),i.add(a),a}),side:[-1,1]}}function Xr(e){let t=new C({color:e.color,roughness:.9}),n=new C({color:e.belly??e.color,roughness:.9}),r=new p,i=new p;i.position.y=e.height,r.add(i),i.add(R(L(e.len*.28,1.8,.85,.75),t));let a=R(L(e.len*.24,1.6,.6,.65),n);a.position.y=-e.len*.06,i.add(a);let o=e.height,s=[0,1,2,3].map(n=>{let r=new p;return r.position.set((n<2?1:-1)*e.len*.32,-e.len*.05,(n%2?1:-1)*e.len*.12),r.add(R(new c(e.legR,e.legR*.7,o,6).translate(0,-o/2,0),t)),i.add(r),r}),l=new p;l.position.set(e.len*.45,e.len*.05,0),i.add(l);let u=e.neck??e.len*.2,d=R(new c(e.len*.07,e.len*.1,u,8).translate(0,u/2,0),t);d.rotation.z=-.5,l.add(d);let f=new p;if(f.position.set(u*.5,u*.85,0),l.add(f),f.add(R(L(e.len*.11,1.5,.9,.9),t)),e.ears)for(let n of[-1,1]){let r=R(new b(e.len*.035,e.ears,5),t);r.position.set(-e.len*.03,e.ears*.5,n*e.len*.05),r.rotation.x=n*-.3,f.add(r)}let m=new p;return m.position.set(-e.len*.48,e.len*.05,0),i.add(m),e.tail===`bushy`?m.add(R(L(e.len*.2,1.8,.7,.7),t).translateX(-e.len*.2)):e.tail===`puff`?m.add(R(L(e.len*.09),n)):e.tail===`long`&&m.add(R(L(e.len*.15,2.4,.5,.5),t).translateX(-e.len*.25)),{root:r,torso:i,legs:s,neck:l,head:f,tail:m}}function Zr(){let e=new C({color:`#8f9aa0`,roughness:.3,metalness:.3}),t=new p;t.add(R(L(.05,2.4,.9,.5),e));let n=R(new b(.04,.06,4).rotateZ(Math.PI/2),e);return n.position.x=-.13,t.add(n),t}var z=(e,t)=>Math.atan2(-t,e),Qr=(e,t,n)=>e+Math.atan2(Math.sin(t-e),Math.cos(t-e))*n,$r=class{prints;group=new p;mouse;cat;holes=[];mounds=[];spots=null;snowy=!1;next=60+Math.random()*120;t=0;mState=`hidden`;mTime=0;mPos=new x;mYaw=0;mPhase=0;waitAt=new x;lastPrint=new x;chase=!1;cState=`away`;cTime=0;cPos=new x;cYaw=0;cPhase=0;leapFrom=new x;leapTo=new x;exitDir=1;lastPaw=new x;pawSide=0;constructor(e){this.prints=e,this.mouse=Jr(),this.cat=qr(),this.mouse.root.visible=!1,this.cat.root.visible=!1,this.group.add(this.mouse.root,this.cat.root)}configure(e,t){this.spots=e,this.snowy=t;for(let e of[...this.holes,...this.mounds])this.group.remove(e);if(this.holes=[],this.mounds=[],this.mState=`hidden`,this.cState=`away`,this.mouse.root.visible=this.cat.root.visible=!1,!e)return;let n=t&&(e.hide===`hole`||e.hide===`grass`)?`snowbank`:e.hide;for(let[t,r]of[e.from,e.to])if(n===`snowbank`){let e=new w(new _(.16,20,10,0,Math.PI*2,0,Math.PI/2),new C({color:`#eef2f6`,roughness:.75}));e.scale.set(1.3,.55,1),e.position.set(t,-.01,r),e.receiveShadow=e.castShadow=!0,this.mounds.push(e),this.group.add(e)}else if(n===`hole`||n===`gap`){let e=new w(new ke(n===`gap`?.035:.028,16),new Ve({color:`#120d0a`}));e.rotation.x=-Math.PI/2,e.scale.set(1.3,.8,1),e.position.set(t,.003,r),this.holes.push(e),this.group.add(e)}}trigger(e=Math.random()<.45){if(!this.spots)return;let[t,n]=this.spots.from,[r,i]=this.spots.to;this.mPos.set(t,0,n),this.mYaw=z(r-t,i-n);let a=Math.hypot(r-t,i-n),o=Math.max(.25,Math.min(1.3,a*.55));this.waitAt.set(r-(r-t)/a*o,0,i-(i-n)/a*o),this.setMouse(`emerge`),this.mouse.root.visible=!0,this.chase=e,this.lastPrint.copy(this.mPos),e&&(this.exitDir=Math.sign(t-r)||1,this.cPos.set(t+this.exitDir*3.2,0,n-.4),this.cYaw=z(-this.exitDir,0),this.setCat(`walkIn`),this.cat.root.visible=!0,this.lastPaw.copy(this.cPos))}setMouse(e){this.mState=e,this.mTime=0}setCat(e){this.cState=e,this.cTime=0}update(e){this.t+=e,this.mState===`hidden`&&this.cState===`away`?(this.next-=e,this.next<=0&&this.spots&&(this.next=150+Math.random()*240,this.trigger())):(this.updateMouse(e),this.updateCat(e))}updateMouse(e){let t=this.mouse;this.mTime+=e;let n=new x(this.spots.to[0],0,this.spots.to[1]),r=0,i=0;switch(this.mState){case`emerge`:i=(1-Math.min(this.mTime/.6,1))*.04,this.mTime>.6&&this.setMouse(`sniff`);break;case`sniff`:t.head.rotation.y=Math.sin(this.t*9)*.35,t.head.rotation.z=Math.sin(this.t*13)*.15,this.mTime>.9+Math.random()*.02&&this.setMouse(`scurry`);break;case`scurry`:{r=Math.sin(this.mTime*3.1)>-.6?1.1:0;let t=this.waitAt.clone().sub(this.mPos);t.length()<.03?this.setMouse(`wait`):(this.mYaw=Qr(this.mYaw,z(t.x,t.z)+Math.sin(this.t*2)*.25,e*8),this.mPos.addScaledVector(t.normalize(),Math.min(r*e,t.length())));break}case`wait`:t.head.rotation.y=Math.sin(this.t*7)*.4,t.body.rotation.z=.15+Math.sin(this.t*11)*.03,!this.chase&&this.mTime>1.2&&this.setMouse(`flee`);break;case`flee`:{t.body.rotation.z=0,r=this.chase?1.8:.7;let i=n.clone().sub(this.mPos);this.mYaw=Qr(this.mYaw,z(i.x,i.z),e*14),i.length()<.02?this.setMouse(`dive`):this.mPos.addScaledVector(i.normalize(),Math.min(r*e,i.length()));break}case`dive`:i=Math.min(this.mTime/.25,1)*.05,r=.3,this.mTime>.3&&(this.mState=`hidden`,t.root.visible=!1)}if(this.mPhase+=e*(6+r*60),t.legs.forEach((e,t)=>e.rotation.z=r>0?Math.sin(this.mPhase+(t%2?Math.PI:0)+(t<2?0:Math.PI/2))*.9:0),t.tail.forEach((e,t)=>e.rotation.y=Math.sin(this.t*6-t*.7)*(.15+r*.2)),t.body.position.y=.022+(r>0?Math.abs(Math.sin(this.mPhase))*.004:0),t.root.position.set(this.mPos.x,-i,this.mPos.z),t.root.rotation.y=this.mYaw,this.snowy&&r>0&&this.mPos.distanceTo(this.lastPrint)>.035){let e=new x(Math.sin(this.mYaw),0,Math.cos(this.mYaw)).multiplyScalar(.012);this.prints.stamp(this.mPos.x+e.x,this.mPos.z+e.z,.012,.014,this.mYaw,.8),this.prints.stamp(this.mPos.x-e.x,this.mPos.z-e.z,.012,.014,this.mYaw,.8),this.prints.stamp(this.mPos.x,this.mPos.z,.006,.04,this.mYaw,.45),this.lastPrint.copy(this.mPos)}}updateCat(e){if(this.cState===`away`)return;let t=this.cat;this.cTime+=e;let n=0,r=0,i=0,a=0,o=-1,s=!1,c=new x(this.mPos.x-this.cPos.x,0,this.mPos.z-this.cPos.z),l=new x(this.spots.to[0],0,this.spots.to[1]);switch(this.cState){case`walkIn`:n=.6,this.cYaw=Qr(this.cYaw,z(c.x,c.z),e*2),this.cPos.addScaledVector(new x(Math.cos(this.cYaw),0,-Math.sin(this.cYaw)),n*e),(c.length()<1.9||this.cTime>7)&&this.setCat(`stalk`);break;case`stalk`:r=Math.min(1,this.cTime*2),n=Math.sin(this.cTime*1.7)>-.2?.22:0,this.cYaw=Qr(this.cYaw,z(c.x,c.z),e*3),c.length()>.75&&this.cPos.addScaledVector(c.clone().normalize(),n*e),c.length()<=.8&&this.mState===`wait`&&this.setCat(`wiggle`);break;case`wiggle`:r=1,a=1,this.cYaw=Qr(this.cYaw,z(c.x,c.z),e*5),this.cTime>1.3&&(this.leapFrom.copy(this.cPos),this.leapTo.copy(this.mPos).addScaledVector(c.clone().normalize(),-.12),this.setCat(`pounce`));break;case`pounce`:o=Math.min(this.cTime/.45,1),this.cPos.lerpVectors(this.leapFrom,this.leapTo,o),this.cTime>.08&&this.mState===`wait`&&this.setMouse(`flee`),o>=1&&this.setCat(`bound`);break;case`bound`:{s=!0,n=1.4;let t=l.clone().sub(this.cPos);this.cYaw=Qr(this.cYaw,z(t.x,t.z),e*8),t.length()<.16||this.cTime>1.4?this.setCat(`sit`):this.cPos.addScaledVector(t.normalize(),n*e);break}case`sit`:i=Math.min(1,this.cTime*3),t.head.rotation.x=Math.sin(this.cTime*2.2)>0?.35:-.25,t.head.rotation.y=this.cTime>2.2?Math.sin(this.cTime*1.3)*.7:0,this.cTime>4.5&&(this.setCat(`wander`),this.cYaw=z(this.exitDir*-1||1,.3),t.head.rotation.set(0,0,0));break;case`wander`:n=.4,this.cYaw=Qr(this.cYaw,z(-this.exitDir,.25),e*1.5),this.cPos.addScaledVector(new x(Math.cos(this.cYaw),0,-Math.sin(this.cYaw)),n*e),this.cTime>9&&(this.cState=`away`,t.root.visible=!1)}if(this.poseCat(e,n,r,i,a,o,s),this.snowy&&(n>0||o>=1)&&this.cPos.distanceTo(this.lastPaw)>(s?.3:.14)){let e=new x(Math.sin(this.cYaw),0,Math.cos(this.cYaw)).multiplyScalar(this.pawSide?.045:-.045);this.prints.stamp(this.cPos.x+e.x,this.cPos.z+e.z,.04,.048,this.cYaw,.95),this.pawSide^=1,this.lastPaw.copy(this.cPos)}}poseCat(e,t,n,r,i,a,o){let s=this.cat,c=o?.55:.32;this.cPhase+=t/c*Math.PI*2*e;let l=this.cPhase,u=a>=0?Math.sin(Math.PI*a)*.22:0;s.torso.position.y=.23-n*.1-r*.06+u,s.torso.rotation.z=r*.55+(a>=0?(.5-a)*.5:0)+(o?Math.sin(l)*.12:0);let d=e=>Math.sin(l+e)*(t>0?o?.9:.5:0),f=o?[0,.3,Math.PI,Math.PI+.3]:[0,Math.PI,Math.PI/2,3*Math.PI/2];s.frontLegs.forEach((e,i)=>{let o=d(f[i])-n*.35,s=-n*.5;a>=0&&(o=-1.1+a*.6),r&&(o=-r*.55,s=0),e.hip.rotation.z=o,e.knee.rotation.z=s+Math.max(0,Math.sin(l+f[i]+1.5))*(t>0?.5:0)}),s.backLegs.forEach((e,i)=>{let o=d(f[i+2])+n*.55,s=-n*1.1;a>=0&&(o=1-a*.5),r&&(o=r*1.5,s=-r*2.3),e.hip.rotation.z=o,e.knee.rotation.z=s-Math.max(0,Math.sin(l+f[i+2]-1.5))*(t>0?.4:0)}),s.hips.rotation.y=i*Math.sin(this.t*15)*.22,s.hips.position.y=i*.015,r||(s.head.rotation.z=-n*.25,s.head.position.set(.24+n*.03,.08-n*.04,0)),s.tail.forEach((e,t)=>{let i=t/(s.tail.length-1),a=r?-.35:n>.5?-.1:.35;e.rotation.z=(t===0?a:r?-.05:.08)+(n>.5?Math.sin(this.t*9)*.25*i*i:Math.sin(this.t*2-t)*.06),e.rotation.y=r?.45:Math.sin(this.t*1.5-t*.5)*.08}),s.ears.forEach(e=>e.rotation.z=n>.5?-.3:0),s.root.position.set(this.cPos.x,0,this.cPos.z),s.root.rotation.y=this.cYaw,s.root.updateMatrixWorld(),s.uRootInv.value.copy(s.root.matrixWorld).invert()}get state(){return`${this.mState}/${this.cState}`}get busy(){return this.mState!==`hidden`||this.cState!==`away`}},ei=class{group=new p;list=[];add(e,t,n){let r=new w(new qe(.85,1,40),new Ve({color:`#ffffff`,transparent:!0,opacity:.5,depthWrite:!1}));r.rotation.x=-Math.PI/2,r.position.set(e,.03,t),this.group.add(r),this.list.push({m:r,age:0,max:n})}update(e){for(let t of this.list){t.age+=e;let n=t.age/2.5;t.m.scale.setScalar(.05+n*t.max),t.m.material.opacity=.45*(1-n)}this.list=this.list.filter(e=>e.age<2.5||(this.group.remove(e.m),e.m.geometry.dispose(),e.m.material.dispose(),!1))}},ti=class{group=new p;actors=[];rings=new ei;hab=null;season=`summer`;time=`day`;timers={};constructor(){this.group.add(this.rings.group)}configure(e,t,n){this.hab=e,this.season=t,this.time=n;for(let e of this.actors)this.group.remove(e.obj);this.actors=[],this.timers={}}due(e,t,n){return this.timers[e]===void 0&&(this.timers[e]=n*(.2+Math.random()*.6)),this.timers[e]-=t,this.timers[e]>0?!1:(this.timers[e]=n*(.5+Math.random()),!0)}add(e){this.actors.push(e),this.group.add(e.obj)}update(e,t){this.rings.update(e),this.actors=this.actors.filter(n=>{let r=n.update(e,t);return r||this.group.remove(n.obj),r});let n=this.hab;if(!n)return;let r=this.time===`night`,i=this.season===`winter`,a=this.time===`sunrise`||this.time===`sunset`;if(!r&&this.due(`birds`,e,i?40:18)){let e=n.birds.filter(e=>e!==`geese`||this.season!==`summer`&&!i);if(e.length){let t=e[Math.floor(Math.random()*e.length)];t===`geese`?this.add(this.flock(`#3a3633`,1.6,7,!0,90,38,6.5)):t===`gulls`?this.add(this.flock(`#eef0f2`,1.2,1+Math.floor(Math.random()*3),!1,45,20,5,!0)):t===`crows`?this.add(this.flock(`#1c1c22`,.9,1+Math.floor(Math.random()*2),!1,35,18,7)):t===`ducks`&&n.water?this.add(this.duckLanding(n.water)):this.add(this.flock(`#5a4a3c`,.25,2+Math.floor(Math.random()*3),!1,14,6,6,!1,!0))}}if(n.trees&&n.trees.length>1&&!r&&!i&&this.due(`squirrel`,e,22)&&this.add(this.squirrel(n.trees)),n.rabbits&&this.due(`rabbit`,e,a||r?25:45)&&this.add(this.rabbit(n.rabbits)),n.deer&&!i&&this.due(`deer`,e,a?120:260)&&this.add(this.walker(`deer`)),n.fox&&this.due(`fox`,e,a||r?140:320)&&this.add(this.walker(`fox`)),n.water&&!i&&(this.due(`fish`,e,16)&&this.add(this.fishJump(n.water)),n.frogs&&(this.season===`spring`||this.season===`summer`)&&this.due(`frog`,e,14))){let[e,t,r]=n.water,i=e+Math.random()*(r-e);this.rings.add(i,t-.5-Math.random()*2,.6)}n.loons&&n.water&&!i&&!this.actors.some(e=>e.obj.name===`loon`)&&this.add(this.loon(n.water))}flock(e,t,n,r,i,a,o,s=!1,c=!1){let l=new p,u=Array.from({length:n},(n,i)=>{let a=Yr(e,t),o=Math.ceil(i/2),s=i%2?1:-1;return a.root.position.set(r?-o*t*1.4:-i*t*3*Math.random(),(Math.random()-.5)*t,r?s*o*t*1.1:(Math.random()-.5)*t*4),l.add(a.root),{...a,phase:Math.random()*6}}),d=Math.random()<.5?1:-1,f=-i*(.6+Math.random()*.8);l.position.set(-d*(i*1.2+20),a*(.7+Math.random()*.6),f),l.rotation.y=d>0?0:Math.PI,l.rotation.y+=(Math.random()-.5)*.4;let m=0;return{obj:l,update:(e,t)=>{m+=e,l.translateX(o*e),c&&(l.position.y+=Math.sin(t*4)*e*.8);for(let e of u){let n=s&&Math.sin(t*.7+e.phase)>.3?.15:Math.sin(t*(c?22:6)+e.phase)*.7;e.wings[0].rotation.x=n,e.wings[1].rotation.x=-n}return m<(i*2.4+40)/o}}}duckLanding(e){let t=Yr(`#4a3f35`,.7),n=t.root,[r,i,a,o]=e,s=new x(r+Math.random()*(a-r),.03,i+(o-i)*(.2+Math.random()*.3)),c=Math.random()<.5?1:-1,l=s.clone().add(new x(-c*40,14,0));n.position.copy(l),n.rotation.y=c>0?0:Math.PI;let u=0,d=!1;return{obj:n,update:(e,r)=>{if(u+=e,d)t.wings[0].rotation.x=1.4,t.wings[1].rotation.x=-1.4,n.translateX(.25*e);else{let e=Math.min(u/5,1);n.position.lerpVectors(l,s,1-(1-e)*(1-e));let i=e>.8?.9:Math.sin(r*9)*.8;t.wings[0].rotation.x=i,t.wings[1].rotation.x=-i,e>=1&&(d=!0,this.rings.add(s.x,s.z,2.5))}return u<40}}}squirrel(e){let t=Xr({len:.22,height:.05,color:`#8a5a3a`,belly:`#c9b39a`,legR:.008,tail:`bushy`,ears:.02,neck:.03}),n=e[Math.floor(Math.random()*e.length)],r=e[Math.floor(Math.random()*e.length)];r===n&&(r=e[(e.indexOf(n)+1)%e.length]);let i=new x(n[0],0,n[1]),a=new x(r[0],0,r[1]);t.root.position.copy(i);let o=0,s=0,c=0;return{obj:t.root,update:(e,n)=>{o+=e;let r=a.clone().sub(t.root.position);return r.length()<.2?(t.root.position.y+=e*1.5,t.root.rotation.z=Math.PI/2,t.root.position.y<3):(s>0?(s-=e,t.torso.rotation.z=.8,t.tail.rotation.z=1.2+Math.sin(n*12)*.2):(c+=e*9,t.torso.rotation.z=0,t.torso.position.y=.05+Math.abs(Math.sin(c))*.05,t.tail.rotation.z=.6,t.root.rotation.y=Math.atan2(-r.z,r.x),t.root.position.addScaledVector(r.normalize(),1.6*e),Math.random()<e*.6&&(s=.6+Math.random())),o<30)}}}rabbit(e){let t=Xr({len:.3,height:.08,color:`#8b7b68`,belly:`#d8cfc2`,legR:.012,tail:`puff`,ears:.09,neck:.04}),[n,r,i,a]=e,o=new x(Math.random()<.5?n:i,0,r+Math.random()*(a-r)),s=o.x===n?1:-1;t.root.position.copy(o),t.root.rotation.y=s>0?0:Math.PI;let c=0,l=0,u=0;return{obj:t.root,update:e=>(c+=e,l>0?(l-=e,t.neck.rotation.z=Math.sin(c*3)*.2-.4):(u+=e*6,t.torso.position.y=.08+Math.max(0,Math.sin(u))*.09,t.root.position.x+=s*.9*e,t.neck.rotation.z=0,Math.sin(u)<-.95&&Math.random()<.25&&(l=1+Math.random()*3)),c<40&&t.root.position.x>n-1&&t.root.position.x<i+1)}}walker(e){let t=e===`deer`,n=Xr(t?{len:1.5,height:.85,color:`#8a6a4a`,belly:`#d6c4a8`,legR:.035,tail:`puff`,ears:.14,neck:.55}:{len:.7,height:.32,color:`#c4642c`,belly:`#efe2d0`,legR:.02,tail:`long`,ears:.08,neck:.12}),r=Math.random()<.5?1:-1,i=-(t?16:10)-Math.random()*10;n.root.position.set(-r*22,0,i),n.root.rotation.y=r>0?0:Math.PI;let a=0,o=0,s=0,c=t?.9:1.6;return{obj:n.root,update:e=>(a+=e,o>0?(o-=e,n.neck.rotation.z=t?.25:0,n.neck.rotation.y=Math.sin(a)*.5):(s+=e*c*6,n.legs.forEach((e,t)=>e.rotation.z=Math.sin(s+(t%2?Math.PI:0)+(t<2?0:Math.PI/2))*.4),n.root.position.x+=r*c*e,n.neck.rotation.z=t?-.15:0,t&&Math.random()<e*.08&&(o=2+Math.random()*3)),Math.abs(n.root.position.x)<24)}}fishJump(e){let t=Zr(),[n,r,i,a]=e,o=n+Math.random()*(i-n),s=r+(a-r)*Math.random()*.4,c=Math.random()<.5?1:-1;t.rotation.y=c>0?0:Math.PI;let l=0,u=.55;return this.rings.add(o,s,1.2),{obj:t,update:e=>{l+=e;let n=l/u;return t.position.set(o+c*n*.6,Math.sin(Math.PI*Math.min(n,1))*.45,s),t.rotation.z=(.5-n)*1.6*c,n>=1&&n-e/u<1&&this.rings.add(t.position.x,s,1.4),n<1.05}}}loon(e){let t=new C({color:`#15171a`,roughness:.6}),n=new C({color:`#e9ecef`,roughness:.6}),r=new p;r.name=`loon`;let i=new w(new _(.3,14,8).scale(1.8,.6,.8),t),a=new w(new c(.07,.1,.35,8),t);a.position.set(.42,.18,0),a.rotation.z=-.3;let o=new w(new _(.1,10,8).scale(1.4,1,1),t);o.position.set(.5,.36,0);let s=new w(new ne(.075,.012,6,16),n);s.position.set(.46,.25,0),s.rotation.y=Math.PI/2,r.add(i,a,o,s);let[l,u,d,f]=e;r.position.set(l+(d-l)*.3,.02,u+(f-u)*.15);let m=0,h=0,g=1;return{obj:r,update:e=>(m+=e,h>0?(h-=e,r.visible=!1,h<=0&&(r.visible=!0,r.position.x+=(Math.random()-.5)*30,this.rings.add(r.position.x,r.position.z,2)),!0):(r.position.x+=g*.3*e,(g>0&&r.position.x>d-5||g<0&&r.position.x<l+5)&&(g=-g,r.rotation.y=g>0?0:Math.PI),Math.random()<e/40&&(h=12+Math.random()*15,this.rings.add(r.position.x,r.position.z,2.5)),m<600))}}},ni={x0:-8,z0:-9,w:16,d:9},ri=[2048,1152],ii=240,ai=class{target;scene=new s;camera;stamps;fade=new s;fadeMat;pending=[];dummy=new xe;fadeAcc=0;live=0;constructor(){this.target=new r(ri[0],ri[1],{type:T,depthBuffer:!1});let{x0:e,z0:t,w:n,d:i}=ni;this.camera=new we(e,e+n,-t,-(t+i),-1,1),this.camera.position.set(0,.5,0),this.camera.up.set(0,0,-1),this.camera.lookAt(0,0,0),this.camera.updateMatrixWorld(),this.fadeMat=new y({uniforms:{uFactor:{value:1}},vertexShader:`void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,fragmentShader:`uniform float uFactor; void main(){ gl_FragColor = vec4(uFactor); }`,blending:5,blendEquation:100,blendSrc:200,blendDst:202,depthTest:!1,depthWrite:!1});let a=new w(new S(2,2),this.fadeMat);a.frustumCulled=!1,this.fade.add(a);let o=new S(2,2);o.rotateX(-Math.PI/2);let s=new fe(new Float32Array(256),1);o.setAttribute(`aDepth`,s),this.stamps=new re(o,new y({vertexShader:`
          attribute float aDepth;
          varying vec2 vUv; varying float vD;
          void main() { vUv = uv * 2.0 - 1.0; vD = aDepth; gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0); }`,fragmentShader:`
          varying vec2 vUv; varying float vD;
          void main() { float d = length(vUv); if (d > 1.0) discard; gl_FragColor = vec4(vD * (1.0 - d * d * 0.6)); }`,blending:5,blendEquation:104,depthTest:!1,depthWrite:!1}),256),this.stamps.frustumCulled=!1,this.stamps.count=0,this.scene.add(this.stamps)}stamp(e,t,n,r,i,a=1){this.pending.push({x:e,z:t,w:n,l:r,yaw:i,depth:a})}clear(e){e.setRenderTarget(this.target),e.setClearColor(0,0),e.clear(!0,!1,!1),e.setRenderTarget(null)}update(e,t){this.fadeAcc+=t;let n=this.live>0&&this.fadeAcc>=.25;if(!n&&!this.pending.length)return;let r=e.autoClear;if(e.autoClear=!1,e.setRenderTarget(this.target),n&&(this.fadeMat.uniforms.uFactor.value=Math.exp(-this.fadeAcc/ii),e.render(this.fade,this.camera),this.live-=this.fadeAcc,this.fadeAcc=0),this.pending.length){this.live=1200;let t=this.pending.splice(0,256),n=this.stamps.geometry.attributes.aDepth;t.forEach((e,t)=>{this.dummy.position.set(e.x,0,e.z),this.dummy.rotation.set(0,e.yaw,0),this.dummy.scale.set(e.l/2,1,e.w/2),this.dummy.updateMatrix(),this.stamps.setMatrixAt(t,this.dummy.matrix),n.setX(t,e.depth)}),n.needsUpdate=!0,this.stamps.count=t.length,this.stamps.instanceMatrix.needsUpdate=!0,e.render(this.scene,this.camera)}e.setRenderTarget(null),e.autoClear=r}},oi={spring:{snow:0,leaves:0,grass:[1.08,1.12,.92]},summer:{snow:0,leaves:0,grass:[1,1,1]},autumn:{snow:0,leaves:.6,grass:[1.15,1,.7]},winter:{snow:.85,leaves:0,grass:[1.05,.86,.82]}},si=class{scene;solver;waters;hooks;config;env;weather;leaves;ice;prints=new ai;mouseCat=new $r(this.prints);wildlife=new ti;def=null;built=null;shapeKey=``;loading=Promise.resolve();renderer;time={value:0};hotTub=!1;waterFreezes=!1;constructor(e,t,n,r,i,a,o,s){this.scene=e,this.solver=n,this.waters=r,this.hooks=i,this.config=a,this.env=new fr(t,e,Sr(a.time,a.weather,a.season),o?1024:2048);let c={get halfX(){return n.shape.halfX},get halfZ(){return n.shape.halfZ}};this.weather=new Br(e,c,(e,t)=>n.sdfAt(e,t)<0,s,o),this.leaves=new Hr(e,t,n),this.ice=new Wr(t,n),r.time=this.time,e.add(this.mouseCat.group,this.wildlife.group);for(let e of i.groundMaterials)$n(e,this.prints.target.texture);this.renderer=t}set(e){let t={...this.config,...e};return this.loading=this.loading.then(()=>this.apply(t)),this.loading}async apply(e){let t=this.config;this.config=e;let n=(await yr[e.location]()).default,r=Sr(e.time,e.weather,e.season);this.env.apply(r);let i=n.shape(e.season),a=JSON.stringify(i);a!==this.shapeKey&&(this.shapeKey=a,this.solver.setShape(Ne(this.solver.grid,void 0,i)),this.hooks.onShapeChanged());for(let t of this.hooks.groundMaterials)er(t,n.ground),tr(t,oi[e.season],+(e.weather===`rain`));this.built&&n===this.def&&t.season===e.season&&t.time===e.time&&t.weather===e.weather||(this.built&&(this.scene.remove(this.built.group),ci(this.built.group)),this.built=n.build({mood:r,season:e.season,weather:e.weather,sdfAt:(e,t)=>this.solver.sdfAt(e,t),halfX:this.solver.shape.halfX,halfZ:this.solver.shape.halfZ,waters:this.waters}),this.scene.add(this.built.group)),this.def=n;let o=`${e.location}|${e.season}|${e.time}`;o!==this.critterKey&&(this.critterKey=o,this.mouseCat.configure(n.critters.mouse,e.season===`winter`),this.wildlife.configure(n.critters.habitat,e.season,e.time),this.prints.clear(this.renderer)),this.weather.set(e.weather),kr.strength.value=e.weather===`wind`?.012:e.weather===`rain`?.005:.002,this.leaves.setActive(e.season===`autumn`);let s=!!n.hotTub?.(e.season);s!==this.hotTub&&(this.hotTub=s,this.hooks.onHotTub(s)),this.waterFreezes=e.season===`winter`&&n.freezes(e.season),this.updateIce()}updateIce(e=this.fluidId){this.fluidId=e;let t=this.waterFreezes&&(e===`water`||e===`oobleck`);t&&!this.ice.enabled?(this.ice.enabled=!0,this.ice.reset()):!t&&this.ice.enabled&&this.ice.disable()}fluidId=`water`;critterKey=``;update(e){this.time.value+=e,kr.time.value=this.time.value,this.env.update(this.time.value),this.built?.update?.(this.time.value,e),this.weather.update(e),this.solver.setWind(this.weather.wind.x,this.weather.wind.y),this.leaves.update(e,this.time.value,this.weather.wind),this.ice.update(e),this.mouseCat.update(e),this.wildlife.update(e,this.time.value),this.prints.update(this.renderer,e)}get group(){return this.built?.group??null}ready(){return this.loading}};function ci(e){e.traverse(e=>{let t=e;t.geometry?.dispose();let n=t.material;Array.isArray(n)?n.forEach(e=>e.dispose()):n?.dispose()})}var li=document.getElementById(`scene`),B=new Ke({canvas:li,antialias:!1,powerPreference:`high-performance`});B.toneMapping=4,B.toneMappingExposure=1,B.outputColorSpace=ce,B.shadowMap.enabled=!0,B.shadowMap.type=1,B.shadowMap.autoUpdate=!1;var ui=navigator.maxTouchPoints>0&&Math.min(screen.width,screen.height)<900,V=Te[O.fluid]??Te.water,H=V,di=V,U=He,fi,pi=Re(Pe()),W=new ze(B,Ne(pi),H),mi=new Kn(W,1.333,ui?1:2),hi=new s,G=new Fe(46,1,.05,1200),gi=new wt,_i=Zn(W,mi.target.texture,gi.target.texture,!1),vi=Zn(W,mi.target.texture,gi.target.texture,!0),yi=nr(_i),bi=ar(W,vi);hi.add(yi,bi.mesh);var xi=new s,K=Yn(W);xi.add(K.mesh);var q=(e,t)=>W.sdfAt(e,t)<0,J=new ft(H,q,(e,t)=>{let n=.02,r=W.sdfAt(e+n,t)-W.sdfAt(e-n,t),i=W.sdfAt(e,t+n)-W.sdfAt(e,t-n),a=Math.hypot(r,i)||1;return[-r/a,-i/a]}),Si=bt(J,K.uniforms);xi.add(Si.mesh);var Ci=new Sn(B,hi,xi,G,K.uniforms,ui?0:4);function wi(e,t,n,r){let i=4/3*Math.PI*n**3,a=Math.max(2.5*n,1.5*pi.dx);return{x:e,z:t,radius:a,pressureImpulse:H.density*i*r/(Math.PI*a*a),volume:i}}var Y=new It;Y.volume=O.volume,Y.muted=O.muted;var Ti=()=>Y.unlock();window.addEventListener(`pointerdown`,Ti,{capture:!0}),window.addEventListener(`keydown`,Ti,{capture:!0});var X=new si(hi,B,W,{reflection:{texture:K.uniforms.uReflection.value,matrix:K.uniforms.uReflMatrix.value},time:{value:0},resolution:new h},{groundMaterials:[_i,vi],onShapeChanged(){bi.update(),Oi()},onHotTub(e){Gi(V,e),Y.setAmbience(Rt(X.config,e)),e&&Gn(`the pool is a hot tub for the winter <small>· 38 °C</small>`,3500)}},{location:O.location,season:O.season,time:O.time,weather:O.weather},ui,(e,t,n,r)=>W.addImpulse(wi(e,t,n,r)));function Ei(){Y.setAmbience(Rt(X.config,X.hotTub));let e=X.env.mood;K.uniforms.uSunDir.value.copy(X.env.sunDir),K.uniforms.uSunColor.value.copy(e.sunColor).multiplyScalar(e.sunIntensity),K.uniforms.uAmbient.value.copy(e.hemiSky).multiplyScalar(e.hemiIntensity),Si.material.uniforms.uSkyTop.value.copy(e.skyTop),Si.material.uniforms.uSkyHorizon.value.copy(e.skyHorizon)}var Di=new tn(()=>Oi(),pi.nx);function Oi(){let e=window.innerWidth,t=window.innerHeight,n=or(W.shape.outline,e/t);G.fov=n.fov,G.aspect=e/t,G.position.copy(n.position),G.lookAt(n.target),G.updateProjectionMatrix(),Ci.setSize(e,t,Math.min(window.devicePixelRatio,ui?2:1.75)*Di.scale)}window.addEventListener(`resize`,Oi),Oi();var Z=kt();At();var Q=new jn(hi,W,B,G,{impulse:e=>W.addImpulse(e),onEntry(e,t,n,r,i,a){if(e===`duck`&&Y.squeak(),!q(t,n))return;Y.entry(i,r,V.id);let o=at(r,W.depthAt(t,n),H,U,a*.7,i*r),s=o.sprayMass>0?J.spray(t,n,o.radius,o.sprayMass,o.sprayMeanSpeed):0;W.addImpulse({x:t,z:n,radius:o.radius,pressureImpulse:o.pressureImpulse,volume:-s})}}),ki=new Bn(hi,{isFluid:q,floorAt:(e,t)=>Q.floorAt(e,t),get halfX(){return W.shape.halfX},get halfZ(){return W.shape.halfZ}},e=>{if(!q(e.x,e.z))return;let t=Math.max(M.radius*1.5,1.5*pi.dx);if(X.ice.enabled&&X.ice.breakAt(e.x,e.z,.08),(e.kind===`skip`||e.kind===`clatter`)&&Y.skip(e.speed,V.id),e.kind===`plop`&&Y.plop(),e.kind===`clatter`){Fi.unshift({x:e.x,z:e.z,t:W.simTime,s:.8}),Fi.length=Math.min(Fi.length,4);return}let n=at(e.speed,W.depthAt(e.x,e.z),H,U,M.radius,e.momentum),r=n.sprayMass>0?J.spray(e.x,e.z,t,n.sprayMass,n.sprayMeanSpeed):0;if(W.addImpulse({x:e.x,z:e.z,radius:t,pressureImpulse:Math.max(n.pressureImpulse,e.momentum/(Math.PI*t*t)),volume:-r}),e.kind===`skip`){let e=ki.current?.skips??0;Gn(`<b>${e}</b> ${e===1?`skip`:`skips`}`,1800)}},e=>{let t=O.best[H.id]??0,n=e>t;n&&(O.best[H.id]=e,Ot()),Gn(e===0?`straight in <small>· best ${t} on ${H.name.toLowerCase()}</small>`:`<b>${e}</b> ${e===1?`skip`:`skips`} ${n?`<small>· new best!</small>`:`<small>· best ${t}</small>`}`,3200)}),Ai=new Hn(hi,Q,G,()=>Y.nibble());Ai.onCast=()=>Y.cast();function ji(e){O.mode=e,Ot(),e!==`fish`&&Ai.reelIn(!0),e===`skip`&&Gn(`flick sideways across the puddle <small>· about 20° up is the magic angle</small>`,4200),e===`fish`&&Gn(`tap the water to cast <small>· tap the grass to reel in</small>`,4200)}var Mi=(e,t)=>{let n=li.getBoundingClientRect();return new h((e-n.left)/n.width*2-1,-((t-n.top)/n.height)*2+1)},Ni=Nt({onDragStart:(e,t,n,r)=>Q.carryNew(t,e,Mi(n,r)),onDragMove:(e,t,n)=>Q.moveCarry(e,Mi(t,n)),onDragEnd:(e,t,n)=>Q.endCarry(e,Ni.isOverButton(t,n)),onTap(e){for(let t=0;t<30;t++){let t=(Math.random()*2-1)*W.shape.halfX*.6,n=(Math.random()*2-1)*W.shape.halfZ*.6;if(W.sdfAt(t,n)<-.12){Q.spawn(e,new x(t,.3,n));return}}},onClear:()=>Q.clear()}),Pi={froude:0,sprayMl:0},Fi=[];function Ii(){let e=W.simTime,t=K.uniforms.uJamMarks.value;for(let n=0;n<4;n++){let r=Fi[n];r?t[n].set(r.x,r.z,.075,r.s*Math.exp(-(e-r.t)/.4)):t[n].set(0,0,1,0)}}function Li(e,t){X.ice.enabled&&W.sdfAt(e,t)>-.2&&(X.ice.breakAt(e,t,.08+O.strength*.14),Y.crack()),H.rheology.kind===`shearThickening`&&(Fi.unshift({x:e,z:t,t:W.simTime,s:Math.min(1,.4+O.strength)}),Fi.length=Math.min(Fi.length,4));let n=at(it(O.strength),W.depthAt(e,t),H,U),r=n.sprayMass>0?J.spray(e,t,n.radius,n.sprayMass,n.sprayMeanSpeed):0;W.addImpulse({x:e,z:t,radius:n.radius,pressureImpulse:n.pressureImpulse,volume:-r}),Pi={froude:+n.froudeRequested.toFixed(2),sprayMl:+(r*1e6).toFixed(1)},Y.slap(V.id,O.strength,r*1e6),Lt(8+O.strength*32)}lr(li,G,{isWater:q,canHold:()=>H.holdable,onHoldStart(e,t,n){Ki.set(e,{x:t,z:n,t:0,depth:Math.max(W.depthAt(t,n),.002)})},onHoldMove(e,t,n){let r=Ki.get(e);r&&q(t,n)&&(r.x=t,r.z=n,r.depth=Math.max(W.depthAt(t,n),.002))},onHoldEnd(e){Ki.delete(e)},onPressAnywhere:()=>!Z.isOpen()&&!Ni.isOpen()?!1:(Z.close(),Ni.close(),!0),onPickDown:(e,t)=>O.mode!==`fish`&&Q.pick(e,t),mode:()=>O.mode,onFlick(e,t,n,r){ki.throwFrom({dx:e,dy:t,ms:n,start:r},li.clientWidth)},onCast:(e,t)=>Ai.cast(e,t),onReel:()=>Ai.reelIn(),onCarryMove:(e,t)=>Q.moveCarry(e,t),onCarryEnd:(e,t,n)=>Q.endCarry(e,Ni.isOverButton(t,n)),onSlap:Li,onStir(e,t,n,r,i){let a=performance.now();a-Ri>110&&(Ri=a,Y.stir(Math.hypot(n-e,r-t)/i));for(let a of lt(e,t,n,r,i))q(a.x,a.z)&&W.addImpulse(a)}});var Ri=0,zi=0;function Bi(e){for(let t of J.step(e))Math.random()<.35&&Y.dropLanded(t.radius,t.onWater),t.onWater?W.addImpulse(wi(t.x,t.z,t.radius,t.speed)):(gi.stamp(t.x,t.z,t.radius*(4+3*Math.random())),zi+=t.volume);zi>0&&J.count===0&&(W.addImpulse({x:0,z:0,radius:.6,pressureImpulse:0,volume:zi}),zi=0),Si.update()}var Vi=2+Math.random()*4;function Hi(e){if(e<Vi)return;Vi=e+5+Math.random()*9;let t=X.config.location;if(t!==`beach`&&t!==`city`&&t!==`dock`&&X.config.weather===`clear`)for(let e=0;e<20;e++){let e=(Math.random()*2-1)*W.shape.halfX,t=(Math.random()*2-1)*W.shape.halfZ;if(W.sdfAt(e,t)<-.08){W.addImpulse(wi(e,t,.0025,5));return}}}var Ui=0;function Wi(e){if(X.hotTub)for(Ui+=e*14;Ui>=1;){--Ui;let e=Math.random()<.6,t=Math.random()*Math.PI*2,n=e?Math.cos(t)*W.shape.halfX*.85:(Math.random()-.5)*W.shape.halfX,r=e?Math.sin(t)*W.shape.halfZ*.8:(Math.random()-.5)*W.shape.halfZ;q(n,r)&&W.addImpulse({x:n,z:r,radius:.025+Math.random()*.02,pressureImpulse:-(1.5+Math.random()*2.5)})}}function Gi(e,t=X.hotTub){V=e;let n=t&&e.id===`water`?he:e;H=n,di=n,X.updateIce(n.id),W.setFluid(n),K.applyFluid(n),J.fluid=n,J.clear(),zi=0,Ki.clear();let r=n.optics;mi.setOptics(r.kind===`dielectric`?r.ior:null,r.kind===`dielectric`?r.absorption:[0,0,0]);let i=n.id===`honey`?.3:n.id===`oobleck`?.9:.78;for(let e of[_i,vi])Qn(e,n.stain,n.wetsGround,i);let a=Si.material.uniforms;a.uMetal.value=+(r.kind===`metal`),r.kind===`dielectric`?a.uTint.value.setRGB(...r.absorption.map(e=>Math.exp(-e*.006))):a.uTint.value.setRGB(1,1,1),gi.clear(B),fi?.fluidChanged()}var Ki=new Map,qi=[];function Ji(e){for(let t of Ki.values())t.t+=e;qi=[...Ki.values()].map(e=>tt(e,H.density,U))}var Yi=()=>{};Z.addSlider(`Sound`,()=>O.volume,e=>{O.volume=e,Y.setVolume(e),Ot()},e=>e<.01?`off`:`${Math.round(e*100)} %`,[`quiet`,`loud`]),Pt(()=>O.muted,e=>{O.muted=e,Y.setMuted(e),Ot()}),Yi=Z.addChoice(`Fluid`,[[`water`,`Water`],[`honey`,`Honey`],[`mercury`,`Mercury`],[`oobleck`,`Oobleck`]],()=>H.id,e=>{O.fluid=e,Ot(),Gi(Te[e])});var Xi=e=>e[Math.floor(Math.random()*e.length)],Zi=[[`spring`,`Spring`],[`summer`,`Summer`],[`autumn`,`Autumn`],[`winter`,`Winter`]],Qi=[[`sunrise`,`Sunrise`],[`day`,`Day`],[`sunset`,`Sunset`],[`night`,`Night`]],$i=[[`clear`,`Clear`],[`rain`,`Rain`],[`wind`,`Wind`],[`snow`,`Snow`]],ea={};function ta(e){Object.assign(O,e),Ot();for(let[t,n]of Object.entries(e))ea[t]?.(n);X.set(e).then(Ei)}ea.location=Z.addChoice(`Place`,vr,()=>X.config.location,e=>ta({location:e})),ea.season=Z.addChoice(`Season`,Zi,()=>X.config.season,e=>ta({season:e})),ea.time=Z.addChoice(`Time`,Qi,()=>X.config.time,e=>ta({time:e})),ea.weather=Z.addChoice(`Weather`,$i,()=>X.config.weather,e=>ta({weather:e})),Z.addButtons([[`Shuffle everything`,()=>{let e={location:Xi(vr)[0],season:Xi(Zi)[0],time:Xi(Qi)[0],weather:Xi($i)[0]},t=Xi([`water`,`water`,`honey`,`mercury`,`oobleck`]);O.fluid=t,Gi(Te[t]),Yi(t),ta(e)}]]),Z.addChoice(`Play`,[[`slap`,`Slap`],[`skip`,`Skip stones`],[`fish`,`Fishing`]],()=>O.mode,ji),Z.addButtons([[`Engineering mode`,()=>{Z.close(),fi.toggle()}]]),X.ready().then(()=>{Ei(),Gi(V)}),document.getElementById(`build`).textContent=`build 180e4cc`;var na=new te;na.connect(document);var ra=60,$={cpuMs:0,fps:0,substeps:0,dtMs:0,grid:`${pi.nx}x${pi.nz}`,dxMm:+(pi.dx*1e3).toFixed(2),simTime:0};window.__stats=$;var ia=!1,aa=new qt(W);fi=new Jt(W,aa,{base:()=>di,setFluid(e){H=e,W.updateFluid(e),J.fluid=e},setGravity(e){U=e,W.gravity=e},bodies:()=>Q.toys.map(e=>({kind:e.kind,body:e.body})),lastSlap:()=>Pi,stats:$},`180e4cc`),new URLSearchParams(location.search).has(`eng`)&&fi.toggle(!0),window.__puddle={solver:W,camera:G,world:X,setWorld:ta,water:K.mesh,scene:hi,groundMesh:yi,bedMesh:bi.mesh,causticStats:()=>mi.stats(B),drops:J,lastSlap:()=>Pi,slapAt:(e,t,n)=>(O.strength=n,Li(e,t),Pi),setFluid:e=>{O.fluid=e,Gi(Te[e])},toys:Q,stones:ki,fishing:Ai,setMode:ji,flick:(e,t,n,r=0)=>ki.throwFrom({dx:e,dy:t,ms:n,start:new x(0,0,r)},li.clientWidth),spawnToy:(e,t,n,r)=>Q.spawn(e,new x(t,n,r)),hold:(e,t,n)=>Ki.set(e,{x:t,z:n,t:0,depth:Math.max(W.depthAt(t,n),.002)}),release:e=>Ki.delete(e),stir:(e,t,n,r,i)=>{for(let a of lt(e,t,n,r,i))q(a.x,a.z)&&W.addImpulse(a)},setPaused:e=>ia=e,mouse:e=>X.mouseCat.trigger(e),renderer:B,printsMax:()=>{let e=X.prints.target,t=new Uint16Array(e.width*e.height*4);B.readRenderTargetPixels(e,0,0,e.width,e.height,t);let n=0,r=0;for(let e=0;e<t.length;e+=4){let i=m.fromHalfFloat(t[e]);i>.05&&r++,n=Math.max(n,i)}return{max:n,texels:r}}},B.setAnimationLoop(()=>{if(document.hidden||ia)return;na.update();let e=na.getDelta(),t=performance.now();Di.sample(e),ra=ra*.95+1/Math.max(e,.001)*.05,Hi(W.simTime),Ji(Math.min(e,1/20)),Ii(),X.update(Math.min(e,1/20)),Wi(Math.min(e,1/20)),K.uniforms.uIce.value=X.ice.texture,K.uniforms.uIceOn.value=+!!X.ice.enabled;let n=Q.update(Math.min(e,1/20),H,U,e=>(Ai.forceFor(e)??new x).add(X.weather.windForce(vt[e.kind])));ki.update(Math.min(e,1/20),H,U),Ai.update(Math.min(e,1/20)),W.setLoads([...qi,...n,...X.weather.loads()]),Bi(Math.min(e,1/20)),W.step(e),gi.update(B,Math.min(e,1/20)),mi.update(B,X.env.sunDir),Ci.render(e),fi.isOpen&&(aa.render(B,G,Q.toys.map(e=>e.body),U),fi.update(performance.now())),$.fps=Math.round(ra),$.cpuMs=+($.cpuMs*.9+(performance.now()-t)*.1).toFixed(1),$.substeps=W.lastPlan?.substeps??0,$.dtMs=+((W.lastPlan?.dt??0)*1e3).toFixed(3),$.simTime=+W.simTime.toFixed(2)});export{Rr as a,Cr as c,wr as i,Dr as l,Fr as n,Tr as o,Mr as r,Or as s,Lr as t,ln as u};