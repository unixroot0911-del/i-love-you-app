/* Direct phone-to-phone link (no accounts, no setup). Each phone keeps a full copy and they sync live. */
(function(){
var ROOM='lylove-c9920e4958b3';
var ICE=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},
{urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},
{urls:'turn:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'},
{urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'}];
var uid,store={},listeners={},conns=[],myPres={},partner=null,partnerPres=null,peer=null,role=null,saveT=0,wasLinked=false;
try{uid=localStorage.getItem('ly_uid');if(!uid){uid='u'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);localStorage.setItem('ly_uid',uid)}}catch(e){uid='u'+Math.random().toString(36).slice(2,10)}
try{store=JSON.parse(localStorage.getItem('ly_db')||'{}')}catch(e){store={}}
function persist(now){if(now){clearTimeout(saveT);saveT=0;try{localStorage.setItem('ly_db',JSON.stringify(store))}catch(e){}return}if(saveT)return;saveT=setTimeout(function(){saveT=0;try{localStorage.setItem('ly_db',JSON.stringify(store))}catch(e){}},1500)}
addEventListener('pagehide',function(){persist(true)});
function clean(d){return JSON.parse(JSON.stringify(d))}
function snap(type,id,val){return{metadata:{fromCache:false},docChanges:function(){return[{type:type,doc:{id:id,data:function(){return val}}}]},docs:[{id:id,data:function(){return val}}]}}
function ent(c,id){return store[c]&&store[c][id]}
function apply(c,id,e){var cur=ent(c,id);if(cur&&cur.v>=e.v)return false;
var type=e.x?'removed':(!cur||cur.x?'added':'modified'),had=cur&&!cur.x;
(store[c]=store[c]||{})[id]=e;persist();
if(e.x&&!had)return true;
(listeners[c]||[]).forEach(function(l){try{l.next(snap(type,id,e.d))}catch(err){}});return true}
function send(m){conns.forEach(function(c){if(c.open){try{c.send(m)}catch(e){}}})}
function wr(c,id,d,merge){var cur=ent(c,id),base=cur&&!cur.x?cur.d:null,e={v:(cur?cur.v:0)+1,x:0,d:merge?Object.assign({},base||{},clean(d)):clean(d)};apply(c,id,e);send({t:'docs',l:[[c,id,e]]})}
function del(c,id){var cur=ent(c,id),e={v:(cur?cur.v:0)+1,x:1,d:null};apply(c,id,e);send({t:'docs',l:[[c,id,e]]})}
function idx(){var o={};Object.keys(store).forEach(function(c){Object.keys(store[c]).forEach(function(i){o[c+'/'+i]=store[c][i].v})});return o}
function linked(){return conns.some(function(c){return c.open})}
function notify(){var on=linked();if(on!==wasLinked){wasLinked=on;if(window.__link)try{window.__link(on)}catch(e){}}}
function setup(conn){
conn.on('open',function(){if(conns.indexOf(conn)<0)conns.push(conn);conn.send({t:'hello',uid:uid,idx:idx(),pres:myPres});notify()});
conn.on('data',function(m){if(!m)return;
if(m.t==='hello'){partner=m.uid;partnerPres=m.pres||{};var out=[];
Object.keys(store).forEach(function(c){Object.keys(store[c]).forEach(function(i){var e=store[c][i],k=c+'/'+i;if(!(m.idx&&m.idx[k]>=e.v))out.push([c,i,e])})});
for(var j=0;j<out.length;j+=25)conn.send({t:'docs',l:out.slice(j,j+25)});notify()}
else if(m.t==='docs'){(m.l||[]).forEach(function(x){apply(x[0],x[1],x[2])})}
else if(m.t==='pres'){partnerPres=Object.assign(partnerPres||{},m.p||{})}});
function gone(){var k=conns.indexOf(conn);if(k>=0)conns.splice(k,1);if(!linked())partnerPres=null;notify()}
conn.on('close',gone);conn.on('error',gone)}
var tryIdx=0,delay=300;
function reg(){try{if(peer)peer.destroy()}catch(e){}
var ids=[ROOM+'-a',ROOM+'-b'];role=ids[tryIdx];
try{peer=new Peer(role,{config:{iceServers:ICE},debug:0})}catch(e){setTimeout(reg,8000);return}
var me=peer;
peer.on('open',function(){delay=300;conns.length=0;notify()});
peer.on('connection',setup);
peer.on('disconnected',function(){try{me.reconnect()}catch(e){}});
peer.on('close',function(){if(me===peer)setTimeout(reg,5000)});
peer.on('error',function(err){var t=err&&err.type;
if(t==='unavailable-id'){tryIdx=1-tryIdx;delay=Math.min(delay*1.6,15000);setTimeout(reg,delay+Math.random()*800)}
else if(t==='peer-unavailable'){}
else if(t==='network'||t==='server-error'||t==='socket-error'||t==='socket-closed'){setTimeout(reg,8000)}})}
function tick(){if(!peer||!peer.open||linked())return;var other=role===ROOM+'-a'?ROOM+'-b':ROOM+'-a';try{setup(peer.connect(other,{reliable:true}))}catch(e){}}
setInterval(tick,3500);
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){if(!peer||peer.destroyed||peer.disconnected)reg();else tick()}});
addEventListener('online',function(){reg()});
var api={user:{id:function(){return Promise.resolve(uid)}},db:{collection:function(name){return{
doc:function(id){return{set:function(d){wr(name,id,d,false);return Promise.resolve()},update:function(d){wr(name,id,d,true);return Promise.resolve()},delete:function(){del(name,id);return Promise.resolve()}}},
orderBy:function(){return this},
onSnapshot:function(next){(listeners[name]=listeners[name]||[]).push({next:next});
var ids=Object.keys(store[name]||{}).filter(function(i){return!store[name][i].x});
setTimeout(function(){next({metadata:{fromCache:false},docChanges:function(){return ids.map(function(i){return{type:'added',doc:{id:i,data:function(){return store[name][i].d}}}})},docs:ids.map(function(i){return{id:i,data:function(){return store[name][i].d}}})})},0)}}}},
room:{peers:function(){return linked()&&partnerPres?[{isMe:false,kind:'viewer',by:partner,presence:partnerPres}]:[]},
presence:function(p){p=clean(p);Object.assign(myPres,p);send({t:'pres',p:p});return Promise.resolve()}}};
window.claude={use:function(n){return Promise.resolve(api[n]||null)}};
if(typeof Peer!=='undefined')reg();
})();
