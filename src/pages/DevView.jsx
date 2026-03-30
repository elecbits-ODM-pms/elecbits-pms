import { useState, useEffect } from "react";
import { daysLeft, fmtDate, getPM, ragColor, tagLabel, tagColor } from "../lib/constants.jsx";
import { updateUserWallpaper } from "../lib/db.js";
import { Btn, Pill, Tag, Stat, Av, Toast, ThemeToggle } from "../components/ui/index.jsx";
import PersonalSettingsModal from "./PersonalSettingsModal.jsx";

const DevView=({projects,currentUser,openProject,users,setUsers,sidebarView,setSidebarView,isDark,toggleTheme})=>{
  const myProjects=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===currentUser.id));
  const [showSettings,setShowSettings]=useState(false);
  const [toast,setToast]=useState(null);
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};
  const saveSettings=async(holidays,wallpaper)=>{
    if(wallpaper)await updateUserWallpaper(currentUser.id,wallpaper);
    setUsers(prev=>prev.map(u=>u.id===currentUser.id?{...u,holidays,wallpaper:wallpaper||u.wallpaper}:u));
  };

  useEffect(()=>{if(sidebarView==="settings"){setShowSettings(true);setSidebarView("projects");}},[ sidebarView]);

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{flex:1,overflow:"auto"}}>
        {/* Welcome Header */}
        <div style={{padding:"28px 32px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <h1 style={{fontSize:26,fontWeight:800,color:"var(--txt)",margin:0,letterSpacing:"-0.02em"}}>Welcome back, {currentUser.name?.split(" ")[0] || "Developer"}</h1>
            <p style={{fontSize:14,color:"var(--txt2)",marginTop:4,fontWeight:400}}>Here's what's happening across your manufacturing projects</p>
          </div>
          <ThemeToggle isDark={isDark} toggle={toggleTheme}/>
        </div>

        {/* Info Banner */}
        <div style={{margin:"16px 32px 0",padding:"12px 16px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,fontSize:12,color:"#92400e"}}>
          You can view and update task status, add links, comments and roadblocks. Use the <strong>Submit for Review</strong> button inside tasks to notify the PM.
        </div>

        {/* Stats */}
        <div style={{padding:"20px 32px",display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:16}}>
          <div className="dash-stat-card">
            <div style={{fontSize:32,fontWeight:800,color:"#0f172a",lineHeight:1}}>{myProjects.length}</div>
            <div style={{fontSize:13,color:"#64748b",marginTop:6,fontWeight:500}}>My Projects</div>
          </div>
          <div className="dash-stat-card">
            <div style={{fontSize:32,fontWeight:800,color:"#16a34a",lineHeight:1}}>{myProjects.filter(p=>p.rag==="green").length}</div>
            <div style={{fontSize:13,color:"#64748b",marginTop:6,fontWeight:500}}>On Track</div>
          </div>
          <div className="dash-stat-card">
            <div style={{fontSize:32,fontWeight:800,color:"#d97706",lineHeight:1}}>{myProjects.filter(p=>p.rag!=="green").length}</div>
            <div style={{fontSize:13,color:"#64748b",marginTop:6,fontWeight:500}}>At Risk</div>
          </div>
        </div>

        {/* Project Table */}
        <div style={{padding:"0 32px 24px"}}>
          <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:12,overflow:"hidden",boxShadow:"var(--shadow)"}}>
            <div style={{display:"grid",gridTemplateColumns:"2.5fr 1fr 0.8fr 0.8fr 1fr 100px",gap:8,padding:"12px 16px",fontSize:11,color:"var(--txt2)",fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",borderBottom:"1px solid var(--bdr)",background:"var(--s2)"}}><span>Project</span><span>Tag</span><span>My Start</span><span>My End</span><span>PM</span><span>Status</span></div>
            {myProjects.map(p=>{const a=p.teamAssignments?.find(x=>x.userId===currentUser.id);const dl=daysLeft(a?.endDate||p.endDate);const pm=getPM(p,users);return(
              <div key={p.id} onClick={()=>openProject(p)} style={{display:"grid",gridTemplateColumns:"2.5fr 1fr 0.8fr 0.8fr 1fr 100px",gap:8,padding:"14px 16px",borderBottom:"1px solid var(--bdr)",cursor:"pointer",alignItems:"center",transition:"all .12s",background:"var(--card)"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"}
                onMouseLeave={e=>e.currentTarget.style.background="var(--card)"}
              >
                <div>
                  <div style={{fontWeight:600,fontSize:13,color:"var(--txt)",marginBottom:2}}>{p.name}</div>
                  <div style={{fontSize:11,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>{a?.role}</div>
                </div>
                {p.projectTag?<span className="status-pill" style={{
                  background:p.projectTag==="engineering"?"#eff6ff":p.projectTag==="elecbits_product"?"#f0fdf4":"#f5f3ff",
                  color:p.projectTag==="engineering"?"#2563eb":p.projectTag==="elecbits_product"?"#16a34a":"#7c3aed",fontSize:11
                }}>{tagLabel(p.projectTag)}</span>:<span/>}
                <span style={{fontSize:12,color:"var(--txt2)"}}>{fmtDate(a?.startDate||p.startDate)}</span>
                <span style={{fontSize:12,color:dl<14?"#d97706":"var(--txt2)"}}>{fmtDate(a?.endDate||p.endDate)}</span>
                <div style={{display:"flex",alignItems:"center",gap:6}}>{pm&&<><Av uid={pm.id} size={22} users={users}/><span style={{fontSize:12,color:"var(--txt2)"}}>{pm.name}</span></>}</div>
                <span className="status-pill" style={{
                  background:p.rag==="green"?"#f0fdf4":p.rag==="red"?"#fef2f2":"#fffbeb",
                  color:p.rag==="green"?"#16a34a":p.rag==="red"?"#ef4444":"#d97706",fontSize:11
                }}>{p.rag==="green"?"On Track":p.rag==="red"?"At Risk":"Warning"}</span>
              </div>
            );})}
          </div>
        </div>
      </div>
      {showSettings&&<PersonalSettingsModal user={currentUser} onClose={()=>setShowSettings(false)} allProjects={projects} onSave={saveSettings} showToast={showToast}/>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

export default DevView;
