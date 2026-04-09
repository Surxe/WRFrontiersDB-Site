Source of truth for all agent related documentation.

Create symbolic links to gitignore'd `.windsurf/`, `.cursor/`, etc. to keep them in sync.

1. Open Command Prompt as Administrator
2. Run the following commands for `.windsurf/` and any other IDE-specific agent directories you use: Note that `/D` creates a directory junction (symbolic link) as opposed to a file link
   - `mklink /D "d:\Repositories\WRFrontiersDB-Site\.windsurf\skills" "d:\Repositories\WRFrontiersDB-Site\.agents\skills"`
   - `mklink /D "d:\Repositories\WRFrontiersDB-Site\.windsurf\rules" "d:\Repositories\WRFrontiersDB-Site\.agents\rules"`

Project-wide IDE-independent documentation for agents is still within `.github/`
