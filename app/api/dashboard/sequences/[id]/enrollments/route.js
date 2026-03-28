import { verifyDashboardAuth, unauthorizedResponse } from "../../../../../../lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request, { params }) {
  const { authorized, tenant_id } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;

  // Verify sequence belongs to tenant
  const { data: sequence } = await supabase
    .from("sequences")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenant_id)
    .single();

  if (!sequence) {
    return Response.json({ error: "Sequence not found" }, { status: 404 });
  }

  // Get enrollments with contact info and sender info
  const { data: enrollments, error } = await supabase
    .from("sequence_enrollments")
    .select(`
      id, status, current_step_order, enrolled_at, updated_at,
      contact_id,
      sender_user_id,
      contacts:contact_id ( id, email, first_name, last_name, status ),
      sender:sender_user_id ( id, email, name )
    `)
    .eq("sequence_id", id)
    .order("enrolled_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Flatten for the UI
  const rows = (enrollments || []).map((e) => ({
    id: e.contact_id,
    enrollment_id: e.id,
    email: e.contacts?.email,
    first_name: e.contacts?.first_name,
    last_name: e.contacts?.last_name,
    contact_status: e.contacts?.status,
    enrollment_status: e.status,
    current_step: e.current_step_order,
    enrolled_at: e.enrolled_at,
    sender_email: e.sender?.email,
    sender_name: e.sender?.name,
  }));

  return Response.json({ data: rows });
}
