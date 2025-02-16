CREATE TYPE adulting.invite_status AS ENUM ('pending', 'accepted', 'expired');

CREATE TABLE adulting.organization_invites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id int4 REFERENCES adulting.organizations(id),
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    invited_by int4 REFERENCES adulting.users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status adulting.invite_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS adulting.organization_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES adulting.organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES adulting.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON adulting.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON adulting.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON adulting.organization_members(role);
