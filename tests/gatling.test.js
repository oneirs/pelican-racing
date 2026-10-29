import test from "node:test";
import assert from "node:assert/strict";
import { loadPhysics } from "../src/physics/engine.js";
import { createGatlingCombat } from "../src/combat/gatling.js";
import { createRiderPhysics } from "../src/physics/rider-physics.js";
async function arena({wall=false, equipped=true, x=0, origin=0}={}) {
 const R=await loadPhysics(),world=new R.World({x:0,y:0,z:0});
 const player=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,1,origin));
 const target=world.createCollider(R.ColliderDesc.cuboid(.6,.9,.7).setTranslation(x,1.75,origin-20));
 if(wall)world.createCollider(R.ColliderDesc.cuboid(3,3,.1).setTranslation(0,2,origin-5));
 world.step();let damage=0;
 const gun=createGatlingCombat({R,world,player,equipped,getOrigin:()=>origin,damageTarget:(handle,n)=>{if(handle!==target.handle)return false;damage+=n;return true;}});
 const state={running:true,gatlingHeld:true,lookYaw:1};
 const tick=(seconds,crashed=false)=>{for(let i=0;i<Math.round(seconds*120);i++){gun.beforeStep(1/120,state,crashed);world.step();gun.afterStep(1/120);gun.read(state);}};
 return {world,player,target,gun,state,tick,get damage(){return damage;}};
}
test("twin barrels fire straight, damage only actual hits, and stop on release",async()=>{
 const a=await arena();try{
  a.tick(.01);assert.equal(a.state.gatlingShots,2);assert.equal(a.state.bullets.length,2);
  for(const b of a.state.bullets){assert.equal(b.dx,0);assert.equal(b.dy,0);assert.equal(b.dz,-1);}
  a.tick(.09);assert.equal(a.damage,16);assert.equal(a.state.gatlingHits,2);
  a.state.gatlingHeld=false;const shots=a.state.gatlingShots;a.tick(.5);assert.equal(a.state.gatlingShots,shots);assert.equal(a.state.bullets.length,0);
 }finally{a.world.free();}
});
test("bullets never seek sideways targets and walls intercept them without area damage",async()=>{
 for(const options of [{x:3},{wall:true}]){const a=await arena(options);try{a.tick(1);assert.equal(a.damage,0);assert.equal(a.state.gatlingShots,20);assert(a.state.bullets.every(b=>b.dx===0&&b.dz===-1));}finally{a.world.free();}}
});
test("unequipped or crashed guns cannot shoot; shots survive large world offsets and remain bounded",async()=>{
 const empty=await arena({equipped:false});try{empty.tick(1);assert.equal(empty.state.gatlingShots,0);}finally{empty.world.free();}
 const a=await arena({origin:1024,x:4});try{
  a.tick(1,true);assert.equal(a.state.gatlingShots,0);
  for(let i=0;i<100;i++){a.tick(.1);assert(a.state.bullets.length<=16);assert(a.state.bulletImpacts.length<=32);}
  assert.equal(a.state.gatlingShots,200);
 }finally{a.world.free();}
 const hit=await arena({origin:1024});try{hit.tick(.1);assert.equal(hit.damage,16);}finally{hit.world.free();}
});
class Vec {constructor(x,y,z){Object.assign(this,{x,y,z});}clone(){return new Vec(this.x,this.y,this.z);}addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}}
const path={width:12,height:.22,sample(d,l=0){return{point:new Vec(l,.22,-d),tangent:new Vec(0,0,-1),normal:new Vec(1,0,0)};}};
const chunks=new Map(Array.from({length:8},(_,i)=>[i-2,{userData:{barriers:[]}}]));
test("hits reduce rival durability, freeze on pause, wreck at zero and repair after five seconds",async()=>{
 const sim=await createRiderPhysics();const spawn={distance:0,lane:0};
 try{
  sim.reset(path,chunks,spawn,{weapon:"gatling"},{rival:true,rivalSpawn:{distance:12,lane:0}});
  const state={running:true,time:0,distance:0,throttleInput:0,targetKmh:220,gatlingHeld:true};
  const tick=t=>{for(let i=0;i<t*120;i++)sim.update(1/120,state);};
  tick(.13);assert(state.rival.health<100&&state.rival.health>0);assert(state.rival.hitFlash>0);assert.equal(state.weaponBlasts,0);assert(!state.weaponEquipped&&state.gatlingEquipped);
  const health=state.rival.health,shots=state.gatlingShots;state.running=false;tick(1);assert.equal(state.rival.health,health);assert.equal(state.gatlingShots,shots);assert(!state.gatlingFiring);
  state.running=true;state.gatlingHeld=true;tick(1);assert.equal(state.rival.health,0);assert(state.rival.recovery>0);assert(sim.combat.rival.isDynamic());
  assert(!state.weaponLocked);
  state.gatlingHeld=false;tick(5.1);assert.equal(state.rival.health,100);assert.equal(state.rival.recovery,0);
  sim.reset(path,chunks,spawn,{weapon:"gatling"},{rival:true});sim.update(0,state);assert.equal(state.gatlingShots,0);assert.equal(state.gatlingHits,0);assert.equal(state.bullets.length,0);
 }finally{sim.dispose();}
});

test("E can only fire the single equipped attack weapon, including conflicting legacy saves",async()=>{
  const sim=await createRiderPhysics();
  try {
    for(const [parts,cannon,machine] of [
      [{weapon:"launcher",gatling:"dual"},true,false],
      [{weapon:"homing-launcher",gatling:"dual"},true,false],
      [{weapon:"gatling"},false,true],
      [{gatling:"dual"},false,true],
      [{weapon:"standard"},false,false],
      [{weapon:"attack-beak",gatling:"dual"},false,false],
    ]) {
      sim.reset(path,chunks,{distance:0,lane:0},parts,{rival:true});
      const state={running:true,time:0,distance:0,throttleInput:0,targetKmh:220,fireRequested:true,gatlingHeld:true};
      for(let i=0;i<80;i++)sim.update(1/120,state);
      assert.equal(state.weaponShots>0,cannon);assert.equal(state.gatlingShots>0,machine);
      assert.equal(state.weaponEquipped,cannon);assert.equal(state.gatlingEquipped,machine);
    }
  }finally{sim.dispose();}
});
