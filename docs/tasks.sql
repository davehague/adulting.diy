CREATE TABLE adulting.recurrence_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'monthly', 'monthly_by_weekday', 'yearly', 'custom')),
    interval INTEGER NOT NULL DEFAULT 1,
    scheduling_type TEXT NOT NULL CHECK (scheduling_type IN ('fixed', 'variable')),
    
    days_of_week TEXT[], -- Array of day codes
    weekday TEXT CHECK (weekday IN ('SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA')),
    week_of_month INTEGER CHECK (week_of_month IN (1, 2, 3, 4, -1)),
    
    end_type TEXT NOT NULL CHECK (end_type IN ('never', 'after', 'on_date')),
    end_after_occurrences INTEGER,
    end_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE adulting.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES adulting.organizations(id),
    title TEXT NOT NULL,
    description TEXT,
    
    initial_reminder INTEGER NOT NULL,
    follow_up_reminder INTEGER NOT NULL,
    overdue_reminder INTEGER NOT NULL,
    
    recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_pattern_id UUID REFERENCES adulting.recurrence_patterns(id),
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE adulting.task_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES adulting.tasks(id),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'overdue', 'skipped', 'in_progress')),
    
    assigned_to UUID[] NOT NULL DEFAULT '{}',  -- Array of user IDs
    executed_by UUID REFERENCES auth.users(id),
    executed_datetime TIMESTAMP WITH TIME ZONE,
    execution_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE adulting.task_occurrence_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_occurrence_id UUID NOT NULL REFERENCES adulting.task_occurrences(id),
    type TEXT NOT NULL CHECK (type IN ('initial', 'follow_up', 'overdue')),
    sent_at TIMESTAMP WITH TIME ZONE,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes
CREATE INDEX idx_tasks_organization ON adulting.tasks(organization_id);
CREATE INDEX idx_tasks_created_by ON adulting.tasks(created_by);
CREATE INDEX idx_tasks_recurrence ON adulting.tasks(recurrence_pattern_id) WHERE recurring = TRUE;

CREATE INDEX idx_task_occurrences_task ON adulting.task_occurrences(task_id);
CREATE INDEX idx_task_occurrences_due_date ON adulting.task_occurrences(due_date);
CREATE INDEX idx_task_occurrences_status ON adulting.task_occurrences(status);
CREATE INDEX idx_task_occurrences_executed_by ON adulting.task_occurrences(executed_by);

CREATE INDEX idx_notifications_occurrence ON adulting.task_occurrence_notifications(task_occurrence_id);
CREATE INDEX idx_notifications_scheduled ON adulting.task_occurrence_notifications(scheduled_for) WHERE sent_at IS NULL;

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION adulting.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON adulting.recurrence_patterns
FOR EACH ROW
EXECUTE PROCEDURE adulting.trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON adulting.tasks
FOR EACH ROW
EXECUTE PROCEDURE adulting.trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON adulting.task_occurrences
FOR EACH ROW
EXECUTE PROCEDURE adulting.trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON adulting.task_occurrence_notifications
FOR EACH ROW
EXECUTE PROCEDURE adulting.trigger_set_timestamp();

-- Enable RLS
ALTER TABLE adulting.recurrence_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE adulting.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE adulting.task_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE adulting.task_occurrence_notifications ENABLE ROW LEVEL SECURITY;