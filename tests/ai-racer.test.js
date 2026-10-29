import test from "node:test";
import assert from "node:assert/strict";
import { createRacerDriver } from "../src/combat/racer-driver.js";
import { createRiderPhysics } from "../src/physics/rider-physics.js";
class Vec {
  constructor(x,y,z) {Object.assign(this,{x,y,z});}
  clone(){return new Vec(this.x,this.y,this.z);}
  addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
}
const path={width:12,height:.22,sample(d,l=0){return {point:new Vec(l,.22,-d),tangent:new Vec(0,0,-1),normal:new Vec(1,0,0)};}};
function chunks(d){return new Map(Array.from({length:9},(_,i)=>[Math.floor(d/64)-2+i,{userData:{barriers:[]}}]));}
function tick(sim,state,seconds){for(let i=0;i<seconds*120;i++){sim.syncChunks(chunks(state.distance));sim.update(1/120,state);}}
async function setup(velocity=0){
 const sim=await createRiderPhysics();sim.reset(path,chunks(0),{distance:0,lane:0},{weapon:"launcher"},{rival:true});
 const state={running:true,targetKmh:500,throttleInput:0,time:0,distance:0};sim.body.setLinvel({x:0,y:0,z:-velocity},true);sim.update(0,state);return {sim,state};
}
test("AI shares the start row, accelerates independently, and stays ahead when player stops",async()=>{
 const slow=await setup(),fast=await setup(40);
 try {
  assert.equal(slow.state.rival.gap,0);assert(Math.abs(slow.state.rival.x-slow.sim.body.translation().x)>=2);
  tick(slow.sim,slow.state,6);tick(fast.sim,fast.state,6);
  assert(Math.abs(slow.state.rival.distance-fast.state.rival.distance)<.01);
  assert(Math.abs(slow.state.rival.speed-fast.state.rival.speed)<.01);
  tick(slow.sim,slow.state,14);
  assert(slow.state.rival.gap>900);assert(slow.state.rival.speed*3.6<=220.01);
  assert(!slow.state.weaponLocked);
  const progress=slow.state.rival.distance;
  slow.state.running=false;tick(slow.sim,slow.state,2);assert.equal(slow.state.rival.distance,progress);
  slow.state.running=true;slow.sim.body.setTranslation({x:0,y:1.02,z:-2000},true);tick(slow.sim,slow.state,.1);
  assert(slow.state.rival.distance<progress+10,"AI must not teleport to catch up");
 }finally{slow.sim.dispose();fast.sim.dispose();}
});
test("driver brakes for a blocked road, chooses a clear lane, and slows for bends",()=>{
 const blocked=createRacerDriver(path,{distance:0,lane:0});for(let i=0;i<120;i++)blocked.update(1/120,()=>2);
 assert.equal(blocked.speed,0);assert.equal(blocked.distance,0);
 const avoiding=createRacerDriver(path,{distance:0,lane:0});for(let i=0;i<120;i++)avoiding.update(1/120,l=>Math.abs(l)<2?2:Infinity);
 assert(Math.abs(avoiding.lane)>2);assert(avoiding.speed>0);
 const curved={...path,sample(d,l=0){const angle=d/25;return {point:new Vec(l,.22,-d),tangent:new Vec(Math.sin(angle),0,-Math.cos(angle)),normal:new Vec(1,0,0)};}};
 const corner=createRacerDriver(curved,{distance:0,lane:0});for(let i=0;i<600;i++)corner.update(1/120);
 assert(corner.speed<220/3.6*.7);
});
test("explosion recovery resumes AI's own progress and a new race resets both starting positions",async()=>{
 const {sim,state}=await setup();
 try {
  sim.reset(path,chunks(0),{distance:0,lane:0},{weapon:"launcher"},{rival:true,rivalSpawn:{distance:12,lane:0}});
  state.fireRequested=true;for(let i=0;i<240&&!state.weaponHits;i++)tick(sim,state,1/120);
  assert.equal(state.weaponHits,1);const crashProgress=state.rival.distance;
  tick(sim,state,3);assert.equal(state.rival.distance,crashProgress);
  sim.body.setTranslation({x:0,y:1.02,z:-500},true);tick(sim,state,2.5);
  assert.equal(state.rival.recovery,0);assert(state.rival.distance<crashProgress+10);
  sim.reset(path,chunks(0),{distance:0,lane:0},{weapon:"launcher"},{rival:true});state.distance=0;sim.update(0,state);
  assert.equal(state.rival.distance,0);assert.equal(state.rival.speed,0);assert.equal(state.weaponHits,0);
 }finally{sim.dispose();}
});
