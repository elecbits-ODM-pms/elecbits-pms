import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* ─── LLD QUESTIONS ──────────────────────────────────────────────*/
const LLD_QUESTIONS = [
  // Product Overview (Q1-5)
  { id:1,  tab:2, text:"What is the product you want to build? Describe it in one sentence.", hint:"This becomes the one-liner on every internal doc. Keep it tight.", type:"text" },
  { id:2,  tab:2, text:"What category does it fall into?", hint:"Helps us assign the right engineering team from the start.", type:"chips", chips:["Consumer Electronics","Industrial IoT","Medical Device","Automotive","Wearable","Smart Home","Agriculture","Robotics","Other"] },
  { id:3,  tab:2, text:"What problem does it solve for the end user?", hint:"The clearer the pain point, the better we can prioritise features.", type:"text" },
  { id:4,  tab:2, text:"Who is the target user?", hint:"Affects enclosure rating, UI complexity and compliance path.", type:"chips", chips:["B2B — Enterprise","B2B — SME","B2C — Consumer","B2G — Government","Internal use","Other"] },
  { id:5,  tab:2, text:"Are there any existing products or references you want us to study?", hint:"A reference product saves weeks of back-and-forth on specs.", type:"text" },

  // Functions (Q6-10)
  { id:6,  tab:3, text:"List the key features / functions this product must have.", hint:"These become the acceptance criteria for every milestone.", type:"text" },
  { id:7,  tab:3, text:"Which sensors or input devices are needed?", hint:"Sensor selection drives PCB size, power budget and BOM cost.", type:"text" },
  { id:8,  tab:3, text:"What outputs / actuators are required?", hint:"Motor drivers, relays, LEDs — all affect power architecture.", type:"chips", chips:["LEDs / Display","Motor / Actuator","Speaker / Buzzer","Relay","Solenoid","Heating element","Pump","None","Other"] },
  { id:9,  tab:3, text:"Does it need a user interface?", hint:"Determines if we need a display, buttons, or touch controller on the PCB.", type:"chips", chips:["Physical buttons only","LCD / OLED screen","Touchscreen","Mobile app only","Voice control","LED indicators only","No UI","Other"] },
  { id:10, tab:3, text:"Any special processing requirements (AI/ML, real-time, high-speed data)?", hint:"This decides the MCU/SoC tier — cost jumps significantly with AI.", type:"text" },

  // Connectivity (Q11-14)
  { id:11, tab:4, text:"What wireless connectivity is needed?", hint:"Each radio adds an antenna, cert path and power draw.", type:"text" },
  { id:12, tab:4, text:"Select all wireless protocols required:", hint:"Multi-protocol combos (e.g. Wi-Fi + BLE) need combo modules.", type:"chips", multi:true, chips:["Wi-Fi","Bluetooth / BLE","LoRa","Zigbee","Z-Wave","Cellular (4G/5G)","NFC","GPS","Thread","None"] },
  { id:13, tab:4, text:"Any wired interfaces needed?", hint:"Connector count affects enclosure sealing and cost.", type:"chips", chips:["USB-C","Ethernet","RS-485","CAN bus","UART / Serial","I2C / SPI (internal)","HDMI","Audio jack","None"] },
  { id:14, tab:4, text:"Does it need cloud connectivity or a backend?", hint:"Cloud integration adds firmware OTA, security certs and server costs.", type:"chips", chips:["Yes — custom cloud","Yes — AWS IoT","Yes — Azure IoT","Yes — Google Cloud","Yes — Elecbits platform","No cloud needed","TBD"] },

  // Power (Q15-18)
  { id:15, tab:5, text:"How will the device be powered?", hint:"Battery vs mains changes the entire power tree design.", type:"chips", chips:["Battery only","Mains (AC adapter)","USB powered","Solar","PoE","Battery + charging","Multiple sources","TBD"] },
  { id:16, tab:5, text:"If battery-powered, what is the expected battery life?", hint:"Drives sleep-mode firmware architecture and component selection.", type:"text" },
  { id:17, tab:5, text:"Any power consumption constraints or targets?", hint:"Thermal limits in sealed enclosures are a common late surprise.", type:"text" },
  { id:18, tab:5, text:"Does it need to support power-saving / sleep modes?", hint:"Deep-sleep firmware is non-trivial — better to plan early.", type:"chips", chips:["Yes — critical","Yes — nice to have","No — always on","TBD"] },

  // Software (Q19-21)
  { id:19, tab:6, text:"Is there a companion mobile or web app?", hint:"App development is often 40% of the project timeline.", type:"chips", chips:["Mobile app (iOS + Android)","Mobile app (Android only)","Mobile app (iOS only)","Web dashboard","Both mobile + web","No app needed","TBD"] },
  { id:20, tab:6, text:"Does the firmware need OTA (over-the-air) update capability?", hint:"OTA needs a bootloader, dual-partition flash and signing infra.", type:"chips", chips:["Yes — essential","Nice to have","No","TBD"] },
  { id:21, tab:6, text:"Any data logging, analytics or reporting requirements?", hint:"Determines on-device storage and cloud pipeline design.", type:"chips", chips:["Real-time telemetry","On-device logging","Cloud analytics dashboard","Exportable reports","Edge analytics","No data requirements","TBD"] },

  // Physical (Q22-24)
  { id:22, tab:7, text:"What are the approximate size constraints? (L × W × H in mm, or describe)", hint:"PCB dimensions are locked early — changes are expensive later.", type:"text" },
  { id:23, tab:7, text:"What environment will it operate in?", hint:"IP rating, conformal coating and connector selection depend on this.", type:"chips", chips:["Indoor — controlled","Indoor — dusty/humid","Outdoor — sheltered","Outdoor — exposed","Underwater","Hazardous / explosive","Wearable (on body)","Vehicle-mounted","Other"] },
  { id:24, tab:7, text:"Enclosure material preference?", hint:"Tooling cost varies 10x between 3D-print and injection mould.", type:"chips", chips:["Plastic (injection mould)","Metal (aluminium/steel)","3D printed (prototype)","Silicone / rubber","No enclosure (board only)","TBD"] },

  // Certs (Q25-26)
  { id:25, tab:8, text:"Select all required certifications:", hint:"Cert requirements lock certain design choices at schematic stage.", type:"chips", multi:true, chips:["CE","FCC","UL","BIS (India)","RoHS","REACH","IP rating","MIL-STD","IEC 60601 (Medical)","ISO 13485","Automotive (AEC-Q)","None yet","TBD"] },
  { id:26, tab:8, text:"Any regulatory or compliance notes we should know about?", hint:"Country-specific rules (e.g. India BIS) can add months.", type:"text" },

  // Cost & Time (Q27-30)
  { id:27, tab:9, text:"What is the target unit cost (BOM) range?", hint:"Sets the ceiling for component and PCB layer choices.", type:"chips", chips:["< ₹500","₹500 – ₹2,000","₹2,000 – ₹5,000","₹5,000 – ₹15,000","₹15,000+","No target yet"] },
  { id:28, tab:9, text:"Expected production volume in the first year?", hint:"Drives tooling investment and supplier MOQ negotiations.", type:"text" },
  { id:29, tab:9, text:"Any hard deadline or launch date we must hit?", hint:"If there is an expo, funding round or seasonal window — we need to know now.", type:"text" },
  { id:30, tab:9, text:"Anything else we should know? Special requests, risks, constraints…", hint:"The catch-all. Better to over-share than discover surprises later.", type:"text" },
];

