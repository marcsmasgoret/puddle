import{At as e,C as t,D as n,It as r,J as i,L as a,P as o,Vt as s,ct as c,dt as l,lt as u,yt as d}from"./solver-Ce6RO4Es.js";import{a as f,c as p,f as m,l as h,n as g,o as _,r as v,u as y}from"./main-CN9NwTH1.js";function b(n,r,i){return new e({fog:!0,uniforms:s.merge([t.fog,t.lights,{uWall:{value:new o(n)},uNight:{value:r},uSeed:{value:i}}]),lights:!0,vertexShader:`
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
      }`})}var x={id:`city`,shape:()=>({kind:`blob`,seed:11,rx:1,rz:.5,wobble:.9}),ground:{style:`asphalt`,a:`#56575b`,b:`#4b4c50`,c:`#e2c75a`,bed:`#45464a`,bedAccent:`#5a5a5c`},critters:{mouse:{from:[-2.6,-4.13],to:[1.6,-4.13],hide:`drain`},habitat:{birds:[`crows`,`songbirds`],trees:[[-3.2,-5.4],[8.6,-5.5],[-11,-5.3]]}},freezes:()=>!0,build(e){let{mood:t,season:s}=e,x=t.haze,S=t.night,C=new i,w=y(9),T=new l({color:s===`winter`?`#c9ccd0`:`#a7a49c`,roughness:.9}),E=new c(new n(60,.13,.18),T);E.position.set(0,.065,-4.29);let D=new c(new n(60,.13,3.2),T);D.position.set(0,.065,-5.98),E.receiveShadow=D.receiveShadow=!0,C.add(p(E),p(D));let O=new c(new n(.6,.1,.04),new l({color:`#1d1e21`,roughness:.6,metalness:.6}));O.position.set(1.6,.05,-4.195),C.add(O);let k=[`#b98f74`,`#8f9aa6`,`#c9b79c`,`#7e6e66`,`#a3a9a0`,`#c4a28a`],A=-46;for(;A<46;){let e=6+w()*9;if(A+e>-5.5&&A<5.5){A=5.5;continue}let t=9+w()*22,r=new c(new n(e,t,10),b(k[Math.floor(w()*k.length)],S,w()*100));r.position.set(A+e/2,t/2,-12.8-w()*1.5),C.add(p(r)),A+=e+.2}for(let e=0;e<6;e++){let t=7+w()*6,r=14+w()*30,i=e%2?1:-1,a=new c(new n(t,r,12),b(k[Math.floor(w()*k.length)],S,w()*100));a.position.set(i*(5.5+t/2+w()*2),r/2,-29.8-Math.floor(e/2)*18),C.add(p(a))}if(C.add(h({z:-260,width:900,base:0,hill:4,color:f(`#5b6476`,x,260,260).lerp(new o(`#202838`),S*.6),haze:x,mist:.3,seed:4,extra:e=>{let t=Math.floor((e+450)/22),n=Math.abs(Math.sin(t*12.9898)*43758.5453)%1;return n>.35?20+n*90:0}})),S>0){let e=[];for(let t=0;t<900/22;t++){let n=Math.abs(Math.sin(t*12.9898)*43758.5453)%1;if(n<=.35)continue;let r=t*22-450;e.push([r+2,r+20,3,20+n*90-2,-257])}C.add(_(m(e,3.6,.32,11),S,{size:1.8,gain:1.1}))}{let e=new u({color:f(`#6b7484`,x,3e3,4e3).lerp(new o(`#1b2233`),S*.7),fog:!1}),t=new u({color:new o(`#ffb070`).multiplyScalar(.2+S*2),fog:!1}),n=v(e,t,S);n.scale.setScalar(900/3e3),n.position.set(40,0,-900),C.add(p(n))}let j=new l({color:`#2b2e33`,roughness:.5,metalness:.4}),M=new l({color:`#fff2d0`,emissive:new o(`#ffd28a`),emissiveIntensity:S*6+.2});for(let e of[-7.5,4.5,14]){let t=new c(new a(.05,.07,5,8),j);t.position.set(e,2.5,-4.8);let i=new c(new n(.9,.06,.08),j);i.position.set(e+.4,4.95,-4.8);let o=new c(new r(.16,16,8),M);if(o.position.set(e+.85,4.85,-4.8),t.castShadow=!0,C.add(p(t),p(i),p(o)),S>.5){let e=new d(`#ffcf8a`,14,14,1.6);e.position.copy(o.position),C.add(e)}}return C.add(g([[-3.2,-5.4,5.5],[8.6,-5.5,5.8],[-11,-5.300000000000001,5.2]],s,21)),{group:C}}};export{x as default};