/* eslint-disable */
// @ts-nocheck
/**
 * 견적 요청 첫 화면(네 갈래)의 상징 그래픽. 2026-10-30 시안 v4 승인본을 옮김.
 * 한 카드에서 3D 구 → 키네틱 용어 → 굵은 한 줄 → 웰 플레이트가 이어 재생된다.
 * 색은 흑연 단색, 형광 노랑은 각 장면에서 "차이" 한 곳에만. 값은 그림용이며 시험 조건이 아니다.
 */
export type Kind = "tox" | "pd" | "pk" | "other";
export const W = 340, H = 260;
const INK = "#1b1b19", FAINT = "#adada6", TRACK = "#e9e9e4", ACC = "#edef5c";
let reduce = false;
export function setReduced(v: boolean) { reduce = v; }
var cl=function(x){return x<0?0:x>1?1:x},eo=function(t){t=cl(t);return 1-Math.pow(1-t,4)},
eio=function(t){t=cl(t);return t<.5?8*t*t*t*t:1-Math.pow(-2*t+2,4)/2},seg=function(t,a,b){return cl((t-a)/(b-a))},
back=function(t){t=cl(t);var c1=1.7,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)};
function rnd(s){return function(){s=(s*16807)%2147483647;return (s-1)/2147483646}}
function circ(c,x,y,r,f,hol,lw){if(r<=0)return;c.beginPath();c.arc(x,y,r,0,7);if(hol){c.lineWidth=lw||1.6;c.strokeStyle=f;c.stroke()}else{c.fillStyle=f;c.fill()}}
const G: Record<string, (c: CanvasRenderingContext2D, t: number) => void> = {};

/* 1. 3D 구 */
var SP=(function(){var a=[],n=420,g=Math.PI*(3-Math.sqrt(5));for(var i=0;i<n;i++){var y=1-2*(i+.5)/n,r=Math.sqrt(1-y*y),th=g*i;a.push([Math.cos(th)*r,y,Math.sin(th)*r])}return a})();
function sphere(c,t,radiusF,styleF,ring){var cx=W/2,cy=H/2+4,R=92,rot=t*2.4+.6,tilt=-.35;
  var pts=SP.map(function(p,i){var rr=radiusF(p,i);var x=p[0]*rr,y=p[1]*rr,z=p[2]*rr;
    var x2=x*Math.cos(rot)+z*Math.sin(rot),z2=-x*Math.sin(rot)+z*Math.cos(rot);
    var y3=y*Math.cos(tilt)-z2*Math.sin(tilt),z3=y*Math.sin(tilt)+z2*Math.cos(tilt);return {x:cx+x2*R,y:cy+y3*R,z:z3,p:p,i:i}});
  if(ring)ring(c,cx,cy,R,rot,tilt);
  pts.sort(function(a,b){return a.z-b.z}).forEach(function(q){var d=(q.z+1.3)/2.3;var st=styleF(q.p,q.i);
    c.globalAlpha=.25+.75*d;circ(c,q.x,q.y,(1.1+1.8*d)*(st.s||1),st.c||INK,st.h);c.globalAlpha=1})}
function band(c,cx,cy,R,lat,tilt,k){c.save();c.beginPath();c.lineWidth=9;c.strokeStyle=ACC;var r=Math.sqrt(1-lat*lat)*R;
  c.ellipse(cx,cy-lat*R*Math.cos(tilt),r,r*Math.abs(Math.sin(tilt))+2,0,0,Math.PI*2*k);c.stroke();c.restore()}
G['sphere-tox']=function(c,t){var k=eo(seg(t,.0,.25));var lim=.55-eio(seg(t,.35,.7))*.9;
  sphere(c,t,function(){return k},function(p){return {h:p[1]>lim&&t>.3}},function(c,cx,cy,R,r,ti){var b=eo(seg(t,.72,.86));if(b>0)band(c,cx,cy,R*k,-.35+0*lim,ti,b)})};
