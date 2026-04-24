import { useState } from "react";
import { RESOURCE_ROLES, initials } from "../../lib/constants.jsx";
import { supabase } from "../../lib/supabase.js";
import { Btn, Inp, Sel, Lbl, Modal } from "../../components/ui/index.jsx";

const AddResourceModal=({onClose,addResource,users,DEPT_ROLES})=>{
  const [form,setForm]=useState({name:"",email:"",resourceRole:"jr_hw",loginType:"developer",dept:"",skills:[],projectTags:["engineering"]});
  const setF=(k,v)=>setForm(f=>({...f,[k]:v}));
  const ROLE_SKILLS={
    sr_hw:["PCB Designing","Schematic Design","Altium Designer","Hardware Debugging","EMI/EMC","Signal Integrity","KiCad"],
    jr_hw:["PCB Designing","Schematic Design","Altium Designer","KiCad","Hardware Debugging","Component Selection"],
    jr_hw_2:["PCB Designing","Schematic Design","Altium Designer","KiCad","Hardware Debugging","Component Selection"],
    sr_fw:["Linux","MCU Programming","STM32","RTOS","Embedded C","Python","Device Drivers","CAN/SPI/I2C"],
    jr_fw:["MCU Programming","STM32","Embedded C","Linux","Arduino","Bare Metal Programming"],
    jr_fw_2:["MCU Programming","STM32","Embedded C","Linux","Arduino","Bare Metal Programming"],
    ind_design:["Fusion 360","SolidWorks","AutoCAD","3D Printing","DFM","Product Rendering","Mechanical Design"],
    tester:["Test Automation","Manual Testing","JTAG","Oscilloscope","Signal Analyser","Test Report Writing"],
    sr_pm:["Project Planning","Risk Management","Client Communication","Agile/Scrum","JIRA","MS Project"],
    jr_pm:["Project Planning","Agile/Scrum","JIRA","MS Project","Documentation"],
    sol_arch:["System Architecture","MCU Selection","Linux","Cloud Integration","Protocol Design","Technical Consulting"],
    devops:["Linux","CI/CD","Docker","Git","Shell Scripting","Server Administration"],
    sc:["Supply Chain Management","BOM Management","Procurement","ERP Systems","Vendor Management","Logistics"],
    soldering:["PCB Assembly","Soldering","Rework","IPC-610 Standards","Quality Inspection","SMT/THT"],
  };
  const DEPT_OPTIONS=["Hardware","Firmware","Industrial Design","Testing","Project Management","Supply Chain","DevOps","Solution Architecture","Soldering & Testing","Management"];
  const currentSkills=ROLE_SKILLS[form.resourceRole]||[];
  const toggleSkill=(sk)=>setForm(f=>({...f,skills:(f.skills||[]).includes(sk)?(f.skills||[]).filter(x=>x!==sk):[...(f.skills||[]),sk]}));
  const [saving,setSaving]=useState(false);
  const save=async()=>{
    if(!form.name||!form.email)return alert("Name and email required");
    if(users.find(u=>u.email===form.email))return alert("Email already exists");
    setSaving(true);
    // 1. Create Supabase Auth user to get a UUID
    const tempPassword="Elecbits@"+Math.floor(1000+Math.random()*9000);
    const{data:authData,error:authErr}=await supabase.auth.signUp({
      email:form.email,
      password:tempPassword,
      options:{data:{name:form.name}}
    });
    if(authErr||!authData?.user){alert("Auth creation failed: "+(authErr?.message||"No user returned"));setSaving(false);return;}
    // 2. Insert into users table with the auth UUID
    const ri=RESOURCE_ROLES.find(r=>r.key===form.resourceRole);
    const loginTypeToRole={superadmin:"superadmin",pm:"pm",developer:"developer"};
    const newUser={id:authData.user.id,name:form.name,email:form.email,role:loginTypeToRole[form.loginType],avatar:initials(form.name),dept:form.dept||ri?.label||"",resourceRole:form.resourceRole,loginType:form.loginType,tags:form.skills||[],skills:form.skills||[],projectTags:form.projectTags,maxProjects:2};
    await addResource(newUser);
    setSaving(false);
    alert("Resource added! Temp password: "+tempPassword+"\nShare with "+form.name);
    onClose();
  };
  return(
    <Modal title="Add New Resource" onClose={onClose} maxW={560}>
      <div style={{display:"flex",flexDirection:"column",gap:13}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 14px"}}>
          <div style={{gridColumn:"span 2"}}><Lbl>Full Name</Lbl><Inp value={form.name} onChange={e=>setF("name",e.target.value)} placeholder="e.g. Raj Patel"/></div>
          <div><Lbl>Email</Lbl><Inp type="email" value={form.email} onChange={e=>setF("email",e.target.value)} placeholder="raj@elecbits.in"/></div>
          <div><Lbl>Department</Lbl>
            <Sel value={form.dept} onChange={e=>setF("dept",e.target.value)}>
              <option value="">— Select Department —</option>
              {DEPT_OPTIONS.map(d=><option key={d} value={d}>{d}</option>)}
            </Sel>
          </div>
          <div><Lbl>Role / Function</Lbl><Sel value={form.resourceRole} onChange={e=>{setF("resourceRole",e.target.value);setForm(f=>({...f,resourceRole:e.target.value,skills:[]}));}}>
            {form.dept?(
              (DEPT_ROLES[form.dept]||RESOURCE_ROLES.map(r=>r.key))
                .map(key=>{const r=RESOURCE_ROLES.find(x=>x.key===key);return r?<option key={r.key} value={r.key}>{r.label}</option>:null;})
            ):(
              ["senior","junior","shared"].map(tier=><optgroup key={tier} label={tier.charAt(0).toUpperCase()+tier.slice(1)}>{RESOURCE_ROLES.filter(r=>r.tier===tier).map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</optgroup>)
            )}
          </Sel></div>
          <div><Lbl>Login Type</Lbl><Sel value={form.loginType} onChange={e=>setF("loginType",e.target.value)}><option value="superadmin">Super Admin</option><option value="pm">Project Manager</option><option value="developer">Developer</option></Sel></div>
        </div>
        <div>
          <Lbl>Skills <span style={{color:"var(--txt3)",fontSize:9,fontWeight:400}}>— based on selected role</span></Lbl>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5}}>
            {currentSkills.map(sk=>(
              <button key={sk} onClick={()=>toggleSkill(sk)} style={{padding:"4px 12px",borderRadius:99,border:`1px solid ${(form.skills||[]).includes(sk)?"var(--acc)":"var(--bdr)"}`,background:(form.skills||[]).includes(sk)?"var(--acc)15":"transparent",color:(form.skills||[]).includes(sk)?"var(--acc)":"var(--txt2)",fontSize:11,cursor:"pointer",fontWeight:600}}>
                {sk}
              </button>
            ))}
            {currentSkills.length===0&&<span style={{fontSize:11,color:"var(--txt3)"}}>Select a role to see available skills</span>}
          </div>
        </div>
        <div>
          <Lbl>Project Type</Lbl>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:5}}>
            {[{key:"engineering",label:"Engineering Services",color:"var(--blue)"},{key:"elecbits_product",label:"Elecbits Product",color:"var(--green)"},{key:"modifier",label:"Modifier",color:"var(--purple)"}].map(pt=>(
              <button key={pt.key} onClick={()=>setForm(f=>({...f,projectTags:[pt.key]}))} style={{padding:"6px 16px",borderRadius:99,border:`2px solid ${form.projectTags[0]===pt.key?pt.color:"var(--bdr)"}`,background:form.projectTags[0]===pt.key?pt.color+"18":"transparent",color:form.projectTags[0]===pt.key?pt.color:"var(--txt2)",fontSize:11,cursor:"pointer",fontWeight:700,transition:"all .15s"}}>
                {form.projectTags[0]===pt.key?"● ":"○ "}{pt.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{padding:"10px 14px",background:"var(--s2)",borderRadius:7,display:"flex",gap:10,alignItems:"center"}}>
          <div style={{width:34,height:34,borderRadius:"50%",background:"var(--acc)22",border:"1.5px solid var(--acc)60",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"var(--acc)",fontFamily:"IBM Plex Mono"}}>{initials(form.name)||"?"}</div>
          <div><div style={{fontSize:12,fontWeight:700,color:"var(--txt)"}}>{form.name||"New Resource"}</div><div style={{fontSize:10,color:"var(--txt2)"}}>{RESOURCE_ROLES.find(r=>r.key===form.resourceRole)?.label} · {form.loginType} · pw: dev123</div></div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn v="secondary" onClick={onClose} disabled={saving}>Cancel</Btn><Btn v="success" onClick={save} disabled={saving}>{saving?"Creating...":"✓ Add Resource"}</Btn></div>
      </div>
    </Modal>
  );
};

export default AddResourceModal;
