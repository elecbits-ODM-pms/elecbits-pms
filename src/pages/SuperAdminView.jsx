import { useState, useEffect } from "react";
import { RESOURCE_ROLES, CHECKLIST_DEFS, PROJECT_TAGS, TEAM_SLOTS, UNIQ, tagLabel, tagColor, daysLeft, fmtDate, todayStr, ragColor, getUser, getPM, nonAdmins } from "../lib/constants.jsx";
import { updateUserWallpaper, sanctionProjectInDB, rejectProjectInDB } from "../lib/db.js";
import { supabase } from "../lib/supabase.js";
import { Btn, Inp, Sel, Pill, Tag, Stat, Bar, Av, SH, Modal, Toast, ThemeToggle } from "../components/ui/index.jsx";
import ProjectForm from "../components/ProjectForm.jsx";
import ResourcesView from "./resources/ResourcesView.jsx";
import AlertsView from "./AlertsView.jsx";
import PersonalSettingsModal from "./PersonalSettingsModal.jsx";

const SuperAdminView=({projects,setProjects,currentUser,openProject,users,setUsers,isDark,toggleTheme,prefillProject,clearPrefill,fetchProjects,sidebarView,setSidebarView})=>{
  const view = sidebarView || "projects";
  const setView = (v) => setSidebarView ? setSidebarView(v) : null;
  const [search,setSearch]=useState("");
  const [tagFilters,setTagFilters]=useState([]);
  const [sanctionFilter,setSanctionFilter]=useState("All");
  const [pmFilters,setPmFilters]=useState([]);
  const [tmFilters,setTmFilters]=useState([]);
  const [devFilters,setDevFilters]=useState([]);
  const [dateFrom,setDateFrom]=useState(""); const [dateTo,setDateTo]=useState("");
  const [showFilters,setShowFilters]=useState(false);
  const [pmNoProjectsAlert,setPmNoProjectsAlert]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [prefillForm,setPrefillForm]=useState(null);
  const [showRejected,setShowRejected]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [toast,setToast]=useState(null);
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};
  useEffect(()=>{if(prefillProject){setView("projects");setShowAdd(true);setPrefillForm(prefillProject);clearPrefill&&clearPrefill();}},[ prefillProject]);

  // When sidebar settings is clicked, show settings modal
  useEffect(()=>{if(view==="settings"){setShowSettings(true);setSidebarView("projects");}},[ view]);

  const rejected=projects.filter(p=>p.rejected===true);
  const activeProjects=projects.filter(p=>!p.rejected);
  const filtered=activeProjects.filter(p=>{
    const sm=p.name.toLowerCase().includes(search.toLowerCase())||p.projectId.toLowerCase().includes(search.toLowerCase());
    const tf=tagFilters.length===0||tagFilters.includes(p.projectTag);
    const sf=sanctionFilter==="All"||(sanctionFilter==="Sanctioned"&&p.sanctioned)||(sanctionFilter==="Pending"&&!p.sanctioned);
    const pmf=pmFilters.length===0||p.teamAssignments?.some(a=>pmFilters.includes(String(a.userId))&&["Senior PM","PM"].includes(a.role));
    const tmf=tmFilters.length===0||p.teamAssignments?.some(a=>tmFilters.includes(String(a.userId)));
    const devf=devFilters.length===0||p.teamAssignments?.some(a=>devFilters.includes(String(a.userId)));
    const df=(!dateFrom||p.startDate>=dateFrom)&&(!dateTo||p.endDate<=dateTo);
    return sm&&tf&&sf&&pmf&&tmf&&devf&&df;
  });

  const saveProject=(form)=>{
    const isSubmit=form.submitForSanction;
    const buildCustomChecklists=(f)=>{
      if(!f.checklistConfig||!f.productIds)return{};
      const CL_TEMPLATES=[
        {key:"pm_milestone",icon:"🎯",label:"PM / Milestone Checklist",useProjectId:true},
        {key:"hw_design",icon:"⬡",label:"GW / Hardware Checklist",useProjectId:false},
        {key:"hw_testing",icon:"🔬",label:"Hardware Testing Checklist",useProjectId:false},
        {key:"fw_logic",icon:"◈",label:"Firmware — Logic Checklist",useProjectId:false},
        {key:"fw_testing",icon:"🧪",label:"Firmware Testing Checklist",useProjectId:false},
        {key:"id_design",icon:"◉",label:"Industrial Design Checklist",useProjectId:false},
        {key:"id_testing",icon:"📐",label:"Industrial Design Testing Checklist",useProjectId:false},
        {key:"overall_testing",icon:"✅",label:"Overall Testing",useProjectId:false},
        {key:"production",icon:"🏭",label:"Production Checklist",useProjectId:true},
      ];
      const customCLs={};
      const pids=f.productIds.filter(Boolean);
      pids.forEach(pid=>{
        const pidKey=pid;
        const sets=f.checklistConfig[pidKey]||1;
        for(let s=0;s<sets;s++){
          CL_TEMPLATES.forEach(tpl=>{
            const prefix=tpl.useProjectId?f.projectId:pid;
            const suffix=sets>1?" (Set "+(s+1)+")":"";
            const clName=prefix+"_"+tpl.label+suffix;
            const clKey=tpl.key+(pids.length>1?"_"+pid:"")+(sets>1?"_s"+s:"");
            customCLs[clKey]={
              label:clName,
              icon:tpl.icon,
              baseKey:tpl.key,
              pid,
              setIndex:s,
              items:[],
              note:"",
              auditStatus:"Not Reviewed",
            };
          });
        }
      });
      return customCLs;
    };

    if(form.id){
      setProjects(ps=>ps.map(p=>p.id===form.id?{...form,sanctioned:p.sanctioned}:p));
    } else {
      const customChecklists=buildCustomChecklists(form);
      const hasCustom=Object.keys(customChecklists).length>0;

      supabase.from("projects").insert({
        name:             form.name,
        project_id:       form.projectId,
        product_ids:      form.productIds||[],
        client_name:      form.clientName||null,
        client_id:        form.clientId||null,
        project_tag:      form.projectTag||"engineering",
        description:      form.description||null,
        start_date:       form.startDate||null,
        end_date:         form.endDate||null,
        rag:              "amber",
        sanctioned:       false,
        pending_sanction: isSubmit,
        checklist_config: form.checklistConfig||{},
        created_by:       currentUser.id,
      }).select().single().then(async({data:proj,error:pe})=>{
        if(pe){console.error("Create project error:",pe.message);alert("Failed to create project: "+pe.message);return;}

        const teamRows=(form.teamAssignments||[]).filter(a=>a.userId||a.user_id).map(a=>({
          project_id: proj.id,
          user_id:    a.userId||a.user_id,
          role:       a.role,
          start_date: a.startDate||a.start_date||form.startDate||null,
          end_date:   a.endDate||a.end_date||form.endDate||null,
        }));
        if(teamRows.length){
          const{error:te}=await supabase.from("team_assignments").insert(teamRows);
          if(te)console.error("Team insert error:",te.message);
        }

        const clRows=hasCustom
          ? Object.entries(customChecklists).map(([key,cl],i)=>({
              project_id:   proj.id,
              key:          key,
              base_key:     cl.baseKey,
              label:        cl.label,
              icon:         cl.icon||"📋",
              pid:          cl.pid||null,
              set_index:    cl.setIndex||0,
              order_index:  i,
            }))
          : [{project_id:proj.id,key:"pm_milestone",base_key:"pm_milestone",label:form.projectId+"_PM / Milestone Checklist",icon:"🎯",order_index:0},
             {project_id:proj.id,key:"hw_design",base_key:"hw_design",label:(form.productIds?.[0]||form.projectId)+"_GW / Hardware Checklist",icon:"⬡",order_index:1},
             {project_id:proj.id,key:"hw_testing",base_key:"hw_testing",label:(form.productIds?.[0]||form.projectId)+"_Hardware Testing Checklist",icon:"🔬",order_index:2},
             {project_id:proj.id,key:"fw_logic",base_key:"fw_logic",label:(form.productIds?.[0]||form.projectId)+"_Firmware — Logic Checklist",icon:"◈",order_index:3},
             {project_id:proj.id,key:"fw_testing",base_key:"fw_testing",label:(form.productIds?.[0]||form.projectId)+"_Firmware Testing Checklist",icon:"🧪",order_index:4},
             {project_id:proj.id,key:"id_design",base_key:"id_design",label:(form.productIds?.[0]||form.projectId)+"_Industrial Design Checklist",icon:"◉",order_index:5},
             {project_id:proj.id,key:"id_testing",base_key:"id_testing",label:(form.productIds?.[0]||form.projectId)+"_Industrial Design Testing Checklist",icon:"📐",order_index:6},
             {project_id:proj.id,key:"overall_testing",base_key:"overall_testing",label:(form.productIds?.[0]||form.projectId)+"_Overall Testing",icon:"✅",order_index:7},
             {project_id:proj.id,key:"production",base_key:"production",label:form.projectId+"_Production Checklist",icon:"🏭",order_index:8}];

        const{error:cle}=await supabase.from("checklists").insert(clRows);
        if(cle)console.error("Checklist insert error:",cle.message);

        setTimeout(()=>fetchProjects(),300);
        showToast(isSubmit?"Submitted for sanction":"Project created","var(--green)");
      });
    }
    setShowAdd(false);
    if(!form.id)return;
    showToast(isSubmit?"Submitted for sanction":"Draft saved","var(--green)");
  };
  const sanctionProject=(id)=>{
    sanctionProjectInDB(id,currentUser.id).then(()=>fetchProjects());
    setProjects(ps=>ps.map(p=>p.id===id?{...p,sanctioned:true,pendingSanction:false,rag:p.rag==="amber"?"green":p.rag}:p));
    showToast("Sanctioned","var(--green)");
  };
  const unsanctionProject=(id)=>{
    supabase.from("projects").update({sanctioned:false}).eq("id",id).then(()=>fetchProjects());
    setProjects(ps=>ps.map(p=>p.id===id?{...p,sanctioned:false}:p));
    showToast("Sanction removed","var(--amber)");
  };
  const saveUserSettings=async(holidays,wallpaper)=>{
    if(wallpaper){await updateUserWallpaper(currentUser.id,wallpaper);}
    setUsers(prev=>prev.map(u=>u.id===currentUser.id?{...u,holidays,wallpaper:wallpaper||u.wallpaper}:u));
  };

  const pendingSanctionCount = activeProjects.filter(p=>p.pendingSanction&&!p.sanctioned).length;
  const completedCount = activeProjects.filter(p=>{
    const cl=p.checklists||{};
    const tot=Object.values(cl).reduce((a,v)=>{if(Array.isArray(v))return a+v.reduce((b,c)=>b+(c.items||[]).length,0);return a+(v.items||[]).length;},0);
    const dn=Object.values(cl).reduce((a,v)=>{if(Array.isArray(v))return a+v.reduce((b,c)=>b+(c.items||[]).filter(x=>x.tmApproval==="Approved"&&x.pmApproval==="Approved"&&x.clientApproval==="Approved").length,0);return a+(v.items||[]).filter(x=>x.tmApproval==="Approved"&&x.pmApproval==="Approved"&&x.clientApproval==="Approved").length;},0);
    return tot>0&&dn===tot;
  }).length;
  const inProductionCount = activeProjects.filter(p=>p.sanctioned&&!p.rejected).length;

  const pmUsers=users.filter(u=>["sr_pm","jr_pm"].includes(u.resourceRole));
  const tmUsers=users.filter(u=>["sr_hw","jr_hw","sr_fw","jr_fw","ind_design"].includes(u.resourceRole));
  const devUsers=users.filter(u=>["tester","soldering","devops","sc","sol_arch"].includes(u.resourceRole));

  const startCards = [
    { tag: "engineering", title: "Engineering", subtitle: "Hardware & firmware projects", bg: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)", icon: "⚡", popular: true },
    { tag: "elecbits_product", title: "EB Product", subtitle: "Internal product development", bg: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", icon: "🔧" },
    { tag: "modifier", title: "Modifier", subtitle: "Design modifications & tweaks", bg: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)", icon: "✏️" },
    { tag: "new", title: "Custom", subtitle: "Start from scratch", bg: "linear-gradient(135deg, #475569 0%, #334155 100%)", icon: "+" },
  ];

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{flex:1,overflow:"auto",padding:"0"}}>
        {view==="projects"&&<>
          {/* Welcome Header */}
          <div style={{padding:"28px 32px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <h1 style={{fontSize:26,fontWeight:800,color:"var(--txt)",margin:0,letterSpacing:"-0.02em"}}>Welcome back, {currentUser.name?.split(" ")[0] || "Admin"}</h1>
              <p style={{fontSize:14,color:"var(--txt2)",marginTop:4,fontWeight:400}}>Here's what's happening across your manufacturing projects</p>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <ThemeToggle isDark={isDark} toggle={toggleTheme}/>
              <button onClick={()=>setShowAdd(true)} style={{
                padding:"10px 20px",background:"#2563eb",color:"#fff",border:"none",borderRadius:10,
                fontSize:13,fontWeight:600,cursor:"pointer",transition:"all .15s",display:"flex",alignItems:"center",gap:6
              }}
                onMouseEnter={e=>e.currentTarget.style.background="#1d4ed8"}
                onMouseLeave={e=>e.currentTarget.style.background="#2563eb"}
              >
                <span style={{fontSize:16,lineHeight:1}}>+</span> New Project
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div style={{padding:"20px 32px",display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:16}}>
            <div className="dash-stat-card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:32,fontWeight:800,color:"#0f172a",lineHeight:1}}>{activeProjects.length}</div>
                  <div style={{fontSize:13,color:"#64748b",marginTop:6,fontWeight:500}}>Total Projects</div>
                </div>
                <div style={{width:36,height:36,borderRadius:10,background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                </div>
              </div>
            </div>
            <div className="dash-stat-card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:32,fontWeight:800,color:"#0f172a",lineHeight:1}}>{pendingSanctionCount}</div>
                  <div style={{fontSize:13,color:"#64748b",marginTop:6,fontWeight:500}}>Pending Sanction</div>
                </div>
                <div style={{width:36,height:36,borderRadius:10,background:"#fffbeb",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
              </div>
            </div>
            <div className="dash-stat-card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:32,fontWeight:800,color:"#0f172a",lineHeight:1}}>{inProductionCount}</div>
                  <div style={{fontSize:13,color:"#64748b",marginTop:6,fontWeight:500}}>Active</div>
                </div>
                <div style={{width:36,height:36,borderRadius:10,background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
              </div>
            </div>
            <div className="dash-stat-card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:32,fontWeight:800,color:"#0f172a",lineHeight:1}}>{completedCount}</div>
                  <div style={{fontSize:13,color:"#64748b",marginTop:6,fontWeight:500}}>Completed</div>
                </div>
                <div style={{width:36,height:36,borderRadius:10,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Sanction Requests */}
          {pendingSanctionCount>0&&(
            <div style={{margin:"0 32px 20px",padding:"16px 20px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#d97706",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Sanction Requests ({pendingSanctionCount})
              </div>
              {activeProjects.filter(p=>p.pendingSanction&&!p.sanctioned).map(p=>{const pm=getPM(p,users);return(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#ffffff",borderRadius:10,marginBottom:6,border:"1px solid #fde68a"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#0f172a"}}>{p.name}</div>
                    <div style={{fontSize:12,color:"#64748b"}}>{p.projectId}{p.clientName&&` · ${p.clientName}`} · {fmtDate(p.startDate)} → {fmtDate(p.endDate)}</div>
                    {pm&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>PM: {pm.name}</div>}
                  </div>
                  <button onClick={()=>openProject(p)} style={{padding:"6px 12px",background:"transparent",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,fontWeight:600,color:"#64748b",cursor:"pointer"}}>View</button>
                  <button onClick={()=>sanctionProject(p.id)} style={{padding:"6px 14px",background:"#16a34a",border:"none",borderRadius:8,fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Sanction</button>
                  <button onClick={()=>{const reason=prompt("Rejection reason (optional):")||"";rejectProjectInDB(p.id,reason,currentUser.id).then(()=>fetchProjects());setProjects(ps=>ps.map(x=>x.id===p.id?{...x,pendingSanction:false,sanctioned:false,rejected:true,rejectedAt:todayStr(),rejectedReason:reason}:x));showToast("Project rejected","var(--red)");}} style={{padding:"6px 12px",background:"#ef4444",border:"none",borderRadius:8,fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Reject</button>
                </div>
              );})}
            </div>
          )}

          {/* Start New Project Cards */}
          <div style={{padding:"0 32px 20px"}}>
            <div style={{fontSize:15,fontWeight:700,color:"var(--txt)",marginBottom:12}}>Start a new project</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:14}}>
              {startCards.map(c=>(
                <div key={c.tag} className="start-card" style={{background:c.bg}} onClick={()=>{
                  if(c.tag==="new"){setShowAdd(true);setPrefillForm(null);}
                  else{setShowAdd(true);setPrefillForm({projectTag:c.tag});}
                }}>
                  {c.popular&&<div style={{position:"absolute",top:16,left:16,padding:"3px 10px",background:"rgba(255,255,255,0.2)",borderRadius:99,fontSize:10,fontWeight:700,color:"#fff",backdropFilter:"blur(4px)"}}>Most Popular</div>}
                  <div className="arrow"><span style={{color:"#fff",fontSize:16}}>→</span></div>
                  <div style={{fontSize:28,marginBottom:8}}>{c.icon}</div>
                  <div style={{fontSize:16,fontWeight:700,color:"#fff",marginBottom:2}}>{c.title}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.7)"}}>{c.subtitle}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Search & Filters */}
          <div style={{padding:"0 32px"}}>
            <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{position:"relative",flex:"0 0 260px"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input placeholder="Search projects..." value={search} onChange={e=>setSearch(e.target.value)} style={{
                  width:"100%",padding:"9px 12px 9px 36px",border:"1px solid var(--bdr)",borderRadius:10,fontSize:13,
                  background:"var(--card)",color:"var(--txt)",outline:"none"
                }}
                  onFocus={e=>{e.target.style.borderColor="#2563eb";e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.08)";}}
                  onBlur={e=>{e.target.style.borderColor="var(--bdr)";e.target.style.boxShadow="none";}}
                />
              </div>
              <button onClick={()=>setShowFilters(!showFilters)} style={{
                padding:"9px 14px",background:showFilters?"var(--s2)":"var(--card)",border:"1px solid var(--bdr)",
                borderRadius:10,fontSize:12,fontWeight:600,color:"var(--txt2)",cursor:"pointer",display:"flex",alignItems:"center",gap:6
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                Filters
              </button>
              {rejected.length>0&&(
                <button onClick={()=>setShowRejected(true)} style={{
                  padding:"9px 14px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,fontSize:12,
                  fontWeight:600,color:"#ef4444",cursor:"pointer",display:"flex",alignItems:"center",gap:6
                }}>
                  {rejected.length} Rejected
                </button>
              )}
            </div>

            {showFilters&&(
              <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:12,padding:18,marginBottom:14,boxShadow:"var(--shadow)"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:14,marginBottom:12}}>
                  <div>
                    <span style={{fontSize:11,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono"}}>Project Type</span>
                    {PROJECT_TAGS.map(t=>(
                      <label key={t.key} style={{display:"flex",alignItems:"center",gap:7,padding:"4px 0",cursor:"pointer"}}>
                        <input type="checkbox" checked={tagFilters.includes(t.key)} onChange={e=>setTagFilters(prev=>e.target.checked?[...prev,t.key]:prev.filter(x=>x!==t.key))} style={{accentColor:t.color}}/>
                        <span style={{fontSize:12,color:"var(--txt)"}}>{t.label}</span>
                        <span style={{fontSize:10,color:"var(--txt3)",marginLeft:"auto",fontFamily:"IBM Plex Mono"}}>{projects.filter(p=>p.projectTag===t.key).length}</span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <span style={{fontSize:11,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono"}}>Sanction Status</span>
                    {[{v:"All",l:"All"},{v:"Sanctioned",l:"Sanctioned"},{v:"Pending",l:"Pending"}].map(o=>(
                      <label key={o.v} style={{display:"flex",alignItems:"center",gap:7,padding:"4px 0",cursor:"pointer"}}>
                        <input type="radio" name="sanction" checked={sanctionFilter===o.v} onChange={()=>setSanctionFilter(o.v)}/>
                        <span style={{fontSize:12,color:"var(--txt)"}}>{o.l}</span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <span style={{fontSize:11,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono"}}>Project Manager</span>
                    {pmUsers.map(u=>{
                      const pmProjects=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===u.id&&["Senior PM","PM"].includes(a.role)));
                      return(
                        <label key={u.id} style={{display:"flex",alignItems:"center",gap:7,padding:"4px 0",cursor:"pointer"}}>
                          <input type="checkbox" checked={pmFilters.includes(String(u.id))} onChange={e=>{
                            const newFilters=e.target.checked?[...pmFilters,String(u.id)]:pmFilters.filter(x=>x!==String(u.id));
                            setPmFilters(newFilters);
                            if(e.target.checked&&pmProjects.length===0){setPmNoProjectsAlert(u.name);}
                            else if(!e.target.checked&&pmNoProjectsAlert===u.name){setPmNoProjectsAlert(null);}
                          }}/>
                          <span style={{fontSize:12,color:"var(--txt)"}}>{u.name}</span>
                          <span style={{fontSize:10,fontFamily:"IBM Plex Mono",marginLeft:"auto",color:pmProjects.length===0?"var(--amber)":"var(--txt3)"}}>{pmProjects.length}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div>
                    <span style={{fontSize:11,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono"}}>Technical Manager</span>
                    {tmUsers.map(u=>{
                      const cnt=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===u.id)).length;
                      return(
                        <label key={u.id} style={{display:"flex",alignItems:"center",gap:7,padding:"4px 0",cursor:"pointer"}}>
                          <input type="checkbox" checked={tmFilters.includes(String(u.id))} onChange={e=>setTmFilters(prev=>e.target.checked?[...prev,String(u.id)]:prev.filter(x=>x!==String(u.id)))}/>
                          <span style={{fontSize:12,color:"var(--txt)"}}>{u.name}</span>
                          <span style={{fontSize:10,fontFamily:"IBM Plex Mono",marginLeft:"auto",color:"var(--txt3)"}}>{cnt}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div>
                    <span style={{fontSize:11,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono"}}>Developer / Resource</span>
                    {devUsers.map(u=>{
                      const cnt=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===u.id)).length;
                      return(
                        <label key={u.id} style={{display:"flex",alignItems:"center",gap:7,padding:"4px 0",cursor:"pointer"}}>
                          <input type="checkbox" checked={devFilters.includes(String(u.id))} onChange={e=>setDevFilters(prev=>e.target.checked?[...prev,String(u.id)]:prev.filter(x=>x!==String(u.id)))}/>
                          <span style={{fontSize:12,color:"var(--txt)"}}>{u.name}</span>
                          <span style={{fontSize:10,fontFamily:"IBM Plex Mono",marginLeft:"auto",color:"var(--txt3)"}}>{cnt}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div>
                    <span style={{fontSize:11,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono"}}>Date Range</span>
                    <div style={{marginBottom:8}}><div style={{fontSize:10,color:"var(--txt3)",marginBottom:3}}>Start From</div><Inp type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{fontSize:11}}/></div>
                    <div><div style={{fontSize:10,color:"var(--txt3)",marginBottom:3}}>End Before</div><Inp type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{fontSize:11}}/></div>
                  </div>
                </div>
                {(tagFilters.length>0||pmFilters.length>0||tmFilters.length>0||devFilters.length>0||sanctionFilter!=="All"||dateFrom||dateTo)&&(
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid var(--bdr)",alignItems:"center"}}>
                    <span style={{fontSize:11,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>ACTIVE:</span>
                    {tagFilters.map(t=><span key={t} style={{padding:"3px 10px",borderRadius:99,fontSize:11,background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",cursor:"pointer"}} onClick={()=>setTagFilters(prev=>prev.filter(x=>x!==t))}>{tagLabel(t)} ×</span>)}
                    {sanctionFilter!=="All"&&<span style={{padding:"3px 10px",borderRadius:99,fontSize:11,background:"#fffbeb",color:"#d97706",border:"1px solid #fde68a"}}>{sanctionFilter} ×</span>}
                    {pmFilters.map(id=>{const u=users.find(x=>String(x.id)===id);return u?<span key={id} style={{padding:"3px 10px",borderRadius:99,fontSize:11,background:"#fff7ed",color:"#ea580c",border:"1px solid #fed7aa"}}>PM: {u.name} ×</span>:null;})}
                    {tmFilters.map(id=>{const u=users.find(x=>String(x.id)===id);return u?<span key={id} style={{padding:"3px 10px",borderRadius:99,fontSize:11,background:"#f5f3ff",color:"#7c3aed",border:"1px solid #ddd6fe"}}>TM: {u.name} ×</span>:null;})}
                    {devFilters.map(id=>{const u=users.find(x=>String(x.id)===id);return u?<span key={id} style={{padding:"3px 10px",borderRadius:99,fontSize:11,background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0"}}>Dev: {u.name} ×</span>:null;})}
                    <button onClick={()=>{setTagFilters([]);setSanctionFilter("All");setPmFilters([]);setTmFilters([]);setDevFilters([]);setDateFrom("");setDateTo("");setPmNoProjectsAlert(null);}} style={{padding:"3px 12px",borderRadius:99,fontSize:11,background:"var(--s2)",color:"var(--txt2)",border:"1px solid var(--bdr)",cursor:"pointer",marginLeft:"auto",fontWeight:600}}>Clear All</button>
                  </div>
                )}
              </div>
            )}

            {pmNoProjectsAlert&&(
              <div style={{marginBottom:12,padding:"14px 16px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:20}}>📭</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:"var(--txt)",marginBottom:2}}>{pmNoProjectsAlert} has no projects assigned</div>
                  <div style={{fontSize:12,color:"var(--txt2)"}}>This PM is not currently assigned to any project as a PM or Senior PM.</div>
                </div>
                <button onClick={()=>setPmNoProjectsAlert(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt3)",fontSize:18,padding:"0 4px",lineHeight:1}}>×</button>
              </div>
            )}

            {/* Project Table */}
            <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:12,overflow:"hidden",boxShadow:"var(--shadow)",marginBottom:24}}>
              <div style={{display:"grid",gridTemplateColumns:"2.5fr 1fr 0.8fr 0.8fr 1fr 100px 110px 50px",gap:8,padding:"12px 16px",fontSize:11,color:"var(--txt2)",fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",borderBottom:"1px solid var(--bdr)",background:"var(--s2)"}}>
                <span>Project</span><span>Tag</span><span>Start</span><span>End</span><span>PM</span><span>Progress</span><span>Sanction</span><span/>
              </div>
              {filtered.length===0&&(
                <div style={{padding:"32px",textAlign:"center",color:"var(--txt3)",fontSize:13}}>
                  <div style={{fontSize:24,marginBottom:8}}>📭</div>
                  <div style={{fontWeight:600,color:"var(--txt2)"}}>No projects match the selected filters</div>
                  <div style={{fontSize:12,marginTop:4}}>Try adjusting or clearing the active filters above.</div>
                </div>
              )}
              {filtered.map(p=>{
                const dl=daysLeft(p.endDate);const pm=getPM(p,users);
                const cl=p.checklists||{};
                const tot=Object.values(cl).reduce((a,v)=>{if(Array.isArray(v))return a+v.reduce((b,c)=>b+(c.items||[]).length,0);return a+(v.items||[]).length;},0);
                const dn=Object.values(cl).reduce((a,v)=>{if(Array.isArray(v))return a+v.reduce((b,c)=>b+(c.items||[]).filter(x=>x.tmApproval==="Approved"&&x.pmApproval==="Approved"&&x.clientApproval==="Approved").length,0);return a+(v.items||[]).filter(x=>x.tmApproval==="Approved"&&x.pmApproval==="Approved"&&x.clientApproval==="Approved").length;},0);
                const pct=tot?Math.round((dn/tot)*100):0;
                const sanctionStatus = p.sanctioned ? "done" : (p.pendingSanction ? "pending" : "none");
                return(
                  <div key={p.id} style={{display:"grid",gridTemplateColumns:"2.5fr 1fr 0.8fr 0.8fr 1fr 100px 110px 50px",gap:8,padding:"14px 16px",borderBottom:"1px solid var(--bdr)",alignItems:"center",transition:"all .12s",cursor:"pointer",background:"var(--card)"}}
                    onClick={()=>openProject(p)}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"}
                    onMouseLeave={e=>e.currentTarget.style.background="var(--card)"}
                  >
                    <div>
                      <div style={{fontWeight:600,fontSize:13,color:"var(--txt)",marginBottom:2}}>{p.name}</div>
                      <div style={{fontSize:11,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>{p.projectId}{p.clientName&&` · ${p.clientName}`}</div>
                    </div>
                    <div>
                      {p.projectTag && (
                        <span className="status-pill" style={{
                          background: p.projectTag==="engineering"?"#eff6ff":p.projectTag==="elecbits_product"?"#f0fdf4":"#f5f3ff",
                          color: p.projectTag==="engineering"?"#2563eb":p.projectTag==="elecbits_product"?"#16a34a":"#7c3aed",
                          fontSize:11
                        }}>{tagLabel(p.projectTag)}</span>
                      )}
                    </div>
                    <span style={{fontSize:12,color:"var(--txt2)"}}>{fmtDate(p.startDate)}</span>
                    <span style={{fontSize:12,color:dl<7?"#ef4444":dl<14?"#d97706":"var(--txt2)"}}>{fmtDate(p.endDate)}</span>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>{pm&&<><Av uid={pm.id} size={22} users={users}/><span style={{fontSize:12,color:"var(--txt2)"}}>{pm.name}</span></>}</div>
                    <div onClick={e=>e.stopPropagation()}>
                      <div style={{height:5,background:"var(--bdr)",borderRadius:99,overflow:"hidden"}}>
                        <div style={{width:`${pct}%`,height:"100%",background:pct>=70?"#16a34a":pct>=40?"#2563eb":"#d97706",borderRadius:99,transition:"width .3s"}}/>
                      </div>
                    </div>
                    <div onClick={e=>e.stopPropagation()}>
                      {sanctionStatus==="done"?(
                        <span className="status-pill" style={{background:"#f0fdf4",color:"#16a34a",fontSize:11,cursor:"pointer"}} onClick={()=>unsanctionProject(p.id)}>Sanctioned</span>
                      ):sanctionStatus==="pending"?(
                        <span className="status-pill" style={{background:"#fffbeb",color:"#d97706",fontSize:11,cursor:"pointer"}} onClick={()=>sanctionProject(p.id)}>Pending</span>
                      ):(
                        <button onClick={()=>sanctionProject(p.id)} style={{padding:"4px 12px",background:"#2563eb",border:"none",borderRadius:99,fontSize:11,fontWeight:600,color:"#fff",cursor:"pointer"}}>Sanction</button>
                      )}
                    </div>
                    <div onClick={e=>e.stopPropagation()} style={{display:"flex",justifyContent:"center"}}>
                      <button onClick={()=>{if(window.confirm(`Delete "${p.name}"? This cannot be undone.`)){setProjects(ps=>ps.filter(x=>x.id!==p.id));showToast(`${p.name} deleted`,"var(--red)");}}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt3)",fontSize:14,padding:4,borderRadius:6,transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.color="#ef4444"} onMouseLeave={e=>e.currentTarget.style.color="var(--txt3)"} title="Delete project">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>}
        {view==="resources"&&<div style={{padding:28}}><ResourcesView projects={projects} users={users} setUsers={setUsers} isAdmin={true} currentUser={currentUser}/></div>}
        {view==="alerts"&&<div style={{padding:28}}><AlertsView projects={projects} currentUser={currentUser} users={users}/></div>}
      </div>

      {showRejected&&(
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
          <div style={{position:"absolute",inset:0,background:"#00000040",backdropFilter:"blur(4px)"}} onClick={()=>setShowRejected(false)}/>
          <div style={{position:"absolute",right:0,top:0,bottom:0,width:"min(640px,95vw)",background:"var(--card)",borderLeft:"1px solid var(--bdr)",display:"flex",flexDirection:"column",animation:"fadeUp .2s ease",boxShadow:"-8px 0 32px rgba(0,0,0,0.08)"}}>
            <div style={{padding:"18px 24px",borderBottom:"1px solid var(--bdr)",display:"flex",alignItems:"center",gap:12,background:"#fef2f2"}}>
              <span style={{fontSize:20}}>🚫</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:16,color:"#ef4444"}}>Rejected Projects</div>
                <div style={{fontSize:12,color:"#94a3b8"}}>{rejected.length} project{rejected.length>1?"s":""} rejected</div>
              </div>
              <button onClick={()=>setShowRejected(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt2)",fontSize:22,padding:"0 4px",lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:"auto",padding:"18px 24px"}}>
              <div style={{fontSize:12,color:"var(--txt3)",marginBottom:16,padding:"10px 14px",background:"var(--s2)",borderRadius:8}}>
                These projects were rejected during sanction review. They can be reinstated if needed.
              </div>
              {rejected.map(p=>{
                const pm=getPM(p,users);
                return(
                  <div key={p.id} style={{padding:"16px 18px",background:"var(--card)",border:"1px solid #fecaca",borderRadius:12,marginBottom:10,borderLeft:"3px solid #ef4444"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,gap:10}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,color:"var(--txt)",marginBottom:4}}>{p.name}</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                          <span style={{padding:"2px 8px",borderRadius:6,fontSize:11,background:"var(--s2)",color:"var(--txt2)",fontFamily:"IBM Plex Mono"}}>{p.projectId}</span>
                          {p.projectTag&&<Tag label={tagLabel(p.projectTag)} color={tagColor(p.projectTag)}/>}
                          {pm&&<div style={{display:"flex",alignItems:"center",gap:4}}><Av uid={pm.id} size={16} users={users}/><span style={{fontSize:11,color:"var(--txt2)"}}>{pm.name}</span></div>}
                        </div>
                      </div>
                      <span className="status-pill" style={{background:"#fef2f2",color:"#ef4444",fontSize:10}}>Rejected</span>
                    </div>
                    <div style={{display:"flex",gap:16,fontSize:12,color:"var(--txt2)",marginBottom:8}}>
                      {p.clientName&&<span>Client: <strong>{p.clientName}</strong></span>}
                      {p.startDate&&<span>Period: {fmtDate(p.startDate)} → {fmtDate(p.endDate)}</span>}
                    </div>
                    <div style={{padding:"10px 14px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,marginBottom:12}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#ef4444",fontFamily:"IBM Plex Mono",marginBottom:3}}>REJECTION DETAILS</div>
                      <div style={{fontSize:12,color:"var(--txt2)"}}>{p.rejectedReason||"No reason recorded."}</div>
                      {p.rejectedAt&&<div style={{fontSize:11,color:"var(--txt3)",marginTop:3,fontFamily:"IBM Plex Mono"}}>Rejected on: {fmtDate(p.rejectedAt)}</div>}
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>openProject(p)} style={{padding:"7px 14px",background:"transparent",border:"1px solid var(--bdr)",borderRadius:8,fontSize:12,fontWeight:600,color:"var(--txt2)",cursor:"pointer"}}>View Details</button>
                      <button onClick={()=>{
                        setProjects(ps=>ps.map(x=>x.id===p.id?{...x,rejected:false,rejectedReason:"",rejectedAt:"",pendingSanction:true}:x));
                        showToast(`${p.name} reinstated`,"var(--green)");
                      }} style={{padding:"7px 14px",background:"#16a34a",border:"none",borderRadius:8,fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Reinstate</button>
                      <button onClick={()=>{
                        if(window.confirm(`Permanently delete "${p.name}"?`)){
                          setProjects(ps=>ps.filter(x=>x.id!==p.id));
                          showToast(`${p.name} deleted`,"var(--red)");
                        }
                      }} style={{padding:"7px 14px",background:"#ef4444",border:"none",borderRadius:8,fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{padding:"14px 24px",borderTop:"1px solid var(--bdr)",background:"var(--s2)",display:"flex",justifyContent:"flex-end"}}>
              <button onClick={()=>setShowRejected(false)} style={{padding:"8px 18px",background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:8,fontSize:13,fontWeight:600,color:"var(--txt)",cursor:"pointer"}}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showAdd&&<Modal title={prefillForm?.projectTag?"New "+({engineering:"Engineering",elecbits_product:"EB Product",modifier:"Modifier"}[prefillForm.projectTag]||"")+" Project":"New Project"} onClose={()=>{setShowAdd(false);setPrefillForm(null);}} wide><ProjectForm initial={prefillForm||undefined} onSave={saveProject} onClose={()=>{setShowAdd(false);setPrefillForm(null);}} allProjects={projects} users={users} isAdmin={true}/></Modal>}
      {showSettings&&<PersonalSettingsModal user={currentUser} onClose={()=>setShowSettings(false)} isDark={isDark} toggleTheme={()=>{}} allProjects={projects} onSave={saveUserSettings} showToast={showToast}/>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

export default SuperAdminView;
