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
          <div style={{padding:"16px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--bdr)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <img src={EB_LOGO_URL} alt="Elecbits" style={{height:28,objectFit:"contain"}} onError={e=>{e.target.style.display="none";}}/>
              <span style={{fontSize:14,fontWeight:700,color:"var(--txt)",letterSpacing:"-0.01em"}}>Elecbits PMS</span>
            </div>
            <ThemeToggle isDark={isDark} toggle={toggleTheme}/>
          </div>
          {/* Welcome Header */}
          <div style={{padding:"32px 32px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <h1 style={{fontSize:30,fontWeight:800,color:"var(--txt)",margin:0,letterSpacing:"-0.02em"}}>Welcome back, {currentUser.name?.split(" ")[0] || "PM"}</h1>
              <p style={{fontSize:15,color:"var(--txt2)",marginTop:6,fontWeight:400}}>Here are the projects · {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
            </div>
          </div>

          {/* Stats */}
          <div style={{padding:"24px 32px",display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:18}}>
            {[
              {n:subView==="mine"?myProjects.length:projects.length,label:subView==="mine"?"My Projects":"All Projects",color:"#2563eb"},
              {n:(subView==="mine"?myProjects:projects).filter(p=>p.rag==="green").length,label:"On Track",color:"#16a34a"},
              {n:(subView==="mine"?myProjects:projects).filter(p=>p.rag!=="green").length,label:"At Risk",color:"#d97706"}
            ].map((s,i)=>(
              <div key={i} style={{position:"relative",background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:14,padding:"22px 22px 22px 26px",boxShadow:"0 1px 2px rgba(15,23,42,0.04),0 1px 3px rgba(15,23,42,0.03)",overflow:"hidden",transition:"transform .15s ease, box-shadow .15s ease",cursor:"default"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 4px 12px rgba(15,23,42,0.07),0 2px 4px rgba(15,23,42,0.04)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 1px 2px rgba(15,23,42,0.04),0 1px 3px rgba(15,23,42,0.03)";}}
              >
                <div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:s.color}}/>
                <div style={{fontSize:48,fontWeight:800,color:s.color,lineHeight:1,letterSpacing:"-0.02em"}}>{s.n}</div>
                <div style={{fontSize:14,color:"var(--txt2)",marginTop:10,fontWeight:500}}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{padding:"0 32px"}}>
            {/* Sub-tabs (segmented control) */}
            <div style={{display:"inline-flex",padding:4,background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:10,marginBottom:18}}>
              {[{id:"mine",label:"My Projects"},{id:"all",label:"All Projects"}].map(t=>(
                <button key={t.id} onClick={()=>setSubView(t.id)} style={{
                  padding:"8px 20px",background:subView===t.id?"var(--card)":"transparent",color:subView===t.id?"var(--txt)":"var(--txt2)",
                  border:"none",borderRadius:7,fontSize:13,fontWeight:600,cursor:"pointer",transition:"all .15s",
                  boxShadow:subView===t.id?"0 1px 2px rgba(15,23,42,0.06),0 1px 3px rgba(15,23,42,0.04)":"none"
                }}>{t.label}</button>
              ))}
            </div>

            {subView==="all"&&<div style={{padding:"10px 14px",background:"var(--s2)",borderRadius:8,fontSize:12,color:"var(--txt2)",marginBottom:12}}>
              You can view all projects. You can only <strong>edit</strong> projects where you are assigned as PM.
            </div>}

            {/* Project Table */}
            <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 2px rgba(15,23,42,0.04),0 1px 3px rgba(15,23,42,0.03)",marginBottom:24}}>
              <div style={{display:"grid",gridTemplateColumns:"2.5fr 1fr 0.8fr 0.8fr 1fr 120px",gap:8,padding:"16px 20px",fontSize:12,color:"var(--txt2)",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",borderBottom:"1px solid var(--bdr)",background:"var(--s2)"}}><span>Project</span><span>Tag</span><span>Start</span><span>End</span><span>PM</span><span>Status</span></div>
              {(subView==="mine"?myProjects:projects).map((p,idx,arr)=>{const dl=daysLeft(p.endDate);const pm=getPM(p,users);const isMyProj=myProjects.some(mp=>mp.id===p.id);const isLast=idx===arr.length-1;const dotColor=p.rag==="green"?"#16a34a":p.rag==="red"?"#ef4444":"#d97706";return(
                <div key={p.id} onClick={()=>openProject(p)} style={{display:"grid",gridTemplateColumns:"2.5fr 1fr 0.8fr 0.8fr 1fr 120px",gap:8,padding:"18px 20px",borderBottom:isLast?"none":"1px solid var(--bdr)",cursor:"pointer",alignItems:"center",transition:"background .12s",opacity:isMyProj?1:0.75,background:"var(--card)"}}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"}
                  onMouseLeave={e=>e.currentTarget.style.background="var(--card)"}
                >
                  <div>
                    <div style={{fontWeight:600,fontSize:14,color:"var(--txt)",marginBottom:3}}>{p.name}</div>
                    <div style={{fontSize:12,color:"var(--txt3)",fontFamily:"IBM Plex Mono",display:"flex",alignItems:"center",gap:6}}>
                      <span>{p.projectId}</span>
                      {!isMyProj&&<span style={{padding:"1px 7px",background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:4,fontSize:10,fontFamily:"inherit",color:"var(--txt3)",textTransform:"uppercase",letterSpacing:"0.04em",fontWeight:500}}>view only</span>}
                    </div>
                  </div>
                  {p.projectTag?<span className="status-pill" style={{
                    background:p.projectTag==="engineering"?"#eff6ff":p.projectTag==="elecbits_product"?"#f0fdf4":"#f5f3ff",
                    color:p.projectTag==="engineering"?"#2563eb":p.projectTag==="elecbits_product"?"#16a34a":"#7c3aed",fontSize:12
                  }}>{tagLabel(p.projectTag)}</span>:<span/>}
                  <span style={{fontSize:13,color:"var(--txt2)"}}>{fmtDate(p.startDate)}</span>
                  <span style={{fontSize:13,color:dl<14?"#d97706":"var(--txt2)"}}>{fmtDate(p.endDate)}</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>{pm&&<><Av uid={pm.id} size={24} users={users}/><span style={{fontSize:13,color:"var(--txt2)"}}>{pm.name}</span></>}</div>
                  <span className="status-pill" style={{
                    background:p.rag==="green"?"#f0fdf4":p.rag==="red"?"#fef2f2":"#fffbeb",
                    color:p.rag==="green"?"#16a34a":p.rag==="red"?"#ef4444":"#d97706",fontSize:12,display:"inline-flex",alignItems:"center",gap:6
                  }}><span style={{width:6,height:6,borderRadius:"50%",background:dotColor,display:"inline-block"}}/>{p.rag==="green"?"On Track":p.rag==="red"?"At Risk":"Warning"}</span>
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
