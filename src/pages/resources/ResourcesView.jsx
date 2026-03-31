// ResourcesView — contains team view, resource planning, efficiency, and hiring plan
// All sub-views are kept inline as in the original monolithic file
import { useState, useRef, useEffect } from "react";
import { RESOURCE_ROLES, HIRING_BASE, CHECKLIST_DEFS, todayStr, fmtDate, fmtShort, UNIQ, initials, getUser, nonAdmins, userCap, activeProjs } from "../../lib/constants.jsx";
import { supabase } from "../../lib/supabase.js";
import { Btn, Inp, Sel, TA, Lbl, Tag, Pill, Bar, Card, Modal, Av, SH, Toast } from "../../components/ui/index.jsx";
import HiringPlanView from "./HiringPlanView.jsx";
import AddResourceModal from "./AddResourceModal.jsx";

const ResourcesView=({projects,users,setUsers,isAdmin,currentUser})=>{
  const [subView,setSubView]=useState("team");
  const [roleFilter,setRoleFilter]=useState("all");
  const [deptFilter,setDeptFilter]=useState("all");
  const [avFrom,setAvFrom]=useState(todayStr());
  const [avTo,setAvTo]=useState(()=>{const d=new Date();d.setMonth(d.getMonth()+2);return d.toISOString().slice(0,10);});
  const [personModal,setPersonModal]=useState(null);
  const [showAddResource,setShowAddResource]=useState(false);
  const [reminderModal,setReminderModal]=useState(null);
  const [editingUser,setEditingUser]=useState(null);
  const [editDraft,setEditDraft]=useState({});
  const [toast,setToast]=useState(null);
  const showToast=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2600);};

  const members=nonAdmins(users);
  const DEPT_LIST=["Hardware","Firmware","Industrial Design","Testing","Project Management","Supply Chain","DevOps","Solution Architecture","Soldering & Testing","Management"];
  const DEPT_ROLES={
    Hardware:["sr_hw","jr_hw"],Firmware:["sr_fw","jr_fw"],"Industrial Design":["ind_design"],
    Testing:["tester"],"Project Management":["sr_pm","jr_pm"],"Supply Chain":["sc"],
    DevOps:["devops"],"Solution Architecture":["sol_arch"],"Soldering & Testing":["soldering"],
    Management:["sr_pm"]
  };

  const filtered=members.filter(m=>{
    const ri=RESOURCE_ROLES.find(r=>r.key===m.resourceRole);
    if(roleFilter!=="all"&&m.resourceRole!==roleFilter)return false;
    if(deptFilter!=="all"){
      const userDept=(m.dept||"").toLowerCase();
      const roleDept=(ri?.label||"").toLowerCase();
      const filterLower=deptFilter.toLowerCase();
      if(!userDept.includes(filterLower)&&!roleDept.includes(filterLower))return false;
    }
    return true;
  });

  const addResource=async(newUser)=>{
    const{data,error}=await supabase.from("users").insert({
      id:            newUser.id,
      name:          newUser.name,
      email:         newUser.email,
      role:          newUser.role||"developer",
      login_type:    newUser.loginType||newUser.role||"developer",
      dept:          newUser.dept||"",
      resource_role: newUser.resourceRole,
      max_projects:  newUser.maxProjects||2,
      project_tags:  newUser.projectTags||["engineering"],
      skills:        newUser.skills||[],
      tags:          newUser.tags||[],
      avatar:        newUser.avatar||newUser.name?.slice(0,2).toUpperCase()||"??",
    }).select("*,holidays!holidays_user_id_fkey(*)").single();
    if(error){alert("Failed to add resource: "+error.message);return;}
    const shaped={...data,resourceRole:data.resource_role,loginType:data.login_type,maxProjects:data.max_projects,projectTags:data.project_tags||[],skills:data.skills||[],holidays:data.holidays||[]};
    setUsers(prev=>[...prev,shaped]);
    showToast(`${newUser.name} added ✓`,"var(--green)");
  };
  const saveUserEdit=async(uid)=>{
    const{data,error}=await supabase.from("users").update({
      name:          editDraft.name,
      dept:          editDraft.dept,
      resource_role: editDraft.resourceRole,
      max_projects:  editDraft.maxProjects,
      project_tags:  editDraft.projectTags,
      skills:        editDraft.skills,
      role:          editDraft.role,
      login_type:    editDraft.loginType||editDraft.role,
    }).eq("id",uid).select("*,holidays!holidays_user_id_fkey(*)").single();
    if(error){alert("Update failed: "+error.message);return;}
    const shaped={...data,resourceRole:data.resource_role,loginType:data.login_type,maxProjects:data.max_projects,projectTags:data.project_tags||[],skills:data.skills||[],holidays:data.holidays||[]};
    setUsers(prev=>prev.map(u=>u.id===uid?shaped:u));
    setEditingUser(null);
    showToast("Resource updated ✓","var(--green)");
  };

  const pendingHolidays=users.flatMap(u=>(u.holidays||[]).filter(h=>h.status==="pending").map(h=>({...h,userName:u.name,userId:u.id})));
  const approveHol=async(userId,hid,status)=>{
    const{error}=await supabase.from("holidays").update({
      status,
      approved_by: currentUser.id,
      approved_at: new Date().toISOString(),
    }).eq("id",hid);
    if(error){alert("Failed: "+error.message);return;}
    setUsers(prev=>prev.map(u=>u.id===userId?{...u,holidays:(u.holidays||[]).map(h=>h.id===hid?{...h,status}:h)}:u));
    showToast(status==="approved"?"Holiday approved ✓":"Rejected","var(--green)");
  };

  const NB=({id,label})=><button onClick={()=>setSubView(id)} style={{padding:"8px 14px",background:"none",border:"none",cursor:"pointer",fontSize:14,fontWeight:500,color:subView===id?"#2563eb":"#64748b",borderBottom:`2px solid ${subView===id?"#2563eb":"transparent"}`,transition:"all .15s"}}>{label}</button>;

  return(
    <div style={{flex:1,overflow:"auto",padding:22}}>
      {isAdmin&&pendingHolidays.length>0&&(
        <div style={{marginBottom:18,padding:"14px 16px",background:"var(--amber)08",border:"1px solid var(--amber)30",borderRadius:10}}>
          <SH title={`🌴 Holiday Approval Requests (${pendingHolidays.length})`} color="var(--amber)"/>
          {pendingHolidays.map(h=>(
            <div key={h.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"var(--s1)",borderRadius:7,marginBottom:6}}>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:12,color:"var(--txt)"}}>{h.userName}</div><div style={{fontSize:11,color:"var(--txt2)"}}>{fmtDate(h.date)} · {h.reason}</div></div>
              <Btn v="success" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>approveHol(h.userId,h.id,"approved")}>Approve</Btn>
              <Btn v="danger" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>approveHol(h.userId,h.id,"rejected")}>Reject</Btn>
            </div>
          ))}
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:0}}>
        <div style={{display:"flex",gap:2,borderBottom:"1px solid var(--bdr)",flex:1}}>
          <NB id="team" label="Team View"/>
          <NB id="planning" label="Resource Planning"/>
          <NB id="efficiency" label="Efficiency"/>
          <NB id="hiring" label="Hiring Plan"/>
        </div>
        {isAdmin&&<Btn v="primary" style={{fontSize:11,padding:"5px 12px",marginLeft:12,flexShrink:0}} onClick={()=>setShowAddResource(true)}>+ Add Resource</Btn>}
      </div>
      <div style={{height:14}}/>

      {(subView==="team"||subView==="planning")&&(
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div><Lbl>Role</Lbl><Sel value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} style={{width:175}}><option value="all">All Roles</option>{["senior","junior","shared"].map(tier=><optgroup key={tier} label={tier.charAt(0).toUpperCase()+tier.slice(1)}>{RESOURCE_ROLES.filter(r=>r.tier===tier).map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</optgroup>)}</Sel></div>
          <div><Lbl>Department</Lbl><Sel value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} style={{width:175}}>
            <option value="all">All Departments</option>
            {DEPT_LIST.map(d=><option key={d} value={d}>{d}</option>)}
          </Sel></div>
          {subView==="planning"&&<>
            <div><Lbl>Available From</Lbl><Inp type="date" value={avFrom} onChange={e=>setAvFrom(e.target.value)} style={{width:150}}/></div>
            <div><Lbl>Available To</Lbl><Inp type="date" value={avTo} onChange={e=>setAvTo(e.target.value)} style={{width:150}}/></div>
          </>}
        </div>
      )}

      {subView==="team"&&(
        <div style={{overflow:"auto",border:"1px solid var(--bdr)",borderRadius:8}}>
          <table>
            <thead><tr>
              <th>Name</th><th>Role</th><th>Dept</th><th>Skills / Tags</th>
              <th>Active Projects</th><th>Holidays</th>
              <th style={{width:70}}>Cap</th>
              <th>Status</th>
              {isAdmin&&<th style={{width:90}}>Actions</th>}
            </tr></thead>
            <tbody>{filtered.map(m=>{
              const ri=RESOURCE_ROLES.find(r=>r.key===m.resourceRole);
              const active=activeProjs(m.id,projects);const cap=userCap(m);const over=active.length>=cap;
              const mHols=m.holidays||[];
              const mPending=mHols.filter(h=>h.status==="pending");
              const mApproved=mHols.filter(h=>h.status==="approved");
              const isEditing=editingUser===m.id;
              const draftDept=editDraft.dept||m.dept||"";
              const deptRoleKeys=DEPT_ROLES[draftDept]||RESOURCE_ROLES.map(r=>r.key);

              if(isEditing&&isAdmin){
                return(
                  <tr key={m.id} style={{background:"var(--acc)06",borderTop:"2px solid var(--acc)40"}}>
                    <td><input value={editDraft.name||""} onChange={e=>setEditDraft(d=>({...d,name:e.target.value}))} style={{background:"var(--bg)",border:"1px solid var(--bdr)",borderRadius:5,padding:"4px 7px",fontSize:12,color:"var(--txt)",width:"100%",outline:"none"}}/></td>
                    <td><Sel value={editDraft.resourceRole||m.resourceRole} onChange={e=>setEditDraft(d=>({...d,resourceRole:e.target.value}))} style={{fontSize:11,padding:"3px 5px"}}>{RESOURCE_ROLES.filter(r=>deptRoleKeys.includes(r.key)).map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</Sel></td>
                    <td><Sel value={editDraft.dept||m.dept||""} onChange={e=>setEditDraft(d=>({...d,dept:e.target.value,resourceRole:DEPT_ROLES[e.target.value]?.[0]||d.resourceRole}))} style={{fontSize:11,padding:"3px 5px"}}><option value="">— Dept —</option>{DEPT_LIST.map(d=><option key={d} value={d}>{d}</option>)}</Sel></td>
                    <td>
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {[{key:"engineering",label:"Engineering",color:"var(--blue)"},{key:"elecbits_product",label:"EB Product",color:"var(--green)"},{key:"modifier",label:"Modifier",color:"var(--purple)"}].map(pt=>{
                          const tags=editDraft.projectTags||m.projectTags||["engineering"];
                          const active2=tags.includes(pt.key);
                          return(<button key={pt.key} onClick={()=>{const cur=editDraft.projectTags||m.projectTags||["engineering"];const next=active2?cur.filter(x=>x!==pt.key):[...cur,pt.key];setEditDraft(d=>({...d,projectTags:next.length?next:cur}));}} style={{padding:"2px 7px",borderRadius:4,border:"1px solid "+(active2?pt.color:"var(--bdr)"),background:active2?pt.color+"18":"transparent",color:active2?pt.color:"var(--txt3)",fontSize:9,cursor:"pointer",fontWeight:700,textAlign:"left"}}>{active2?"✓ ":""}{pt.label}</button>);
                        })}
                      </div>
                    </td>
                    <td style={{fontSize:10,color:"var(--txt3)"}}>{active.length} project{active.length!==1?"s":""}</td>
                    <td style={{fontSize:10}}>{mPending.length>0&&<div style={{color:"var(--amber)"}}>⏳ {mPending.length}</div>}{mApproved.length>0&&<div style={{color:"var(--green)"}}>✓ {mApproved.length}</div>}</td>
                    <td><input type="number" min="1" max="10" value={editDraft.maxProjects??cap} onChange={e=>setEditDraft(d=>({...d,maxProjects:Number(e.target.value)}))} style={{width:44,background:"var(--bg)",border:"1px solid var(--acc)",borderRadius:4,color:"var(--acc)",padding:"3px 5px",fontSize:12,textAlign:"center",outline:"none",fontFamily:"IBM Plex Mono",fontWeight:700}}/></td>
                    <td><Pill label={over?"At Cap":active.length?"Deployed":"Available"} color={over?"var(--red)":active.length?"var(--amber)":"var(--green)"} small/></td>
                    <td>
                      <div style={{display:"flex",gap:4,flexDirection:"column"}}>
                        <div style={{display:"flex",gap:4}}>
                          <Btn v="success" style={{fontSize:10,padding:"3px 8px"}} onClick={()=>saveUserEdit(m.id)}>✓ Save</Btn>
                          <Btn v="secondary" style={{fontSize:10,padding:"3px 8px"}} onClick={()=>setEditingUser(null)}>✗</Btn>
                        </div>
                        <Btn v="danger" style={{fontSize:10,padding:"3px 6px",width:"100%",justifyContent:"center"}} onClick={()=>{
                          if(window.confirm(`Remove ${m.name} from the team?\nThey will be unassigned from all projects.`)){
                            (async()=>{const{error}=await supabase.from("users").delete().eq("id",m.id);if(error){alert("Delete failed: "+error.message);return;}setUsers(prev=>prev.filter(u=>u.id!==m.id));})();
                            setEditingUser(null);showToast(`${m.name} removed`,"var(--red)");
                          }
                        }}>🗑 Remove</Btn>
                      </div>
                    </td>
                  </tr>
                );
              }
              return(<tr key={m.id}>
                <td><button onClick={()=>setPersonModal(m)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--acc)",display:"flex",alignItems:"center",gap:8,padding:0,fontSize:12,fontWeight:600}}><Av uid={m.id} size={26} users={users}/>{m.name}</button></td>
                <td>{ri&&<Tag label={ri.label} color={ri.color}/>}</td>
                <td style={{fontSize:11,color:"var(--txt2)"}}>{m.dept||ri?.label||"—"}</td>
                <td><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                  {(m.projectTags||[]).map(t=>{const colors={engineering:"var(--blue)",elecbits_product:"var(--green)",modifier:"var(--purple)"};const labels={engineering:"Engineering",elecbits_product:"EB Product",modifier:"Modifier"};return <span key={t} style={{padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700,background:(colors[t]||"var(--acc)")+"18",color:colors[t]||"var(--acc)",border:"1px solid "+(colors[t]||"var(--acc)")+"40"}}>{labels[t]||t}</span>;})}
                  {!(m.projectTags||[]).length&&<span style={{fontSize:10,color:"var(--txt3)"}}>—</span>}
                </div></td>
                <td>{active.length>0?active.map(p=>{const a=p.teamAssignments?.find(x=>x.userId===m.id);return(<div key={p.id} style={{marginBottom:3}}><span style={{fontSize:11,fontWeight:600}}>{p.name}</span><span style={{fontSize:10,color:"var(--txt3)",marginLeft:5,fontFamily:"IBM Plex Mono"}}>{fmtShort(a?.startDate)}–{fmtShort(a?.endDate||p.endDate)}</span></div>)}):<span style={{fontSize:11,color:"var(--txt3)"}}>None</span>}</td>
                <td style={{fontSize:10}}>{mPending.length>0&&<div style={{color:"var(--amber)",marginBottom:2}}>⏳ {mPending.length} pending</div>}{mApproved.length>0&&<div style={{color:"var(--green)"}}>✓ {mApproved.length} approved</div>}{mPending.length===0&&mApproved.length===0&&<span style={{color:"var(--txt3)"}}>—</span>}</td>
                <td style={{textAlign:"center",fontFamily:"IBM Plex Mono",color:over?"var(--red)":"var(--green)",fontWeight:700}}>{active.length}/{cap}</td>
                <td><Pill label={over?"At Capacity":active.length?"Deployed":"Available"} color={over?"var(--red)":active.length?"var(--amber)":"var(--green)"} small/></td>
                {isAdmin&&<td><div style={{display:"flex",gap:4}}><Btn v="ghost" style={{fontSize:10,padding:"3px 7px"}} onClick={()=>{setEditingUser(m.id);setEditDraft({name:m.name,resourceRole:m.resourceRole,dept:m.dept||"",maxProjects:m.maxProjects||cap,projectTags:m.projectTags||["engineering"]});}}>✏</Btn><Btn v="ghost" style={{fontSize:10,padding:"3px 7px"}} onClick={()=>setReminderModal(m)}>📨</Btn></div></td>}
              </tr>);
            })}</tbody>
          </table>
        </div>
      )}

      {subView==="planning"&&(
        <div>
          <div style={{fontSize:11,color:"var(--txt2)",marginBottom:10,padding:"8px 12px",background:"var(--s2)",borderRadius:7}}>
            Showing resources with <strong>any availability</strong> in the period <strong>{fmtDate(avFrom)}</strong> → <strong>{fmtDate(avTo)}</strong>.
          </div>
          <div style={{overflow:"auto",border:"1px solid var(--bdr)",borderRadius:8}}>
            <table>
              <thead><tr><th>Resource</th><th>Role</th><th>Available Window in Period</th><th>Deployed Projects</th><th>Holidays in Period</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map(m=>{
                  const ri=RESOURCE_ROLES.find(r=>r.key===m.resourceRole);
                  const deployedInRange=projects.filter(p=>p.teamAssignments?.some(a=>a.userId===m.id&&a.startDate<=avTo&&(a.endDate||"9999")>=avFrom));
                  const approvedHols2=(m.holidays||[]).filter(h=>h.status==="approved"&&h.date>=avFrom&&h.date<=avTo);
                  const pendingHolsInRange=(m.holidays||[]).filter(h=>h.status==="pending"&&h.date>=avFrom&&h.date<=avTo);
                  const isBusy=deployedInRange.length>=(userCap(m));
                  let freeWindow="Fully free: "+fmtShort(avFrom)+" → "+fmtShort(avTo);
                  if(deployedInRange.length>0&&!isBusy)freeWindow="Partially available — check deployments";
                  if(isBusy)freeWindow="At capacity in this period";
                  return(
                    <tr key={m.id}>
                      <td><button onClick={()=>setPersonModal(m)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--acc)",display:"flex",alignItems:"center",gap:6,padding:0,fontSize:11,fontWeight:600}}><Av uid={m.id} size={22} users={users}/>{m.name}</button></td>
                      <td>{ri&&<Tag label={ri.label} color={ri.color}/>}</td>
                      <td><span style={{fontSize:11,color:isBusy?"var(--red)":deployedInRange.length?"var(--amber)":"var(--green)",fontWeight:600}}>{freeWindow}</span></td>
                      <td>{deployedInRange.length>0?deployedInRange.map(p=>{const a=p.teamAssignments?.find(x=>x.userId===m.id);return(<div key={p.id} style={{fontSize:10,marginBottom:2}}><span style={{fontWeight:600}}>{p.name}</span><span style={{color:"var(--txt3)",marginLeft:4,fontFamily:"IBM Plex Mono"}}>{fmtShort(a?.startDate)}–{fmtShort(a?.endDate||p.endDate)}</span></div>)}):<span style={{fontSize:11,color:"var(--txt3)"}}>None in range</span>}</td>
                      <td>{approvedHols2.length>0||pendingHolsInRange.length>0?(<div>{approvedHols2.map(h=><div key={h.id} style={{fontSize:10,color:"var(--amber)",marginBottom:2}}>✓ {fmtShort(h.date)}: {h.reason}</div>)}{pendingHolsInRange.map(h=><div key={h.id} style={{fontSize:10,color:"var(--txt3)",marginBottom:2}}>⏳ {fmtShort(h.date)}: {h.reason} <em>(pending)</em></div>)}</div>):<span style={{fontSize:11,color:"var(--txt3)"}}>None</span>}</td>
                      <td><Pill label={isBusy?"At Capacity":deployedInRange.length?"Partially Deployed":"Available"} color={isBusy?"var(--red)":deployedInRange.length?"var(--amber)":"var(--green)"} small/></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView==="efficiency"&&(
        <div style={{overflow:"auto",border:"1px solid var(--bdr)",borderRadius:8}}>
          <table><thead><tr><th>Name</th><th>Role</th><th>Projects</th><th>Tasks</th><th>Fully Approved</th><th>Blocked</th><th>Completion</th></tr></thead>
          <tbody>{members.map(m=>{const ri=RESOURCE_ROLES.find(r=>r.key===m.resourceRole);let tot=0,dn=0,bl=0;projects.filter(p=>p.teamAssignments?.some(a=>a.userId===m.id)).forEach(p=>{Object.values(p.checklists||{}).forEach(cl=>{(Array.isArray(cl)?cl:[cl]).forEach(c=>{(c.items||[]).forEach(it=>{tot++;if(it.tmApproval==="Approved"&&it.pmApproval==="Approved"&&it.clientApproval==="Approved")dn++;if(it.status==="Blocked")bl++;});});});});const pct=tot?Math.round((dn/tot)*100):0;return(<tr key={m.id}><td><div style={{display:"flex",alignItems:"center",gap:8}}><Av uid={m.id} size={24} users={users}/><span style={{fontWeight:600}}>{m.name}</span></div></td><td>{ri&&<Tag label={ri.label} color={ri.color}/>}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono"}}>{projects.filter(p=>p.teamAssignments?.some(a=>a.userId===m.id)).length}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono"}}>{tot}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono",color:"var(--green)"}}>{dn}</td><td style={{textAlign:"center",fontFamily:"IBM Plex Mono",color:bl?"var(--red)":"var(--txt3)"}}>{bl}</td><td style={{width:130}}><Bar val={pct} thin/></td></tr>);})}</tbody></table>
        </div>
      )}

      {subView==="hiring"&&<HiringPlanView members={members}/>}

      {personModal&&<Modal title={personModal.name} onClose={()=>setPersonModal(null)} maxW={480}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16,padding:"14px 16px",background:"var(--s2)",borderRadius:10}}><Av uid={personModal.id} size={50} users={users}/><div><div style={{fontWeight:800,fontSize:15,marginBottom:4}}>{personModal.name}</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{RESOURCE_ROLES.find(r=>r.key===personModal.resourceRole)&&<Tag label={RESOURCE_ROLES.find(r=>r.key===personModal.resourceRole).label} color={RESOURCE_ROLES.find(r=>r.key===personModal.resourceRole).color}/>}<Tag label={personModal.email} color="var(--txt3)"/>{(personModal.tags||[]).map(t=><span key={t} style={{padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700,background:"var(--acc)15",color:"var(--acc)"}}>{t}</span>)}</div></div></div>
        <SH title="Deployed Projects"/>
        {projects.filter(p=>p.teamAssignments?.some(a=>a.userId===personModal.id)).map(p=>{const a=p.teamAssignments?.find(x=>x.userId===personModal.id);const isNow=a&&a.startDate<=todayStr()&&(a.endDate||"9999")>=todayStr();return(<div key={p.id} style={{padding:"10px 12px",background:"var(--s2)",borderRadius:7,marginBottom:6,border:`1px solid ${isNow?"var(--acc)22":"var(--bdr)"}`}}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontWeight:700,fontSize:12}}>{p.name}</div><div style={{fontSize:10,color:"var(--txt2)"}}>{a?.role}</div></div>{isNow&&<Pill label="Active" color="var(--acc)" small/>}</div><div style={{fontSize:11,marginTop:5}}><span style={{color:"var(--txt3)"}}>Period: </span>{fmtDate(a?.startDate)} → {fmtDate(a?.endDate||p.endDate)}</div></div>);})}
      </Modal>}
      {showAddResource&&<AddResourceModal onClose={()=>setShowAddResource(false)} addResource={addResource} users={users} DEPT_ROLES={DEPT_ROLES}/>}
      {reminderModal&&<Modal title={`Remind ${reminderModal.name}`} onClose={()=>setReminderModal(null)} maxW={440}><div style={{display:"flex",flexDirection:"column",gap:12}}><TA rows={3} placeholder="Message…"/><div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn v="secondary" onClick={()=>setReminderModal(null)}>Cancel</Btn><Btn v="success" onClick={()=>{showToast(`Sent to ${reminderModal.name} 📨`,"var(--blue)");setReminderModal(null);}}>Send</Btn></div></div></Modal>}
      {toast&&<Toast {...toast}/>}
    </div>
  );
};

export default ResourcesView;