G['sphere-pd']=function(c,t){var heal=eio(seg(t,.3,.72));
  sphere(c,t,function(p,i){var dent=Math.max(0,p[0]*.6+p[1]*.7-.35)*.9;return (1-dent*(1-heal))*eo(seg(t,0,.2))*(1+.06*Math.sin(i))*(1-.06*heal*Math.sin(i))+0},
   function(p){var dent=p[0]*.6+p[1]*.7-.35>0;return {c:dent&&t>.74?INK:INK,s:dent&&t>.74?1.25:1}},
   function(c,cx,cy,R,r,ti){var b=eo(seg(t,.74,.88));if(b>0){c.beginPath();c.fillStyle=ACC;c.globalAlpha=.9;c.arc(cx+R*.42,cy-R*.36,30*b,0,7);c.fill();c.globalAlpha=1}})};
G['sphere-pk']=function(c,t){var lv=t<.42?eo(seg(t,.04,.42)):1-eio(seg(t,.55,.97))*.75;
  sphere(c,t,function(){return .25+.75*lv},function(p,i){return {h:i%3===0&&t>.6}},function(c,cx,cy,R,r,ti){var b=seg(t,.42,.5)*(1-seg(t,.62,.75));if(b>0){c.beginPath();c.lineWidth=8;c.strokeStyle=ACC;c.globalAlpha=b;c.arc(cx,cy,R+12,0,7);c.stroke();c.globalAlpha=1}})};

/* 2. 굵은 한 줄 */
function axis(c){c.fillStyle=TRACK;c.fillRect(28,H-34,W-56,3)}
function path(c,f,k,lw,col){var x0=34,x1=W-30;c.beginPath();var n=120;for(var i=0;i<=n*k;i++){var u=i/n,x=x0+(x1-x0)*u,y=f(u);i?c.lineTo(x,y):c.moveTo(x,y)}c.lineWidth=lw;c.lineCap='round';c.lineJoin='round';c.strokeStyle=col;c.stroke()}
G['line-tox']=function(c,t){axis(c);var f=function(u){return H-50-150/(1+Math.exp(-(u-.58)*13))};var k=eio(seg(t,.05,.6));
  var m=eo(seg(t,.62,.78));if(m>0){var u=.42,x=34+(W-64)*u;c.fillStyle=ACC;c.fillRect(x-4,40,8*m+0,(H-74)*m)}
  path(c,f,k,9,INK);if(k>=1)circ(c,34+(W-64)*.42,f(.42),9*m,INK)};
G['line-pd']=function(c,t){axis(c);var calm=eio(seg(t,.35,.75));var f=function(u){var base=H-120+Math.sin(u*7)*12;return base+(1-calm)*(Math.sin(u*55)*26+Math.sin(u*23+1)*18)};
  var ghost=function(u){return H-120+Math.sin(u*7)*12+Math.sin(u*55)*26+Math.sin(u*23+1)*18};
  var a=eo(seg(t,.74,.9));if(a>0){c.globalAlpha=a;c.beginPath();for(var i=0;i<=120;i++){var u=i/120;c.lineTo(34+(W-64)*u,ghost(u))}for(i=120;i>=0;i--){u=i/120;c.lineTo(34+(W-64)*u,f(u))}c.fillStyle=ACC;c.fill();c.globalAlpha=1}
  if(t>.35)path(c,ghost,1,2,FAINT);path(c,f,eio(seg(t,.0,.3)),9,INK)};
G['line-pk']=function(c,t){axis(c);var f=function(u){var x=u*12;return H-40-(Math.exp(-.3*x)-Math.exp(-1.7*x))*250};var k=eio(seg(t,.05,.65));
  var a=eo(seg(t,.65,.8));if(a>0){c.beginPath();c.moveTo(34,H-40);for(var i=0;i<=120;i++){var u=i/120;c.lineTo(34+(W-64)*u,f(u))}c.lineTo(W-30,H-40);c.closePath();c.fillStyle=TRACK;c.globalAlpha=a;c.fill();c.globalAlpha=1}
  path(c,f,k,9,INK);var p=eo(seg(t,.78,.92));var pu=.105;if(p>0&&k>=1){c.fillStyle=ACC;c.fillRect(34+(W-64)*pu-5,f(pu),10,(H-40-f(pu))*p);circ(c,34+(W-64)*pu,f(pu),11*p,INK)}};

