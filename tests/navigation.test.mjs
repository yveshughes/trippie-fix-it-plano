import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateNavigation} from '../server/navigation.mjs';
const clear={action:'forward',reason:'Floor ahead is clear.',pathClear:true,personOrPet:false,personInPath:false,dropOrStairs:false,viewUsable:true};
test('navigation rejects nonphysical commands and defaults to stop on blocked evidence',()=>{
 assert.equal(validateNavigation(clear).action,'forward');
 for(const patch of [{pathClear:false},{personOrPet:true,personInPath:true},{dropOrStairs:true},{viewUsable:false}]) {
  const result=validateNavigation({...clear,...patch});
  assert.equal(result.action,'stop');
  assert.equal(result.obstacleAvoidance,true);
 }
 for(const patch of [{action:'aa0381110467'},{pathClear:'true'},{reason:''},{personOrPet:undefined}])assert.throws(()=>validateNavigation({...clear,...patch}));
});
import {validateMission,validatePlan} from '../server/navigation.mjs';
const localPlan={...clear,goalVisible:true,situation:'continue',plan:[{phase:'avoid_obstacle',direction:'forward',steps:1},{phase:'reach_goal',direction:'right',steps:1}]};
test('persistent mission constraints cannot be disabled by the command',()=>{
 const mission=validateMission({goal:'Go find sidewalk hazards',mode:'patrol',allowRoadCrossing:true,stayOnSidewalk:false});
 assert.equal(mission.allowRoadCrossing,false);
 assert.equal(mission.stayOnSidewalk,true);
 assert.equal(mission.goal,'Go find sidewalk hazards');
 assert.throws(()=>validateMission({goal:'x'.repeat(241),mode:'patrol'}));
});
test('local plans stop at intersections and never become unbounded routes',()=>{
 assert.equal(validatePlan(localPlan).estimatedLocalSteps,2);
 assert.equal(validatePlan(localPlan).reobserveAfterEach,true);
 for(const situation of ['intersection','uncertain','blocked','goal_reached']) {
  const plan=validatePlan({...localPlan,situation});
  assert.equal(plan.action,'stop');assert.match(plan.reason,/Hold position/);assert.deepEqual(plan.plan,[]);
 }
 assert.deepEqual(validatePlan({...localPlan,personOrPet:true,personInPath:true}).plan,[]);
 assert.throws(()=>validatePlan({...localPlan,plan:[{phase:'reach_goal',direction:'right',steps:1}]}));
 assert.throws(()=>validatePlan({...localPlan,plan:[{phase:'reach_goal',direction:'forward',steps:200}]}));
 assert.throws(()=>validatePlan({...localPlan,plan:Array(5).fill({phase:'follow_sidewalk',direction:'forward',steps:3})}));
});

test('unseen destinations cannot get a guessed route',()=>{assert.throws(()=>validatePlan({...localPlan,goalVisible:false}));});

 test('visible people do not block a separately clear route; people in swept path do',()=>{
 assert.equal(validateNavigation({...clear,personOrPet:true,personInPath:false}).action,'forward');
 assert.equal(validateNavigation({...clear,personOrPet:true,personInPath:true}).action,'stop');
 assert.throws(()=>validateNavigation({...clear,personInPath:undefined}));
 assert.throws(()=>validateNavigation({...clear,personInPath:true,personOrPet:false}));
 });
