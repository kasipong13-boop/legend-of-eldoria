/* Experimental ordered ravine loop validator; no runtime or Save Engine hooks. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root&&root.ELDORIA)root.ELDORIA.SurfaceRouteAudit=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
var ORDER=['P05','P06','P07','P03','P02','P01'];
var PORTALS={P05:[[31,111],[32,111]],P06:[[15,95],[15,96]],P07:[[15,63],[15,64]],P03:[[31,47],[32,47]],P02:[[47,63],[47,64]],P01:[[47,95],[47,96]]};
var DIR={P05:[-1,0],P06:[0,-1],P07:[0,-1],P03:[1,0],P02:[0,1],P01:[0,1]};
function create(f){
 var nodes=new Map(f.nodes.map(function(n){return[n.id,n];})),adj=new Map();
 for(var id of nodes.keys())adj.set(id,[]);
 f.edges.forEach(function(e,i){if(nodes.has(e.a)&&nodes.has(e.b)){adj.get(e.a).push([e.b,i]);adj.get(e.b).push([e.a,i]);}});
 function portal(e){if(e.type!=='BOUNDARY')return null;var a=nodes.get(e.a),b=nodes.get(e.b);if(!a||!b)return null;
 for(var p of ORDER){var u=PORTALS[p][0],v=PORTALS[p][1];if((a.x===u[0]&&a.y===u[1]&&b.x===v[0]&&b.y===v[1])||(b.x===u[0]&&b.y===u[1]&&a.x===v[0]&&a.y===v[1]))return p;}return null;}
 function valid(e){var a=nodes.get(e.a),b=nodes.get(e.b);if(!a||!b||Math.abs(a.x-b.x)+Math.abs(a.y-b.y)!==1)return false;
 if(['WALK','BOUNDARY','RAMP','RAMP_LATERAL'].includes(e.type))return a.surfaceId===b.surfaceId;
 if(e.type==='BRIDGE_ACCESS')return ((a.kind==='GROUND'&&b.kind==='BRIDGE')||(a.kind==='BRIDGE'&&b.kind==='GROUND'))&&a.elevation===b.elevation;
 if(e.type==='RAMP_ACCESS')return (a.kind==='RAMP')!==(b.kind==='RAMP');return false;}
 function find(x,y,s){for(var n of nodes.values())if(n.x===x&&n.y===y&&n.surfaceId===s)return n.id;return null;}
 function loop(blocked){var start=find(47,119,'GROUND-H0');if(!start)return null;var banned=new Set(blocked||[]),key=function(a,s){return a+'|'+s;},q=[[start,0]],prev=new Map([[key(start,0),null]]),end=null;
 for(var h=0;h<q.length;h++){var item=q[h],a=item[0],step=item[1],k=key(a,step);if(a===start&&step===ORDER.length){end=k;break;}
 for(var pair of adj.get(a)){var b=pair[0],i=pair[1],e=f.edges[i];if(banned.has(i)||!valid(e))continue;var p=portal(e),next=step;
 if(p){if(step>=ORDER.length||p!==ORDER[step])continue;var na=nodes.get(a),nb=nodes.get(b),d=DIR[p];if(nb.x-na.x!==d[0]||nb.y-na.y!==d[1])continue;next++;}
 var nk=key(b,next);if(!prev.has(nk)){prev.set(nk,{old:k,from:a,to:b,edgeIndex:i,portal:p});q.push([b,next]);}}}
 if(end===null)return null;var result=[];for(var cur=end;prev.get(cur)!==null;){var t=prev.get(cur);result.push({from:t.from,to:t.to,edgeIndex:t.edgeIndex,portal:t.portal});cur=t.old;}return result.reverse();}
 var exclusions=new Set((f.spawnExclusions||[]).filter(function(x){return nodes.has(x.nodeId)&&nodes.get(x.nodeId).surfaceId===x.surfaceId;}).map(function(x){return x.nodeId;}));
 return {nodeCount:nodes.size,edgeCount:f.edges.length,find:find,validEdge:valid,edgePortal:portal,orderedLoop:loop,spawnAllowed:function(id){return nodes.has(id)&&!exclusions.has(id);},excludedCount:exclusions.size};
}
return {ORDER:ORDER,create:create};
});