/* 3. 웰 플레이트 */
function plate(c,fn){var cols=12,rows=8,g=25,x0=(W-g*(cols-1))/2,y0=(H-g*(rows-1))/2;for(var r=0;r<rows;r++)for(var q=0;q<cols;q++){var s=fn(q,r);var x=x0+q*g,y=y0+r*g;
  if(s.hl)circ(c,x,y,11.5,ACC);circ(c,x,y,9,TRACK);if(s.v>0)circ(c,x,y,9*s.v,INK,s.h,2.2)}}
G['plate-tox']=function(c,t){plate(c,function(q,r){var dose=Math.floor(q/2);var k=eo(seg(t,q*.04,q*.04+.2));var hit=dose>=3&&r<(dose-2)*3&&t>.55;return {v:k*(hit?1:.62),h:hit,hl:dose===3&&t>.75&&r<3}})};
G['plate-pd']=function(c,t){var rr=rnd(5);var m=[];for(var i=0;i<96;i++)m.push(rr());plate(c,function(q,r){var v=m[r*12+q];var sick=eo(seg(t,v*.25,v*.25+.15));var heal=q>=6?eio(seg(t,.4+(q-6)*.04,.55+(q-6)*.04)):0;
  return {v:sick*(1-heal*.75),hl:q>=6&&t>.78&&r===3}})};
G['plate-pk']=function(c,t){var conc=function(u){var x=u*12;return (Math.exp(-.3*x)-Math.exp(-1.7*x))/.62};plate(c,function(q,r){var idx=q,on=seg(t,idx*.045,idx*.045+.08);var lvl=conc(q/11);
  return {v:on*Math.min(1,lvl)*(r<Math.round(lvl*8)?1:0)+(on&&r===7?.3:0),hl:q===1&&t>.72}})};

/* 4. 키네틱 용어 */
function word(c,txt,x,y,size,alpha,col,hol){c.globalAlpha=alpha;c.font='700 '+size+'px "Pretendard Variable",Pretendard,sans-serif';c.textBaseline='alphabetic';
  if(hol){c.lineWidth=1.6;c.strokeStyle=col;c.strokeText(txt,x,y)}else{c.fillStyle=col;c.fillText(txt,x,y)}c.globalAlpha=1}
function hl(c,x,y,w,h,k){if(k>0){c.fillStyle=ACC;c.fillRect(x,y,w*k,h)}}
G['word-tox']=function(c,t){var L=['1x','3x','10x','30x'];L.forEach(function(s,i){var k=back(seg(t,i*.12,i*.12+.22));var y=70+i*52;
  if(i===1)hl(c,26,y-30,104,36,eo(seg(t,.72,.84)));word(c,s,30-30*(1-k),y,46,cl(k),INK,i>=2&&t>.55)});
  word(c,'NOAEL',150,70+52+0,24,eo(seg(t,.78,.9)),INK)};
G['word-pd']=function(c,t){var a=eio(seg(t,.2,.6));word(c,'Vehicle',30,96,34,eo(seg(t,0,.15)),FAINT);
  var w=40+a*220;c.fillStyle=TRACK;c.fillRect(30,110,260,18);c.fillStyle=INK;c.fillRect(30,110,80,18);
  word(c,'Treated',30,186,34,eo(seg(t,.1,.25)),INK);c.fillStyle=TRACK;c.fillRect(30,200,260,18);c.fillStyle=INK;c.fillRect(30,200,80+a*150,18);
  hl(c,110,200,150,18,eo(seg(t,.7,.84)));if(t>.7){c.fillStyle=INK;c.fillRect(30,200,80,18)}};
G['word-pk']=function(c,t){var L=['Cmax','Tmax','AUC','T½'];var i=Math.min(3,Math.floor(seg(t,.1,.7)*4.2));
  L.forEach(function(s,j){var y=60+j*54;var on=j<=i;var k=eo(seg(t,.1+j*.15,.25+j*.15));if(j===0)hl(c,26,y-34,140,40,eo(seg(t,.74,.86)));word(c,s,30+(1-k)*-24,y,j===0?48:40,on?k:.15,INK)})};


