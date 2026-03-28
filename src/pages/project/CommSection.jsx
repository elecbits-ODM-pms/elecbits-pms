import { useState } from "react";
import { UNIQ, todayStr } from "../../lib/constants.jsx";
import { insertCommunication, updateCommunicationStatus } from "../../lib/db.js";
import { Btn, Inp, Sel, TA, Lbl, Card, Pill, Tag, SH } from "../../components/ui/index.jsx";

const CommSection=({project,currentUser,isPM,isAdmin,dbComms,setDbComms,upd,showReminder,setShowReminder,showToast,onBack,onOpenNewProject})=>{
  const [showAdd,setShowAdd]=useState(false);const [type,setType]=useState("minor");
  const [subject,setSubject]=useState("");const [body,setBody]=useState("");
  const [ecn,setEcn]=useState("");const [commLink,setCommLink]=useState("");
  const submit=()=>{
    if(!subject||!body)return alert("Subject and details required");
    if(ecn&&(dbComms||[]).some(c=>c.ecnNum===ecn)){
      return alert("ECN number \""+ecn+"\" already exists in this project. Each ECN must be unique.");
    }
    insertCommunication({
      project_id: project.id,
      author_id:  currentUser.id,
      type,
      subject,
      body,
      ecn_num:    ecn||null,
      link:       commLink||null,
      status:     type==="major"?"pending_approval":"active",
    }).then(({data,error})=>{
      if(error){alert("Failed to save: "+error.message);return;}
      const shaped={...data,ecnNum:data.ecn_num,authorId:data.author_id,authorName:currentUser.name,timestamp:data.created_at};
      setDbComms(prev=>[...prev,shaped]);
      showToast(type==="major"?"Major change submitted for approval":"ECN logged ✓","var(--green)");
    });
    setShowAdd(false);setSubject("");setBody("");setEcn("");setCommLink("");
  };
  return(
    <div>
      <SH title="Client Communication" color="var(--purple)" action={isPM&&<div style={{display:"flex",gap:6}}><Btn v="ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setShowReminder(true)}>📨 Remind</Btn><Btn v="ghost" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setShowAdd(true)}>+ Add</Btn></div>}/>
      {(dbComms||[]).map(c=>(
        <Card key={c.id} style={{padding:12,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:4}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <Pill label={c.type==="minor"?"Minor Change":"⚠ Major Change"} color={c.type==="minor"?"var(--blue)":"var(--red)"} small/>
              {c.status==="pending_approval"&&<Pill label="Awaiting Approval" color="var(--amber)" small/>}
              {c.status==="approved"&&<Pill label="Approved ✓" color="var(--green)" small/>}
              {c.status==="rejected"&&<Pill label="Rejected" color="var(--red)" small/>}
              {c.ecnNum&&<Tag label={`ECN: ${c.ecnNum}`} color="var(--blue)"/>}
            </div>
            <span style={{fontSize:10,color:"var(--txt3)",fontFamily:"IBM Plex Mono"}}>{c.timestamp}</span>
          </div>
          <div style={{fontWeight:700,fontSize:12,marginBottom:4,color:"var(--txt)"}}>{c.subject}</div>
          <div style={{fontSize:12,color:"var(--txt2)",marginBottom:c.link?6:0}}>{c.body}</div>
          {c.link&&<a href={c.link} target="_blank" rel="noreferrer" style={{fontSize:11,color:"var(--acc)"}}>🔗 {c.link}</a>}
          {c.type==="major"&&c.status==="pending_approval"&&isAdmin&&(
            <div style={{display:"flex",gap:8,marginTop:10,padding:"10px 0 0",borderTop:"1px solid var(--bdr)",alignItems:"center"}}>
              <span style={{flex:1,fontSize:11,color:"var(--amber)"}}>⚠ Approving creates a new project in <strong>pending sanction</strong> state on the main page.</span>
              <Btn v="success" style={{fontSize:10,padding:"5px 12px"}} onClick={()=>{
                updateCommunicationStatus(c.id,"active");
                setDbComms(prev=>prev.map(x=>x.id===c.id?{...x,status:"active"}:x));
                const prefill={name:project.name+" (Major Change)",projectId:"EB-CHG-"+UNIQ().slice(0,4).toUpperCase(),productIds:project.productIds||[project.productId||""],clientName:project.clientName||"",clientId:project.clientId||"",projectTag:project.projectTag,description:"Created from major change approval:\n"+c.subject+"\n\n"+c.body,startDate:todayStr(),endDate:"",submitForSanction:true};
                onBack();
                setTimeout(()=>onOpenNewProject&&onOpenNewProject(prefill),50);
                showToast("✓ Approved — fill in the new project form that just opened","var(--green)");
              }}>✓ Approve & Create Project</Btn>
              <Btn v="danger" style={{fontSize:10,padding:"5px 12px"}} onClick={()=>{updateCommunicationStatus(c.id,"rejected");setDbComms(prev=>prev.map(x=>x.id===c.id?{...x,status:"rejected"}:x));}}>✗ Reject</Btn>
            </div>
          )}
        </Card>
      ))}
      {!(dbComms||[]).length&&!showAdd&&<div style={{textAlign:"center",padding:"20px 0",color:"var(--txt3)",fontSize:12}}>No communications logged yet.</div>}
      {showAdd&&<Card style={{padding:14,border:"1px solid var(--bdr2)"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div><Lbl>Change Type</Lbl><Sel value={type} onChange={e=>setType(e.target.value)}><option value="minor">Minor Change (ECN)</option><option value="major">Major Change → New Project</option></Sel></div>
          {type==="minor"&&<div><Lbl>ECN Number</Lbl><Inp value={ecn} onChange={e=>setEcn(e.target.value)} placeholder="ECN-2025-001"/></div>}
        </div>
        <div style={{marginBottom:10}}><Lbl>Subject</Lbl><Inp value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Brief description of the change"/></div>
        <div style={{marginBottom:10}}><Lbl>Details</Lbl><TA value={body} onChange={e=>setBody(e.target.value)} rows={3} placeholder="Describe the change, impact, and reason…"/></div>
        <div style={{marginBottom:10}}><Lbl>Reference Link (optional)</Lbl><Inp value={commLink} onChange={e=>setCommLink(e.target.value)} placeholder="https://… (spec, doc, or file link)"/></div>
        {type==="major"&&<div style={{marginBottom:10,padding:"8px 12px",background:"var(--amber)08",border:"1px solid var(--amber)30",borderRadius:6,fontSize:11,color:"var(--amber)"}}>⚠ Requires Super Admin approval. Once approved, a new project is created in pending sanction state.</div>}
        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn v="secondary" onClick={()=>setShowAdd(false)}>Cancel</Btn><Btn v={type==="minor"?"primary":"amber"} onClick={submit}>{type==="minor"?"📋 Log ECN":"⚠ Request Major Change"}</Btn></div>
      </Card>}
    </div>
  );
};

export default CommSection;
