import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ngxdukdmudtebykmihgw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGR1a2RtdWR0ZWJ5a21paGd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTU3MjMsImV4cCI6MjA5MDI3MTcyM30.i4QTf0nC_zvO5YtpdXNGQPMcib_yWeMbCXz9PNsL15s"
);

const PASSWORD = "Elecbits@123";

const TEAM = [
  { email:"saurav@elecbits.in",          name:"Saurav",           resource_role:"sr_pm", role:"superadmin", dept:"Project Management",    login_type:"superadmin" },
  { email:"shreya@elecbits.in",           name:"Shreya",           resource_role:"sr_pm", role:"superadmin", dept:"Project Management",    login_type:"superadmin" },
  { email:"akash.sharma@elecbits.in",     name:"Akash Sharma",     resource_role:"sr_pm", role:"pm",         dept:"Project Management",    login_type:"pm" },
  { email:"anunay.dixit@elecbits.in",     name:"Anunay Dixit",     resource_role:"sr_pm", role:"pm",         dept:"Project Management",    login_type:"pm" },
  { email:"jerom.johnshibu@elecbits.in",  name:"Jerom Johnshibu",  resource_role:"pm",    role:"pm",         dept:"Project Management",    login_type:"pm" },
  { email:"chhavi.bhatia@elecbits.in",    name:"Chhavi Bhatia",    resource_role:"pm",    role:"pm",         dept:"Project Management",    login_type:"pm" },
  { email:"nived.p@elecbits.in",          name:"Nived P",          resource_role:"pm",    role:"pm",         dept:"Project Management",    login_type:"pm" },
  { email:"arun.pratapsingh@elecbits.in", name:"Arun Mohan",       resource_role:"sr_hw", role:"developer",  dept:"Hardware",              login_type:"developer" },
  { email:"amitabh.gogoi@elecbits.in",    name:"Amitabh Gogoi",    resource_role:"sr_fw", role:"developer",  dept:"Firmware",              login_type:"developer" },
  { email:"yogesh@elecbits.in",           name:"Yogesh",           resource_role:"jr_hw", role:"developer",  dept:"Hardware",              login_type:"developer" },
  { email:"jeena.george@elecbits.in",     name:"Jeena George",     resource_role:"jr_hw", role:"developer",  dept:"Hardware",              login_type:"developer" },
  { email:"rahul.singh@elecbits.in",      name:"Rahul Singh",      resource_role:"jr_hw", role:"developer",  dept:"Hardware",              login_type:"developer" },
  { email:"sai.kiran@elecbits.in",        name:"Sai Kiran",        resource_role:"jr_fw", role:"developer",  dept:"Firmware",              login_type:"developer" },
  { email:"nethravathi.j@elecbits.in",    name:"Nethravathi J",    resource_role:"jr_fw", role:"developer",  dept:"Firmware",              login_type:"developer" },
  { email:"nethravathi.gk@elecbits.in",   name:"Nethravathi GK",   resource_role:"jr_fw", role:"developer",  dept:"Firmware",              login_type:"developer" },
  { email:"sheik.ayesha@elecbits.in",     name:"Ayesha Sheik",     resource_role:"jr_fw", role:"developer",  dept:"Firmware",              login_type:"developer" },
  { email:"syed.shigarf@elecbits.in",     name:"Syed Shigarf",     resource_role:"jr_fw", role:"developer",  dept:"Firmware",              login_type:"developer" },
  { email:"israfil.khan@elecbits.in",     name:"Israfil Khan",     resource_role:"jr_fw", role:"developer",  dept:"Firmware",              login_type:"developer" },
  { email:"sonu.kumar@elecbits.in",       name:"Sonu Kumar",       resource_role:"jr_fw", role:"developer",  dept:"Firmware",              login_type:"developer" },
  { email:"swati.saxena@elecbits.in",     name:"Swati Saxena",     resource_role:"jr_fw", role:"developer",  dept:"Firmware",              login_type:"developer" },
  { email:"anwer.suhail@elecbits.in",     name:"Anwer Suhail",     resource_role:"ind_design", role:"developer", dept:"Industrial Design", login_type:"developer" },
  { email:"nikhil@elecbits.in",           name:"Nikhil",           resource_role:"sol_arch", role:"superadmin", dept:"Solution Architecture", login_type:"superadmin" },
];

function initials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

async function main() {
  let created = 0, updated = 0, errors = [];

  for (const person of TEAM) {
    // 1. Check if user already exists in public.users
    const { data: existing, error: lookupErr } = await supabase
      .from("users")
      .select("id")
      .eq("email", person.email)
      .maybeSingle();

    if (lookupErr) {
      errors.push({ email: person.email, step: "lookup", msg: lookupErr.message });
      continue;
    }

    if (existing) {
      // 2a. User exists → update role fields
      const { error: updErr } = await supabase
        .from("users")
        .update({
          name:          person.name,
          resource_role: person.resource_role,
          role:          person.role,
          dept:          person.dept,
          login_type:    person.login_type,
        })
        .eq("id", existing.id);

      if (updErr) {
        errors.push({ email: person.email, step: "update", msg: updErr.message });
      } else {
        updated++;
        console.log(`✓ UPDATED  ${person.email}  →  role=${person.role}  resource_role=${person.resource_role}`);
      }
    } else {
      // 2b. User does not exist → signUp + insert
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: person.email,
        password: PASSWORD,
        options: { data: { name: person.name } },
      });

      if (authErr || !authData?.user) {
        errors.push({ email: person.email, step: "signUp", msg: authErr?.message || "No user returned" });
        continue;
      }

      const { error: insErr } = await supabase.from("users").insert({
        id:            authData.user.id,
        name:          person.name,
        email:         person.email,
        role:          person.role,
        resource_role: person.resource_role,
        dept:          person.dept,
        login_type:    person.login_type,
        avatar:        initials(person.name),
        max_projects:  2,
        skills:        [],
        project_tags:  ["engineering"],
      });

      if (insErr) {
        errors.push({ email: person.email, step: "insert", msg: insErr.message });
      } else {
        created++;
        console.log(`✓ CREATED  ${person.email}  →  role=${person.role}  resource_role=${person.resource_role}`);
      }
    }
  }

  // Summary
  console.log("\n══════════════════════════════════════");
  console.log(`  CREATED: ${created}`);
  console.log(`  UPDATED: ${updated}`);
  console.log(`  ERRORS:  ${errors.length}`);
  console.log("══════════════════════════════════════");
  if (errors.length) {
    console.log("\nError details:");
    errors.forEach(e => console.log(`  ✗ ${e.email} [${e.step}]: ${e.msg}`));
  }
}

main();
