import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase.js";
import { applyTheme, G, WALL_STYLES } from "./lib/constants.jsx";
import { fetchProjectsFromDB, fetchUsersFromDB, getProjectUpdatedAt, updateProjectInDB, replaceTeamAssignments } from "./lib/db.js";
import Header from "./components/Header.jsx";
import Login from "./pages/Login.jsx";
import SuperAdminView from "./pages/SuperAdminView.jsx";
import PMView from "./pages/PMView.jsx";
import DevView from "./pages/DevView.jsx";
import ProjectPage from "./pages/project/ProjectPage.jsx";

const shapeProfile=(p)=>({...p,resourceRole:p.resource_role,loginType:p.login_type,maxProjects:p.max_projects,projectTags:p.project_tags||[],skills:p.skills||[],holidays:p.holidays||[]});

export default function App(){
  const [isDark,setIsDark]=useState(true);
  const [user,setUser]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [projects,setProjectsState]=useState([]);
  const [projectsLoading,setProjectsLoading]=useState(false);
  const [users,setUsersState]=useState([]);
  const [openedProject,setOpenedProject]=useState(null);
  const [prefillProject,setPrefillProject]=useState(null);

  const toggleTheme=()=>{const next=!isDark;setIsDark(next);applyTheme(next);};

  // ── Session restore ──
  useEffect(()=>{
    applyTheme(true);
    let done=false;
    const finish=(u)=>{if(done)return;done=true;if(u)setUser(u);setAuthLoading(false);};

    // Hard timeout — never stuck on loading
    const tid=setTimeout(()=>{console.warn("[auth] timeout");finish(null);},3000);

    supabase.auth.getSession().then(async({data:{session}})=>{
      clearTimeout(tid);
      if(!session?.user){finish(null);return;}
      try{
        const{data:profile}=await supabase.from("users").select("*,holidays!holidays_user_id_fkey(*)").eq("id",session.user.id).maybeSingle();
        finish(profile?shapeProfile(profile):null);
      }catch(e){
        console.error("[auth] profile error",e);
        finish(null);
      }
    }).catch(e=>{
      console.error("[auth] getSession error",e);
      clearTimeout(tid);
      finish(null);
    });

    return()=>clearTimeout(tid);
  },[]);

  // ── Data fetching ──
  const fetchProjects=useCallback(async()=>{
    setProjectsLoading(true);
    try{
      const{data,error}=await fetchProjectsFromDB();
      if(!error&&data){
        setProjectsState(data.map(p=>({
          ...p,projectId:p.project_id,projectTag:p.project_tag,clientName:p.client_name,clientId:p.client_id,
          productIds:p.product_ids||[],startDate:p.start_date,endDate:p.end_date,pendingSanction:p.pending_sanction,
          rejectedReason:p.rejected_reason,rejectedAt:p.rejected_at,checklistConfig:p.checklist_config||{},
          teamAssignments:(p.team_assignments||[]).map(ta=>({...ta,userId:ta.user_id,startDate:ta.start_date,endDate:ta.end_date})),
          checklists:p.checklist_data||{},customChecklists:p.custom_checklist_data||{},communications:[],notifications:[],
        })));
      }
    }catch(e){console.error("[fetch] projects error",e);}
    setProjectsLoading(false);
  },[]);

  const fetchUsers=useCallback(async()=>{
    try{
      const{data}=await fetchUsersFromDB();
      if(data){
        setUsersState(data.map(u=>shapeProfile(u)));
      }
    }catch(e){console.error("[fetch] users error",e);}
  },[]);

  useEffect(()=>{
    if(user){fetchProjects();fetchUsers();}
    else{setProjectsState([]);setUsersState([]);}
  },[user]);

  // ── Login handler (called from Login page) ──
  const handleLogin=useCallback(async(profile)=>{
    const shaped=shapeProfile(profile);
    setUser(shaped);
  },[]);

  // ── Update project ──
  const updateProject=async(updated)=>{
    const{error}=await updateProjectInDB(updated.id,{
      name:updated.name,rag:updated.rag,sanctioned:updated.sanctioned,
      pending_sanction:updated.pendingSanction||updated.pending_sanction||false,
      rejected:updated.rejected||false,rejected_reason:updated.rejectedReason||null,rejected_at:updated.rejectedAt||null,
      checklist_config:updated.checklistConfig||{},start_date:updated.startDate||null,end_date:updated.endDate||null,
      client_name:updated.clientName||null,client_id:updated.clientId||null,product_ids:updated.productIds||[],description:updated.description||null,
      checklist_data:updated.checklists||{},custom_checklist_data:updated.customChecklists||{},
    });
    if(error){console.error("updateProject error:",error.message);return;}
    // Persist team assignments to team_assignments table
    if(updated.teamAssignments){
      const teamRows=(updated.teamAssignments||[]).filter(a=>a.userId||a.user_id).map(a=>({
        project_id:updated.id,
        user_id:a.userId||a.user_id,
        role:a.role,
        start_date:a.startDate||a.start_date||null,
        end_date:a.endDate||a.end_date||null,
      }));
      const{error:te}=await replaceTeamAssignments(updated.id,teamRows);
      if(te)console.error("Team assignment update error:",te.message);
    }
    const stamped={...updated,updatedAt:new Date().toISOString()};
    setProjectsState(ps=>ps.map(p=>p.id===stamped.id?stamped:p));
    setOpenedProject(stamped);
  };

  const setProjects=(updaterOrArray)=>{
    if(typeof updaterOrArray==="function"){
      setProjectsState(prev=>{
        const next=updaterOrArray(prev);
        // Find deleted IDs and delete from DB
        const nextIds=new Set(next.map(p=>p.id));
        prev.forEach(p=>{
          if(!nextIds.has(p.id)){
            supabase.from("projects").delete().eq("id",p.id).then(({error})=>{
              if(error)console.error("Delete project error:",error.message);
              else fetchProjects(); // refresh after successful delete
            });
          }
        });
        return next;
      });
    } else {
      setProjectsState(updaterOrArray);
    }
  };

  const setUsers=async(updaterOrArray)=>{
    if(typeof updaterOrArray==="function"){setUsersState(prev=>updaterOrArray(prev));}
    else{setUsersState(updaterOrArray);}
    setTimeout(()=>fetchUsers(),300);
  };

  const currentProject=openedProject?projects.find(p=>p.id===openedProject.id)||openedProject:null;
  const wallStyle=user?WALL_STYLES[users.find(u=>u.id===user?.id)?.wallpaper||"none"]||{}:{};

  if(authLoading)return(
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0c0e13"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:32,height:32,background:"#4f8ef7",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><span style={{fontSize:16,fontFamily:"IBM Plex Mono",fontWeight:700,color:"#fff"}}>E</span></div>
        <div style={{fontSize:11,color:"#5a6478",fontFamily:"IBM Plex Mono",letterSpacing:"0.1em",marginBottom:8}}>LOADING...</div>
        <div style={{width:120,height:2,background:"#1a2030",borderRadius:1,margin:"0 auto",overflow:"hidden"}}><div style={{height:"100%",background:"#4f8ef7",borderRadius:1,animation:"loadbar 1.5s ease-in-out infinite",width:"40%"}}/></div>
      </div>
    </div>
  );

  return(
    <>
      <G isDark={isDark}/>
      {!user?(
        <Login onLogin={handleLogin} isDark={isDark} toggleTheme={toggleTheme}/>
      ):(
        <div style={{display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden",background:"var(--bg)",...wallStyle}}>
          <Header user={user} onLogout={async()=>{await supabase.auth.signOut();setUser(null);setOpenedProject(null);}} isDark={isDark} toggleTheme={toggleTheme} users={users}/>
          {projectsLoading?(
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--txt3)",fontSize:12,fontFamily:"IBM Plex Mono"}}>Loading projects...</div>
          ):(
            <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
              {currentProject?(
                <ProjectPage project={currentProject} currentUser={user} onBack={()=>setOpenedProject(null)} onUpdateProject={updateProject} allProjects={projects} setProjects={setProjects} users={users} onOpenNewProject={(prefill)=>{setOpenedProject(null);setPrefillProject(prefill);}}/>
              ):(
                <>
                  {user.role==="superadmin"&&<SuperAdminView projects={projects} setProjects={setProjects} currentUser={user} openProject={setOpenedProject} users={users} setUsers={setUsers} isDark={isDark} prefillProject={prefillProject} clearPrefill={()=>setPrefillProject(null)} fetchProjects={fetchProjects}/>}
                  {user.role==="pm"&&<PMView projects={projects} currentUser={user} openProject={setOpenedProject} users={users} setUsers={setUsers}/>}
                  {user.role==="developer"&&<DevView projects={projects} currentUser={user} openProject={setOpenedProject} users={users} setUsers={setUsers}/>}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
