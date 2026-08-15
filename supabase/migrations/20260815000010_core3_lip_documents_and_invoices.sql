-- ============================================================================
-- SIM-SALUT Pangkalpinang Database Migration
-- MVP Core 3: LIP Documents, Invoices, Items & Private Storage
-- ============================================================================

-- 1. LIP DOCUMENTS TABLE (Official UT Financial Liability Document)
CREATE TABLE IF NOT EXISTS public.lip_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
    lip_number VARCHAR(100) NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL CHECK (version >= 1),
    official_amount BIGINT NOT NULL CHECK (official_amount >= 0),
    tuition_amount BIGINT DEFAULT 0 NOT NULL CHECK (tuition_amount >= 0),
    book_amount BIGINT DEFAULT 0 NOT NULL CHECK (book_amount >= 0),
    shipping_amount BIGINT DEFAULT 0 NOT NULL CHECK (shipping_amount >= 0),
    other_ut_amount BIGINT DEFAULT 0 NOT NULL CHECK (other_ut_amount >= 0),
    issued_at DATE NULL,
    due_at DATE NULL,
    storage_path TEXT NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    status VARCHAR(30) DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'pending_verification', 'verified', 'cancelled')),
    notes TEXT NULL,
    verified_at TIMESTAMPTZ NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ NULL,
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancellation_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    UNIQUE(registration_id, version)
);

-- Partial Unique Index: Max 1 active verified LIP per registration
CREATE UNIQUE INDEX IF NOT EXISTS idx_lip_unique_verified_per_reg
ON public.lip_documents (registration_id)
WHERE status = 'verified';

CREATE INDEX IF NOT EXISTS idx_lip_registration ON public.lip_documents (registration_id);
CREATE INDEX IF NOT EXISTS idx_lip_status ON public.lip_documents (status);
CREATE INDEX IF NOT EXISTS idx_lip_number ON public.lip_documents (lip_number);

-- 2. INVOICE NUMBER SEQUENCE & HELPER FUNCTION
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 10001;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
    v_year VARCHAR;
    v_seq BIGINT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    v_seq := NEXTVAL('public.invoice_number_seq');
    RETURN 'INV-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. INVOICES TABLE (Internal Student Bill Header)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL DEFAULT public.generate_invoice_number(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
    lip_document_id UUID NOT NULL REFERENCES public.lip_documents(id) ON DELETE RESTRICT,
    issued_at DATE DEFAULT CURRENT_DATE NOT NULL,
    due_at DATE NULL,
    status VARCHAR(20) DEFAULT 'unpaid' NOT NULL CHECK (status IN ('draft', 'unpaid', 'cancelled', 'partial', 'paid', 'overdue')),
    notes TEXT NULL,
    cancelled_at TIMESTAMPTZ NULL,
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancellation_reason TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Partial Unique Index: Max 1 active invoice per verified LIP
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_unique_active_per_lip
ON public.invoices (lip_document_id)
WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_invoices_registration ON public.invoices (registration_id);
CREATE INDEX IF NOT EXISTS idx_invoices_lip ON public.invoices (lip_document_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);

