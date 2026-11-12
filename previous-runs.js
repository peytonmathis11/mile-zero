// Mile Zero Previous Runs - add as <script src="./previous-runs.js" defer></script> before </body>.
// Uses existing global `supa`, `authUser`, `loadRecentStravaRuns` from the app.
(() => {
  "use strict";
  let modal, list, status, moreButton, selectedLabel, importButton;
  let selected = new Map(), before = null, current = [], busy = false;
  const $ = (id) => document.getElementById(id);
  const signedIn = () => typeof authUser !== "undefined" && authUser && typeof supa !== "undefined" && supa;
  const formatPace = secs => Number(secs) > 0 ? `${Math.floor(Math.round(secs)/60)}:${String(Math.round(secs)%60).padStart(2,"0")}/mi` : "Pace unavailable";
  const formatDistance = n => Number.isFinite(Number(n)) && n != null ? `${Number(n).toFixed(2)} mi` : "—";
  const formatDate = s => s && !Number.isNaN(Date.parse(s)) ? new Date(s).toLocaleDateString() : "Unknown date";
  const make = (tag, cls, text) => { const el = document.createElement(tag); if(cls)el.className=cls; if(text!=null)el.textContent=String(text); return el; };
  async function invoke(payload) {
    if (!signedIn()) throw new Error("Sign in to Mile Zero first.");
    const { data, error } = await supa.functions.invoke("strava-history", { body: payload });
    if (error) {
      let message = error.message || "Could not contact Strava";
      try { const response = error.context; if(response?.json) { const result = await response.json(); message = result.error || message; } } catch {}
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }
  const setStatus = text => { if (status) status.textContent=text; };
  function button(text, click, cls="btn light sm") { const b=make("button",cls,text);b.type="button";b.addEventListener("click",click);return b; }
  function updateSelection() {
    selectedLabel.textContent=`${selected.size} selected`;
    importButton.disabled = busy || !selected.size;
  }
  function renderRuns() {
    list.replaceChildren();
    if (!current.length) list.append(make("p","subtle","No running activities on this page. You can load older activities."));
    current.forEach(run => {
      const row = make("label","session"); row.style.cssText="display:flex;gap:10px;align-items:center;margin-top:8px;cursor:pointer";
      const box = make("input"); box.type="checkbox"; box.disabled=!!run.imported || busy; box.checked=selected.has(run.id); box.style.width="18px";
      box.addEventListener("change",() => { if(box.checked)selected.set(run.id,run);else selected.delete(run.id);updateSelection(); });
      const info=make("div");info.style.flex="1";
      info.append(make("div","name",run.name),make("div","sub",`${formatDate(run.date)} · ${formatDistance(run.distanceMiles)} · ${formatPace(run.paceSecondsPerMile)} · ${run.avgHr==null?"No HR":Math.round(run.avgHr)+" bpm"}${run.elevationFeet==null?"":" · "+run.elevationFeet+" ft gain"}`));
      row.append(box,info);
      if(run.imported)row.append(make("span","pill","Imported"));
      list.append(row);
    });
    updateSelection();
  }
  async function browse(reset=false) {
    if(busy)return;
    busy=true;updateSelection();setStatus("Loading runs from Strava…");
    try {
      if(reset) before=null;
      const data=await invoke({action:"list",...(before?{before}:{})});
      current=(data.runs || []).filter(run => !run.imported);
      before=data.nextBefore || null;
      moreButton.disabled=!data.hasMore;
      renderRuns();setStatus(`${current.length} runs shown on this page. ${selected.size} selected across pages.`);
    } catch(e){setStatus(e.message);} finally {busy=false;renderRuns();}
  }
  async function importSelected() {
    if(busy || !selected.size)return;
    busy=true;updateSelection();const ids=[...selected.keys()];
    let completed=0,failed=0,already=0;
    try {
      for(let i=0;i<ids.length;i+=10){
        const slice=ids.slice(i,i+10);
        setStatus(`Importing ${i+1}–${Math.min(i+10,ids.length)} of ${ids.length} selected runs…`);
        const data=await invoke({action:"import",activityIds:slice});
        for(const result of data.results || []) {
          if(result.status==="imported"){completed++;selected.delete(result.id);}
          else if(result.status==="already_imported"){already++;selected.delete(result.id);}
          else failed++;
        }
      }
      setStatus(`${completed} imported, ${already} already present, ${failed} unsuccessful. No workouts were automatically marked complete.`);
      if(typeof loadRecentStravaRuns==="function")await loadRecentStravaRuns();
      current=current.filter(r=>!ids.includes(r.id) || selected.has(r.id));
    } catch(e){setStatus(`Import interrupted: ${e.message}. Successfully imported runs remain saved.`);}
    finally{busy=false;renderRuns();}
  }
  async function showStored() {
    if (!signedIn()) return setStatus("Sign in first.");
    setStatus("Loading saved activities…");
    try {
      const {data,error}=await supa.rpc("strava_previous_runs",{p_limit:100,p_offset:0});
      if(error)throw error;
      current=(data||[]).map(r=>({ id:String(r.activity_id),name:r.activity_name,date:r.activity_date,
        distanceMiles:r.distance_miles,paceSecondsPerMile:r.average_pace_seconds_per_mile,
        avgHr:r.average_heart_rate,elevationFeet:r.elevation_gain_feet,imported:true }));
      moreButton.disabled=true;renderRuns();setStatus(`Displaying ${current.length} most recent saved runs. Historical imports are stored even when older than the dashboard's newest 30.`);
    }catch(e){setStatus(e.message||"Unable to load saved runs");}
  }
  function open() {
    if(!signedIn())return alert("Please sign in before importing runs.");
    if(!modal) {
      modal=make("div","modal-backdrop");modal.id="previousRunsModal";modal.style.zIndex="30";
      const panel=make("div","modal");panel.style.cssText="width:min(96vw,720px);max-height:90vh;overflow-y:auto";
      const header=make("div","section-title");header.append(make("h2",null,"Previous Runs"),button("Close",()=>modal.remove()));
      panel.append(header,make("p","subtle","Browse Strava and choose exactly which old runs to import. Garmin and other providers can be added later."));
      const actions=make("div","actions");actions.append(button("Browse Strava",()=>browse(true),"btn dark sm"),button("View imported",showStored));
      panel.append(actions);list=make("div","list");list.style.marginTop="12px";panel.append(list);
      const footer=make("div","actions");moreButton=button("Load older runs",()=>browse(false));
      selectedLabel=make("span","subtle","0 selected");importButton=button("Import selected",importSelected,"btn dark sm");
      footer.append(moreButton,selectedLabel,importButton);panel.append(footer);
      status=make("p","subtle");status.setAttribute("role","status");panel.append(status);modal.append(panel);
      modal.addEventListener("click",e=>{if(e.target===modal)modal.remove();});
    }
    document.body.append(modal);selected.clear();before=null;current=[];browse(true);
  }
  function mount() {
    const target=$("recentStravaRuns");if(!target || $("previousRunsOpen"))return;
    const actions=make("div","actions");const btn=button("Previous Runs · Import History",open,"btn dark sm");btn.id="previousRunsOpen";actions.append(btn);
target.insertBefore(actions, $("stravaRunsList"));

  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount);else mount();
})();
