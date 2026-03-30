import { useState, useRef, useEffect, useCallback } from "react";
import { RESOURCE_ROLES, CHECKLIST_DEFS, CL_OWNERS, DEFAULT_ITEMS, canEditCL, canApprove, genProdItems, mkItem, todayStr, fmtDate, fmtShort, UNIQ, getUser } from "../../lib/constants.jsx";
import { insertNotifications, deleteNotifications } from "../../lib/db.js";
import { Btn, Inp, Sel, TA, Lbl, Tag, Pill, Bar, Card, Toast } from "../../components/ui/index.jsx";
import GanttView from "../project/GanttView.jsx";

const ChecklistPage=({def,instance,onBack,onSave,currentUser,isGantt,project,users,onRenameChecklist})=>{
  const canEdit=canEditCL(currentUser,def.key);
  const canApprv=canApprove(currentUser);
  const isDev=currentUser.role==="developer";
  const isTM=project?.teamAssignments?.some(a=>a.userId===currentUser.id&&a.role==="Senior PM");
  const canApprvTM=(item)=>{
    if(isDev)return false;
    if(canApprv)return true;
    if(isTM)return item.assigneeId===currentUser.id;
    return false;
  };
  const canApprvPM=(item)=>canApprv&&item.tmApproval==="Approved";
  const canApprvClient=(item)=>canApprv&&item.tmApproval==="Approved"&&item.pmApproval==="Approved";

  const initItems=()=>{
    if(instance?.items?.length)return instance.items.map(it=>({startDate:"",endDate:"",assigneeId:"",links:[],submittedForReview:false,...it}));
    const base=def.key==="production"?genProdItems(instance?.units||100):DEFAULT_ITEMS[def.key]||[];
    return base.map((t,i)=>mkItem(t,i));
  };
  const [items,setItems]=useState(initItems);
  const [note,setNote]=useState(instance?.note||"");
  const [auditStatus,setAuditStatus]=useState(instance?.auditStatus||"Not Reviewed");
  const [expanded,setExpanded]=useState(null);
  const [excelPending,setExcelPending]=useState(null);
  const [saved,setSaved]=useState(false);
  const fileRef=useRef();

  const upd=(id,f,v)=>{
    if(isDev){
      const item=items.find(x=>x.id===id);
      if(item&&item.assigneeId&&item.assigneeId!==currentUser.id)return;
    }
    setItems(prev=>prev.map(x=>x.id===id?{...x,[f]:v,lastUpdated:todayStr()}:x));
  };
  const addItem=()=>setItems(prev=>[...prev,mkItem("New task",Date.now())]);
  const remove=(id)=>setItems(prev=>prev.filter(x=>x.id!==id));
  const addComment=(id,title,desc)=>{if(!title)return;setItems(prev=>prev.map(x=>x.id===id?{...x,comments:[...(x.comments||[]),{id:UNIQ(),title,desc:desc||"",authorId:currentUser.id,authorName:currentUser.name,time:new Date().toISOString()}]}:x));};
  const addRoadblock=(id,title,desc)=>{if(!title)return;setItems(prev=>prev.map(x=>x.id===id?{...x,roadblocks:[...(x.roadblocks||[]),{id:UNIQ(),title,desc:desc||"",time:new Date().toISOString(),resolved:false,reportedById:currentUser.id,reportedByName:currentUser.name,resolvedById:null,resolvedByName:null,resolvedAt:null}]}:x));};
  const toggleRB=(iid,rid)=>setItems(prev=>prev.map(x=>x.id===iid?{...x,roadblocks:(x.roadblocks||[]).map(r=>r.id===rid?{...r,resolved:!r.resolved,resolvedById:!r.resolved?currentUser.id:null,resolvedByName:!r.resolved?currentUser.name:null,resolvedAt:!r.resolved?new Date().toISOString():null}:r)}:x));
  const addLink=(id,url,label)=>{if(!url)return;setItems(prev=>prev.map(x=>x.id===id?{...x,links:[...(x.links||[]),{id:UNIQ(),url,label:label||url,ts:new Date().toISOString()}]}:x));};
  const removeLink=(id,lid)=>setItems(prev=>prev.map(x=>x.id===id?{...x,links:(x.links||[]).filter(l=>l.id!==lid)}:x));

  const isFullyDone=(it)=>it.tmApproval==="Approved"&&it.pmApproval==="Approved"&&it.clientApproval==="Approved";
  const doneCount=items.filter(isFullyDone).length;
  const pct=Math.round((doneCount/Math.max(1,items.length))*100);

  const handleExcel=(e)=>{
    const file=e.target.files[0];if(!file)return;
    const isCSV=file.name.toLowerCase().endsWith('.csv')||file.name.toLowerCase().endsWith('.tsv');
    const processRows=(rows)=>{
      const dataRows=rows.length>1&&/^(task|name|item|description|sl\.?no|#|sr\.?no)/i.test(String(rows[0][0]||"").trim())?rows.slice(1):rows;
      const tasks=dataRows.map(r=>String(r[0]||"").trim()).filter(t=>t.length>0&&t!=="undefined").map(text=>({id:UNIQ(),text,mapped:"",accept:true}));
      if(tasks.length===0){setExcelPending([{id:UNIQ(),text:"No tasks found in first column",mapped:"",accept:false}]);}
      else{setExcelPending(tasks);}
    };
    if(isCSV){
      const reader=new FileReader();
      reader.onload=(evt)=>{const text=evt.target.result;const rows=text.split(/\r?\n/).filter(r=>r.trim()).map(r=>r.split(/[,\t]/).map(c=>c.replace(/^"+|"+$/g,'').trim()));processRows(rows);};
      reader.readAsText(file);
    } else {
      const reader=new FileReader();
      reader.onload=(evt)=>{
        try{
          const parseXLSX=(XLSX)=>{const wb=XLSX.read(new Uint8Array(evt.target.result),{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];processRows(XLSX.utils.sheet_to_json(ws,{header:1,defval:""}));};
          if(window.XLSX){parseXLSX(window.XLSX);}
          else{const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';script.onload=()=>parseXLSX(window.XLSX);script.onerror=()=>setExcelPending([{id:UNIQ(),text:"Could not load Excel parser — save as CSV",mapped:"",accept:false}]);document.head.appendChild(script);}
        }catch(err){setExcelPending([{id:UNIQ(),text:"Error reading Excel file — try CSV",mapped:"",accept:false}]);}
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value="";
  };
  const confirmImport=()=>{
    const accepted=(excelPending||[]).filter(p=>p.accept);
    setItems(prev=>[...prev,...accepted.map((t,i)=>mkItem(t.text,Date.now()+i))]);
    setExcelPending(null);
  };
  const [bulkToast,setBulkToast]=useState(null);
  const showBulkToast=(msg)=>{setBulkToast(msg);setTimeout(()=>setBulkToast(null),2000);};
  const save=()=>{
    onSave({items:items.map(({_ticked,...rest})=>rest),note,auditStatus});
    setSaved(true);setTimeout(()=>setSaved(false),2500);
  };

  // Auto-save: debounce writes to DB whenever items, note, or auditStatus change
  const isFirstRender=useRef(true);
  useEffect(()=>{
    if(isFirstRender.current){isFirstRender.current=false;return;}
    const tid=setTimeout(()=>{
      onSave({items:items.map(({_ticked,...rest})=>rest),note,auditStatus});
    },800);
    return()=>clearTimeout(tid);
  },[items,note,auditStatus]);

  const AP3C={Approved:"var(--green)",Rejected:"var(--red)","On Hold":"var(--amber)",Pending:"var(--txt3)"};
  const auditC={"Not Reviewed":"var(--txt3)",Approved:"var(--green)",Rejected:"var(--red)","In Review":"var(--amber)"};
  const clOwnerRoles=CL_OWNERS[def.key]||[];
  const teamMembers=(project?.teamAssignments||[]).map(a=>getUser(a.userId,users)).filter(Boolean).filter(u=>{
    if(!clOwnerRoles.length)return true;
    return clOwnerRoles.includes(u.resourceRole);
  });

  const ExpandPanel=({item})=>{
    const [cTitle,setCTitle]=useState(""); const [cDesc,setCDesc]=useState("");
    const [rbTitle,setRbTitle]=useState(""); const [rbDesc,setRbDesc]=useState("");
    const [lUrl,setLUrl]=useState(""); const [lLabel,setLLabel]=useState("");
    return(
      <tr><td colSpan={12} style={{padding:0,background:"var(--bg)"}}>
        <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,borderBottom:"2px solid var(--bdr2)"}}>
          <div>
            <div style={{fontSize:12,fontWeight:500,color:"var(--blue)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.04em"}}>💬 Comments</div>
            {(item.comments||[]).map(c=><div key={c.id} style={{padding:"8px 10px",background:"var(--s2)",borderRadius:6,marginBottom:5,borderLeft:"2px solid var(--blue)"}}><div style={{fontSize:11,fontWeight:600,color:"var(--txt)"}}>{c.title}</div>{c.desc&&<div style={{fontSize:11,color:"var(--txt2)",marginTop:2}}>{c.desc}</div>}<div style={{fontSize:9,color:"var(--txt3)",fontFamily:"'IBM Plex Mono',monospace",marginTop:3}}>{c.author||c.authorName} · {c.time}</div></div>)}
            <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:6}}>
              <Inp value={cTitle} onChange={e=>setCTitle(e.target.value)} placeholder="Comment title…" style={{fontSize:11,padding:"5px 8px"}}/>
              <div style={{display:"flex",gap:5}}><Inp value={cDesc} onChange={e=>setCDesc(e.target.value)} placeholder="Description…" style={{flex:1,fontSize:11,padding:"5px 8px"}}/><Btn v="ghost" style={{fontSize:10,padding:"4px 8px"}} onClick={()=>{addComment(item.id,cTitle,cDesc);setCTitle("");setCDesc("");}}>+</Btn></div>
            </div>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:500,color:"var(--red)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.04em"}}>⚠ Roadblocks</div>
            {(item.roadblocks||[]).map(r=><div key={r.id} style={{padding:"8px 10px",background:r.resolved?"var(--s2)":"var(--red)08",borderRadius:6,marginBottom:5,borderLeft:`2px solid ${r.resolved?"var(--txt3)":"var(--red)"}`,display:"flex",gap:8}}><input type="checkbox" checked={r.resolved} onChange={()=>toggleRB(item.id,r.id)} style={{marginTop:3,flexShrink:0}}/><div><div style={{fontSize:11,fontWeight:600,textDecoration:r.resolved?"line-through":"none",color:r.resolved?"var(--txt3)":"var(--txt)"}}>{r.title}</div>{r.desc&&<div style={{fontSize:10,color:"var(--txt2)",marginTop:1}}>{r.desc}</div>}</div></div>)}
            <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:6}}>
              <Inp value={rbTitle} onChange={e=>setRbTitle(e.target.value)} placeholder="Roadblock title…" style={{fontSize:11,padding:"5px 8px",borderColor:"var(--red)40"}}/>
              <div style={{display:"flex",gap:5}}><Inp value={rbDesc} onChange={e=>setRbDesc(e.target.value)} placeholder="Impact…" style={{flex:1,fontSize:11,padding:"5px 8px"}}/><Btn v="danger" style={{fontSize:10,padding:"4px 8px"}} onClick={()=>{addRoadblock(item.id,rbTitle,rbDesc);setRbTitle("");setRbDesc("");}}>+</Btn></div>
            </div>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:500,color:"var(--green)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.04em"}}>🔗 Links · {(item.links||[]).length}</div>
            {(item.links||[]).map(l=><div key={l.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 8px",background:"var(--s2)",borderRadius:5,marginBottom:4,borderLeft:"2px solid var(--green)"}}><div><a href={l.url} target="_blank" rel="noreferrer" style={{color:"var(--acc)",fontSize:11,textDecoration:"none"}}>{l.label}</a><div style={{fontSize:9,color:"var(--txt3)",fontFamily:"'IBM Plex Mono',monospace"}}>{l.ts}</div></div><button onClick={()=>removeLink(item.id,l.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt3)",fontSize:13}}>×</button></div>)}
            <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:6}}>
              <Inp value={lUrl} onChange={e=>setLUrl(e.target.value)} placeholder="https://…" style={{fontSize:11,padding:"5px 8px"}}/>
              <div style={{display:"flex",gap:5}}><Inp value={lLabel} onChange={e=>setLLabel(e.target.value)} placeholder="Label" style={{flex:1,fontSize:11,padding:"5px 8px"}}/><Btn v="ghost" style={{fontSize:10,padding:"4px 8px"}} onClick={()=>{addLink(item.id,lUrl,lLabel);setLUrl("");setLLabel("");}}>+ Add</Btn></div>
            </div>
            {(item.links||[]).length>0&&currentUser.id===item.assigneeId&&(
              <Btn v={item.submittedForReview?"secondary":"amber"} style={{width:"100%",justifyContent:"center",marginTop:10,fontSize:11,padding:"6px 0"}} onClick={()=>{
                const nowSubmitting=!item.submittedForReview;
                upd(item.id,"submittedForReview",nowSubmitting);
                if(nowSubmitting){
                  (async()=>{
                    const pms=(project?.teamAssignments||[]).filter(a=>["Senior PM","PM"].includes(a.role)).map(a=>a.userId||a.user_id).filter(Boolean);
                    const uniquePMs=[...new Set(pms)];
                    if(uniquePMs.length){
                      const rows=uniquePMs.map(recipientId=>({project_id:project.id,recipient_id:recipientId,type:"review_request",item_id:item.id||null,checklist_label:def?.label||def?.key||"Checklist",submitted_by:currentUser.id,seen:false}));
                      await insertNotifications(rows);
                    }
                  })();
                } else {
                  deleteNotifications(project.id,currentUser.id);
                }
              }}>
                {item.submittedForReview?"✓ Submitted — click to withdraw":"📤 Submit for Review →"}
              </Btn>
            )}
          </div>
        </div>
      </td></tr>
    );
  };

  return(
    <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column"}}>
      <div style={{background:"var(--s1)",borderBottom:"1px solid var(--bdr)",padding:"10px 22px",display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt2)",fontSize:18,padding:0,lineHeight:1}}>←</button>
        <span style={{color:"var(--txt3)",fontSize:12}}>{project?.name} /</span>
        {canApprv?(
          <input defaultValue={def.label} onBlur={e=>{const newLabel=e.target.value.trim();if(newLabel&&newLabel!==def.label&&onRenameChecklist){onRenameChecklist(newLabel);}}} style={{fontWeight:700,fontSize:13,color:"var(--txt)",background:"transparent",border:"none",outline:"none",borderBottom:"1px dashed var(--bdr2)",minWidth:200,cursor:"text",padding:"0 2px"}} title="Click to rename"/>
        ):(<span style={{fontWeight:700,fontSize:13,color:"var(--txt)"}}>{def.icon} {def.label}</span>)}
        {instance?.units&&<Tag label={`${instance.units} units`} color="var(--purple)"/>}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"var(--txt2)",fontWeight:500}}>AUDIT:</span>
          {canApprv?<Sel value={auditStatus} onChange={e=>setAuditStatus(e.target.value)} style={{width:130,padding:"4px 8px",fontSize:10,color:auditC[auditStatus]}}>{["Not Reviewed","In Review","Approved","Rejected"].map(o=><option key={o}>{o}</option>)}</Sel>:<Tag label={auditStatus} color={auditC[auditStatus]}/>}
          <div style={{width:90}}><Bar val={pct} color={def.color} thin/></div>
          <span style={{fontSize:12,fontWeight:600,color:def.color}}>{doneCount}/{items.length}</span>
          <Btn v="success" style={{padding:"5px 14px",fontSize:11}} onClick={save}>💾 Save</Btn>
        </div>
      </div>
      {saved&&<div style={{position:"fixed",bottom:24,right:24,background:"var(--green)",color:"#fff",padding:"10px 20px",borderRadius:8,fontWeight:700,fontSize:13,zIndex:9999,animation:"fadeUp .2s ease",boxShadow:"var(--shadow)"}}>✓ Checklist saved successfully!</div>}
      {bulkToast&&<div style={{position:"fixed",bottom:24,right:24,background:"var(--acc)",color:"#fff",padding:"10px 20px",borderRadius:8,fontWeight:700,fontSize:13,zIndex:9999,animation:"fadeUp .2s ease",boxShadow:"var(--shadow)"}}>{bulkToast}</div>}

      <div style={{flex:1,overflow:"auto",padding:16}}>
        {isGantt?<GanttView project={project} users={users}/>:(
          <>
            <div style={{padding:"9px 14px",background:"var(--s2)",borderRadius:7,fontSize:11,color:"var(--txt2)",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div>✅ Task completes only when <strong>all 3 approvals</strong> (TM + PM + Client) = Approved.
                {!canEdit&&<span style={{color:"var(--amber)"}}> 👁 View-only</span>}
                {isDev&&<span style={{color:"var(--amber)"}}> · Approvals set by PM / Admin only.</span>}
              </div>
              <div style={{display:"flex",gap:8}}>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleExcel}/>
                {canEdit&&<Btn v="secondary" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>fileRef.current?.click()}>📎 Import Excel</Btn>}
                {canEdit&&<Btn v="ghost" style={{fontSize:11,padding:"4px 10px"}} onClick={addItem}>+ Task</Btn>}
              </div>
            </div>

            {excelPending&&(
              <div style={{marginBottom:14,padding:"14px 16px",background:"var(--s2)",border:"1px solid var(--amber)40",borderRadius:8}}>
                <div style={{fontWeight:700,fontSize:12,marginBottom:10}}>📋 Verify Excel import</div>
                {excelPending.map((row,i)=>(
                  <div key={row.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"var(--bg)",borderRadius:6,marginBottom:5}}>
                    <input type="checkbox" checked={row.accept} onChange={()=>setExcelPending(p=>p.map((r,idx)=>idx===i?{...r,accept:!r.accept}:r))}/>
                    <span style={{flex:1,fontSize:12}}>{row.text}</span>
                  </div>
                ))}
                <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
                  <Btn v="secondary" style={{fontSize:11}} onClick={()=>setExcelPending(null)}>Cancel</Btn>
                  <Btn v="success" style={{fontSize:11}} onClick={confirmImport}>✓ Import Selected</Btn>
                </div>
              </div>
            )}

            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{flex:1,height:7,background:"var(--bdr)",borderRadius:99,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:def.color,borderRadius:99}}/></div>
              <span style={{fontSize:13,fontWeight:700,color:def.color}}>{pct}%</span>
            </div>

            {canEdit&&items.some(i=>i._ticked)&&(()=>{
              const tickedCount=items.filter(i=>i._ticked).length;
              return(
                <div style={{marginBottom:10,padding:"12px 14px",background:"var(--s2)",border:"1px solid var(--acc)40",borderRadius:10}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <span style={{fontSize:11,fontWeight:700,color:"var(--acc)"}}>{tickedCount} task{tickedCount>1?"s":""} selected — bulk edit</span>
                    <Btn v="secondary" style={{fontSize:10,padding:"3px 8px"}} onClick={()=>setItems(prev=>prev.map(x=>({...x,_ticked:false})))}>✗ Deselect All</Btn>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
                    <div>
                      <span style={{fontSize:12,fontWeight:500,color:"var(--txt2)",letterSpacing:"0.04em",textTransform:"uppercase"}}>Set Assignee</span>
                      <Sel defaultValue="" onChange={e=>{if(!e.target.value)return;const val=e.target.value?Number(e.target.value):"";setItems(prev=>prev.map(x=>x._ticked?{...x,assigneeId:val,lastUpdated:todayStr()}:x));showBulkToast("Assignee updated ✓");e.target.value="";}} style={{fontSize:11,padding:"5px 8px"}}>
                        <option value="">— Pick —</option><option value="">Clear</option>
                        {teamMembers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                      </Sel>
                    </div>
                    <div>
                      <span style={{fontSize:12,fontWeight:500,color:"var(--txt2)",letterSpacing:"0.04em",textTransform:"uppercase"}}>Set Status</span>
                      <Sel defaultValue="" onChange={e=>{if(!e.target.value)return;setItems(prev=>prev.map(x=>x._ticked?{...x,status:e.target.value,lastUpdated:todayStr()}:x));showBulkToast(`Status → ${e.target.value} ✓`);e.target.value="";}} style={{fontSize:11,padding:"5px 8px"}}>
                        <option value="">— Pick —</option>
                        {["Pending","In Progress","Done","Blocked","On Hold"].map(s=><option key={s} value={s}>{s}</option>)}
                      </Sel>
                    </div>
                  </div>
                  {canApprv&&(
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",paddingTop:10,borderTop:"1px solid var(--bdr)"}}>
                      <span style={{fontSize:12,color:"var(--txt3)",fontWeight:500,alignSelf:"center"}}>BULK APPROVE:</span>
                      <Btn v="amber" style={{fontSize:11,padding:"4px 12px"}} onClick={()=>{setItems(prev=>prev.map(x=>x._ticked?{...x,tmApproval:"Approved",lastUpdated:todayStr()}:x));showBulkToast("TM Approved ✓");}}>✓ TM All</Btn>
                      <Btn v="ghost" style={{fontSize:11,padding:"4px 12px",color:"var(--blue)"}} onClick={()=>{setItems(prev=>prev.map(x=>x._ticked&&x.tmApproval==="Approved"?{...x,pmApproval:"Approved",lastUpdated:todayStr()}:x));showBulkToast("PM Approved ✓");}}>✓ PM All</Btn>
                      <Btn v="success" style={{fontSize:11,padding:"4px 12px"}} onClick={()=>{setItems(prev=>prev.map(x=>x._ticked&&x.pmApproval==="Approved"?{...x,clientApproval:"Approved",lastUpdated:todayStr()}:x));showBulkToast("Client Approved ✓");}}>✓ Client All</Btn>
                      <Btn v="ghost" style={{fontSize:11,padding:"4px 12px",color:"var(--green)"}} onClick={()=>{setItems(prev=>prev.map(x=>x._ticked?{...x,tmApproval:"Approved",pmApproval:"Approved",clientApproval:"Approved",lastUpdated:todayStr()}:x));showBulkToast("All 3 Approved ✓");}}>✓ All 3</Btn>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{overflow:"auto",border:"1px solid var(--bdr)",borderRadius:8}}>
              <table style={{minWidth:1100}}>
                <thead><tr>
                  {canEdit&&<th style={{width:32,textAlign:"center"}}>
                    <input type="checkbox" title="Select all" checked={items.length>0&&items.every(i=>i._ticked)} onChange={e=>setItems(prev=>prev.map(x=>({...x,_ticked:e.target.checked})))}/>
                  </th>}
                  {!canEdit&&<th style={{width:26}}/>}
                  <th>Task</th>
                  <th style={{width:100}}>Assignee</th>
                  <th style={{width:88}}>Start</th>
                  <th style={{width:88}}>End</th>
                  <th style={{width:88}}>Status</th>
                  <th style={{width:100,textAlign:"center",background:"var(--amber)08",color:"var(--amber)"}}>TM Approval</th>
                  <th style={{width:100,textAlign:"center",background:"var(--blue)08",color:"var(--blue)"}}>PM Approval</th>
                  <th style={{width:100,textAlign:"center",background:"var(--green)08",color:"var(--green)"}}>Client Approval</th>
                  <th style={{width:86}}>Remarks</th>
                  <th style={{width:56,textAlign:"center"}}>Info</th>
                  <th style={{width:26}}/>
                </tr></thead>
                <tbody>
                  {items.map(item=>{
                    const fullyDone=isFullyDone(item);
                    const isTicked=!!item._ticked;
                    return(
                      <>
                        <tr key={item.id} style={{background:isTicked?"var(--acc)08":fullyDone?"var(--green)06":item.submittedForReview?"var(--amber)04":"",cursor:"pointer"}} onClick={()=>setExpanded(expanded===item.id?null:item.id)}>
                          <td style={{textAlign:"center"}} onClick={e=>e.stopPropagation()}>
                            {canEdit?(<input type="checkbox" checked={isTicked} onChange={e=>setItems(prev=>prev.map(x=>x.id===item.id?{...x,_ticked:e.target.checked}:x))}/>):(<div style={{width:10,height:10,borderRadius:"50%",margin:"auto",background:fullyDone?"var(--green)":"var(--bdr)"}}/>)}
                          </td>
                          <td onClick={e=>e.stopPropagation()}>
                            {canEdit?<input value={item.text} onChange={e=>upd(item.id,"text",e.target.value)} style={{background:"transparent",border:"none",color:fullyDone?"var(--txt3)":"var(--txt)",fontSize:12,outline:"none",width:"100%",textDecoration:fullyDone?"line-through":"none"}}/>:<span style={{fontSize:12,color:fullyDone?"var(--txt3)":"var(--txt)",textDecoration:fullyDone?"line-through":"none"}}>{item.text}</span>}
                            {item.submittedForReview&&<span style={{marginLeft:6,padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700,background:"var(--amber)18",color:"var(--amber)",border:"1px solid var(--amber)35"}}>FOR REVIEW</span>}
                          </td>
                          <td onClick={e=>e.stopPropagation()}>
                            {canEdit?<Sel value={item.assigneeId||""} onChange={e=>upd(item.id,"assigneeId",e.target.value?Number(e.target.value):"")} style={{padding:"3px 5px",fontSize:10}}>
                              <option value="">—</option>
                              {teamMembers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                            </Sel>:<span style={{fontSize:10,color:"var(--txt2)"}}>{item.assigneeId?getUser(item.assigneeId,users)?.name||"—":"—"}</span>}
                          </td>
                          <td onClick={e=>e.stopPropagation()}>{canEdit?<Inp type="date" value={item.startDate||""} onChange={e=>upd(item.id,"startDate",e.target.value)} style={{padding:"3px 4px",fontSize:10}}/>:<span style={{fontSize:10,color:"var(--txt2)"}}>{item.startDate?fmtShort(item.startDate):"—"}</span>}</td>
                          <td onClick={e=>e.stopPropagation()}>{canEdit?<Inp type="date" value={item.endDate||""} onChange={e=>upd(item.id,"endDate",e.target.value)} style={{padding:"3px 4px",fontSize:10}}/>:<span style={{fontSize:10,color:"var(--txt2)"}}>{item.endDate?fmtShort(item.endDate):"—"}</span>}</td>
                          <td onClick={e=>e.stopPropagation()}>
                            {canEdit?<select value={item.status} onChange={e=>upd(item.id,"status",e.target.value)} style={{background:"transparent",border:"none",color:{Done:"var(--green)",Blocked:"var(--red)","In Progress":"var(--blue)","On Hold":"var(--amber)",Pending:"var(--txt2)"}[item.status],fontSize:10,outline:"none",cursor:"pointer",fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",width:"100%"}}>
                              {["Pending","In Progress","Done","Blocked","On Hold"].map(o=><option key={o}>{o}</option>)}
                            </select>:<Tag label={item.status} color={{Done:"var(--green)",Blocked:"var(--red)","In Progress":"var(--blue)","On Hold":"var(--amber)"}[item.status]}/>}
                          </td>
                          <td style={{textAlign:"center",background:"var(--amber)04"}} onClick={e=>e.stopPropagation()}>
                            {canApprvTM(item)?(<button onClick={()=>upd(item.id,"tmApproval",item.tmApproval==="Approved"?"Pending":"Approved")} style={{width:"100%",padding:"4px 0",borderRadius:4,border:`1px solid ${item.tmApproval==="Approved"?"var(--green)":"var(--amber)40"}`,background:item.tmApproval==="Approved"?"var(--green)18":"transparent",color:AP3C[item.tmApproval||"Pending"],fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"'IBM Plex Mono',monospace"}}>{item.tmApproval==="Approved"?"✓ Approved":"○ Pending"}</button>):<Tag label={item.tmApproval||"Pending"} color={AP3C[item.tmApproval||"Pending"]}/>}
                          </td>
                          <td style={{textAlign:"center",background:"var(--blue)04"}} onClick={e=>e.stopPropagation()}>
                            {canApprvPM(item)?(<button onClick={()=>upd(item.id,"pmApproval",item.pmApproval==="Approved"?"Pending":"Approved")} style={{width:"100%",padding:"4px 0",borderRadius:4,border:`1px solid ${item.pmApproval==="Approved"?"var(--green)":"var(--blue)40"}`,background:item.pmApproval==="Approved"?"var(--green)18":"transparent",color:AP3C[item.pmApproval||"Pending"],fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"'IBM Plex Mono',monospace"}}>{item.pmApproval==="Approved"?"✓ Approved":"○ Pending"}</button>):canApprv&&item.tmApproval!=="Approved"?(<span style={{fontSize:9,color:"var(--txt3)",fontFamily:"'IBM Plex Mono',monospace"}}>Awaiting TM</span>):<Tag label={item.pmApproval||"Pending"} color={AP3C[item.pmApproval||"Pending"]}/>}
                          </td>
                          <td style={{textAlign:"center",background:"var(--green)04"}} onClick={e=>e.stopPropagation()}>
                            {canApprvClient(item)?(<button onClick={()=>upd(item.id,"clientApproval",item.clientApproval==="Approved"?"Pending":"Approved")} style={{width:"100%",padding:"4px 0",borderRadius:4,border:`1px solid ${item.clientApproval==="Approved"?"var(--green)":"var(--green)40"}`,background:item.clientApproval==="Approved"?"var(--green)18":"transparent",color:AP3C[item.clientApproval||"Pending"],fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"'IBM Plex Mono',monospace"}}>{item.clientApproval==="Approved"?"✓ Approved":"○ Pending"}</button>):canApprv&&item.pmApproval!=="Approved"?(<span style={{fontSize:9,color:"var(--txt3)",fontFamily:"'IBM Plex Mono',monospace"}}>{item.tmApproval!=="Approved"?"Awaiting TM":"Awaiting PM"}</span>):<Tag label={item.clientApproval||"Pending"} color={AP3C[item.clientApproval||"Pending"]}/>}
                          </td>
                          <td onClick={e=>e.stopPropagation()}>{canEdit?<input value={item.remarks||""} onChange={e=>upd(item.id,"remarks",e.target.value)} placeholder="Notes…" style={{background:"transparent",border:"none",color:"var(--txt2)",fontSize:10,outline:"none",width:"100%"}}/>:<span style={{fontSize:10,color:"var(--txt2)"}}>{item.remarks||"—"}</span>}</td>
                          <td style={{textAlign:"center"}}>
                            <div style={{display:"flex",gap:2,alignItems:"center",justifyContent:"center",flexWrap:"wrap"}}>
                              {(item.comments||[]).length>0&&<span style={{fontSize:9,color:"var(--blue)"}}>💬{item.comments.length}</span>}
                              {(item.roadblocks||[]).filter(r=>!r.resolved).length>0&&<span style={{fontSize:9,color:"var(--red)"}}>⚠{item.roadblocks.filter(r=>!r.resolved).length}</span>}
                              {(item.links||[]).length>0&&<span style={{fontSize:9,color:"var(--green)"}}>🔗{item.links.length}</span>}
                              <span style={{fontSize:10,color:"var(--txt3)"}}>{expanded===item.id?"▲":"▼"}</span>
                            </div>
                          </td>
                          <td>{canEdit&&<button onClick={e=>{e.stopPropagation();remove(item.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--txt3)",fontSize:14}}>×</button>}</td>
                        </tr>
                        {expanded===item.id&&<ExpandPanel key={"ep"+item.id} item={item}/>}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{marginTop:12}}><span style={{fontSize:12,fontWeight:500,color:"var(--txt2)",letterSpacing:"0.04em",textTransform:"uppercase"}}>Notes / LLD Reference</span><TA value={note} onChange={e=>setNote(e.target.value)} rows={2} disabled={!canEdit} style={{fontSize:11,marginTop:4}} placeholder="LLD reference, design notes…"/></div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChecklistPage;
