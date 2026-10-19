"""Private document review and bounded AI metadata; additive only."""
from alembic import op
revision = '20261019_01'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.execute('\nCREATE TABLE document_intelligence_documents (\n\tid INTEGER NOT NULL, \n\tstudent_pk INTEGER NOT NULL, \n\tduplicate_fingerprint VARCHAR(64), \n\tfilename VARCHAR(200), \n\tmime_type VARCHAR(150), \n\tbyte_size INTEGER NOT NULL, \n\tdocument_type VARCHAR(32) NOT NULL, \n\tclassification_status VARCHAR(24) NOT NULL, \n\ttext TEXT, \n\tstatus VARCHAR(24) NOT NULL, \n\tstorage_consent_at DATETIME NOT NULL, \n\texpires_at DATETIME NOT NULL, \n\tcreated_at DATETIME NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(student_pk) REFERENCES students (id) ON DELETE CASCADE\n)\n\n')
    op.execute('CREATE INDEX ix_document_intelligence_documents_duplicate_fingerprint ON document_intelligence_documents (duplicate_fingerprint)')
    op.execute('CREATE INDEX ix_document_intelligence_documents_expires_at ON document_intelligence_documents (expires_at)')
    op.execute('CREATE INDEX ix_document_intelligence_documents_student_pk ON document_intelligence_documents (student_pk)')
    op.execute('\nCREATE TABLE document_extractions (\n\tid INTEGER NOT NULL, \n\tdocument_id INTEGER NOT NULL, \n\tengine VARCHAR(24) NOT NULL, \n\tmodel VARCHAR(120), \n\tschema_version VARCHAR(40) NOT NULL, \n\tstatus VARCHAR(24) NOT NULL, \n\tresult_json JSON, \n\tai_consent_at DATETIME, \n\tcreated_at DATETIME NOT NULL, \n\texpires_at DATETIME NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(document_id) REFERENCES document_intelligence_documents (id) ON DELETE CASCADE\n)\n\n')
    op.execute('CREATE INDEX ix_document_extractions_document_id ON document_extractions (document_id)')
    op.execute('\nCREATE TABLE profile_update_proposals (\n\tid INTEGER NOT NULL, \n\tstudent_pk INTEGER NOT NULL, \n\tdocument_id INTEGER NOT NULL, \n\textraction_id INTEGER NOT NULL, \n\tstatus VARCHAR(24) NOT NULL, \n\tprofile_fingerprint VARCHAR(64), \n\tversion INTEGER NOT NULL, \n\tcreated_at DATETIME NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(student_pk) REFERENCES students (id) ON DELETE CASCADE, \n\tFOREIGN KEY(document_id) REFERENCES document_intelligence_documents (id) ON DELETE CASCADE, \n\tFOREIGN KEY(extraction_id) REFERENCES document_extractions (id)\n)\n\n')
    op.execute('CREATE INDEX ix_profile_update_proposals_document_id ON profile_update_proposals (document_id)')
    op.execute('CREATE INDEX ix_profile_update_proposals_student_pk ON profile_update_proposals (student_pk)')
    op.execute('\nCREATE TABLE profile_update_proposal_items (\n\tid INTEGER NOT NULL, \n\tproposal_id INTEGER NOT NULL, \n\tfield_path VARCHAR(80) NOT NULL, \n\toperation VARCHAR(24) NOT NULL, \n\tcurrent_value_json JSON, \n\tproposed_value_json JSON, \n\tevidence_json JSON, \n\tfact_kind VARCHAR(24) NOT NULL, \n\tcomparison_status VARCHAR(24) NOT NULL, \n\tdecision VARCHAR(24) NOT NULL, \n\tapplied_at DATETIME, \n\tapplied_value_json JSON, \n\tversion INTEGER NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(proposal_id) REFERENCES profile_update_proposals (id) ON DELETE CASCADE\n)\n\n')
    op.execute('CREATE INDEX ix_profile_update_proposal_items_proposal_id ON profile_update_proposal_items (proposal_id)')
    op.execute('\nCREATE TABLE profile_update_audit (\n\tid INTEGER NOT NULL, \n\tstudent_pk INTEGER NOT NULL, \n\tproposal_item_id INTEGER, \n\tactor_account_id INTEGER NOT NULL, \n\taction VARCHAR(24) NOT NULL, \n\tprovenance_id VARCHAR(36) NOT NULL, \n\tbefore_commitment VARCHAR(64) NOT NULL, \n\tafter_commitment VARCHAR(64) NOT NULL, \n\tevidence_commitment VARCHAR(64) NOT NULL, \n\trequest_commitment VARCHAR(64) NOT NULL, \n\tschema_version VARCHAR(40) NOT NULL, \n\tidempotency_key VARCHAR(36) NOT NULL, \n\tcreated_at DATETIME NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (actor_account_id, idempotency_key), \n\tFOREIGN KEY(student_pk) REFERENCES students (id) ON DELETE CASCADE, \n\tFOREIGN KEY(proposal_item_id) REFERENCES profile_update_proposal_items (id), \n\tFOREIGN KEY(actor_account_id) REFERENCES accounts (id)\n)\n\n')
    op.execute('CREATE INDEX ix_profile_update_audit_student_pk ON profile_update_audit (student_pk)')
    op.execute('\nCREATE TABLE ai_request_windows (\n\t"key" VARCHAR(120) NOT NULL, \n\tattempts INTEGER NOT NULL, \n\texpires_at DATETIME NOT NULL, \n\tPRIMARY KEY ("key")\n)\n\n')
    op.execute('CREATE INDEX ix_ai_request_windows_expires_at ON ai_request_windows (expires_at)')
    op.execute('\nCREATE TABLE ai_safe_cache (\n\t"key" VARCHAR(64) NOT NULL, \n\tstudent_pk INTEGER NOT NULL, \n\ttask_id VARCHAR(60) NOT NULL, \n\tresult_json JSON NOT NULL, \n\texpires_at DATETIME NOT NULL, \n\tPRIMARY KEY ("key"), \n\tFOREIGN KEY(student_pk) REFERENCES students (id) ON DELETE CASCADE\n)\n\n')
    op.execute('CREATE INDEX ix_ai_safe_cache_expires_at ON ai_safe_cache (expires_at)')
    op.execute('CREATE INDEX ix_ai_safe_cache_student_pk ON ai_safe_cache (student_pk)')
    op.execute('\nCREATE TABLE ai_diagnostics (\n\tid INTEGER NOT NULL, \n\ttask_id VARCHAR(60) NOT NULL, \n\tstatus VARCHAR(24) NOT NULL, \n\tcreated_at DATETIME NOT NULL, \n\tPRIMARY KEY (id)\n)\n\n')
    op.execute('CREATE INDEX ix_ai_diagnostics_created_at ON ai_diagnostics (created_at)')
    op.execute("CREATE TRIGGER profile_update_audit_no_update BEFORE UPDATE ON profile_update_audit BEGIN SELECT RAISE(ABORT, 'immutable audit'); END")

def downgrade():
    raise RuntimeError('Restore a verified backup; destructive downgrade is not supported')
