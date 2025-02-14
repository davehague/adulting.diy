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