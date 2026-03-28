import { useState, useEffect } from "react";
import { RESOURCE_ROLES, CHECKLIST_DEFS, PROJECT_TAGS, TEAM_SLOTS, UNIQ, tagLabel, tagColor, daysLeft, fmtDate, todayStr, ragColor, getUser, getPM, nonAdmins } from "../lib/constants.jsx";
import { updateUserWallpaper, sanctionProjectInDB, rejectProjectInDB } from "../lib/db.js";
import { supabase } from "../lib/supabase.js";
import { Btn, Inp, Sel, Pill, Tag, Stat, Bar, Av, SH, Modal, Toast } from "../components/ui/index.jsx";
import ProjectForm from "../components/ProjectForm.jsx";
import ResourcesView from "./resources/ResourcesView.jsx";
import AlertsView from "./AlertsView.jsx";
import PersonalSettingsModal from "./PersonalSettingsModal.jsx";

const SuperAdminView=({projects,setProjects,currentUser,openProject,users,setUsers,isDark,prefillProject,clearPrefill,fetchProjects})=>{
  const [view,setView]=useState("projects");
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
        showToast(isSubmit?"Submitted for sanction 📋":"Project created ✓","var(--green)");
      });
    }
    setShowAdd(false);
    if(!form.id)return;
    showToast(isSubmit?"Submitted for sanction 📋":"Draft saved ✓","var(--green)");
  };
  const sanctionProject=(id)=>{
    sanctionProjectInDB(id,currentUser.id).then(()=>fetchProjects());
    setProjects(ps=>ps.map(p=>p.id===id?{...p,sanctioned:true,pendingSanction:false,rag:p.rag==="amber"?"green":p.rag}:p));
    showToast("Sanctioned ✓","var(--green)");
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

  const stats=[{label:"Total",value:activeProjects.length},{label:"Engineering",value:activeProjects.filter(p=>p.projectTag==="engineering").length,color:"var(--blue)"},{label:"EB Product",value:activeProjects.filter(p=>p.projectTag==="elecbits_product").length,color:"var(--green)"},{label:"Modifier",value:activeProjects.filter(p=>p.projectTag==="modifier").length,color:"var(--purple)"},{label:"Sanctioned",value:activeProjects.filter(p=>p.sanctioned).length,color:"var(--green)"},{label:"Pending",value:activeProjects.filter(p=>p.pendingSanction&&!p.sanctioned).length,color:"var(--amber)"},{label:"Rejected",value:rejected.length,color:"var(--red)"}];
  const NB=({id,label})=><button onClick={()=>setView(id)} style={{padding:"7px 12px",background:"none",border:"none",cursor:"pointer",fontSize:10,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",color:view===id?"var(--acc)":"var(--txt2)",borderBottom:`2px solid ${view===id?"var(--acc)":"transparent"}`,transition:"all .15s"}}>{label}</button>;
  const pmUsers=users.filter(u=>["sr_pm","jr_pm"].includes(u.resourceRole));
  const tmUsers=users.filter(u=>["sr_hw","jr_hw","sr_fw","jr_fw","ind_design"].includes(u.resourceRole));
  const devUsers=users.filter(u=>["tester","soldering","devops","sc","sol_arch"].includes(u.resourceRole));

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{borderBottom:"1px solid var(--bdr)",display:"flex",gap:0,padding:"0 22px",background:"var(--s1)",alignItems:"center"}}>
        <NB id="projects" label="Projects"/><NB id="resources" label="Resources"/><NB id="alerts" label="Alerts"/>
        <div style={{marginLeft:"auto"}}><Btn v="ghost" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>setShowSettings(true)}>⚙ Settings</Btn></div>
      </div>
      <div style={{flex:1,overflow:"auto",padding:22}}>
        {view==="projects"&&<>
          {activeProjects.filter(p=>p.pendingSanction&&!p.sanctioned).length>0&&(
            <div style={{marginBottom:18,padding:"14px 16px",background:"var(--amber)08",border:"1px solid var(--amber)35",borderRadius:10}}>
              <div style={{fontSize:10,fontWeight:700,color:"var(--amber)",fontFamily:"IBM Plex Mono",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>
                ⏳ Sanction Requests ({projects.filter(p=>p.pendingSanction&&!p.sanctioned).length})
              </div>
              {activeProjects.filter(p=>p.pendingSanction&&!p.sanctioned).map(p=>{const pm=getPM(p,users);return(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:"var(--s1)",borderRadius:8,marginBottom:6,border:"1px solid var(--amber)20"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:"var(--txt)"}}>{p.name}</div>
                    <div style={{fontSize:11,color:"var(--txt2)"}}>{p.projectId}{p.clientName&&` · ${p.clientName}`} · {fmtDate(p.startDate)} → {fmtDate(p.endDate)}</div>
                    {pm&&<div style={{fontSize:10,color:"var(--txt3)",marginTop:2}}>PM: {pm.name}</div>}
                  </div>
                  <Btn v="ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>openProject(p)}>View</Btn>
                  <Btn v="success" style={{fontSize:11,padding:"5px 12px"}} onClick={()=>sanctionProject(p.id)}>✓ Sanction</Btn>
                  <Btn v="danger" style={{fontSize:11,padding:"5px 10px"}} onClick={()=>{const reason=prompt("Rejection reason (optional):")||"";rejectProjectInDB(p.id,reason,currentUser.id).then(()=>fetchProjects());setProjects(ps=>ps.map(x=>x.id===p.id?{...x,pendingSanction:false,sanctioned:false,rejected:true,rejectedAt:todayStr(),rejectedReason:reason}:x));showToast("Project rejected","var(--red)");}}>✗ Reject</Btn>
                </div>
              );})}
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:18}}>{stats.map(s=><Stat key={s.label} {...s}/>)}</div>
          <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
            <Inp placeholder="Search projects…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:180,fontSize:12}}/>
            <Btn v={showFilters?"secondary":"ghost"} style={{fontSize:11,padding:"6px 12px"}} onClick={()=>setShowFilters(!showFilters)}>{showFilters?"▲ Hide":"▼ Filters"}</Btn>
            <div style={{marginLeft:"auto",display:"flex",gap:8}}>
              {projects.filter(p=>p.pendingSanction&&!p.sanctioned).length>0&&<Pill label={`${activeProjects.filter(p=>p.pendingSanction&&!p.sanctioned).length} pending sanction`} color="var(--amber)"/>}
              <Btn onClick={()=>setShowAdd(true)}>+ New Project</Btn>
            </div>
          </div>
          {showFilters&&(
            <div style={{background:"var(--s2)",border:"1px solid var(--bdr)",borderRadius:10,padding:16,marginBottom:14}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:14,marginBottom:12}}>
                <div>
                  <span style={{fontSize:10,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"IBM Plex Mono"}}>Project Type</span>
                  {PROJECT_TAGS.map(t=>(
                    <label key={t.key} style={{display:"flex",alignItems:"center",gap:7,padding:"4px 0",cursor:"pointer"}}>
                      <input type="checkbox" checked={tagFilters.includes(t.key)} onChange={e=>setTagFilters(prev=>e.target.checked?[...prev,t.key]:prev.filter(x=>x!==t.key))} style={{accentColor:t.color}}/>
                      <span style={{fontSize:12,color:"var(--txt)"}}>{t.label}</span>
                      <span style={{fontSize:10,color:"var(--txt3)",marginLeft:"auto",fontFamily:"IBM Plex Mono"}}>{projects.filter(p=>p.projectTag===t.key).length}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <span style={{fontSize:10,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"IBM Plex Mono"}}>Sanction Status</span>
                  {[{v:"All",l:"All"},{v:"Sanctioned",l:"Sanctioned ✓"},{v:"Pending",l:"Pending ⏳"}].map(o=>(
                    <label key={o.v} style={{display:"flex",alignItems:"center",gap:7,padding:"4px 0",cursor:"pointer"}}>
                      <input type="radio" name="sanction" checked={sanctionFilter===o.v} onChange={()=>setSanctionFilter(o.v)}/>
                      <span style={{fontSize:12,color:"var(--txt)"}}>{o.l}</span>
                    </label>
                  ))}
                </div>
                <div>
                  <span style={{fontSize:10,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"IBM Plex Mono"}}>Project Manager</span>
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
                  <span style={{fontSize:10,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"IBM Plex Mono"}}>Technical Manager</span>
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
                  <span style={{fontSize:10,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"IBM Plex Mono"}}>Developer / Resource</span>
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
                  <span style={{fontSize:10,fontWeight:700,color:"var(--txt2)",letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"IBM Plex Mono"}}>Date Range</span>
                  <div style={{marginBottom:8}}><div style={{fontSize:10,color:"var(--txt3)",marginBottom:3}}>Start From</div><Inp type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{fontSize:11}}/></div>
                  <div><div style={{fontSize:10,color:"var(--txt3)",marginBottom:3}}>End Before</div><Inp type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{fontSize:11}}/></div>
                </div>
              </div>
              {(tagFilters.length>0||pmFilters.length>0||tmFilters.length>0||devFilters.length>0||sanctionFilter!=="All"||dateFrom||dateTo)&&(
                <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid var(--bdr)",alignItems:"center"}}>
                  <span style={{fontSize:10,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>ACTIVE:</span>
                  {tagFilters.map(t=><span key={t} style={{padding:"2px 8px",borderRadius:99,fontSize:10,background:"var(--blue)15",color:"var(--blue)",border:"1px solid var(--blue)30"}}>{tagLabel(t)} ×</span>)}
                  {sanctionFilter!=="All"&&<span style={{padding:"2px 8px",borderRadius:99,fontSize:10,background:"var(--amber)15",color:"var(--amber)",border:"1px solid var(--amber)30"}}>{sanctionFilter} ×</span>}
                  {pmFilters.map(id=>{const u=users.find(x=>String(x.id)===id);return u?<span key={id} style={{padding:"2px 8px",borderRadius:99,fontSize:10,background:"var(--coral)15",color:"var(--coral)",border:"1px solid var(--coral)30"}}>PM: {u.name} ×</span>:null;})}
                  {tmFilters.map(id=>{const u=users.find(x=>String(x.id)===id);return u?<span key={id} style={{padding:"2px 8px",borderRadius:99,fontSize:10,background:"var(--purple)15",color:"var(--purple)",border:"1px solid var(--purple)30"}}>TM: {u.name} ×</span>:null;})}
                  {devFilters.map(id=>{const u=users.find(x=>String(x.id)===id);return u?<span key={id} style={{padding:"2px 8px",borderRadius:99,fontSize:10,background:"var(--green)15",color:"var(--green)",border:"1px solid var(--green)30"}}>Dev: {u.name} ×</span>:null;})}
                  <Btn v="secondary" style={{fontSize:10,padding:"2px 10px",marginLeft:"auto"}} onClick={()=>{setTagFilters([]);setSanctionFilter("All");setPmFilters([]);setTmFilters([]);setDevFilters([]);setDateFrom("");setDateTo("");setPmNoProjectsAlert(null);}}>Clear All</Btn>
                </div>
              )}
            </div>
          )}
          {pmNoProjectsAlert&&(
            <div style={{marginBottom:12,padding:"14px 16px",background:"var(--amber)08",border:"1px solid var(--amber)40",borderRadius:8,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>📭</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13,color:"var(--txt)",marginBottom:2}}>{pmNoProjectsAlert} has no projects assigned</div>
                <div style={{fontSize:11,color:"var(--txt2)"}}>This PM is not currently assigned to any project as a PM or Senior PM. You can assign them via the Add/Edit Project form.</div>
              </div>
              <button onClick={()=>setPmNoProjectsAlert(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt3)",fontSize:18,padding:"0 4px",lineHeight:1}}>×</button>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 90px 110px 44px",gap:8,padding:"5px 12px",fontSize:10,color:"var(--txt3)",fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",fontFamily:"IBM Plex Mono",marginBottom:4}}>
            <span>Project</span><span>Tag</span><span>Start</span><span>End</span><span>PM</span><span>Progress</span><span>Sanction</span><span/>
          </div>
          {filtered.length===0&&(pmFilters.length>0||tmFilters.length>0||devFilters.length>0||tagFilters.length>0)&&(
            <div style={{padding:"24px",textAlign:"center",background:"var(--s2)",borderRadius:8,color:"var(--txt3)",fontSize:13}}>
              <div style={{fontSize:24,marginBottom:8}}>📭</div>
              <div style={{fontWeight:700,color:"var(--txt2)"}}>No projects match the selected filters</div>
              <div style={{fontSize:11,marginTop:4}}>Try adjusting or clearing the active filters above.</div>
            </div>
          )}
          {filtered.map(p=>{
            const dl=daysLeft(p.endDate);const pm=getPM(p,users);
            const cl=p.checklists||{};
            const tot=Object.values(cl).reduce((a,v)=>{if(Array.isArray(v))return a+v.reduce((b,c)=>b+(c.items||[]).length,0);return a+(v.items||[]).length;},0);
            const dn=Object.values(cl).reduce((a,v)=>{if(Array.isArray(v))return a+v.reduce((b,c)=>b+(c.items||[]).filter(x=>x.tmApproval==="Approved"&&x.pmApproval==="Approved"&&x.clientApproval==="Approved").length,0);return a+(v.items||[]).filter(x=>x.tmApproval==="Approved"&&x.pmApproval==="Approved"&&x.clientApproval==="Approved").length;},0);
            const pct=tot?Math.round((dn/tot)*100):0;
            return(
              <div key={p.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 90px 110px 44px",gap:8,padding:"11px 12px",background:"var(--s1)",border:`1px solid ${p.pendingSanction&&!p.sanctioned?"var(--amber)30":"var(--bdr)"}`,borderRadius:7,marginBottom:4,alignItems:"center",transition:"all .15s"}}>
                <div onClick={()=>openProject(p)} style={{cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.querySelector("div").style.color="var(--acc)"} onMouseLeave={e=>e.currentTarget.querySelector("div").style.color="var(--txt)"}>
                  <div style={{fontWeight:700,fontSize:13,color:"var(--txt)",marginBottom:2,transition:"color .15s"}}>{p.name}</div>
                  <div style={{fontSize:10,color:"var(--txt2)"}}>{p.projectId}{p.clientName&&` · ${p.clientName}`}{p.pendingSanction&&!p.sanctioned&&<span style={{color:"var(--amber)",marginLeft:5}}>⋯ Pending Sanction</span>}</div>
                </div>
                {p.projectTag?<Tag label={tagLabel(p.projectTag)} color={tagColor(p.projectTag)}/>:<span/>}
                <span style={{fontSize:11,color:"var(--txt2)"}}>{fmtDate(p.startDate)}</span>
                <span style={{fontSize:11,color:dl<7?"var(--red)":dl<14?"var(--amber)":"var(--txt2)"}}>{fmtDate(p.endDate)}</span>
                <div style={{display:"flex",alignItems:"center",gap:5}}>{pm&&<><Av uid={pm.id} size={20} users={users}/><span style={{fontSize:11,color:"var(--txt2)"}}>{pm.name}</span></>}</div>
                <Bar val={pct} thin/>
                <div onClick={e=>e.stopPropagation()}>
                  {p.sanctioned
                    ?<Btn v="ghost" style={{fontSize:10,padding:"4px 8px",width:"100%",justifyContent:"center",color:"var(--green)",borderColor:"var(--green)40"}} onClick={()=>unsanctionProject(p.id)}>✓ Sanctioned</Btn>
                    :<Btn v="success" style={{fontSize:10,padding:"4px 8px",width:"100%",justifyContent:"center"}} onClick={()=>sanctionProject(p.id)}>Sanction</Btn>}
                </div>
                <div onClick={e=>e.stopPropagation()} style={{display:"flex",justifyContent:"center"}}>
                  <Btn v="danger" style={{fontSize:10,padding:"4px 8px"}} onClick={()=>{if(window.confirm(`Delete "${p.name}"? This cannot be undone.`)){setProjects(ps=>ps.filter(x=>x.id!==p.id));showToast(`${p.name} deleted`,"var(--red)");}}} title="Delete project">🗑</Btn>
                </div>
              </div>
            );
          })}
          {rejected.length>0&&(
            <div style={{marginTop:18,borderTop:"1px solid var(--bdr)",paddingTop:14,display:"flex",justifyContent:"center"}}>
              <button onClick={()=>setShowRejected(true)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",background:"var(--red)08",border:"1px solid var(--red)30",borderRadius:8,cursor:"pointer",color:"var(--red)",fontSize:12,fontWeight:700,fontFamily:"Manrope",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.background="var(--red)14";}} onMouseLeave={e=>{e.currentTarget.style.background="var(--red)08";}}>
                <span style={{fontSize:16}}>🚫</span>
                <span>{rejected.length} Rejected Project{rejected.length>1?"s":""}</span>
                <span style={{fontSize:10,color:"var(--red)",opacity:0.7,fontFamily:"IBM Plex Mono"}}>→ View</span>
              </button>
            </div>
          )}
        </>}
        {view==="resources"&&<ResourcesView projects={projects} users={users} setUsers={setUsers} isAdmin={true} currentUser={currentUser}/>}
        {view==="alerts"&&<AlertsView projects={projects} currentUser={currentUser} users={users}/>}
      </div>

      {showRejected&&(
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
          <div style={{position:"absolute",inset:0,background:"#00000066",backdropFilter:"blur(2px)"}} onClick={()=>setShowRejected(false)}/>
          <div style={{position:"absolute",right:0,top:0,bottom:0,width:"min(640px,95vw)",background:"var(--s1)",borderLeft:"1px solid var(--bdr)",display:"flex",flexDirection:"column",animation:"fadeUp .2s ease",boxShadow:"-4px 0 32px #0006"}}>
            <div style={{padding:"16px 22px",borderBottom:"1px solid var(--bdr)",display:"flex",alignItems:"center",gap:10,background:"var(--red)08"}}>
              <span style={{fontSize:20}}>🚫</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:15,color:"var(--red)"}}>Rejected Projects</div>
                <div style={{fontSize:11,color:"var(--txt3)"}}>{rejected.length} project{rejected.length>1?"s":""} rejected — not proceeding</div>
              </div>
              <button onClick={()=>setShowRejected(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt2)",fontSize:22,padding:"0 4px",lineHeight:1}}>×</button>
            </div>
            <div style={{flex:1,overflow:"auto",padding:"16px 22px"}}>
              <div style={{fontSize:11,color:"var(--txt3)",marginBottom:16,padding:"8px 12px",background:"var(--s2)",borderRadius:7}}>
                These projects were rejected during sanction review. They can be reinstated by a Super Admin if needed.
              </div>
              {rejected.map(p=>{
                const pm=getPM(p,users);
                return(
                  <div key={p.id} style={{padding:"14px 16px",background:"var(--card)",border:"1px solid var(--red)20",borderRadius:10,marginBottom:10,borderLeft:"3px solid var(--red)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,gap:10}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:"var(--txt)",marginBottom:3}}>{p.name}</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                          <Tag label={p.projectId} color="var(--txt3)"/>
                          {p.projectTag&&<Tag label={tagLabel(p.projectTag)} color={tagColor(p.projectTag)}/>}
                          {pm&&<div style={{display:"flex",alignItems:"center",gap:4}}><Av uid={pm.id} size={16} users={users}/><span style={{fontSize:10,color:"var(--txt2)"}}>{pm.name}</span></div>}
                        </div>
                      </div>
                      <Pill label="Rejected" color="var(--red)" small/>
                    </div>
                    <div style={{display:"flex",gap:16,fontSize:11,color:"var(--txt2)",marginBottom:8}}>
                      {p.clientName&&<span>Client: <strong>{p.clientName}</strong></span>}
                      {p.startDate&&<span>Period: {fmtDate(p.startDate)} → {fmtDate(p.endDate)}</span>}
                    </div>
                    <div style={{padding:"8px 12px",background:"var(--red)06",border:"1px solid var(--red)20",borderRadius:6,marginBottom:10}}>
                      <div style={{fontSize:10,fontWeight:700,color:"var(--red)",fontFamily:"IBM Plex Mono",marginBottom:3}}>REJECTION DETAILS</div>
                      <div style={{fontSize:11,color:"var(--txt2)"}}>{p.rejectedReason||"No reason recorded."}</div>
                      {p.rejectedAt&&<div style={{fontSize:10,color:"var(--txt3)",marginTop:3,fontFamily:"IBM Plex Mono"}}>Rejected on: {fmtDate(p.rejectedAt)}</div>}
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <Btn v="ghost" style={{fontSize:11,padding:"5px 12px"}} onClick={()=>openProject(p)}>👁 View Details</Btn>
                      <Btn v="success" style={{fontSize:11,padding:"5px 12px"}} onClick={()=>{
                        setProjects(ps=>ps.map(x=>x.id===p.id?{...x,rejected:false,rejectedReason:"",rejectedAt:"",pendingSanction:true}:x));
                        showToast(`${p.name} reinstated — now pending sanction`,"var(--green)");
                      }}>↩ Reinstate</Btn>
                      <Btn v="danger" style={{fontSize:11,padding:"5px 12px"}} onClick={()=>{
                        if(window.confirm(`Permanently delete "${p.name}"? This cannot be undone.`)){
                          setProjects(ps=>ps.filter(x=>x.id!==p.id));
                          showToast(`${p.name} deleted permanently`,"var(--red)");
                        }
                      }}>🗑 Delete</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{padding:"12px 22px",borderTop:"1px solid var(--bdr)",background:"var(--s2)",display:"flex",justifyContent:"flex-end"}}>
              <Btn v="secondary" onClick={()=>setShowRejected(false)}>Close</Btn>
            </div>
          </div>
        </div>
      )}

      {showAdd&&<Modal title={prefillForm?"New Project — from Major Change":"New Project"} onClose={()=>{setShowAdd(false);setPrefillForm(null);}} wide><ProjectForm initial={prefillForm||undefined} onSave={saveProject} onClose={()=>{setShowAdd(false);setPrefillForm(null);}} allProjects={projects} users={users} isAdmin={true}/></Modal>}
      {showSettings&&<PersonalSettingsModal user={currentUser} onClose={()=>setShowSettings(false)} isDark={isDark} toggleTheme={()=>{}} allProjects={projects} onSave={saveUserSettings} showToast={showToast}/>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

export default SuperAdminView;
