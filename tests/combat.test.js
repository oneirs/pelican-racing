import test from "node:test";
import assert from "node:assert/strict";
import { createRiderPhysics } from "../src/physics/rider-physics.js";
import { loadPhysics } from "../src/physics/engine.js";
class Vec {
  constructor(x,y,z) { Object.assign(this,{x,y,z}); }
  clone() { return new Vec(this.x,this.y,this.z); }
  addScaledVector(v,s) { this.x+=v.x*s; this.y+=v.y*s; this.z+=v.z*s; return this; }
}
const path = { width: 12, height: .22, sample(d,lane=0) { return { point: new Vec(lane,.22,-d), tangent: new Vec(0,0,-1), normal: new Vec(1,0,0) }; } };
function chunks(d) { return new Map(Array.from({length:9},(_,i)=>[Math.floor(d/64)-2+i,{userData:{barriers:[]}}])); }
async function setup(weapon="launcher", distance=0) {
  const sim = await createRiderPhysics();
  sim.reset(path,chunks(distance),{distance,lane:0},{weapon},{rival:true,rivalSpawn:{distance:distance+22,lane:0}});
  const state = {running:true,targetKmh:220,throttleInput:0,time:0,distance,lookYaw:0};
  sim.update(0,state); return {sim,state};
}
function advance(sim,state,seconds) {
  for(let i=0;i<Math.round(seconds*120);i++) {sim.syncChunks(chunks(state.distance));sim.update(1/120,state);}
}
test("one AI rides ahead, a rocket hits and launches its physical body, then it recovers",async()=>{
  const {sim,state}=await setup();
  try {
    assert(state.rival.gap>20 && state.rival.gap<25);
    advance(sim,state,.5);
    assert(state.rival.speed>0);
    assert(!state.weaponLocked);
    state.fireRequested=true;advance(sim,state,1);
    assert.equal(state.weaponShots,1);
    assert.equal(state.weaponHits,1);
    assert(state.rival.recovery>4);
    assert(sim.combat.rival.isDynamic());
    advance(sim,state,.15);
    assert(state.rival.y>1.2, `rival did not launch: ${state.rival.y}`);
    assert(state.explosions.length>0);
    const countdown=state.rival.recovery, pose={...sim.combat.rival.translation()};
    state.running=false;state.fireRequested=true;advance(sim,state,2);
    assert.equal(state.rival.recovery,countdown);assert.deepEqual({...sim.combat.rival.translation()},pose);
    assert.equal(state.weaponShots,1);assert(!state.fireRequested);
    state.running=true;advance(sim,state,5.2);
    assert.equal(state.rival.recovery,0);assert(sim.combat.rival.isKinematic());
    assert(state.rival.y>path.height);
  } finally {sim.dispose();}
});
test("empty weapon slot and cooldown prevent firing; a wall intercepts a rocket before the rival",async()=>{
  const empty=await setup("standard");
  try{empty.state.fireRequested=true;advance(empty.sim,empty.state,.1);assert.equal(empty.state.weaponShots,0);}finally{empty.sim.dispose();}
  const {sim,state}=await setup();
  try {
    const R=await loadPhysics();
    sim.world.createCollider(R.ColliderDesc.cuboid(8,3,.15).setTranslation(0,3,-8));
    sim.world.step();
    state.fireRequested=true;advance(sim,state,.02);
    state.fireRequested=true;advance(sim,state,.7);
    assert.equal(state.weaponShots,1);assert.equal(state.weaponHits,0);assert.equal(state.weaponBlasts,1);
    assert.equal(state.missiles.length,0);
  } finally {sim.dispose();}
});
test("projectile targeting survives origin rebasing and resetting clears shots and blasts",async()=>{
  const {sim,state}=await setup("launcher",1020);
  try {
    sim.body.setLinvel({x:0,y:0,z:-12},true);
    state.fireRequested=true;advance(sim,state,1);
    assert(state.physicsPose.origin>=1024);
    assert.equal(state.weaponHits,1);
    assert(Number.isFinite(state.rival.z));
    sim.reset(path,chunks(0),{distance:0,lane:0},{weapon:"launcher"},{rival:true});sim.update(0,state);
    assert.equal(state.weaponShots,0);assert.equal(state.weaponHits,0);assert.equal(state.missiles.length,0);assert.equal(state.explosions.length,0);
    assert.equal(sim.colliderCount,12);
  } finally {sim.dispose();}
});
test("forward firing ignores camera direction and sustained firing stays bounded",async()=>{
  const {sim,state}=await setup();
  try {
    state.lookYaw=Math.PI;
    for(let i=0;i<2400;i++){state.fireRequested=true;sim.update(1/120,state);assert(state.missiles.length<=3);assert(state.explosions.length<=6);}
    assert(state.weaponShots>10);assert(state.weaponHits>0);
    advance(sim,state,3);assert.equal(state.missiles.length,0);
  }finally{sim.dispose();}
});

