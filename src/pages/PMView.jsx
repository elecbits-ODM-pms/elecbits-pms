import { useState, useEffect } from "react";
import { daysLeft, fmtDate, getPM, ragColor, tagLabel, tagColor } from "../lib/constants.jsx";
import { updateUserWallpaper } from "../lib/db.js";
import { Btn, Pill, Tag, Stat, Av, Toast, ThemeToggle } from "../components/ui/index.jsx";
import AlertsView from "./AlertsView.jsx";
import { EB_LOGO_URL } from "../components/Sidebar.jsx";
import PersonalSettingsModal from "./PersonalSettingsModal.jsx";

const PMView=({projects,currentUser,openProject,users,setUsers,sidebarView,setSidebarView,isDark,toggleTheme})=>{
  const myProjects=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===currentUser.id));
  const view = sidebarView || "projects";
  const [subView,setSubView]=useState("mine");
  const [showSettings,setShowSettings]=useState(false);
  const [toast,setToast]=useState(null);
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};
  const saveSettings=async(holidays,wallpaper)=>{
    if(wallpaper)await updateUserWallpaper(currentUser.id,wallpaper);
    setUsers(prev=>prev.map(u=>u.id===currentUser.id?{...u,holidays,wallpaper:wallpaper||u.wallpaper}:u));
  };

  useEffect(()=>{if(view==="settings"){setShowSettings(true);setSidebarView("projects");}},[ view]);

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{flex:1,overflow:"auto"}}>
        {(view==="projects")&&<>
          {/* Top bar with Elecbits logo */}
          <div style={{padding:"16px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #e2e8f0",background:"#ffffff"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <img src={EB_LOGO_URL} alt="Elecbits" style={{height:28,objectFit:"contain"}} onError={e=>{e.target.style.display="none";}}/>
              <span style={{fontSize:14,fontWeight:700,color:"#1e293b",letterSpacing:"-0.01em"}}>Elecbits PMS</span>
            </div>
            <ThemeToggle isDark={isDark} toggle={toggleTheme}/>
          </div>
          {/* Welcome Header */}
          <div style={{padding:"24px 32px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <h1 style={{fontSize:22,fontWeight:700,color:"#1e293b",margin:0,letterSpacing:"-0.02em"}}>Welcome back, {currentUser.name?.split(" ")[0] || "PM"}</h1>
              <p style={{fontSize:14,color:"#64748b",marginTop:4,fontWeight:400}}>Here's what's happening across your manufacturing projects</p>
            </div>
          </div>

          {/* Stats */}
          <div style={{padding:"20px 32px",display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:16}}>
            <div className="dash-stat-card" style={{borderLeft:"3px solid #6366f1"}}>
              <div style={{fontSize:32,fontWeight:800,color:"#6366f1",lineHeight:1}}>{subView==="mine"?myProjects.length:projects.length}</div>
              <div style={{fontSize:13,color:"#64748b",marginTop:6,fontWeight:500}}>{subView==="mine"?"My Projects":"All Projects"}</div>
            </div>
            <div className="dash-stat-card" style={{borderLeft:"3px solid #16a34a"}}>
              <div style={{fontSize:32,fontWeight:800,color:"#16a34a",lineHeight:1}}>{(subView==="mine"?myProjects:projects).filter(p=>p.rag==="green").length}</div>
              <div style={{fontSize:13,color:"#64748b",marginTop:6,fontWeight:500}}>On Track</div>
            </div>
            <div className="dash-stat-card" style={{borderLeft:"3px solid #f59e0b"}}>
              <div style={{fontSize:32,fontWeight:800,color:"#f59e0b",lineHeight:1}}>{(subView==="mine"?myProjects:projects).filter(p=>p.rag!=="green").length}</div>
              <div style={{fontSize:13,color:"#64748b",marginTop:6,fontWeight:500}}>At Risk</div>
            </div>
          </div>

          <div style={{padding:"0 32px"}}>
            {/* Sub-tabs */}
            <div style={{display:"flex",gap:4,marginBottom:16}}>
              {[{id:"mine",label:"My Projects"},{id:"all",label:"All Projects"}].map(t=>(
                <button key={t.id} onClick={()=>setSubView(t.id)} style={{
                  padding:"8px 16px",background:subView===t.id?"#6366f1":"transparent",color:subView===t.id?"#fff":"var(--txt2)",
                  border:subView===t.id?"none":"1px solid var(--bdr)",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"
                }}>{t.label}</button>
              ))}
            </div>

            {subView==="all"&&<div style={{padding:"10px 14px",background:"var(--s2)",borderRadius:8,fontSize:12,color:"var(--txt2)",marginBottom:12}}>
              You can view all projects. You can only <strong>edit</strong> projects where you are assigned as PM.
            </div>}

            {/* Project Table */}
            <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:12,overflow:"hidden",boxShadow:"var(--shadow)",marginBottom:24}}>
              <div style={{display:"grid",gridTemplateColumns:"2.5fr 1fr 0.8fr 0.8fr 1fr 100px",gap:8,padding:"12px 16px",fontSize:11,color:"var(--txt2)",fontWeight:500,letterSpacing:"0.04em",textTransform:"uppercase",borderBottom:"1px solid var(--bdr)",background:"var(--s2)"}}><span>Project</span><span>Tag</span><span>Start</span><span>End</span><span>PM</span><span>Status</span></div>
              {(subView==="mine"?myProjects:projects).map(p=>{const dl=daysLeft(p.endDate);const pm=getPM(p,users);const isMyProj=myProjects.some(mp=>mp.id===p.id);return(
                <div key={p.id} onClick={()=>openProject(p)} style={{display:"grid",gridTemplateColumns:"2.5fr 1fr 0.8fr 0.8fr 1fr 100px",gap:8,padding:"14px 16px",borderBottom:"1px solid var(--bdr)",cursor:"pointer",alignItems:"center",transition:"all .12s",opacity:isMyProj?1:0.7,background:"var(--card)"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#faf5ff"}
                  onMouseLeave={e=>e.currentTarget.style.background="var(--card)"}
                >
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:"var(--txt)",marginBottom:2}}>{p.name}</div>
                    <div style={{fontSize:11,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>{p.projectId}{!isMyProj&&<span style={{marginLeft:5,color:"var(--txt3)"}}>· view only</span>}</div>
                  </div>
                  {p.projectTag?<span className="status-pill" style={{
                    background:p.projectTag==="engineering"?"#ede9fe":p.projectTag==="elecbits_product"?"#dcfce7":"#ede9fe",
                    color:p.projectTag==="engineering"?"#7c3aed":p.projectTag==="elecbits_product"?"#16a34a":"#7c3aed",fontSize:11
                  }}>{tagLabel(p.projectTag)}</span>:<span/>}
                  <span style={{fontSize:12,color:"var(--txt2)"}}>{fmtDate(p.startDate)}</span>
                  <span style={{fontSize:12,color:dl<14?"#d97706":"var(--txt2)"}}>{fmtDate(p.endDate)}</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>{pm&&<><Av uid={pm.id} size={22} users={users}/><span style={{fontSize:12,color:"var(--txt2)"}}>{pm.name}</span></>}</div>
                  <span className="status-pill" style={{
                    background:p.rag==="green"?"#dcfce7":p.rag==="red"?"#fee2e2":"#fef3c7",
                    color:p.rag==="green"?"#16a34a":p.rag==="red"?"#dc2626":"#d97706",fontSize:11
                  }}>{p.rag==="green"?"On Track":p.rag==="red"?"At Risk":"Warning"}</span>
                </div>
              );})}
            </div>
          </div>
        </>}
        {view==="alerts"&&<div style={{padding:28}}><AlertsView projects={myProjects} currentUser={currentUser} users={users}/></div>}
      </div>
      {showSettings&&<PersonalSettingsModal user={currentUser} onClose={()=>setShowSettings(false)} allProjects={projects} onSave={saveSettings} showToast={showToast}/>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

export default PMView;
