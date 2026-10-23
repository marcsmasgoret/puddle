import{C as e,E as t,I as n,Lt as r,N as i,Nt as a,kt as o,q as s,st as c,ut as l,vt as u}from"./solver-BS7CYJ9p.js";import{c as d,i as f,n as p,o as m,s as h}from"./main-CEQ5Yt6G.js";function g(t,n,a){return new o({fog:!0,uniforms:r.merge([e.fog,e.lights,{uWall:{value:new i(t)},uNight:{value:n},uSeed:{value:a}}]),lights:!0,vertexShader:`
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
        vec2 cell = floor(vF / vec2(1.6, 3.0));
        vec2 f = fract(vF / vec2(1.6, 3.0));
        float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.8);
        // shopfront level: one long window, lit warm at night
        float shop = step(0.6, vF.y) * step(vF.y, 2.9) * step(0.08, fract(vF.x / 7.0)) * step(fract(vF.x / 7.0), 0.92);
        if (vF.y < 3.5) win = 0.0;
        // hemisphere ambient + sun, kept simple
        vec3 light = mix(hemisphereLights[0].groundColor, hemisphereLights[0].skyColor, vN.y * 0.5 + 0.5);
        light += directionalLights[0].color * max(dot(vN, directionalLights[0].direction), 0.0) * 0.6;
        vec3 col = uWall * light;
        vec3 glass = mix(vec3(0.16, 0.2, 0.26), vec3(0.45, 0.55, 0.65), 0.3) * light;
        col = mix(col, glass, win);
        // at night some windows glow warm: lamp-lit rooms, brighter toward
        // the ceiling, each a slightly different colour and strength
        float lit = step(0.6, h(cell)) * uNight;
        vec3 room = mix(vec3(0.62, 0.38, 0.16), vec3(0.55, 0.45, 0.3), h(cell + 7.0));
        col += win * lit * room * (0.25 + 0.35 * h(cell + 3.0)) * (0.7 + 0.5 * f.y);
        // shopfronts: panes between mullions, a dark sill, lit from the
        // ceiling inside; about two in three are open late
        float bay = floor(vF.x / 7.0);
        float pane = step(0.05, fract(vF.x / 1.75)) * step(fract(vF.x / 1.75), 0.95);
        float shopLit = step(0.35, h(vec2(bay, 9.0))) * uNight;
        float sill = smoothstep(0.6, 0.75, vF.y);
        col = mix(col, glass * 0.8, shop);
        vec3 shopCol = mix(vec3(0.6, 0.42, 0.22), vec3(0.5, 0.48, 0.4), h(vec2(bay, 4.0)));
        col += shop * pane * sill * shopLit * shopCol * (0.14 + 0.24 * smoothstep(0.6, 2.9, vF.y));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`})}var _={id:`city`,shape:()=>({kind:`blob`,seed:11,rx:1,rz:.5,wobble:.9}),ground:{style:`asphalt`,a:`#56575b`,b:`#4b4c50`,c:`#e2c75a`,bed:`#45464a`,bedAccent:`#5a5a5c`},critters:{mouse:{from:[-2.6,-4.13],to:[1.6,-4.13],hide:`drain`},habitat:{birds:[`crows`,`songbirds`],trees:[[-3.2,-5.4],[8.6,-5.5],[-11,-5.3]]}},freezes:()=>!0,build(e){let{mood:r,season:o}=e,_=r.haze,v=r.night,y=new s,b=d(9),x=new l({color:o===`winter`?`#c9ccd0`:`#a7a49c`,roughness:.9}),S=new c(new t(60,.13,.18),x);S.position.set(0,.065,-4.29);let C=new c(new t(60,.13,3.2),x);C.position.set(0,.065,-5.98),S.receiveShadow=C.receiveShadow=!0,y.add(m(S),m(C));let w=new c(new t(.6,.1,.04),new l({color:`#1d1e21`,roughness:.6,metalness:.6}));w.position.set(1.6,.05,-4.195),y.add(w);let T=[`#b98f74`,`#8f9aa6`,`#c9b79c`,`#7e6e66`,`#a3a9a0`,`#c4a28a`],E=-46;for(;E<46;){let e=6+b()*9;if(E+e>-5.5&&E<5.5){E=5.5;continue}let n=9+b()*22,r=new c(new t(e,n,10),g(T[Math.floor(b()*T.length)],v,b()*100));r.position.set(E+e/2,n/2,-12.8-b()*1.5),y.add(m(r)),E+=e+.2}for(let e=0;e<6;e++){let n=7+b()*6,r=14+b()*30,i=e%2?1:-1,a=new c(new t(n,r,12),g(T[Math.floor(b()*T.length)],v,b()*100));a.position.set(i*(5.5+n/2+b()*2),r/2,-29.8-Math.floor(e/2)*18),y.add(m(a))}y.add(h({z:-260,width:900,base:0,hill:4,color:f(`#5b6476`,_,260,260).lerp(new i(`#202838`),v*.6),haze:_,mist:.3,seed:4,extra:e=>{let t=Math.floor((e+450)/22),n=Math.abs(Math.sin(t*12.9898)*43758.5453)%1;return n>.35?20+n*90:0}}));let D=new l({color:`#2b2e33`,roughness:.5,metalness:.4}),O=new l({color:`#fff2d0`,emissive:new i(`#ffd28a`),emissiveIntensity:v*6+.2});for(let e of[-7.5,4.5,14]){let r=new c(new n(.05,.07,5,8),D);r.position.set(e,2.5,-4.8);let i=new c(new t(.9,.06,.08),D);i.position.set(e+.4,4.95,-4.8);let o=new c(new a(.16,16,8),O);if(o.position.set(e+.85,4.85,-4.8),r.castShadow=!0,y.add(m(r),m(i),m(o)),v>.5){let e=new u(`#ffcf8a`,14,14,1.6);e.position.copy(o.position),y.add(e)}}return y.add(p([[-3.2,-5.4,5.5],[8.6,-5.5,5.8],[-11,-5.300000000000001,5.2]],o,21)),{group:y}}};export{_ as default};