-- 4. INVOICE ITEMS TABLE (Auditable Itemized Billing Details)
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('ut_liability', 'service_fee', 'internal_fee', 'discount')),
    fee_type_id UUID REFERENCES public.fee_types(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1 NOT NULL CHECK (quantity > 0),
    unit_amount BIGINT NOT NULL CHECK (unit_amount >= 0),
    amount BIGINT NOT NULL CHECK (amount >= 0),
    source_type VARCHAR(30) DEFAULT 'manual' NOT NULL,
    source_id UUID NULL,
    approval_status VARCHAR(20) NULL CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approval_reason TEXT NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_type ON public.invoice_items (item_type);

-- 5. ATOMIC STORED PROCEDURE FOR INVOICE CREATION WITH ITEMS
CREATE OR REPLACE FUNCTION public.create_invoice_with_items(
    p_registration_id UUID,
    p_lip_document_id UUID,
    p_due_at DATE,
    p_notes TEXT,
    p_created_by UUID,
    p_items JSONB
)
RETURNS UUID AS $$
DECLARE
    v_invoice_id UUID;
    v_inv_number VARCHAR(50);
    v_item JSONB;
    v_actor_id UUID;
    v_lip_status VARCHAR(30);
BEGIN
    SET search_path = public, pg_temp;

    v_actor_id := COALESCE(auth.uid(), p_created_by);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated request to create_invoice_with_items';
    END IF;

    -- Verify that LIP document status is 'verified'
    SELECT status INTO v_lip_status FROM public.lip_documents WHERE id = p_lip_document_id;
    IF v_lip_status IS NULL OR v_lip_status <> 'verified' THEN
        RAISE EXCEPTION 'Invoice can only be issued for verified LIP documents';
    END IF;

    -- Generate Invoice Number
    v_inv_number := public.generate_invoice_number();

    -- Insert Invoice Header
    INSERT INTO public.invoices (
        invoice_number,
        registration_id,
        lip_document_id,
        due_at,
        status,
        notes,
        created_by,
        updated_by
    ) VALUES (
        v_inv_number,
        p_registration_id,
        p_lip_document_id,
        p_due_at,
        'unpaid',
        p_notes,
        v_actor_id,
        v_actor_id
    ) RETURNING id INTO v_invoice_id;

    -- Insert Invoice Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.invoice_items (
            invoice_id,
            item_type,
            fee_type_id,
            description,
            quantity,
            unit_amount,
            amount,
            source_type,
            source_id,
            approval_status,
            approval_reason,
            approved_by,
            approved_at,
            created_by
        ) VALUES (
            v_invoice_id,
            (v_item->>'item_type')::VARCHAR,
            (v_item->>'fee_type_id')::UUID,
            (v_item->>'description')::VARCHAR,
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_amount')::BIGINT,
            (v_item->>'quantity')::INTEGER * (v_item->>'unit_amount')::BIGINT,
            COALESCE(v_item->>'source_type', 'manual'),
            (v_item->>'source_id')::UUID,
            v_item->>'approval_status',
            v_item->>'approval_reason',
            (v_item->>'approved_by')::UUID,
            CASE WHEN v_item->>'approval_status' = 'approved' THEN NOW() ELSE NULL END,
            v_actor_id
        );
    END LOOP;

    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.lip_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Read policies for authenticated users
DROP POLICY IF EXISTS "Authenticated users can view lip_documents" ON public.lip_documents;
CREATE POLICY "Authenticated users can view lip_documents" ON public.lip_documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;
CREATE POLICY "Authenticated users can view invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view invoice_items" ON public.invoice_items;
CREATE POLICY "Authenticated users can view invoice_items" ON public.invoice_items FOR SELECT TO authenticated USING (true);

-- Write policies (Owner and Academic Admin can manage LIP and issue Invoices)
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert lip_documents" ON public.lip_documents;
CREATE POLICY "Owner/AcademicAdmin can insert lip_documents" ON public.lip_documents FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can update lip_documents" ON public.lip_documents;
CREATE POLICY "Owner/AcademicAdmin can update lip_documents" ON public.lip_documents FOR UPDATE TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert invoices" ON public.invoices;
CREATE POLICY "Owner/AcademicAdmin can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can update invoices" ON public.invoices;
CREATE POLICY "Owner/AcademicAdmin can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can insert invoice_items" ON public.invoice_items;
CREATE POLICY "Owner/AcademicAdmin can insert invoice_items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can update invoice_items" ON public.invoice_items;
CREATE POLICY "Owner/AcademicAdmin can update invoice_items" ON public.invoice_items FOR UPDATE TO authenticated USING (public.get_current_user_role() IN ('owner', 'academic_admin'));

-- 7. PRIVATE STORAGE BUCKET SETUP (lip-documents)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lip-documents', 'lip-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated users can view lip storage objects" ON storage.objects;
CREATE POLICY "Authenticated users can view lip storage objects" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'lip-documents');
DROP POLICY IF EXISTS "Owner/AcademicAdmin can upload lip storage objects" ON storage.objects;
CREATE POLICY "Owner/AcademicAdmin can upload lip storage objects" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lip-documents' AND public.get_current_user_role() IN ('owner', 'academic_admin'));
DROP POLICY IF EXISTS "Owner/AcademicAdmin can update lip storage objects" ON storage.objects;
CREATE POLICY "Owner/AcademicAdmin can update lip storage objects" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'lip-documents' AND public.get_current_user_role() IN ('owner', 'academic_admin'));
