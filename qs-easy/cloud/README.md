# Enable shared projects
Create a Supabase project with email/password authentication and email confirmation enabled. Run schema.sql in a new database. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (the public browser key) in the Vite service's deployment environment and rebuild. Keep the service-role key private. Set the confirmation redirect URL to the deployed application.

Cloud projects use explicit save and open actions. Opening replaces the local copy of that project. Editors sign in with their own confirmed email. Only the owner manages the editor list. A revision check rejects stale saves. Browser backups include rate libraries and embedded documents.

# Enable AI reviews
Set VITE_OLLAMA_MODEL to an installed model name and optionally VITE_OLLAMA_URL to the trusted Ollama origin (default http://localhost:11434). Rebuild the frontend. Allow the website origin in the Ollama service's CORS settings. Each user must be able to reach this model from their browser. The review screen only sends the displayed project records after the user requests a review. Only use an endpoint authorised for that project's data.