/* ---- Other: 개별 분석 ---- */
G['sphere-other']=function(c,t){var pull=eo(seg(t,.35,.6))*46;
  sphere(c,t*.4,function(){return eo(seg(t,0,.22))},function(p){var cut=p[0]>.55;return {s:cut&&t>.35?1-eo(seg(t,.35,.5)):1}},null);
  var k=eo(seg(t,.35,.6));if(k>0){var cx=W/2+92+pull*.4,cy=H/2-20-pull;c.globalCompositeOperation='source-over';
   var b=eo(seg(t,.68,.82));if(b>0){c.beginPath();c.fillStyle=ACC;c.arc(cx,cy,26*b,0,7);c.fill()}
   for(var i=0;i<14;i++){var a=i*2.4,r=4+(i%5)*3.4;circ(c,cx+Math.cos(a)*r,cy+Math.sin(a)*r,2.6*k,INK)}}};
G['word-other']=function(c,t){var L=['ELISA','qPCR','H&E','LC-MS/MS','micro-CT'];L.forEach(function(s,j){var y=52+j*46;var k=eo(seg(t,.05+j*.1,.2+j*.1));
  if(j===2)hl(c,26,y-30,82,36,eo(seg(t,.72,.84)));word(c,s,30+(1-k)*-24,y,j===2?40:34,k*(j===2||t<.72?1:.35),INK)})};
G['line-other']=function(c,t){axis(c);var pk=[[.18,40],[.33,90],[.5,150],[.66,60],[.82,110]];var f=function(u){var y=H-40;pk.forEach(function(p){y-=p[1]*Math.exp(-Math.pow((u-p[0])/.018,2))});return y};
  var m=eo(seg(t,.68,.82));if(m>0){c.beginPath();c.moveTo(34+(W-64)*.45,H-40);for(var i=0;i<=40;i++){var u=.45+i/400;c.lineTo(34+(W-64)*u,f(u))}c.lineTo(34+(W-64)*.55,H-40);c.closePath();c.fillStyle=ACC;c.globalAlpha=m;c.fill();c.globalAlpha=1}
  path(c,f,eio(seg(t,.05,.62)),5,INK)};
G['plate-other']=function(c,t){var pick={'2,1':1,'7,2':1,'4,4':1,'10,5':1,'1,6':1,'8,6':1};plate(c,function(q,r){var on=pick[q+','+r];var k=eo(seg(t,.1+((q*3+r)%7)*.06,.3+((q*3+r)%7)*.06));
  return {v:on?k:0,hl:on&&q===4&&r===4&&t>.72}})};


export const ORDER = ["sphere", "word", "line", "plate"];
export const SCENE = 3600, XF = 700, LOOP = SCENE * ORDER.length;
type Buf = { c: HTMLCanvasElement; x: CanvasRenderingContext2D; dpr: number };
export function buffer(): Buf { const c = document.createElement("canvas"); const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = W * dpr; c.height = H * dpr; const x = c.getContext("2d")!; x.scale(dpr, dpr); return { c, x, dpr }; }
/** e: 이 카드의 경과 시간(ms). A·B는 장면을 그려 둘 화면 밖 캔버스 */
export function drawCard(c: CanvasRenderingContext2D, kind: Kind, e: number, A: Buf, B: Buf, still: boolean) {
  e = ((e % LOOP) + LOOP) % LOOP;
  const si = Math.floor(e / SCENE), lt = e - si * SCENE, nx = (si + 1) % ORDER.length;
  const t = still ? 1 : cl(lt / (SCENE - XF)), out = still ? 0 : seg(lt, SCENE - XF, SCENE);
  const w = c.canvas.width, h = c.canvas.height;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
  A.x.clearRect(0, 0, W, H); G[ORDER[still ? 1 : si] + "-" + kind](A.x, t);
  const o = eio(out); c.globalAlpha = 1 - o; c.filter = o > 0 ? `blur(${o * 6}px)` : "none";
  const s = 1 + o * 0.08; c.setTransform(s, 0, 0, s, ((1 - s) * w) / 2, ((1 - s) * h) / 2); c.drawImage(A.c, 0, 0);
  if (o > 0) { B.x.clearRect(0, 0, W, H); G[ORDER[nx] + "-" + kind](B.x, eo(out) * 0.12); c.globalAlpha = o; c.filter = `blur(${(1 - o) * 6}px)`; const s2 = 0.92 + o * 0.08; c.setTransform(s2, 0, 0, s2, ((1 - s2) * w) / 2, ((1 - s2) * h) / 2); c.drawImage(B.c, 0, 0); }
  c.globalAlpha = 1; c.filter = "none"; c.setTransform(1, 0, 0, 1, 0, 0);
}
