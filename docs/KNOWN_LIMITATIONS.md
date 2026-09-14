# Known Limitations

- Demo state is process-backed and resets when the API restarts; a production release should persist the relational entities in PostgreSQL.
- Authentication is represented by demo role switching; a production release should use managed authentication and server-issued sessions.
- Voice is designed as a replaceable layer, but the current demo uses browser text interaction so no telecom credentials are needed.
- The healthcare connector is synthetic and must be replaced with a vendor-approved implementation before real appointments or real patient data are introduced.