const TABS = [
  { idx:0, label:"Client" },
  { idx:1, label:"Project" },
  { idx:2, label:"Product" },
  { idx:3, label:"Functions" },
  { idx:4, label:"Connectivity" },
  { idx:5, label:"Power" },
  { idx:6, label:"Software" },
  { idx:7, label:"Physical" },
  { idx:8, label:"Certs" },
  { idx:9, label:"Cost & Time" },
  { idx:10, label:"Review" },
];

const INDUSTRY_CODES = [
  { label:"Consumer Electronics", code:"CE" },
  { label:"Industrial / IoT", code:"IO" },
  { label:"Medical", code:"MD" },
  { label:"Automotive", code:"AU" },
  { label:"Agriculture", code:"AG" },
  { label:"Robotics", code:"RB" },
  { label:"Smart Home", code:"SH" },
  { label:"Wearable", code:"WR" },
  { label:"Other", code:"OT" },
];

const ORG_SIZES = [
  { label:"Startup (1-50)", code:"S" },
  { label:"SME (51-500)", code:"M" },
  { label:"Enterprise (500+)", code:"L" },
  { label:"Government", code:"G" },
  { label:"Individual", code:"I" },
];

const UNIQ = () => Math.random().toString(36).slice(2, 9);

/* ─── STYLES ─────────────────────────────────────────────────────*/
const S = {
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16, backdropFilter:"blur(6px)" },
  modal: { width:"100%", maxWidth:940, maxHeight:"92vh", display:"flex", flexDirection:"column", borderRadius:12, overflow:"hidden", background:"#fff", boxShadow:"0 20px 60px rgba(0,0,0,0.15)", animation:"fadeUp .2s ease" },
  header: { background:"linear-gradient(135deg, #1e3a8a, #2563eb)", padding:"16px 24px 0", flexShrink:0, borderRadius:"12px 12px 0 0" },
  headerTop: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 },
  headerLeft: { display:"flex", alignItems:"center", gap:12 },
  ebAvatar: { width:36, height:36, borderRadius:8, background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#fff", fontFamily:"'IBM Plex Mono',monospace" },
  headerTitle: { fontSize:16, fontWeight:700, color:"#fff" },
  headerSub: { fontSize:11, color:"rgba(255,255,255,0.6)" },
  badge: { padding:"4px 10px", borderRadius:99, background:"rgba(255,255,255,0.15)", fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.8)" },
  closeBtn: { background:"none", border:"none", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:20, padding:"0 4px", lineHeight:1 },
  tabBar: { display:"flex", gap:0, overflowX:"auto", paddingBottom:0, marginTop:8 },
  tab: (active, done) => ({ padding:"8px 12px", background:"none", border:"none", borderBottom:active?"2px solid #fff":"2px solid transparent", color:"#fff", opacity:active?1:done?0.7:0.35, fontSize:11, fontWeight:active?700:500, cursor:"pointer", whiteSpace:"nowrap", transition:"all .15s" }),
  progressWrap: { height:3, background:"rgba(255,255,255,0.15)", marginTop:0 },
  progressFill: (pct) => ({ height:"100%", width:`${pct}%`, background:"#60a5fa", borderRadius:2, transition:"width .4s ease" }),
  body: { flex:1, overflow:"auto", padding:"20px 24px", display:"flex", flexDirection:"column", gap:12, background:"#f8fafc" },
  msgRow: (isUser) => ({ display:"flex", justifyContent:isUser?"flex-end":"flex-start", gap:8, animation:"fadeUp .25s ease both" }),
  msgBubble: (isUser) => ({
    maxWidth:"75%", padding:"12px 16px", borderRadius:isUser?"14px 14px 4px 14px":"14px 14px 14px 4px",
    background:isUser?"linear-gradient(135deg, #2563eb, #1e40af)":"#f1f5f9",
    color:isUser?"#fff":"#1e293b", fontSize:14, lineHeight:1.5,
    boxShadow:isUser?"0 2px 8px rgba(37,99,235,0.2)":"none",
  }),
  sysAvatar: { width:28, height:28, borderRadius:"50%", background:"#e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"#64748b", flexShrink:0, fontFamily:"'IBM Plex Mono',monospace" },
  widget: { maxWidth:"85%", padding:0, background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" },
  widgetInner: { padding:"16px 18px" },
  inputArea: { padding:"12px 20px", borderTop:"1px solid #e2e8f0", background:"#fff", display:"flex", alignItems:"center", gap:10, flexShrink:0 },
  textInput: { flex:1, padding:"10px 14px", border:"1px solid #e2e8f0", borderRadius:10, fontSize:14, outline:"none", color:"#1e293b", background:"#f8fafc", transition:"border-color .15s" },
  sendBtn: { width:40, height:40, borderRadius:10, border:"none", background:"linear-gradient(135deg, #2563eb, #1e40af)", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, transition:"opacity .15s" },
  chip: (selected) => ({ padding:"6px 14px", borderRadius:99, border:`1.5px solid ${selected?"#2563eb":"#e2e8f0"}`, background:selected?"#eff6ff":"#fff", color:selected?"#2563eb":"#475569", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all .15s", whiteSpace:"nowrap" }),
  optionCard: (selected) => ({ padding:"14px 18px", borderRadius:10, border:`2px solid ${selected?"#2563eb":"#e2e8f0"}`, background:selected?"#eff6ff":"#fff", cursor:"pointer", transition:"all .15s", flex:1, minWidth:140 }),
  miniLabel: { fontSize:10, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 },
  miniInput: { width:"100%", padding:"7px 10px", border:"1px solid #e2e8f0", borderRadius:6, fontSize:13, outline:"none", color:"#1e293b" },
  primaryBtn: { padding:"8px 18px", borderRadius:8, background:"#2563eb", color:"#fff", border:"none", fontSize:13, fontWeight:600, cursor:"pointer", transition:"background .15s" },
  secondaryBtn: { padding:"8px 18px", borderRadius:8, background:"#f1f5f9", color:"#1e293b", border:"none", fontSize:13, fontWeight:600, cursor:"pointer" },
  link: { background:"none", border:"none", color:"#64748b", fontSize:12, cursor:"pointer", padding:0 },
  dot: (i) => ({ width:6, height:6, borderRadius:"50%", background:"#94a3b8", animation:`dotPulse .6s ease ${i*0.15}s infinite alternate` }),
};

/* ─── COMPONENT ──────────────────────────────────────────────────*/
const ProjectCreationChat = ({ isOpen, onClose, onProjectCreated, users, allProjects, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [currentStep, setCurrentStep] = useState("init");
  const [inputDisabled, setInputDisabled] = useState(true);
  const [inputPlaceholder, setInputPlaceholder] = useState("Type your answer...");
  const [inputValue, setInputValue] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [doneTab, setDoneTab] = useState(-1);
  const [typing, setTyping] = useState(false);
  const [data, setData] = useState({
    clientName:"", clientId:"", contactName:"", contactEmail:"",
    projectName:"", projectTag:"engineering", projectId:"",
    startDate:"", endDate:"", lldExists:null, lldUrl:"",
    lldAnswers: Array(30).fill(""),
  });
  const [lldIndex, setLldIndex] = useState(0);
  const [multiChips, setMultiChips] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const stepHistory = useRef([]);

  const scrollBottom = useCallback(() => {
    setTimeout(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, 50);
  }, []);

  const addMsg = useCallback((role, content, element = null) => {
    const msg = { id: UNIQ(), role, content, element };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  const sysMsg = useCallback((content, element = null) => {
    setTyping(true);
    return new Promise(resolve => {
      setTimeout(() => {
        setTyping(false);
        const m = addMsg("system", content, element);
        resolve(m);
      }, 400);
    });
  }, [addMsg]);

  useEffect(scrollBottom, [messages, typing, scrollBottom]);

  /* ─── STEP ENGINE ──────────────────────────────────────────────*/
  const goStep = useCallback(async (step, skipPush) => {
    if (!skipPush) stepHistory.current.push(currentStep);
    setCurrentStep(step);
    setInputDisabled(true);
    setMultiChips([]);

    switch (step) {
      case "init": {
        setActiveTab(0);
        await sysMsg("Hi! I'm the Elecbits project assistant. Let's set up your new project step by step.");
        await sysMsg("What is the **client / company name**?");
        setInputDisabled(false);
        setInputPlaceholder("e.g. Acme Corp");
        break;
      }
      case "clientId": {
        setActiveTab(0);
        await sysMsg("Great! Let me generate a Client ID for you.", "clientIdWidget");
        break;
      }
      case "contact": {
        setActiveTab(0);
        await sysMsg(`Who is the primary contact person at **${data.clientName}**?`);
        setInputDisabled(false);
        setInputPlaceholder("e.g. Rajesh Kumar");
        break;
      }
      case "contactEmail": {
        setActiveTab(0);
        await sysMsg("And their email or phone?");
        setInputDisabled(false);
        setInputPlaceholder("e.g. rajesh@acme.com");
        break;
      }
      case "projectName": {
        setActiveTab(1);
        setDoneTab(0);
        await sysMsg("What is the **project / product name**?");
        setInputDisabled(false);
        setInputPlaceholder("e.g. Smart Plug v3");
        break;
      }
      case "projectTag": {
        setActiveTab(1);
        await sysMsg("What type of project is this?", "projectTagPicker");
        break;
      }
      case "projectIdGen": {
        setActiveTab(1);
        await sysMsg("Let me generate a Project ID for you.", "projectIdWidget");
        break;
      }
      case "startDate": {
        setActiveTab(1);
        await sysMsg("When does this project **start**?", "startDatePicker");
        break;
      }
      case "endDate": {
        setActiveTab(1);
        await sysMsg("Target **end / delivery date**?", "endDatePicker");
        break;
      }
      case "lldChoice": {
        setActiveTab(2);
        setDoneTab(1);
        await sysMsg("Does a Low-Level Design (LLD) document already exist for this product?", "lldChoice");
        break;
      }
      case "lldUrl": {
        setActiveTab(2);
        await sysMsg("Please share the LLD document link:");
        setInputDisabled(false);
        setInputPlaceholder("https://docs.google.com/...");
        break;
      }
      case "lldQuestion": {
        const q = LLD_QUESTIONS[lldIndex];
        if (!q) { goStep("review"); return; }
        setActiveTab(q.tab);
        setDoneTab(Math.max(doneTab, q.tab - 1));
        await sysMsg(null, `lldQ_${q.id}`);
        if (q.type === "text") {
          setInputDisabled(false);
          setInputPlaceholder("Type your answer...");
        }
        break;
      }
      case "review": {
        setActiveTab(10);
        setDoneTab(9);
        await sysMsg("Here's a summary of everything we've collected:", "reviewSummary");
        break;
      }
      case "done": {
        await sysMsg("Project submitted for sanction! Redirecting...");
        setSubmitted(true);
        setTimeout(() => { onClose(); }, 1500);
        break;
      }
      default: break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lldIndex, doneTab, sysMsg, onClose]);

  const goBack = () => {
    const prev = stepHistory.current.pop();
    if (!prev) return;
    if (prev === "lldQuestion" && lldIndex > 0) {
      setLldIndex(i => i - 1);
    }
    goStep(prev, true);
  };

  const handleSkip = () => {
    if (currentStep === "lldQuestion") {
      const next = lldIndex + 1;
      if (next >= 30) { goStep("review"); }
      else { setLldIndex(next); goStep("lldQuestion"); }
    }
  };

  /* ─── START ────────────────────────────────────────────────────*/
  const started = useRef(false);
  useEffect(() => {
    if (isOpen && !started.current) {
      started.current = true;
      goStep("init");
    }
  }, [isOpen, goStep]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      started.current = false;
      setMessages([]);
      setCurrentStep("init");
      setData({ clientName:"",clientId:"",contactName:"",contactEmail:"",projectName:"",projectTag:"engineering",projectId:"",startDate:"",endDate:"",lldExists:null,lldUrl:"",lldAnswers:Array(30).fill("") });
      setLldIndex(0);
      setActiveTab(0);
      setDoneTab(-1);
      setSubmitted(false);
      stepHistory.current = [];
    }
  }, [isOpen]);

  /* ─── SUBMIT TEXT ──────────────────────────────────────────────*/
  const handleSend = () => {
    const val = inputValue.trim();
    if (!val || inputDisabled) return;
    addMsg("user", val);
    setInputValue("");
    setInputDisabled(true);

    switch (currentStep) {
      case "init":
        setData(d => ({ ...d, clientName: val }));
        setTimeout(() => goStep("clientId"), 100);
        break;
      case "contact":
        setData(d => ({ ...d, contactName: val }));
        setTimeout(() => goStep("contactEmail"), 100);
        break;
      case "contactEmail":
        setData(d => ({ ...d, contactEmail: val }));
        setTimeout(() => goStep("projectName"), 100);
        break;
      case "projectName":
        setData(d => ({ ...d, projectName: val }));
        setTimeout(() => goStep("projectTag"), 100);
        break;
      case "lldUrl":
        setData(d => ({ ...d, lldUrl: val }));
        setTimeout(() => goStep("review"), 100);
        break;
      case "lldQuestion": {
        setData(d => {
          const a = [...d.lldAnswers];
          a[lldIndex] = val;
          return { ...d, lldAnswers: a };
        });
        const next = lldIndex + 1;
        if (next >= 30) setTimeout(() => goStep("review"), 100);
        else { setLldIndex(next); setTimeout(() => goStep("lldQuestion"), 100); }
        break;
      }
      default: break;
    }
  };

  /* ─── SUBMIT PROJECT ───────────────────────────────────────────*/
  const submitProject = async () => {
    setInputDisabled(true);
    addMsg("user", "Submit for Sanction");

    const projectId = data.projectId;
    const { data: proj, error: pe } = await supabase.from("projects").insert({
      name:             data.projectName,
      project_id:       projectId,
      product_ids:      [],
      client_name:      data.clientName || null,
      client_id:        data.clientId || null,
      project_tag:      data.projectTag || "engineering",
      description:      null,
      start_date:       data.startDate || null,
      end_date:         data.endDate || null,
      rag:              "amber",
      sanctioned:       false,
      pending_sanction: true,
      checklist_config: {},
      created_by:       currentUser.id,
      lld_url:          data.lldUrl || null,
      lld_data:         data.lldExists ? null : { answers: data.lldAnswers, contact: data.contactName, email: data.contactEmail },
    }).select().single();

    if (pe) {
      await sysMsg(`Error creating project: ${pe.message}. Please try again.`);
      return;
    }

    // Insert default checklists
    const clRows = [
      { project_id:proj.id, key:"pm_milestone",    base_key:"pm_milestone",    label:projectId+"_PM / Milestone Checklist", icon:"🎯", order_index:0 },
      { project_id:proj.id, key:"hw_design",       base_key:"hw_design",       label:projectId+"_GW / Hardware Checklist",  icon:"⬡", order_index:1 },
      { project_id:proj.id, key:"hw_testing",      base_key:"hw_testing",      label:projectId+"_Hardware Testing Checklist", icon:"🔬", order_index:2 },
      { project_id:proj.id, key:"fw_logic",        base_key:"fw_logic",        label:projectId+"_Firmware — Logic Checklist", icon:"◈", order_index:3 },
      { project_id:proj.id, key:"fw_testing",      base_key:"fw_testing",      label:projectId+"_Firmware Testing Checklist", icon:"🧪", order_index:4 },
      { project_id:proj.id, key:"id_design",       base_key:"id_design",       label:projectId+"_Industrial Design Checklist", icon:"◉", order_index:5 },
      { project_id:proj.id, key:"id_testing",      base_key:"id_testing",      label:projectId+"_Industrial Design Testing Checklist", icon:"📐", order_index:6 },
      { project_id:proj.id, key:"overall_testing",  base_key:"overall_testing",  label:projectId+"_Overall Testing",          icon:"✅", order_index:7 },
      { project_id:proj.id, key:"production",       base_key:"production",       label:projectId+"_Production Checklist",     icon:"🏭", order_index:8 },
    ];
    await supabase.from("checklists").insert(clRows);

    if (onProjectCreated) {
      onProjectCreated({
        ...proj,
        projectId: proj.project_id,
        projectTag: proj.project_tag,
        clientName: proj.client_name,
        clientId: proj.client_id,
        startDate: proj.start_date,
        endDate: proj.end_date,
        pendingSanction: proj.pending_sanction,
        checklistConfig: {},
        teamAssignments: [],
        checklists: {},
        customChecklists: {},
        communications: [],
        notifications: [],
        productIds: [],
      });
    }

    goStep("done");
  };

  /* ─── PROGRESS ─────────────────────────────────────────────────*/
  const totalSteps = 10 + (data.lldExists === false ? 30 : 0);
  const currentQ = (() => {
    const base = { init:1, clientId:2, contact:3, contactEmail:4, projectName:5, projectTag:6, projectIdGen:7, startDate:8, endDate:9, lldChoice:10 };
    if (base[currentStep]) return base[currentStep];
    if (currentStep === "lldUrl") return 11;
    if (currentStep === "lldQuestion") return 10 + lldIndex + 1;
    if (currentStep === "review" || currentStep === "done") return totalSteps;
    return 0;
  })();
  const progressPct = totalSteps > 0 ? Math.round((currentQ / totalSteps) * 100) : 0;

  /* ─── INLINE WIDGETS ───────────────────────────────────────────*/
  const ClientIdWidget = () => {
    const [industry, setIndustry] = useState(INDUSTRY_CODES[0].code);
    const [orgSize, setOrgSize] = useState(ORG_SIZES[0].code);
    const [count, setCount] = useState(1);
    const genId = `eb-${industry.toLowerCase()}-${orgSize.toLowerCase()}-${String(count).padStart(3,"0")}`;
    return (
      <div style={S.widget}>
        <div style={{ padding:"10px 18px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", fontSize:12, fontWeight:600, color:"#475569" }}>Client ID Generator</div>
        <div style={S.widgetInner}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <div style={S.miniLabel}>Client Name</div>
              <input style={{ ...S.miniInput, background:"#f1f5f9", color:"#64748b" }} value={data.clientName} readOnly />
            </div>
            <div>
              <div style={S.miniLabel}>Industry</div>
              <select style={S.miniInput} value={industry} onChange={e=>setIndustry(e.target.value)}>
                {INDUSTRY_CODES.map(i=><option key={i.code} value={i.code}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <div style={S.miniLabel}>Org Size</div>
              <select style={S.miniInput} value={orgSize} onChange={e=>setOrgSize(e.target.value)}>
                {ORG_SIZES.map(s=><option key={s.code} value={s.code}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <div style={S.miniLabel}>Count</div>
              <input type="number" min={1} style={S.miniInput} value={count} onChange={e=>setCount(Math.max(1,+e.target.value))} />
            </div>
          </div>
          <div style={{ padding:"10px 14px", background:"#f0f9ff", borderRadius:8, textAlign:"center", fontSize:18, fontWeight:800, fontFamily:"'IBM Plex Mono',monospace", color:"#1e3a8a", letterSpacing:"0.04em", marginBottom:12 }}>{genId}</div>
          <button style={{ ...S.primaryBtn, width:"100%" }} onClick={() => {
            setData(d=>({...d, clientId: genId}));
            addMsg("user", genId);
            setTimeout(()=>goStep("contact"), 100);
          }}>Use this Client ID →</button>
        </div>
      </div>
    );
  };

  const ProjectTagPicker = () => {
    const tags = [
      { key:"engineering", label:"Engineering Project", desc:"Hardware & firmware", icon:"⚡" },
      { key:"elecbits_product", label:"EB Product", desc:"Internal product dev", icon:"🔧" },
      { key:"modifier", label:"Modifier", desc:"Design modifications", icon:"✏️" },
    ];
    return (
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", maxWidth:"85%" }}>
        {tags.map(t => (
          <div key={t.key} style={S.optionCard(false)} onClick={() => {
            setData(d=>({...d, projectTag: t.key}));
            addMsg("user", t.label);
            setTimeout(()=>goStep("projectIdGen"), 100);
          }} onMouseEnter={e=>{ e.currentTarget.style.borderColor="#2563eb"; e.currentTarget.style.background="#eff6ff"; }} onMouseLeave={e=>{ e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#fff"; }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{t.icon}</div>
            <div style={{ fontWeight:700, fontSize:13, color:"#1e293b", marginBottom:2 }}>{t.label}</div>
            <div style={{ fontSize:11, color:"#64748b" }}>{t.desc}</div>
          </div>
        ))}
      </div>
    );
  };

  const ProjectIdWidget = () => {
    const now = new Date();
    const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
    const [count, setCount] = useState(1);
    const yymm = month.slice(2,4) + month.slice(5,7);
    const genId = `EB-${yymm}-${String(count).padStart(3,"0")}`;
    const isDuplicate = allProjects.some(p => p.projectId === genId);
    return (
      <div style={S.widget}>
        <div style={{ padding:"10px 18px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", fontSize:12, fontWeight:600, color:"#475569" }}>Project ID Generator</div>
        <div style={S.widgetInner}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <div style={S.miniLabel}>Start Month</div>
              <input type="month" style={S.miniInput} value={month} onChange={e=>setMonth(e.target.value)} />
            </div>
            <div>
              <div style={S.miniLabel}>Project Count</div>
              <input type="number" min={1} style={S.miniInput} value={count} onChange={e=>setCount(Math.max(1,+e.target.value))} />
            </div>
          </div>
          <div style={{ padding:"10px 14px", background:"#f0f9ff", borderRadius:8, textAlign:"center", marginBottom:4 }}>
            <div style={{ fontSize:18, fontWeight:800, fontFamily:"'IBM Plex Mono',monospace", color:"#1e3a8a", letterSpacing:"0.04em" }}>{genId}</div>
            <div style={{ fontSize:10, color:"#64748b", marginTop:4 }}>
              <span style={{ background:"#e0e7ff", padding:"2px 6px", borderRadius:4, fontWeight:600 }}>EB</span>
              {" — "}
              <span style={{ background:"#e0e7ff", padding:"2px 6px", borderRadius:4, fontWeight:600 }}>{yymm}</span>
              {" — "}
              <span style={{ background:"#e0e7ff", padding:"2px 6px", borderRadius:4, fontWeight:600 }}>{String(count).padStart(3,"0")}</span>
            </div>
          </div>
          {isDuplicate && <div style={{ fontSize:11, color:"#dc2626", marginBottom:8, fontWeight:600 }}>This ID already exists. Change the count.</div>}
          <button style={{ ...S.primaryBtn, width:"100%", marginTop:8, opacity:isDuplicate?0.5:1 }} disabled={isDuplicate} onClick={() => {
            setData(d=>({...d, projectId: genId}));
            addMsg("user", genId);
            setTimeout(()=>goStep("startDate"), 100);
          }}>Use this Project ID →</button>
        </div>
      </div>
    );
  };

  const DateChips = ({ type }) => {
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0,10);
    const addDays = (d,n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
    const addMonths = (d,n) => { const r = new Date(d); r.setMonth(r.getMonth()+n); return r; };
    const [custom, setCustom] = useState("");

    const chips = type === "start"
      ? [{ label:"Today", val:fmt(today) }, { label:"Next week", val:fmt(addDays(today,7)) }, { label:"Next month", val:fmt(addMonths(today,1)) }]
      : [{ label:"3 months", val:fmt(addMonths(today,3)) }, { label:"6 months", val:fmt(addMonths(today,6)) }, { label:"1 year", val:fmt(addMonths(today,12)) }, { label:"TBD", val:"" }];

    const pick = (val, label) => {
      const key = type === "start" ? "startDate" : "endDate";
      setData(d => ({ ...d, [key]: val }));
      addMsg("user", label + (val ? ` (${val})` : ""));
      setTimeout(() => goStep(type === "start" ? "endDate" : "lldChoice"), 100);
    };

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:10, maxWidth:"85%" }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {chips.map(c => <button key={c.label} style={S.chip(false)} onClick={() => pick(c.val, c.label)}>{c.label}</button>)}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <input type="date" style={{ ...S.miniInput, flex:1 }} value={custom} onChange={e => setCustom(e.target.value)} />
          <button style={S.primaryBtn} onClick={() => { if (custom) pick(custom, custom); }}>Set</button>
        </div>
      </div>
    );
  };

  const LldChoiceCards = () => (
    <div style={{ display:"flex", gap:10, flexWrap:"wrap", maxWidth:"85%" }}>
      <div style={S.optionCard(false)} onClick={() => { setData(d=>({...d, lldExists:true})); addMsg("user","Yes, LLD already exists"); setTimeout(()=>goStep("lldUrl"),100); }}
        onMouseEnter={e=>{ e.currentTarget.style.borderColor="#2563eb"; e.currentTarget.style.background="#eff6ff"; }} onMouseLeave={e=>{ e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#fff"; }}>
        <div style={{ fontSize:24, marginBottom:6 }}>📄</div>
        <div style={{ fontWeight:700, fontSize:13, color:"#1e293b" }}>Yes, LLD already exists</div>
        <div style={{ fontSize:11, color:"#64748b" }}>Share the document link</div>
      </div>
      <div style={S.optionCard(false)} onClick={() => { setData(d=>({...d, lldExists:false})); addMsg("user","No, let's create one now"); setLldIndex(0); setTimeout(()=>goStep("lldQuestion"),100); }}
        onMouseEnter={e=>{ e.currentTarget.style.borderColor="#2563eb"; e.currentTarget.style.background="#eff6ff"; }} onMouseLeave={e=>{ e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#fff"; }}>
        <div style={{ fontSize:24, marginBottom:6 }}>📝</div>
        <div style={{ fontWeight:700, fontSize:13, color:"#1e293b" }}>No, let's create one now</div>
        <div style={{ fontSize:11, color:"#64748b" }}>30 quick questions</div>
      </div>
    </div>
  );

  const LldQuestionBubble = ({ q }) => {
    const [showHint, setShowHint] = useState(false);

    const pickChip = (val) => {
      if (q.multi) {
        setMultiChips(prev => prev.includes(val) ? prev.filter(v=>v!==val) : [...prev, val]);
      } else {
        setData(d => { const a=[...d.lldAnswers]; a[lldIndex]=val; return {...d, lldAnswers:a}; });
        addMsg("user", val);
        const next = lldIndex + 1;
        if (next >= 30) setTimeout(() => goStep("review"), 100);
        else { setLldIndex(next); setTimeout(() => goStep("lldQuestion"), 100); }
      }
    };

    const confirmMulti = () => {
      const val = multiChips.join(", ");
      setData(d => { const a=[...d.lldAnswers]; a[lldIndex]=val; return {...d, lldAnswers:a}; });
      addMsg("user", val);
      setMultiChips([]);
      const next = lldIndex + 1;
      if (next >= 30) setTimeout(() => goStep("review"), 100);
      else { setLldIndex(next); setTimeout(() => goStep("lldQuestion"), 100); }
    };

    return (
      <div style={{ maxWidth:"85%", display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ display:"flex", gap:8 }}>
          <div style={S.sysAvatar}>EB</div>
          <div style={{ ...S.msgBubble(false), display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#2563eb" }}>Q{q.id} of 30</div>
            <div>{q.text}</div>
            <button style={{ ...S.link, color:"#2563eb", fontSize:11, textAlign:"left" }} onClick={()=>setShowHint(!showHint)}>💡 {showHint?"Hide":"Why we ask this"}</button>
            {showHint && <div style={{ fontSize:12, color:"#64748b", background:"#f8fafc", padding:"8px 10px", borderRadius:6, borderLeft:"3px solid #2563eb" }}>{q.hint}</div>}
          </div>
        </div>
        {q.type === "chips" && (
          <div style={{ marginLeft:36, display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {q.chips.map(c => <button key={c} style={S.chip(q.multi && multiChips.includes(c))} onClick={() => pickChip(c)}>{c}</button>)}
            </div>
            {q.multi && multiChips.length > 0 && (
              <button style={{ ...S.primaryBtn, alignSelf:"flex-start", fontSize:12 }} onClick={confirmMulti}>Confirm ({multiChips.length} selected) →</button>
            )}
          </div>
        )}
      </div>
    );
  };

  const ReviewSummary = () => (
    <div style={S.widget}>
      <div style={{ padding:"10px 18px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", fontSize:12, fontWeight:600, color:"#475569" }}>Project Summary</div>
      <div style={S.widgetInner}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, fontSize:13 }}>
          <div><span style={{ color:"#64748b" }}>Client:</span> <strong>{data.clientName}</strong></div>
          <div><span style={{ color:"#64748b" }}>Client ID:</span> <span style={{ fontFamily:"'IBM Plex Mono',monospace" }}>{data.clientId}</span></div>
          <div><span style={{ color:"#64748b" }}>Contact:</span> {data.contactName}</div>
          <div><span style={{ color:"#64748b" }}>Email:</span> {data.contactEmail}</div>
          <div style={{ gridColumn:"span 2", borderTop:"1px solid #e2e8f0", paddingTop:8, marginTop:4 }} />
          <div><span style={{ color:"#64748b" }}>Project:</span> <strong>{data.projectName}</strong></div>
          <div><span style={{ color:"#64748b" }}>Project ID:</span> <span style={{ fontFamily:"'IBM Plex Mono',monospace" }}>{data.projectId}</span></div>
          <div><span style={{ color:"#64748b" }}>Type:</span> {{ engineering:"Engineering", elecbits_product:"EB Product", modifier:"Modifier" }[data.projectTag]}</div>
          <div><span style={{ color:"#64748b" }}>Start:</span> {data.startDate || "TBD"}</div>
          <div><span style={{ color:"#64748b" }}>End:</span> {data.endDate || "TBD"}</div>
          <div><span style={{ color:"#64748b" }}>LLD:</span> {data.lldExists ? "Existing doc" : data.lldExists === false ? "Created via chat" : "—"}</div>
        </div>
        {data.lldExists === false && (
          <div style={{ marginTop:12, padding:"10px 14px", background:"#f0fdf4", borderRadius:8, fontSize:11, color:"#16a34a", fontWeight:600 }}>
            ✓ {data.lldAnswers.filter(a => a).length} of 30 LLD questions answered
          </div>
        )}
        {data.lldUrl && (
          <div style={{ marginTop:8, fontSize:12 }}><span style={{ color:"#64748b" }}>LLD URL:</span> <a href={data.lldUrl} target="_blank" rel="noreferrer" style={{ color:"#2563eb" }}>{data.lldUrl}</a></div>
        )}
        <button style={{ ...S.primaryBtn, width:"100%", marginTop:16, padding:"12px 20px", fontSize:14, background:"linear-gradient(135deg, #16a34a, #15803d)" }}
          onClick={submitProject} disabled={submitted}>
          {submitted ? "Submitting..." : "Submit for Sanction →"}
        </button>
      </div>
    </div>
  );

  /* ─── RENDER ELEMENT ───────────────────────────────────────────*/
  const renderElement = (el) => {
    if (!el) return null;
    if (el === "clientIdWidget") return <ClientIdWidget />;
    if (el === "projectTagPicker") return <ProjectTagPicker />;
    if (el === "projectIdWidget") return <ProjectIdWidget />;
    if (el === "startDatePicker") return <DateChips type="start" />;
    if (el === "endDatePicker") return <DateChips type="end" />;
    if (el === "lldChoice") return <LldChoiceCards />;
    if (el === "reviewSummary") return <ReviewSummary />;
    if (el.startsWith("lldQ_")) {
      const qId = parseInt(el.split("_")[1]);
      const q = LLD_QUESTIONS.find(x => x.id === qId);
      if (q) return <LldQuestionBubble q={q} />;
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Dot animation keyframes */}
      <style>{`@keyframes dotPulse{from{opacity:.3;transform:scale(.8)}to{opacity:1;transform:scale(1)}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>

      <div style={S.modal}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.headerTop}>
            <div style={S.headerLeft}>
              <div style={S.ebAvatar}>EB</div>
              <div>
                <div style={S.headerTitle}>Elecbits — New Project</div>
                <div style={S.headerSub}>AI-assisted project setup</div>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={S.badge}>Q {currentQ} of {totalSteps}</span>
              <button style={S.closeBtn} onClick={onClose}>✕</button>
            </div>
          </div>
          {/* Tab bar */}
          <div style={S.tabBar}>
            {TABS.map(t => (
              <button key={t.idx} style={S.tab(activeTab === t.idx, t.idx <= doneTab)}>{t.label}</button>
            ))}
          </div>
          {/* Progress */}
          <div style={S.progressWrap}><div style={S.progressFill(progressPct)} /></div>
        </div>

        {/* Messages */}
        <div ref={bodyRef} style={S.body}>
          {messages.map(msg => {
            if (msg.element) {
              return <div key={msg.id} style={{ animation:"fadeUp .25s ease both" }}>{renderElement(msg.element)}</div>;
            }
            const isUser = msg.role === "user";
            return (
              <div key={msg.id} style={S.msgRow(isUser)}>
                {!isUser && <div style={S.sysAvatar}>EB</div>}
                <div style={S.msgBubble(isUser)}>{msg.content}</div>
              </div>
            );
          })}
          {/* Typing indicator */}
          {typing && (
            <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
              <div style={S.sysAvatar}>EB</div>
              <div style={{ ...S.msgBubble(false), display:"flex", gap:4, padding:"14px 20px" }}>
                <div style={S.dot(0)} /><div style={S.dot(1)} /><div style={S.dot(2)} />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={S.inputArea}>
          <button style={S.link} onClick={goBack}>← Back</button>
          <input
            ref={inputRef}
            style={S.textInput}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
            placeholder={inputPlaceholder}
            disabled={inputDisabled}
            onFocus={e => { e.target.style.borderColor="#2563eb"; }}
            onBlur={e => { e.target.style.borderColor="#e2e8f0"; }}
          />
          <button style={{ ...S.sendBtn, opacity:inputDisabled?0.4:1 }} disabled={inputDisabled} onClick={handleSend}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
          <button style={S.link} onClick={handleSkip}>Skip →</button>
        </div>
      </div>
    </div>
  );
};

export default ProjectCreationChat;
