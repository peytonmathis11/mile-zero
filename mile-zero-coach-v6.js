/* MILE Ø / Unified coaching engine — v6 freshness-first integration
   Standalone. Not connected to the production plan generator.
   Deterministic, auditable coaching heuristics; not a validated readiness model.
   Runner approves every proposed change. No medical clearance or guaranteed outcome.
*/
(function(root) {
'use strict';
const WD=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SPECS={
 'First mile / run-walk':{mi:1,kind:'beginner',taper:0,longCap:3},
 '5K':{mi:3.10685596,kind:'short',taper:1,longCap:13},
 '10K':{mi:6.21371192,kind:'short',taper:1,longCap:15},
 'Half Marathon':{mi:13.1094,kind:'half',taper:2,longCap:16},
 'Marathon':{mi:26.2188,kind:'marathon',taper:3,longCap:22},
 '50K':{mi:31.06856,kind:'ultra',taper:3,longCap:26},
 '50 Mile':{mi:50,kind:'ultra',taper:3,longCap:28},
 '100K':{mi:62.13712,kind:'ultra',taper:3,longCap:30},
 '100 Mile':{mi:100,kind:'ultra',taper:3,longCap:32},
 '6 Hour':{mi:null,kind:'timed',taper:2,longCap:24},
 '12 Hour':{mi:null,kind:'timed',taper:3,longCap:28},
 '24 Hour':{mi:null,kind:'timed',taper:3,longCap:32}
};
const half=x=>Math.round(Math.max(0,Number(x)||0)*2)/2;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const sum=a=>a.reduce((n,v)=>n+(Number(v)||0),0);
const date=s=>/^\d{4}-\d\d-\d\d$/.test(String(s||''))?new Date(s+'T12:00:00Z'):new Date(NaN);
const validDate=s=>Number.isFinite(date(s).getTime())&&date(s).toISOString().slice(0,10)===s;
const addDays=(s,d)=>new Date(date(s).getTime()+86400000*d).toISOString().slice(0,10);
const dateDiff=(a,b)=>Math.round((date(b)-date(a))/86400000);
const formatPace=seconds=>Number.isFinite(seconds)&&seconds>0?`${Math.floor(Math.round(seconds)/60)}:${String(Math.round(seconds)%60).padStart(2,'0')}`:null;
const parsePace=s=>{let m=/^(\d{1,2}):([0-5]\d)$/.exec(String(s||''));return m?Number(m[1])*60+Number(m[2]):null;};
const parseGoalTime=s=>{if(s==null||s==='')return null;if(typeof s==='number')return Number.isFinite(s)&&s>0?s:null;let m=/^(?:(\d{1,2}):)?(\d{1,2}):([0-5]\d)$/.exec(String(s).trim());if(!m)return null;return (Number(m[1]||0)*3600+Number(m[2])*60+Number(m[3]));};
const circular=(a,b)=>Math.min((a-b+7)%7,(b-a+7)%7);
function chooseDays(count,longDay){
 const active=[longDay];
 for(const gap of [3,5,1,4,2,6]) {const d=(longDay+gap)%7;if(active.length>=count)break;if(!active.includes(d))active.push(d)}
 return active.sort((a,b)=>a-b);
}
function slot(wi,di,type='Rest / mobility',miles=0,details='Rest or gentle mobility.',extras={}){
 return {id:`${wi}-${di}`,day:WD[di],type,miles:half(miles),pace:'',details,status:'planned',actual:null,actualPace:'',averageHr:null,pain:false,notes:'',manual:false,...extras};
}
function distribute(total,indices,weights){
 if(!indices.length)return {};
 const units=Math.round(half(total)*2), sw=sum(weights), exact=weights.map(w=>sw>0?units*w/sw:units/indices.length);
 const counts=exact.map(Math.floor);let remaining=units-sum(counts);
 const priorities=exact.map((x,i)=>({i,rem:x-counts[i]})).sort((a,b)=>b.rem-a.rem||a.i-b.i);
 for(let k=0;k<remaining;k++)counts[priorities[k].i]++;
 return Object.fromEntries(indices.map((d,i)=>[d,counts[i]/2]));
}
function validate(input){
 const issues=[],p=input||{},goals=p.goals||[];
 if(!validDate(p.startDate)||date(p.startDate).getUTCDay()!==1)issues.push('Plan start must be a Monday.');
 if(!Array.isArray(goals)||goals.length<1||goals.length>2)issues.push('Choose one or two race goals.');
 if(!(Number(p.mileage)>=0&&Number(p.mileage)<=180))issues.push('Enter current weekly mileage between 0 and 180.');
 if(!(Number.isInteger(+p.days)&&+p.days>=2&&+p.days<=7))issues.push('Choose 2–7 available days (one rest day is retained).');
 if(!(Number.isInteger(+p.longday)&&+p.longday>=0&&+p.longday<=6))issues.push('Select a long-run day.');
 if(p.hardRuns!==undefined&&(!Number.isInteger(Number(p.hardRuns))||Number(p.hardRuns)<0||Number(p.hardRuns)>2))issues.push('Choose 0, 1 or 2 hard runs per week.');
 if(p.volumePreference!==undefined&&!['gradual','steady','progressive'].includes(p.volumePreference))issues.push('Choose gradual, steady or progressive mileage build.');
 for(const [i,g] of goals.entries()){
  if(!SPECS[g.distance])issues.push(`Goal ${i+1}: unsupported event.`);
  if(!validDate(g.raceDate)||validDate(p.startDate)&&date(g.raceDate)<date(p.startDate))issues.push(`Goal ${i+1}: race date must be after the plan start.`);
  if(!['speed','endurance','balanced'].includes(g.focus))issues.push(`Goal ${i+1}: choose speed, endurance, or balanced.`);
  if(g.timeGoal!==undefined&&g.timeGoal!==''&&g.timeGoal!==null&&parseGoalTime(g.timeGoal)===null)issues.push(`Goal ${i+1}: time goal must use m:ss or h:mm:ss.`);
  if(g.timeGoal&&SPECS[g.distance]?.mi===null)issues.push(`Goal ${i+1}: timed events need a distance target, not a finish-time goal.`);
  if(g.distanceGoalMiles!==''&&g.distanceGoalMiles!=null&&(!(Number(g.distanceGoalMiles)>0)||!['6 Hour','12 Hour','24 Hour'].includes(g.distance)))issues.push(`Goal ${i+1}: invalid distance target.`);
 }
 if(validDate(p.startDate)&&goals.every(g=>validDate(g.raceDate))){
  const last=goals.map(g=>g.raceDate).sort().at(-1),weeks=Math.floor(dateDiff(p.startDate,last)/7)+1;
  if(weeks<4||weeks>52)issues.push('Training window must be 4–52 weeks.');
 }
 if(p.pace&&parsePace(p.pace)===null)issues.push('Easy pace should look like 10:30.');
 if(p.recent5kTime&&parseGoalTime(p.recent5kTime)===null)issues.push('Recent 5K time should look like 30:00.');
 if(goals.some(g=>g.focus==='speed' && ['5K','10K','Half Marathon'].includes(g.distance))&&!p.recent5kTime)issues.push('For pace-based speed training, enter a recent 5K result or benchmark. A goal time alone cannot establish current workout paces.');
 for(const [label,minKey,maxKey] of [['easy HR','easyHrMin','easyHrMax'],['threshold HR','thresholdHrMin','thresholdHrMax']]){
  const lo=p[minKey]===''||p[minKey]==null?null:Number(p[minKey]),hi=p[maxKey]===''||p[maxKey]==null?null:Number(p[maxKey]);
  if((lo===null)!==(hi===null))issues.push(`Enter both lower and upper ${label} bounds, or leave both blank.`);
  if(lo!==null&&(!(lo>=60&&hi<=230&&lo<hi)))issues.push(`Invalid ${label} range.`);
 }
 return issues;
}
// All speed paces are anchored to a recent PERFORMANCE, not an aspirational race time.
// Pace ratios are conservative configurable coaching heuristics, NOT individually validated zones.
const MI5K=3.10685596;
const RECOVERY_LABEL='walk or jog easily';
// Phase-based microcycles: workout selection follows the adaptation sought that week, not a random rotation.
const speedWorkoutsBuild=['Fartlek intervals','400m repeats','800m repeats','5K pace ladder','1K repeats','400m repeats'];
const speedWorkoutsSpecific=['1K repeats','800m repeats','5K pace ladder','Race-pace rehearsal','400m repeats','200m sharpening'];
const supportingWorkouts=['Tempo blocks','Cruise intervals','Progression run','Tempo progression'];
const phaseIntent={Foundation:'Establish repeatable weekly running and prepare for harder sessions.',Build:'Develop aerobic capacity alongside progressive speed or threshold work.','Race-specific':'Rehearse event-specific fitness without abandoning aerobic development.',Recovery:'Absorb training; lower volume and remove demanding sessions.',Taper:'Reduce accumulated fatigue while preserving fitness.','Race week':'Protect freshness and compete.','Post-race recovery':'Prioritize recovery before another demanding block.'};
const isQualityType=t=>/repeats|intervals|tempo|ladder|fartlek|progression|rehearsal|sharpening|hills/i.test(t||'');
const measuredHR=(p,zone)=>{
 const a=Number(p[zone+'HrMin']),b=Number(p[zone+'HrMax']);
 return p[zone+'HrMin']!==''&&p[zone+'HrMax']!==''&&Number.isFinite(a)&&Number.isFinite(b)&&a>0&&b>a?{min:a,max:b,label:`${a}–${b} bpm`}:null;
};
const paceBand=(fast,slow)=>({fastSeconds:Math.round(fast),slowSeconds:Math.round(slow),label:`${formatPace(fast)}–${formatPace(slow)}/mi`});
const timeOfSegment=(meters,secondsPerMile)=>Math.round(meters/1609.344*secondsPerMile);
const formatClock=n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
function easyTarget(p){
 const entry=parsePace(p.pace),recent=parseGoalTime(p.recent5kTime);
 const fromRace=recent?recent/MI5K:0;
 // A reported easy pace faster than a recent 5K performance is not accepted as a target.
 const center=Math.max(entry||0,fromRace?fromRace*1.14:0);
 return center?paceBand(center,center+35):null;
}
function workout(name,mi,p,wi){
 const recent=parseGoalTime(p.recent5kTime);
 if(!recent)return null;
 const current5k=recent/MI5K;
 const easy=easyTarget(p),thresholdHR=measuredHR(p,'threshold');
 const warm=mi>=8?1.5:mi>=5?1:0.75,cool=mi>=8?1.5:mi>=5?1:0.75;
 let kind='interval',pace=paceBand(current5k*.99,current5k*1.03),reps=4,meters=400,recovery=90;
 let pattern='',elements=[],hrTarget=null;
 if(name==='200m repeats'||name==='200m sharpening'){kind='speed';meters=200;reps=name==='200m sharpening'?6:clamp(6+Math.floor(wi/5),6,10);recovery=75;pace=paceBand(current5k*.94,current5k*.99);}
 else if(name==='400m repeats'){meters=400;reps=clamp(4+Math.floor(wi/4),4,8);recovery=105;pace=paceBand(current5k*.97,current5k*1.02);}
 else if(name==='800m repeats'){meters=800;reps=clamp(3+Math.floor(wi/6),3,5);recovery=150;pace=paceBand(current5k*.99,current5k*1.04);}
 else if(name==='1K repeats'){meters=1000;reps=clamp(3+Math.floor(wi/7),3,5);recovery=170;pace=paceBand(current5k*1,current5k*1.05);}
 else if(name==='Race-pace rehearsal'){meters=600;reps=4;recovery=150;pace=paceBand(current5k*.99,current5k*1.035);}
 else if(name==='5K pace ladder'){
  kind='ladder';pace=paceBand(current5k*.99,current5k*1.04);
  elements=[200,400,800,400,200].map(m=>({meters:m,targetSecondsFast:timeOfSegment(m,pace.fastSeconds),targetSecondsSlow:timeOfSegment(m,pace.slowSeconds)}));
  recovery=105;
 }else if(name==='Fartlek intervals'){
  kind='fartlek';reps=clamp(5+Math.floor(wi/6),5,8);pace=paceBand(current5k, current5k*1.07);recovery=120;
  pattern=`${reps} × 2 minutes at ${pace.label} with 2 minutes easy between`;
 }else if(name==='Tempo blocks'||name==='Cruise intervals'){
  kind='threshold';reps=name==='Cruise intervals'?3:2;recovery=120;pace=paceBand(current5k*1.06,current5k*1.12);
  const on=name==='Cruise intervals'?6:clamp(7+Math.floor(wi/5),7,10);
  pattern=`${reps} × ${on} minutes at ${pace.label} with ${recovery/60} minutes easy between`;
  hrTarget=thresholdHR;
 }else if(name==='Progression run'||name==='Tempo progression'){
  kind='progression';pace=paceBand(current5k*1.08,current5k*1.16);
  const finish=paceBand(current5k*1.06,current5k*1.12);hrTarget=thresholdHR;
  pattern=`${name==='Tempo progression'?'3 × 5':'3 × 6'} minutes: first at ${easy?.label||'calibrated easy pace'}, middle at ${pace.label}, final at ${finish.label}; 2 minutes easy between`; 
 }
 if(kind==='interval'||kind==='speed'){
  const maxWorkMi=Math.max(.65,mi-warm-cool-.7);
  reps=Math.max(2,Math.min(reps,Math.floor(maxWorkMi/(meters/1609.344))));
  // Keep approximate warmup, work, jog recovery and cooldown within session budget.
  const easyPerSec=(easy?.slowSeconds||current5k*1.24);
  while(reps>2 && warm+cool+reps*meters/1609.344+(reps-1)*(recovery/easyPerSec)>mi+.15)reps--;
  const fastSplit=formatClock(timeOfSegment(meters,pace.fastSeconds));
  const slowSplit=formatClock(timeOfSegment(meters,pace.slowSeconds));
  pattern=`${reps} × ${meters}m at ${pace.label} (${fastSplit}–${slowSplit} per repetition), ${recovery} seconds ${RECOVERY_LABEL} between`;
 }else if(kind==='ladder'){
  pattern=`200m / 400m / 800m / 400m / 200m at ${pace.label}, 105 seconds easy between segments`;
 }
 const HRnote=(kind==='threshold'||kind==='progression')
  ?hrTarget?`Calibrated threshold HR reference: ${hrTarget.label}; let pace lead early while HR rises.`:'No calibrated threshold HR zone entered; do not invent a bpm target.'
  :'Use per-repetition pace, NOT average heart rate, to control short repeats; heart rate responds too slowly. Observe recovery HR if recorded.';
 const details=`Warm up ${warm} mi at ${easy?.label||'your established easy pace'}; ${pattern}; cool down ${cool} mi easy. Session target ${mi} mi total (fill remaining distance easily). ${HRnote}`;
 return {type:name,miles:mi,details,pace:pace.label,targetPaceRange:pace,hrTarget,structure:{kind,warmupMiles:warm,cooldownMiles:cool,repetitions:reps,meters:kind==='interval'||kind==='speed'?meters:null,recoverySeconds:recovery,intervalElements:elements,workPace:pace,hrGuidance:HRnote,current5kPaceSeconds:Math.round(current5k)}};
}
function build(input){
 const errors=validate(input);if(errors.length)return {error:errors.join(' '),issues:errors};
 const p={...input};const goals=p.goals.map((g,i)=>({...g,id:g.id||`goal${i+1}`,timeGoalSeconds:parseGoalTime(g.timeGoal),event:SPECS[g.distance]})).sort((a,b)=>a.raceDate.localeCompare(b.raceDate));
 const last=goals.at(-1).raceDate,weeksCount=Math.floor(dateDiff(p.startDate,last)/7)+1;
 const base=Number(p.mileage),daysCount=Math.min(6,+p.days),longday=+p.longday;
 const returning=p.consistency==='returning',variable=p.consistency==='variable',novice=p.experience==='new'||base<10;
 const firstBase=base*(returning?.75:variable?.9:1),active=chooseDays(daysCount,longday);
 const volumePreference=p.volumePreference||'steady';
 const freshnessFirst=p.freshnessFirst!==false;
 const hardRunsRequested=p.hardRuns===undefined?1:Number(p.hardRuns);
 const baselineGrowth=returning?.02:variable?.025:novice?.03:p.experience==='advanced'?.045:.04;
 // Adjustable preference, not a universal safe growth rate. All build rates still require athlete review.
 const growth=baselineGrowth*(volumePreference==='gradual'?.7:volumePreference==='progressive'?1.15:1);
 // Provisional ceiling prevents a long calendar from mechanically doubling mileage. Not a verified safe threshold.
 const includesLongRace=goals.some(g=>['marathon','ultra','timed'].includes(g.event.kind));
 const peakCeiling=firstBase*(includesLongRace?1.55:1.45);

 const warnings=[],notes=[];
 if(goals.some(g=>['ultra','timed'].includes(g.event.kind))&&base<20)warnings.push('Recent mileage is low for the requested ultra-distance goal; more foundation training or a later race may be necessary.');
 if(goals.some(g=>g.distance==='100 Mile'||g.distance==='24 Hour')&&base<35)warnings.push('A very long event requires careful, individualized preparation; this prototype cannot verify readiness.');
 if(p.consistency==='returning')warnings.push('Returning runner: start below reported comfortable mileage and defer intensity.');
 if(hardRunsRequested===2&&(base<25||daysCount<5||returning||novice||variable))warnings.push('Two hard runs were requested, but the athlete profile may not support them yet. The engine will propose no more than one until recent mileage, consistency, and available running days support two.');
 if(hardRunsRequested===0&&goals.some(g=>g.focus==='speed'))warnings.push('Zero hard runs is allowed, but it may limit improvement toward a speed-focused race goal.');
 for(const g of goals){
  if(g.timeGoalSeconds&&g.event.mi){
   g.goalPaceSeconds=g.timeGoalSeconds/g.event.mi;
   if(g.distance==='5K'&&p.recent5kTime){const recent=parseGoalTime(p.recent5kTime);if(g.timeGoalSeconds<recent*.85)warnings.push(`The ${g.distance} time goal is substantially faster than the recent 5K result. Treat goal pace as aspirational and reassess feasibility.`)}
  }
 }
 if(goals.length===2){
  notes.push('One schedule serves both races. The nearer race receives increasing emphasis as it approaches; the later goal retains a relevant training stimulus.');
  if(dateDiff(goals[0].raceDate,goals[1].raceDate)<14)warnings.push('The two race dates are less than two weeks apart; performance and recovery priorities may conflict. Athlete-specific review is needed.');
 }
 for(const g of goals)if(g.event.kind==='timed'&&Number(g.distanceGoalMiles)>0){
  const eventHours=parseInt(g.distance,10),overallPace=Math.round(eventHours*3600/Number(g.distanceGoalMiles));
  g.timedAveragePace=formatPace(overallPace);
  notes.push(`${g.distance} goal of ${g.distanceGoalMiles} miles requires an average of ${g.timedAveragePace}/mi across the event including stops; this is not a prescribed training-run pace.`);
 }
 notes.push('Freshness-first mode includes an explainable weekly training-stress planning budget; it is not a validated recovery or injury-risk score.');
 notes.push('Volume preference changes progression rate, not hard-workout frequency. Projected mileage is capped relative to reported current training because longer calendars should not mechanically create extreme peaks. The ceiling is an unvalidated planning safeguard, not an individual safety threshold.');
 notes.push('All training targets are modifiable coaching heuristics, not validated injury-free limits. No race-time or finishing guarantee.');
 notes.push('Goal race pace is aspirational; training paces come from a recent 5K performance, not the requested finish time. Refresh the benchmark after a new verified race/test result. Heart-rate ranges are used only when measured and supplied.');
 let anchor=firstBase,peak=firstBase,buildWeeks=0;
 let out=[];
 for(let wi=0;wi<weeksCount;wi++){
  const wStart=addDays(p.startDate,wi*7),dates=Array.from({length:7},(_,d)=>addDays(wStart,d));
  const upcoming=goals.filter(g=>g.raceDate>=wStart),next=upcoming[0]||null;
  const nextDays=next?dateDiff(wStart,next.raceDate):0;
  const speedGoal=upcoming.find(g=>g.focus==='speed')||null;
  const distanceGoal=upcoming.find(g=>['ultra','timed','marathon'].includes(g.event.kind)&&g.focus!=='speed')||null;
  const includeSpeed=!!speedGoal && (nextDays>4 || next?.focus==='speed');
  const longestDemand=distanceGoal?distanceGoal.event.kind:next?.event.kind||'short';
  const ultra=['ultra','timed'].includes(longestDemand);
  const raceDates=dates.map((d,di)=>({d,di,events:goals.filter(g=>g.raceDate===d)})).filter(x=>x.events.length);
  const raceSoon=upcoming.filter(g=>dateDiff(wStart,g.raceDate)>=0&&dateDiff(wStart,g.raceDate)<=21);
  const recentFinish=goals.filter(g=>dateDiff(g.raceDate,wStart)>=0&&dateDiff(g.raceDate,wStart)<=14);
  const raceWeek=raceDates.length>0;
  const shortTaper=next&&nextDays<7&&!['ultra','timed','marathon'].includes(next.event.kind);
  const taperWeeks=next?.event.taper??0;
  const taper=next && nextDays<=7*taperWeeks && nextDays>=0 && !shortTaper;
  const recover=recentFinish.length>0;
  const recoveryWeek=!raceWeek&&wi>0&&wi%4===3;
  let phase=raceWeek?'Race week':recover?'Post-race recovery':taper||shortTaper?'Taper':recoveryWeek?'Recovery':wi<2?'Foundation':nextDays<35?'Race-specific':'Build';
  let target;
  if(wi===0)target=anchor;
  else if(recover){target=anchor*(recentFinish.some(g=>['ultra','timed','marathon'].includes(g.event.kind))?.45:.7)}
  else if(raceWeek){target=anchor*(next?.event.kind==='short'?.72:.5)}
  else if(shortTaper){target=anchor*.82}
  else if(taper){const weeksLeft=Math.ceil((nextDays+1)/7);target=anchor*(weeksLeft<=1?.5:weeksLeft===2?.7:.84)}
  else if(recoveryWeek){target=anchor*.78}
  else {if(wi>0)anchor*=1+growth;target=anchor;buildWeeks++}
  if(base===0){target=Math.min(12,2.5+buildWeeks*.8);if(phase==='Recovery')target*=.8;if(['Race week','Taper'].includes(phase))target=Math.min(target,peak*.7);if(phase==='Build'||phase==='Foundation')anchor=target}
  if(phase==='Build'||phase==='Foundation'||phase==='Race-specific')target=Math.min(target,peakCeiling);
  target=half(target);
  if(!['Recovery','Taper','Race week','Post-race recovery'].includes(phase))peak=Math.max(peak,target);
  const sessions=WD.map((_,d)=>slot(wi,d));
  const raceDays=new Set(raceDates.map(x=>x.di));
  const afterRaceDays=new Set();
  for(const g of goals){if(g.raceDate>=wStart&&g.raceDate<=dates[6]){
   const di=dates.indexOf(g.raceDate),recoveryDays=['ultra','timed','marathon'].includes(g.event.kind)?4:2;
   for(let j=di+1;j<Math.min(7,di+recoveryDays+1);j++)afterRaceDays.add(j);
  }}
  const existingRecovery=goals.filter(g=>g.raceDate<wStart).flatMap(g=>{
   let days=['ultra','timed','marathon'].includes(g.event.kind)?7:2;
   return dates.map((d,di)=>(dateDiff(g.raceDate,d)<=days&&dateDiff(g.raceDate,d)>0)?di:-1).filter(di=>di>=0)
  });
  for(const d of existingRecovery)afterRaceDays.add(d);
  const protectedDays=new Set([...raceDays,...afterRaceDays]);
  // Do not schedule a last-minute long run or demanding workout before a race.
  if(raceWeek)for(const r of raceDates){for(let d=Math.max(0,r.di-2);d<r.di;d++)protectedDays.add(d)}
  for(const r of raceDates){sessions[r.di]=slot(wi,r.di,'RACE DAY',0,`Event: ${r.events.map(g=>g.distance).join(' + ')}. Do not count race distance as pre-race training mileage.`,{raceGoalIds:r.events.map(g=>g.id)});}
  for(const d of afterRaceDays)if(!raceDays.has(d))sessions[d]=slot(wi,d,'Post-race recovery',0,'Recovery after an event; resume only when recovered.');
  const safeActive=active.filter(d=>!protectedDays.has(d));
  const realLong=safeActive.includes(longday)?longday:(safeActive.find(d=>circular(d,longday)<=2)??safeActive[0]);
  if(raceWeek){
   // Race replaces the hard/long stimulus; only short easy runs earlier in the week.
   const easyBudget=half(Math.min(target,safeActive.length*4));
   const easyDays=distribute(easyBudget,safeActive,safeActive.map(()=>1));
   for(const d of safeActive)sessions[d]=slot(wi,d,'Easy run',easyDays[d]||0,'Short, relaxed pre-race running. No hard intervals or long run.');
   out.push({phase,sessions,hardRunsRequested,hardRunsScheduled:0,coachingFocus:'Freshness for race day',coachingWhy:phaseIntent[phase]+' The race replaces a hard workout and long run.',note:'Race week: protect freshness; the race itself replaces a normal quality/long session. No pre-race mileage is forced.'});
   continue;
  }
  if(realLong==null){out.push({phase,sessions,hardRunsRequested,hardRunsScheduled:0,coachingFocus:'Recovery',coachingWhy:phaseIntent[phase],note:`${phase}: no pre-race running scheduled; protect recovery.`});continue;}
  const raceFamily=next?.event.kind||'short';
  const localFocus=next?.focus||'balanced';
  let longFraction=ultra?.35:raceFamily==='marathon'?.31:raceFamily==='half'?.28:(localFocus==='endurance'?.29:localFocus==='balanced'?.27:.24);
  if(ultra&&['Build','Race-specific'].includes(phase))longFraction=.37+Math.min(.05,buildWeeks*.004);
  const longCap=distanceGoal?.event.longCap||next?.event.longCap||18;
  let long=half(Math.min(target*longFraction,longCap));
  const recentLong=(p.recentLong===''||p.recentLong==null)?null:Number(p.recentLong);
  if(recentLong!=null&&Number.isFinite(recentLong)&&recentLong>=0){long=Math.min(long,half(recentLong*Math.pow(1.075,buildWeeks+1)+.5));}
  // Protect the rest of the week from being consumed by one long run.
  long=Math.min(long,half(Math.max(0,target-(safeActive.length-1)*.5)));
  let qualityDays=[];
  const activeOther=safeActive.filter(d=>d!==realLong);
  const canQuality=base>=12&&!novice&&!returning&&activeOther.length>=2&&['Build','Race-specific'].includes(phase)&&!raceWeek;
  // The runner selects hard-session frequency. The coach may REDUCE, never secretly increase it.
  // Two sessions need a consistent foundation and adequate spacing from each other and the long run.
  const capableOfTwo=base>=25&&daysCount>=5&&p.consistency==='steady'&&!novice&&!returning;
  const ultraSpecific=!!distanceGoal&&(['Race-specific'].includes(phase)||nextDays<=42);
  const hardCap=canQuality?Math.min(hardRunsRequested,(hardRunsRequested===2&&!capableOfTwo)||ultraSpecific?1:2):0;
  const eligible=activeOther.filter(d=>circular(d,realLong)>=2).sort((a,b)=>circular(b,realLong)-circular(a,realLong));
  for(const d of eligible){if(qualityDays.length>=hardCap)break;if(qualityDays.every(q=>circular(q,d)>=2))qualityDays.push(d)}
  const actualHardCountTarget=qualityDays.length;
  // Distribute the full training budget over existing running days; never add another run to meet a quota.
  const extra=activeOther.length;
  const effectiveLong=half(Math.min(long,target-(extra*.5)));
  const distanceRemaining=half(Math.max(0,target-effectiveLong));
  const assignments=distribute(distanceRemaining,activeOther,activeOther.map(d=>qualityDays.includes(d)?1.2:1));
  const goalPace=speedGoal?.goalPaceSeconds||null;
  const goalPaceForWorkout=speedGoal?.event.kind==='short'?goalPace:null;
  // Two complementary quality sessions for a well-trained 5K specialist; never two copies
  // of the same interval session. Ultra + 5K generally keeps one quality day + strides.
  const speedPresent=!!(speedGoal&&['short','half'].includes(speedGoal.event.kind));
  const primarySpeed=speedPresent;
  const buildMenu=phase==='Race-specific'?speedWorkoutsSpecific:speedWorkoutsBuild;
  const sessionBlock=Math.floor(Math.max(0,buildWeeks-1)/3);
  const primaryName=buildMenu[(sessionBlock+buildWeeks)%buildMenu.length];
  const secondaryName=supportingWorkouts[sessionBlock%supportingWorkouts.length];
  for(const d of activeOther){
   const miles=assignments[d]||0;
   if(qualityDays.includes(d)&&miles>=3.5){
    const idx=qualityDays.indexOf(d);
    const name=primarySpeed?(idx===0?primaryName:secondaryName):
      speedPresent?primaryName:secondaryName;
    const q=workout(name,miles,p,wi);
    if(q) sessions[d]=slot(wi,d,q.type,miles,q.details,{pace:q.pace,structure:q.structure,targetPaceRange:q.targetPaceRange,hrTarget:q.hrTarget,goalTags:goals.map(g=>g.id)});
    else sessions[d]=slot(wi,d,'Easy run + strides',miles,'Run at your established easy pace; 4 × 20 seconds of relaxed strides after. Add a recent 5K benchmark for numeric fast-workout targets.',{pace:easyTarget(p)?.label||'',hrTarget:measuredHR(p,'easy'),goalTags:goals.map(g=>g.id)});
   }else{
    const strides=includeSpeed&&qualityDays.length&&d!==realLong&&miles>=3&&d===activeOther.find(j=>!qualityDays.includes(j)&&circular(j,qualityDays[0])>=2);
    const easy=easyTarget(p),easyHR=measuredHR(p,'easy');
    const msg=strides?'Easy aerobic run, then 4–6 × 20 seconds smooth strides with full walking recovery. Strides are NOT HR-targeted.':base===0?'Alternate relaxed running and walking; stop for pain.': 'Easy aerobic running; use the calibrated easy heart-rate range and adjust pace for heat and hills.';
    sessions[d]=slot(wi,d,strides?'Easy run + strides':base===0?'Run / walk':'Easy run',miles,msg,{pace:easy?.label||'',targetPaceRange:easy,hrTarget:easyHR,goalTags:goals.map(g=>g.id)});
   }
  }
  const longNotes=ultra?'Easy long run; practice race terrain and fueling, record duration, and recover before speed work.':'Easy aerobic long run, steady and controlled.';
  sessions[realLong]=slot(wi,realLong,base===0?'Run / walk':'Long run',effectiveLong,longNotes+` Pace: ${easyTarget(p)?.label||'calibrated easy pace'}; HR: ${measuredHR(p,'easy')?.label||'not calibrated'}.`,{pace:easyTarget(p)?.label||'',targetPaceRange:easyTarget(p),hrTarget:measuredHR(p,'easy'),goalTags:distanceGoal?[distanceGoal.id]:goals.map(g=>g.id)});
  if(ultra&&p.experience==='advanced'&&p.consistency==='steady'&&daysCount>=5&&['Race-specific','Build'].includes(phase)){
   const nextday=(realLong+1)%7;
   if(activeOther.includes(nextday)&&sessions[nextday].type==='Easy run'){
    sessions[nextday].type='Back-to-back easy';
    sessions[nextday].details='Easy supporting aerobic session after long run. Not mandatory; shorten or skip if recovery is poor.';
   }
  }
  const total=sum(sessions.map(s=>s.miles));
  const gap=half(target-total);
  if(gap>0&&safeActive.length&&phase!=='Race week')sessions[safeActive.at(-1)].miles=half(sessions[safeActive.at(-1)].miles+gap);
  // Freshness budget: a simple explainable planning heuristic, not a physiological fatigue score.
  // Running minutes represent volume. Hard sessions and exceptionally long sessions add a
  // supplementary demand. If proposed demand exceeds the budget, replace the *last*
  // quality workout with easy running rather than taking away the runner's rest day.
  const estimatedEasySec=easyTarget(p)?.slowSeconds||parsePace(p.pace)||660;
  const duration=s=>s.miles*estimatedEasySec/60;
  const stressFor=()=>{
   const baseMinutes=sum(sessions.map(duration));
   const qualityExtra=sum(sessions.filter(s=>s.structure).map(s=>duration(s)*.25));
   const longMinutes=sum(sessions.filter(s=>s.type==='Long run').map(duration));
   const longExtra=Math.max(0,longMinutes-120)*.18;
   const backToBackExtra=sum(sessions.filter(s=>s.type==='Back-to-back easy').map(duration))*.07;
   return {baseMinutes,extraMinutes:qualityExtra+longExtra+backToBackExtra,totalMinutes:baseMinutes+qualityExtra+longExtra+backToBackExtra};
  };
  const budgetRatio=freshnessFirst?.09:.16;
  let balance=stressFor();
  const workloadCeiling=balance.baseMinutes*(1+budgetRatio);
  let freshnessDecision='The planned mix of speed, long running and recovery fits the weekly planning budget.';
  if(phase!=='Recovery'&&balance.totalMinutes>workloadCeiling){
   const quality=sessions.filter(s=>s.structure);
   while(quality.length&&balance.totalMinutes>workloadCeiling){
    const s=quality.pop();
    s.type='Easy run';s.structure=null;s.targetPaceRange=easyTarget(p);
    s.hrTarget=measuredHR(p,'easy');s.pace=s.targetPaceRange?.label||'';
    s.details='Easy aerobic run in place of a quality session to protect recovery while preserving weekly aerobic training. '+
      'Pace: '+(s.pace||'established easy pace')+'.';
    balance=stressFor();
    freshnessDecision='One or more hard sessions were exchanged for easy running because the proposed long-run and speed demands exceeded the week’s planning budget.';
   }
   if(balance.totalMinutes>workloadCeiling){
    freshnessDecision+=' The long-run demand still exceeds the preferred budget; review this week rather than increasing intensity.';
   }
  }
  const trainingBalance={
   plannedMinutes:Math.round(balance.baseMinutes),
   extraDemandUnits:Math.round(balance.extraMinutes),
   planningDemand:Math.round(balance.totalMinutes),
   planningBudget:Math.round(workloadCeiling),
   freshnessFirst,
   reason:freshnessDecision,
   note:'Relative planning units only—not a validated fatigue measurement or an injury-risk score.'
  };
  const otherDescription=goals.length>1?`Maintain ${speedGoal?'a controlled speed stimulus':'appropriate aerobic fitness'} while developing ${distanceGoal?'endurance for the later event':'the later race goal'}.`:`Train specifically for ${goals[0].distance} (${goals[0].focus}).`;
  const scheduledHard=sessions.filter(s=>s.structure).length;
  const hardReason=hardRunsRequested===0?'You requested no structured hard running.':scheduledHard<hardRunsRequested?(ultraSpecific?'Ultra-specific long-run demands and race timing reduced structured hard sessions.':'Training foundation, scheduling or recovery reduced hard-session frequency.'):'Hard sessions are spaced apart and away from the long run.';
  const primaryPurpose=phase==='Race-specific'&&ultra?'Long-run durability and race-specific endurance':speedPresent?'5K speed economy and controlled threshold support':ultra?'Aerobic volume and long-run durability':'Sustainable aerobic development';
  out.push({phase,sessions,trainingBalance,hardRunsRequested,hardRunsScheduled:scheduledHard,coachingFocus:primaryPurpose,coachingWhy:`${phaseIntent[phase]||'Manage workload.'} ${hardReason} ${otherDescription} ${freshnessDecision}`,note:`${phase}. ${otherDescription} Training target is an estimate; adjust for recovery and recent running history.`});
 }
 const maxLong=Math.max(...out.flatMap(w=>w.sessions.filter(s=>s.type==='Long run').map(s=>s.miles)),0);
 const maxWeek=Math.max(...out.map(w=>sum(w.sessions.map(s=>s.miles))));
 if(goals.some(g=>['ultra','timed'].includes(g.event.kind))&&maxWeek<35)warnings.push(`Projected peak is ${maxWeek} mi/week and longest run ${maxLong} mi. Race preparation may be insufficient; do not force mileage increases just to reach a target.`);
 if(goals.some(g=>g.distance==='50K')&&maxLong<20)warnings.push(`Longest scheduled 50K preparation run is ${maxLong} mi. Review your recent long-run history, weekly volume, time on feet and race demands rather than treating this as an automatic pass/fail.`);
 return {profile:{...p,hardRuns:hardRunsRequested,volumePreference,freshnessFirst,goal:goals[0].distance,focus:goals[0].focus,raceDate:last,weeks:weeksCount,goals:goals.map(g=>({id:g.id,distance:g.distance,focus:g.focus,raceDate:g.raceDate,timeGoal:g.timeGoal||'',distanceGoalMiles:g.distanceGoalMiles||null,goalPace:formatPace(g.goalPaceSeconds),timedAveragePace:g.timedAveragePace||null}))},weeks:out,created:new Date().toISOString(),assessment:{issues:warnings,notes,peakWeeklyMiles:maxWeek,peakLongRunMiles:maxLong},adjustmentHistory:[],engineVersion:'one-calendar-freshness-6.0'};
}
// Completed-run signals: race/interval splits for speed, full-run pace and average HR
// for easy work. Whole-session pace cannot measure fast intervals plus warmup/recovery.
// HR guidance must be an independently calibrated athlete-specific range.
function advise(plan,logs,options={}){
 if(!plan?.weeks)return {type:'hold',reason:'No plan available.',changes:[],requiresApproval:true};
 const recent=(logs||[]).filter(r=>r.status==='done'||r.status==='missed').slice(-21);
 const done=recent.filter(r=>r.status==='done'),missed=recent.filter(r=>r.status==='missed');
 if(recent.some(r=>r.pain===true))return {type:'pain',label:'Pause progression',reason:'Pain was reported. Do not increase training or treat this as medical clearance.',changes:[],requiresApproval:true};
 const measured=options.measuredEasyHrZone||measuredHR(plan.profile,'easy');
 const easy=done.filter(r=>/easy|long run/i.test(r.type||'')&&!/interval/i.test(r.type||''));
 const withHr=easy.filter(r=>Number(r.averageHr)>0);
 const highHR=measured?.max?withHr.filter(r=>Number(r.averageHr)>measured.max+5):[];
 const paceMiss=easy.filter(r=>{
  const actual=parsePace(r.actualPace)||Number(r.actualPaceSeconds)||0;
  const target=r.targetPaceRange?.slowSeconds||parsePace(r.targetPace)||0;
  return actual>0&&target>0&&actual>target+30 && (!measured?.max||Number(r.averageHr)>measured.max);
 });
 const quality=done.filter(r=>isQualityType(r.type)&&r.targetPaceRange);
 const qualityLogged=quality.filter(r=>Number(r.workPaceSeconds)>0||Array.isArray(r.intervalPacesSeconds)&&r.intervalPacesSeconds.length);
 const missedQuality=qualityLogged.filter(r=>{
  const work=Number(r.workPaceSeconds)||(r.intervalPacesSeconds.reduce((a,b)=>a+b,0)/r.intervalPacesSeconds.length);
  return work>(r.targetPaceRange.slowSeconds+10);
 });
 const missedRunCount=missed.length;
 if(missedRunCount>=2||highHR.length>=3||paceMiss.length>=3||missedQuality.length>=2){
  const why=[];
  if(missedRunCount>=2)why.push('two or more missed sessions');
  if(highHR.length>=3)why.push('repeated high HR relative to the runner-provided easy zone');
  if(paceMiss.length>=3)why.push('repeated difficulty maintaining easy pace with matching HR context');
  if(missedQuality.length>=2)why.push('repeated interval split paces slower than targets');
  return {type:'reduce',label:'Suggest an easier training block',reason:`Observed ${why.join(', ')}. Check conditions and sensor quality; HR alone does not diagnose injury.`,changes:[{field:'nextBuildWeekVolume',factor:.88},{field:'nextQualitySession',value:'easy'},{field:'easyPaceAdjustmentSeconds',value:20}],requiresApproval:true};
 }
 const easyWithPace=easy.filter(r=>{
  const observed=parsePace(r.actualPace)||Number(r.actualPaceSeconds)||0;
  const band=r.targetPaceRange;
  return observed&&band&&observed>=band.fastSeconds-10&&observed<=band.slowSeconds+10&&Number(r.actual)>=Number(r.miles)*.95;
 });
 const easyWithGoodHr=measured?.max?easyWithPace.filter(r=>Number(r.averageHr)>0&&Number(r.averageHr)<=measured.max):[];
 const qualityMet=qualityLogged.filter(r=>{
  const work=Number(r.workPaceSeconds)||(r.intervalPacesSeconds.reduce((a,b)=>a+b,0)/r.intervalPacesSeconds.length);
  return work>=r.targetPaceRange.fastSeconds-10&&work<=r.targetPaceRange.slowSeconds+10;
 });
 const speedFocus=plan.profile.goals?.some(g=>g.focus==='speed');
 const timeOK=Number(options.weeksOfData)>=2&&Number(options.daysSinceLastAdjustment??999)>=14;
 const good=timeOK&&done.length>=6&&missed.length===0&&easyWithGoodHr.length>=3&&(!speedFocus||qualityMet.length>=1);
 if(good)return {type:'progress',label:'Suggest a small progression',reason:'Across at least two weeks, multiple easy runs met measured pace and HR bounds and the required quality splits were completed. Increase only one workload variable with approval.',changes:[{field:'nextBuildWeekVolume',factor:1.025}],requiresApproval:true};
 return {type:'hold',label:'Maintain current training',reason:'Not enough verified pace + calibrated HR evidence to change the plan. Missing HR or interval splits do not count as a success or failure.',changes:[],requiresApproval:true};
}
function applyApproved(plan,recommendation,today){
 if(!plan||!recommendation||!['reduce','progress'].includes(recommendation.type)||!validDate(today))return {error:'Invalid plan, date, or recommendation.'};
 const copy=JSON.parse(JSON.stringify(plan));
 const nextIndex=copy.weeks.findIndex((w,i)=>{
  let start=addDays(copy.profile.startDate,i*7);
  return start>today&&['Build','Race-specific','Foundation'].includes(w.phase);
 });
 if(nextIndex<0)return {error:'No eligible future build week. No changes made.'};
 const week=copy.weeks[nextIndex],eligible=week.sessions.filter(s=>s.status==='planned'&&s.miles>0&&!s.manual&&!['RACE DAY','Post-race recovery'].includes(s.type));
 const factor=recommendation.changes.find(c=>c.field==='nextBuildWeekVolume')?.factor;
 if(!Number.isFinite(factor)||factor<.8||factor>1.05)return {error:'Unsupported workload adjustment.'};
 const easyPaceSeconds=recommendation.changes.find(c=>c.field==='easyPaceAdjustmentSeconds')?.value;
 for(const s of eligible){
  if(recommendation.type==='reduce'&&isQualityType(s.type)){
   s.type='Easy run';s.details='Temporary easy workout after repeated pace/HR concerns.';s.structure=null;s.targetPaceRange=easyTarget(copy.profile);s.hrTarget=measuredHR(copy.profile,'easy');s.pace=s.targetPaceRange?.label||'';
  }
  if(recommendation.type==='reduce'&&Number.isFinite(easyPaceSeconds)&&easyPaceSeconds>0&&/Easy run|Long run/i.test(s.type)&&s.targetPaceRange){s.targetPaceRange=paceBand(s.targetPaceRange.fastSeconds+easyPaceSeconds,s.targetPaceRange.slowSeconds+easyPaceSeconds);s.pace=s.targetPaceRange.label;}
  s.miles=half(s.miles*factor);
 }
 copy.adjustmentHistory.push({date:today,type:recommendation.type,week:nextIndex+1,reason:recommendation.reason,approved:true});
 week.note+=` Runner-approved ${recommendation.type==='progress'?'small progression':'recovery adjustment'}.`;
 return {plan:copy,changedWeek:nextIndex+1};
}
root.MileZeroCoachV6={version:'one-calendar-freshness-6.0',distances:Object.keys(SPECS),validate,build,advise,applyApproved,parseGoalTime,formatPace};
if(typeof module!=='undefined'&&module.exports)module.exports=root.MileZeroCoachV6;
})(typeof window!=='undefined'?window:globalThis);
