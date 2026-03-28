import { supabase } from "./supabase.js";

/* ─── AUTH ─────────────────────────────────────────────────────*/
export const getSession = () => supabase.auth.getSession();
export const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
export const signOut = () => supabase.auth.signOut();
export const signUp = (email, password, meta) => supabase.auth.signUp({ email, password, options: { data: meta } });
export const onAuthStateChange = (cb) => supabase.auth.onAuthStateChange(cb);

/* ─── PROFILE ──────────────────────────────────────────────────*/
export const loadProfile = (uid) =>
  supabase.from("users").select("*,holidays!holidays_user_id_fkey(*)").eq("id", uid).single();

/* ─── PROJECTS ─────────────────────────────────────────────────*/
export const fetchProjectsFromDB = () =>
  supabase
    .from("projects")
    .select(`*, team_assignments ( *, users ( id, name, avatar, resource_role, dept, role ) ), checklists ( * )`)
    .order("created_at", { ascending: false });

export const createProject = (row) =>
  supabase.from("projects").insert(row).select().single();

export const updateProjectInDB = (id, fields) =>
  supabase.from("projects").update(fields).eq("id", id);

export const deleteProjectFromDB = (id) =>
  supabase.from("projects").delete().eq("id", id);

export const sanctionProjectInDB = (id, userId) =>
  supabase.from("projects").update({
    sanctioned: true,
    pending_sanction: false,
    sanctioned_at: new Date().toISOString(),
    sanctioned_by: userId,
  }).eq("id", id);

export const rejectProjectInDB = (id, reason, userId) =>
  supabase.from("projects").update({
    rejected: true,
    pending_sanction: false,
    sanctioned: false,
    rejected_at: new Date().toISOString(),
    rejected_reason: reason,
    rejected_by: userId,
  }).eq("id", id);

export const insertTeamAssignments = (rows) =>
  supabase.from("team_assignments").insert(rows);

export const insertChecklists = (rows) =>
  supabase.from("checklists").insert(rows);

export const getProjectUpdatedAt = (id) =>
  supabase.from("projects").select("updated_at").eq("id", id).single();

/* ─── USERS ────────────────────────────────────────────────────*/
export const fetchUsersFromDB = () =>
  supabase.from("users").select("*,holidays!holidays_user_id_fkey(*)").order("name");

export const insertUser = (row) =>
  supabase.from("users").insert(row).select("*,holidays!holidays_user_id_fkey(*)").single();

export const updateUserInDB = (id, fields) =>
  supabase.from("users").update(fields).eq("id", id).select("*,holidays!holidays_user_id_fkey(*)").single();

export const deleteUserFromDB = (id) =>
  supabase.from("users").delete().eq("id", id);

/* ─── HOLIDAYS ─────────────────────────────────────────────────*/
export const approveHolidayInDB = (hid, status, approvedBy) =>
  supabase.from("holidays").update({
    status,
    approved_by: approvedBy,
    approved_at: new Date().toISOString(),
  }).eq("id", hid);

/* ─── NOTIFICATIONS ────────────────────────────────────────────*/
export const fetchNotifications = (projectId, recipientId) =>
  supabase.from("notifications")
    .select("*")
    .eq("project_id", projectId)
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false });

export const insertNotifications = (rows) =>
  supabase.from("notifications").insert(rows);

export const markNotificationsSeen = (projectId, recipientId) =>
  supabase.from("notifications")
    .update({ seen: true })
    .eq("project_id", projectId)
    .eq("recipient_id", recipientId)
    .eq("seen", false);

export const deleteNotifications = (projectId, submittedBy) =>
  supabase.from("notifications")
    .delete()
    .eq("project_id", projectId)
    .eq("submitted_by", submittedBy);

export const markNotificationSeenById = (id) =>
  supabase.from("notifications").update({ seen: true }).eq("id", id);

/* ─── COMMUNICATIONS ──────────────────────────────────────────*/
export const fetchCommunications = (projectId) =>
  supabase.from("communications")
    .select("*, users(name,avatar)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

export const insertCommunication = (row) =>
  supabase.from("communications").insert(row).select("*").single();

export const updateCommunicationStatus = (id, status) =>
  supabase.from("communications").update({ status }).eq("id", id);

/* ─── HIRING PLAN ──────────────────────────────────────────────*/
export const fetchHiringPlan = () =>
  supabase.from("hiring_plan").select("*");

export const updateHiringTarget = (resourceRole, target) =>
  supabase.from("hiring_plan").update({ target }).eq("resource_role", resourceRole);

export const updateHiringMonthly = (resourceRole, monthly) =>
  supabase.from("hiring_plan").update({ monthly }).eq("resource_role", resourceRole);

/* ─── USER SETTINGS ────────────────────────────────────────────*/
export const updateUserWallpaper = (uid, wallpaper) =>
  supabase.from("users").update({ wallpaper }).eq("id", uid);
