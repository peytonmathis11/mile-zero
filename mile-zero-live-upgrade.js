/* Mile Zero / non-destructive coaching upgrade for the existing index.html.
   Requires mile-zero-coach-v6.js to have loaded first.
   Does not replace account, Strava, local storage, or database code.
   Keeps the original plan schema and only changes plan generation for NEWLY GENERATED plans.
*/
(() => {
  'use strict';
  const coach = window.MileZeroCoachV6;
  const builder = document.getElementById('builder');
  if (!coach || !builder) {
    console.error('Mile Zero coaching upgrade: engine or builder unavailable');
    return;
  }
  const E = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const originalGetProfile = window.getProfile;
  const originalSetProfile = window.setProfile;
  const originalRenderPlan = window.renderPlan;
  const originalShowInsights = window.showInsights;
  const originalPostRun = window.showPostRunFeedback;
  const originalCalendarMode = window.renderCalendarModeSelector;
  const isV6 = () => typeof data !== 'undefined' && String(data?.engineVersion || '').startsWith('one-calendar-freshness-6');

  function el(tag, props={}, html='') {
    const node=document.createElement(tag);
    for (const [key,value] of Object.entries(props)) {
      if(key==='className')node.className=value;
      else if(key==='id')node.id=value;
      else node.setAttribute(key,value);
    }
    if(html)node.innerHTML=html;
    return node;
  }
  const css = el('style',{id:'mz-coach-style'});
  css.textContent = `
    #mz-coach-layout{margin-top:20px}
    #mz-coach-layout .mz-section{border:1px solid #d4d6cc;border-radius:16px;padding:19px;margin-bottom:14px;background:#fcfbf7}
    #mz-coach-layout .mz-section h3{margin:0 0 6px;color:#20372b}
    #mz-coach-layout .mz-intro{margin:0 0 16px;color:#606b61;font-size:12px}
    #mz-coach-layout .mz-subtle{font-size:12px;color:#626f64;margin:5px 0 13px}
    #mz-coach-layout .mz-secondary{margin-top:15px;border:1px solid #c3cfc1;border-radius:13px;background:#f0f3e9;padding:14px}
    #mz-coach-layout [hidden]{display:none!important}
    #mz-coach-layout .mz-actions{margin:12px 0}
    #mz-coach-layout details{border:1px solid #dddcd2;border-radius:12px;padding:12px;margin-top:12px}
    #mz-coach-layout summary{cursor:pointer;font-weight:800;font-size:13px}
    #mz-coach-layout .mz-switch{display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:1.5}
    #mz-coach-layout .mz-switch input{width:19px;height:19px;flex:none}
    #mz-coach-layout .mz-section .grid{margin-top:14px}
    .mz-training-balance{margin:15px 0 0;border-left:4px solid #759577;background:#edf2ea;padding:13px 16px;border-radius:0 13px 13px 0}
    .mz-training-balance h3{margin:0 0 5px}
    .mz-training-balance p{font-size:12px;margin:4px 0}
    #builder .mz-banner{background:#eef3e7;padding:12px;border-radius:12px;border:1px solid #d0dfca;color:#294231;font-size:13px}
    @media(max-width:540px){#mz-coach-layout .mz-section{padding:13px}}
    .field:has(#logRpe){display:none!important}
  `;
  document.head.appendChild(css);

  // Build a quieter layout by MOVING original form controls, preserving their ids,
  // event listeners, browser validation and the existing saving logic.
  // Remove the old HTML entry maximum; training volume is assessed relative to history.
  E('mileage')?.removeAttribute('max');
  const originalGrid=builder.querySelector(':scope > .grid');
  const layout=el('div',{id:'mz-coach-layout'});
  const makeSection=(id,title,description)=>{
    const section=el('section',{className:'mz-section',id},`<h3>${title}</h3><p class="mz-intro">${description}</p>`);
    const grid=el('div',{className:'grid'});section.appendChild(grid);layout.appendChild(section);
    return {section,grid};
  };
  const goals=makeSection('mz-goal-section','01 / Your goals','Choose what you want to improve. Every goal changes your actual schedule.');
  const fitness=makeSection('mz-fitness-section','02 / Your current running','Your present fitness matters more than an aspirational target pace.');
  const training=makeSection('mz-training-section','03 / How you like to train','Choose the number of hard runs you prefer. Recovery may reduce that number.');
  const schedule=makeSection('mz-schedule-section','04 / Your schedule','All race goals will use one coordinated training calendar.');
  const advanced=el('details',{id:'mz-advanced'},'<summary>Advanced settings (optional)</summary><p class="mz-subtle">Only enter HR ranges established from reliable individual measurements, not age estimates.</p>');
  const advGrid=el('div',{className:'grid'});advanced.appendChild(advGrid);schedule.section.appendChild(advanced);
  function moveField(id,into){const node=E(id)?.closest('.field');if(node)into.appendChild(node);}
  ['goal','focus','raceDate'].forEach(id=>moveField(id,goals.grid));
  ['mileage','experience','consistency','recentLong','pace'].forEach(id=>moveField(id,fitness.grid));
  ['days','longday','terrain','startDate'].forEach(id=>moveField(id,schedule.grid));
  moveField('weeks',advGrid);
  if(originalGrid?.children.length===0)originalGrid.remove();
  const oldBuilderParagraphs=E('settings')?.querySelectorAll('.panel > p.subtle')||[];
  for(const paragraph of oldBuilderParagraphs){
    if(paragraph.textContent.includes('Version 1.1')) paragraph.textContent='Mile Zero Freshness-First V6 builds one explainable plan for one or two race goals. Training loads are provisional coaching heuristics, not validated safety limits. Export a backup before regenerating an existing plan.';
  }
  const existingActions=builder.querySelector(':scope > .actions');
  builder.insertBefore(layout,existingActions || null);

  // All additional settings are ordinary form controls and are saved inside plan.profile.
  const goalTime=el('div',{className:'field mz-field',id:'mz-primary-time-field'},
    '<label for="mz-primary-time">Finish-time goal (optional)</label><input id="mz-primary-time" placeholder="30:00 or 1:45:00" autocomplete="off"><small class="muted">Goal pace is aspirational; workout pace comes from current fitness.</small>');
  const goalMiles=el('div',{className:'field mz-field',id:'mz-primary-miles-field',hidden:''},
    '<label for="mz-primary-miles">Distance goal in miles (optional)</label><input id="mz-primary-miles" type="number" min="1" step="0.5" placeholder="e.g. 50">');
  goals.grid.append(goalTime,goalMiles);
  const secondToggle=el('button',{id:'mz-second-toggle',className:'btn light sm',type:'button'},'+ Add another race goal');
  const second=el('div',{id:'mz-second',className:'mz-secondary',hidden:''},
    `<div class="section-title" style="margin-top:0"><h3>Second race goal</h3><button type="button" id="mz-remove-second" class="btn light sm">Remove</button></div>
    <div class="grid"><div class="field"><label for="mz-second-distance">Race distance</label><select id="mz-second-distance"></select></div>
    <div class="field"><label for="mz-second-focus">What matters most for this goal?</label><select id="mz-second-focus"><option value="speed">Get faster / improve time</option><option value="endurance">Go farther / build endurance</option><option value="balanced">Both</option></select></div>
    <div class="field"><label for="mz-second-date">Race date</label><input id="mz-second-date" type="date"></div>
    <div class="field" id="mz-second-time-field"><label for="mz-second-time">Finish-time goal (optional)</label><input id="mz-second-time" placeholder="30:00 or 1:45:00"></div>
    <div class="field" id="mz-second-miles-field" hidden><label for="mz-second-miles">Distance goal in miles (optional)</label><input id="mz-second-miles" type="number" min="1" step="0.5"></div></div>`);
  goals.section.append(secondToggle,second);
  E('mz-second-distance').innerHTML = E('goal').innerHTML;
  function setSecond(yes){second.hidden=!yes;secondToggle.hidden=!!yes;refreshWeeks();}
  secondToggle.onclick=()=>{setSecond(true);if(!E('mz-second-date').value)E('mz-second-date').value=E('raceDate').value;};
  E('mz-remove-second').onclick=()=>setSecond(false);

  // Replace former 'Main priority' values, which the old generator never used meaningfully.
  const focus=E('focus');
  focus.innerHTML='<option value="speed">Get faster / improve race time</option><option value="endurance">Go farther / build endurance</option><option value="balanced">Both speed and endurance</option>';
  focus.closest('.field').querySelector('label').textContent='What matters most for this race?';
  E('goal').closest('.field').querySelector('label').textContent='Race distance / event';
  training.grid.innerHTML=`<div class="field"><label for="mz-hard-runs">Hard workouts per week</label><select id="mz-hard-runs">
   <option value="0">0 — Aerobic focus</option><option value="1" selected>1 — One quality session</option><option value="2">2 — Two quality sessions</option>
   </select><small class="muted">A long run can also be demanding. The coach may schedule fewer hard workouts when needed.</small></div>
   <div class="field"><label for="mz-volume">Mileage progression</label><select id="mz-volume">
   <option value="gradual">Gradual</option><option value="steady" selected>Steady</option><option value="progressive">Progressive when prepared</option>
   </select><small class="muted">Changes weekly volume independently from speed-session frequency.</small></div>`;
  training.section.appendChild(el('label',{className:'mz-switch'},
    '<input id="mz-freshness" type="checkbox" checked><span><strong>Freshness-first coaching</strong><br>Protect easy days and reduce hard workouts when the week already contains a demanding long run. Recommended.</span>'));
  fitness.grid.appendChild(el('div',{className:'field'},
    '<label for="mz-recent-5k">Recent 5K result / controlled benchmark</label><input id="mz-recent-5k" placeholder="e.g. 27:30"><small class="muted">Required for numeric 5K/10K speed paces. Do not substitute your goal time.</small>'));
  fitness.grid.appendChild(el('div',{className:'field'},
    '<label for="mz-established-mileage">Established weekly miles (optional)</label><input id="mz-established-mileage" type="number" min="0" step="0.5" placeholder="e.g. 35"><small class="muted">Only if you sustained this level consistently for 6+ weeks recently, before a short recovery period. The plan still starts at your current comfortable mileage.</small>'));
  training.grid.appendChild(el('div',{className:'field'},
    '<label for="mz-preferred-peak">Preferred peak weekly miles (optional)</label><input id="mz-preferred-peak" type="number" min="0" step="0.5" placeholder="e.g. 60"><small class="muted">A planning TARGET, never an arbitrary ceiling. Mile Zero works backward from the race and explains any shortfall. Not a guarantee or a forced jump.</small>'));
  advGrid.appendChild(el('div',{className:'field'},'<label for="mz-easy-hr-min">Calibrated easy HR minimum</label><input id="mz-easy-hr-min" type="number" min="60" max="230" placeholder="optional">'));
  advGrid.appendChild(el('div',{className:'field'},'<label for="mz-easy-hr-max">Calibrated easy HR maximum</label><input id="mz-easy-hr-max" type="number" min="60" max="230" placeholder="optional">'));
  advGrid.appendChild(el('div',{className:'field'},'<label for="mz-threshold-hr-min">Calibrated threshold HR minimum</label><input id="mz-threshold-hr-min" type="number" min="60" max="230" placeholder="optional">'));
  advGrid.appendChild(el('div',{className:'field'},'<label for="mz-threshold-hr-max">Calibrated threshold HR maximum</label><input id="mz-threshold-hr-max" type="number" min="60" max="230" placeholder="optional">'));
  function value(id){return E(id)?.value?.trim() || '';}
  function isTimed(distance){return ['6 Hour','12 Hour','24 Hour'].includes(distance)}
  function toggleGoalFields(){
    const timed=isTimed(value('goal'));
    goalTime.hidden=timed;goalMiles.hidden=!timed;
    const timed2=isTimed(value('mz-second-distance'));
    E('mz-second-time-field').hidden=timed2;E('mz-second-miles-field').hidden=!timed2;
  }
  function refreshWeeks(){
    const start=value('startDate'),first=value('raceDate'),last=!second.hidden&&value('mz-second-date')>first?value('mz-second-date'):first;
    if(typeof raceWeekCount==='function' && start && last) {
      const weeks=raceWeekCount(start,last);
      if(Number.isFinite(weeks)&&weeks>0)E('weeks').value=weeks;
      const help=E('raceDateHelp');
      if(help&& !second.hidden)help.textContent=`One training calendar through ${last} (${weeks} weeks).`;
    }
  }
  for(const id of ['goal','mz-second-distance'])E(id).addEventListener('change',toggleGoalFields);
  for(const id of ['raceDate','mz-second-date','startDate'])E(id).addEventListener('change',refreshWeeks);
  toggleGoalFields();

  window.getProfile=function(){
    const p=originalGetProfile();
    const firstDistance=value('goal');
    const firstDate=value('raceDate');
    const firstFocus=value('focus')||'endurance';
    const first={id:'goal1',distance:firstDistance,focus:firstFocus,raceDate:firstDate,
      timeGoal:isTimed(firstDistance)?'':value('mz-primary-time'),
      distanceGoalMiles:isTimed(firstDistance)?value('mz-primary-miles'):''};
    const goals=[first];
    if(!second.hidden){
      const dist=value('mz-second-distance');
      goals.push({id:'goal2',distance:dist,focus:value('mz-second-focus')||'endurance',raceDate:value('mz-second-date'),
        timeGoal:isTimed(dist)?'':value('mz-second-time'),distanceGoalMiles:isTimed(dist)?value('mz-second-miles'):''});
    }
    p.goals=goals;
    p.focus=firstFocus;
    p.hardRuns=Number(value('mz-hard-runs'));
    p.volumePreference=value('mz-volume')||'steady';
    p.freshnessFirst=E('mz-freshness').checked;
    p.recent5kTime=value('mz-recent-5k');
    p.establishedMileage=value('mz-established-mileage');
    p.preferredPeakMiles=value('mz-preferred-peak');
    p.easyHrMin=value('mz-easy-hr-min');p.easyHrMax=value('mz-easy-hr-max');
    p.thresholdHrMin=value('mz-threshold-hr-min');p.thresholdHrMax=value('mz-threshold-hr-max');
    p.raceDate=goals.map(g=>g.raceDate).sort().at(-1)||firstDate;
    p.weeks=typeof raceWeekCount==='function'?raceWeekCount(p.startDate,p.raceDate):Number(E('weeks').value);
    E('weeks').value=p.weeks||'';
    return p;
  };
  window.setProfile=function(p){
    // Original setProfile continues to control ALL existing fields, and old plans remain editable.
    originalSetProfile(p);
    const currentGoals=Array.isArray(p.goals)&&p.goals.length?p.goals:[{
      distance:p.goal||'5K',focus:p.focus==='speed'?'speed':p.focus==='balanced'?'balanced':'endurance',raceDate:p.raceDate||'',timeGoal:p.timeGoal||'',distanceGoalMiles:p.distanceGoalMiles||''}];
    const primary=currentGoals[0];
    E('goal').value=primary.distance;
    E('focus').value=['speed','endurance','balanced'].includes(primary.focus)?primary.focus:'endurance';
    E('raceDate').value=primary.raceDate||'';
    E('mz-primary-time').value=primary.timeGoal||'';
    E('mz-primary-miles').value=primary.distanceGoalMiles||'';
    E('mz-hard-runs').value=String(p.hardRuns??1);
    E('mz-volume').value=p.volumePreference||'steady';
    E('mz-freshness').checked=p.freshnessFirst!==false;
    E('mz-recent-5k').value=p.recent5kTime||'';
    E('mz-established-mileage').value=p.establishedMileage??'';
    E('mz-preferred-peak').value=p.preferredPeakMiles??'';
    E('mz-easy-hr-min').value=p.easyHrMin||'';E('mz-easy-hr-max').value=p.easyHrMax||'';
    E('mz-threshold-hr-min').value=p.thresholdHrMin||'';E('mz-threshold-hr-max').value=p.thresholdHrMax||'';
    setSecond(currentGoals.length===2);
    if(currentGoals[1]){
      const g=currentGoals[1];
      E('mz-second-distance').value=g.distance;
      E('mz-second-focus').value=g.focus||'endurance';
      E('mz-second-date').value=g.raceDate||'';
      E('mz-second-time').value=g.timeGoal||'';
      E('mz-second-miles').value=g.distanceGoalMiles||'';
    }
    toggleGoalFields();refreshWeeks();
  };

  // Intercept ONLY generation, retaining the original form submit and account save workflow.
  // Prevent an invalid plan being saved before the original submit handler can run.
  builder.addEventListener('submit', e=>{
    const p=window.getProfile();
    const issues=coach.validate(p);
    if(issues.length){
      e.preventDefault();e.stopImmediatePropagation();
      alert('Please review your training details:\n\n'+issues.slice(0,8).join('\n'));
    }
  },true);
  window.generate=function(p){
    const result=coach.build(p);
    if(result.error)throw Error('Could not generate coaching plan: '+result.error);
    for(const week of result.weeks){
      for(const session of week.sessions){
        // Existing edit forms and calendar expect a single mm:ss pace, while full
        // interval/HR targets remain available in details and structured data.
        if(session.targetPaceRange?.fastSeconds && session.targetPaceRange?.slowSeconds){
          const average=(session.targetPaceRange.fastSeconds+session.targetPaceRange.slowSeconds)/2;
          session.pace=coach.formatPace(average);
        }
      }
      week.note=(week.coachingWhy||week.note||'')+(week.trainingBalance?' '+week.trainingBalance.reason:'');
    }
    return result;
  };

  window.renderPlan=function(){
    originalRenderPlan();
    if(!isV6())return;
    const w=data.weeks[selectedWeek];
    if(!w)return;
    const panel=E('planContent');if(!panel)return;
    const item=el('section',{className:'mz-training-balance',id:'mz-training-balance'});
    const budget=w.trainingBalance;
    item.innerHTML=`<h3>${esc(w.coachingFocus||'Your weekly training goal')}</h3>
      <p><strong>Why this week:</strong> ${esc(w.coachingWhy||w.note)}</p>
      <p><strong>Quality workouts:</strong> ${Number(w.hardRunsScheduled||0)} of ${Number(w.hardRunsRequested||0)} requested</p>
      <p><strong>Planned peak:</strong> ${Number(data.assessment?.peakWeeklyMiles||0)} mi/week${data.assessment?.preferredPeakWeeklyMiles!==null&&data.assessment?.preferredPeakWeeklyMiles!==undefined?' · requested '+Number(data.assessment.preferredPeakWeeklyMiles)+' mi/week':''}.</p>
      ${data.assessment?.volumePlanning?`<p><strong>Peak planning:</strong> ${data.assessment.volumePlanning.buildOpportunities} build opportunities; estimated progression reach ${data.assessment.volumePlanning.estimatedProgressionReachMiles} mi/week (heuristic, not a safety threshold).</p>`:''}
      ${data.assessment?.volumePlanning?.limitingFactor?`<p><strong>Why the requested peak was not reached:</strong> ${esc(data.assessment.volumePlanning.limitingFactor)}. Check the plan assessment for details.</p>`:''}
      ${budget?`<p><strong>Training balance:</strong> ${esc(budget.reason)}</p>
        <p class="subtle">Estimated training demand: ${budget.planningDemand} relative planning units; preferred budget ${budget.planningBudget}. These are internal scheduling heuristics, not fatigue or injury scores.</p>`:''}`;
    panel.appendChild(item);
  };

  window.renderCalendarModeSelector=function(){
    if(typeof originalCalendarMode==='function')originalCalendarMode();
    if(isV6()){
      if(E('calendarModeSelector'))E('calendarModeSelector').innerHTML='<div class="note" style="margin-bottom:12px"><strong>One calendar, every goal.</strong> Your speed and endurance races already share the schedule below.</div>';
      if(E('coordinatedCalendarPanel'))E('coordinatedCalendarPanel').style.display='none';
      if(E('integrationContent'))E('integrationContent').style.display='none';
      const summary=E('originalPlanPanel')?.querySelector('summary');if(summary)summary.textContent='Your training calendar';
    } else {
      if(E('coordinatedCalendarPanel'))E('coordinatedCalendarPanel').style.display='';
      if(E('integrationContent'))E('integrationContent').style.display='';
      const summary=E('originalPlanPanel')?.querySelector('summary');if(summary)summary.textContent='Your individual plan calendar';
    }
  };

  // Keep post-run feedback consistent with the new pace+HR coaching philosophy.
  window.showPostRunFeedback=function(wi,di){
    if(!isV6())return originalPostRun(wi,di);
    const session=data?.weeks?.[wi]?.sessions?.[di];if(!session)return;
    const done=session.status==='done';
    const dist=Number(session.actual)||0,planned=Number(session.miles)||0;
    const hr=Number(session.averageHr)||0;
    const notes=[];
    if(!done)notes.push('Missed training does not need to be made up. The next review can reassess upcoming workouts.');
    else{
      notes.push(`Logged ${dist.toFixed(1)} miles against ${planned.toFixed(1)} planned miles.`);
      if(session.actualPace)notes.push('Average pace: '+session.actualPace+'/mi.');
      if(hr)notes.push('Average heart rate: '+Math.round(hr)+' bpm. Interpret relative to your individual calibrated range and comparable sessions.');
      if(session.structure)notes.push('A whole-run average pace does not verify interval splits. Record or import interval splits before changing speed targets.');
      if(session.pain)notes.push('Pain was reported. Do not treat training-plan changes as medical clearance.');
      else notes.push('One workout alone is not enough evidence to increase the training load.');
    }
    modal(`<div class="eyebrow">MILE Ø / POST-RUN REVIEW</div><h2>${done?'Run saved':'Workout updated'}</h2>
      <div class="note">${notes.map(n=>'<p>'+esc(n)+'</p>').join('')}</div>
      <p class="subtle">This review uses running performance and available HR, not RPE. Your plan does not change without approval.</p>
      <div class="actions"><button class="btn dark" onclick="showInsights()">Review future training</button><button class="btn light" onclick="closeModal()">Close</button></div>`);
  };

  // Quality review uses pace, individual calibrated easy HR, completed sessions,
  // consistency and a pain flag. It does NOT use RPE or claim auto-readiness.
  let pendingAdvice=null;
  window.showInsights=function(){
    if(!isV6())return originalShowInsights();
    if(!authUser){navigate('account');return;}
    const now=new Date();now.setHours(12,0,0,0);
    const logs=data.weeks.flatMap((w,wi)=>w.sessions.map((s,di)=>({...s,weekIndex:wi,loggedDate:dateAt(data.profile.startDate,wi,di)})))
      .filter(s=>['done','missed'].includes(s.status)&&s.loggedDate<=now&&now-s.loggedDate<=28*86400000)
      .sort((a,b)=>a.loggedDate-b.loggedDate);
    const weeksOfData=new Set(logs.filter(s=>s.status==='done').map(s=>s.weekIndex)).size;
    const approvals=(data.adjustmentHistory||[]).filter(x=>x.action==='approved'&&x.date).sort((a,b)=>b.date.localeCompare(a.date));
    const daysSinceLastAdjustment=approvals.length?Math.max(0,Math.floor((Date.now()-new Date(approvals[0].date).getTime())/86400000)):999;
    pendingAdvice=coach.advise(data,logs,{weeksOfData,daysSinceLastAdjustment});
    const a=pendingAdvice;
    const button=a.type==='progress'||a.type==='reduce'?`<button type="button" class="btn dark" onclick="MileZeroUpgrade.approve()">Approve proposed change</button>`:'';
    modal(`<div class="eyebrow">MILE Ø / FRESHNESS-FIRST COACH</div><h2>${esc(a.label||'Training review')}</h2>
      <p>${esc(a.reason)}</p><div class="note"><strong>Evidence reviewed</strong><br>${logs.filter(x=>x.status==='done').length} completed runs across ${weeksOfData} logged training week(s); pace, recorded HR where available, missed sessions, and pain flags. Short repeats need interval splits—whole-run pace isn't treated as interval performance. RPE is not used.</div>
      <p class="subtle">All changes are proposals. Your existing completed workouts remain untouched. Missing HR or split data does not prove success or failure.</p>
      <div class="actions">${button}<button type="button" class="btn light" onclick="closeModal()">Keep current plan</button></div>`);
  };
  function approve(){
    if(!isV6() || !pendingAdvice || !['progress','reduce'].includes(pendingAdvice.type))return;
    if(!confirm('Apply this change to the next eligible FUTURE training week? Completed and manually edited runs will be preserved.'))return;
    const today=new Date().toISOString().slice(0,10);
    const outcome=coach.applyApproved(data,pendingAdvice,today);
    if(outcome.error){alert(outcome.error);return;}
    data=outcome.plan;
    const entry=currentEntry();if(entry)entry.plan=data;
    save();closeModal();render();toast('Training adjustment saved. You can review future workouts in Calendar.');
    pendingAdvice=null;
  }
  window.MileZeroUpgrade={approve,version:'6.0'};

  // Default fields for an empty editor, and ensure custom choices survive normal renders.
  const active=(typeof data!=='undefined'&&data?.profile)||baseProfile();
  window.setProfile(active);
  console.log('Mile Zero coaching upgrade v6 active (existing plans unchanged until regenerated).');
})();