// Exercise blast distance using a wall that intercepts the projectile 10 m before the rival.
test("nearby wall impact uses the enlarged 13.5 m blast instead of the old 4.5 m radius",async()=>{
  const {sim,state}=await setup();
  try {
    const R=await loadPhysics();
    sim.world.createCollider(R.ColliderDesc.cuboid(8,3,.15).setTranslation(0,3,-16));sim.world.step();
    state.fireRequested=true;advance(sim,state,.25);
    assert.equal(state.weaponShots,0);assert(state.weaponAction && !state.weaponAction.fired);
    const age=state.weaponAction.age;state.running=false;advance(sim,state,.5);
    assert.equal(state.weaponAction.age,age);
    state.running=true;advance(sim,state,.65);
    assert.equal(state.weaponBlasts,1);assert.equal(state.weaponHits,1);
    assert(state.explosions.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.z)));
  }finally{sim.dispose();}
});

test("cannon ignores off-axis rivals and keeps a straight trajectory after firing",async()=>{
  const {createCombat}=await import("../src/combat/simulation.js");
  const R=await loadPhysics(),world=new R.World({x:0,y:0,z:0});
  try {
    const player=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,1,0));
    const combat=createCombat({R,world,player,path,spawn:{distance:0,lane:0},rivalSpawn:{distance:20,lane:3},weapon:"launcher",getOrigin:()=>0});
    const state={running:true,distance:0,fireRequested:true,lookYaw:1};
    const tick=n=>{for(let i=0;i<n;i++){combat.beforeStep(1/120,state,false);world.step();combat.afterStep(1/120);combat.read(state);}};
    tick(60);assert.equal(state.missiles.length,1);assert(!state.weaponLocked);
    const first={...state.missiles[0]};assert.equal(first.dx,0);assert.equal(first.dy,0);assert.equal(first.dz,-1);
    player.setRotation({x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},true);
    tick(10);const next=state.missiles[0];assert(next);assert.equal(next.x,first.x);assert(next.z<first.z);
    assert.equal(next.dx,first.dx);assert.equal(next.dy,first.dy);assert.equal(next.dz,first.dz);assert.equal(state.weaponHits,0);
    tick(300);assert.equal(state.missiles.length,0);
  }finally{world.free();}
});

test("a character behind the cannon never redirects its muzzle or projectile",async()=>{
  const {sim,state}=await setup();
  try {
    sim.body.setRotation({x:0,y:1,z:0,w:0},true);sim.update(0,state);
    state.fireRequested=true;advance(sim,state,1);
    assert(!state.weaponLocked);assert.equal(state.weaponShots,1);assert.equal(state.weaponHits,0);
    assert(state.missiles.every(m=>m.dz>0));
  }finally{sim.dispose();}
});

test("both weapons re-launch a previously airborne rival on actual repeat impact",async()=>{
  const {createCombat}=await import("../src/combat/simulation.js");
  const R=await loadPhysics();
  for(const kind of ["cannon","gatling"]){
    const world=new R.World({x:0,y:0,z:0});
    try {
      const player=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,1,0));
      const combat=createCombat({R,world,player,path,spawn:{distance:0,lane:0},rivalSpawn:{distance:12,lane:0},weapon:kind==="cannon"?"launcher":"gatling",getOrigin:()=>0});
      const state={running:true,distance:0,fireRequested:kind==="cannon",gatlingHeld:kind==="gatling"};
      const tick=()=>{combat.beforeStep(1/120,state,false);world.step();combat.afterStep(1/120);combat.read(state);};
      for(let i=0;i<360&&!state.rival?.recovery;i++)tick();
      assert(state.rival.recovery>0,`${kind}: initial hit did not launch`);
      state.gatlingHeld=false;
      for(let i=0;i<145;i++)tick();
      // A controlled second encounter: the already-dynamic body intersects the straight shot.
      combat.rival.setTranslation({x:0,y:1.2,z:-12},true);
      combat.rival.setRotation({x:0,y:0,z:0,w:1},true);
      combat.rival.setLinvel({x:0,y:0,z:0},true);combat.rival.setAngvel({x:0,y:0,z:0},true);world.step();
      const before=kind==="cannon"?state.weaponHits:state.gatlingHits,remaining=state.rival.recovery;
      state.fireRequested=kind==="cannon";state.gatlingHeld=kind==="gatling";
      for(let i=0;i<180&&(kind==="cannon"?state.weaponHits:state.gatlingHits)===before;i++)tick();
      assert((kind==="cannon"?state.weaponHits:state.gatlingHits)>before,`${kind}: repeat hit ignored`);
      assert(combat.rival.linvel().y>(kind==="cannon"?8:1),`${kind}: repeat hit did not apply upward launch impulse`);
      assert(combat.rival.isDynamic());assert(state.rival.recovery>0&&state.rival.recovery<remaining,"repeat hit restarted recovery");
      assert(!state.weaponLocked);assert.equal(state.gatlingAim,null);
    }finally{world.free();}
  }
});

