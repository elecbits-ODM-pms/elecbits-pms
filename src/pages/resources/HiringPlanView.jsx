import { useState, useRef, useEffect } from "react";
import { RESOURCE_ROLES, HIRING_BASE } from "../../lib/constants.jsx";
import { fetchHiringPlan, updateHiringTarget, updateHiringMonthly } from "../../lib/db.js";
import { Btn, Inp, Sel, Lbl, Tag } from "../../components/ui/index.jsx";

const HiringPlanView=({members})=>{
  const ALL_MONTHS=(()=>{
    const months=[];const d=new Date();d.setMonth(d.getMonth()-3);d.setDate(1);
    for(let i=0;i<24;i++){
      months.push(d.toLocaleDateString("en-GB",{month:"short",year:"numeric"}).replace(" "," ").replace(" "," "));
      d.setMonth(d.getMonth()+1);
    }
    return months;
  })();
  const [hiringData,setHiringData]=useState(()=>{
    const init={};
    RESOURCE_ROLES.forEach(r=>{
      const base=HIRING_BASE[r.key]||{req4:1,target17:4,achieved:0};
      init[r.key]={...base,monthly:{}};
      ALL_MONTHS.forEach(m=>{init[r.key].monthly[m]=0;});
    });
    return init;
  });
  useEffect(()=>{
    fetchHiringPlan().then(({data})=>{
      if(!data)return;
      const mapped={};
      data.forEach(row=>{
        mapped[row.resource_role]={
          req4:    row.req_per_4||1,
          target17:row.target||4,
          monthly: row.monthly||{},
        };
        ALL_MONTHS.forEach(m=>{if(!mapped[row.resource_role].monthly[m])mapped[row.resource_role].monthly[m]=0;});
      });
      setHiringData(prev=>({...prev,...mapped}));
    });
  },[]);
  const [monthFilter,setMonthFilter]=useState("all");
  const [showImport,setShowImport]=useState(false);
  const [importRows,setImportRows]=useState([]);
  const fileRef=useRef();

  const visibleMonths=monthFilter==="all"?ALL_MONTHS:ALL_MONTHS.filter(m=>m===monthFilter);

  const handleHiringExcel=(e)=>{
    const file=e.target.files[0];if(!file)return;
    const isCSV=file.name.toLowerCase().endsWith(".csv")||file.name.toLowerCase().endsWith(".tsv");
    const processRows=(raw)=>{
      if(!raw.length)return;
      const headers=raw[0].map(h=>String(h||"").trim().toLowerCase().replace(/\s+/g,"_"));
      const parsed=raw.slice(1).filter(row=>row.some(c=>c)).map(row=>{
        const obj={};headers.forEach((h,i)=>{obj[h]=String(row[i]||"").trim();});
        return obj;
      });
      setImportRows(parsed.map((r,i)=>({...r,_id:i,_role:"",_month:"",_count:1,_accept:true})));
      setShowImport(true);
    };
    if(isCSV){
      const reader=new FileReader();
      reader.onload=(evt)=>{
        try{
          const rows=evt.target.result.split(/\r?\n/).filter(r=>r.trim()).map(r=>r.split(/[,\t]/).map(c=>c.replace(/^"+|"+$/g,"").trim()));
          processRows(rows);
        }catch(err){alert("Could not parse CSV.");}
      };
      reader.readAsText(file);
    } else {
      const reader=new FileReader();
      reader.onload=(evt)=>{
        try{
          const parseXLSX=(XLSX)=>{
            const wb=XLSX.read(new Uint8Array(evt.target.result),{type:"array"});
            const ws=wb.Sheets[wb.SheetNames[0]];
            processRows(XLSX.utils.sheet_to_json(ws,{header:1,defval:""}));
          };
          if(window.XLSX){parseXLSX(window.XLSX);}
          else{const sc=document.createElement("script");sc.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";sc.onload=()=>parseXLSX(window.XLSX);document.head.appendChild(sc);}
        }catch(err){alert("Error reading Excel file.");}
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value="";
  };

  const confirmImport=()=>{
    const MAX_IMPORT_ROWS=500;
    const accepted=importRows.filter(r=>r._accept&&r._role&&r._month).slice(0,MAX_IMPORT_ROWS);
    if(importRows.filter(r=>r._accept).length>MAX_IMPORT_ROWS){alert("Import limited to "+MAX_IMPORT_ROWS+" rows.");}
    const updated={...hiringData};
    accepted.forEach(r=>{
      if(updated[r._role]){
        updated[r._role]={...updated[r._role],monthly:{...updated[r._role].monthly,[r._month]:(updated[r._role].monthly[r._month]||0)+Number(r._count)}};
      }
    });
    setHiringData(updated);setShowImport(false);setImportRows([]);
  };

  return(
    <div>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <div style={{flex:1,fontSize:11,color:"var(--txt2)",padding:"8px 12px",background:"var(--s2)",borderRadius:7}}>
          Hiring plan for 17 projects — June 2026 target. <strong>Achieved</strong> auto-syncs with actual headcount. Target and monthly additions are editable.
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Lbl style={{marginBottom:0,whiteSpace:"nowrap"}}>Month:</Lbl>
          <Sel value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} style={{fontSize:11,padding:"4px 8px"}}>
            <option value="all">All Months</option>
            {ALL_MONTHS.map(m=><option key={m} value={m}>{m}</option>)}
          </Sel>
          <input type="file" accept=".csv,.tsv,.xlsx,.xls" style={{display:"none"}} ref={fileRef} onChange={handleHiringExcel}/>
          <Btn v="secondary" style={{fontSize:11,padding:"5px 12px"}} onClick={()=>fileRef.current?.click()}>📎 Import Excel / CSV</Btn>
        </div>
      </div>

      {showImport&&(
        <div style={{marginBottom:14,padding:"14px 16px",background:"var(--s2)",border:"1px solid var(--amber)40",borderRadius:10}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"var(--txt)"}}>📋 Map Imported Rows to Hiring Plan</div>
          <div style={{fontSize:11,color:"var(--txt2)",marginBottom:10}}>Match each row to a role and month. Only accepted rows will be added.</div>
          <div style={{overflow:"auto",border:"1px solid var(--bdr)",borderRadius:7}}>
            <table style={{minWidth:600}}>
              <thead><tr><th style={{width:32}}>✓</th><th>Row Preview</th><th style={{width:160}}>Role</th><th style={{width:140}}>Month</th><th style={{width:70}}>Count</th></tr></thead>
              <tbody>{importRows.map((row,i)=>(
                <tr key={row._id}>
                  <td><input type="checkbox" checked={row._accept} onChange={e=>setImportRows(prev=>prev.map((r,idx)=>idx===i?{...r,_accept:e.target.checked}:r))}/></td>
                  <td style={{fontSize:10,color:"var(--txt2)"}}>{Object.entries(row).filter(([k])=>!k.startsWith("_")).map(([k,v])=>`${k}:${v}`).join(" · ").slice(0,70)}</td>
                  <td><Sel value={row._role} onChange={e=>setImportRows(prev=>prev.map((r,idx)=>idx===i?{...r,_role:e.target.value}:r))} style={{fontSize:11,padding:"3px 5px"}}>
                    <option value="">— Role —</option>
                    {RESOURCE_ROLES.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}
                  </Sel></td>
                  <td><Sel value={row._month} onChange={e=>setImportRows(prev=>prev.map((r,idx)=>idx===i?{...r,_month:e.target.value}:r))} style={{fontSize:11,padding:"3px 5px"}}>
                    <option value="">— Month —</option>
                    {ALL_MONTHS.map(m=><option key={m} value={m}>{m}</option>)}
                  </Sel></td>
                  <td><input type="number" min="1" value={row._count} onChange={e=>setImportRows(prev=>prev.map((r,idx)=>idx===i?{...r,_count:Number(e.target.value)}:r))} style={{width:52,background:"var(--bg)",border:"1px solid var(--bdr)",borderRadius:4,color:"var(--txt)",padding:"3px 5px",fontSize:12,textAlign:"center",outline:"none"}}/></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
            <Btn v="secondary" onClick={()=>{setShowImport(false);setImportRows([]);}}>Cancel</Btn>
            <Btn v="success" onClick={confirmImport}>✓ Apply to Plan</Btn>
          </div>
        </div>
      )}

      <div style={{overflow:"auto",border:"1px solid var(--bdr)",borderRadius:8}}>
        <table style={{minWidth:monthFilter==="all"?"auto":400}}>
          <thead><tr>
            <th style={{minWidth:140}}>Team</th>
            <th style={{width:58,textAlign:"center"}}>Req/4</th>
            <th style={{width:68,textAlign:"center"}}>Target</th>
            <th style={{width:68,textAlign:"center",color:"var(--green)"}}>Achieved</th>
            <th style={{width:68,textAlign:"center",color:"var(--red)"}}>Pending</th>
            {visibleMonths.map(m=><th key={m} style={{textAlign:"center",minWidth:64}}>{m}</th>)}
          </tr></thead>
          <tbody>{RESOURCE_ROLES.map(r=>{
            const row=hiringData[r.key]||{req4:1,target17:4,monthly:{}};
            const actualCount=(members||[]).filter(m=>m.resourceRole===r.key).length;
            const pending=Math.max(0,row.target17-actualCount);
            return(
              <tr key={r.key} style={{background:r.tier==="senior"?"var(--amber)05":""}}>
                <td><Tag label={r.label} color={r.color}/></td>
                <td style={{textAlign:"center",fontFamily:"IBM Plex Mono",fontSize:11}}>{row.req4}</td>
                <td style={{textAlign:"center"}}>
                  <input type="number" min="0" value={row.target17}
                    onChange={e=>{const val=Number(e.target.value);setHiringData(prev=>({...prev,[r.key]:{...prev[r.key],target17:val}}));updateHiringTarget(r.key,val);}}
                    style={{width:46,background:"var(--bg)",border:"1px solid var(--bdr)",borderRadius:4,color:"var(--txt)",padding:"3px 5px",fontSize:12,textAlign:"center",outline:"none",fontFamily:"IBM Plex Mono",fontWeight:700}}/>
                </td>
                <td style={{textAlign:"center",fontFamily:"IBM Plex Mono",color:"var(--green)",fontWeight:700}}>{actualCount}</td>
                <td style={{textAlign:"center",fontFamily:"IBM Plex Mono",color:pending>0?"var(--red)":"var(--green)",fontWeight:700}}>{pending>0?pending:"✓"}</td>
                {visibleMonths.map(m=>(
                  <td key={m} style={{textAlign:"center"}}>
                    <input type="number" min="0"
                      value={row.monthly[m]||0}
                      onChange={e=>{const val=Number(e.target.value);setHiringData(prev=>{const updated={...prev,[r.key]:{...prev[r.key],monthly:{...prev[r.key].monthly,[m]:val}}};updateHiringMonthly(r.key,updated[r.key].monthly);return updated;});}}
                      style={{width:42,background:"var(--bg)",border:"1px solid var(--bdr)",borderRadius:4,color:(row.monthly[m]||0)>0?"var(--acc)":"var(--txt2)",padding:"3px 4px",fontSize:11,textAlign:"center",outline:"none",fontFamily:"IBM Plex Mono"}}/>
                  </td>
                ))}
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
};

export default HiringPlanView;
