--
-- BelConnect PostgreSQL Consolidated Database Schema
-- Generated for CityConnect Monorepo
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: public.addresses
CREATE TABLE IF NOT EXISTS public.addresses (
    id CHARACTER VARYING NOT NULL,
    user_id CHARACTER VARYING,
    type CHARACTER VARYING NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    latitude NUMERIC,
    longitude NUMERIC,
    place_id TEXT,
    location_accuracy NUMERIC,
    house_number TEXT,
    building_name TEXT,
    floor TEXT,
    landmark TEXT,
    locality TEXT,
    city TEXT,
    state TEXT,
    pincode CHARACTER VARYING,
    delivery_instructions TEXT
);

-- Table: public.bookings
CREATE TABLE IF NOT EXISTS public.bookings (
    id CHARACTER VARYING NOT NULL,
    customer_id CHARACTER VARYING,
    provider_id CHARACTER VARYING,
    provider_name CHARACTER VARYING,
    service_name CHARACTER VARYING NOT NULL,
    category CHARACTER VARYING NOT NULL,
    date CHARACTER VARYING NOT NULL,
    time CHARACTER VARYING NOT NULL,
    status CHARACTER VARYING NOT NULL,
    rating INTEGER,
    review_comment TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    service_address_id CHARACTER VARYING,
    destination_latitude NUMERIC,
    destination_longitude NUMERIC,
    destination_place_id TEXT,
    destination_address TEXT,
    destination_landmark TEXT,
    destination_instructions TEXT,
    provider_current_latitude NUMERIC,
    provider_current_longitude NUMERIC,
    provider_location_updated_at TIMESTAMP WITH TIME ZONE,
    provider_location_accuracy NUMERIC,
    customer_current_latitude NUMERIC,
    customer_current_longitude NUMERIC,
    customer_location_updated_at TIMESTAMP WITH TIME ZONE,
    customer_location_accuracy NUMERIC,
    cancellation_reason TEXT,
    cancellation_note TEXT,
    cancelled_by CHARACTER VARYING,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Table: public.business_profiles
CREATE TABLE IF NOT EXISTS public.business_profiles (
    id CHARACTER VARYING NOT NULL,
    job_provider_id CHARACTER VARYING NOT NULL,
    company_name CHARACTER VARYING NOT NULL,
    industry CHARACTER VARYING,
    company_size CHARACTER VARYING,
    city CHARACTER VARYING DEFAULT 'Belagavi'::character varying,
    office_address TEXT,
    website CHARACTER VARYING,
    contact_email CHARACTER VARYING,
    contact_phone CHARACTER VARYING,
    about_company TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: public.call_reports
CREATE TABLE IF NOT EXISTS public.call_reports (
    id CHARACTER VARYING NOT NULL,
    call_id CHARACTER VARYING,
    reporter_id CHARACTER VARYING NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: public.calls
CREATE TABLE IF NOT EXISTS public.calls (
    id CHARACTER VARYING NOT NULL,
    caller_id CHARACTER VARYING NOT NULL,
    receiver_id CHARACTER VARYING NOT NULL,
    booking_id CHARACTER VARYING,
    status CHARACTER VARYING NOT NULL,
    started_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP WITHOUT TIME ZONE,
    ended_at TIMESTAMP WITHOUT TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_reason CHARACTER VARYING,
    ended_by_user_id CHARACTER VARYING,
    ended_by_role CHARACTER VARYING
);

-- Table: public.conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id CHARACTER VARYING NOT NULL,
    customer_id CHARACTER VARYING,
    provider_id CHARACTER VARYING,
    booking_id CHARACTER VARYING,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: public.customers
CREATE TABLE IF NOT EXISTS public.customers (
    id CHARACTER VARYING NOT NULL,
    email CHARACTER VARYING NOT NULL,
    name CHARACTER VARYING NOT NULL,
    phone CHARACTER VARYING,
    avatar TEXT,
    password_hash CHARACTER VARYING,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    google_id CHARACTER VARYING
);

-- Table: public.device_push_tokens
CREATE TABLE IF NOT EXISTS public.device_push_tokens (
    id CHARACTER VARYING NOT NULL,
    user_id CHARACTER VARYING NOT NULL,
    token TEXT NOT NULL,
    platform CHARACTER VARYING DEFAULT 'android'::character varying,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: public.google_mobile_handoffs
CREATE TABLE IF NOT EXISTS public.google_mobile_handoffs (
    code_hash TEXT NOT NULL,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role CHARACTER VARYING NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

-- Table: public.google_oauth_transactions
CREATE TABLE IF NOT EXISTS public.google_oauth_transactions (
    state_hash TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    account_type CHARACTER VARYING NOT NULL,
    code_verifier TEXT
);

-- Table: public.job_applications
CREATE TABLE IF NOT EXISTS public.job_applications (
    id CHARACTER VARYING NOT NULL,
    job_id CHARACTER VARYING NOT NULL,
    candidate_id CHARACTER VARYING NOT NULL,
    candidate_name CHARACTER VARYING NOT NULL,
    candidate_email CHARACTER VARYING NOT NULL,
    candidate_phone CHARACTER VARYING,
    experience CHARACTER VARYING,
    location CHARACTER VARYING,
    resume_url TEXT,
    cover_note TEXT,
    status CHARACTER VARYING DEFAULT 'new'::character varying,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: public.job_interviews
CREATE TABLE IF NOT EXISTS public.job_interviews (
    id CHARACTER VARYING NOT NULL,
    job_id CHARACTER VARYING NOT NULL,
    application_id CHARACTER VARYING NOT NULL,
    job_provider_id CHARACTER VARYING NOT NULL,
    candidate_id CHARACTER VARYING NOT NULL,
    candidate_name CHARACTER VARYING NOT NULL,
    job_title CHARACTER VARYING NOT NULL,
    interview_date DATE NOT NULL,
    interview_time CHARACTER VARYING NOT NULL,
    interview_mode CHARACTER VARYING DEFAULT 'Video'::character varying,
    meeting_link TEXT,
    location_details TEXT,
    status CHARACTER VARYING DEFAULT 'scheduled'::character varying,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: public.job_providers
CREATE TABLE IF NOT EXISTS public.job_providers (
    id CHARACTER VARYING NOT NULL,
    email CHARACTER VARYING NOT NULL,
    name CHARACTER VARYING NOT NULL,
    phone CHARACTER VARYING,
    avatar TEXT,
    password_hash CHARACTER VARYING,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    google_id CHARACTER VARYING
);

-- Table: public.job_saved_jobs
CREATE TABLE IF NOT EXISTS public.job_saved_jobs (
    id CHARACTER VARYING NOT NULL,
    user_id CHARACTER VARYING NOT NULL,
    job_id CHARACTER VARYING NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: public.jobs
CREATE TABLE IF NOT EXISTS public.jobs (
    id CHARACTER VARYING NOT NULL,
    job_provider_id CHARACTER VARYING NOT NULL,
    title CHARACTER VARYING NOT NULL,
    category CHARACTER VARYING NOT NULL,
    job_type CHARACTER VARYING NOT NULL,
    work_mode CHARACTER VARYING DEFAULT 'On-site'::character varying,
    location CHARACTER VARYING NOT NULL,
    salary_type CHARACTER VARYING DEFAULT 'Competitive'::character varying,
    salary_min NUMERIC,
    salary_max NUMERIC,
    salary_currency CHARACTER VARYING DEFAULT 'INR'::character varying,
    salary_text CHARACTER VARYING,
    openings INTEGER DEFAULT 1,
    experience_required CHARACTER VARYING,
    education_required CHARACTER VARYING,
    description TEXT NOT NULL,
    responsibilities TEXT,
    requirements TEXT,
    perks_benefits TEXT,
    deadline DATE,
    status CHARACTER VARYING DEFAULT 'active'::character varying,
    views_count INTEGER DEFAULT 0,
    is_boosted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: public.messages
CREATE TABLE IF NOT EXISTS public.messages (
    id CHARACTER VARYING NOT NULL,
    conversation_id CHARACTER VARYING,
    sender_id CHARACTER VARYING NOT NULL,
    sender_role CHARACTER VARYING NOT NULL,
    body TEXT,
    media_url TEXT,
    location_url TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    message_type CHARACTER VARYING DEFAULT 'text'::character varying,
    is_deleted_from_ui BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITHOUT TIME ZONE
);

-- Table: public.notification_logs
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id CHARACTER VARYING NOT NULL,
    user_id CHARACTER VARYING NOT NULL,
    booking_id CHARACTER VARYING NOT NULL,
    type CHARACTER VARYING NOT NULL,
    channel CHARACTER VARYING NOT NULL,
    status CHARACTER VARYING NOT NULL,
    provider_message_id CHARACTER VARYING,
    error_message TEXT,
    attempt_count INTEGER DEFAULT 1,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: public.notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id CHARACTER VARYING NOT NULL,
    user_id CHARACTER VARYING NOT NULL,
    type CHARACTER VARYING NOT NULL,
    title CHARACTER VARYING NOT NULL,
    body TEXT NOT NULL,
    booking_id CHARACTER VARYING,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: public.password_reset_otps
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
    id CHARACTER VARYING NOT NULL,
    user_id CHARACTER VARYING NOT NULL,
    user_table CHARACTER VARYING NOT NULL,
    email CHARACTER VARYING NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    used_at TIMESTAMP WITH TIME ZONE,
    attempt_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: public.password_reset_sessions
CREATE TABLE IF NOT EXISTS public.password_reset_sessions (
    id CHARACTER VARYING NOT NULL,
    user_id CHARACTER VARYING NOT NULL,
    user_table CHARACTER VARYING NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: public.push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id CHARACTER VARYING NOT NULL,
    user_id CHARACTER VARYING NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: public.service_providers
CREATE TABLE IF NOT EXISTS public.service_providers (
    id CHARACTER VARYING NOT NULL,
    email CHARACTER VARYING NOT NULL,
    name CHARACTER VARYING NOT NULL,
    phone CHARACTER VARYING,
    avatar TEXT,
    password_hash CHARACTER VARYING,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    kyc_document_type CHARACTER VARYING,
    kyc_document_number CHARACTER VARYING,
    kyc_document_photo TEXT,
    kyc_status CHARACTER VARYING DEFAULT 'Unverified'::character varying,
    is_verified BOOLEAN DEFAULT false,
    pan_number CHARACTER VARYING,
    aadhaar_number CHARACTER VARYING,
    google_id CHARACTER VARYING,
    is_available BOOLEAN DEFAULT false NOT NULL,
    verification_status CHARACTER VARYING DEFAULT 'unverified'::character varying NOT NULL,
    verified_at TIMESTAMP WITHOUT TIME ZONE,
    verified_by CHARACTER VARYING
);

-- Table: public.services
CREATE TABLE IF NOT EXISTS public.services (
    id CHARACTER VARYING NOT NULL,
    provider_id CHARACTER VARYING,
    name CHARACTER VARYING NOT NULL,
    category CHARACTER VARYING NOT NULL,
    subcategory CHARACTER VARYING,
    description TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX addresses_pkey ON public.addresses USING btree (id);
CREATE INDEX idx_addresses_lat_lng ON public.addresses USING btree (latitude, longitude);
CREATE UNIQUE INDEX bookings_pkey ON public.bookings USING btree (id);
CREATE INDEX idx_bookings_customer_created ON public.bookings USING btree (customer_id, created_at DESC NULLS LAST);
CREATE INDEX idx_bookings_customer_loc ON public.bookings USING btree (customer_location_updated_at);
CREATE INDEX idx_bookings_dest_lat_lng ON public.bookings USING btree (destination_latitude, destination_longitude);
CREATE INDEX idx_bookings_provider_created ON public.bookings USING btree (provider_id, created_at DESC NULLS LAST);
CREATE INDEX idx_bookings_provider_loc ON public.bookings USING btree (provider_location_updated_at);
CREATE INDEX idx_bookings_provider_location_updated_at ON public.bookings USING btree (provider_location_updated_at);
CREATE INDEX idx_bookings_provider_status ON public.bookings USING btree (provider_id, status);
CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);
CREATE UNIQUE INDEX business_profiles_pkey ON public.business_profiles USING btree (id);
CREATE UNIQUE INDEX uq_business_profile_provider ON public.business_profiles USING btree (job_provider_id);
CREATE UNIQUE INDEX call_reports_pkey ON public.call_reports USING btree (id);
CREATE UNIQUE INDEX calls_pkey ON public.calls USING btree (id);
CREATE INDEX idx_calls_booking ON public.calls USING btree (booking_id);
CREATE INDEX idx_calls_caller ON public.calls USING btree (caller_id);
CREATE INDEX idx_calls_caller_status ON public.calls USING btree (caller_id, status);
CREATE INDEX idx_calls_end_reason ON public.calls USING btree (end_reason);
CREATE INDEX idx_calls_ended_by_user_id ON public.calls USING btree (ended_by_user_id);
CREATE INDEX idx_calls_receiver ON public.calls USING btree (receiver_id);
CREATE INDEX idx_calls_receiver_status ON public.calls USING btree (receiver_id, status);
CREATE INDEX idx_calls_status ON public.calls USING btree (status);
CREATE UNIQUE INDEX conversations_pkey ON public.conversations USING btree (id);
CREATE INDEX idx_conversations_booking ON public.conversations USING btree (booking_id);
CREATE INDEX idx_conversations_customer ON public.conversations USING btree (customer_id);
CREATE INDEX idx_conversations_provider ON public.conversations USING btree (provider_id);
CREATE UNIQUE INDEX customers_email_key ON public.customers USING btree (email);
CREATE UNIQUE INDEX customers_google_id_key ON public.customers USING btree (google_id);
CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id);
CREATE UNIQUE INDEX device_push_tokens_pkey ON public.device_push_tokens USING btree (id);
CREATE UNIQUE INDEX device_push_tokens_token_key ON public.device_push_tokens USING btree (token);
CREATE INDEX idx_device_tokens_user_id ON public.device_push_tokens USING btree (user_id);
CREATE UNIQUE INDEX google_mobile_handoffs_pkey ON public.google_mobile_handoffs USING btree (code_hash);
CREATE INDEX idx_google_mobile_handoffs_expiry ON public.google_mobile_handoffs USING btree (expires_at);
CREATE UNIQUE INDEX google_oauth_transactions_pkey ON public.google_oauth_transactions USING btree (state_hash);
CREATE INDEX idx_google_oauth_transactions_expiry ON public.google_oauth_transactions USING btree (expires_at);
CREATE INDEX idx_job_apps_candidate ON public.job_applications USING btree (candidate_id);
CREATE INDEX idx_job_apps_job ON public.job_applications USING btree (job_id);
CREATE INDEX idx_job_apps_job_status ON public.job_applications USING btree (job_id, status);
CREATE INDEX idx_job_apps_status ON public.job_applications USING btree (status);
CREATE UNIQUE INDEX job_applications_pkey ON public.job_applications USING btree (id);
CREATE UNIQUE INDEX uq_job_candidate ON public.job_applications USING btree (job_id, candidate_id);
CREATE INDEX idx_job_interviews_candidate ON public.job_interviews USING btree (candidate_id);
CREATE INDEX idx_job_interviews_provider ON public.job_interviews USING btree (job_provider_id);
CREATE INDEX idx_job_interviews_status ON public.job_interviews USING btree (status);
CREATE UNIQUE INDEX job_interviews_pkey ON public.job_interviews USING btree (id);
CREATE UNIQUE INDEX job_providers_email_key ON public.job_providers USING btree (email);
CREATE UNIQUE INDEX job_providers_google_id_key ON public.job_providers USING btree (google_id);
CREATE UNIQUE INDEX job_providers_pkey ON public.job_providers USING btree (id);
CREATE INDEX idx_saved_jobs_user ON public.job_saved_jobs USING btree (user_id);
CREATE UNIQUE INDEX job_saved_jobs_pkey ON public.job_saved_jobs USING btree (id);
CREATE UNIQUE INDEX uq_saved_job ON public.job_saved_jobs USING btree (user_id, job_id);
CREATE INDEX idx_jobs_category ON public.jobs USING btree (category);
CREATE INDEX idx_jobs_created_at ON public.jobs USING btree (created_at DESC);
CREATE INDEX idx_jobs_deadline ON public.jobs USING btree (deadline);
CREATE INDEX idx_jobs_provider ON public.jobs USING btree (job_provider_id);
CREATE INDEX idx_jobs_provider_status ON public.jobs USING btree (job_provider_id, status);
CREATE INDEX idx_jobs_status ON public.jobs USING btree (status);
CREATE INDEX idx_jobs_status_deadline ON public.jobs USING btree (status, deadline);
CREATE UNIQUE INDEX jobs_pkey ON public.jobs USING btree (id);
CREATE INDEX idx_messages_conv_created ON public.messages USING btree (conversation_id, created_at DESC);
CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id);
CREATE INDEX idx_messages_created ON public.messages USING btree (created_at);
CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_id);
CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id);
CREATE INDEX idx_notif_logs_booking_type ON public.notification_logs USING btree (booking_id, type, channel);
CREATE INDEX idx_notif_logs_status ON public.notification_logs USING btree (status);
CREATE INDEX idx_notif_logs_user ON public.notification_logs USING btree (user_id);
CREATE UNIQUE INDEX notification_logs_pkey ON public.notification_logs USING btree (id);
CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);
CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);
CREATE INDEX idx_pw_reset_otps_email ON public.password_reset_otps USING btree (email);
CREATE INDEX idx_pw_reset_otps_expires ON public.password_reset_otps USING btree (expires_at);
CREATE INDEX idx_pw_reset_otps_user ON public.password_reset_otps USING btree (user_id);
CREATE UNIQUE INDEX password_reset_otps_pkey ON public.password_reset_otps USING btree (id);
CREATE INDEX idx_pw_reset_sess_expires ON public.password_reset_sessions USING btree (expires_at);
CREATE INDEX idx_pw_reset_sess_user ON public.password_reset_sessions USING btree (user_id);
CREATE UNIQUE INDEX password_reset_sessions_pkey ON public.password_reset_sessions USING btree (id);
CREATE INDEX idx_push_sub_user_id ON public.push_subscriptions USING btree (user_id);
CREATE UNIQUE INDEX push_subscriptions_endpoint_key ON public.push_subscriptions USING btree (endpoint);
CREATE UNIQUE INDEX push_subscriptions_pkey ON public.push_subscriptions USING btree (id);
CREATE INDEX idx_service_providers_is_available ON public.service_providers USING btree (is_available);
CREATE INDEX idx_service_providers_verification_status ON public.service_providers USING btree (verification_status);
CREATE UNIQUE INDEX service_providers_email_key ON public.service_providers USING btree (email);
CREATE UNIQUE INDEX service_providers_google_id_key ON public.service_providers USING btree (google_id);
CREATE UNIQUE INDEX service_providers_pkey ON public.service_providers USING btree (id);
CREATE UNIQUE INDEX services_pkey ON public.services USING btree (id);