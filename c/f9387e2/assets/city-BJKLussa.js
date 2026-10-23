import{D as e,P as t,S as n,c as r,d as i,f as a,g as o,i as s,j as c,k as l,n as u,o as d,s as f,v as p,w as m,x as h}from"./index-0-6mqhp9.js";function g(e,n,r){return new l({fog:!0,uniforms:t.merge([i.fog,i.lights,{uWall:{value:new o(e)},uNight:{value:n},uSeed:{value:r}}]),lights:!0,vertexShader:`
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
        // at night some windows glow warm
        float lit = step(0.6, h(cell)) * uNight;
        col += win * lit * vec3(0.9, 0.62, 0.32) * (0.6 + 0.6 * h(cell + 3.0));
        col = mix(col, glass, shop * 0.8);
        col += shop * uNight * vec3(0.8, 0.6, 0.38) * step(0.3, h(vec2(floor(vF.x / 7.0), 9.0)));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`})}var _={id:`city`,shape:()=>({kind:`blob`,seed:11,rx:1,rz:.5,wobble:.9}),ground:{style:`asphalt`,a:`#56575b`,b:`#4b4c50`,c:`#e2c75a`,bed:`#45464a`,bedAccent:`#5a5a5c`},freezes:()=>!0,build(t){let{mood:i,season:l}=t,_=i.haze,v=i.night,y=new h,b=r(9),x=new m({color:l===`winter`?`#c9ccd0`:`#a7a49c`,roughness:.9}),S=new n(new a(60,.13,.18),x);S.position.set(0,.065,-4.29);let C=new n(new a(60,.13,3.2),x);C.position.set(0,.065,-5.98),S.receiveShadow=C.receiveShadow=!0,y.add(d(S),d(C));let w=new n(new a(.6,.1,.04),new m({color:`#1d1e21`,roughness:.6,metalness:.6}));w.position.set(1.6,.05,-4.195),y.add(w);let T=[`#b98f74`,`#8f9aa6`,`#c9b79c`,`#7e6e66`,`#a3a9a0`,`#c4a28a`],E=-46;for(;E<46;){let e=6+b()*9;if(E+e>-5.5&&E<5.5){E=5.5;continue}let t=9+b()*22,r=new n(new a(e,t,10),g(T[Math.floor(b()*T.length)],v,b()*100));r.position.set(E+e/2,t/2,-12.8-b()*1.5),y.add(d(r)),E+=e+.2}for(let e=0;e<6;e++){let t=7+b()*6,r=14+b()*30,i=e%2?1:-1,o=new n(new a(t,r,12),g(T[Math.floor(b()*T.length)],v,b()*100));o.position.set(i*(5.5+t/2+b()*2),r/2,-29.8-Math.floor(e/2)*18),y.add(d(o))}y.add(f({z:-260,width:900,base:0,hill:4,color:s(`#5b6476`,_,260,260).lerp(new o(`#202838`),v*.6),haze:_,mist:.3,seed:4,extra:e=>{let t=Math.floor((e+450)/22),n=Math.abs(Math.sin(t*12.9898)*43758.5453)%1;return n>.35?20+n*90:0}}));let D=new m({color:`#2b2e33`,roughness:.5,metalness:.4}),O=new m({color:`#fff2d0`,emissive:new o(`#ffd28a`),emissiveIntensity:v*6+.2});for(let t of[-7.5,4.5,14]){let r=new n(new p(.05,.07,5,8),D);r.position.set(t,2.5,-4.8);let i=new n(new a(.9,.06,.08),D);i.position.set(t+.4,4.95,-4.8);let o=new n(new c(.16,16,8),O);if(o.position.set(t+.85,4.85,-4.8),r.castShadow=!0,y.add(d(r),d(i),d(o)),v>.5){let t=new e(`#ffcf8a`,14,14,1.6);t.position.copy(o.position),y.add(t)}}return y.add(u([[-3.2,-5.4,5.5],[8.6,-5.5,5.8],[-11,-5.300000000000001,5.2]],l,21)),{group:y}}};export{_ as default};