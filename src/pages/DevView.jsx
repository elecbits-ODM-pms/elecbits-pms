import { useState } from "react";
import { daysLeft, fmtDate, getPM, ragColor, tagLabel, tagColor } from "../lib/constants.jsx";
import { updateUserWallpaper } from "../lib/db.js";
import { Btn, Pill, Tag, Stat, Av, Toast } from "../components/ui/index.jsx";
import PersonalSettingsModal from "./PersonalSettingsModal.jsx";

const DevView=({projects,currentUser,openProject,users,setUsers})=>{
  const myProjects=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===currentUser.id));
  const [showSettings,setShowSettings]=useState(false);
  const [toast,setToast]=useState(null);
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};
  const saveSettings=async(holidays,wallpaper)=>{
    if(wallpaper)await updateUserWallpaper(currentUser.id,wallpaper);
    setUsers(prev=>prev.map(u=>u.id===currentUser.id?{...u,holidays,wallpaper:wallpaper||u.wallpaper}:u));
  };
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{background:"var(--s1)",borderBottom:"1px solid var(--bdr)",padding:"0 22px",display:"flex",alignItems:"center",height:42}}>
        <span style={{fontSize:10,fontWeight:700,color:"var(--txt2)",fontFamily:"IBM Plex Mono",letterSpacing:"0.08em",textTransform:"uppercase"}}>My Projects</span>
        <div style={{marginLeft:"auto"}}><Btn v="ghost" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>setShowSettings(true)}>⚙ Settings</Btn></div>
      </div>
      <div style={{flex:1,overflow:"auto",padding:22}}>
        <div style={{padding:"8px 12px",background:"var(--amber)08",border:"1px solid var(--amber)25",borderRadius:7,fontSize:11,color:"var(--txt2)",marginBottom:12}}>
          ⚠ You can view and update task status, add links, comments and roadblocks. TM, PM & Client approvals are managed by the PM / Super Admin only.
          After adding links to a task, use the <strong>Submit for Review</strong> button inside the task to notify the PM.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:14}}><Stat label="My Projects" value={myProjects.length} color="var(--blue)"/><Stat label="On Track" value={myProjects.filter(p=>p.rag==="green").length} color="var(--green)"/><Stat label="At Risk" value={myProjects.filter(p=>p.rag!=="green").length} color="var(--amber)"/></div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 100px",gap:8,padding:"5px 12px",fontSize:10,color:"var(--txt3)",fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",marginBottom:4}}><span>Project</span><span>Tag</span><span>My Start</span><span>My End</span><span>PM</span><span>Status</span></div>
        {myProjects.map(p=>{const a=p.teamAssignments?.find(x=>x.userId===currentUser.id);const dl=daysLeft(a?.endDate||p.endDate);const pm=getPM(p,users);return(<div key={p.id} onClick={()=>openProject(p)} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 100px",gap:8,padding:"11px 12px",background:"var(--s1)",border:"1px solid var(--bdr)",borderRadius:7,marginBottom:4,cursor:"pointer",alignItems:"center",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"} onMouseLeave={e=>e.currentTarget.style.background="var(--s1)"}><div><div style={{fontWeight:700,fontSize:13,color:"var(--txt)",marginBottom:2}}>{p.name}</div><div style={{fontSize:10,color:"var(--txt2)"}}>{a?.role}</div></div>{p.projectTag?<Tag label={tagLabel(p.projectTag)} color={tagColor(p.projectTag)}/>:<span/>}<span style={{fontSize:11,color:"var(--txt2)"}}>{fmtDate(a?.startDate||p.startDate)}</span><span style={{fontSize:11,color:dl<14?"var(--amber)":"var(--txt2)"}}>{fmtDate(a?.endDate||p.endDate)}</span><div style={{display:"flex",alignItems:"center",gap:5}}>{pm&&<><Av uid={pm.id} size={20} users={users}/><span style={{fontSize:11,color:"var(--txt2)"}}>{pm.name}</span></>}</div><Pill label={p.rag||"amber"} color={ragColor(p.rag||"amber")} small/></div>);})}
      </div>
      {showSettings&&<PersonalSettingsModal user={currentUser} onClose={()=>setShowSettings(false)} allProjects={projects} onSave={saveSettings} showToast={showToast}/>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

export default DevView;
