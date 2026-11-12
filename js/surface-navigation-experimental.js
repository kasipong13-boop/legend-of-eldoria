/* LEGEND OF ELDORIA - experimental surface navigation (feature flag OFF by default).
 * No Save Engine, localStorage, DOM, network or runtime hooks.
 * Integration into world.js is intentionally deferred pending tests/review.
 */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.ELDORIA)root.ELDORIA.SurfaceNavigation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var DEFAULT_ENABLED=false;
  function key(x,y,surfaceId){return String(x)+','+String(y)+'@'+String(surfaceId);}
  function build(fixture){
    if(!fixture||!Array.isArray(fixture.nodes)||!Array.isArray(fixture.edges))throw Error('INVALID_GRAPH');
    var nodes=new Map(),adj=new Map(),exclusions=new Set();
    fixture.nodes.forEach(function(n){
      if(!Number.isInteger(n.x)||!Number.isInteger(n.y)||typeof n.surfaceId!=='string')throw Error('INVALID_NODE');
      if(nodes.has(n.id))throw Error('DUPLICATE_NODE');
      nodes.set(n.id,n);adj.set(n.id,[]);
    });
    fixture.edges.forEach(function(e,i){
      if(!nodes.has(e.a)||!nodes.has(e.b))throw Error('UNKNOWN_EDGE_NODE');
      adj.get(e.a).push([e.b,i]);adj.get(e.b).push([e.a,i]);
    });
    (fixture.spawnExclusions||[]).forEach(function(x){
      var n=nodes.get(x.nodeId);
      if(n&&n.surfaceId===x.surfaceId)exclusions.add(x.nodeId);
    });
    function valid(e){
      var a=nodes.get(e.a),b=nodes.get(e.b);
      if(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)!==1)return false;
      if(['WALK','BOUNDARY','RAMP','RAMP_LATERAL'].indexOf(e.type)>=0)return a.surfaceId===b.surfaceId;
      if(e.type==='BRIDGE_ACCESS')return ((a.kind==='GROUND'&&b.kind==='BRIDGE')||(a.kind==='BRIDGE'&&b.kind==='GROUND'))&&a.elevation===b.elevation;
      if(e.type==='RAMP_ACCESS')return (a.kind==='RAMP')!==(b.kind==='RAMP');
      return false;
    }
    function route(start,goal){
      if(!nodes.has(start)||!nodes.has(goal))return null;
      var q=[start],prev=new Map([[start,null]]);
      for(var h=0;h<q.length;h++){
        var id=q[h];if(id===goal)break;
        adj.get(id).forEach(function(item){
          var next=item[0],ei=item[1];
          if(!prev.has(next)&&valid(fixture.edges[ei])){prev.set(next,[id,ei]);q.push(next);}
        });
      }
      if(!prev.has(goal))return null;
      var out=[];for(var p=goal;prev.get(p)!==null;){var t=prev.get(p);out.push({from:t[0],to:p,edgeIndex:t[1]});p=t[0];}
      return out.reverse();
    }
    return {
      nodeCount:nodes.size,edgeCount:fixture.edges.length,
      find:function(x,y,surfaceId){for(var n of nodes.values())if(key(n.x,n.y,n.surfaceId)===key(x,y,surfaceId))return n.id;return null;},
      route:route,
      spawnAllowed:function(id){return nodes.has(id)&&!exclusions.has(id);},
      isEdgeValid:function(index){return Number.isInteger(index)&&index>=0&&index<fixture.edges.length&&valid(fixture.edges[index]);}
    };
  }
  function createAdapter(fixture,options){
    var graph=build(fixture),enabled=!!(options&&options.enabled);
    return {
      enabled:function(){return enabled;},
      setEnabled:function(value){enabled=value===true;},
      graph:graph,
      navigate:function(start,goal){return enabled?graph.route(start,goal):{mode:'LEGACY_DELEGATE',start:start,goal:goal};}
    };
  }
  return {DEFAULT_ENABLED:DEFAULT_ENABLED,build:build,createAdapter:createAdapter};
});
