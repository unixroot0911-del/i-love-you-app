/* Gives the page its shared drawing, saved data and live partner link, using Firebase Realtime Database. */
(function(){
var cfg=window.FIREBASE_CONFIG||{},DB=null,uid;
try{uid=localStorage.getItem('ly_uid');if(!uid){uid='u'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);localStorage.setItem('ly_uid',uid)}}catch(e){uid='u'+Math.random().toString(36).slice(2,10)}
if(window.firebase&&cfg.databaseURL&&cfg.databaseURL.indexOf('PASTE')<0){try{firebase.initializeApp({databaseURL:cfg.databaseURL});DB=firebase.database()}catch(e){DB=null}}
function clean(d){return JSON.parse(JSON.stringify(d))}
function snap(type,id,val){return{metadata:{fromCache:false},docChanges:function(){return[{type:type,doc:{id:id,data:function(){return val}}}]},docs:[{id:id,data:function(){return val}}]}}
var api={user:{id:function(){return Promise.resolve(uid)}},db:null,room:null};
if(DB){
api.db={collection:function(name){var ref=DB.ref('c/'+name);return{
doc:function(id){var r=ref.child(id);return{set:function(d){return r.set(clean(d))},update:function(d){return r.update(clean(d))},delete:function(){return r.remove()}}},
orderBy:function(){return this},
onSnapshot:function(next,err){
ref.once('value').then(function(){next({metadata:{fromCache:false},docChanges:function(){return[]},docs:[]})},function(e){if(err)err(e)});
ref.on('child_added',function(s){next(snap('added',s.key,s.val()))},function(e){if(err)err(e)});
ref.on('child_changed',function(s){next(snap('modified',s.key,s.val()))});
ref.on('child_removed',function(s){next(snap('removed',s.key,s.val()))})}}}};
var pr=DB.ref('presence'),me=pr.child(uid),peers={},armed=false;
pr.on('value',function(s){peers=s.val()||{}});
api.room={peers:function(){return Object.keys(peers).filter(function(k){return k!==uid}).map(function(k){return{isMe:false,kind:'viewer',by:k,presence:peers[k]}})},
presence:function(p){if(!armed){armed=true;me.onDisconnect().remove()}return me.update(clean(p))}};
}
window.claude={use:function(n){return Promise.resolve(api[n]||null)}};
})();
