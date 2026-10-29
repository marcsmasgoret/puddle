import{I as e,Mt as t,R as n,Rt as r,Ut as i,X as a,dt as o,k as s,pt as c,ut as l,w as u,xt as d,z as f}from"./solver-C7fnSGy1.js";import{a as p,c as m,l as h,m as g,n as _,o as v,r as y,u as b}from"./main-BeYM3k8Y.js";import{t as x}from"./RoundedBoxGeometry-Bwu-6gTL.js";function S(t,n){let r=new a,i=new c({color:t,roughness:.3,metalness:.5}),o=new c({color:`#1f272f`,roughness:.1,metalness:.6}),u=new c({color:`#1a1a1c`,roughness:.9}),d=new l(new x(4.3,.75,1.8,3,.18),i);d.position.y=.62;let p=new l(new x(2.3,.62,1.62,3,.16),o);p.position.set(-.25,1.22,0);let h=new l(new x(1.9,.08,1.5,2,.04),i);h.position.set(-.3,1.53,0),r.add(d,p,h);for(let e of[-1.38,1.38])for(let t of[-.82,.82]){let n=new l(new f(.33,.33,.24,16),u);n.rotation.x=Math.PI/2,n.position.set(e,.33,t),r.add(n)}let g=(t,n,i)=>{for(let a of[-.62,.62]){let o=new l(new s(.06,.12,.3),new c({color:n,emissive:new e(n),emissiveIntensity:i}));o.position.set(t,.75,a),r.add(o)}};return g(2.15,`#fff6e0`,.2),g(-2.15,`#c0201a`,.3+n*.5),r.traverse(e=>e.castShadow=!0),m(r)}function C(){let e=new c({color:`#c42a1e`,roughness:.5}),t=new a,n=new l(new f(.11,.13,.55,14),e);n.position.y=.28;let i=new l(new r(.12,14,8,0,Math.PI*2,0,Math.PI/2),e);i.position.y=.55;let o=new l(new f(.03,.04,.06,6),e);o.position.y=.68;let s=new l(new f(.045,.045,.36,10),e);return s.rotation.z=Math.PI/2,s.position.y=.38,t.add(n,i,o,s),t.traverse(e=>e.castShadow=!0),m(t)}function w(n,r,a){return new t({fog:!0,uniforms:i.merge([u.fog,u.lights,{uWall:{value:new e(n)},uNight:{value:r},uSeed:{value:a}}]),lights:!0,vertexShader:`
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vF;
      varying vec3 vN;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vF = vec2(abs(normal.x) > 0.5 ? w.z : w.x, w.y);
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,fragmentShader:`
      #include <common>
      #include <fog_pars_fragment>
      #include <lights_pars_begin>
      uniform vec3 uWall;
      uniform float uNight, uSeed;
      varying vec2 vF;
      varying vec3 vN;
      float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
      void main() {
        // each building has its own rhythm: floor height, bay width, window size
        float st = h(vec2(3.1, 7.7));
        vec2 bay = vec2(1.4 + 0.8 * st, 3.0 + 0.5 * h(vec2(1.3, 2.9)));
        float ww = 0.5 + 0.25 * h(vec2(5.5, 1.1)), wh = 0.5 + 0.15 * h(vec2(9.1, 4.4));
        vec2 cell = floor(vF / bay);
        vec2 f = fract(vF / bay);
        float x0 = 0.5 - ww / 2.0, x1 = 0.5 + ww / 2.0, y0 = 0.28, y1 = 0.28 + wh;
        float win = step(x0, f.x) * step(f.x, x1) * step(y0, f.y) * step(f.y, y1);
        // the window's reveal: a frame and a shadowed recess at the top and left
        float fr = 0.035;
        float frame = win * (1.0 - step(x0 + fr, f.x) * step(f.x, x1 - fr) * step(y0 + fr * 1.5, f.y) * step(f.y, y1 - fr * 1.5));
        float recess = win * smoothstep(y1 - 0.14, y1, f.y);
        // sill below and lintel above each window, string courses between floors
        float sill = step(x0 - 0.04, f.x) * step(f.x, x1 + 0.04) * step(y0 - 0.05, f.y) * step(f.y, y0);
        float lintel = step(x0 - 0.02, f.x) * step(f.x, x1 + 0.02) * step(y1, f.y) * step(f.y, y1 + 0.04);
        float course = step(0.97, f.y) * step(0.5, h(vec2(8.2, 0.3)));
        // shopfront level: one long window, lit warm at night
        float shop = step(0.6, vF.y) * step(vF.y, 2.9) * step(0.08, fract(vF.x / 7.0)) * step(fract(vF.x / 7.0), 0.92);
        if (vF.y < 3.5) { win = 0.0; frame = 0.0; sill = 0.0; lintel = 0.0; course = 0.0; }
        // hemisphere ambient + sun, kept simple
        vec3 light = mix(hemisphereLights[0].groundColor, hemisphereLights[0].skyColor, vN.y * 0.5 + 0.5);
        light += directionalLights[0].color * max(dot(vN, directionalLights[0].direction), 0.0) * 0.6;
        // brick or render: a faint running bond on most buildings
        vec2 bk = vF * vec2(4.0, 13.0);
        bk.x += step(1.0, mod(floor(bk.y), 2.0)) * 0.5;
        float brick = step(0.45, h(vec2(2.2, 6.6))) * (h(floor(bk)) - 0.5) * 0.12;
        float mortar = step(0.45, h(vec2(2.2, 6.6))) * (1.0 - step(0.06, fract(bk.y)) * step(0.04, fract(bk.x))) * 0.12;
        vec3 col = uWall * (1.0 + brick - mortar) * light;
        col = mix(col, uWall * 1.25 * light, max(max(sill, lintel), course) * 0.8);
        // glass: reflects the sky (brighter looking up), some with blinds drawn
        float blind = step(0.75, h(cell + 2.0));
        vec3 sky = mix(vec3(0.2, 0.25, 0.32), vec3(0.55, 0.65, 0.78), clamp(0.3 + 0.02 * vF.y + 0.25 * h(cell + 5.0), 0.0, 1.0));
        vec3 glass = mix(sky * light * 0.55, vec3(0.75, 0.72, 0.64) * light * 0.5, blind * 0.6);
        glass *= 1.0 - 0.35 * recess;
        col = mix(col, glass, win);
        col = mix(col, uWall * 0.55 * light, frame);
        // at night some windows glow warm: lamp-lit rooms, brighter toward
        // the ceiling, each a slightly different colour and strength
        float lit = step(0.6, h(cell)) * uNight;
        vec3 room = mix(vec3(0.62, 0.38, 0.16), vec3(0.55, 0.45, 0.3), h(cell + 7.0));
        col += (win - frame) * lit * room * (0.25 + 0.35 * h(cell + 3.0)) * (0.7 + 0.5 * f.y);
        // shopfronts: panes between mullions, a dark sill, lit from the
        // ceiling inside; about two in three are open late
        float sbay = floor(vF.x / 7.0);
        float pane = step(0.05, fract(vF.x / 1.75)) * step(fract(vF.x / 1.75), 0.95);
        float shopLit = step(0.35, h(vec2(sbay, 9.0))) * uNight;
        float ssill = smoothstep(0.6, 0.75, vF.y);
        vec3 shopGlass = mix(vec3(0.16, 0.2, 0.26), vec3(0.4, 0.46, 0.5), 0.3 + 0.3 * h(vec2(sbay, 1.0))) * light;
        col = mix(col, shopGlass * 0.8, shop);
        col = mix(col, uWall * 0.4 * light, shop * (1.0 - pane));
        vec3 shopCol = mix(vec3(0.6, 0.42, 0.22), vec3(0.5, 0.48, 0.4), h(vec2(sbay, 4.0)));
        col += shop * pane * ssill * shopLit * shopCol * (0.14 + 0.24 * smoothstep(0.6, 2.9, vF.y));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`})}var T={id:`city`,shape:()=>({kind:`blob`,seed:11,rx:1,rz:.5,wobble:.9}),ground:{style:`asphalt`,a:`#56575b`,b:`#4b4c50`,c:`#e2c75a`,bed:`#45464a`,bedAccent:`#5a5a5c`},critters:{mouse:{from:[-2.6,-4.13],to:[1.6,-4.13],hide:`drain`},habitat:{birds:[`crows`,`songbirds`],trees:[[-3.2,-5.4],[8.6,-5.5],[-11,-5.3]]}},freezes:()=>!0,build(t){let{mood:i,season:u}=t,x=i.haze,T=i.night,E=new a,D=b(9),O=new c({color:u===`winter`?`#c9ccd0`:`#a7a49c`,roughness:.9}),k=new l(new s(60,.13,.18),O);k.position.set(0,.065,-4.29);let A=new l(new s(60,.13,3.2),O);A.position.set(0,.065,-5.98),k.receiveShadow=A.receiveShadow=!0,E.add(m(k),m(A));let j=new l(new s(.6,.1,.04),new c({color:`#1d1e21`,roughness:.6,metalness:.6}));j.position.set(1.6,.05,-4.195),E.add(j);let M=[`#b98f74`,`#8f9aa6`,`#c9b79c`,`#7e6e66`,`#a3a9a0`,`#c4a28a`],N=-46,P=new c({color:`#d8d2c6`,roughness:.8}),F=new c({color:`#7d8186`,roughness:.5,metalness:.5}),I=[`#2f5d50`,`#8a2e2a`,`#273a5c`,`#5a4632`,`#a0602a`];for(;N<46;){let e=6+D()*9;if(N+e>-5.5&&N<5.5){N=5.5;continue}let t=9+D()*22,r=M[Math.floor(D()*M.length)],i=new l(new s(e,t,10),w(r,T,D()*100)),o=-7.800000000000001-D()*1.5;i.position.set(N+e/2,t/2,o-5),E.add(m(i));let u=new l(new s(e+.3,.45,10.3),P);u.position.set(N+e/2,t+.1,o-5);let d=new l(new s(e,.35,.16),P);d.position.set(N+e/2,3.15,o+.08),E.add(m(u),m(d));for(let t=N+.5;t+6<N+e;t+=7){if(D()<.35)continue;let e=new l(new s(6,.05,1.3),new c({color:I[Math.floor(D()*I.length)],roughness:.85}));e.position.set(t+3,2.85,o+.6),e.rotation.x=.35,e.castShadow=!0,E.add(m(e))}if(D()<.45){let r=new a,i=new l(new f(1.1,1.1,2,16),new c({color:`#7a5a40`,roughness:.9}));i.position.y=2.6;let u=new l(new n(1.2,.8,16),new c({color:`#4d4a46`,roughness:.7}));u.position.y=4,r.add(i,u);for(let[e,t]of[[-.7,-.7],[.7,-.7],[-.7,.7],[.7,.7]]){let n=new l(new s(.1,1.6,.1),F);n.position.set(e,.8,t),r.add(n)}r.position.set(N+e*(.3+.4*D()),t+.3,o-6),E.add(m(r))}else for(let n=0;n<2;n++){let n=new l(new s(1.4,.9,1),F);n.position.set(N+e*(.25+.5*D()),t+.75,o-2-D()*5),E.add(m(n))}N+=e+.2}for(let e=0;e<6;e++){let t=7+D()*6,n=14+D()*30,r=e%2?1:-1,i=new l(new s(t,n,12),w(M[Math.floor(D()*M.length)],T,D()*100));i.position.set(r*(5.5+t/2+D()*2),n/2,-29.8-Math.floor(e/2)*18),E.add(m(i))}if(E.add(h({z:-260,width:900,base:0,hill:4,color:p(`#5b6476`,x,260,260).lerp(new e(`#202838`),T*.6),haze:x,mist:.3,seed:4,extra:e=>{let t=Math.floor((e+450)/22),n=Math.abs(Math.sin(t*12.9898)*43758.5453)%1;return n>.35?20+n*90:0}})),T>0){let e=[];for(let t=0;t<900/22;t++){let n=Math.abs(Math.sin(t*12.9898)*43758.5453)%1;if(n<=.35)continue;let r=t*22-450;e.push([r+2,r+20,3,20+n*90-2,-257])}E.add(v(g(e,3.6,.32,11),T,{size:1.8,gain:1.1}))}{let t=new o({color:p(`#6b7484`,x,3e3,4e3).lerp(new e(`#1b2233`),T*.7),fog:!1}),n=new o({color:new e(`#ffb070`).multiplyScalar(.2+T*2),fog:!1}),r=y(t,n,T);r.scale.setScalar(900/3e3),r.position.set(40,0,-900),E.add(m(r))}let L=new c({color:`#2b2e33`,roughness:.5,metalness:.4}),R=new c({color:`#fff2d0`,emissive:new e(`#ffd28a`),emissiveIntensity:T*6+.2});for(let e of[-7.5,4.5,14]){let t=new l(new f(.05,.07,5,8),L);t.position.set(e,2.5,-4.8);let n=new l(new s(.9,.06,.08),L);n.position.set(e+.4,4.95,-4.8);let i=new l(new r(.16,16,8),R);if(i.position.set(e+.85,4.85,-4.8),t.castShadow=!0,E.add(m(t),m(n),m(i)),T>.5){let e=new d(`#ffcf8a`,14,14,1.6);e.position.copy(i.position),E.add(e)}}let z=[`#9aa3ab`,`#2a3440`,`#7a1f22`,`#e8e6e0`,`#33503f`];for(let[e,t]of[[-5.3,0],[5.4,2],[12.5,3]]){let n=S(z[t],T);n.position.set(e,0,-3.1500000000000004),n.rotation.y=t%2?0:Math.PI,E.add(n)}let B=C();return B.position.set(2.7,.13,-4.75),E.add(B),E.add(_([[-3.2,-5.4,5.5],[8.6,-5.5,5.8],[-11,-5.300000000000001,5.2]],u,21)),{group:E}}};export{T as default};