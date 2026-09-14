# Security

The demo applies role and tenant filters in API handlers. Hospital-scoped routes only return data for the selected hospital, while platform-level views can aggregate both tenants.

The prototype uses synthetic records and does not accept or store real protected health information. Production hardening would add managed authentication, session rotation, CSRF protection, database row-level policies, encryption, and a formal audit retention policy.