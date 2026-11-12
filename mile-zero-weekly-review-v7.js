/* MILE Ø / Weekly Review v7.1
   AFTER mile-zero-live-upgrade.js. No Supabase changes or secrets.
   Reviews only the currently active saved plan. Check-ins are stored in the plan,
   using the existing save/cloud-sync path. No RPE input. No future race-day,
   completed, manually edited, or recovery/taper workouts are rewritten.
   Automatic adjustments are OPT-IN via plan builder and always shown with Undo.
   Coaching heuristics, not an injury diagnosis or validation of readiness.
*/
(() => {
 'use strict';
 const E=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const coach=window.MileZeroCoachV6;
 if(!coach||!E('builder')||!window.MileZeroScienceV7) { console.warn('Weekly check-in requires Mile Zero V6, Science V7, and plan builder.');return; }
 const today=()=>new Date().toISOString().slice(0,10);
 const dayDate=(p,w,d)=>{const base=new Date(p.startDate+'T12:00:00Z');base.setUTCDate(base.getUTCDate()+w*7+d);return base.toISOString().slice(0,10);};
 const isRun=s=>Number(s.miles)>0&&!/RACE DAY|Post-race/i.test(s.type||'');
 const isQuality=s=>!!s.structure||/Speed intervals|Threshold|Tempo/i.test(s.type||'');
 const planned=s=>s.status==='planned';
 const half=x=>Math.max(0,Math.round((Number(x)||0)*2)/2);
 const fmt=x=>`${Math.floor(x/60)}:${String(Math.round(x)%60).padStart(2,'0')}`;
 const paceSecs=s=>{const m=/^(\d{1,2}):([0-5]\d)$/.exec(String(s||''));return m?60*+m[1]+ +m[2]:null;};
 const activePlan=()=>typeof data!=='undefined'&&data?.engineVersion?.includes('science-7')?data:null;
 const originalGet=window.getProfile,originalSet=window.setProfile;
 const training=E('mz-training-section');
 const experience=E('mz-fitness-section')?.querySelector('.grid');
 if(experience){
  const years=document.createElement('div');years.className='field';years.innerHTML='<label for="mz-years">Years of consistent running (optional)</label><input id="mz-years" type="number" min="0" max="70" step="0.5" placeholder="e.g. 4"><small class="muted">Used with recent mileage and consistency, never alone.</small>';
  const races=document.createElement('div');races.className='field';races.innerHTML='<label for="mz-race-experience">Longest race successfully completed</label><select id="mz-race-experience"><option value="none">None / not yet</option><option value="5k">5K / 10K</option><option value="half">Half marathon</option><option value="marathon">Marathon</option><option value="ultra">Ultramarathon</option></select>';
  experience.append(years,races);
 }
 if(training){const node=document.createElement('label');node.className='mz-switch';node.style.marginTop='14px';node.innerHTML='<input type="checkbox" id="mz-auto-adapt"><span><strong>Automatic weekly plan adjustments (optional)</strong><br>After you complete a weekly check-in, Mile Zero may make small changes to the NEXT eligible week, explain them, and offer Undo. It never makes a plan harder after pain or missing evidence. Off unless you enable it.</span>';training.append(node);}
 window.getProfile=function(){const p=originalGet();p.yearsRunning=E('mz-years')?.value??'';p.priorRaceExperience=E('mz-race-experience')?.value||'none';p.autoAdjustWeekly=!!E('mz-auto-adapt')?.checked;return p;};
 window.setProfile=function(p){originalSet(p);if(E('mz-years'))E('mz-years').value=p.yearsRunning??'';if(E('mz-race-experience'))E('mz-race-experience').value=p.priorRaceExperience||'none';if(E('mz-auto-adapt'))E('mz-auto-adapt').checked=p.autoAdjustWeekly===true;};
 const previousPostRun=window.showPostRunFeedback;
 const previousRender=window.render;
 let opening=false;
 function eligibleWeeks(plan){
  if(!plan)return [];
  const completed=[];
  plan.weeks.forEach((week,wi)=>{
   const entries=week.sessions.map((s,di)=>({s,di})).filter(({s})=>isRun(s));
   if(!entries.length || !entries.some(({s})=>['done','missed'].includes(s.status)))return;
   const finalDate=dayDate(plan.profile,wi,Math.max(...entries.map(x=>x.di)));
   const weekEnd=dayDate(plan.profile,wi,6);
   const allResolved=entries.every(({s})=>s.status==='done'||s.status==='missed');
   if(!(allResolved&&finalDate<=today())&&weekEnd>today())return;
   // Do not flood established athletes with years of old, unreviewed weeks.
   if((Date.parse(today()+'T12:00:00Z')-Date.parse(weekEnd+'T12:00:00Z'))/86400000>14)return;
   const existing=plan.weeklyReviews?.some(r=>r.weekIndex===wi);
   if(!existing)completed.push(wi);
  });
  return completed;
 }
 function weekStats(plan,wi){
  const wk=plan.weeks[wi],runs=wk.sessions.filter(isRun),completed=runs.filter(s=>s.status==='done');
  const easy=completed.filter(s=>!isQuality(s)&&!/Long run/i.test(s.type||''));
  const maxHr=Number(plan.profile.easyHrMax)||null;
  const easyHr=easy.filter(s=>Number(s.averageHr)>0);
  const elevated=maxHr?easyHr.filter(s=>Number(s.averageHr)>maxHr+5).length:0;
  const matchedPace=easy.filter(s=>s.actualPace&&s.targetPaceRange?.fastSeconds&&s.targetPaceRange?.slowSeconds);
  const tooFast=matchedPace.filter(s=>paceSecs(s.actualPace)<s.targetPaceRange.fastSeconds-20).length;
  const tooSlow=matchedPace.filter(s=>paceSecs(s.actualPace)>s.targetPaceRange.slowSeconds+20).length;
  const completion=runs.length?completed.length/runs.length:0;
  return {runs:runs.length,done:completed.length,missed:runs.filter(s=>s.status==='missed').length,unlogged:runs.filter(s=>s.status==='planned').length,completion,
   actualMiles:half(completed.reduce((a,s)=>a+Number(s.actual||0),0)),
   plannedMiles:half(runs.reduce((a,s)=>a+Number(s.miles||0),0)),
   measuredHrRuns:easyHr.length,elevatedEasyHr:elevated,paceRuns:matchedPace.length,tooFast,tooSlow,
   pain:completed.some(s=>s.pain===true)};
 }
 function propose(plan,wi,answers){
  const current=weekStats(plan,wi),prior=wi>0?weekStats(plan,wi-1):null;
  const hadPain=answers.pain||current.pain;
  if(hadPain)return {type:'hold',reason:'Pain or an injury concern was reported. No progression. Intense training should be paused for individual assessment, not used as proof of readiness.',current};
  const struggling=answers.energy==='drained'||answers.sleep==='poor'||answers.soreness==='persistent'||answers.paces==='too-hard'||
    current.completion<.75||(current.measuredHrRuns>=2&&current.elevatedEasyHr>=2);
  if(struggling)return {type:'reduce',reason:'Recovery, missed sessions, pace difficulty or a repeated calibrated-HR concern suggests a lighter next block.',current};
  const recentReview=plan.weeklyReviews?.find(r=>r.weekIndex===wi-1);
  const priorGood=prior&&prior.done>=3&&prior.completion>=.9&&prior.measuredHrRuns>=2&&prior.elevatedEasyHr===0&&
    !!recentReview?.answers&&recentReview.answers.energy==='good'&&recentReview.answers.paces==='manageable'&&!recentReview.answers.pain;
  const nowGood=current.done>=3&&current.completion>=.9&&current.measuredHrRuns>=2&&current.elevatedEasyHr===0&&
    current.paceRuns>=1&&current.tooSlow===0&&answers.energy==='good'&&answers.sleep==='good'&&answers.paces==='manageable';
  if(priorGood&&nowGood)return {type:'progress',reason:'Two consistent training weeks, completed mileage, recorded pace/HR data and recovery feedback support a small easy-volume increase. Interval paces do not change.',current};
  return {type:'maintain',reason:'Maintain the planned workload. One good week or incomplete HR/pace evidence is not a reason to increase training.',current};
 }
 function nextWeek(plan,wi){
  for(let w=wi+1;w<plan.weeks.length;w++){
   const week=plan.weeks[w];const phase=week.phase||'';
   if(/Recovery|Taper|Race/i.test(phase))continue;
   if(week.sessions.some((s,d)=>isRun(s)&&dayDate(plan.profile,w,d)<=today()))continue;
   if(!week.sessions.some(s=>isRun(s)&&s.status==='planned'&&!s.manual))continue;
   return w;
  }
  return null;
 }
 function adjust(plan,wi,proposal,answers={}){
  if(!['progress','reduce','hold'].includes(proposal.type))return {applied:false,reason:'No change needed.'};
  const next=nextWeek(plan,wi);
  if(next===null)return {applied:false,reason:'No eligible future build week; race/taper/recovery and logged sessions stay protected.'};
  const week=plan.weeks[next],originalWeekNote=week.note,before=[],changes=[];
  const easy=week.sessions.map((s,d)=>({s,d})).filter(({s})=>isRun(s)&&!isQuality(s)&&s.status==='planned'&&!s.manual);
  const quality=week.sessions.map((s,d)=>({s,d})).filter(({s})=>isQuality(s)&&s.status==='planned'&&!s.manual);
  const easyTarget=easy.find(({s})=>s.targetPaceRange)?.s.targetPaceRange||null;
  const easyHr=easy.find(({s})=>s.hrTarget)?.s.hrTarget||null;
  const keep=(s,d)=>{if(!before.some(b=>b.day===d))before.push({day:d,session:JSON.parse(JSON.stringify(s))});};
  if(proposal.type==='progress'){
   const ordinary=easy.filter(({s})=>!(/Long run/i.test(s.type))&&s.miles>=2);
   const total=week.sessions.reduce((a,s)=>a+Number(s.miles||0),0);
   let increment=half(total*.025);
   for(const {s,d} of ordinary){if(increment<.5)break;keep(s,d);s.miles=half(s.miles+.5);increment-=.5;changes.push(`+0.5 easy mile on ${s.day}`);}
  }else{
   // No escalation after pain. Automatically remove planned quality work and flag assessment.
   for(const {s,d} of quality.slice(proposal.type==='hold'?0:1)){
    keep(s,d);s.type=proposal.type==='hold'?'Rest / mobility':'Easy run';
    if(proposal.type==='hold'){s.miles=0;s.pace='';s.details='Intensity paused because pain was reported. Mile Zero cannot clear you for running; seek individualized assessment.';}
    else{s.details='Easy running substituted for a quality workout during a lighter training week.';}
    delete s.structure;delete s.estimatedFastMiles;s.targetPaceRange=easyTarget;s.hrTarget=easyHr;
    if(proposal.type==='reduce')s.pace=easyTarget?fmt((easyTarget.fastSeconds+easyTarget.slowSeconds)/2):'';
    changes.push(`Removed quality session on ${s.day}`);
   }
   if(proposal.type==='reduce')for(const {s,d} of easy){
    if(s.miles<2)continue;
    const newMiles=half(s.miles*.9);
    if(newMiles<s.miles){keep(s,d);s.miles=newMiles;changes.push(`Reduced ${s.day} easy run to ${newMiles} mi`);}
   }
   // Repeated high easy-run HR or an explicitly unmanageable pace merits a more
   // forgiving EASY target, not a faster threshold/interval prescription.
   if(proposal.current.elevatedEasyHr>=2||answers.paces==='too-hard'){
    for(const {s,d} of easy){
     if(!s.targetPaceRange?.fastSeconds||!s.targetPaceRange?.slowSeconds)continue;
     keep(s,d);
     const fast=s.targetPaceRange.fastSeconds+15,slow=s.targetPaceRange.slowSeconds+15;
     s.targetPaceRange={fastSeconds:fast,slowSeconds:slow,label:`${fmt(fast)}–${fmt(slow)}/mi`};
     s.pace=fmt((fast+slow)/2);s.details+=' Weekly review: easier pace target due to repeated HR/pace difficulty.';
     changes.push(`Easier aerobic pace on ${s.day}`);
    }
   }
  }
  if(!changes.length)return {applied:false,reason:'No suitable future session was available for a safe, measurable adjustment.'};
  const action={id:`weekly-${Date.now()}-${wi}`,weekIndex:wi,targetWeek:next,type:proposal.type,at:new Date().toISOString(),changes,before,originalWeekNote};
  plan.adjustmentHistory=Array.isArray(plan.adjustmentHistory)?plan.adjustmentHistory:[];
  plan.adjustmentHistory.push(action);
  week.note=(week.note||'')+' Weekly coaching adjustment: '+changes.join('; ')+'.';
  return {applied:true,action};
 }
 function undo(actionId){
  const plan=activePlan();if(!plan)return false;
  const action=(plan.adjustmentHistory||[]).find(x=>x.id===actionId&&!x.undone);
  if(!action||!Array.isArray(action.before))return false;
  const week=plan.weeks[action.targetWeek];if(!week)return false;
  if(action.before.some(item=>{const s=week.sessions[item.day];return s.status!=='planned'||s.manual;})){alert('A changed session has since been logged or edited. Undo is unavailable; review it manually.');return false;}
  for(const item of action.before)week.sessions[item.day]=item.session;
  if(Object.hasOwn(action,'originalWeekNote'))week.note=action.originalWeekNote;
  action.undone=new Date().toISOString();
  save();render();return true;
 }
 function persistReview(plan,wi,answers){
  if(plan.weeklyReviews?.some(x=>x.weekIndex===wi))return null;
  const proposal=propose(plan,wi,answers);
  const auto=plan.profile.autoAdjustWeekly===true;
  const result=auto?adjust(plan,wi,proposal,answers):{applied:false,reason:'Automatic weekly changes are off.'};
  plan.weeklyReviews=Array.isArray(plan.weeklyReviews)?plan.weeklyReviews:[];
  plan.weeklyReviews.push({weekIndex:wi,at:new Date().toISOString(),answers,decision:proposal.type,reason:proposal.reason,stats:proposal.current,auto,adjustmentId:result.action?.id||null});
  save();
  return {proposal,result,auto};
 }
 function showWeek(wi){
  const plan=activePlan();if(!plan||plan.weeklyReviews?.some(x=>x.weekIndex===wi))return;
  const stats=weekStats(plan,wi);
  modal(`<div class="eyebrow">MILE Ø / WEEKLY RUNNING CHECK-IN</div><h2>How was your training week?</h2>
   <p class="subtle">Week ${wi+1} · ${stats.done}/${stats.runs} scheduled runs completed · ${stats.actualMiles} miles logged of ${stats.plannedMiles} planned. ${stats.unlogged} run(s) unlogged. HR and pace are evaluated only where recorded.</p>
   <form id="mz-week-review"><div class="grid">
    <div class="field"><label for="mz-energy">How are you feeling?</label><select id="mz-energy"><option value="good">Feeling strong / recovered</option><option value="okay" selected>Normal / manageable</option><option value="drained">Run down / depleted</option></select></div>
    <div class="field"><label for="mz-sleep">Sleep and recovery</label><select id="mz-sleep"><option value="good">Sleeping well</option><option value="mixed" selected>Mixed</option><option value="poor">Poor recently</option></select></div>
    <div class="field"><label for="mz-soreness">Soreness</label><select id="mz-soreness"><option value="none">None</option><option value="mild" selected>Mild / expected</option><option value="persistent">Persistent or unusual</option></select></div>
    <div class="field"><label for="mz-paces">How were the prescribed paces?</label><select id="mz-paces"><option value="manageable" selected>Manageable</option><option value="too-hard">Repeatedly too difficult</option><option value="not-measured">Not measured / unsure</option></select></div>
    </div><label style="display:flex;gap:8px;align-items:flex-start;margin:14px 0"><input id="mz-pain" type="checkbox" style="width:20px;height:20px"> Pain, injury concern, or unusual symptoms</label>
    <p class="subtle">This is not an RPE score. Heart rate is interpreted against your individually calibrated range; heat, illness, hills and sensor errors can change HR. Short intervals require split data.</p>
    <p class="subtle"><strong>Automatic changes:</strong> ${plan.profile.autoAdjustWeekly?'ON — a small transparent next-week change may be applied, with Undo.':'OFF — recommendations only. Enable in plan preferences when generating your next plan.'}</p>
    <div class="actions"><button type="submit" class="btn dark">Save weekly review</button><button type="button" id="mz-week-skip" class="btn light">Skip this check-in</button></div>
   </form>`);
  E('mz-week-review').onsubmit=e=>{
   e.preventDefault();const latest=activePlan();if(latest!==plan)return;
   const answers={energy:E('mz-energy').value,sleep:E('mz-sleep').value,soreness:E('mz-soreness').value,paces:E('mz-paces').value,pain:E('mz-pain').checked};
   const outcome=persistReview(plan,wi,answers);if(!outcome){closeModal();return;}
   const {proposal,result}=outcome;const changed=result?.applied;
   modal(`<div class="eyebrow">MILE Ø / WEEKLY COACHING</div><h2>${proposal.type==='progress'?'Progress is building':proposal.type==='reduce'?'A lighter block makes sense':proposal.type==='hold'?'Pain concern: pause progression':'Stay the course'}</h2>
   <p>${esc(proposal.reason)}</p><p class="subtle">${changed?'Adjustment made to a future build week: '+esc(result.action.changes.join('; ')):'No automatic calendar changes. '+esc(result.reason||'')}</p>
   <p class="subtle">Your completed/manual workouts, race days and taper/recovery weeks were preserved. No plan change guarantees safety.</p>
   <div class="actions">${changed?`<button type="button" id="mz-week-undo" class="btn danger">Undo change</button>`:''}<button type="button" id="mz-week-close" class="btn dark">Close</button></div>`);
   E('mz-week-close').onclick=()=>{closeModal();render();};
   if(changed)E('mz-week-undo').onclick=()=>{if(undo(result.action.id)){closeModal();toast('Weekly plan change undone.');}};
  };
  E('mz-week-skip').onclick=()=>{plan.weeklyReviews=Array.isArray(plan.weeklyReviews)?plan.weeklyReviews:[];plan.weeklyReviews.push({weekIndex:wi,at:new Date().toISOString(),skipped:true});save();closeModal();};
 }
 function maybePrompt(){
  if(opening||E('modalRoot')?.querySelector('.modal-backdrop'))return;
  const plan=activePlan();if(!plan||!authUser)return;
  const eligible=eligibleWeeks(plan);
  if(!eligible.length)return;
  opening=true;
  try{showWeek(eligible[0]);}finally{opening=false;}
 }
 window.showPostRunFeedback=function(wi,di){
  const plan=activePlan();
  if(plan&&eligibleWeeks(plan).includes(wi)){showWeek(wi);return;}
  return previousPostRun(wi,di);
 };
 window.render=function(...args){const value=previousRender(...args);queueMicrotask(maybePrompt);return value;};
 const previousCloseModal=window.closeModal;
 if(typeof previousCloseModal==='function')window.closeModal=function(...args){
  // Strava workout matching can finish without calling showPostRunFeedback.
  // Check after its modal closes; don't immediately reopen a dismissed check-in.
  const closingReview=!!E('mz-week-review')||!!E('mz-week-close');
  const result=previousCloseModal(...args);
  if(!closingReview)queueMicrotask(maybePrompt);
  return result;
 };
 window.MileZeroWeekly={version:'7.1',weekStats,eligibleWeeks,propose,adjust,undo,showWeek,openLatest:()=>{const plan=activePlan();if(plan){const wi=eligibleWeeks(plan).at(-1);if(wi!=null)showWeek(wi);}},};
 console.log('Mile Zero Weekly v7.1 loaded. Auto adjustments are opt-in per plan.');
})();
