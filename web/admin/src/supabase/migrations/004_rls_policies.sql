-- =============================================================================
-- MIGRATION 004: RLS Policies
-- Description: Verbatim security layer for all public tables.
-- =============================================================================

-- =============================================================================
-- MIGRATION 004: RLS Policies
-- Description: Verbatim 44 security policies from production.
-- =============================================================================

-- =============================================================================
-- TABLES: Enable RLS
-- =============================================================================
ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.box_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- POLICIES: ADMIN & AUDIT
-- =============================================================================
CREATE POLICY "Public can check admin accounts" ON public.admin_accounts FOR SELECT TO public USING (true);
CREATE POLICY "Superadmins can manage admin accounts" ON public.admin_accounts FOR ALL TO public USING (is_superadmin());

CREATE POLICY "Superadmins can read audit logs." ON public.audit_log FOR SELECT TO public USING (is_superadmin());
CREATE POLICY "audit_log_service_insert" ON public.audit_log FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "audit_log_service_read_only" ON public.audit_log FOR SELECT TO public USING (auth.role() = 'service_role');

CREATE POLICY "Audit logs are immutable" ON public.audit_logs FOR UPDATE TO public USING (false);
CREATE POLICY "Audit logs cannot be deleted" ON public.audit_logs FOR DELETE TO public USING (false);
CREATE POLICY "audit_logs_service_read" ON public.audit_logs FOR SELECT TO public USING (auth.role() = 'service_role');
CREATE POLICY "superadmins_read_audit" ON public.audit_logs FOR SELECT TO public USING (is_superadmin());

-- =============================================================================
-- POLICIES: BUSINESS LOGIC
-- =============================================================================
CREATE POLICY "Admins can manage all bookings" ON public.bookings FOR ALL TO public USING (is_admin());
CREATE POLICY "Users can create bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own bookings" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Allow public access" ON public.bookings FOR ALL TO public USING (true);

CREATE POLICY "Admins can manage box pricing" ON public.box_pricing FOR ALL TO public USING (is_admin());
CREATE POLICY "Public can view box pricing" ON public.box_pricing FOR SELECT TO public USING (true);

CREATE POLICY "Users can create challenges" ON public.challenges FOR INSERT TO authenticated WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "Users can view all challenges" ON public.challenges FOR SELECT TO public USING (true);
CREATE POLICY "Challengers can update their own challenges" ON public.challenges FOR UPDATE TO public USING (((auth.uid())::text = (challenger_id)::text)) WITH CHECK (((auth.uid())::text = (challenger_id)::text));

CREATE POLICY "authenticated_chat_access" ON public.chat_messages FOR ALL TO authenticated USING ((auth.uid() IS NOT NULL));

CREATE POLICY "Admin Manage Closures" ON public.closures FOR ALL TO public USING (is_admin());
CREATE POLICY "Public Read Closures" ON public.closures FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage locations" ON public.locations FOR ALL TO public USING (is_admin());
CREATE POLICY "Public can view locations" ON public.locations FOR SELECT TO public USING (true);

-- =============================================================================
-- POLICIES: FEEDBACK & NOTIFICATIONS
-- =============================================================================
CREATE POLICY "Everyone can view ratings" ON public.ratings FOR SELECT TO public USING (true);
CREATE POLICY "insert_own_rating" ON public.ratings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view all reviews" ON public.reviews FOR SELECT TO public USING (true);
CREATE POLICY "insert_own_review" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_read_all" ON public.notifications FOR SELECT TO public USING (true);
CREATE POLICY "notifications_update_all" ON public.notifications FOR UPDATE TO public USING (true);
CREATE POLICY "notifications_delete_all" ON public.notifications FOR DELETE TO public USING (true);

-- =============================================================================
-- POLICIES: PROFILES & USERS
-- =============================================================================
CREATE POLICY "public_read_users" ON public.users FOR SELECT USING (true);
CREATE POLICY "update_own_user" ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles_read_all" ON public.user_profiles FOR SELECT TO public USING (true);
CREATE POLICY "user_profiles_update_own_limited" ON public.user_profiles FOR UPDATE TO public USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "user_profiles_update_role_by_superadmin" ON public.user_profiles FOR UPDATE TO public USING (is_superadmin()) WITH CHECK (is_superadmin() AND true);
CREATE POLICY "user_profiles_insert_own" ON public.user_profiles FOR INSERT TO public WITH CHECK (auth.uid() = id);

-- =============================================================================
-- POLICIES: JOIN REQUESTS
-- =============================================================================
CREATE POLICY "Users can create join requests" ON public.join_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can view their own join requests" ON public.join_requests FOR SELECT TO authenticated USING (auth.uid() = requester_id);
CREATE POLICY "Hosts can view join requests for their bookings" ON public.join_requests FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM bookings WHERE id = booking_id));
CREATE POLICY "Hosts can update join requests for their bookings" ON public.join_requests FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM bookings WHERE id = booking_id));
CREATE POLICY "Users can delete their own pending requests" ON public.join_requests FOR DELETE TO authenticated USING (auth.uid() = requester_id AND status = 'pending');
CREATE POLICY "Allow public select for joining" ON public.join_requests FOR SELECT TO public USING (true);