test("homing launcher steers toward an airborne target with bounded turning and hits again",async()=>{
  const {createCombat}=await import("../src/combat/simulation.js");
  const R=await loadPhysics(),world=new R.World({x:0,y:0,z:0});
  world.timestep=1/120;
  try {
    const player=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,1,0));
    const combat=createCombat({R,world,player,path,spawn:{distance:0,lane:0},rivalSpawn:{distance:40,lane:3},weapon:"homing-launcher",getOrigin:()=>0});
    const state={running:true,distance:0,fireRequested:true};
    const tick=()=>{combat.beforeStep(1/120,state,false);world.step();combat.afterStep(1/120);combat.read(state);};
    for(let i=0;i<60;i++)tick();
    assert(state.weaponLocked);assert.equal(state.weaponKind,"homing-launcher");
    assert(state.missiles[0].guided);assert(state.missiles[0].dx>0);
    const first={...state.missiles[0]};
    // Change the target's height after launch; the projectile must bend, not teleport.
    combat.rival.setBodyType(R.RigidBodyType.Dynamic,true);
    combat.rival.setTranslation({x:4,y:5,z:-40},true);combat.rival.setLinvel({x:0,y:0,z:0},true);
    tick();const next=state.missiles[0];
    assert(next.dy>first.dy);
    const angle=Math.acos(Math.min(1,first.dx*next.dx+first.dy*next.dy+first.dz*next.dz));
    assert(angle<=.65/120+1e-6);
    for(let i=0;i<180&&!state.weaponHits;i++)tick();
    assert.equal(state.weaponHits,1);assert(state.rival.recovery>0);
    for(let i=0;i<145;i++)tick();
    combat.rival.setTranslation({x:3,y:6,z:-30},true);
    combat.rival.setRotation({x:0,y:0,z:0,w:1},true);
    combat.rival.setLinvel({x:0,y:0,z:0},true);combat.rival.setAngvel({x:0,y:0,z:0},true);world.step();
    const remaining=state.rival.recovery;state.fireRequested=true;
    for(let i=0;i<180&&state.weaponHits===1;i++)tick();
    assert.equal(state.weaponHits,2);assert(combat.rival.linvel().y>8);
    assert(state.rival.recovery<remaining);assert(state.weaponLocked);
  }finally{world.free();}
});

test("homing rocket explodes on an intervening wall; no nearby target fires straight",async()=>{
  const {sim,state}=await setup("homing-launcher");
  try {
    const R=await loadPhysics();
    sim.world.createCollider(R.ColliderDesc.cuboid(8,5,.15).setTranslation(0,5,-6));sim.world.step();
    state.fireRequested=true;advance(sim,state,.9);
    assert.equal(state.weaponBlasts,1);assert.equal(state.weaponHits,0);assert.equal(state.missiles.length,0);
    sim.reset(path,chunks(0),{distance:0,lane:0},{weapon:"homing-launcher"},{rival:true,rivalSpawn:{distance:220,lane:3}});
    sim.update(0,state);state.fireRequested=true;advance(sim,state,.5);
    assert(!state.weaponLocked);assert.equal(state.missiles.length,1);
    const m=state.missiles[0];assert(!m.guided);assert(Math.abs(m.dx)<1e-6);assert(m.dz<-.99);
  }finally{sim.dispose();}
});
