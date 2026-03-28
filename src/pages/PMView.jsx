import { useState } from "react";
import { daysLeft, fmtDate, getPM, ragColor, tagLabel, tagColor } from "../lib/constants.jsx";
import { updateUserWallpaper } from "../lib/db.js";
import { Btn, Pill, Tag, Stat, Av, Toast } from "../components/ui/index.jsx";
import AlertsView from "./AlertsView.jsx";
import PersonalSettingsModal from "./PersonalSettingsModal.jsx";

const PMView=({projects,currentUser,openProject,users,setUsers})=>{
  const myProjects=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===currentUser.id));
  const [view,setView]=useState("mine");
  const [showSettings,setShowSettings]=useState(false);
  const [toast,setToast]=useState(null);
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};
  const saveSettings=async(holidays,wallpaper)=>{
    if(wallpaper)await updateUserWallpaper(currentUser.id,wallpaper);
    setUsers(prev=>prev.map(u=>u.id===currentUser.id?{...u,holidays,wallpaper:wallpaper||u.wallpaper}:u));
  };
  const NB=({id,label})=><button onClick={()=>setView(id)} style={{padding:"7px 12px",background:"none",border:"none",cursor:"pointer",fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",color:view===id?"var(--acc)":"var(--txt2)",borderBottom:`2px solid ${view===id?"var(--acc)":"transparent"}`,transition:"all .15s"}}>{label}</button>;
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{borderBottom:"1px solid var(--bdr)",display:"flex",gap:0,padding:"0 22px",background:"var(--s1)",alignItems:"center"}}>
        <NB id="mine" label="My Projects"/><NB id="all" label="All Projects"/><NB id="alerts" label="Alerts"/>
        <div style={{marginLeft:"auto"}}><Btn v="ghost" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>setShowSettings(true)}>⚙ Settings</Btn></div>
      </div>
      <div style={{flex:1,overflow:"auto",padding:22}}>
        {(view==="mine"||view==="all")&&(()=>{
          const displayProjects=view==="mine"?myProjects:projects;
          return(<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:14}}>
              <Stat label={view==="mine"?"My Projects":"All Projects"} value={displayProjects.length} color="var(--blue)"/>
              <Stat label="On Track" value={displayProjects.filter(p=>p.rag==="green").length} color="var(--green)"/>
              <Stat label="At Risk" value={displayProjects.filter(p=>p.rag!=="green").length} color="var(--amber)"/>
            </div>
            {view==="all"&&<div style={{padding:"8px 12px",background:"var(--s2)",borderRadius:7,fontSize:11,color:"var(--txt2)",marginBottom:10}}>
              You can view all projects. You can only <strong>edit</strong> projects where you are assigned as PM.
            </div>}
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 100px",gap:8,padding:"5px 12px",fontSize:10,color:"var(--txt3)",fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",marginBottom:4}}><span>Project</span><span>Tag</span><span>Start</span><span>End</span><span>PM</span><span>Status</span></div>
            {displayProjects.map(p=>{const dl=daysLeft(p.endDate);const pm=getPM(p,users);const isMyProj=myProjects.some(mp=>mp.id===p.id);return(<div key={p.id} onClick={()=>openProject(p)} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 100px",gap:8,padding:"11px 12px",background:"var(--s1)",border:`1px solid ${isMyProj?"var(--bdr)":"var(--bdr)"}`,borderRadius:7,marginBottom:4,cursor:"pointer",alignItems:"center",transition:"all .15s",opacity:isMyProj?1:0.75}} onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"} onMouseLeave={e=>e.currentTarget.style.background="var(--s1)"}><div><div style={{fontWeight:700,fontSize:13,color:"var(--txt)",marginBottom:2}}>{p.name}</div><div style={{fontSize:10,color:"var(--txt2)"}}>{p.projectId}{!isMyProj&&<span style={{marginLeft:5,color:"var(--txt3)"}}>· view only</span>}</div></div>{p.projectTag?<Tag label={tagLabel(p.projectTag)} color={tagColor(p.projectTag)}/>:<span/>}<span style={{fontSize:11,color:"var(--txt2)"}}>{fmtDate(p.startDate)}</span><span style={{fontSize:11,color:dl<14?"var(--amber)":"var(--txt2)"}}>{fmtDate(p.endDate)}</span><div style={{display:"flex",alignItems:"center",gap:5}}>{pm&&<><Av uid={pm.id} size={20} users={users}/><span style={{fontSize:11,color:"var(--txt2)"}}>{pm.name}</span></>}</div><Pill label={p.rag||"amber"} color={ragColor(p.rag||"amber")} small/></div>);})}
          </>);
        })()}
        {view==="alerts"&&<AlertsView projects={myProjects} currentUser={currentUser} users={users}/>}
      </div>
      {showSettings&&<PersonalSettingsModal user={currentUser} onClose={()=>setShowSettings(false)} allProjects={projects} onSave={saveSettings} showToast={showToast}/>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

export default PMView;
