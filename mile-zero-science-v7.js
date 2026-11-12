/* MILE Ø Science Rules v7.2 — target-aware mileage without universal race ceilings.
   Load AFTER mile-zero-coach-v6.js and BEFORE mile-zero-live-upgrade.js.
   A live athlete's plan is changed ONLY by explicit regeneration or approval.
   Evidence-informed heuristics, NOT validated safe mileage thresholds or medical advice.
   Supabase, Strava, account data and existing saved plans are not touched here.
*/
(function(root){
'use strict';
const previous=root.MileZeroCoachV6;
if(!previous){throw new Error('MileZeroScienceV7 requires mile-zero-coach-v6.js first');}
const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
// These mileage ranges are advisory COACHING REFERENCE BANDS, never peak-mileage limits,
// individual prescriptions, or evidence-supported minimums to finish an event.
// novice/steady/advanced denote current training CAPACITY, not race-distance entitlement.
const RACE_RULES={
 'First mile / run-walk':{kind:'beginner',bands:[[2,6],[4,10],[6,12]],taper:0,minWeeks:4,longHours:.7,longShare:.28,hard:0},
 '5K':                 {kind:'short',   bands:[[10,20],[18,35],[30,55]],taper:1,minWeeks:6,longHours:1.5,longShare:.25,hard:2},
 '10K':                {kind:'short',   bands:[[15,25],[25,40],[40,65]],taper:1,minWeeks:8,longHours:1.75,longShare:.27,hard:2},
 'Half Marathon':      {kind:'half',    bands:[[18,32],[28,45],[40,65]],taper:2,minWeeks:10,longHours:2.5,longShare:.31,hard:2},
 'Marathon':           {kind:'marathon',bands:[[25,40],[35,55],[50,75]],taper:2,minWeeks:14,longHours:3.5,longShare:.34,hard:1},
 '50K':                {kind:'ultra',   bands:[[30,45],[40,60],[50,75]],taper:2,minWeeks:14,longHours:4,longShare:.36,hard:1},
 '50 Mile':            {kind:'ultra',   bands:[[35,50],[45,70],[60,90]],taper:3,minWeeks:16,longHours:4.5,longShare:.37,hard:1},
 '100K':               {kind:'ultra',   bands:[[40,55],[55,75],[65,100]],taper:3,minWeeks:20,longHours:5,longShare:.37,hard:1},
 '100 Mile':           {kind:'ultra',   bands:[[45,65],[60,85],[75,110]],taper:3,minWeeks:24,longHours:5,longShare:.37,hard:1},
 '6 Hour':             {kind:'timed',   bands:[[30,45],[40,60],[50,75]],taper:2,minWeeks:12,longHours:4,longShare:.36,hard:1},
 '12 Hour':            {kind:'timed',   bands:[[35,50],[45,70],[60,90]],taper:3,minWeeks:16,longHours:4.5,longShare:.37,hard:1},
 '24 Hour':            {kind:'timed',   bands:[[40,60],[55,80],[70,100]],taper:3,minWeeks:24,longHours:5,longShare:.37,hard:1}
};
const SOURCES={
 intensity:'https://pubmed.ncbi.nlm.nih.gov/34749417/',
 taper:'https://pmc.ncbi.nlm.nih.gov/articles/PMC10171681/',
 mileage:'https://pmc.ncbi.nlm.nih.gov/articles/PMC7890117/',
 longRuns:'https://trainright.com/how-to-determine-weekly-run-training-volume/',
 sessionSpike:'https://bjsm.bmj.com/content/59/17/1203',
 marathonExamples:'https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/',
 ultramarathonLimitations:'https://pubmed.ncbi.nlm.nih.gov/38215736/'
};
const half=x=>Math.round(Math.max(0,Number(x)||0)*2)/2;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const sum=a=>a.reduce((s,v)=>s+Number(v||0),0);
const miPerKm=0.621371192;
const daysBetween=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
const plusDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const parsePace=v=>{const m=/^(\d{1,2}):([0-5]\d)$/.exec(String(v||''));return m?Number(m[1])*60+Number(m[2]):null;};
const paceLabel=s=>Number.isFinite(s)&&s>0?`${Math.floor(Math.round(s)/60)}:${String(Math.round(s)%60).padStart(2,'0')}`:null;
const parseClock=previous.parseGoalTime;
const isQuality=s=>!!s.structure;
const isLong=s=>/Long run|Back-to-back/i.test(s.type||'');
function paceBand(fast,slow){return {fastSeconds:Math.round(fast),slowSeconds:Math.round(slow),label:`${paceLabel(fast)}–${paceLabel(slow)}/mi`};}
function easyPace(p){
 const fromEasy=parsePace(p.pace),fromBenchmark=p.recent5kTime?parseClock(p.recent5kTime)/3.106856:0;
 const anchor=Math.max(fromEasy||0,fromBenchmark?fromBenchmark*1.14:0);
 return anchor?paceBand(anchor,anchor+40):null;
}
function measuredHr(p,kind){const lo=p[kind+'HrMin'],hi=p[kind+'HrMax'];if(lo===''||hi===''||lo==null||hi==null)return null;return {min:Number(lo),max:Number(hi),label:`${lo}–${hi} bpm`};}
function makeSession(w,d,type='Rest / mobility',miles=0,details='Rest, gentle walking, or mobility.',more={}){
 return {id:`${w}-${d}`,day:days[d],type,miles:half(miles),pace:'',details,status:'planned',actual:null,actualPace:'',averageHr:null,pain:false,notes:'',manual:false,...more};
}
function distribute(total,indices,weights){
 if(!indices.length)return {};
 const units=Math.round(half(total)*2),weightTotal=sum(weights),raw=weights.map(v=>weightTotal?units*v/weightTotal:units/indices.length);
 const allocated=raw.map(Math.floor);let left=units-sum(allocated);
 const order=raw.map((v,i)=>({i,rem:v-allocated[i]})).sort((a,b)=>b.rem-a.rem||a.i-b.i);
 for(let i=0;i<left;i++)allocated[order[i].i]++;
 return Object.fromEntries(indices.map((d,i)=>[d,allocated[i]/2]));
}
function runDays(count,longDay){
 const result=[longDay];
 for(const offset of [3,5,1,4,2,6]){
  if(result.length>=count)break;
  let d=(longDay+offset)%7;if(!result.includes(d))result.push(d);
 }
 return result.sort((a,b)=>a-b);
}
function experienceLevel(p){
 // Capacity, consistency AND event history matter; years alone never grant advanced workload.
 const years=p.yearsRunning===''||p.yearsRunning==null?null:Number(p.yearsRunning);
 const event=p.priorRaceExperience||'none';
 const m=Number(p.mileage)||0;
 if(p.experience==='new'||p.consistency==='returning'||m<10||years!==null&&years<1)return 'new';
 if(p.experience==='advanced'&&p.consistency==='steady'&&m>=30&&
    (years===null||years>=3)&&(['half','marathon','ultra'].includes(event)||years===null))return 'advanced';
 return 'steady';
}
function bandFor(goal,experience){
 const spec=RACE_RULES[goal];if(!spec)return null;
 return spec.bands[experience==='advanced'?2:experience==='new'?0:1];
}
function topSpeedGoal(goals,weekStart){return goals.filter(g=>g.raceDate>=weekStart&&(g.focus==='speed'||g.focus==='balanced')&&['short','half'].includes(g.spec.kind)).sort((a,b)=>a.raceDate.localeCompare(b.raceDate))[0]||null;}
function topDistanceGoal(goals,weekStart){return goals.filter(g=>g.raceDate>=weekStart&&['marathon','ultra','timed','half'].includes(g.spec.kind)).sort((a,b)=>{
  const rank=g=>({half:1,marathon:2,ultra:3,timed:3}[g.spec.kind]||0);
  return rank(b)-rank(a)||a.raceDate.localeCompare(b.raceDate);
 })[0]||null;}
// Consistent work families, not random workouts. Builds progressing repetitions by mesocycle.
const SESSION_MENU={
 short:{interval:['5 × 400m at current 5K pace','5 × 600m at current 5K pace','4 × 800m at current 5K pace','4 × 1,000m at current 5K pace','5K pace ladder: 400/800/1,000/800/400m'],threshold:['3 × 5 min threshold','2 × 10 min threshold','3 × 8 min threshold','20 min continuous threshold','4 × 6 min threshold']},
 half:{interval:['5 × 800m at current 5K pace','4 × 1,000m at current 5K pace','5 × 1,000m at current 5K pace'],threshold:['3 × 8 min threshold','2 × 12 min threshold','3 × 10 min threshold','25 min controlled threshold']},
 marathon:{interval:['6 × 60 sec short hills','5 × 3 min controlled uphill'],threshold:['2 × 12 min threshold','3 × 10 min threshold','2 × 15 min threshold']},
 ultra:{interval:['6 × 45 sec hills','6 × 1 min controlled hills'],threshold:['2 × 8 min threshold','3 × 8 min threshold','20 min steady threshold']}
};
function qualityPrescription(p,category,goal,buildIndex,mi){
 const benchmark=Number(parseClock(p.recent5kTime));const easy=easyPace(p);const eHR=measuredHr(p,'easy');
 if(!benchmark || !Number.isFinite(benchmark) || !easy)return null;
 const fivePace=benchmark/3.106856;
 const group=goal?.spec.kind==='short'?'short':goal?.spec.kind==='half'?'half':goal?.spec.kind==='marathon'?'marathon':'ultra';
 const options=SESSION_MENU[group][category];
 const recipe=options[Math.floor(buildIndex/2)%options.length];
 const range=category==='interval'?paceBand(fivePace*.98,fivePace*1.03):paceBand(fivePace*1.06,fivePace*1.13);
 const threshold=category==='threshold'?measuredHr(p,'threshold'):null;
 // Default structural support; workout work time/total mileage are not reverse-engineered from average pace.
 const warm=mi>=7?1.5:1, cool=mi>=7?1.5:1;
 let reps=null,meters=null,recoverySeconds=category==='interval'?105:90,workMinutes=null;
 const segment=recipe.match(/^(\d+) × (\d[\d,]*)m/);
 const timed=recipe.match(/^(\d+) × (\d+) min/);
 if(segment){reps=Number(segment[1]);meters=Number(segment[2].replace(',',''));}
 if(timed){reps=Number(timed[1]);workMinutes=Number(timed[2]);}
 const workMiles=segment?reps*meters/1609.344:timed?reps*workMinutes/(range.slowSeconds/60):category==='threshold'?20/(range.slowSeconds/60):2.8;
 const minDistance=warm+cool+workMiles;
 if(minDistance>mi+.25)return null; // Never prescribe more interval work than session accommodates.
 const perRep=meters?`${paceLabel(meters/1609.344*range.fastSeconds)}–${paceLabel(meters/1609.344*range.slowSeconds)} each`:null;
 const text=`Warm up ${warm} mi easily. ${recipe}, target ${range.label}${perRep?` (${perRep})`:''}; ${recoverySeconds} seconds jog/walk between repetitions where relevant. Cool down ${cool} mi; fill remaining mileage easily. ${category==='interval'?'Use split pace for repetitions, not lagging HR.':threshold?`Individual threshold HR reference: ${threshold.label}, evaluated after HR stabilizes.`:'Threshold HR unavailable; avoid inventing a bpm target.'}`;
 return {type:category==='interval'?'Speed intervals':'Threshold / tempo',details:text,pace:range.label,targetPaceRange:range,hrTarget:threshold,structure:{kind:category,recipe,warmupMiles:warm,cooldownMiles:cool,repetitions:reps,meters,recoverySeconds,workMinutes,workPace:range,estimatedWorkMiles:Math.round(workMiles*100)/100},estimatedFastMiles:Math.round(workMiles*100)/100};
}
function allocateQualityDays(active,longDay,count){
 const eligible=active.filter(d=>d!==longDay&&Math.min((d-longDay+7)%7,(longDay-d+7)%7)>=2);
 const ordered=eligible.sort((a,b)=>{
  const dd=x=>Math.min((x-longDay+7)%7,(longDay-x+7)%7);
  return dd(b)-dd(a);
 });
 let chosen=[];
 for(const d of ordered){if(chosen.length>=count)break;if(chosen.every(c=>Math.abs(c-d)>1))chosen.push(d);}
 return chosen.sort((a,b)=>a-b);
}
function taperFactor(weeksUntilRace,taperWeeks){
 if(weeksUntilRace===0)return .42;
 if(taperWeeks===1)return .75;
 if(taperWeeks===2)return weeksUntilRace===2?.85:.68;
 return weeksUntilRace===3?.88:weeksUntilRace===2?.73:.58;
}
function build(p){
 const issues=previous.validate(p);if(issues.length)return {error:issues.join(' '),issues};
 const goals=(p.goals||[]).map((g,i)=>({...g,id:g.id||`goal${i+1}`,spec:RACE_RULES[g.distance]})).sort((a,b)=>a.raceDate.localeCompare(b.raceDate));
 if(!goals.length || goals.some(g=>!g.spec))return {error:'Unsupported race goal.'};
 const end=goals.at(-1).raceDate, weeks=Math.floor(daysBetween(p.startDate,end)/7)+1;
 const base=Number(p.mileage),established=(p.establishedMileage===''||p.establishedMileage==null)?null:Number(p.establishedMileage),
       preferredPeak=(p.preferredPeakMiles===''||p.preferredPeakMiles==null)?null:Number(p.preferredPeakMiles);
 const experience=experienceLevel(p);
 const returning=p.consistency==='returning',variable=p.consistency==='variable',novice=experience==='new'||base<10;
 const goalMostDemanding=[...goals].sort((a,b)=>b.spec.bands[1][0]-a.spec.bands[1][0])[0];
 const bands=goals.map(g=>({goal:g.distance,band:bandFor(g.distance,experience)}));
 const recommendedLower=Math.max(...bands.map(x=>x.band[0]));
 const recommendedUpper=Math.max(...bands.map(x=>x.band[1]));
 const capDays=Math.min(6,Number(p.days)),longDay=Number(p.longday),active=runDays(capDays,longDay);
 const hardRequested=Number(p.hardRuns??1),freshness=p.freshnessFirst!==false;
 const pref=p.volumePreference||'steady';
 // Coaching rates to compare target feasibility, NOT clinically proven injury-prevention percentages.
 const fromRecent=base*(returning?.75:variable?.9:1);
 let anchor=fromRecent,buildCount=0,lastLong=Number(p.recentLong)>0?Number(p.recentLong):Math.max(1,base*.29),longKnown=Number(p.recentLong)>0;
 const easy=easyPace(p),easyHr=measuredHr(p,'easy');
 const warnings=[],notes=[],out=[];
 notes.push(`Experience profile: ${experience}, determined from current mileage, consistency, selected level, and available training/event history.`);
 if(weeks<goalMostDemanding.spec.minWeeks)warnings.push(`Preparation window is ${weeks} weeks. Coaching reference for ${goalMostDemanding.distance} is approximately ${goalMostDemanding.spec.minWeeks}+ weeks from an appropriate base; consider adjusting the goal or date.`);
 if(base<recommendedLower*.5)warnings.push(`Current ${base} mi/week is far below the ${recommendedLower}–${recommendedUpper} mi/week coaching reference for this level and distance. The algorithm will NOT jump to that reference.`);
 if(capDays<4&&recommendedLower>=35)warnings.push('Longer-distance race with fewer than four running days: frequent very long sessions may be needed. Consider more days or an extended build.');
 if(!longKnown)warnings.push('No recent long-run distance was provided. Long runs use a conservative estimate until real history is available.');
 if(returning)warnings.push('Returning from a break: reduced starting volume and no immediate quality sessions.');
 if(hardRequested===2&&(base<22||capDays<5||returning||variable||novice))warnings.push('Two hard runs requested, but recent base, consistency, or training days limit the plan to one or fewer.');
 if(goals.length===2&&daysBetween(goals[0].raceDate,goals[1].raceDate)<14)warnings.push('Races less than 14 days apart: second-race performance and recovery conflict; manual review recommended.');
 for(const g of goals){
  if(g.timeGoal&&g.spec.kind!=='timed'){const secs=parseClock(g.timeGoal),miles=({ 'First mile / run-walk':1,'5K':3.106856,'10K':6.213712,'Half Marathon':13.1094,'Marathon':26.2188,'50K':31.0686,'50 Mile':50,'100K':62.1371,'100 Mile':100 })[g.distance];g.goalPace=paceLabel(secs/miles);}
 }
 // Mileage is a planning objective, NOT a race-distance cap. The reference band
 // is contextual advice only; an established runner above it is not restricted.
 // Without a preferred peak, suggest a modest goal informed by race demands and
 // recently established mileage, then assess what the actual build can support.
 const referenceMid=(recommendedLower+recommendedUpper)/2;
 const requestedTarget=preferredPeak!==null?preferredPeak:
   Math.max(base, established||0, experience==='new'?recommendedLower:referenceMid);
 const advanceRate=returning?.025:variable?.035:novice?.035:
   pref==='gradual'?.045:pref==='progressive'&&experience==='advanced'?.09:
   pref==='progressive'?.075:experience==='advanced'?.07:.06;
 // Schedule the build in advance: race weeks, tapers and recovery weeks do NOT
 // count as mileage-progression opportunities. A peak is planned before taper.
 function context(wi){
   const start=plusDays(p.startDate,wi*7),weekDates=days.map((_,d)=>plusDays(start,d));
   const pending=goals.filter(g=>g.raceDate>=start),nearest=pending[0]||goals.at(-1);
   const raceInWeek=goals.filter(g=>weekDates.includes(g.raceDate));
   const until=Math.floor(daysBetween(start,nearest.raceDate)/7);
   const previousRace=goals.filter(g=>{
     const elapsed=daysBetween(g.raceDate,start);
     const window=['beginner','short'].includes(g.spec.kind)?3:g.spec.kind==='half'?5:g.spec.kind==='marathon'?10:14;
     return g.raceDate<start&&elapsed<=window;
   });
   const taper=until>0&&until<=nearest.spec.taper;
   const race=raceInWeek.length>0,post=previousRace.length>0;
   const down=!race&&!post&&!taper&&wi>0&&((wi+1)%4===0);
   const phase=race?'Race week':post?'Post-race recovery':taper?'Taper':down?'Recovery':wi<2?'Foundation':daysBetween(start,nearest.raceDate)<=42?'Race-specific':'Build';
   return {start,weekDates,nearest,raceInWeek,recoveryDays:previousRace,primaryTaper:taper,raceWeek:race,postRace:post,downWeek:down,phase,weeksToNearest:until};
 }
 const contexts=Array.from({length:weeks},(_,wi)=>context(wi));
 const isProgression=(c,wi)=>wi>0&&['Build','Foundation','Race-specific'].includes(c.phase);
 const totalBuildSteps=contexts.filter(isProgression).length;
 let stepsTaken=0;
 const theoreticalReachable=totalBuildSteps>0?fromRecent*Math.pow(1+advanceRate,totalBuildSteps):fromRecent;
 notes.push(`Preferred mileage is ${preferredPeak===null?'not specified':'a requested target, not a ceiling'}. No fixed race-distance peak-mileage ceiling is applied.`);
 notes.push(`Training forecast: ${totalBuildSteps} non-recovery build opportunities, an individualized provisional progression allowance near ${(advanceRate*100).toFixed(1)}% per build opportunity. These are configurable heuristics, not proven safe rates.`);
 if(preferredPeak!==null&&preferredPeak>theoreticalReachable+1){
  warnings.push(`Requested peak ${preferredPeak} mi/week exceeds the estimated ${half(theoreticalReachable)} mi/week progression capacity over ${totalBuildSteps} build opportunities from the entered current base. The plan will show the shortfall rather than force a catch-up. Consider more time or provide verifiable recent training history.`);
 }
 const typicalOtherBase=Math.max(.5,(base-(longKnown?Math.min(lastLong,base*.55):base*.29))/Math.max(1,capDays-1));
 const originallyRequested=hardRequested;
 // The higher-volume race dictates endurance FOUNDATION; speed goals still retain their
 // own workout type. This is one schedule, NEVER the sum of two independent plans.
 for(let wi=0;wi<weeks;wi++){
  const ctx=contexts[wi];
  const {start,weekDates,nearest,raceInWeek,recoveryDays,primaryTaper,raceWeek,postRace,downWeek,phase,weeksToNearest}=ctx;
  const endurance=topDistanceGoal(goals,start),speed=topSpeedGoal(goals,start);
  const raceDays=new Set(raceInWeek.map(g=>weekDates.indexOf(g.raceDate)));
  const daysToNearest=daysBetween(start,nearest.raceDate);
  let target;
  if(wi===0)target=anchor;
  else if(postRace)target=anchor*(recoveryDays.every(g=>['beginner','short'].includes(g.spec.kind))?.82:recoveryDays.some(g=>['marathon','ultra','timed'].includes(g.spec.kind))?.45:.7);
  else if(raceWeek)target=anchor*taperFactor(0,nearest.spec.taper);
  else if(primaryTaper)target=anchor*taperFactor(weeksToNearest,nearest.spec.taper);
  else if(downWeek)target=anchor*.80;
  else {
   // Work BACKWARD from the requested (or recommended) peak so the weekly
   // progression actually aims for it. If time is inadequate, increase only as
   // allowed by the athlete-specific heuristic and report the shortfall.
   const remainingSteps=Math.max(1,totalBuildSteps-stepsTaken);
   const rawNeed=anchor>0&&requestedTarget>anchor?
     Math.pow(requestedTarget/anchor,1/remainingSteps)-1:0;
   const rate=Math.min(advanceRate,Math.max(0,rawNeed));
   anchor=anchor>0?anchor*(1+rate):0;
   buildCount++;stepsTaken++;
   target=anchor;
  }
  if(base===0){
   // New runner foundation: an ambitious ultra target does not turn zero
   // experience into an immediate high-mileage plan.
   target=Math.min(12,2.5+buildCount*.7);
   if(downWeek)target*=.8;
   if(raceWeek||primaryTaper)target*=.7;
   if(['Build','Foundation','Race-specific'].includes(phase))anchor=target;
  }
  target=half(target);
  const sessions=days.map((_,d)=>makeSession(wi,d));
  const protectedDays=new Set();
  for(const g of goals){
   const idx=weekDates.indexOf(g.raceDate);
   if(idx>=0){sessions[idx]=makeSession(wi,idx,'RACE DAY',0,`${g.distance} race day. Race mileage is not included in planned training mileage.`,{raceGoalIds:[g.id]});protectedDays.add(idx);
    for(let d=Math.max(0,idx-2);d<idx;d++)protectedDays.add(d);
    for(let d=idx+1;d<7;d++){sessions[d]=makeSession(wi,d,'Post-race recovery',0,'Recover after the event; do not automatically make up missed workouts.');protectedDays.add(d);}
   }
   const eventBeforeWeek=daysBetween(g.raceDate,start);
   const recoveryWindow=['beginner','short'].includes(g.spec.kind)?2:g.spec.kind==='half'?4:g.spec.kind==='marathon'?9:14;
   if(eventBeforeWeek>0&&eventBeforeWeek<=recoveryWindow){for(let d=0;d<7;d++){
    if(daysBetween(g.raceDate,weekDates[d])<=recoveryWindow&&weekDates[d]>g.raceDate){protectedDays.add(d);sessions[d]=makeSession(wi,d,'Post-race recovery',0,'Recover after race; progression paused.');}
   }}
  }
  const available=active.filter(d=>!protectedDays.has(d));
  if(!available.length){out.push({phase,sessions,hardRunsRequested:hardRequested,hardRunsScheduled:0,coachingFocus:'Recovery',coachingWhy:'Races and protected recovery take priority.',trainingBalance:{reason:'No ordinary training scheduled.',planningDemand:0,planningBudget:0},note:'Recovery / race constraints.'});continue;}
  if(raceWeek){
   const slots=distribute(Math.min(target,available.length*3),available,available.map(()=>1));
   for(const d of available)sessions[d]=makeSession(wi,d,'Easy run',slots[d],'Short pre-race easy running; race replaces long and hard training.',{pace:easy?.label||'',targetPaceRange:easy,hrTarget:easyHr});
   out.push({phase,sessions,hardRunsRequested:hardRequested,hardRunsScheduled:0,coachingFocus:'Race preparation',coachingWhy:'Reduced pre-race mileage. No additional hard training or long run in race week.',trainingBalance:{reason:'Race replaces the demanding workout.',planningDemand:0,planningBudget:0},note:'Event mileage is excluded from training miles.'});continue;
  }
  if(postRace){
   // A short race normally needs fewer days off than an ultra. Preserve easy
   // aerobic consistency after a 5K while removing intensity from the week.
   const shortOnly=recoveryDays.every(g=>['beginner','short'].includes(g.spec.kind));
   const slots=distribute(shortOnly?target:Math.min(target,available.length*3),available,available.map(()=>1));
   for(const d of available)sessions[d]=makeSession(wi,d,'Recovery run',slots[d],'Very easy recovery only if fully comfortable and appropriate; no intensity.',{pace:easy?.label||'',targetPaceRange:easy,hrTarget:easyHr});
   out.push({phase,sessions,hardRunsRequested:hardRequested,hardRunsScheduled:0,coachingFocus:'Post-race recovery',coachingWhy:'The prior event is a significant stressor. Recover before resuming the later race build.',trainingBalance:{reason:'Reduced post-race load.',planningDemand:0,planningBudget:0},note:'Race recovery can require more time than this default.'});continue;
  }
  // If fewer than two run days, no long-run-specific overload or quality.
  const longSlot=available.includes(longDay)?longDay:(available.find(d=>d!==undefined)??null);
  const hasLong=longSlot!==null;
  const longRace=endurance||nearest;
  const focus=endurance?.focus||nearest.focus;
  // Goal focus matters: endurance allocates more easy time-on-feet; speed protects
  // two separate quality sessions where compatible with recovery and history.
  const fraction=clamp(longRace.spec.longShare+(focus==='endurance'?.03:focus==='speed'?-.04:0),.20,.40);
  const desiredLong=target*fraction;
  const paceSeconds=easy?.slowSeconds||parsePace(p.pace)||660;
  // Long-run duration guidance can flex with an established base, but does not
  // grow simply because the athlete typed a huge peak target.
  const sessionHours=longRace.spec.longHours*(experience==='advanced'&&
     base>=recommendedLower?1.2:1);
  const timeCapMiles=sessionHours*3600/paceSeconds;
  const maxSafeShare=available.length<=2?.45:available.length===3?.40:.40;
  const shareLimit=target*maxSafeShare;
  const spikeCeiling=lastLong*1.10+0.1; // cautious SESSION-spike check; NOT a proven universally safe rate.
  let long=hasLong?half(Math.min(desiredLong,shareLimit,timeCapMiles,spikeCeiling)):0;
  if(downWeek||primaryTaper)long=half(Math.min(long,lastLong*(downWeek?.78:.68)));
  if(!downWeek&&!primaryTaper&&long>lastLong)lastLong=long;
  const remaining=half(Math.max(0,target-long));const other=available.filter(d=>d!==longSlot);
  let actualTarget=target;
  // Do not force a giant single run in a 1-day schedule; explain the unallocated target.
  if(!other.length){actualTarget=long;}
  // No arbitrary 14-mile cap on ordinary runs. Distribute the ENTIRE remaining
  // volume over the runner's chosen days when recent single-session exposure
  // supports it. The daily exposure budget grows with the build (no fixed
  // absolute maximum); unmet mileage is reported rather than silently lost.
  const progressedDailyExposure=Math.max(4,base/Math.max(2,capDays)*1.2,
     typicalOtherBase*Math.pow(1+advanceRate+.025,buildCount+1));
  // Avoid a supposed "long run" being SHORTER than every normal training day.
  // This bound follows the actual long run and can grow when evidence supports
  // a longer duration. It is not an absolute or race-distance mileage cap.
  const regularDayBudget=Math.min(progressedDailyExposure,Math.max(2,long*.9));
  const allocatableOther=half(Math.min(remaining,other.length*regularDayBudget));
  let allocations=distribute(allocatableOther,other,other.map(()=>1));
  const otherAllocated=sum(Object.values(allocations));
  actualTarget=half(long+otherAllocated);
  const lost=half(target-actualTarget);
  // During short-race taper retain a small taste of speed when athlete is ready;
  // taper research generally favors reduced VOLUME without eliminating intensity.
  const taperSharpener=primaryTaper&&nearest.spec.kind==='short'&&!!speed&&
    base>=15&&experience!=='new'&&!returning;
  const desiredHard=phase==='Recovery'||phase==='Foundation'?0:
    primaryTaper?(taperSharpener?Math.min(1,hardRequested):0):hardRequested;
  const eligibleForTwo=base>=22&&capDays>=5&&!returning&&!variable&&!novice&&experience!=='new';
  const speedPriority=!!speed&&(speed.focus==='speed'||speed.focus==='balanced');
  const ultraRaceClose=!!endurance&&['ultra','timed'].includes(endurance.spec.kind)&&
     daysBetween(start,endurance.raceDate)<=42;
  const preferredHardByRace=ultraRaceClose?1:
    speedPriority&&experience!=='new'?2:
    nearest.spec.kind==='short'&&nearest.focus==='endurance'?1:nearest.spec.hard;
  const hardLimit=base>=12&&!returning&&!novice&&available.length>=4?Math.min(desiredHard,preferredHardByRace,(eligibleForTwo?2:1)):0;
  const longDemand=long>=16||(easy&&long*easy.slowSeconds/60>=150);
  const freshnessHardCap=freshness&&longDemand?Math.min(1,hardLimit):hardLimit;
  const qDays=allocateQualityDays(available,longSlot,freshnessHardCap);
  const goalForQuality=speed||nearest;
  const workoutTypes=qDays.map((d,i)=>i===0?'interval':'threshold');
  if(qDays.length===1){workoutTypes[0]=speedPriority?'interval':'threshold';}
  for(const d of other){
   const miles=allocations[d]||0;
   const qi=qDays.indexOf(d);
   if(qi>=0&&miles>=3){
    const kind=workoutTypes[qi];const q=qualityPrescription(p,kind,goalForQuality,buildCount,miles);
    if(q){sessions[d]=makeSession(wi,d,q.type,miles,q.details,{pace:q.pace,targetPaceRange:q.targetPaceRange,hrTarget:q.hrTarget,structure:q.structure,goalTags:goals.map(g=>g.id),estimatedFastMiles:q.estimatedFastMiles});continue;}
   }
   sessions[d]=makeSession(wi,d,'Easy run',miles,'Easy aerobic running. '+(easy?`Pace ${easy.label}. `:'Enter a real pace benchmark for numeric targets. ')+(easyHr?`Athlete-calibrated HR ${easyHr.label}.`:'HR unavailable; no invented HR zone.'),{pace:easy?.label||'',targetPaceRange:easy,hrTarget:easyHr,goalTags:goals.map(g=>g.id)});
  }
  if(hasLong)sessions[longSlot]=makeSession(wi,longSlot,base===0?'Run / walk':'Long run',long,`Aerobic endurance (${Math.round(long*paceSeconds/60)} estimated minutes). ${longRace.distance} race specificity: terrain, fueling, and time on feet. ${easy?`Easy pace ${easy.label}.`:''} ${easyHr?`Measured HR range ${easyHr.label}.`:'Do not invent HR targets.'}`,{pace:easy?.label||'',targetPaceRange:easy,hrTarget:easyHr,goalTags:[longRace.id]});
  // Recovery runs are genuine easy scheduled sessions after hard quality or long days.
  for(let d=0;d<7;d++){
   const s=sessions[d];if(s.type==='Easy run'&&s.miles>0){const prev=(d+6)%7;
    if(isQuality(sessions[prev])||isLong(sessions[prev])){s.type='Recovery run';s.details='Short easy recovery day. '+s.details;}
   }
  }
  // Never invent a hard run if the requested hard count is zero or the data is insufficient.
  const hardCount=sessions.filter(isQuality).length;
  const fastMiles=sum(sessions.filter(isQuality).map(s=>s.estimatedFastMiles||0));
  const intensityShare=actualTarget?fastMiles/actualTarget:0;
  // Restrict measured fast volume, not the number of runs alone. If intensity is too high,
  // downgrade SECOND quality session, preserving easy miles.
  if(intensityShare>.23){
   const q=sessions.filter(isQuality);
   while(q.length && sum(sessions.filter(isQuality).map(s=>s.estimatedFastMiles||0))/Math.max(actualTarget,1)>.23){
    const s=q.pop();s.type='Easy run';s.details='Easy aerobic training; faster work limited this week to avoid excessive intensity.';delete s.structure;delete s.estimatedFastMiles;s.targetPaceRange=easy;s.hrTarget=easyHr;s.pace=easy?.label||'';
   }
  }
  const finalHard=sessions.filter(isQuality).length;
  const actualMiles=half(sum(sessions.map(s=>s.miles)));
  const unsupported=lost>0;
  const why=`${phase}. ${nearest.distance} is the nearer goal; ${goals.length===2?'both race demands are covered in ONE schedule.':'the week’s stimulus matches this race.'} `+
   `${longRace.distance} endurance long run + ${finalHard}/${hardRequested} requested quality workout(s); ${nearest.focus} priority, ${experience} experience profile. `+
   `${downWeek?'Lighter week to consolidate training. ':''}${primaryTaper?'Lower running volume before race. ':''}`+
   `${longDemand&&freshness?'Long run carries substantial workload, so additional hard work is limited. ':''}`+
   `${unsupported?`This week's ${target} mi target allows ${actualMiles} mi within the available days and recent individual-run exposure; ${(target-actualMiles).toFixed(1)} mi remains unallocated. Consider additional running days or a longer build.`:'Planned mileage fits the available schedule.'}`;
  const balance={planningDemand:Math.round(actualMiles*paceSeconds/60),planningBudget:Math.round(target*paceSeconds/60),plannedMinutes:Math.round(actualMiles*paceSeconds/60),reason:longDemand&&freshness?'Long-duration running already provides a major stimulus; protect easy running.':'Predominantly easy running with limited quality sessions.',note:'Planning estimate only, NOT a measured fatigue score.'};
  out.push({phase,sessions,unallocatedMiles:lost,weeklyMileageObjective:target,hardRunsRequested:hardRequested,hardRunsScheduled:finalHard,coachingFocus:speed?`Speed for ${speed.distance} with ${longRace.distance} endurance`:`${longRace.distance} race-specific endurance`,coachingWhy:why,trainingBalance:balance,note:why});
 }
 const peakMiles=half(Math.max(...out.map(w=>sum(w.sessions.map(s=>s.miles)))));
 const peakLong=half(Math.max(...out.flatMap(w=>w.sessions.filter(isLong).map(s=>s.miles)),0));
 if(peakMiles<recommendedLower)warnings.push(`Peak ${peakMiles} mi/week falls below the ${recommendedLower}–${recommendedUpper} mi/week coaching reference for your level and goal. This is NOT automatic race readiness. Consider more preparation time, running days, or goal adjustment.`);
 if(preferredPeak!==null&&peakMiles<preferredPeak-1){
  const cause=theoreticalReachable<preferredPeak-1?
    `the limited ${totalBuildSteps} build opportunities from current mileage`:
    'available running days, individual session exposure and long-run duration guidance';
  warnings.push(`Requested peak ${preferredPeak} mi/week, achieved ${peakMiles} mi/week. Shortfall: ${half(preferredPeak-peakMiles)} mi. Primary limitation: ${cause}. The engine does not force a jump merely to match a number.`);
 }
 notes.push('Peak reference bands, weekly progression, long-run time caps, and hard-run frequency are editable coaching assumptions, not empirically proven individual thresholds.');
 notes.push('High-level evidence favors mostly easy running, race-specific preparation and tapering. Exact mileage differs widely by individual.');
 notes.push('No clinical risk prediction or guaranteed race-readiness score. Strava data are not used until runner history is explicitly integrated.');
 notes.push('Goal time is aspirational. Workouts are anchored to actual measured race/test performance, not an arbitrary wished-for finish time.');
 const profileGoals=goals.map(g=>({id:g.id,distance:g.distance,focus:g.focus,raceDate:g.raceDate,timeGoal:g.timeGoal||'',distanceGoalMiles:g.distanceGoalMiles||null,goalPace:g.goalPace||null}));
 return {profile:{...p,goal:goals[0].distance,focus:goals[0].focus,raceDate:end,weeks,goals:profileGoals},weeks:out,created:new Date().toISOString(),assessment:{issues:warnings,notes,referencePeakRangeMiles:[recommendedLower,recommendedUpper],referenceBands:bands,peakWeeklyMiles:peakMiles,peakLongRunMiles:peakLong,experienceClassification:experience,preferredPeakWeeklyMiles:preferredPeak,establishedMileage:established,projectedShortfallMiles:preferredPeak!==null?Math.max(0,half(preferredPeak-peakMiles)):null,volumePlanning:{requestedPeakMiles:preferredPeak,recommendedObjectiveMiles:half(requestedTarget),estimatedProgressionReachMiles:half(theoreticalReachable),buildOpportunities:totalBuildSteps,planningGrowthPerBuild:Math.round(advanceRate*1000)/10,achievedPeakMiles:peakMiles,limitingFactor:preferredPeak!==null&&peakMiles<preferredPeak-1?(theoreticalReachable<preferredPeak-1?'preparation time and current base':'training days / single-run exposure'):null,universalMileageCap:false},sourceLinks:SOURCES},adjustmentHistory:[],engineVersion:'one-calendar-freshness-6.2-science-7.2'};
}
// Override only the generation policy. Keep existing V6 validation, approval,
// adjustment, account and calendar integration exactly as installed.
previous.build=build;
root.MileZeroScienceV7={version:'7.2',raceRules:RACE_RULES,sourceLinks:SOURCES,experienceLevel,build};
if(typeof module!=='undefined'&&module.exports)module.exports=root.MileZeroScienceV7;
})(typeof window!=='undefined'?window:globalThis);
