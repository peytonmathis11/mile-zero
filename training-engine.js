/* MILE Ø training engine v2.2 — deterministic, explainable research-informed prototype.
   Not an AI language model, not scientifically/clinically validated, and not medical advice.
   No personal data leaves the browser through this module. */
(function(global){
'use strict';
const roundHalf=x=>Math.max(0,Math.round((Number(x)||0)*2)/2);
const cap=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const sum=a=>a.reduce((v,x)=>v+(Number(x)||0),0);
const date=s=>{const d=new Date(String(s||'')+'T12:00:00');return Number.isFinite(d.getTime())?d:null};
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const addDays=(s,n)=>{const d=date(s);d.setDate(d.getDate()+n);return iso(d)};
const daysBetween=(a,b)=>Math.round((date(b)-date(a))/86400000);
const monday=(d=new Date())=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);x.setDate(x.getDate()-(x.getDay()+6)%7);return iso(x)};
const weekCount=(a,b)=>Math.floor(daysBetween(a,b)/7)+1;
const hard=s=>/tempo|threshold|interval|speed|hill|marathon-specific|race-pace/i.test(s?.type||'');
const long=s=>/long run|back-to-back/i.test(s?.type||'');
const raceDays=(goal)=>['50K','50 Mile','100K','100 Mile','6 Hour','12 Hour','24 Hour'].includes(goal)?7:['Marathon','Half Marathon'].includes(goal)?4:2;
const sourceAt=(e,dt)=>{let n=daysBetween(e.plan.profile.startDate,dt);return n>=0?e.plan.weeks[Math.floor(n/7)]?.sessions[n%7]||null:null};
const untilRace=(e,dt)=>daysBetween(dt,e.plan.profile.raceDate);
const sourceWeekly=(e,dt)=>{let n=daysBetween(e.plan.profile.startDate,dt),w=e.plan.weeks[Math.floor(n/7)];return n>=0&&w?sum(w.sessions.map(s=>s.miles)):0};
const parsePace=v=>{let m=/^(\d{1,2}):([0-5]\d)$/.exec(String(v||''));return m?(+m[1]+ +m[2]/60):null};
function distribute(total,positions,weights){let units=Math.round(roundHalf(total)*2);if(!positions.length)return {};let sw=sum(weights), raw=weights.map(w=>sw>0?units*w/sw:units/weights.length);let pieces=raw.map(Math.floor),left=units-sum(pieces);let rank=raw.map((n,i)=>({i,rem:n-pieces[i]})).sort((a,b)=>b.rem-a.rem);for(let j=0;j<left;j++)pieces[rank[j%rank.length].i]++;return Object.fromEntries(positions.map((pos,i)=>[pos,pieces[i]/2]));}
function analyze(history,profile,now){
 const recent=(history||[]).filter(r=>r.status==='done'&&r.date&&r.date<=now&&daysBetween(r.date,now)>=0&&daysBetween(r.date,now)<=28);
 const weekly=[0,1,2,3].map(i=>recent.filter(r=>{const age=daysBetween(r.date,now);return age>=7*i&&age<7*(i+1)}));
 const miles=weekly.map(w=>sum(w.map(r=>r.miles)));
 const times=weekly.map(w=>sum(w.map(r=>{const p=parsePace(r.pace);return p?p*(Number(r.miles)||0):0})))
 const validWeeks=miles.filter(n=>n>0),avg=validWeeks.length?sum(validWeeks)/validWeeks.length:null;
 const recent7=weekly[0],last14=weekly[0].concat(weekly[1]);
 const highFatigue=last14.filter(x=>x.fatigue==='high').length;
 const pain=last14.some(x=>x.pain);
 const hardRpe=last14.filter(x=>Number(x.rpe)>=8).length;
 const maxHr=Number(profile?.maxHr)||null;
 const elevatedHr=!!maxHr&&last14.some(x=>Number(x.hr)>=maxHr*.9&&Number(x.rpe)>=7);
 const recentWorkload=last14.map(x=>{let pace=parsePace(x.pace);return pace&&Number(x.rpe)?pace*(Number(x.miles)||0)*Number(x.rpe):0});
 const flags=[];
 if(highFatigue>=2)flags.push('Repeated high-fatigue reports in recent runs');
 if(pain)flags.push('Pain/injury concern reported in the last 14 days');
 if(hardRpe>=3)flags.push('Several recent runs reported very high effort');
 if(elevatedHr)flags.push('Some recent runs combined high effort with high heart rate relative to recorded maximum');
 const strain=pain?'pain':highFatigue>=2||hardRpe>=3||elevatedHr?'elevated':'normal';
 return {weeklyMiles:miles,avgWeeklyMiles:avg,recentRunCount:recent.length,highFatigue,pain,hardRpe,elevatedHr,strain,flags,hasHeartRate:!!maxHr,recentSessionRpeLoad:Math.round(sum(recentWorkload)),recentDurationMinutes:Math.round(sum(times))};
}
function build(input){
 const {sources=[],runnerProfile={},history=[],signature='',raceRecoveryCheckin=null}=input||{};
 if(sources.length!==2)return {error:'Select exactly two active race goals to create an integrated schedule.'};
 const start=monday(),sortedRaces=sources.map(s=>date(s.plan.profile.raceDate)).filter(Boolean).sort((a,b)=>a-b);
 if(sortedRaces.length!==2)return {error:'Both race goals need dates.'};
 const finalRace=iso(sortedRaces[1]);if(date(finalRace)<date(start))return {error:'Both races are in the past.'};
 const weeks=weekCount(start,finalRace);if(weeks<1||weeks>52)return {error:'Race dates must fall within the next 52 weeks.'};
 const evidence=analyze(history,runnerProfile,iso(new Date()));
 const firstBase=Math.max(0,...sources.map(e=>Number(e.plan.profile.mileage)||0));
 const base=evidence.avgWeeklyMiles??firstBase;
 const experienced=sources.some(e=>e.plan.profile.experience==='advanced');
 const returning=sources.some(e=>e.plan.profile.consistency==='returning'||e.plan.profile.experience==='new');
 const flags=[...evidence.flags];
 const firstRace=iso(sortedRaces[0]);
 const firstSource=sources.find(e=>e.plan.profile.raceDate===firstRace);
 const checkin=raceRecoveryCheckin && firstSource && raceRecoveryCheckin.sourceId===firstSource.id && raceRecoveryCheckin.raceDate===firstRace ? raceRecoveryCheckin : null;
 const highRecoveryConcern=!!checkin&&(checkin.pain||checkin.ready==='no'||checkin.soreness==='severe');
 const moderateRecoveryConcern=!!checkin&&(highRecoveryConcern||checkin.ready==='unsure'||checkin.fatigue==='high'||checkin.soreness==='moderate'||checkin.sleep==='poor'||Number(checkin.effort)>=9);
 const recoveryDays=checkin?(highRecoveryConcern?14:moderateRecoveryConcern?10:checkin.outcome==='didnotstart'?0:checkin.outcome==='shortened'?Math.max(2,Math.ceil(raceDays(firstSource.plan.profile.goal)/2)):raceDays(firstSource.plan.profile.goal)):0;
 if(checkin){flags.push('Race 1 recovery check-in recorded; transition workload updated.');if(highRecoveryConcern)flags.push('Reported pain, severe soreness, or not ready: avoid assuming clearance to run; seek individualized guidance.');}

 const notes=['Rules-based, research-informed draft. Not an AI model or scientifically validated individualized coaching.',
  'Completed training and effort inform the workload when available; two race goals never cause summed mileage.',
  'The earlier race is a checkpoint: retain compatible long-run and aerobic development for the later race, then transition through recovery.',
  'Age is not used as a mileage penalty; weight is not used to restrict training. Neither predicts an individual safe workload.',
  'Heart-rate context is included only when a measured maximum is supplied, and is checked alongside reported effort.',
  'Progression settings are cautious product heuristics, not established injury-prevention thresholds.'];
 if(evidence.recentRunCount<3)notes.push('Limited recent logged runs: the proposal relies more heavily on self-reported current mileage.');
 if(evidence.pain)notes.push('Recent pain report: proposed reduced training is NOT injury clearance. Seek individualized medical guidance for persistent or worsening symptoms.');
 if(daysBetween(iso(sortedRaces[0]),finalRace)<14)notes.push('The races are less than two weeks apart; recovery and race priorities require individual review.');
 const out=[],races=[], conflicts=[];
 let lastLoad=base, lastBuild=base;
 for(let wi=0;wi<weeks;wi++){
  const wStart=addDays(start,wi*7),dates=Array.from({length:7},(_,d)=>addDays(wStart,d));
  const upcoming=sources.filter(e=>untilRace(e,wStart)>=0).sort((a,b)=>untilRace(a,wStart)-untilRace(b,wStart));
  const focus=upcoming[0]||null;
  const successor=upcoming[1]||null;
  // Train THROUGH the first race toward the later one: don't select the nearest
  // race as the sole weekly objective when both events remain in the future.
  const gap=successor?daysBetween(focus.plan.profile.raceDate, successor.plan.profile.raceDate):null;
  const bridgeWeight=successor?(gap>=42?.55:gap>=21?.4:.25):0;
  const raceWeek=dates.some(d=>sources.some(e=>untilRace(e,d)===0));
  const recoveryWeek=dates.some(d=>sources.some(e=>untilRace(e,d)<0&&-untilRace(e,d)<=(checkin&&e.id===firstSource?.id?recoveryDays:raceDays(e.plan.profile.goal))));
  const daysAfterFirst=daysBetween(firstRace,wStart);
  const earlyTransition=!!checkin&&daysAfterFirst>=0&&daysAfterFirst<=21;
  const sourceTarget=focus?sourceWeekly(focus,wStart):0;
  const altTarget=successor?sourceWeekly(successor,wStart):0;
  // A weighted target is an aspiration only: subsequent caps and actual-run
  // availability remain in force. Never sum the two independent plan targets.
  const blendedTarget=sourceTarget&&altTarget
   ?sourceTarget*(1-bridgeWeight)+altTarget*bridgeWeight
   :(sourceTarget||altTarget||lastBuild);
  // Weekly baseline follows real completed training where available. A recovery week does not reset the next build anchor.
  const maxGain=returning?.03:experienced?.07:.05; // explicit tuneable heuristics, NOT universal safe rates
  const fatigueFactor=evidence.strain==='pain'?.65:evidence.strain==='elevated'?.82:1;
  let target=blendedTarget;
  if(wi===0&&base>0)target=Math.min(target,base*(1+maxGain));
  if(wi>0&&lastBuild>0)target=Math.min(target,lastBuild*(1+maxGain));
  if(evidence.strain!=='normal'&&wi<2)target=Math.min(target,base*fatigueFactor);
  if(raceWeek)target=Math.min(target,sourceTarget||target);
  if(recoveryWeek)target=Math.min(target,lastLoad*(highRecoveryConcern?.30:moderateRecoveryConcern?.45:.65));
  if(earlyTransition && !recoveryWeek){
   const phaseFactor=daysAfterFirst<=14?(highRecoveryConcern?.45:moderateRecoveryConcern?.65:.85):(highRecoveryConcern?.7:moderateRecoveryConcern?.85:1);
   target=Math.min(target,Math.max(0,base*phaseFactor));
  }
  target=roundHalf(target);
  const slots=[],reasons=[];
  for(let di=0;di<7;di++){
   const dt=dates[di],rows=sources.map(entry=>({entry,s:sourceAt(entry,dt),until:untilRace(entry,dt)})).filter(r=>r.s);
   const events=sources.filter(e=>untilRace(e,dt)===0);
   const recovering=sources.filter(e=>untilRace(e,dt)<0&&-untilRace(e,dt)<=(checkin&&e.id===firstSource?.id?recoveryDays:raceDays(e.plan.profile.goal)));
   let selected=null,reason='';
   if(events.length){selected=rows.find(r=>r.entry.id===events[0].id)||null;reason=events.length>1?'Two races on the same day—manual decision required.':'Race-day priority: replace planned training with the event.';races.push({date:dt,goal:events.map(e=>e.plan.profile.goal).join(' + ')});}
   else if(recovering.length){reason='Post-race recovery takes priority over the second plan; individual recovery may take longer.';}
   else{
    const options=rows.filter(r=>r.until>=0);
    if(options.length){
     options.sort((a,b)=>a.until-b.until);
     selected=options[0];
     // Long-run durability for the later goal must not disappear simply
     // because the earlier event has more imminent quality sessions.
     const longer=[...options].reverse().find(r=>long(r.s)&&r.s.miles>0);
     const quality=options.find(r=>hard(r.s)&&r.s.miles>0);
     const second=options[1]||null;
     const nearFirst=options[0].until<=10;
     if(longer && !nearFirst && longer.entry.id===second?.entry.id){
      selected=longer;
      reason='Preserved the later race’s long-run endurance while preparing for the first event; one shared workload.';
     } else if(quality && !nearFirst && evidence.strain==='normal' && di!==5){
      selected=quality;
      reason='Preserved controlled race-specific quality while maintaining the second race’s endurance base.';
     } else if(second?.s?.miles>0 && selected.s.miles===0 && !nearFirst){
      // If the immediate-race plan rests, allow an easy later-goal run where
      // no hard-session/recovery protections would be violated.
      selected=second;
      reason='Kept an aerobic session supporting the later race instead of treating the first race plan as the only schedule.';
     } else {
      reason=nearFirst
       ?'Protected the approaching race while retaining longer-term preparation within the shared weekly budget.'
       :'Balanced both race goals in one coordinated week; no duplicated mileage.';
     }
     if(options.length===2&&options.every(r=>r.s.miles>0))conflicts.push(dt);
     if((selected.s.miles||0)<=0)reason='Retained a rest/recovery day rather than forcing extra training.';
    }else reason='No planned run on this date.';
   }
   const baseSession=selected?.s;
   let session=baseSession?JSON.parse(JSON.stringify(baseSession)):{type:'Rest / mobility',miles:0,pace:'',details:reason};
   Object.assign(session,{id:wi+'-'+di,day:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][di],status:'planned',actual:null,actualPace:'',averageHr:null,rpe:null,fatigue:null,pain:false,notes:'',manual:false,sourcePlanId:selected?.entry.id||null,sourceName:selected?.entry.name||'Recovery',integratedReason:reason,integratedOriginalMiles:Number(session.miles)||0});
   if(events.length){session.type='RACE DAY';session.miles=0;session.pace='';session.details=reason+' Event: '+events.map(e=>e.name).join(' / ');}
   else if(recovering.length){session.type='Rest / mobility';session.miles=0;session.pace='';session.details=reason;}
   else if(earlyTransition&&moderateRecoveryConcern&&hard(session)){
    session.type='Easy run';session.details='Easy effort only while recovering from Race 1; resume quality after symptoms and recovery allow.';
    session.integratedReason+=' Race 1 recovery check-in indicates a conservative return to intensity.';
   }
   else if(wi<2&&evidence.strain!=='normal'&&hard(session)){
    session.type='Easy run';session.details='Temporarily substituted easy effort after recent strain signals; runner should review symptoms.';
    session.integratedReason+=' Recent fatigue/pain/effort history favors reducing intensity.';
   }
   slots.push(session);
  }
  // Avoid intensity stacking and consecutive hard days.
  let hardUsed=0,prevHard=false;
  for(const s of slots){if(s.type==='RACE DAY'){prevHard=true;continue;}
   if(hard(s)){
    if(hardUsed>=1||prevHard){s.type='Easy run';s.details='Easy aerobic effort instead of an additional hard day.';s.integratedReason+=' Avoided stacked or consecutive quality sessions.';}
    else hardUsed++;
   }
   prevHard=hard(s);
  }
  const running=slots.map((s,i)=>s.miles>0&&s.type!=='RACE DAY'?i:-1).filter(i=>i>=0);
  const requested=sum(running.map(i=>slots[i].miles));
  const allowed=Math.min(target,requested); // never inflate to chase a quota
  const assigned=distribute(allowed,running,running.map(i=>slots[i].miles));
  for(const i of running){const s=slots[i],old=s.miles;s.miles=assigned[i]||0;
   if(s.miles<old)s.integratedReason+=' Reduced '+old+' to '+s.miles+' miles within the one-plan mileage budget.';
   if(!s.miles){s.type='Rest / mobility';s.pace='';}
  }
  // Attach auditable, runner-specific rationale after mileage allocation. This is
  // decision provenance, not proof that the proposed workout is optimal.
  const proposedWeeklyMiles=sum(slots.map(s=>s.miles));
  for(let di=0;di<slots.length;di++){
   const sess=slots[di], day=dates[di];
   const original=sources.map(e=>({
    planId:e.id, name:e.name, goal:e.plan.profile.goal,
    daysToRace:untilRace(e,day),
    session:sourceAt(e,day)
   }));
   const available=original.filter(r=>r.session&&r.daysToRace>=0);
   const notesForDay=[];
   const evidenceIds=[];
   const chosen=available.find(r=>r.planId===sess.sourcePlanId);
   const other=available.find(r=>r.planId!==sess.sourcePlanId);
   if(sess.type==='RACE DAY'){
    notesForDay.push('A scheduled race takes the place of an ordinary training session on this date. Race mileage is not added to the training target.');
    evidenceIds.push('taper');
   }else if(sess.miles===0){
    notesForDay.push('No run is proposed today. The engine retains a rest/recovery opportunity instead of stacking sessions from both race plans.');
    evidenceIds.push('intensity');
   }else{
    const stimulus=hard(sess)?'quality / threshold-or-hill stimulus':long(sess)?'long-duration aerobic endurance':'primarily easy aerobic volume';
    notesForDay.push('Training purpose: '+stimulus+'.');
    if(chosen){
     notesForDay.push('Selected source: '+chosen.name+' ('+chosen.session.type+', '+(Number(chosen.session.miles)||0)+' mi; '+chosen.daysToRace+' days before its race).');
     if(other){
      notesForDay.push('Alternative considered: '+other.name+' ('+other.session.type+', '+(Number(other.session.miles)||0)+' mi; '+other.daysToRace+' days before its race). This is not an instruction to run both.');
     }
    }
    if(hard(sess)){
     notesForDay.push('Quality sessions are limited to one per week in this prototype; a session is changed to easy running when it would stack with another hard day.');
    }else{
     notesForDay.push('The proposed effort is easy or controlled to preserve a large share of lower-intensity training.');
    }
    evidenceIds.push('intensity');
   }
   const sourceMiles=original.map(r=>(r.session?Number(r.session.miles)||0:0));
   notesForDay.push('This week: '+proposedWeeklyMiles+' mi proposed; '+(Number(sourceTarget)||0).toFixed(1)+' mi in the nearer race plan and '+(Number(altTarget)||0).toFixed(1)+' mi in the later plan. The plans are not summed.');
   if(evidence.avgWeeklyMiles!==null)notesForDay.push('Recent training: '+evidence.avgWeeklyMiles.toFixed(1)+' mi/week averaged across '+evidence.weeklyMiles.filter(v=>v>0).length+' logged week(s) in the past 28 days; this estimate excludes empty weeks and can overstate the true average when logs are incomplete.');
   else notesForDay.push('No reliable recent weekly mileage from completed logs; the engine used reported comfortable mileage ('+base+' mi/week).');
   if(evidence.strain==='pain')notesForDay.push('Recent pain was reported, so the draft reduces early workload and intensity; this is not a return-to-run clearance.');
   else if(evidence.strain==='elevated')notesForDay.push('Recent high fatigue, RPE or HR/effort flags prompted a conservative initial workload.');
   else if(evidence.recentRunCount<3)notesForDay.push('Few completed workouts are available; recovery and intensity assumptions have low confidence.');
   else notesForDay.push('No heightened fatigue/pain flag was detected from available logs; missing reports are not evidence of full recovery.');
   if(evidence.hasHeartRate)notesForDay.push('HR context: recorded max HR '+runnerProfile.maxHr+' bpm; '+(evidence.elevatedHr?'at least one recent high-HR/high-effort run flagged.':'no combined high-HR/high-effort flag found in the available 14-day logs.')+' HR by itself does not establish training zones or injury risk.');
   else notesForDay.push('HR context: no measured maximum was entered; the engine did not use HR to decide this workout.');
   const nextRace=original.filter(r=>r.daysToRace>=0).sort((a,b)=>a.daysToRace-b.daysToRace)[0];
   if(nextRace&&nextRace.daysToRace<=21){notesForDay.push('Race timing: '+nextRace.name+' is '+nextRace.daysToRace+' day(s) away. Taper and race week deserve review; this prototype does not implement a fully individualized taper.');evidenceIds.push('taper');}
   if(checkin&&day>firstRace&&day<finalRace)notesForDay.push('Race 1 check-in: '+(highRecoveryConcern?'higher recovery concern':moderateRecoveryConcern?'moderate recovery concern':'lower reported recovery concern')+'; changes to subsequent training were proposed for review.');
   const finalVsSelected=chosen?Number(chosen.session.miles)||0:0;
   if(finalVsSelected!==(Number(sess.miles)||0))notesForDay.push('Distance change: '+finalVsSelected+' mi in the chosen source → '+sess.miles+' mi proposed, to fit the shared weekly budget. Review workout structure manually when changing a quality session.');
   notesForDay.push('The exact mileage, progression caps and source-selection weights are product heuristics, not numbers proven safe by the cited studies.');
   sess.decisionRecord={version:1,date:day,originals:original.map(r=>({name:r.name,goal:r.goal,daysToRace:r.daysToRace,type:r.session?.type||'No session',miles:Number(r.session?.miles)||0})),proposed:{type:sess.type,miles:Number(sess.miles)||0},runnerContext:{recentRuns:evidence.recentRunCount,avgWeeklyMiles:evidence.avgWeeklyMiles,weeklyMiles:evidence.weeklyMiles,strain:evidence.strain,measuredMaxHr:runnerProfile.maxHr??null},weeklyBudget:{proposed:proposedWeeklyMiles,nearerSource:sourceTarget,laterSource:altTarget},reasons:notesForDay,evidenceIds:[...new Set(evidenceIds)],confidence:evidence.recentRunCount>=5&&!evidence.pain?'provisional':'limited data'};
  }
 const scheduled=sum(slots.map(s=>s.miles));
  // Progression anchor is not advanced during an intentionally low-volume recovery or taper week.
  if(!raceWeek&&!recoveryWeek&&scheduled>0)lastBuild=Math.max(lastBuild,scheduled);
  lastLoad=scheduled||Math.max(0,lastLoad*.65);
  const pastFirst=daysBetween(iso(sortedRaces[0]),wStart)>0;
  const phase=raceWeek?'Race week':recoveryWeek?'Post-race recovery':pastFirst?'Build toward next race':'Dual-race build';
  out.push({phase,sessions:slots,note:pastFirst
   ?'Following the first race, continue toward the later goal after appropriate recovery—do not restart the training base.'
   :'Training for both races: maintain useful fitness for the later event while preparing for the earlier one.'});
 }
 if(!out.length)return {error:'No future training weeks found.'};
 const proposal={approved:false,signature,sourceIds:sources.map(e=>e.id),sourceNames:sources.map(e=>e.name),createdAt:new Date().toISOString(),conflicts:conflicts.length,races,notes,
  raceRecoverySummary:checkin?{raceDate:firstRace,outcome:checkin.outcome,readiness:checkin.ready,concern:highRecoveryConcern?'high':moderateRecoveryConcern?'moderate':'low',recoveryDays}:null,trainingAnalysis:evidence,trainingFactors:{age:runnerProfile.age??null,weightLb:runnerProfile.weightLb??null,measuredMaxHr:runnerProfile.maxHr??null,experience:sources.map(e=>e.plan.profile.experience),recentHistoryUsed:evidence.recentRunCount},
  plan:{profile:{...JSON.parse(JSON.stringify(sources[0].plan.profile)),goal:'Integrated race goals',startDate:start,raceDate:finalRace,weeks},weeks:out,created:new Date().toISOString(),assessment:{issues:flags,notes},adjustmentHistory:[],engineVersion:'research-informed-engine-2.4'}};
 return proposal;
}
global.MileZeroTrainingEngine={build,analyze};
})(typeof window!=='undefined'?window:globalThis);
